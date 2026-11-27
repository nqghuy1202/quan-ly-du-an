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
  DongLichSuTask,
  DuAnTomTat,
  HoSo,
  KhoDuLieu,
  NguoiCuaTask,
  LienKetTask,
  NguoiDauVet,
  NguoiDungTomTat,
  NguoiTrongDuAn,
  PhamViDanhSachDuAn,
  Phien,
  RepoDuAn,
  Task,
  TaskKemDuAn,
  ThongBaoChung,
} from './khoDuLieu'
import {
  THONG_BAO_LIEN_KET,
  duongDanLienKet,
  khoaLienKet,
  khoaRepo,
  kiemGhiLienKet,
  kiemTraLienKet,
  kiemTraRepo,
  thuocRepoDaGan,
  type GanRepoDauVao,
  type LienKetGitHub,
  type ThemLienKetDauVao,
} from '../luat/github'
import {
  dongDoiMucUuTienMoi,
  dongLichSuMoi,
  kiemChuyenTrangThai,
  soLanTraLaiSau,
  xepLichSuTask,
  type DoiTrangThaiTaskDauVao,
  type DongLichSuBatKy,
} from '../luat/chuyenTrangThai'
import { laChoToiDuyet, laViecCuaToi } from '../luat/kanban'
import {
  TRANG_THAI_TASK_BAN_DAU,
  duocXemTask,
  kiemDoiNguoiTask,
  kiemNguoiTask,
  kiemSuaTask,
  kiemTaoTask,
  kiemTraSuaTask,
  kiemTraTask,
  soTaskDangGiu,
  taskChuaChotNguoiDangGiu,
  type DoiNguoiTaskDauVao,
  type SuaTaskDauVao,
  type TaoTaskDauVao,
  type TrangThaiTask,
} from '../luat/task'
import type { MucUuTien } from '../luat/mucUuTien'
import {
  dauVetMoi,
  dauVetSauSua,
  duocQuanLyDuAn,
  duocTaoDuAn,
  duocXemDuAn,
  kiemGhiDuAn,
  kiemMoLaiDuAn,
  kiemNguoiPhuTrach,
  kiemSuaVaiTroTrongDuAn,
  kiemTraDuAn,
  laPhamViDanhSachDuAn,
  maDuAnBiTrung,
  ngayDuAnSauSua,
  THONG_BAO_DU_AN,
  type DauVet,
  type LocDuAnDauVao,
  type NguoiGoiDuAn,
  type SuaDuAnDauVao,
  type SuaVaiTroTrongDuAnDauVao,
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
import { tinhSoLieuDuAn } from '../luat/tienDo'
import { THONG_TIN_NHAN_SU_TRONG, apQuyenXemNhanSu, duocXemThongTinNhanSu } from '../luat/thongTinNhanSu'

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
   * Đặt thẳng trạng thái của Task, không qua luật chuyển trạng thái, không ghi dấu vết hay bộ đếm
   * Trả lại (thay cho việc dựng sẵn Task ở trạng thái bất kỳ khi test và chạy thử; luồng đổi
   * trạng thái thật làm ở ticket 10). Lỗi: `KHONG_TIM_THAY`.
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
  /** Lưu dạng in hoa. */
  ma: string
  ten: string
  moTa: string
  khachHang: string
  ngayBatDau: string | null
  ngayKetThucDuKien: string | null
  mucUuTien: MucUuTien
  /** Id tài khoản của Người phụ trách (luôn là Người trong dự án); null khi chưa có. */
  nguoiPhuTrachId: string | null
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
  mucUuTien: MucUuTien
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
  /** Vai trò trong Dự án: duAnId -> (id tài khoản -> vai trò); không có mục là chưa có vai trò. */
  const vaiTroTheoDuAn = new Map<string, Map<string, string>>()
  const taskTheoId = new Map<string, BanGhiTask>()
  /** Lịch sử Task (đổi trạng thái, đổi Mức ưu tiên): taskId -> các dòng theo thứ tự ghi; người ghi bằng id. */
  const lichSuTheoTask = new Map<string, DongLichSuBatKy<string>[]>()
  /** Repo GitHub của Dự án: duAnId -> tên repo, theo thứ tự gắn. */
  const repoTheoDuAn = new Map<string, string[]>()
  let demNguoiDung = 0
  let demPhien = 0
  /** Link GitHub của Task: taskId -> liên kết, theo thứ tự thêm. */
  const lienKetTheoTask = new Map<string, LienKetGitHub[]>()
  let demMa = 0
  let demDuAn = 0
  let demTask = 0

  const banSao = (hoSo: HoSo): HoSo => ({ ...hoSo })

  /** Id các Dự án tài khoản `id` đang ở trong, mọi trạng thái (kể cả đã Lưu trữ). */
  function duAnCua(id: string): string[] {
    const ketQua: string[] = []
    for (const [duAnId, tap] of nguoiTheoDuAn) if (tap.has(id)) ketQua.push(duAnId)
    return ketQua
  }

  /** Tóm tắt tài khoản `hoSo` như người gọi `nguoiGoi` thấy: Thông tin nhân sự đã áp quyền xem. */
  function tomTat(nguoiGoi: HoSo, hoSo: HoSo): NguoiDungTomTat {
    const { id, email, tenHienThi, vai, soDienThoai, chucDanh, phongBan } = hoSo
    const duocXem = duocXemThongTinNhanSu({
      nguoiGoiId: nguoiGoi.id,
      vaiNguoiGoi: nguoiGoi.vai,
      chuHoSoId: id,
      duAnCuaNguoiGoi: duAnCua(nguoiGoi.id),
      duAnCuaChuHoSo: duAnCua(id),
    })
    return apQuyenXemNhanSu({ id, email, tenHienThi, vai, soDienThoai, chucDanh, phongBan }, duocXem)
  }

  /** Một Người trong dự án như người gọi `nguoiGoi` thấy: tóm tắt tài khoản, Vai trò trong Dự án, số Task đang giữ. */
  function nguoiTrongDuAn(nguoiGoi: HoSo, hoSo: HoSo, duAnId: string): NguoiTrongDuAn {
    const cuaDuAn: { trangThai: TrangThaiTask; nguoiThucHienId: string }[] = []
    for (const task of taskTheoId.values()) if (task.duAnId === duAnId) cuaDuAn.push(task)
    return {
      ...tomTat(nguoiGoi, hoSo),
      vaiTroTrongDuAn: vaiTroTheoDuAn.get(duAnId)?.get(hoSo.id) ?? null,
      soTaskDangGiu: soTaskDangGiu(cuaDuAn, hoSo.id),
    }
  }

  function nguoiDauVet(id: string): NguoiDauVet {
    return { id, tenHienThi: taiKhoanTheoId.get(id)?.hoSo.tenHienThi ?? '' }
  }

  /** Bản sao trả ra ngoài: ngày là đối tượng mới, người kèm tên hiển thị hiện tại. */
  function docDuAn(banGhi: BanGhiDuAn): DuAn {
    const { taoBoi, taoLuc, suaBoi, suaLuc } = banGhi.dauVet
    return {
      id: banGhi.id,
      ma: banGhi.ma,
      ten: banGhi.ten,
      moTa: banGhi.moTa,
      khachHang: banGhi.khachHang,
      ngayBatDau: banGhi.ngayBatDau,
      ngayKetThucDuKien: banGhi.ngayKetThucDuKien,
      mucUuTien: banGhi.mucUuTien,
      nguoiPhuTrach: banGhi.nguoiPhuTrachId === null ? null : nguoiDauVet(banGhi.nguoiPhuTrachId),
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
      mucUuTien: banGhi.mucUuTien,
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

  /** Ghi Vai trò trong Dự án của `nguoiDungId`; null là xoá. */
  function datVaiTro(duAnId: string, nguoiDungId: string, vaiTro: string | null) {
    let cuaDuAn = vaiTroTheoDuAn.get(duAnId)
    if (!cuaDuAn) {
      cuaDuAn = new Map()
      vaiTroTheoDuAn.set(duAnId, cuaDuAn)
    }
    if (vaiTro === null) cuaDuAn.delete(nguoiDungId)
    else cuaDuAn.set(nguoiDungId, vaiTro)
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
    const hoSo: HoSo = {
      id: `nguoi-dung-${demNguoiDung}`,
      email,
      tenHienThi,
      githubUsername: null,
      vai,
      ...THONG_TIN_NHAN_SU_TRONG,
    }
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

  /** Mã Dự án trùng: lỗi có mã riêng, kèm lỗi ở ô `ma` để biểu mẫu hiện cạnh ô. */
  function loiMaTrung<T>(): KetQua<T> {
    return thatBai('MA_DU_AN_DA_DUNG', undefined, { ma: THONG_BAO_DU_AN.maTrung })
  }

  /** Task của các Dự án người gọi đang ở trong, thoả `thoa`, kèm tên Dự án. */
  function taskCaNhan(taiKhoan: TaiKhoan, thoa: (task: Task) => boolean): TaskKemDuAn[] {
    const ketQua: TaskKemDuAn[] = []
    for (const banGhi of taskTheoId.values()) {
      if (!nhinTuDuAn(taiKhoan, banGhi.duAnId).laNguoiTrongDuAn) continue
      const duAn = duAnTheoId.get(banGhi.duAnId)
      const task = docTask(banGhi)
      if (duAn && thoa(task)) ketQua.push({ ...task, tenDuAn: duAn.ten, maDuAn: duAn.ma })
    }
    return ketQua
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
      if (kt.giaTri.soDienThoai !== undefined) hoSo.soDienThoai = kt.giaTri.soDienThoai
      if (kt.giaTri.chucDanh !== undefined) hoSo.chucDanh = kt.giaTri.chucDanh
      if (kt.giaTri.phongBan !== undefined) hoSo.phongBan = kt.giaTri.phongBan
      return thanhCong(banSao(hoSo))
    },

    async danhSachDuAnCuaToi(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const id = xt.giaTri.hoSo.id
      const duAn: DuAnTomTat[] = [...duAnTheoId.values()]
        .filter((banGhi) => nguoiTheoDuAn.get(banGhi.id)?.has(id) ?? false)
        .map(({ id: duAnId, ma, ten, trangThai }) => ({ id: duAnId, ma, ten, trangThai }))
      return thanhCong(duAn)
    },

    async danhSachNguoiDung(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      if (!duocQuanLyNguoiDung(xt.giaTri.hoSo.vai)) return thatBai('KHONG_CO_QUYEN')
      return thanhCong([...taiKhoanTheoId.values()].map((taiKhoan) => tomTat(xt.giaTri.hoSo, taiKhoan.hoSo)))
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
      return thanhCong(tomTat(xt.giaTri.hoSo, dich.hoSo))
    },

    async taoDuAn(phien: Phien | null, dauVao: TaoDuAnDauVao, bayGio: Date) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      if (!duocTaoDuAn(xt.giaTri.hoSo.vai)) return thatBai('KHONG_CO_QUYEN')
      const kt = kiemTraDuAn.tao(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      if (maDuAnBiTrung(kt.giaTri.ma, duAnTheoId.values())) return loiMaTrung()
      demDuAn += 1
      const banGhi: BanGhiDuAn = {
        id: `du-an-${demDuAn}`,
        ma: kt.giaTri.ma,
        ten: kt.giaTri.ten,
        moTa: kt.giaTri.moTa,
        khachHang: kt.giaTri.khachHang,
        ngayBatDau: kt.giaTri.ngayBatDau,
        ngayKetThucDuKien: kt.giaTri.ngayKetThucDuKien,
        mucUuTien: kt.giaTri.mucUuTien,
        nguoiPhuTrachId: null,
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

    async danhSachDuAnKemSoLieu(phien: Phien | null, phamVi: PhamViDanhSachDuAn, bayGio: Date) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      if (!laPhamViDanhSachDuAn(phamVi)) return thatBai('KHONG_HOP_LE')
      const taiKhoan = xt.giaTri
      const thuocPhamVi = (duAnId: string) =>
        phamVi === 'CUA_TOI'
          ? (nguoiTheoDuAn.get(duAnId)?.has(taiKhoan.hoSo.id) ?? false)
          : duocXemDuAn(nhinTuDuAn(taiKhoan, duAnId))
      const taskTheoDuAn = new Map<string, BanGhiTask[]>()
      for (const task of taskTheoId.values()) {
        const cuaDuAn = taskTheoDuAn.get(task.duAnId) ?? []
        cuaDuAn.push(task)
        taskTheoDuAn.set(task.duAnId, cuaDuAn)
      }
      return thanhCong(
        [...duAnTheoId.values()]
          .filter((duAn) => thuocPhamVi(duAn.id))
          .map((duAn) => ({ ...docDuAn(duAn), ...tinhSoLieuDuAn(duAn, taskTheoDuAn.get(duAn.id) ?? [], bayGio) })),
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
      const ngay = ngayDuAnSauSua(duAn, kt.giaTri)
      if (!ngay.ok) return thatBai('KHONG_HOP_LE', undefined, ngay.loiTheoO)
      if (kt.giaTri.nguoiPhuTrachId !== undefined) {
        const tap = nguoiTrong(duAn.id)
        const loiNguoi = kiemNguoiPhuTrach(kt.giaTri.nguoiPhuTrachId, (id) => tap.has(id))
        if (loiNguoi) return thatBai('NGUOI_NGOAI_DU_AN', THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn, loiNguoi)
      }
      if (kt.giaTri.ma !== undefined && maDuAnBiTrung(kt.giaTri.ma, duAnTheoId.values(), duAn.id)) return loiMaTrung()
      if (kt.giaTri.ma !== undefined) duAn.ma = kt.giaTri.ma
      if (kt.giaTri.ten !== undefined) duAn.ten = kt.giaTri.ten
      if (kt.giaTri.moTa !== undefined) duAn.moTa = kt.giaTri.moTa
      if (kt.giaTri.khachHang !== undefined) duAn.khachHang = kt.giaTri.khachHang
      if (kt.giaTri.mucUuTien !== undefined) duAn.mucUuTien = kt.giaTri.mucUuTien
      if (kt.giaTri.nguoiPhuTrachId !== undefined) duAn.nguoiPhuTrachId = kt.giaTri.nguoiPhuTrachId
      duAn.ngayBatDau = ngay.ngay.ngayBatDau
      duAn.ngayKetThucDuKien = ngay.ngay.ngayKetThucDuKien
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
      const danhSach: NguoiTrongDuAn[] = []
      for (const id of nguoiTrong(duAnId)) {
        const taiKhoan = taiKhoanTheoId.get(id)
        if (taiKhoan) danhSach.push(nguoiTrongDuAn(xt.giaTri.taiKhoan.hoSo, taiKhoan.hoSo, duAnId))
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
      if (kt.giaTri.vaiTroTrongDuAn !== null) datVaiTro(duAnId, dich.hoSo.id, kt.giaTri.vaiTroTrongDuAn)
      return thanhCong(nguoiTrongDuAn(xt.giaTri.taiKhoan.hoSo, dich.hoSo, duAnId))
    },

    async suaVaiTroTrongDuAn(
      phien: Phien | null,
      duAnId: string,
      nguoiDungId: string,
      dauVao: SuaVaiTroTrongDuAnDauVao,
    ) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { taiKhoan, duAn, nguoiGoi } = xt.giaTri
      const lyDo = kiemSuaVaiTroTrongDuAn({ ...nguoiGoi, trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraDuAn.suaVaiTro(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const dich = taiKhoanTheoId.get(nguoiDungId)
      if (!dich || !nguoiTrong(duAnId).has(nguoiDungId)) {
        return thatBai('KHONG_TIM_THAY', THONG_BAO_DU_AN.khongTrongDuAn)
      }
      datVaiTro(duAnId, nguoiDungId, kt.giaTri.vaiTroTrongDuAn)
      return thanhCong(nguoiTrongDuAn(taiKhoan.hoSo, dich.hoSo, duAnId))
    },

    async goNguoiKhoiDuAn(phien: Phien | null, duAnId: string, nguoiDungId: string) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { duAn, nguoiGoi } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nguoiGoi, trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      const tap = nguoiTrong(duAnId)
      if (!tap.has(nguoiDungId)) return thatBai('KHONG_TIM_THAY')
      // Chỉ bỏ cặp (Dự án, tài khoản); tài khoản và hồ sơ giữ nguyên. Người phụ trách phải là Người trong
      // dự án nên về trống ngay trong lệnh này.
      tap.delete(nguoiDungId)
      // Vai trò trong Dự án gắn với cặp (Dự án, tài khoản): mất theo; thêm lại là bắt đầu từ trống.
      datVaiTro(duAnId, nguoiDungId, null)
      if (duAn.nguoiPhuTrachId === nguoiDungId) duAn.nguoiPhuTrachId = null
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
        mucUuTien: kt.giaTri.mucUuTien,
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
      if (kt.giaTri.mucUuTien !== undefined) {
        // Đổi sang mức khác thì ghi một dòng lịch sử; đúng mức đang có thì không ghi.
        const dong = dongDoiMucUuTienMoi(taiKhoan.hoSo.id, bayGio, task.mucUuTien, kt.giaTri.mucUuTien)
        if (dong) lichSuTheoTask.set(taskId, [...(lichSuTheoTask.get(taskId) ?? []), dong])
        task.mucUuTien = kt.giaTri.mucUuTien
      }
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

    async doiTrangThaiTask(phien: Phien | null, taskId: string, dauVao: DoiTrangThaiTaskDauVao, bayGio: Date) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const taiKhoan = xt.giaTri
      const task = taskTheoId.get(taskId)
      // Task không tồn tại: người không phải PM nhận KHONG_CO_QUYEN (không lộ gì), PM nhận KHONG_TIM_THAY.
      if (!task) return taiKhoan.hoSo.vai === 'PM' ? thatBai('KHONG_TIM_THAY') : thatBai('KHONG_CO_QUYEN')
      const duAn = duAnTheoId.get(task.duAnId)
      if (!duAn) return thatBai('KHONG_TIM_THAY')
      const nguoiGoi = nhinTuDuAn(taiKhoan, task.duAnId)
      const kq = kiemChuyenTrangThai(
        {
          ...nguoiGoi,
          nguoiGoiId: taiKhoan.hoSo.id,
          nguoiThucHienId: task.nguoiThucHienId,
          nguoiKiemTraId: task.nguoiKiemTraId,
          trangThaiDuAn: duAn.trangThai,
          trangThaiTask: task.trangThai,
        },
        dauVao,
      )
      if (!kq.ok) return thatBai(kq.ma, kq.thongBao, kq.loiTheoO)
      const dong = dongLichSuMoi(taiKhoan.hoSo.id, bayGio, kq.buoc, kq.lyDo)
      task.trangThai = kq.buoc.sang
      task.soLanTraLai = soLanTraLaiSau(task.soLanTraLai, kq.buoc)
      task.dauVet = dauVetSauSua(task.dauVet, taiKhoan.hoSo.id, bayGio)
      lichSuTheoTask.set(taskId, [...(lichSuTheoTask.get(taskId) ?? []), dong])
      return thanhCong(docTask(task))
    },

    async lichSuTask(phien: Phien | null, taskId: string) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const task = taskTheoId.get(taskId)
      if (!task || !duocXemTask(nhinTuDuAn(xt.giaTri, task.duAnId))) return thatBai('KHONG_TIM_THAY')
      const dong = xepLichSuTask(lichSuTheoTask.get(taskId) ?? []).map(
        (d): DongLichSuTask => ({ ...d, nguoiDoi: nguoiDauVet(d.nguoiDoi), luc: new Date(d.luc.getTime()) }),
      )
      return thanhCong(dong)
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

    async ganRepoVaoDuAn(phien: Phien | null, duAnId: string, dauVao: GanRepoDauVao) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { duAn, nguoiGoi } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nguoiGoi, trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraRepo.gan(dauVao)
      if (!kt.ok) return thatBai('REPO_KHONG_HOP_LE', undefined, kt.loiTheoO)
      const { repo } = kt.giaTri
      const danhSach = repoTheoDuAn.get(duAnId) ?? []
      if (danhSach.some((da) => khoaRepo(da) === khoaRepo(repo))) {
        return thatBai('REPO_DA_GAN', undefined, { repo: THONG_BAO_MAC_DINH.REPO_DA_GAN })
      }
      repoTheoDuAn.set(duAnId, [...danhSach, repo])
      const ketQua: RepoDuAn = { tenRepo: repo }
      return thanhCong(ketQua)
    },

    async goRepoKhoiDuAn(phien: Phien | null, duAnId: string, tenRepo: string) {
      const xt = quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { duAn, nguoiGoi } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nguoiGoi, trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      const danhSach = repoTheoDuAn.get(duAnId) ?? []
      const khoa = typeof tenRepo === 'string' ? khoaRepo(tenRepo) : null
      if (khoa === null || !danhSach.some((da) => khoaRepo(da) === khoa)) return thatBai('KHONG_TIM_THAY')
      repoTheoDuAn.set(
        duAnId,
        danhSach.filter((da) => khoaRepo(da) !== khoa),
      )
      return thanhCong(null)
    },

    async danhSachRepoCuaDuAn(phien: Phien | null, duAnId: string) {
      const xt = xemDuAn(phien, duAnId)
      if (!xt.ok) return xt
      return thanhCong((repoTheoDuAn.get(duAnId) ?? []).map((tenRepo): RepoDuAn => ({ tenRepo })))
    },

    async viecCuaToi(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const id = xt.giaTri.hoSo.id
      return thanhCong(taskCaNhan(xt.giaTri, (task) => laViecCuaToi(task, id)))
    },

    async choToiDuyet(phien: Phien | null) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const id = xt.giaTri.hoSo.id
      return thanhCong(taskCaNhan(xt.giaTri, (task) => laChoToiDuyet(task, id)))
    },

    async themLienKetVaoTask(phien: Phien | null, taskId: string, dauVao: ThemLienKetDauVao, bayGio: Date) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const task = taskTheoId.get(taskId)
      if (!task) return thatBai('KHONG_TIM_THAY')
      const duAn = duAnTheoId.get(task.duAnId)
      if (!duAn) return thatBai('KHONG_TIM_THAY')
      const lyDo = kiemGhiLienKet({ ...nhinTuDuAn(xt.giaTri, duAn.id), trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraLienKet.them(dauVao)
      if (!kt.ok) return thatBai('LINK_KHONG_HOP_LE', undefined, kt.loiTheoO)
      const lienKet = kt.giaTri
      if (!thuocRepoDaGan(lienKet, repoTheoDuAn.get(duAn.id) ?? [])) {
        return thatBai('LINK_REPO_CHUA_GAN', undefined, { duongDan: THONG_BAO_LIEN_KET.chuaGan })
      }
      const danhSach = lienKetTheoTask.get(taskId) ?? []
      if (danhSach.some((da) => khoaLienKet(da) === khoaLienKet(lienKet))) {
        return thatBai('LINK_TRUNG', undefined, { duongDan: THONG_BAO_LIEN_KET.trung })
      }
      lienKetTheoTask.set(taskId, [...danhSach, lienKet])
      task.dauVet = dauVetSauSua(task.dauVet, xt.giaTri.hoSo.id, bayGio)
      const ketQua: LienKetTask = { ...lienKet, duongDan: duongDanLienKet(lienKet) }
      return thanhCong(ketQua)
    },

    async goLienKetKhoiTask(phien: Phien | null, taskId: string, lienKet: LienKetGitHub, bayGio: Date) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const task = taskTheoId.get(taskId)
      if (!task) return thatBai('KHONG_TIM_THAY')
      const duAn = duAnTheoId.get(task.duAnId)
      if (!duAn) return thatBai('KHONG_TIM_THAY')
      const lyDo = kiemGhiLienKet({ ...nhinTuDuAn(xt.giaTri, duAn.id), trangThai: duAn.trangThai })
      if (lyDo) return thatBai(lyDo)
      const danhSach = lienKetTheoTask.get(taskId) ?? []
      const coLienKet =
        typeof lienKet === 'object' &&
        lienKet !== null &&
        typeof lienKet.repo === 'string' &&
        danhSach.some((da) => khoaLienKet(da) === khoaLienKet(lienKet))
      if (!coLienKet) return thatBai('KHONG_TIM_THAY')
      lienKetTheoTask.set(
        taskId,
        danhSach.filter((da) => khoaLienKet(da) !== khoaLienKet(lienKet)),
      )
      task.dauVet = dauVetSauSua(task.dauVet, xt.giaTri.hoSo.id, bayGio)
      return thanhCong(null)
    },

    async danhSachLienKetCuaTask(phien: Phien | null, taskId: string) {
      const xt = xacThuc(phien)
      if (!xt.ok) return xt
      const task = taskTheoId.get(taskId)
      if (!task || !duocXemTask(nhinTuDuAn(xt.giaTri, task.duAnId))) return thatBai('KHONG_TIM_THAY')
      return thanhCong(
        (lienKetTheoTask.get(taskId) ?? []).map((lienKet): LienKetTask => ({ ...lienKet, duongDan: duongDanLienKet(lienKet) })),
      )
    },
  }
}
