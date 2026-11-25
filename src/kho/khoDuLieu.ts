// Kho dữ liệu: giao diện lưu trữ duy nhất mà phần còn lại của ứng dụng dùng.
// Mọi lệnh cần danh tính nhận `phien` của người gọi (null = chưa đăng nhập) và trả
// `KetQua`: giá trị đã áp luật và quyền, hoặc một lỗi có mã. Bản cài: bộ nhớ (test, dev),
// sau này thêm bản Supabase; mọi bản cài phải qua `chayBoTestHopDong`.
import type { KetQua } from './ketQua'
import type {
  DangKyDauVao,
  DangNhapDauVao,
  DatLaiMatKhauDauVao,
  DoiVaiDauVao,
  EmailDauVao,
  SuaHoSoDauVao,
  VaiHeThong,
} from '../luat/taiKhoan'
import type { DauVet, LocDuAnDauVao, SuaDuAnDauVao, TaoDuAnDauVao, TrangThaiDuAn } from '../luat/duAn'

export interface HoSo {
  id: string
  email: string
  tenHienThi: string
  githubUsername: string | null
  vai: VaiHeThong
}

/** Một tài khoản trên màn Người dùng của PM. */
export interface NguoiDungTomTat {
  id: string
  email: string
  tenHienThi: string
  vai: VaiHeThong
}

/** Danh tính người gọi sau khi đăng nhập. */
export interface Phien {
  maPhien: string
  nguoiDungId: string
}

export interface DuAnTomTat {
  id: string
  ten: string
}

/** Người ghi trong dấu vết: tên hiển thị là tên hiện tại của tài khoản lúc đọc. */
export interface NguoiDauVet {
  id: string
  tenHienThi: string
}

/** Một Dự án đầy đủ: tên, mô tả, trạng thái và dấu vết. */
export interface DuAn {
  id: string
  ten: string
  /** Chuỗi rỗng khi không có mô tả. */
  moTa: string
  trangThai: TrangThaiDuAn
  dauVet: DauVet<NguoiDauVet>
}

/** Kết quả của các lệnh không được lộ email có tài khoản hay không: luôn cùng một thông báo. */
export interface ThongBaoChung {
  thongBao: string
}

