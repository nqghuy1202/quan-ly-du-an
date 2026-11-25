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
import type {
  DoiNguoiTaskDauVao,
  SuaTaskDauVao,
  TaoTaskDauVao,
  TrangThaiTask,
} from '../luat/task'
import type { GanRepoDauVao, LienKetGitHub, ThemLienKetDauVao } from '../luat/github'

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

/**
 * Người được giao một Task. `daRoiDuAn` chỉ có mặt (và là `true`) khi người đó đã bị gỡ khỏi Dự án
 * mà vẫn được ghi trên Task, cho đến khi PM hoặc Support giao lại.
 */
export type NguoiCuaTask = NguoiDauVet & { daRoiDuAn?: true }

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
  nguoiThucHien: NguoiCuaTask
  nguoiKiemTra: NguoiCuaTask
  trangThai: TrangThaiTask
  soLanTraLai: number
  dauVet: DauVet<NguoiDauVet>
}

/** Một repo GitHub gắn vào Dự án: tên dạng `chu-so-huu/ten-repo`, giữ chữ hoa chữ thường như lúc gắn. */
export interface RepoDuAn {
  tenRepo: string
}

/** Một Task kèm tên Dự án chứa nó, cho các danh sách cá nhân qua mọi Dự án. */
export interface TaskKemDuAn extends Task {
  tenDuAn: string
}

