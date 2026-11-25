// Kho dữ liệu: giao diện lưu trữ duy nhất mà phần còn lại của ứng dụng dùng.
// Mọi lệnh cần danh tính nhận `phien` của người gọi (null = chưa đăng nhập) và trả
// `KetQua`: giá trị đã áp luật và quyền, hoặc một lỗi có mã. Bản cài: bộ nhớ (test, dev),
// sau này thêm bản Supabase; mọi bản cài phải qua `chayBoTestHopDong`.
import type { KetQua } from './ketQua'
import type {
  DangKyDauVao,
  DangNhapDauVao,
  DatLaiMatKhauDauVao,
  EmailDauVao,
  SuaHoSoDauVao,
  VaiHeThong,
} from '../luat/taiKhoan'

export interface HoSo {
  id: string
  email: string
  tenHienThi: string
  githubUsername: string | null
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
}
