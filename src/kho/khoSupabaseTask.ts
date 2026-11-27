// Lệnh Task của bản cài Supabase (ticket 10): tạo, sửa, đổi người, danh sách, chi tiết, "Việc của
// tôi", "Chờ tôi duyệt" và danh sách Task chưa chốt của người sắp bị gỡ (ticket 07, 08, 09).
//
// - Dữ liệu: bảng public.task và hàm public.ten_nguoi_cua_task trong
//   supabase/migrations/20261125000200_lat_2_task.sql.
// - Như phần Dự án: quyền được kiểm hai lần, ở đây bằng chính luật thuần (src/luat/task.ts) để trả
//   đúng mã lỗi và đúng thứ tự như bản bộ nhớ, và ở cơ sở dữ liệu (phân quyền từng dòng, trigger)
//   vì trình duyệt không đáng tin. Lỗi mà cơ sở dữ liệu ném ra mang mã lỗi của Kho.
// - Chỉ ghi các cột client được phép (tiêu đề, mô tả, hạn, hai người). Trạng thái, số lần Trả lại
//   và dấu vết không bao giờ nằm trong lệnh ghi: cơ sở dữ liệu đặt hoặc chặn.
// - Giờ do máy chủ đặt: tham số `bayGio` bị bỏ qua (như phần Dự án).
//
// File này nhận các hàm dùng chung của khoSupabase.ts qua `PhuThuocLenhTask` để không import vòng.
//
// CỔNG CHƯA KIỂM: các lệnh cần mạng chỉ chạy được với Supabase thật (lệnh riêng, xem
// src/kho/khoSupabase.test.ts). Cổng chỉ kiểm nhánh không gọi mạng (chưa đăng nhập).
import type { SupabaseClient } from '@supabase/supabase-js'
import { thanhCong, thatBai, type KetQua } from './ketQua'
import type { NguCanhDuAn as NguCanhDuAnChung, NguoiGoi } from './khoSupabaseNguoiGoi'
import type { KhoDuLieu, NguoiCuaTask, NguoiDauVet, Phien, Task, TaskKemDuAn } from './khoDuLieu'
import { laChoToiDuyet, laViecCuaToi } from '../luat/kanban'
import {
  CAC_TRANG_THAI_TASK,
  duocXemTask,
  kiemDoiNguoiTask,
  kiemNguoiTask,
  kiemSuaTask,
  kiemTaoTask,
  kiemTraSuaTask,
  kiemTraTask,
  laTaskDaChot,
  taskChuaChotNguoiDangGiu,
  type TrangThaiTask,
} from '../luat/task'
import type { TrangThaiDuAn } from '../luat/duAn'
import { MUC_UU_TIEN_MAC_DINH, THONG_BAO_MUC_UU_TIEN, laMucUuTien, type MucUuTien } from '../luat/mucUuTien'

// `muc_uu_tien` (ticket truong-moi 04): cột, ràng buộc `task_muc_uu_tien_hop_le` và trigger ghi dòng lịch sử đổi
// mức do supabase/migrations/20261126000600_truong_task_ho_so_nguoi.sql thêm (Task có sẵn nhận Trung bình); bản
// này chỉ đọc và gửi cột. Chưa có migration thì Supabase thật báo lỗi.
export const COT_TASK =
  'id, du_an_id, tieu_de, mo_ta, han, muc_uu_tien, nguoi_thuc_hien_id, nguoi_kiem_tra_id, trang_thai, so_lan_tra_lai, tao_boi, tao_luc, sua_boi, sua_luc'

/**
 * Đọc từng trang để không bị cắt ở giới hạn số dòng của máy chủ (mặc định 1000 dòng một lần gọi).
 * Máy chủ phải cho ít nhất bằng cỡ trang này (xem supabase/README.md).
 */
const CO_TRANG = 500

/** Trạng thái chưa chốt: mọi trạng thái trừ Hoàn thành và Huỷ. */
const TRANG_THAI_CHUA_CHOT = CAC_TRANG_THAI_TASK.filter((trangThai) => !laTaskDaChot(trangThai))

