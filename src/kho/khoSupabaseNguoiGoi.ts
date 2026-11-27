// Xác định người gọi của bản Supabase (ticket toi-uu-hieu-nang 01): chỗ DUY NHẤT giữ phiên đang mở, nhớ hồ sơ
// theo phiên và làm các bước kiểm lặp lại ở đầu lệnh (người gọi có ở trong Dự án không, đọc Dự án, luật xem và
// luật quản lý Dự án). Các lệnh của khoSupabase.ts, khoSupabaseTask.ts, khoSupabaseVongDuyet.ts và
// khoSupabaseGitHub.ts nhận các hàm ở đây, không tự viết lại chuỗi kiểm.
//
// Nhớ hồ sơ (spec `.scratch/toi-uu-hieu-nang/spec.md`, mục "Kho nhớ hồ sơ của phiên đang mở"):
// - Hồ sơ đọc một lần khi đăng nhập và được nhớ theo phiên; lệnh đọc hồ sơ của tôi và lệnh sửa hồ sơ làm mới bản
//   nhớ; đăng xuất xoá phiên cùng bản nhớ của nó.
// - Vai mới vẫn có hiệu lực ngay (hợp đồng "vai mới có hiệu lực ngay ở lần đọc sau"): lệnh bị từ chối khi đang
//   dùng bản nhớ thì đọc lại hồ sơ MỘT lần; vai đã đổi thì chạy lại lệnh theo vai mới (`theoVaiMoiNhat`). Người
//   vừa được nâng vai vì vậy làm được ngay; người vừa bị hạ vai mà cơ sở dữ liệu từ chối (cơ sở dữ liệu vẫn là nơi
//   ép quyền) thì nhận đúng mã lỗi và đúng thứ tự từ chối mà luật thuần trả theo vai mới.
// - Phiên mà client Supabase không còn giữ (hết hạn, làm mới bị từ chối) thì trả `CHUA_DANG_NHAP` ngay, không gọi
//   mạng; máy chủ từ chối phiên (`CHUA_DANG_NHAP` từ cơ sở dữ liệu) hay hồ sơ không còn thì bản nhớ bị xoá.
//
// Dùng chung lượt đọc đang bay (ticket toi-uu-hieu-nang 03, Chi tiết Dự án gọi cùng lúc ba lệnh):
// - `dungChungKhiDangBay`: các lệnh gọi cùng lúc trên cùng phiên và cùng khoá (vd. cùng Dự án) dùng chung MỘT lời
//   hứa đang chạy. Lời hứa bị bỏ ngay khi xong (thành công hay lỗi): lệnh gọi sau đó luôn tự đọc lại. Không có bộ
//   đệm theo thời gian, không đọc đồng hồ.
// - Mọi lệnh không thuộc danh sách chỉ đọc (lệnh ghi, đăng nhập, đăng xuất...) xoá mọi lời hứa đang bay lúc bắt
//   đầu và lúc xong (`bocQuenDangBayKhiGhi`): kết quả dùng chung không sống qua lệnh ghi, kể cả lượt đọc gửi đi
//   trong khi lệnh ghi đang chạy.
//
// Đọc Task kèm Dự án (ticket toi-uu-hieu-nang 04, Ngăn trượt Task gọi cùng lúc layTask, layDuAn,
// danhSachNguoiTrongDuAn, lichSuTask, danhSachLienKetCuaTask, danhSachDuAnCuaToi):
// - `xemTaskKemDuAn`: MỘT lượt đọc dòng Task kèm dòng Dự án và mọi Người trong dự án của nó (nhúng), rồi cùng luật
//   xem với `xemDuAn`. Các lệnh gọi cùng lúc trên cùng Task dùng chung lượt này khi nó còn đang bay.
// - `xemDuAnKemNguoiTrong` gọi cùng lúc với một lượt đọc Task còn đang bay thì chờ lượt đó: Task thuộc đúng Dự án
//   (cùng người gọi, cùng vai) thì dùng luôn dòng Dự án và Người trong dự án đã nhúng, không đọc lại.
//
// Lệnh ghi trên một Dự án (ticket toi-uu-hieu-nang 05): `quanLyDuAn` là MỘT lượt đọc dòng Dự án kèm id Người trong dự
// án nhúng, cùng mã lỗi và thứ tự từ chối như trước (quyền, rồi tồn tại).
//
// Lệnh ghi trên một Task (ticket toi-uu-hieu-nang 06): `xemTaskDeGhi` là chính lượt đọc của `xemTaskKemDuAn` (Task kèm
// Dự án và Người trong dự án) nhưng không dùng chung khi đang bay; `quanLyTask` thêm luật quản lý Dự án lên nó.
import type { SupabaseClient } from '@supabase/supabase-js'
import { thanhCong, thatBai, type KetQua } from './ketQua'
import type { HoSo, Phien } from './khoDuLieu'
import { duocQuanLyDuAn, duocXemDuAn, type NguoiGoiDuAn } from '../luat/duAn'

