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
import type {
  DauVet,
  LocDuAnDauVao,
  SuaDuAnDauVao,
  TaoDuAnDauVao,
  ThemNguoiDauVao,
  TrangThaiDuAn,
} from '../luat/duAn'
import type { TaoTaskDauVao, TrangThaiTask } from '../luat/task'

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
  trangThai: TrangThaiDuAn
}

/**
 * Một người trong dự án: tên, email và vai hệ thống hiện tại của tài khoản. Gỡ người khỏi Dự án
 * không đụng tới tài khoản hay hồ sơ của họ.
 */
export type NguoiTrongDuAn = NguoiDungTomTat

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

/**
 * Một Task: thuộc một Dự án; hạn là một ngày `YYYY-MM-DD` không có giờ (null khi không có hạn).
 * Người thực hiện và Người kiểm tra kèm tên hiển thị hiện tại của tài khoản lúc đọc.
 */
export interface Task {
  id: string
  duAnId: string
  tieuDe: string
  /** Chuỗi rỗng khi không có mô tả. */
  moTa: string
  han: string | null
  nguoiThucHien: NguoiDauVet
  nguoiKiemTra: NguoiDauVet
  trangThai: TrangThaiTask
  soLanTraLai: number
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
  /**
   * Các Dự án người gọi đang ở trong (kể cả đã Lưu trữ), với mọi vai, kể cả PM; thứ tự không bảo
   * đảm. Người chưa ở Dự án nào nhận danh sách rỗng.
   */
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
   * Các Dự án người gọi được thấy, lọc theo trạng thái nếu có; thứ tự không bảo đảm, giao diện tự
   * xếp. PM thấy mọi Dự án; Support và Thành viên chỉ thấy Dự án mình ở trong (người chưa ở Dự án
   * nào nhận danh sách rỗng). Lỗi: `KHONG_HOP_LE` (trạng thái lọc sai).
   */
  danhSachDuAn(phien: Phien | null, loc?: LocDuAnDauVao): Promise<KetQua<DuAn[]>>
  /**
   * Một Dự án, kể cả đã Lưu trữ. PM mở được mọi Dự án; người khác chỉ Dự án mình ở trong.
   * Lỗi: `KHONG_TIM_THAY` (không tồn tại, hoặc không thuộc về người gọi: không lộ là có tồn tại).
   */
  layDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<DuAn>>
  /**
   * Sửa tên và/hoặc mô tả; cập nhật người và ngày chỉnh sửa gần nhất (`bayGio`). PM hoặc Support
   * của Dự án. Lỗi (không đổi gì): `KHONG_CO_QUYEN` (kể cả Dự án không tồn tại, với người không
   * phải PM), `KHONG_TIM_THAY` (PM, Dự án không tồn tại), `DU_AN_DA_LUU_TRU`, `KHONG_HOP_LE`.
   */
  suaDuAn(phien: Phien | null, duAnId: string, dauVao: SuaDuAnDauVao, bayGio: Date): Promise<KetQua<DuAn>>
  /**
   * Lưu trữ Dự án: từ đó mọi lệnh ghi lên nó trả `DU_AN_DA_LUU_TRU`, nhưng vẫn đọc được. Cập nhật
   * dấu vết chỉnh sửa. PM hoặc Support của Dự án.
   * Lỗi: `KHONG_CO_QUYEN`, `KHONG_TIM_THAY`, `DU_AN_DA_LUU_TRU` (như `suaDuAn`).
   */
  luuTruDuAn(phien: Phien | null, duAnId: string, bayGio: Date): Promise<KetQua<DuAn>>
  /**
   * Mở lại Dự án đã Lưu trữ: sửa được trở lại. Cập nhật dấu vết chỉnh sửa. PM hoặc Support của
   * Dự án. Lỗi: `KHONG_CO_QUYEN`, `KHONG_TIM_THAY` (như `suaDuAn`), `DU_AN_DANG_HOAT_DONG`.
   */
  moLaiDuAn(phien: Phien | null, duAnId: string, bayGio: Date): Promise<KetQua<DuAn>>
  /**
   * Người trong một Dự án (tên, email, vai hệ thống); thứ tự không bảo đảm. Ai thấy Dự án thì
   * thấy danh sách này. Lỗi: `KHONG_TIM_THAY` (như `layDuAn`).
   */
  danhSachNguoiTrongDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<NguoiTrongDuAn[]>>
  /**
   * Thêm tài khoản có email `dauVao.email` (không phân biệt hoa thường) vào Dự án. Người đó phải
   * đã đăng ký; không gửi thư mời. PM hoặc Support của Dự án. Lỗi (không đổi gì):
   * `KHONG_CO_QUYEN`, `KHONG_TIM_THAY` (như `suaDuAn`), `DU_AN_DA_LUU_TRU`, `KHONG_HOP_LE` (email
   * sai định dạng), `CHUA_DANG_KY`, `DA_TRONG_DU_AN`.
   */
  themNguoiVaoDuAn(phien: Phien | null, duAnId: string, dauVao: ThemNguoiDauVao): Promise<KetQua<NguoiTrongDuAn>>
  /**
   * Gỡ tài khoản `nguoiDungId` khỏi Dự án; tài khoản và hồ sơ của họ giữ nguyên. PM hoặc Support
   * của Dự án (Support gỡ được cả chính mình). Lỗi (không đổi gì): `KHONG_CO_QUYEN`,
   * `KHONG_TIM_THAY` (như `suaDuAn`, hoặc người đó không ở trong Dự án), `DU_AN_DA_LUU_TRU`.
   */
  goNguoiKhoiDuAn(phien: Phien | null, duAnId: string, nguoiDungId: string): Promise<KetQua<null>>
  /**
   * Tạo Task trong Dự án: trạng thái Mới, số lần bị Trả lại 0; người tạo là người gọi, ngày tạo là
   * `bayGio`, chưa có phần chỉnh sửa. PM hoặc Support của Dự án. Lỗi (không tạo gì), theo thứ tự:
   * `KHONG_CO_QUYEN` (như `suaDuAn`; Thành viên luôn nhận mã này, kể cả khi sẽ là Người thực hiện),
   * `KHONG_TIM_THAY` (PM, Dự án không tồn tại), `DU_AN_DA_LUU_TRU`, `KHONG_HOP_LE` (tiêu đề rỗng,
   * chỉ khoảng trắng, quá 200 ký tự; hạn không phải một ngày có thật), `THIEU_NGUOI`,
   * `NGUOI_NGOAI_DU_AN` (kể cả id không tồn tại), `TRUNG_NGUOI`.
   */
  taoTask(phien: Phien | null, duAnId: string, dauVao: TaoTaskDauVao, bayGio: Date): Promise<KetQua<Task>>
  /**
   * Mọi Task của một Dự án, kể cả Dự án đã Lưu trữ; thứ tự không bảo đảm. Ai thấy Dự án thì thấy
   * mọi Task của nó. Lỗi: `KHONG_TIM_THAY` (như `layDuAn`).
   */
  danhSachTask(phien: Phien | null, duAnId: string): Promise<KetQua<Task[]>>
  /**
   * Một Task. Ai thấy Dự án của Task thì mở được. Lỗi: `KHONG_TIM_THAY` (không tồn tại, hoặc người
   * gọi không thấy Dự án của nó: không lộ là có tồn tại).
   */
  layTask(phien: Phien | null, taskId: string): Promise<KetQua<Task>>
}