export interface DongTask {
  id: string
  du_an_id: string
  tieu_de: string
  mo_ta: string
  han: string | null
  muc_uu_tien?: string | null
  nguoi_thuc_hien_id: string
  nguoi_kiem_tra_id: string
  trang_thai: string
  so_lan_tra_lai: number
  tao_boi: string
  tao_luc: string
  sua_boi: string | null
  sua_luc: string | null
}

interface DongTaskKemDuAn extends DongTask {
  du_an: { ten: string; ma?: string | null } | { ten: string; ma?: string | null }[] | null
}

/** Một dòng link của Task (bảng lien_ket_task). */
export interface DongLienKetTask {
  repo: string
  loai: string
  so: number
}

/**
 * Dòng Task của lượt đọc Task theo id dùng chung (`xemTaskKemDuAn`): kèm các link của Task nhúng cùng lượt (theo thứ
 * tự thêm), để `layTask` và `danhSachLienKetCuaTask` gọi cùng lúc chỉ tốn một lượt (ticket toi-uu-hieu-nang 04).
 */
export interface DongTaskKemLienKet extends DongTask {
  lien_ket_task?: DongLienKetTask[] | null
}

/** Cột của lượt đọc Task theo id: mọi cột Task và các link nhúng (phần nhúng Dự án do khoSupabase.ts thêm). */
export const COT_TASK_KEM_LIEN_KET = `${COT_TASK}, lien_ket_task(repo, loai, so)`

/** Tối đa số link đọc của một Task (như lượt đọc link riêng trước đây). */
export const SO_LIEN_KET_TOI_DA = 1000

/** Lỗi trả về từ PostgREST (bảng, RPC). */
interface LoiCsdl {
  code?: string
  message?: string
}

type NguCanhDuAn = NguCanhDuAnChung<{ id: string; trang_thai: string }>

/**
 * Các hàm dùng chung mà khoSupabase.ts đưa vào: xác định người gọi (khoSupabaseNguoiGoi.ts: xác thực theo hồ sơ
 * đã nhớ, có ở trong Dự án không, đọc Dự án theo đúng luật xem và ghi) và cách đổi lỗi của cơ sở dữ liệu.
 */
export interface PhuThuocLenhTask {
  xacThuc(phien: Phien | null): Promise<KetQua<NguoiGoi>>
  /**
   * Như `suaDuAn`: kiểm quyền trước, rồi mới tới Dự án có tồn tại. Kèm id mọi Người trong dự án, đọc cùng lượt
   * (ticket toi-uu-hieu-nang 06: tạo Task kiểm người được chọn mà không đọc thêm).
   */
  quanLyDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<NguCanhDuAn & { idNguoiTrong: readonly string[] }>>
  /** Như `layDuAn`: không tồn tại và không thấy được cùng trả `KHONG_TIM_THAY`. */
  xemDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<NguCanhDuAn>>
  /**
   * Như `xemDuAn`, kèm mọi Người trong dự án (đọc cùng lượt kiểm); các lệnh gọi cùng lúc trên cùng Dự án dùng
   * chung lượt kiểm đang bay (khoSupabaseNguoiGoi.ts).
   */
  xemDuAnKemNguoiTrong(
    phien: Phien | null,
    duAnId: string,
  ): Promise<KetQua<NguCanhDuAn & { nguoiTrong: readonly { nguoi_dung_id: string }[] }>>
  /**
   * Một Task người gọi xem được kèm Dự án, Người trong dự án và link của nó, trong một lượt đọc; các lệnh gọi cùng lúc
   * trên cùng Task (và `xemDuAnKemNguoiTrong` trên Dự án của nó) dùng chung lượt này khi đang bay
   * (khoSupabaseNguoiGoi.ts). Task không tồn tại, không thấy được hay id không phải uuid: `KHONG_TIM_THAY`.
   */
  xemTaskKemDuAn(
    phien: Phien | null,
    taskId: string,
  ): Promise<KetQua<NguCanhDuAn & { nguoiTrong: readonly { nguoi_dung_id: string }[]; task: DongTaskKemLienKet }>>
  /**
   * Ghi lên một Task (sửa, đổi người): Task kèm Dự án và Người trong dự án trong MỘT lượt đọc, không dùng chung khi
   * đang bay (khoSupabaseNguoiGoi.ts). Task không thấy được: PM nhận `KHONG_TIM_THAY`, người khác `KHONG_CO_QUYEN`;
   * thấy mà không quản lý được Dự án: `KHONG_CO_QUYEN`.
   */
  quanLyTask(
    phien: Phien | null,
    taskId: string,
  ): Promise<KetQua<NguCanhDuAn & { nguoiTrong: readonly { nguoi_dung_id: string }[]; task: DongTaskKemLienKet }>>
  /**
   * Như `xemTaskKemDuAn` (cùng một lượt đọc, cùng luật xem và mã lỗi) nhưng không dùng chung khi đang bay: lượt đọc
   * trước khi ghi của lệnh link và lệnh đổi trạng thái (khoSupabaseNguoiGoi.ts).
   */
  xemTaskDeGhi(
    phien: Phien | null,
    taskId: string,
  ): Promise<KetQua<NguCanhDuAn & { nguoiTrong: readonly { nguoi_dung_id: string }[]; task: DongTaskKemLienKet }>>
  /** Mọi Task của Dự án (`docDongTaskCuaDuAn`), dùng chung khi đang bay giữa các lệnh gọi cùng lúc của phiên. */
  docTaskCuaDuAn(phien: Phien, db: SupabaseClient, duAnId: string): Promise<KetQua<DongTask[]>>
  laUuid(id: string): boolean
  loiTuCsdl<T = never>(loi: LoiCsdl): KetQua<T>
}

