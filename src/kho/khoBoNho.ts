// Bản cài bộ nhớ của Kho dữ liệu: dùng cho test và cho giao diện khi chạy thử.
// Không I/O, không đồng hồ, không số ngẫu nhiên: mã sinh theo bộ đếm, giờ do người gọi truyền vào.
// Không gửi thư thật: thư được ghi vào một hộp thư mô phỏng (`moPhong`), và việc bấm đường dẫn
// trong thư xác nhận được thay bằng `moPhong.xacNhanEmail`.
// PM đầu tiên: ngoài đời thật chủ dự án tự đặt vai trên Supabase. Bản bộ nhớ thay việc đó bằng
// tuỳ chọn `pmBanDau` (tạo sẵn một PM khi dựng Kho) hoặc `chuDuAn.datVaiPM` (đặt PM cho một tài
// khoản có sẵn). Cả hai chỉ dành cho dev và test, không phải đường dùng thật của ứng dụng.
import { THONG_BAO_MAC_DINH, thanhCong, thatBai, type KetQua } from './ketQua'
import type {
  DuAn,
  DuAnTomTat,
  HoSo,
  KhoDuLieu,
  NguoiCuaTask,
  NguoiDauVet,
  NguoiDungTomTat,
  Phien,
  Task,
  ThongBaoChung,
} from './khoDuLieu'
import {
  TRANG_THAI_TASK_BAN_DAU,
  duocXemTask,
  kiemDoiNguoiTask,
  kiemNguoiTask,
  kiemSuaTask,
  kiemTaoTask,
  kiemTraSuaTask,
  kiemTraTask,
  taskChuaChotNguoiDangGiu,
  type DoiNguoiTaskDauVao,
  type SuaTaskDauVao,
  type TaoTaskDauVao,
  type TrangThaiTask,
} from '../luat/task'
import {
  dauVetMoi,
  dauVetSauSua,
  duocQuanLyDuAn,
  duocTaoDuAn,
  duocXemDuAn,
  kiemGhiDuAn,
  kiemMoLaiDuAn,
  kiemTraDuAn,
  type DauVet,
  type LocDuAnDauVao,
  type NguoiGoiDuAn,
  type SuaDuAnDauVao,
  type TaoDuAnDauVao,
  type ThemNguoiDauVao,
  type TrangThaiDuAn,
} from '../luat/duAn'
import {
  THOI_HAN_MA_DAT_LAI_MAC_DINH_MS,
  THONG_BAO,
  VAI_MAC_DINH,
  chuanHoaEmail,
  dangKySchema,
  dangNhapSchema,
  datLaiMatKhauSchema,
  doiVaiSchema,
  duocQuanLyNguoiDung,
  duocSuaHoSo,
  emailSchema,
  hetHanLuc,
  kiemDoiVai,
  kiemTra,
  suaHoSoSchema,
  tinhTrangMaDatLai,
  type DangKyDauVao,
  type DangNhapDauVao,
  type DatLaiMatKhauDauVao,
  type DoiVaiDauVao,
  type EmailDauVao,
  type SuaHoSoDauVao,
  type VaiHeThong,
} from '../luat/taiKhoan'

/** Một thư bản bộ nhớ "đã gửi" (thay cho thư thật). */
export type ThuMoPhong =
  | { loai: 'XAC_NHAN_EMAIL'; email: string }
  | { loai: 'DAT_LAI_MAT_KHAU'; email: string; ma: string; hetHanLuc: Date }

/** Bước mô phỏng thay cho hộp thư thật của bản cài bộ nhớ. */
export interface MoPhongThu {
  /**
   * Thay cho việc bấm đường dẫn trong thư xác nhận gửi tới `email`. Luôn trả cùng một thông báo:
   * xác nhận lần hai hay email không tồn tại không lộ gì và không đổi gì.
   */
  xacNhanEmail(email: string): Promise<KetQua<ThongBaoChung>>
  /** Các thư đã gửi tới `email`, cũ trước mới sau. */
  thuGuiToi(email: string): ThuMoPhong[]
}

/**
 * Việc chủ dự án làm thẳng trên kho thật (ngoài ứng dụng), mô phỏng cho bản bộ nhớ.
 * Chỉ dành cho dev và test.
 */