/** Người gọi đã đăng nhập: client gắn với phiên của họ và hồ sơ (vai) đang dùng để quyết. */
export interface NguoiGoi {
  db: SupabaseClient
  hoSo: HoSo
}

/** Người gọi kèm dòng Dự án đã đọc và cách người đó nhìn Dự án (vai, có ở trong Dự án không). */
export interface NguCanhDuAn<DongDuAn> {
  nguoiGoi: NguoiGoi
  duAn: DongDuAn
  nhin: NguoiGoiDuAn
}

/**
 * Như `NguCanhDuAn`, kèm id mọi Người trong dự án (đọc cùng lượt kiểm quản lý Dự án, `quanLyDuAn`), để lệnh tạo Task
 * kiểm người được chọn mà không đọc thêm (ticket toi-uu-hieu-nang 06).
 */
export type NguCanhQuanLyDuAn<DongDuAn> = NguCanhDuAn<DongDuAn> & { idNguoiTrong: string[] }

/** Như `NguCanhDuAn`, kèm mọi dòng Người trong dự án người gọi đọc được (đọc cùng lượt kiểm xem Dự án). */
export type NguCanhDuAnKemNguoiTrong<DongDuAn, DongNguoiTrong> = NguCanhDuAn<DongDuAn> & {
  nguoiTrong: DongNguoiTrong[]
}

/** Như `NguCanhDuAnKemNguoiTrong`, kèm dòng Task (đọc cùng lượt với Dự án của nó). */
export type NguCanhTask<DongDuAn, DongNguoiTrong, DongTask> = NguCanhDuAnKemNguoiTrong<DongDuAn, DongNguoiTrong> & {
  task: DongTask
}

/** Một lượt đọc Task: dòng Task, dòng Dự án của nó (null nếu không thấy) và mọi Người trong dự án đó. */
export interface DongTaskKemDuAn<DongTask, DongDuAn, DongNguoiTrong> {
  task: DongTask
  duAn: DongDuAn | null
  nguoiTrong: DongNguoiTrong[]
}

/** Lỗi trả về từ PostgREST (bảng, RPC). */
interface LoiCsdl {
  code?: string
  message?: string
}

/** Đầu khoá của lượt đọc Task dùng chung (`xemTaskKemDuAn`), để `xemDuAnKemNguoiTrong` tìm các lượt đang bay. */
const KHOA_XEM_TASK = 'xem-task|'

/** Những gì khoSupabase.ts đưa vào: đọc hồ sơ, đọc một dòng Dự án, và cách đổi lỗi của cơ sở dữ liệu. */
export interface PhuThuocNguoiGoi<DongDuAn, DongNguoiTrong extends { nguoi_dung_id: string }, DongTask = never> {
  /** Hồ sơ của tài khoản `id`, hoặc null nếu không còn (hay người gọi không thấy). */
  docHoSo(db: SupabaseClient, id: string): Promise<KetQua<HoSo | null>>
  /** Một dòng Dự án người gọi thấy được, hoặc null (không tồn tại hay phân quyền từng dòng giấu đi). */
  docDongDuAn(db: SupabaseClient, duAnId: string): Promise<KetQua<DongDuAn | null>>
  /**
   * Một dòng Dự án (id đã là uuid) người gọi thấy được kèm id mọi Người trong dự án của nó, trong MỘT lượt gọi; null
   * nếu không tồn tại hay phân quyền từng dòng giấu đi. Người trong dự án đọc theo cùng phân quyền như
   * `docNguoiTrongDuAn` (ai thấy Dự án thì thấy đủ người của nó).
   */
  docDongDuAnKemIdNguoiTrong(db: SupabaseClient, duAnId: string): Promise<KetQua<{ duAn: DongDuAn; idNguoiTrong: string[] } | null>>
  /** Mọi dòng Người trong dự án `duAnId` người gọi đọc được (phân quyền từng dòng theo cùng luật xem Dự án). */
  docNguoiTrongDuAn(db: SupabaseClient, duAnId: string): Promise<KetQua<DongNguoiTrong[]>>
  /**
   * Một Task (id đã là uuid) người gọi thấy được kèm Dự án và Người trong dự án của nó, trong MỘT lượt gọi; null nếu
   * không tồn tại hay phân quyền từng dòng giấu đi. Dự án và Người trong dự án đọc theo cùng phân quyền như
   * `docDongDuAn`, `docNguoiTrongDuAn`.
   */
  docTaskKemDuAn(db: SupabaseClient, taskId: string): Promise<KetQua<DongTaskKemDuAn<DongTask, DongDuAn, DongNguoiTrong> | null>>
  laUuid(id: string): boolean
  loiTuCsdl<T = never>(loi: LoiCsdl): KetQua<T>
}