export type LenhTaskSupabase = Pick<
  KhoDuLieu,
  | 'taoTask'
  | 'danhSachTask'
  | 'layTask'
  | 'viecCuaToi'
  | 'choToiDuyet'
  | 'suaTask'
  | 'doiNguoiTask'
  | 'danhSachTaskNguoiDangGiu'
>

/** Trạng thái Dự án đọc từ cơ sở dữ liệu; giá trị lạ coi như Lưu trữ, trạng thái chặn mọi lệnh ghi. */
function trangThaiDuAnTuDong(giaTri: string): TrangThaiDuAn {
  return giaTri === 'HOAT_DONG' ? 'HOAT_DONG' : 'LUU_TRU'
}

/** Trạng thái Task đọc từ cơ sở dữ liệu; giá trị lạ (không thể có nhờ ràng buộc) coi như Huỷ, trạng thái chặn mọi lệnh ghi. */
export function trangThaiTaskTuDong(giaTri: string): TrangThaiTask {
  return (CAC_TRANG_THAI_TASK as readonly string[]).includes(giaTri) ? (giaTri as TrangThaiTask) : 'HUY'
}

/** Id người so khớp không phân biệt hoa thường (uuid trong cơ sở dữ liệu luôn là chữ thường). */
function chuanHoaId(id: string | null | undefined): string | null | undefined {
  return typeof id === 'string' ? id.toLowerCase() : id
}

type TrangDong = PromiseLike<{ data: unknown; error: LoiCsdl | null }>

/**
 * Đọc hết mọi trang của một truy vấn (đã xếp thứ tự ổn định), từng trang `CO_TRANG` dòng; lỗi đổi bằng `loi`.
 * Dùng chung cho lệnh Task và phần đọc theo lô (khoSupabaseDocLo.ts).
 */
export async function docTatCaTrang<T>(
  lamTrang: (tu: number, den: number) => TrangDong,
  loi: (loi: LoiCsdl) => KetQua<never>,
): Promise<KetQua<T[]>> {
  const ketQua: T[] = []
  for (let tu = 0; ; tu += CO_TRANG) {
    const { data, error } = await lamTrang(tu, tu + CO_TRANG - 1)
    if (error) return loi(error)
    const dong = (data ?? []) as T[]
    ketQua.push(...dong)
    if (dong.length < CO_TRANG) return thanhCong(ketQua)
  }
}

/**
 * Mọi Task của một Dự án (người gọi đã được kiểm là thấy Dự án), từng trang theo thứ tự ổn định. khoSupabase.ts
 * dùng chung lượt đọc này giữa `danhSachTask` và bộ đếm Task đang giữ của `danhSachNguoiTrongDuAn` khi hai lệnh
 * gọi cùng lúc (ticket toi-uu-hieu-nang 03).
 */