export interface MoPhongChuDuAn {
  /**
   * Đặt vai PM cho tài khoản có email `email`, không qua kiểm quyền (thay cho việc chủ dự án
   * tự đặt PM đầu tiên trên Supabase). Lỗi: `KHONG_TIM_THAY`.
   */
  datVaiPM(email: string): Promise<KetQua<null>>
  /**
   * Đặt Task `taskId` sang trạng thái `trangThai` bất kỳ, không qua luật chuyển trạng thái (lát này
   * chưa có cách đi tới trạng thái cuối bằng giao diện): dựng sẵn Task đã Hoàn thành, Huỷ... để test.
   * Không đổi dấu vết. Lỗi: `KHONG_TIM_THAY`. Chỉ dành cho dev và test.
   */
  datTrangThaiTask(taskId: string, trangThai: TrangThaiTask): Promise<KetQua<null>>
}

export interface KhoBoNho extends KhoDuLieu {
  moPhong: MoPhongThu
  chuDuAn: MoPhongChuDuAn
}

/** Tài khoản PM tạo sẵn khi dựng Kho: đã xác nhận email, vào được ngay. */
export interface TaiKhoanPMBanDau {
  email: string
  matKhau: string
  tenHienThi: string
}

/**
 * PM tạo sẵn khi chạy thử (`npm run dev`), để có người mở được màn Người dùng. Chỉ dành cho
 * chạy thử: với bản Supabase, PM đầu tiên do chủ dự án tự đặt vai trên Supabase.
 */
export const PM_CHAY_THU: TaiKhoanPMBanDau = {
  email: 'pm@vi-du.vn',
  matKhau: 'matkhau-pm',
  tenHienThi: 'PM chạy thử',
}

export interface TuyChonKhoBoNho {
  /** Thời hạn của mã đặt lại mật khẩu, tính bằng mili giây. Mặc định 1 giờ. */
  thoiHanMaDatLaiMs?: number
  /** Tạo sẵn một PM ban đầu (dev và test). Dữ liệu sai thì ném lỗi khi dựng Kho. */
  pmBanDau?: TaiKhoanPMBanDau
}

interface MaDatLai {
  ma: string
  hetHanLuc: Date
  daDung: boolean
}

interface TaiKhoan {
  hoSo: HoSo
  matKhau: string
  daXacNhan: boolean
  /** Mã đặt lại mới nhất; yêu cầu mới thay mã cũ. */
  maDatLai: MaDatLai | null
}

/** Dự án như kho lưu: dấu vết ghi id người, tên hiển thị tra lúc đọc. */
interface BanGhiDuAn {
  id: string
  ten: string
  moTa: string
  trangThai: TrangThaiDuAn
  dauVet: DauVet<string>
}

/** Task như kho lưu: người ghi bằng id, tên hiển thị tra lúc đọc. */
interface BanGhiTask {
  id: string
  duAnId: string
  tieuDe: string
  moTa: string
  han: string | null
  nguoiThucHienId: string
  nguoiKiemTraId: string
  trangThai: TrangThaiTask
  soLanTraLai: number
  dauVet: DauVet<string>
}