export interface KhoDuLieu {
  /**
   * Đăng ký tài khoản mới; hồ sơ có vai Thành viên, email ở trạng thái chưa xác nhận và một thư
   * xác nhận được gửi đi. Lỗi: `KHONG_HOP_LE`, `EMAIL_DA_DUNG`.
   */
  dangKy(dauVao: DangKyDauVao): Promise<KetQua<HoSo>>
  /**
   * Đăng nhập; sai email hay sai mật khẩu đều trả `SAI_THONG_TIN_DANG_NHAP`. Đúng mật khẩu nhưng
   * email chưa xác nhận thì trả `EMAIL_CHUA_XAC_NHAN`.
   */
  dangNhap(dauVao: DangNhapDauVao): Promise<KetQua<Phien>>
  /**
   * Gửi lại thư xác nhận. Email đúng định dạng thì luôn trả cùng một thông báo, dù email có tài
   * khoản, đã xác nhận hay chưa. Lỗi: `KHONG_HOP_LE` (email sai định dạng).
   */
  guiLaiThuXacNhan(dauVao: EmailDauVao): Promise<KetQua<ThongBaoChung>>
  /**
   * Yêu cầu đặt lại mật khẩu: gửi mã dùng một lần, hết hạn sau thời hạn cấu hình tính từ `bayGio`.
   * Mã mới thay mọi mã cũ của cùng email. Email đúng định dạng thì luôn trả cùng một thông báo,
   * dù email có tài khoản hay không. Lỗi: `KHONG_HOP_LE` (email sai định dạng).
   */
  yeuCauDatLaiMatKhau(dauVao: EmailDauVao, bayGio: Date): Promise<KetQua<ThongBaoChung>>
  /**
   * Đặt mật khẩu mới bằng mã trong thư; xong thì mật khẩu cũ hết dùng được, mã hết dùng được và
   * email coi như đã xác nhận (người dùng đã mở được hộp thư). Lỗi: `KHONG_HOP_LE` (dữ liệu sai,
   * mã không bị tiêu), `MA_KHONG_HOP_LE` (sai mã hoặc email không có mã), `MA_DA_DUNG`, `MA_HET_HAN`.
   */
  datLaiMatKhau(dauVao: DatLaiMatKhauDauVao, bayGio: Date): Promise<KetQua<ThongBaoChung>>
  /** Kết thúc phiên; sau đó mọi lệnh với phiên này trả `CHUA_DANG_NHAP`. */
  dangXuat(phien: Phien | null): Promise<KetQua<null>>
  /** Hồ sơ của người gọi. */
  layHoSoCuaToi(phien: Phien | null): Promise<KetQua<HoSo>>
  /** Sửa tên hiển thị và GitHub username; chỉ hồ sơ của chính mình. */
  suaHoSo(phien: Phien | null, nguoiDungId: string, dauVao: SuaHoSoDauVao): Promise<KetQua<HoSo>>
  /** Các Dự án người gọi được thấy. */
  danhSachDuAnCuaToi(phien: Phien | null): Promise<KetQua<DuAnTomTat[]>>
  /**
   * Mọi tài khoản (tên, email, vai); thứ tự không bảo đảm, giao diện tự xếp. Chỉ PM.
   * Lỗi: `KHONG_CO_QUYEN`.
   */
  danhSachNguoiDung(phien: Phien | null): Promise<KetQua<NguoiDungTomTat[]>>
  /**
   * Đổi vai hệ thống của tài khoản `nguoiDungId`; có hiệu lực ngay ở lần đọc sau. Chỉ PM.
   * Lỗi (vai không đổi): `KHONG_CO_QUYEN` (người gọi không phải PM, kể cả tự nâng vai mình),
   * `KHONG_HOP_LE` (vai không phải PM, Support hay Thành viên), `KHONG_TIM_THAY`,
   * `PHAI_CON_PM` (hạ PM cuối cùng, kể cả PM tự hạ mình).
   */
  doiVai(phien: Phien | null, nguoiDungId: string, dauVao: DoiVaiDauVao): Promise<KetQua<NguoiDungTomTat>>
  /**
   * Tạo Dự án đang hoạt động; người tạo là người gọi, ngày tạo là `bayGio`, chưa có phần chỉnh
   * sửa. Chỉ PM. Lỗi: `KHONG_CO_QUYEN`, `KHONG_HOP_LE` (tên rỗng, chỉ khoảng trắng, quá 120 ký tự).
   */
  taoDuAn(phien: Phien | null, dauVao: TaoDuAnDauVao, bayGio: Date): Promise<KetQua<DuAn>>
  /**
   * Mọi Dự án, lọc theo trạng thái nếu có; thứ tự không bảo đảm, giao diện tự xếp. Chỉ PM (người
   * trong dự án ở ticket 05). Lỗi: `KHONG_CO_QUYEN`, `KHONG_HOP_LE` (trạng thái lọc sai).
   */
  danhSachDuAn(phien: Phien | null, loc?: LocDuAnDauVao): Promise<KetQua<DuAn[]>>
  /** Một Dự án, kể cả đã Lưu trữ. Chỉ PM. Lỗi: `KHONG_CO_QUYEN`, `KHONG_TIM_THAY`. */
  layDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<DuAn>>
  /**
   * Sửa tên và/hoặc mô tả; cập nhật người và ngày chỉnh sửa gần nhất (`bayGio`). Chỉ PM.
   * Lỗi (không đổi gì): `KHONG_CO_QUYEN`, `KHONG_TIM_THAY`, `DU_AN_DA_LUU_TRU`, `KHONG_HOP_LE`.
   */
  suaDuAn(phien: Phien | null, duAnId: string, dauVao: SuaDuAnDauVao, bayGio: Date): Promise<KetQua<DuAn>>
  /**
   * Lưu trữ Dự án: từ đó mọi lệnh ghi lên nó trả `DU_AN_DA_LUU_TRU`, nhưng vẫn đọc được. Cập nhật
   * dấu vết chỉnh sửa. Chỉ PM. Lỗi: `KHONG_CO_QUYEN`, `KHONG_TIM_THAY`, `DU_AN_DA_LUU_TRU`.
   */
  luuTruDuAn(phien: Phien | null, duAnId: string, bayGio: Date): Promise<KetQua<DuAn>>
  /**
   * Mở lại Dự án đã Lưu trữ: sửa được trở lại. Cập nhật dấu vết chỉnh sửa. Chỉ PM.
   * Lỗi: `KHONG_CO_QUYEN`, `KHONG_TIM_THAY`, `DU_AN_DANG_HOAT_DONG`.
   */
  moLaiDuAn(phien: Phien | null, duAnId: string, bayGio: Date): Promise<KetQua<DuAn>>
}