export function docDongTaskCuaDuAn(
  db: SupabaseClient,
  duAnId: string,
  loi: (loi: LoiCsdl) => KetQua<never>,
): Promise<KetQua<DongTask[]>> {
  return docTatCaTrang<DongTask>(
    (tu, den) =>
      db.from('task').select(COT_TASK).eq('du_an_id', duAnId).order('tao_luc', { ascending: false }).order('id').range(tu, den),
    loi,
  )
}

/** Id mọi người ghi trên một Task (hai người, người tạo, người sửa) để đọc tên hiển thị. */
export function idNguoiCuaTask(d: DongTask): string[] {
  return [d.nguoi_thuc_hien_id, d.nguoi_kiem_tra_id, d.tao_boi, ...(d.sua_boi ? [d.sua_boi] : [])]
}

/**
 * Task như giao diện Kho trả ra từ một dòng: `ten` cho tên hiển thị hiện tại theo id (chuỗi rỗng nếu không có),
 * `laTrongDuAn` cho biết người đó còn ở trong Dự án của Task không (không thì đánh dấu "đã rời dự án").
 */
export function taskTuDong(
  d: DongTask,
  ten: (id: string) => string,
  laTrongDuAn: (duAnId: string, nguoiDungId: string) => boolean,
): Task {
  const nguoi = (id: string): NguoiDauVet => ({ id, tenHienThi: ten(id) })
  const nguoiCuaTask = (id: string): NguoiCuaTask =>
    laTrongDuAn(d.du_an_id, id) ? nguoi(id) : { ...nguoi(id), daRoiDuAn: true }
  return {
    id: d.id,
    duAnId: d.du_an_id,
    tieuDe: d.tieu_de,
    moTa: d.mo_ta,
    han: d.han,
    // Giá trị lạ hay thiếu (trước migration) coi như mức mặc định.
    mucUuTien: laMucUuTien(d.muc_uu_tien) ? d.muc_uu_tien : MUC_UU_TIEN_MAC_DINH,
    nguoiThucHien: nguoiCuaTask(d.nguoi_thuc_hien_id),
    nguoiKiemTra: nguoiCuaTask(d.nguoi_kiem_tra_id),
    trangThai: trangThaiTaskTuDong(d.trang_thai),
    soLanTraLai: d.so_lan_tra_lai,
    dauVet: {
      taoBoi: nguoi(d.tao_boi),
      taoLuc: new Date(d.tao_luc),
      suaBoi: d.sua_boi ? nguoi(d.sua_boi) : null,
      suaLuc: d.sua_luc ? new Date(d.sua_luc) : null,
    },
  }
}