/** Một link issue hoặc PR trên Task: repo giữ chữ hoa chữ thường như lúc dán; `duongDan` là đường dẫn chuẩn. */
export interface LienKetTask extends LienKetGitHub {
  duongDan: string
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
  /**
   * Gắn repo GitHub vào Dự án bằng tên `chu-so-huu/ten-repo` (không phân biệt hoa thường khi so
   * trùng). PM hoặc Support của Dự án. Chỉ ghi tên, không gọi GitHub. Lỗi (không đổi gì), theo thứ
   * tự: `KHONG_CO_QUYEN`, `KHONG_TIM_THAY` (như `suaDuAn`), `DU_AN_DA_LUU_TRU`,
   * `REPO_KHONG_HOP_LE` (kèm lỗi ở ô `repo`), `REPO_DA_GAN`.
   */
  ganRepoVaoDuAn(phien: Phien | null, duAnId: string, dauVao: GanRepoDauVao): Promise<KetQua<RepoDuAn>>
  /**
   * Gỡ repo khỏi Dự án (tên không phân biệt hoa thường). PM hoặc Support của Dự án. Lỗi (không đổi
   * gì): `KHONG_CO_QUYEN`, `KHONG_TIM_THAY` (như `suaDuAn`, hoặc repo chưa gắn), `DU_AN_DA_LUU_TRU`.
   */
  goRepoKhoiDuAn(phien: Phien | null, duAnId: string, tenRepo: string): Promise<KetQua<null>>
  /**
   * Repo gắn vào Dự án; thứ tự không bảo đảm, giao diện tự xếp. Ai thấy Dự án thì thấy danh sách
   * này, kể cả Dự án đã Lưu trữ. Lỗi: `KHONG_TIM_THAY` (như `layDuAn`).
   */
  danhSachRepoCuaDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<RepoDuAn[]>>
  /**
   * "Việc của tôi": mọi Task chưa Hoàn thành và chưa Huỷ mà người gọi là Người thực hiện, qua mọi
   * Dự án, kèm tên Dự án; chỉ trong những Dự án người gọi đang ở trong (kể cả đã Lưu trữ, kể cả PM);
   * thứ tự không bảo đảm. Không có việc nào thì rỗng. Không lộ Task của người khác.
   */
  viecCuaToi(phien: Phien | null): Promise<KetQua<TaskKemDuAn[]>>
  /**
   * "Chờ tôi duyệt": mọi Task đang Chờ duyệt mà người gọi là Người kiểm tra, qua mọi Dự án, kèm
   * tên Dự án; cùng phạm vi Dự án như `viecCuaToi`; thứ tự không bảo đảm.
   */
  choToiDuyet(phien: Phien | null): Promise<KetQua<TaskKemDuAn[]>>
  /**
   * Sửa tiêu đề, mô tả và/hoặc hạn của Task chưa ở trạng thái cuối (ô không gửi thì giữ nguyên; hạn
   * trống hay null là xoá hạn); cập nhật người và ngày chỉnh sửa gần nhất (`bayGio`), người tạo và
   * ngày tạo giữ nguyên. PM hoặc Support của Dự án. Lỗi (không đổi gì), theo thứ tự:
   * `KHONG_CO_QUYEN` (Người thực hiện, Người kiểm tra, Thành viên và người ngoài Dự án; Task không
   * tồn tại với người không phải PM), `KHONG_TIM_THAY` (PM, Task không tồn tại), `DU_AN_DA_LUU_TRU`,
   * `TASK_DA_CHOT` (Hoàn thành hoặc Huỷ), `KHONG_HOP_LE` (như `taoTask`).
   */
  suaTask(phien: Phien | null, taskId: string, dauVao: SuaTaskDauVao, bayGio: Date): Promise<KetQua<Task>>
  /**
   * Đổi Người thực hiện và/hoặc Người kiểm tra của Task chưa ở trạng thái cuối (ô không gửi thì giữ
   * nguyên, kể cả người đã rời Dự án); cập nhật dấu vết chỉnh sửa như `suaTask`. Giao lại cho người
   * trong Dự án thì dấu hiệu "đã rời dự án" của ô đó biến mất. Lỗi (không đổi gì), theo thứ tự:
   * `KHONG_CO_QUYEN`, `KHONG_TIM_THAY`, `DU_AN_DA_LUU_TRU`, `TASK_DA_CHOT` (như `suaTask`),
   * `THIEU_NGUOI` (ô gửi trống), `NGUOI_NGOAI_DU_AN` (người được chọn không ở trong Dự án, kể cả
   * id không tồn tại), `TRUNG_NGUOI`.
   */
  doiNguoiTask(phien: Phien | null, taskId: string, dauVao: DoiNguoiTaskDauVao, bayGio: Date): Promise<KetQua<Task>>
  /**
   * Các Task chưa chốt (không phải Hoàn thành, không phải Huỷ) của Dự án mà tài khoản `nguoiDungId`
   * đang giữ, thực hiện hoặc kiểm tra; để PM hoặc Support giao lại trước khi gỡ người đó khỏi Dự án.
   * Chỉ đọc nên Dự án đã Lưu trữ vẫn xem được. Thứ tự không bảo đảm. Lỗi: `KHONG_CO_QUYEN`,
   * `KHONG_TIM_THAY` (như `goNguoiKhoiDuAn`: Dự án không tồn tại hoặc người đó không ở trong Dự án).
   */
  danhSachTaskNguoiDangGiu(phien: Phien | null, duAnId: string, nguoiDungId: string): Promise<KetQua<Task[]>>
  /**
   * Dán link issue hoặc PR của github.com vào Task (`dauVao.duongDan`). Mọi người trong dự án (và
   * PM) thêm được, kể cả Task đã ở trạng thái cuối; cập nhật người và ngày chỉnh sửa gần nhất của
   * Task (`bayGio`). Chỉ ghi link, không gọi GitHub. Lỗi (không đổi gì), theo thứ tự:
   * `KHONG_TIM_THAY` (Task không tồn tại hoặc người gọi không thấy Dự án), `DU_AN_DA_LUU_TRU`,
   * `LINK_KHONG_HOP_LE` (kèm lỗi ở ô `duongDan`), `LINK_REPO_CHUA_GAN`, `LINK_TRUNG` (so repo không
   * phân biệt hoa thường).
   */
  themLienKetVaoTask(
    phien: Phien | null,
    taskId: string,
    dauVao: ThemLienKetDauVao,
    bayGio: Date,
  ): Promise<KetQua<LienKetTask>>
  /**
   * Gỡ một link khỏi Task (so repo không phân biệt hoa thường); link khác giữ nguyên. Cập nhật
   * người và ngày chỉnh sửa gần nhất của Task. Lỗi (không đổi gì): `KHONG_TIM_THAY` (như
   * `themLienKetVaoTask`, hoặc link không có trên Task), `DU_AN_DA_LUU_TRU`.
   */
  goLienKetKhoiTask(phien: Phien | null, taskId: string, lienKet: LienKetGitHub, bayGio: Date): Promise<KetQua<null>>
  /**
   * Các link của Task, theo thứ tự thêm. Ai thấy Dự án của Task thì thấy danh sách này, kể cả Dự
   * án đã Lưu trữ. Lỗi: `KHONG_TIM_THAY` (như `layTask`).
   */
  danhSachLienKetCuaTask(phien: Phien | null, taskId: string): Promise<KetQua<LienKetTask[]>>
}