interface PhienMo {
  db: SupabaseClient
  nguoiDungId: string
  /** Hồ sơ đang nhớ; null khi chưa đọc được hoặc vừa bị xoá (lần sau đọc lại). */
  hoSo: HoSo | null
  /** Lần đọc hồ sơ đang chạy khi bản nhớ trống, để các lệnh gọi cùng lúc dùng chung một lượt. */
  dangDoc: Promise<KetQua<HoSo>> | null
}

export function taoXacDinhNguoiGoi<
  DongDuAn extends { id: string },
  DongNguoiTrong extends { nguoi_dung_id: string },
  DongTask = never,
>(phuThuoc: PhuThuocNguoiGoi<DongDuAn, DongNguoiTrong, DongTask>) {
  const phienDangMo = new Map<string, PhienMo>()
  /** Lời hứa đang bay dùng chung, theo `${maPhien}|${khoá}`; bỏ ngay khi xong hoặc khi có lệnh ghi. */
  const dangBay = new Map<string, Promise<unknown>>()

  function layPhienMo(phien: Phien | null): PhienMo | null {
    if (!phien) return null
    const mo = phienDangMo.get(phien.maPhien)
    return mo && mo.nguoiDungId === phien.nguoiDungId ? mo : null
  }

  /** Client còn giữ phiên không (không gọi mạng khi mã còn hạn; hết hạn thì client tự làm mới). */
  async function conPhien(mo: PhienMo): Promise<boolean> {
    const { data, error } = await mo.db.auth.getSession()
    return !error && data.session !== null
  }

  /** Đọc hồ sơ từ cơ sở dữ liệu và ghi vào bản nhớ; hồ sơ không còn thì xoá bản nhớ và trả `CHUA_DANG_NHAP`. */
  async function docHoSoVaoBanNho(mo: PhienMo): Promise<KetQua<HoSo>> {
    const kq = await phuThuoc.docHoSo(mo.db, mo.nguoiDungId)
    if (!kq.ok) {
      if (kq.loi.ma === 'CHUA_DANG_NHAP') mo.hoSo = null
      return kq
    }
    if (!kq.giaTri) {
      mo.hoSo = null
      return thatBai('CHUA_DANG_NHAP')
    }
    mo.hoSo = kq.giaTri
    return thanhCong(kq.giaTri)
  }

  /** Như `docHoSoVaoBanNho` nhưng các lệnh gọi cùng lúc khi bản nhớ trống dùng chung một lượt đọc. */
  function docHoSoChung(mo: PhienMo): Promise<KetQua<HoSo>> {
    if (!mo.dangDoc) {
      mo.dangDoc = docHoSoVaoBanNho(mo).finally(() => {
        mo.dangDoc = null
      })
    }
    return mo.dangDoc
  }

  /** Người gọi đã đăng nhập, theo hồ sơ đang nhớ (đọc nếu chưa có). */
  async function xacThuc(phien: Phien | null): Promise<KetQua<NguoiGoi>> {
    const mo = layPhienMo(phien)
    if (!mo) return thatBai('CHUA_DANG_NHAP')
    if (!(await conPhien(mo))) {
      mo.hoSo = null
      return thatBai('CHUA_DANG_NHAP')
    }
    if (mo.hoSo) return thanhCong({ db: mo.db, hoSo: mo.hoSo })
    const hoSo = await docHoSoChung(mo)
    if (!hoSo.ok) return hoSo
    return thanhCong({ db: mo.db, hoSo: hoSo.giaTri })
  }

  /** Người gọi đã đăng nhập, kèm hồ sơ đọc MỚI từ cơ sở dữ liệu (luôn gọi mạng); bản nhớ được làm mới. */
  async function docLaiHoSo(phien: Phien | null): Promise<KetQua<NguoiGoi>> {
    const mo = layPhienMo(phien)
    if (!mo) return thatBai('CHUA_DANG_NHAP')
    if (!(await conPhien(mo))) {
      mo.hoSo = null
      return thatBai('CHUA_DANG_NHAP')
    }
    const hoSo = await docHoSoVaoBanNho(mo)
    if (!hoSo.ok) return hoSo
    return thanhCong({ db: mo.db, hoSo: hoSo.giaTri })
  }

  /** Ghi vào bản nhớ hồ sơ của chính người gọi mà một lệnh vừa đọc hay ghi được (sửa hồ sơ, đổi vai chính mình...). */
  function ghiNhoHoSo(phien: Phien | null, hoSo: HoSo): void {
    const mo = layPhienMo(phien)
    if (mo && hoSo.id === mo.nguoiDungId) mo.hoSo = hoSo
  }

  /** Xoá bản nhớ hồ sơ (phiên vẫn mở): lệnh sau đọc lại hồ sơ. */
  function quenHoSo(phien: Phien | null): void {
    const mo = layPhienMo(phien)
    if (mo) mo.hoSo = null
  }

  /**
   * Chạy một lệnh theo vai mới nhất. Lệnh thành công thì trả luôn (không gọi thêm). Lệnh bị từ chối trong khi
   * đang dùng hồ sơ đã nhớ từ trước thì đọc lại hồ sơ một lần: vai không đổi thì giữ đúng lỗi cũ; vai đã đổi thì
   * chạy lại lệnh theo vai mới, để mã lỗi và thứ tự từ chối đúng như luật thuần với vai mới (người được nâng vai
   * làm được ngay). Không đọc lại với `LOI_HE_THONG` (không do vai; tránh chạy lại một lệnh có thể đã ghi xong).
   */
  async function theoVaiMoiNhat<T>(phien: Phien | null, lenh: () => Promise<KetQua<T>>): Promise<KetQua<T>> {
    const vaiDaNho = layPhienMo(phien)?.hoSo?.vai
    const kq = await lenh()
    if (kq.ok) return kq
    if (kq.loi.ma === 'CHUA_DANG_NHAP') {
      quenHoSo(phien)
      return kq
    }
    // Bản nhớ trống lúc bắt đầu: lệnh đã tự đọc hồ sơ mới, không cần đọc lại.
    if (vaiDaNho === undefined || kq.loi.ma === 'LOI_HE_THONG') return kq
    const moi = await docLaiHoSo(phien)
    if (!moi.ok) return moi.loi.ma === 'CHUA_DANG_NHAP' ? thatBai('CHUA_DANG_NHAP') : kq
    if (moi.giaTri.hoSo.vai === vaiDaNho) return kq
    return lenh()
  }

  /**
   * Bọc mọi lệnh của `kho` (trừ `boQua`) bằng `theoVaiMoiNhat`, lấy tham số đầu là phiên. Lệnh mới thêm vào Kho
   * được bọc mặc định; chỉ lệnh không nhận phiên hay không dùng vai mới nằm trong `boQua`.
   */
  function bocTheoVaiMoiNhat<K extends object>(kho: K, boQua: ReadonlySet<keyof K>): K {
    const daBoc: Record<string, unknown> = { ...(kho as Record<string, unknown>) }
    for (const [ten, lenh] of Object.entries(kho)) {
      if (boQua.has(ten as keyof K) || typeof lenh !== 'function') continue
      const goc = lenh as (phien: Phien | null, ...thamSo: unknown[]) => Promise<KetQua<unknown>>
      daBoc[ten] = (phien: Phien | null, ...thamSo: unknown[]) => theoVaiMoiNhat(phien, () => goc(phien, ...thamSo))
    }
    return daBoc as K
  }

  /**
   * Các lệnh gọi cùng lúc trên cùng phiên với cùng `khoa` dùng chung một lời hứa đang chạy (`tao` chỉ chạy một
   * lần). Lời hứa bị bỏ ngay khi xong, nên lệnh gọi sau đó tự đọc lại; `quenDangBay` bỏ mọi lời hứa đang bay.
   */
  function dungChungKhiDangBay<T>(phien: Phien, khoa: string, tao: () => Promise<T>): Promise<T> {
    const day = `${phien.maPhien}|${khoa}`
    const co = dangBay.get(day)
    if (co) return co as Promise<T>
    const moi: Promise<T> = tao().finally(() => {
      // Chỉ bỏ đúng lời hứa này (có thể đã bị một lệnh ghi bỏ và thay bằng lời hứa mới).
      if (dangBay.get(day) === moi) dangBay.delete(day)
    })
    dangBay.set(day, moi)
    return moi
  }

  /** Bỏ mọi lời hứa đang bay dùng chung: lệnh đọc gọi sau đó tự đọc lại. */
  function quenDangBay(): void {
    dangBay.clear()
  }

  /**
   * Bọc mọi lệnh của `kho` không thuộc `lenhChiDoc`: bỏ mọi lời hứa đang bay lúc lệnh bắt đầu và lúc lệnh xong,
   * để lượt đọc gửi đi trước hay trong khi lệnh ghi chạy không được dùng lại sau lệnh ghi. Lệnh mới thêm vào Kho
   * mặc định được coi là lệnh ghi (an toàn: chỉ mất phần dùng chung).
   */
  function bocQuenDangBayKhiGhi<K extends object>(kho: K, lenhChiDoc: ReadonlySet<keyof K>): K {
    const daBoc: Record<string, unknown> = { ...(kho as Record<string, unknown>) }
    for (const [ten, lenh] of Object.entries(kho)) {
      if (lenhChiDoc.has(ten as keyof K) || typeof lenh !== 'function') continue
      const goc = lenh as (...thamSo: unknown[]) => Promise<unknown>
      daBoc[ten] = (...thamSo: unknown[]) => {
        quenDangBay()
        return Promise.resolve(goc(...thamSo)).finally(quenDangBay)
      }
    }
    return daBoc as K
  }

  /** Luật xem trên Dự án đã đọc được: không được xem trả cùng lỗi với không tồn tại (`KHONG_TIM_THAY`). */
  function ketLuanXem(nguoiGoi: NguoiGoi, dong: DongDuAn, laTrong: boolean): KetQua<NguCanhDuAn<DongDuAn>> {
    const nhin: NguoiGoiDuAn = { vaiNguoiGoi: nguoiGoi.hoSo.vai, laNguoiTrongDuAn: laTrong }
    if (!duocXemDuAn(nhin)) return thatBai('KHONG_TIM_THAY')
    return thanhCong({ nguoiGoi, duAn: dong, nhin })
  }

  async function laNguoiTrongDuAn(nguoiGoi: NguoiGoi, duAnId: string): Promise<KetQua<boolean>> {
    if (!phuThuoc.laUuid(duAnId)) return thanhCong(false)
    const { data, error } = await nguoiGoi.db
      .from('nguoi_trong_du_an')
      .select('du_an_id')
      .eq('du_an_id', duAnId)
      .eq('nguoi_dung_id', nguoiGoi.hoSo.id)
      .maybeSingle()
    if (error) return phuThuoc.loiTuCsdl(error)
    return thanhCong(data !== null)
  }

  /**
   * Đọc một Dự án: không tồn tại và không thấy được trả cùng một lỗi `KHONG_TIM_THAY` (phân quyền
   * từng dòng đã giấu Dự án người gọi không thấy; luật thuần kiểm lại lần nữa).
   */
  async function xemDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<NguCanhDuAn<DongDuAn>>> {
    const xt = await xacThuc(phien)
    if (!xt.ok) return xt
    const dong = await phuThuoc.docDongDuAn(xt.giaTri.db, duAnId)
    if (!dong.ok) return dong
    if (!dong.giaTri) return thatBai('KHONG_TIM_THAY')
    const trong = await laNguoiTrongDuAn(xt.giaTri, duAnId)
    if (!trong.ok) return trong
    return ketLuanXem(xt.giaTri, dong.giaTri, trong.giaTri)
  }

  /**
   * Như `xemDuAn` (cùng luật, cùng mã lỗi), nhưng đọc dòng Dự án và MỌI Người trong dự án cùng lúc (2 lượt), rồi
   * biết người gọi có ở trong Dự án từ chính danh sách đó. Các lệnh gọi cùng lúc trên cùng phiên, cùng hồ sơ (vai)
   * và cùng Dự án dùng chung các lượt đọc này khi chúng còn đang bay (`dungChungKhiDangBay`): màn Chi tiết Dự án
   * gọi cùng lúc `layDuAn`, `danhSachNguoiTrongDuAn`, `danhSachTask` mà chỉ kiểm một lần.
   */
  async function xemDuAnKemNguoiTrong(
    phien: Phien | null,
    duAnId: string,
  ): Promise<KetQua<NguCanhDuAnKemNguoiTrong<DongDuAn, DongNguoiTrong>>> {
    const xt = await xacThuc(phien)
    if (!xt.ok) return xt
    if (!phien) return thatBai('CHUA_DANG_NHAP')
    const nguoiGoi = xt.giaTri
    // Vai nằm trong khoá: lệnh chạy lại theo vai mới (`theoVaiMoiNhat`) không dùng lại kết quả theo vai cũ.
    const khoa = `xem-du-an|${nguoiGoi.hoSo.id}|${nguoiGoi.hoSo.vai}|${duAnId}`
    // Chưa có lượt đọc Dự án này đang bay mà có lượt đọc Task đang bay (Ngăn trượt Task): chờ nó, Task thuộc đúng
    // Dự án này thì dùng luôn Dự án và Người trong dự án đã nhúng.
    if (!dangBay.has(`${phien.maPhien}|${khoa}`)) {
      const tuTask = await nguCanhTuTaskDangBay(phien, nguoiGoi, duAnId)
      if (tuTask) return thanhCong(tuTask)
    }
    return dungChungKhiDangBay(phien, khoa, async () => {
      const [dong, trong] = await Promise.all([
        phuThuoc.docDongDuAn(nguoiGoi.db, duAnId),
        phuThuoc.laUuid(duAnId) ? phuThuoc.docNguoiTrongDuAn(nguoiGoi.db, duAnId) : Promise.resolve(thanhCong([])),
      ])
      // Cùng thứ tự từ chối như `xemDuAn`: lỗi đọc Dự án, Dự án không thấy, rồi mới tới lỗi đọc Người trong dự án.
      if (!dong.ok) return dong
      if (!dong.giaTri) return thatBai('KHONG_TIM_THAY')
      if (!trong.ok) return trong
      const xem = ketLuanXem(nguoiGoi, dong.giaTri, coTrongDanhSach(nguoiGoi, trong.giaTri))
      if (!xem.ok) return xem
      return thanhCong({ ...xem.giaTri, nguoiTrong: trong.giaTri })
    })
  }

  /** Người gọi có trong danh sách Người trong dự án không (id không phân biệt hoa thường). */
  function coTrongDanhSach(nguoiGoi: NguoiGoi, nguoiTrong: readonly DongNguoiTrong[]): boolean {
    const id = nguoiGoi.hoSo.id.toLowerCase()
    return nguoiTrong.some((n) => n.nguoi_dung_id.toLowerCase() === id)
  }

  /**
   * Chờ mọi lượt đọc Task đang bay của phiên (`xemTaskKemDuAn`); lượt nào xem được Task của Dự án `duAnId` theo
   * cùng người gọi và cùng vai thì trả ngữ cảnh Dự án của nó (dòng Dự án, cách nhìn, Người trong dự án). Không có
   * thì null: người gọi tự đọc. Lượt đọc Task không chờ gì nên không có vòng chờ.
   */
  async function nguCanhTuTaskDangBay(
    phien: Phien,
    nguoiGoi: NguoiGoi,
    duAnId: string,
  ): Promise<NguCanhDuAnKemNguoiTrong<DongDuAn, DongNguoiTrong> | null> {
    const dau = `${phien.maPhien}|${KHOA_XEM_TASK}`
    const cacLuot = [...dangBay].filter(([day]) => day.startsWith(dau)).map(([, loiHua]) => loiHua)
    if (cacLuot.length === 0) return null
    const ketQua = await Promise.allSettled(cacLuot as Promise<KetQua<NguCanhTask<DongDuAn, DongNguoiTrong, DongTask>>>[])
    for (const kq of ketQua) {
      if (kq.status !== 'fulfilled' || !kq.value.ok) continue
      const { nguoiGoi: cua, duAn, nhin, nguoiTrong } = kq.value.giaTri
      if (cua.hoSo.id !== nguoiGoi.hoSo.id || cua.hoSo.vai !== nguoiGoi.hoSo.vai) continue
      if (duAn.id.toLowerCase() !== duAnId.toLowerCase()) continue
      return { nguoiGoi, duAn, nhin, nguoiTrong }
    }
    return null
  }

  /**
   * Một Task người gọi xem được, kèm Dự án và mọi Người trong dự án của nó, trong MỘT lượt đọc. Cùng mã lỗi và thứ
   * tự từ chối như đọc dòng Task rồi `xemDuAn` trên Dự án của nó: chưa đăng nhập; id không phải uuid, Task không tồn
   * tại hay không thấy được, Dự án không xem được đều `KHONG_TIM_THAY`. Các lệnh gọi cùng lúc trên cùng phiên, cùng
   * Task dùng chung lượt này khi nó còn đang bay; lời hứa được ghi ngay lúc gọi (trước mọi `await`) để
   * `xemDuAnKemNguoiTrong` gọi cùng lúc tìm thấy nó.
   */
  function xemTaskKemDuAn(
    phien: Phien | null,
    taskId: string,
  ): Promise<KetQua<NguCanhTask<DongDuAn, DongNguoiTrong, DongTask>>> {
    if (!phien || !layPhienMo(phien)) return Promise.resolve(thatBai('CHUA_DANG_NHAP'))
    // Vai theo bản nhớ nằm trong khoá (như `xemDuAnKemNguoiTrong`): lệnh chạy lại theo vai mới không dùng kết quả cũ.
    const nho = layPhienMo(phien)?.hoSo
    const khoa = `${KHOA_XEM_TASK}${nho?.id ?? ''}|${nho?.vai ?? ''}|${taskId}`
    return dungChungKhiDangBay(phien, khoa, () => xemTaskDeGhi(phien, taskId))
  }

  /**
   * Như `xemTaskKemDuAn` (cùng MỘT lượt đọc, cùng luật xem và mã lỗi) nhưng KHÔNG dùng chung khi đang bay: lệnh ghi
   * Task (ticket toi-uu-hieu-nang 06) đọc Task trước khi ghi, và lượt đọc đó không được để lệnh đọc gọi cùng lúc dùng
   * lại (kết quả trước khi ghi), cũng không để `xemDuAnKemNguoiTrong` chờ nó.
   */
  async function xemTaskDeGhi(
    phien: Phien | null,
    taskId: string,
  ): Promise<KetQua<NguCanhTask<DongDuAn, DongNguoiTrong, DongTask>>> {
    const xt = await xacThuc(phien)
    if (!xt.ok) return xt
    const nguoiGoi = xt.giaTri
    // Không phải uuid thì chắc chắn không có Task nào (và gửi đi sẽ gây lỗi kiểu).
    if (!phuThuoc.laUuid(taskId)) return thatBai('KHONG_TIM_THAY')
    const doc = await phuThuoc.docTaskKemDuAn(nguoiGoi.db, taskId)
    if (!doc.ok) return doc
    if (!doc.giaTri || !doc.giaTri.duAn) return thatBai('KHONG_TIM_THAY')
    const { task, duAn, nguoiTrong } = doc.giaTri
    const xem = ketLuanXem(nguoiGoi, duAn, coTrongDanhSach(nguoiGoi, nguoiTrong))
    if (!xem.ok) return xem
    return thanhCong({ ...xem.giaTri, nguoiTrong, task })
  }

  /**
   * Ghi lên một Task (sửa, đổi người): như `quanLyDuAn` trên Dự án của Task, trong MỘT lượt đọc (`xemTaskDeGhi`,
   * ticket toi-uu-hieu-nang 06). Cùng mã lỗi và thứ tự như đọc dòng Task rồi `quanLyDuAn`: Task không tồn tại, không
   * thấy được hay id sai dạng thì người không phải PM nhận `KHONG_CO_QUYEN` (không lộ gì), PM nhận `KHONG_TIM_THAY`
   * (PM thấy mọi Dự án nên Task PM không thấy là Task không có); thấy mà không quản lý được Dự án thì `KHONG_CO_QUYEN`.
   */
  async function quanLyTask(
    phien: Phien | null,
    taskId: string,
  ): Promise<KetQua<NguCanhTask<DongDuAn, DongNguoiTrong, DongTask>>> {
    const xem = await xemTaskDeGhi(phien, taskId)
    if (!xem.ok) {
      if (xem.loi.ma !== 'KHONG_TIM_THAY') return xem
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      return xt.giaTri.hoSo.vai === 'PM' ? xem : thatBai('KHONG_CO_QUYEN')
    }
    if (!duocQuanLyDuAn(xem.giaTri.nhin)) return thatBai('KHONG_CO_QUYEN')
    return xem
  }

  /**
   * Ghi lên một Dự án: kiểm quyền trước khi xem Dự án có tồn tại, như bản bộ nhớ (người không phải
   * PM luôn nhận `KHONG_CO_QUYEN` với Dự án không phải của mình, dù có tồn tại hay không).
   *
   * MỘT lượt gọi (ticket toi-uu-hieu-nang 05): dòng Dự án kèm id mọi Người trong dự án nhúng. Dự án không thấy được
   * (không tồn tại, hay phân quyền từng dòng giấu vì người gọi không phải PM và không ở trong) thì người gọi chắc chắn
   * không ở trong Dự án: phân quyền của nguoi_trong_du_an theo cùng luật xem với du_an, nên lượt đọc riêng "có ở
   * trong không" của trước đây cũng trả không. Vì vậy cùng mã lỗi và thứ tự: không quản lý được thì
   * `KHONG_CO_QUYEN`, rồi mới tới `KHONG_TIM_THAY`.
   */
  async function quanLyDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<NguCanhQuanLyDuAn<DongDuAn>>> {
    const xt = await xacThuc(phien)
    if (!xt.ok) return xt
    const nguoiGoi = xt.giaTri
    const doc = phuThuoc.laUuid(duAnId)
      ? await phuThuoc.docDongDuAnKemIdNguoiTrong(nguoiGoi.db, duAnId)
      : thanhCong(null)
    if (!doc.ok) return doc
    const id = nguoiGoi.hoSo.id.toLowerCase()
    const laTrong = doc.giaTri !== null && doc.giaTri.idNguoiTrong.some((n) => n.toLowerCase() === id)
    const nhin: NguoiGoiDuAn = { vaiNguoiGoi: nguoiGoi.hoSo.vai, laNguoiTrongDuAn: laTrong }
    if (!duocQuanLyDuAn(nhin)) return thatBai('KHONG_CO_QUYEN')
    if (!doc.giaTri) return thatBai('KHONG_TIM_THAY')
    return thanhCong({ nguoiGoi, duAn: doc.giaTri.duAn, nhin, idNguoiTrong: doc.giaTri.idNguoiTrong })
  }

  return {
    /** Mở phiên vừa đăng nhập; hồ sơ đọc ngay (thuộc lượt đăng nhập), đọc không được thì để lệnh sau đọc. */
    async moPhien(phien: Phien, db: SupabaseClient): Promise<void> {
      const mo: PhienMo = { db, nguoiDungId: phien.nguoiDungId, hoSo: null, dangDoc: null }
      phienDangMo.set(phien.maPhien, mo)
      await docHoSoChung(mo)
    },
    /** Đóng phiên (đăng xuất): bỏ phiên cùng bản nhớ hồ sơ; trả client để kết thúc phiên Auth, hoặc null. */
    dongPhien(phien: Phien | null): SupabaseClient | null {
      const mo = layPhienMo(phien)
      if (!mo || !phien) return null
      phienDangMo.delete(phien.maPhien)
      for (const day of dangBay.keys()) if (day.startsWith(`${phien.maPhien}|`)) dangBay.delete(day)
      return mo.db
    },
    /** Client của phiên mở sau cùng (Map giữ thứ tự thêm vào); ứng dụng chỉ giữ một phiên một lúc. */
    clientPhienCuoi(): SupabaseClient | null {
      const cacPhien = [...phienDangMo.values()]
      return cacPhien[cacPhien.length - 1]?.db ?? null
    },
    xacThuc,
    docLaiHoSo,
    ghiNhoHoSo,
    quenHoSo,
    theoVaiMoiNhat,
    bocTheoVaiMoiNhat,
    dungChungKhiDangBay,
    bocQuenDangBayKhiGhi,
    laNguoiTrongDuAn,
    xemDuAn,
    xemDuAnKemNguoiTrong,
    xemTaskKemDuAn,
    xemTaskDeGhi,
    quanLyTask,
    quanLyDuAn,
  }
}