export function taoKhoBoNho(tuyChon: TuyChonKhoBoNho = {}): KhoBoNho {
  const thoiHanMaDatLaiMs = tuyChon.thoiHanMaDatLaiMs ?? THOI_HAN_MA_DAT_LAI_MAC_DINH_MS
  const taiKhoanTheoId = new Map<string, TaiKhoan>()
  const idTheoEmail = new Map<string, string>()
  const phienDangMo = new Map<string, string>() // maPhien -> nguoiDungId
  const hopThu: ThuMoPhong[] = []
  const duAnTheoId = new Map<string, BanGhiDuAn>()
  /** Người trong dự án: duAnId -> tập id tài khoản. */
  const nguoiTheoDuAn = new Map<string, Set<string>>()
  const taskTheoId = new Map<string, BanGhiTask>()
  let demNguoiDung = 0
  let demPhien = 0
  let demMa = 0
  let demDuAn = 0
  let demTask = 0

  const banSao = (hoSo: HoSo): HoSo => ({ ...hoSo })
  const tomTat = ({ id, email, tenHienThi, vai }: HoSo): NguoiDungTomTat => ({ id, email, tenHienThi, vai })

  function nguoiDauVet(id: string): NguoiDauVet {
    return { id, tenHienThi: taiKhoanTheoId.get(id)?.hoSo.tenHienThi ?? '' }
  }

  /** Bản sao trả ra ngoài: ngày là đối tượng mới, người kèm tên hiển thị hiện tại. */
  function docDuAn(banGhi: BanGhiDuAn): DuAn {
    const { taoBoi, taoLuc, suaBoi, suaLuc } = banGhi.dauVet
    return {
      id: banGhi.id,
      ten: banGhi.ten,
      moTa: banGhi.moTa,
      trangThai: banGhi.trangThai,
      dauVet: {
        taoBoi: nguoiDauVet(taoBoi),
        taoLuc: new Date(taoLuc.getTime()),
        suaBoi: suaBoi === null ? null : nguoiDauVet(suaBoi),
        suaLuc: suaLuc === null ? null : new Date(suaLuc.getTime()),
      },
    }
  }

  /** Người của Task: người đã bị gỡ khỏi Dự án mà vẫn ghi trên Task thì kèm dấu hiệu "đã rời dự án". */
  function nguoiCuaTask(id: string, duAnId: string): NguoiCuaTask {
    const nguoi = nguoiDauVet(id)
    return nguoiTheoDuAn.get(duAnId)?.has(id) ? nguoi : { ...nguoi, daRoiDuAn: true }
  }

  /** Bản sao Task trả ra ngoài, như `docDuAn`. */
  function docTask(banGhi: BanGhiTask): Task {
    const { taoBoi, taoLuc, suaBoi, suaLuc } = banGhi.dauVet
    return {
      id: banGhi.id,
      duAnId: banGhi.duAnId,
      tieuDe: banGhi.tieuDe,
      moTa: banGhi.moTa,
      han: banGhi.han,
      nguoiThucHien: nguoiCuaTask(banGhi.nguoiThucHienId, banGhi.duAnId),
      nguoiKiemTra: nguoiCuaTask(banGhi.nguoiKiemTraId, banGhi.duAnId),
      trangThai: banGhi.trangThai,
      soLanTraLai: banGhi.soLanTraLai,
      dauVet: {
        taoBoi: nguoiDauVet(taoBoi),
        taoLuc: new Date(taoLuc.getTime()),
        suaBoi: suaBoi === null ? null : nguoiDauVet(suaBoi),
        suaLuc: suaLuc === null ? null : new Date(suaLuc.getTime()),
      },
    }
  }

  function nguoiTrong(duAnId: string): Set<string> {
    let tap = nguoiTheoDuAn.get(duAnId)
    if (!tap) {
      tap = new Set()
      nguoiTheoDuAn.set(duAnId, tap)
    }
    return tap
  }

  function nhinTuDuAn(taiKhoan: TaiKhoan, duAnId: string): NguoiGoiDuAn {
    return {
      vaiNguoiGoi: taiKhoan.hoSo.vai,
      laNguoiTrongDuAn: nguoiTheoDuAn.get(duAnId)?.has(taiKhoan.hoSo.id) ?? false,
    }
  }

  interface NguCanh {
    taiKhoan: TaiKhoan
    duAn: BanGhiDuAn
    nguoiGoi: NguoiGoiDuAn
  }

  /**
   * Đọc một Dự án: người gọi đã đăng nhập và thấy được Dự án `duAnId`. Không tồn tại và không
   * thấy được trả cùng một lỗi `KHONG_TIM_THAY`, nên không lộ rằng Dự án có tồn tại.
   */
  function xemDuAn(phien: Phien | null, duAnId: string): KetQua<NguCanh> {
    const xt = xacThuc(phien)
    if (!xt.ok) return xt
    const duAn = duAnTheoId.get(duAnId)
    if (!duAn) return thatBai('KHONG_TIM_THAY')
    const nguoiGoi = nhinTuDuAn(xt.giaTri, duAnId)
    if (!duocXemDuAn(nguoiGoi)) return thatBai('KHONG_TIM_THAY')
    return thanhCong({ taiKhoan: xt.giaTri, duAn, nguoiGoi })
  }

  /**
   * Ghi lên một Dự án: người gọi đã đăng nhập và quản lý được Dự án `duAnId`. Kiểm quyền trước
   * khi xem Dự án có tồn tại: người không phải PM luôn nhận `KHONG_CO_QUYEN` với Dự án không phải
   * của mình, dù Dự án có tồn tại hay không.
   */
  function quanLyDuAn(phien: Phien | null, duAnId: string): KetQua<NguCanh> {
    const xt = xacThuc(phien)
    if (!xt.ok) return xt
    const nguoiGoi = nhinTuDuAn(xt.giaTri, duAnId)
    if (!duocQuanLyDuAn(nguoiGoi)) return thatBai('KHONG_CO_QUYEN')
    const duAn = duAnTheoId.get(duAnId)
    if (!duAn) return thatBai('KHONG_TIM_THAY')
    return thanhCong({ taiKhoan: xt.giaTri, duAn, nguoiGoi })
  }

  /**
   * Ghi lên một Task: như `quanLyDuAn` trên Dự án của Task. Task không tồn tại: người không phải PM
   * nhận `KHONG_CO_QUYEN` (không lộ gì), PM nhận `KHONG_TIM_THAY`.
   */
  function quanLyTask(phien: Phien | null, taskId: string): KetQua<NguCanh & { task: BanGhiTask }> {
    const xt = xacThuc(phien)
    if (!xt.ok) return xt
    const task = taskTheoId.get(taskId)
    if (!task) return xt.giaTri.hoSo.vai === 'PM' ? thatBai('KHONG_TIM_THAY') : thatBai('KHONG_CO_QUYEN')
    const ql = quanLyDuAn(phien, task.duAnId)
    if (!ql.ok) return ql
    return thanhCong({ ...ql.giaTri, task })
  }

  /** Tạo tài khoản mới với dữ liệu đã kiểm; trả hồ sơ gốc (không phải bản sao). */
  function taoTaiKhoan(email: string, matKhau: string, tenHienThi: string, vai: VaiHeThong, daXacNhan: boolean): HoSo {
    demNguoiDung += 1
    const hoSo: HoSo = { id: `nguoi-dung-${demNguoiDung}`, email, tenHienThi, githubUsername: null, vai }
    taiKhoanTheoId.set(hoSo.id, { hoSo, matKhau, daXacNhan, maDatLai: null })
    idTheoEmail.set(email, hoSo.id)
    return hoSo
  }

  function soPM(): number {
    let dem = 0
    for (const taiKhoan of taiKhoanTheoId.values()) if (taiKhoan.hoSo.vai === 'PM') dem += 1
    return dem
  }

  if (tuyChon.pmBanDau) {
    const kt = kiemTra(dangKySchema, tuyChon.pmBanDau)
    if (!kt.ok) throw new Error(`pmBanDau không hợp lệ: ${Object.values(kt.loiTheoO).join(' ')}`)
    taoTaiKhoan(kt.giaTri.email, kt.giaTri.matKhau, kt.giaTri.tenHienThi, 'PM', true)
  }

  function timTheoEmail(email: string): TaiKhoan | undefined {
    const id = idTheoEmail.get(chuanHoaEmail(email))
    return id ? taiKhoanTheoId.get(id) : undefined
  }

  function xacThuc(phien: Phien | null): KetQua<TaiKhoan> {
    if (!phien) return thatBai('CHUA_DANG_NHAP')
    const nguoiDungId = phienDangMo.get(phien.maPhien)
    if (!nguoiDungId || nguoiDungId !== phien.nguoiDungId) return thatBai('CHUA_DANG_NHAP')
    const taiKhoan = taiKhoanTheoId.get(nguoiDungId)
    if (!taiKhoan) return thatBai('CHUA_DANG_NHAP')
    return thanhCong(taiKhoan)
  }

  const moPhong: MoPhongThu = {
    async xacNhanEmail(email: string) {
      const taiKhoan = timTheoEmail(email)
      if (taiKhoan) taiKhoan.daXacNhan = true
      return thanhCong({ thongBao: THONG_BAO.daXacNhanEmail })
    },

    thuGuiToi(email: string) {
      const chuan = chuanHoaEmail(email)
      return hopThu.filter((thu) => thu.email === chuan).map((thu) => ({ ...thu }))
    },
  }

  const chuDuAn: MoPhongChuDuAn = {
    async datVaiPM(email: string) {
      const taiKhoan = timTheoEmail(email)
      if (!taiKhoan) return thatBai('KHONG_TIM_THAY')
      taiKhoan.hoSo.vai = 'PM'
      return thanhCong(null)
    },

    async datTrangThaiTask(taskId: string, trangThai: TrangThaiTask) {
      const task = taskTheoId.get(taskId)
      if (!task) return thatBai('KHONG_TIM_THAY')
      task.trangThai = trangThai
      return thanhCong(null)
    },
  }

  return {
    moPhong,
    chuDuAn,

    async dangKy(dauVao: DangKyDauVao) {
      const kt = kiemTra(dangKySchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const { email, matKhau, tenHienThi } = kt.giaTri
      if (idTheoEmail.has(email)) {
        return thatBai('EMAIL_DA_DUNG', undefined, { email: 'Email này đã được dùng để đăng ký.' })
      }
      const hoSo = taoTaiKhoan(email, matKhau, tenHienThi, VAI_MAC_DINH, false)
      hopThu.push({ loai: 'XAC_NHAN_EMAIL', email })
      return thanhCong(banSao(hoSo))
    },

    async dangNhap(dauVao: DangNhapDauVao) {
      const kt = kiemTra(dangNhapSchema, dauVao)
      if (!kt.ok) return thatBai('SAI_THONG_TIN_DANG_NHAP')
      const taiKhoan = timTheoEmail(kt.giaTri.email)
      if (!taiKhoan || taiKhoan.matKhau !== kt.giaTri.matKhau) return thatBai('SAI_THONG_TIN_DANG_NHAP')
      // Chỉ báo chưa xác nhận khi đã đúng mật khẩu, nên không lộ gì với người không biết mật khẩu.
      if (!taiKhoan.daXacNhan) return thatBai('EMAIL_CHUA_XAC_NHAN')
      demPhien += 1
      const phien: Phien = { maPhien: `phien-${demPhien}`, nguoiDungId: taiKhoan.hoSo.id }
      phienDangMo.set(phien.maPhien, phien.nguoiDungId)
      return thanhCong(phien)
    },

    async guiLaiThuXacNhan(dauVao: EmailDauVao) {
      const kt = kiemTra(emailSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const taiKhoan = timTheoEmail(kt.giaTri.email)
      if (taiKhoan && !taiKhoan.daXacNhan) hopThu.push({ loai: 'XAC_NHAN_EMAIL', email: taiKhoan.hoSo.email })
      return thanhCong({ thongBao: THONG_BAO.daGuiLaiThuXacNhan })
    },

    async yeuCauDatLaiMatKhau(dauVao: EmailDauVao, bayGio: Date) {
      const kt = kiemTra(emailSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const taiKhoan = timTheoEmail(kt.giaTri.email)
      if (taiKhoan) {
        demMa += 1
        const maDatLai: MaDatLai = {
          ma: String(demMa).padStart(6, '0'),
          hetHanLuc: hetHanLuc(bayGio, thoiHanMaDatLaiMs),
          daDung: false,
        }
        taiKhoan.maDatLai = maDatLai
        hopThu.push({
          loai: 'DAT_LAI_MAT_KHAU',
          email: taiKhoan.hoSo.email,
          ma: maDatLai.ma,
          hetHanLuc: new Date(maDatLai.hetHanLuc.getTime()),
        })
      }
      return thanhCong({ thongBao: THONG_BAO.daGuiMaDatLai })
    },

    async datLaiMatKhau(dauVao: DatLaiMatKhauDauVao, bayGio: Date) {
      const kt = kiemTra(datLaiMatKhauSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const taiKhoan = timTheoEmail(kt.giaTri.email)
      const maDatLai = taiKhoan?.maDatLai
      if (!taiKhoan || !maDatLai || maDatLai.ma !== kt.giaTri.ma) return thatBai('MA_KHONG_HOP_LE')
      const tinhTrang = tinhTrangMaDatLai(maDatLai, bayGio)
      if (tinhTrang === 'DA_DUNG') return thatBai('MA_DA_DUNG')
      if (tinhTrang === 'HET_HAN') return thatBai('MA_HET_HAN')
      maDatLai.daDung = true
      taiKhoan.matKhau = kt.giaTri.matKhauMoi
      taiKhoan.daXacNhan = true
      return thanhCong({ thongBao: THONG_BAO.daDatLaiMatKhau })
    },

    async dangXuat(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      phienDangMo.delete((phien as Phien).maPhien)
      return thanhCong(null)
    },

    async layHoSoCuaToi(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      return thanhCong(banSao(xt.giaTri.hoSo))
    },

    async suaHoSo(phien: Phien | null, nguoiDungId: string, dauVao: SuaHoSoDauVao) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      if (!duocSuaHoSo(xt.giaTri.hoSo.id, nguoiDungId)) return thatBai('KHONG_CO_QUYEN')
      const kt = kiemTra(suaHoSoSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const hoSo = xt.giaTri.hoSo
      if (kt.giaTri.tenHienThi !== undefined) hoSo.tenHienThi = kt.giaTri.tenHienThi
      if (kt.giaTri.githubUsername !== undefined) hoSo.githubUsername = kt.giaTri.githubUsername
      return thanhCong(banSao(hoSo))
    },

    async danhSachDuAnCuaToi(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const id = xt.giaTri.hoSo.id
      const duAn: DuAnTomTat[] = [...duAnTheoId.values()]
        .filter((banGhi) => nguoiTheoDuAn.get(banGhi.id)?.has(id) ?? false)
        .map(({ id: duAnId, ten, trangThai }) => ({ id: duAnId, ten, trangThai }))
      return thanhCong(duAn)
    },

    async danhSachNguoiDung(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      if (!duocQuanLyNguoiDung(xt.giaTri.hoSo.vai)) return thatBai('KHONG_CO_QUYEN')
      return thanhCong([...taiKhoanTheoId.values()].map((taiKhoan) => tomTat(taiKhoan.hoSo)))
    },

    async doiVai(phien: Phien | null, nguoiDungId: string, dauVao: DoiVaiDauVao) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      // Kiểm quyền trước mọi thứ khác: người không phải PM không biết được gì thêm.
      if (!duocQuanLyNguoiDung(xt.giaTri.hoSo.vai)) return thatBai('KHONG_CO_QUYEN')
      const kt = kiemTra(doiVaiSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', THONG_BAO.vaiSai, kt.loiTheoO)
      const dich = taiKhoanTheoId.get(nguoiDungId)
      if (!dich) return thatBai('KHONG_TIM_THAY')
      const lyDo = kiemDoiVai({
        vaiNguoiGoi: xt.giaTri.hoSo.vai,
        vaiHienTai: dich.hoSo.vai,
        vaiMoi: kt.giaTri.vai,
        soPM: soPM(),
      })
      if (lyDo) return thatBai(lyDo)
      dich.hoSo.vai = kt.giaTri.vai
      return thanhCong(tomTat(dich.hoSo))
    },

    async taoDuAn(phien: Phien | null, dauVao: TaoDuAnDauVao, bayGio: Date) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      if (!duocTaoDuAn(xt.giaTri.hoSo.vai)) return thatBai('KHONG_CO_QUYEN')
      const kt = kiemTraDuAn.tao(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      demDuAn += 1
      const banGhi: BanGhiDuAn = {
        id: `du-an-${demDuAn}`,
        ten: kt.giaTri.ten,
        moTa: kt.giaTri.moTa,
        trangThai: 'HOAT_DONG',
        dauVet: dauVetMoi(xt.giaTri.hoSo.id, bayGio),
      }
      duAnTheoId.set(banGhi.id, banGhi)
      return thanhCong(docDuAn(banGhi))
    },

    async danhSachDuAn(phien: Phien | null, loc: LocDuAnDauVao = {}) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const kt = kiemTraDuAn.loc(loc)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const trangThai = kt.giaTri.trangThai
      const taiKhoan = xt.giaTri
      return thanhCong(
        [...duAnTheoId.values()]
          .filter((duAn) => duocXemDuAn(nhinTuDuAn(taiKhoan, duAn.id)))
          .filter((duAn) => trangThai === undefined || duAn.trangThai === trangThai)
          .map(docDuAn),
      )
    },

    async layDuAn(phien: Phien | null, duAnId: string) {
      const xt = xemDuAn(phien, duAnId)
      if (!xt.ok) return xt
      return thanhCong(docDuAn(xt.giaTri.duAn))
    },

    async suaDuAn(phien: Phien | null, duAnId: string, dauVao: SuaDuAnDauVao, bayGio: Date) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { taiKhoan, duAn, nguoiGoi } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nguoiGoi, trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraDuAn.sua(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      if (kt.giaTri.ten !== undefined) duAn.ten = kt.giaTri.ten
      if (kt.giaTri.moTa !== undefined) duAn.moTa = kt.giaTri.moTa
      duAn.dauVet = dauVetSauSua(duAn.dauVet, taiKhoan.hoSo.id, bayGio)
      return thanhCong(docDuAn(duAn))
    },

    async luuTruDuAn(phien: Phien | null, duAnId: string, bayGio: Date) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { taiKhoan, duAn, nguoiGoi } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nguoiGoi, trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      duAn.trangThai = 'LUU_TRU'
      duAn.dauVet = dauVetSauSua(duAn.dauVet, taiKhoan.hoSo.id, bayGio)
      return thanhCong(docDuAn(duAn))
    },

    async moLaiDuAn(phien: Phien | null, duAnId: string, bayGio: Date) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { taiKhoan, duAn, nguoiGoi } = xt.giaTri
      const lyDo = kiemMoLaiDuAn({ ...nguoiGoi, trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      duAn.trangThai = 'HOAT_DONG'
      duAn.dauVet = dauVetSauSua(duAn.dauVet, taiKhoan.hoSo.id, bayGio)
      return thanhCong(docDuAn(duAn))
    },

    async danhSachNguoiTrongDuAn(phien: Phien | null, duAnId: string) {
      const xt = xemDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const danhSach: NguoiDungTomTat[] = []
      for (const id of nguoiTrong(duAnId)) {
        const taiKhoan = taiKhoanTheoId.get(id)
        if (taiKhoan) danhSach.push(tomTat(taiKhoan.hoSo))
      }
      return thanhCong(danhSach)
    },

    async themNguoiVaoDuAn(phien: Phien | null, duAnId: string, dauVao: ThemNguoiDauVao) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { duAn, nguoiGoi } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nguoiGoi, trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraDuAn.themNguoi(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      // Chỉ thêm tài khoản đã có; không tạo tài khoản, không gửi thư mời.
      const dich = timTheoEmail(kt.giaTri.email)
      if (!dich) return thatBai('CHUA_DANG_KY', undefined, { email: THONG_BAO_MAC_DINH.CHUA_DANG_KY })
      const tap = nguoiTrong(duAnId)
      if (tap.has(dich.hoSo.id)) {
        return thatBai('DA_TRONG_DU_AN', undefined, { email: THONG_BAO_MAC_DINH.DA_TRONG_DU_AN })
      }
      tap.add(dich.hoSo.id)
      return thanhCong(tomTat(dich.hoSo))
    },

    async goNguoiKhoiDuAn(phien: Phien | null, duAnId: string, nguoiDungId: string) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { duAn, nguoiGoi } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nguoiGoi, trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      const tap = nguoiTrong(duAnId)
      if (!tap.has(nguoiDungId)) return thatBai('KHONG_TIM_THAY')
      // Chỉ bỏ cặp (Dự án, tài khoản); tài khoản và hồ sơ giữ nguyên.
      tap.delete(nguoiDungId)
      return thanhCong(null)
    },

    async taoTask(phien: Phien | null, duAnId: string, dauVao: TaoTaskDauVao, bayGio: Date) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { taiKhoan, duAn, nguoiGoi } = xt.giaTri
      const lyDo = kiemTaoTask({ ...nguoiGoi, trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraTask.tao(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const tap = nguoiTrong(duAnId)
      const { nguoiThucHienId, nguoiKiemTraId } = kt.giaTri
      const loiNguoi = kiemNguoiTask({ nguoiThucHienId, nguoiKiemTraId, laNguoiTrongDuAn: (id) => tap.has(id) })
      if (loiNguoi) return thatBai(loiNguoi.ma, undefined, loiNguoi.loiTheoO)
      // kiemNguoiTask đã bảo đảm cả hai id có mặt; kiểm lại để kiểu được thu hẹp.
      if (nguoiThucHienId === null || nguoiKiemTraId === null) return thatBai('THIEU_NGUOI')
      demTask += 1
      const banGhi: BanGhiTask = {
        id: `task-${demTask}`,
        duAnId,
        tieuDe: kt.giaTri.tieuDe,
        moTa: kt.giaTri.moTa,
        han: kt.giaTri.han,
        nguoiThucHienId,
        nguoiKiemTraId,
        trangThai: TRANG_THAI_TASK_BAN_DAU,
        soLanTraLai: 0,
        dauVet: dauVetMoi(taiKhoan.hoSo.id, bayGio),
      }
      taskTheoId.set(banGhi.id, banGhi)
      return thanhCong(docTask(banGhi))
    },

    async suaTask(phien: Phien | null, taskId: string, dauVao: SuaTaskDauVao, bayGio: Date) {
      const xt = quanLyTask(phien, taskId)
      if (!xt.ok) return xt
      const { taiKhoan, duAn, nguoiGoi, task } = xt.giaTri
      const lyDo = kiemSuaTask({ ...nguoiGoi, trangThai: duAn.trangThai, trangThaiTask: task.trangThai })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraSuaTask.sua(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      if (kt.giaTri.tieuDe !== undefined) task.tieuDe = kt.giaTri.tieuDe
      if (kt.giaTri.moTa !== undefined) task.moTa = kt.giaTri.moTa
      if (kt.giaTri.han !== undefined) task.han = kt.giaTri.han
      task.dauVet = dauVetSauSua(task.dauVet, taiKhoan.hoSo.id, bayGio)
      return thanhCong(docTask(task))
    },

    async doiNguoiTask(phien: Phien | null, taskId: string, dauVao: DoiNguoiTaskDauVao, bayGio: Date) {
      const xt = quanLyTask(phien, taskId)
      if (!xt.ok) return xt
      const { taiKhoan, duAn, nguoiGoi, task } = xt.giaTri
      const lyDo = kiemSuaTask({ ...nguoiGoi, trangThai: duAn.trangThai, trangThaiTask: task.trangThai })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraSuaTask.doiNguoi(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const tap = nguoiTrong(task.duAnId)
      const moi = kiemDoiNguoiTask({
        hienTai: { nguoiThucHienId: task.nguoiThucHienId, nguoiKiemTraId: task.nguoiKiemTraId },
        moi: kt.giaTri,
        laNguoiTrongDuAn: (id) => tap.has(id),
      })
      if (!moi.ok) return thatBai(moi.loi.ma, undefined, moi.loi.loiTheoO)
      task.nguoiThucHienId = moi.nguoiThucHienId
      task.nguoiKiemTraId = moi.nguoiKiemTraId
      task.dauVet = dauVetSauSua(task.dauVet, taiKhoan.hoSo.id, bayGio)
      return thanhCong(docTask(task))
    },

    async danhSachTaskNguoiDangGiu(phien: Phien | null, duAnId: string, nguoiDungId: string) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      if (!nguoiTrong(duAnId).has(nguoiDungId)) return thatBai('KHONG_TIM_THAY')
      const cuaDuAn = [...taskTheoId.values()].filter((task) => task.duAnId === duAnId).map(docTask)
      return thanhCong(taskChuaChotNguoiDangGiu(cuaDuAn, nguoiDungId))
    },

    async danhSachTask(phien: Phien | null, duAnId: string) {
      const xt = xemDuAn(phien, duAnId)
      if (!xt.ok) return xt
      return thanhCong([...taskTheoId.values()].filter((task) => task.duAnId === duAnId).map(docTask))
    },

    async layTask(phien: Phien | null, taskId: string) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const task = taskTheoId.get(taskId)
      // Không tồn tại và không thấy được trả cùng một lỗi: không lộ rằng Task có tồn tại.
      if (!task || !duocXemTask(nhinTuDuAn(xt.giaTri, task.duAnId))) return thatBai('KHONG_TIM_THAY')
      return thanhCong(docTask(task))
    },
  }
}