export function taoLenhTaskSupabase(phuThuoc: PhuThuocLenhTask): LenhTaskSupabase {
  const { xacThuc, xemDuAnKemNguoiTrong, xemTaskKemDuAn, docTaskCuaDuAn, quanLyDuAn, quanLyTask, laUuid } = phuThuoc

  /**
   * `TASK_DA_CHOT` do trigger ném; ràng buộc `task_muc_uu_tien_hop_le` (23514) thành `KHONG_HOP_LE` ở ô Mức ưu
   * tiên như luật thuần; các mã còn lại do `loiTuCsdl` của khoSupabase.ts đọc.
   */
  function loiTask<T = never>(loi: LoiCsdl): KetQua<T> {
    const thongDiep = (loi.message ?? '').trim()
    if (thongDiep === 'TASK_DA_CHOT' || thongDiep.startsWith('TASK_DA_CHOT:')) return thatBai('TASK_DA_CHOT')
    if (loi.code === '23514' && /constraint "task_muc_uu_tien_hop_le"/.test(loi.message ?? '')) {
      return thatBai('KHONG_HOP_LE', undefined, { mucUuTien: THONG_BAO_MUC_UU_TIEN.sai })
    }
    return phuThuoc.loiTuCsdl<T>(loi)
  }

  /** Đọc hết mọi trang của một truy vấn (đã xếp thứ tự ổn định). */
  function docTatCa<T>(lamTrang: (tu: number, den: number) => TrangDong): Promise<KetQua<T[]>> {
    return docTatCaTrang<T>(lamTrang, loiTask)
  }

  async function docNguoiTrongDuAn(db: SupabaseClient, duAnId: string): Promise<KetQua<Set<string>>> {
    const dong = await docTatCa<{ nguoi_dung_id: string }>((tu, den) =>
      db
        .from('nguoi_trong_du_an')
        .select('nguoi_dung_id')
        .eq('du_an_id', duAnId)
        .order('nguoi_dung_id')
        .range(tu, den),
    )
    if (!dong.ok) return dong
    return thanhCong(new Set(dong.giaTri.map((d) => d.nguoi_dung_id.toLowerCase())))
  }

  /**
   * Task như giao diện Kho trả ra: tên hiển thị hiện tại của người ghi trên Task (hàm của cơ sở dữ
   * liệu, vì người đã rời Dự án hay PM ngoài Dự án có thể không đọc thẳng được hồ sơ), và dấu hiệu
   * "đã rời dự án" cho Người thực hiện hay Người kiểm tra không còn ở trong Dự án. `laTrongDuAn` cho sẵn thì
   * dùng nó (danh sách Người trong dự án đã đọc lúc kiểm xem Dự án), không thì đọc Người trong các Dự án đó.
   */
  async function docCacTask(
    db: SupabaseClient,
    dong: readonly DongTask[],
    laTrongDuAn?: (duAnId: string, nguoiDungId: string) => boolean,
  ): Promise<KetQua<Task[]>> {
    if (dong.length === 0) return thanhCong([])
    const ids = new Set(dong.flatMap(idNguoiCuaTask))
    const ten = await db.rpc('ten_nguoi_cua_task', { p_ids: [...ids] })
    if (ten.error) return loiTask(ten.error)
    const tenTheoId = new Map<string, string>()
    for (const nguoi of (ten.data ?? []) as unknown as { id: string; ten_hien_thi: string }[]) {
      tenTheoId.set(nguoi.id, nguoi.ten_hien_thi)
    }
    const tenCua = (id: string) => tenTheoId.get(id) ?? ''
    if (laTrongDuAn) return thanhCong(dong.map((d) => taskTuDong(d, tenCua, laTrongDuAn)))

    const duAnIds = [...new Set(dong.map((d) => d.du_an_id))]
    const thanhVien = await docTatCa<{ du_an_id: string; nguoi_dung_id: string }>((tu, den) =>
      db
        .from('nguoi_trong_du_an')
        .select('du_an_id, nguoi_dung_id')
        .in('du_an_id', duAnIds)
        .order('du_an_id')
        .order('nguoi_dung_id')
        .range(tu, den),
    )
    if (!thanhVien.ok) return thanhVien
    const cap = new Set(thanhVien.giaTri.map((t) => `${t.du_an_id}|${t.nguoi_dung_id}`))

    return thanhCong(
      dong.map((d) =>
        taskTuDong(d, tenCua, (duAnId, id) => cap.has(`${duAnId}|${id}`)),
      ),
    )
  }

  /**
   * Một Task vừa ghi như giao diện Kho trả ra, với tập id Người trong dự án đã đọc trước khi ghi (lệnh ghi không đổi
   * Người trong dự án): chỉ còn MỘT lượt gọi, lượt tên người (ticket toi-uu-hieu-nang 06).
   */
  async function docMotTask(db: SupabaseClient, dong: DongTask, thanhVien: ReadonlySet<string>): Promise<KetQua<Task>> {
    const kq = await docCacTask(db, [dong], (_duAnId, id) => thanhVien.has(id.toLowerCase()))
    if (!kq.ok) return kq
    return thanhCong(kq.giaTri[0])
  }

  /** Tập id (chữ thường) của Người trong dự án. */
  function tapId(ids: readonly string[]): Set<string> {
    return new Set(ids.map((id) => id.toLowerCase()))
  }

  /** Task cá nhân qua mọi Dự án người gọi đang ở trong, kèm tên Dự án. */
  async function taskCaNhan(
    phien: Phien | null,
    truyVan: (db: SupabaseClient, nguoiDungId: string) => (tu: number, den: number) => TrangDong,
    thoa: (task: Task, nguoiDungId: string) => boolean,
  ): Promise<KetQua<TaskKemDuAn[]>> {
    const xt = await xacThuc(phien)
    if (!xt.ok) return xt
    const { db, hoSo } = xt.giaTri
    // Phân quyền từng dòng cho PM thấy Task của mọi Dự án; danh sách cá nhân chỉ gồm Dự án mình ở trong.
    const trong = await docTatCa<{ du_an_id: string }>((tu, den) =>
      db
        .from('nguoi_trong_du_an')
        .select('du_an_id')
        .eq('nguoi_dung_id', hoSo.id)
        .order('du_an_id')
        .range(tu, den),
    )
    if (!trong.ok) return trong
    const duAnCuaToi = new Set(trong.giaTri.map((t) => t.du_an_id))
    const dong = await docTatCa<DongTaskKemDuAn>(truyVan(db, hoSo.id))
    if (!dong.ok) return dong
    const cuaDuAnToi = dong.giaTri.filter((d) => duAnCuaToi.has(d.du_an_id))
    const task = await docCacTask(db, cuaDuAnToi)
    if (!task.ok) return task
    const ketQua: TaskKemDuAn[] = []
    task.giaTri.forEach((t, i) => {
      const duAn = cuaDuAnToi[i]?.du_an
      const motDuAn = Array.isArray(duAn) ? duAn[0] : duAn
      const ten = motDuAn?.ten ?? ''
      const ma = motDuAn?.ma ?? ''
      if (thoa(t, hoSo.id)) ketQua.push({ ...t, tenDuAn: ten, maDuAn: ma })
    })
    return thanhCong(ketQua)
  }

  return {
    async taoTask(phien: Phien | null, duAnId: string, dauVao) {
      // `bayGio` bị bỏ qua: người tạo và ngày tạo do cơ sở dữ liệu đặt (trigger task_truoc_khi_tao).
      const xt = await quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { nguoiGoi, duAn, nhin } = xt.giaTri
      const lyDo = kiemTaoTask({ ...nhin, trangThai: trangThaiDuAnTuDong(duAn.trang_thai) })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraTask.tao(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      // Người trong dự án đã đọc cùng lượt kiểm quản lý Dự án (ticket toi-uu-hieu-nang 06): không đọc lại.
      const thanhVien = tapId(xt.giaTri.idNguoiTrong)
      const nguoiThucHienId = chuanHoaId(kt.giaTri.nguoiThucHienId) ?? null
      const nguoiKiemTraId = chuanHoaId(kt.giaTri.nguoiKiemTraId) ?? null
      const loiNguoi = kiemNguoiTask({
        nguoiThucHienId,
        nguoiKiemTraId,
        laNguoiTrongDuAn: (id) => thanhVien.has(id),
      })
      if (loiNguoi) return thatBai(loiNguoi.ma, undefined, loiNguoi.loiTheoO)
      // kiemNguoiTask đã bảo đảm cả hai id có mặt; kiểm lại để kiểu được thu hẹp.
      if (nguoiThucHienId === null || nguoiKiemTraId === null) return thatBai('THIEU_NGUOI')
      // Chỉ các cột client được ghi; trạng thái ban đầu và dấu vết do cơ sở dữ liệu đặt.
      const { data, error } = await nguoiGoi.db
        .from('task')
        .insert({
          du_an_id: duAnId,
          tieu_de: kt.giaTri.tieuDe,
          mo_ta: kt.giaTri.moTa,
          han: kt.giaTri.han,
          muc_uu_tien: kt.giaTri.mucUuTien,
          nguoi_thuc_hien_id: nguoiThucHienId,
          nguoi_kiem_tra_id: nguoiKiemTraId,
        })
        .select(COT_TASK)
        .single()
      if (error) return loiTask(error)
      return docMotTask(nguoiGoi.db, data as unknown as DongTask, thanhVien)
    },

    async danhSachTask(phien: Phien | null, duAnId: string) {
      // Gọi cùng lúc với `layDuAn`, `danhSachNguoiTrongDuAn` (màn Chi tiết Dự án): dùng chung lượt kiểm xem Dự án
      // (kèm Người trong dự án, dùng luôn cho dấu "đã rời dự án") và lượt đọc Task (ticket toi-uu-hieu-nang 03).
      const xt = await xemDuAnKemNguoiTrong(phien, duAnId)
      if (!xt.ok) return xt
      if (!phien) return thatBai('CHUA_DANG_NHAP')
      const { nguoiGoi, nguoiTrong } = xt.giaTri
      const dong = await docTaskCuaDuAn(phien, nguoiGoi.db, duAnId)
      if (!dong.ok) return dong
      const thanhVien = new Set(nguoiTrong.map((n) => n.nguoi_dung_id))
      return docCacTask(nguoiGoi.db, dong.giaTri, (_duAnId, id) => thanhVien.has(id))
    },

    async layTask(phien: Phien | null, taskId: string) {
      // Một lượt đọc Task kèm Dự án và Người trong dự án (dùng luôn cho dấu "đã rời dự án"), dùng chung với
      // `danhSachLienKetCuaTask`, `layDuAn`, `danhSachNguoiTrongDuAn` gọi cùng lúc (Ngăn trượt Task, ticket
      // toi-uu-hieu-nang 04). Gọi ngay, trước mọi `await`, để các lệnh gọi cùng lúc tìm thấy lượt đang bay.
      const xt = await xemTaskKemDuAn(phien, taskId)
      // Không tồn tại và không thấy được trả cùng một lỗi: không lộ rằng Task có tồn tại.
      if (!xt.ok) return xt
      const { nguoiGoi, nhin, nguoiTrong, task } = xt.giaTri
      if (!duocXemTask(nhin)) return thatBai('KHONG_TIM_THAY')
      const thanhVien = new Set(nguoiTrong.map((n) => n.nguoi_dung_id))
      const kq = await docCacTask(nguoiGoi.db, [task], (_duAnId, id) => thanhVien.has(id))
      if (!kq.ok) return kq
      return thanhCong(kq.giaTri[0])
    },

    async viecCuaToi(phien: Phien | null) {
      return taskCaNhan(
        phien,
        (db, nguoiDungId) => (tu, den) =>
          db
            .from('task')
            .select(`${COT_TASK}, du_an(ten, ma)`)
            .eq('nguoi_thuc_hien_id', nguoiDungId)
            .in('trang_thai', TRANG_THAI_CHUA_CHOT)
            .order('tao_luc', { ascending: false })
            .order('id')
            .range(tu, den),
        laViecCuaToi,
      )
    },

    async choToiDuyet(phien: Phien | null) {
      return taskCaNhan(
        phien,
        (db, nguoiDungId) => (tu, den) =>
          db
            .from('task')
            .select(`${COT_TASK}, du_an(ten, ma)`)
            .eq('nguoi_kiem_tra_id', nguoiDungId)
            .eq('trang_thai', 'CHO_DUYET')
            .order('tao_luc', { ascending: false })
            .order('id')
            .range(tu, den),
        laChoToiDuyet,
      )
    },

    async suaTask(phien: Phien | null, taskId: string, dauVao) {
      // `bayGio` bị bỏ qua: người và ngày chỉnh sửa do cơ sở dữ liệu đặt (trigger task_truoc_khi_sua).
      // Một lượt đọc Task kèm Dự án và Người trong dự án (ticket toi-uu-hieu-nang 06), rồi ghi, rồi tên người.
      const xt = await quanLyTask(phien, taskId)
      if (!xt.ok) return xt
      const { nguoiGoi, duAn, nhin, nguoiTrong, task } = xt.giaTri
      const lyDo = kiemSuaTask({
        ...nhin,
        trangThai: trangThaiDuAnTuDong(duAn.trang_thai),
        trangThaiTask: trangThaiTaskTuDong(task.trang_thai),
      })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraSuaTask.sua(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      // Không gửi ô nào thì vẫn ghi lại tiêu đề cũ, để dấu vết chỉnh sửa được cập nhật như bản bộ nhớ.
      const thayDoi: { tieu_de: string; mo_ta?: string; han?: string | null; muc_uu_tien?: MucUuTien } = {
        tieu_de: kt.giaTri.tieuDe ?? task.tieu_de,
      }
      if (kt.giaTri.moTa !== undefined) thayDoi.mo_ta = kt.giaTri.moTa
      if (kt.giaTri.han !== undefined) thayDoi.han = kt.giaTri.han
      // Dòng lịch sử đổi Mức ưu tiên do cơ sở dữ liệu ghi (trigger task_sau_khi_doi_muc_uu_tien, chỉ khi mức đổi
      // sang mức khác), không phải client. Quyền như mọi lần sửa Task (trigger task_truoc_khi_sua).
      if (kt.giaTri.mucUuTien !== undefined) thayDoi.muc_uu_tien = kt.giaTri.mucUuTien
      const { data, error } = await nguoiGoi.db
        .from('task')
        .update(thayDoi)
        .eq('id', taskId)
        .select(COT_TASK)
        .maybeSingle()
      if (error) return loiTask(error)
      const dong = data as unknown as DongTask | null
      if (!dong) return thatBai('KHONG_TIM_THAY')
      return docMotTask(nguoiGoi.db, dong, tapId(nguoiTrong.map((n) => n.nguoi_dung_id)))
    },

    async doiNguoiTask(phien: Phien | null, taskId: string, dauVao) {
      // Một lượt đọc Task kèm Dự án và Người trong dự án (ticket toi-uu-hieu-nang 06), rồi ghi, rồi tên người.
      const xt = await quanLyTask(phien, taskId)
      if (!xt.ok) return xt
      const { nguoiGoi, duAn, nhin, nguoiTrong, task } = xt.giaTri
      const lyDo = kiemSuaTask({
        ...nhin,
        trangThai: trangThaiDuAnTuDong(duAn.trang_thai),
        trangThaiTask: trangThaiTaskTuDong(task.trang_thai),
      })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraSuaTask.doiNguoi(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const thanhVien = tapId(nguoiTrong.map((n) => n.nguoi_dung_id))
      const moi = kiemDoiNguoiTask({
        hienTai: {
          nguoiThucHienId: task.nguoi_thuc_hien_id.toLowerCase(),
          nguoiKiemTraId: task.nguoi_kiem_tra_id.toLowerCase(),
        },
        moi: {
          ...(kt.giaTri.nguoiThucHienId !== undefined && {
            nguoiThucHienId: chuanHoaId(kt.giaTri.nguoiThucHienId) ?? null,
          }),
          ...(kt.giaTri.nguoiKiemTraId !== undefined && {
            nguoiKiemTraId: chuanHoaId(kt.giaTri.nguoiKiemTraId) ?? null,
          }),
        },
        laNguoiTrongDuAn: (id) => thanhVien.has(id),
      })
      if (!moi.ok) return thatBai(moi.loi.ma, undefined, moi.loi.loiTheoO)
      // Luôn ghi cả hai ô (giữ nguyên giá trị cũ ở ô không đổi) để dấu vết chỉnh sửa được cập nhật;
      // trigger chỉ đòi "ở trong Dự án" với người MỚI được chọn.
      const { data, error } = await nguoiGoi.db
        .from('task')
        .update({ nguoi_thuc_hien_id: moi.nguoiThucHienId, nguoi_kiem_tra_id: moi.nguoiKiemTraId })
        .eq('id', taskId)
        .select(COT_TASK)
        .maybeSingle()
      if (error) return loiTask(error)
      const dong = data as unknown as DongTask | null
      if (!dong) return thatBai('KHONG_TIM_THAY')
      return docMotTask(nguoiGoi.db, dong, thanhVien)
    },

    async danhSachTaskNguoiDangGiu(phien: Phien | null, duAnId: string, nguoiDungId: string) {
      const xt = await quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { db } = xt.giaTri.nguoiGoi
      if (!laUuid(nguoiDungId)) return thatBai('KHONG_TIM_THAY')
      const tap = await docNguoiTrongDuAn(db, duAnId)
      if (!tap.ok) return tap
      if (!tap.giaTri.has(nguoiDungId.toLowerCase())) return thatBai('KHONG_TIM_THAY')
      const id = nguoiDungId.toLowerCase()
      // `id` đã qua kiểm uuid nên đưa thẳng vào bộ lọc `or` là an toàn.
      const dong = await docTatCa<DongTask>((tu, den) =>
        db
          .from('task')
          .select(COT_TASK)
          .eq('du_an_id', duAnId)
          .in('trang_thai', TRANG_THAI_CHUA_CHOT)
          .or(`nguoi_thuc_hien_id.eq.${id},nguoi_kiem_tra_id.eq.${id}`)
          .order('tao_luc', { ascending: false })
          .order('id')
          .range(tu, den),
      )
      if (!dong.ok) return dong
      const task = await docCacTask(db, dong.giaTri)
      if (!task.ok) return task
      return thanhCong(taskChuaChotNguoiDangGiu(task.giaTri, id))
    },
  }
}
