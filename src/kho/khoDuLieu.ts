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
  CAC_PHAM_VI_DANH_SACH_DU_AN,
  DauVet,
  LocDuAnDauVao,
  SuaDuAnDauVao,
  SuaVaiTroTrongDuAnDauVao,
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
import type { MucUuTien } from '../luat/mucUuTien'
import type { SoLieuDuAn } from '../luat/tienDo'
import type { ThongTinNhanSu } from '../luat/thongTinNhanSu'
import type { GanRepoDauVao, LienKetGitHub, ThemLienKetDauVao } from '../luat/github'
import type { DoiTrangThaiTaskDauVao, DongLichSuBatKy } from '../luat/chuyenTrangThai'

export type { ThongTinNhanSu }

/** Hồ sơ của một tài khoản, kèm Thông tin nhân sự (Số điện thoại, Chức danh, Phòng ban; null là trống). */
export interface HoSo extends ThongTinNhanSu {
  id: string
  email: string
  tenHienThi: string
  githubUsername: string | null
  vai: VaiHeThong
}

/**
 * Một tài khoản trên màn Người dùng của PM (và trong danh sách Người trong dự án). Thông tin nhân sự đã
 * áp quyền xem (`luat/thongTinNhanSu.ts`): người gọi không đủ quyền thì ba trường là null, các trường
 * khác không đổi.
 */
export interface NguoiDungTomTat extends ThongTinNhanSu {
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
  /** Mã Dự án, in hoa (vd `SDV-012`). */
  ma: string
  ten: string
  trangThai: TrangThaiDuAn
}

/**
 * Một người trong dự án: tên, email, vai hệ thống hiện tại của tài khoản, Thông tin nhân sự (đã áp
 * quyền xem), Vai trò trong Dự án và số Task đang giữ. Gỡ người khỏi Dự án không đụng tới tài khoản hay
 * hồ sơ của họ.
 */
export interface NguoiTrongDuAn extends NguoiDungTomTat {
  /**
   * Vai trò trong Dự án (chữ tự do, tối đa 60 ký tự, vd "Trưởng nhóm"); null khi chưa có. Không đổi quyền
   * nào. Gỡ người khỏi Dự án thì vai trò mất theo; thêm lại là bắt đầu từ trống.
   */
  vaiTroTrongDuAn: string | null
  /**
   * Số Task của Dự án này chưa Hoàn thành, chưa Huỷ mà người đó là Người thực hiện (không tính Task người
   * đó chỉ là Người kiểm tra).
   */
  soTaskDangGiu: number
}

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

/**
 * Một Dự án đầy đủ: Mã, tên, mô tả, Khách hàng, hai ngày, Mức ưu tiên, Người phụ trách, trạng thái và dấu vết.
 */
export interface DuAn {
  id: string
  /** Mã Dự án: duy nhất (không phân biệt hoa thường), lưu dạng in hoa, vd `SDV-012`. */
  ma: string
  ten: string
  /** Chuỗi rỗng khi không có mô tả. */
  moTa: string
  /** Khách hàng hoặc đơn vị Dự án phục vụ; chuỗi rỗng khi không có. */
  khachHang: string
  /** Ngày bắt đầu, chỉ ngày (`YYYY-MM-DD`, không giờ); null khi chưa có. */
  ngayBatDau: string | null
  /** Ngày kết thúc dự kiến, chỉ ngày (`YYYY-MM-DD`); null khi chưa có. Không trước Ngày bắt đầu. */
  ngayKetThucDuKien: string | null
  /** Thấp, Trung bình hoặc Cao; Dự án tạo mà không chọn thì là Trung bình. */
  mucUuTien: MucUuTien
  /**
   * Người phụ trách: một Người trong dự án, kèm tên hiển thị hiện tại; null khi chưa có. Chỉ để hiển thị
   * và lọc, không cấp thêm quyền. Gỡ người đó khỏi Dự án thì về null.
   */
  nguoiPhuTrach: NguoiDauVet | null
  trangThai: TrangThaiDuAn
  dauVet: DauVet<NguoiDauVet>
}

/**
 * Một Dự án kèm số liệu cho bảng Dự án: Tiến độ, số Task Trễ hạn và cờ Quá hạn dự kiến, tính theo ngày
 * hôm nay truyền vào (`luat/tienDo.ts`, `tinhSoLieuDuAn`).
 */
export type DuAnKemSoLieu = DuAn & SoLieuDuAn

/**
 * Phạm vi của danh sách Dự án kèm số liệu: `CUA_TOI` là các Dự án người gọi đang ở trong (như
 * `danhSachDuAnCuaToi`); `TAT_CA` là mọi Dự án người gọi được thấy (như `danhSachDuAn`).
 */
export type PhamViDanhSachDuAn = (typeof CAC_PHAM_VI_DANH_SACH_DU_AN)[number]

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
  /** Thấp, Trung bình hoặc Cao; Task tạo mà không chọn thì là Trung bình. */
  mucUuTien: MucUuTien
  nguoiThucHien: NguoiCuaTask
  nguoiKiemTra: NguoiCuaTask
  trangThai: TrangThaiTask
  soLanTraLai: number
  dauVet: DauVet<NguoiDauVet>
}

/**
 * Một dòng lịch sử của Task: đổi trạng thái (`loai: 'TRANG_THAI'`, có lý do) hoặc đổi Mức ưu tiên
 * (`loai: 'MUC_UU_TIEN'`), cùng một dòng thời gian. Người đổi kèm tên hiển thị hiện tại lúc đọc.
 */
export type DongLichSuTask = DongLichSuBatKy<NguoiDauVet>

/** Một repo GitHub gắn vào Dự án: tên dạng `chu-so-huu/ten-repo`, giữ chữ hoa chữ thường như lúc gắn. */
export interface RepoDuAn {
  tenRepo: string
}

/** Một Task kèm tên và Mã của Dự án chứa nó, cho các danh sách cá nhân qua mọi Dự án. */
export interface TaskKemDuAn extends Task {
  tenDuAn: string
  maDuAn: string
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
  /**
   * Sửa tên hiển thị, GitHub username và Thông tin nhân sự (Số điện thoại, Chức danh, Phòng ban); ô không
   * gửi thì giữ nguyên, ô tuỳ chọn gửi trống là xoá. Chỉ hồ sơ của chính mình, kể cả PM không sửa hộ ai.
   * Lỗi (không đổi gì): `KHONG_CO_QUYEN`, `KHONG_HOP_LE` (kèm lỗi ở từng ô: tên rỗng hay quá 100 ký tự,
   * GitHub username sai dạng, Số điện thoại sai dạng, Chức danh hay Phòng ban quá 60 ký tự).
   */
  suaHoSo(phien: Phien | null, nguoiDungId: string, dauVao: SuaHoSoDauVao): Promise<KetQua<HoSo>>
  /**
   * Các Dự án người gọi đang ở trong (kể cả đã Lưu trữ), với mọi vai, kể cả PM; thứ tự không bảo
   * đảm. Người chưa ở Dự án nào nhận danh sách rỗng.
   */
  danhSachDuAnCuaToi(phien: Phien | null): Promise<KetQua<DuAnTomTat[]>>
  /**
   * Mọi tài khoản (tên, email, vai, Thông tin nhân sự); thứ tự không bảo đảm, giao diện tự xếp. Chỉ PM.
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
   * sửa. Mã bắt buộc (cắt khoảng trắng, lưu in hoa); Khách hàng, Ngày bắt đầu, Ngày kết thúc dự kiến,
   * Mức ưu tiên (không chọn thì Trung bình) tuỳ chọn; chưa có Người phụ trách. Chỉ PM. Lỗi (không tạo
   * gì), theo thứ tự: `KHONG_CO_QUYEN`, `KHONG_HOP_LE` (thiếu Mã hay Mã sai dạng; tên rỗng, chỉ khoảng
   * trắng, quá 120 ký tự; Khách hàng quá 120 ký tự; ngày không có thật; Ngày kết thúc dự kiến trước Ngày
   * bắt đầu; Mức ưu tiên ngoài Thấp, Trung bình, Cao), `MA_DU_AN_DA_DUNG` (Mã trùng Mã của một Dự án
   * khác, không phân biệt hoa thường; kèm lỗi ở ô `ma`).
   */
  taoDuAn(phien: Phien | null, dauVao: TaoDuAnDauVao, bayGio: Date): Promise<KetQua<DuAn>>
  /**
   * Các Dự án người gọi được thấy, lọc theo trạng thái nếu có; thứ tự không bảo đảm, giao diện tự
   * xếp. PM thấy mọi Dự án; Support và Thành viên chỉ thấy Dự án mình ở trong (người chưa ở Dự án
   * nào nhận danh sách rỗng). Lỗi: `KHONG_HOP_LE` (trạng thái lọc sai).
   */
  danhSachDuAn(phien: Phien | null, loc?: LocDuAnDauVao): Promise<KetQua<DuAn[]>>
  /**
   * Danh sách Dự án cho bảng "Dự án của tôi" (`phamVi` `CUA_TOI`: Dự án người gọi đang ở trong, kể cả đã
   * Lưu trữ, kể cả PM) hoặc "Tất cả Dự án" (`TAT_CA`: mọi Dự án người gọi được thấy, như `danhSachDuAn`),
   * mỗi Dự án đủ trường kèm Tiến độ, số Task Trễ hạn và cờ Quá hạn dự kiến theo ngày hôm nay của `bayGio`
   * (giờ Việt Nam), trong một lần đọc. Quyền xem giữ như hai lệnh kia. Thứ tự không bảo đảm. Lỗi:
   * `KHONG_HOP_LE` (phạm vi sai).
   */
  danhSachDuAnKemSoLieu(phien: Phien | null, phamVi: PhamViDanhSachDuAn, bayGio: Date): Promise<KetQua<DuAnKemSoLieu[]>>
  /**
   * Một Dự án, kể cả đã Lưu trữ. PM mở được mọi Dự án; người khác chỉ Dự án mình ở trong.
   * Lỗi: `KHONG_TIM_THAY` (không tồn tại, hoặc không thuộc về người gọi: không lộ là có tồn tại).
   */
  layDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<DuAn>>
  /**
   * Sửa Mã, tên, mô tả, Khách hàng, hai ngày, Mức ưu tiên và/hoặc Người phụ trách (ô không gửi thì giữ
   * nguyên; ngày hay `nguoiPhuTrachId` gửi trống hoặc null là xoá); cập nhật người và ngày chỉnh sửa gần
   * nhất (`bayGio`). PM hoặc Support của Dự án. Ngày gửi lên được kiểm cùng ngày đang lưu: Ngày kết thúc
   * dự kiến không trước Ngày bắt đầu, sai thì `KHONG_HOP_LE` kèm lỗi ở ô vừa gửi. Đặt lại đúng Mã của
   * chính Dự án này không bị coi là trùng. Lỗi (không đổi gì), theo thứ tự: `KHONG_CO_QUYEN` (kể cả Dự án
   * không tồn tại, với người không phải PM), `KHONG_TIM_THAY` (PM, Dự án không tồn tại),
   * `DU_AN_DA_LUU_TRU`, `KHONG_HOP_LE` (như `taoDuAn`), `NGUOI_NGOAI_DU_AN` (Người phụ trách không phải
   * Người trong dự án, kể cả id không tồn tại; kèm lỗi ở ô `nguoiPhuTrachId`), `MA_DU_AN_DA_DUNG`.
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
   * Người trong một Dự án (tên, email, vai hệ thống, Thông tin nhân sự đã áp quyền xem, Vai trò trong Dự
   * án, số Task đang giữ); thứ tự không bảo đảm. Ai thấy Dự án thì thấy danh sách này. Lỗi:
   * `KHONG_TIM_THAY` (như `layDuAn`).
   */
  danhSachNguoiTrongDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<NguoiTrongDuAn[]>>
  /**
   * Thêm tài khoản có email `dauVao.email` (không phân biệt hoa thường) vào Dự án, kèm Vai trò trong Dự
   * án tuỳ chọn (`dauVao.vaiTroTrongDuAn`; không gửi hay gửi trống là chưa có). Người đó phải đã đăng ký;
   * không gửi thư mời. PM hoặc Support của Dự án. Lỗi (không đổi gì): `KHONG_CO_QUYEN`, `KHONG_TIM_THAY`
   * (như `suaDuAn`), `DU_AN_DA_LUU_TRU`, `KHONG_HOP_LE` (email sai định dạng, Vai trò trong Dự án quá 60
   * ký tự; kèm lỗi ở từng ô), `CHUA_DANG_KY`, `DA_TRONG_DU_AN`.
   */
  themNguoiVaoDuAn(phien: Phien | null, duAnId: string, dauVao: ThemNguoiDauVao): Promise<KetQua<NguoiTrongDuAn>>
  /**
   * Sửa Vai trò trong Dự án của tài khoản `nguoiDungId` (cắt khoảng trắng hai đầu; gửi trống là xoá).
   * Vai trò không đổi quyền nào; Dấu vết của Dự án không đổi. PM hoặc Support của Dự án (Support sửa được
   * cả vai trò của chính mình). Trả người đó như trong danh sách Người trong dự án. Lỗi (không đổi gì), theo
   * thứ tự: `KHONG_CO_QUYEN` (Thành viên, Support ngoài Dự án; kể cả Dự án không tồn tại, với người không
   * phải PM), `KHONG_TIM_THAY` (PM, Dự án không tồn tại), `DU_AN_DA_LUU_TRU`, `KHONG_HOP_LE` (quá 60 ký
   * tự, kèm lỗi ở ô `vaiTroTrongDuAn`), `KHONG_TIM_THAY` (người đó không ở trong Dự án, kể cả id không
   * tồn tại).
   */
  suaVaiTroTrongDuAn(
    phien: Phien | null,
    duAnId: string,
    nguoiDungId: string,
    dauVao: SuaVaiTroTrongDuAnDauVao,
  ): Promise<KetQua<NguoiTrongDuAn>>
  /**
   * Gỡ tài khoản `nguoiDungId` khỏi Dự án; tài khoản và hồ sơ của họ giữ nguyên. Người đó đang là
   * Người phụ trách thì Người phụ trách về trống trong cùng lệnh (Dấu vết của Dự án không đổi). PM hoặc Support
   * của Dự án (Support gỡ được cả chính mình). Lỗi (không đổi gì): `KHONG_CO_QUYEN`,
   * `KHONG_TIM_THAY` (như `suaDuAn`, hoặc người đó không ở trong Dự án), `DU_AN_DA_LUU_TRU`.
   */
  goNguoiKhoiDuAn(phien: Phien | null, duAnId: string, nguoiDungId: string): Promise<KetQua<null>>
  /**
   * Tạo Task trong Dự án: trạng thái Mới, số lần bị Trả lại 0, Mức ưu tiên như gửi (không gửi thì Trung
   * bình); người tạo là người gọi, ngày tạo là `bayGio`, chưa có phần chỉnh sửa; lịch sử rỗng. PM hoặc
   * Support của Dự án. Lỗi (không tạo gì), theo thứ tự:
   * `KHONG_CO_QUYEN` (như `suaDuAn`; Thành viên luôn nhận mã này, kể cả khi sẽ là Người thực hiện),
   * `KHONG_TIM_THAY` (PM, Dự án không tồn tại), `DU_AN_DA_LUU_TRU`, `KHONG_HOP_LE` (tiêu đề rỗng,
   * chỉ khoảng trắng, quá 200 ký tự; hạn không phải một ngày có thật; Mức ưu tiên ngoài Thấp, Trung bình,
   * Cao, kèm lỗi ở ô `mucUuTien`), `THIEU_NGUOI`,
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
   * Đổi trạng thái Task theo ma trận của spec (`luat/chuyenTrangThai.ts`): ghi đúng một dòng lịch
   * sử (người gọi, `bayGio`, trạng thái cũ, trạng thái mới, lý do), tăng bộ đếm Trả lại khi sang
   * Trả lại, và cập nhật người và ngày chỉnh sửa gần nhất như một lần chỉnh sửa. Người thực hiện,
   * Người kiểm tra, Support của Dự án và PM, theo bảng của spec. Lỗi (không đổi gì, không ghi lịch
   * sử), theo thứ tự: `KHONG_CO_QUYEN` (người gọi không giữ vai nào trên Task; Task không tồn tại với
   * người không phải PM), `KHONG_TIM_THAY` (PM, Task không tồn tại), `DU_AN_DA_LUU_TRU`,
   * `TASK_DA_CHOT` (mọi bước từ Hoàn thành hay Huỷ), `KHONG_HOP_LE` (trạng thái đích không có thật,
   * lý do quá dài), `BUOC_KHONG_HOP_LE` (không có trong ma trận), `KHONG_CO_QUYEN` (có trong ma trận
   * nhưng vai của người gọi không được làm), `LY_DO_BAT_BUOC` (Trả lại, Bị lỗi, Huỷ mà lý do rỗng
   * hay chỉ khoảng trắng).
   */
  doiTrangThaiTask(phien: Phien | null, taskId: string, dauVao: DoiTrangThaiTaskDauVao, bayGio: Date): Promise<KetQua<Task>>
  /**
   * Lịch sử của Task: các lần đổi trạng thái và đổi Mức ưu tiên trên cùng một dòng thời gian, theo thứ
   * tự thời gian tăng dần (cùng lúc thì theo thứ tự ghi); Task chưa đổi lần nào thì rỗng. Ai thấy Dự án của Task thì xem được. Lỗi: `KHONG_TIM_THAY`
   * (như `layTask`).
   */
  lichSuTask(phien: Phien | null, taskId: string): Promise<KetQua<DongLichSuTask[]>>
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
   * Dự án, kèm tên và Mã Dự án; chỉ trong những Dự án người gọi đang ở trong (kể cả đã Lưu trữ, kể cả PM);
   * thứ tự không bảo đảm. Không có việc nào thì rỗng. Không lộ Task của người khác.
   */
  viecCuaToi(phien: Phien | null): Promise<KetQua<TaskKemDuAn[]>>
  /**
   * "Chờ tôi duyệt": mọi Task đang Chờ duyệt mà người gọi là Người kiểm tra, qua mọi Dự án, kèm
   * tên và Mã Dự án; cùng phạm vi Dự án như `viecCuaToi`; thứ tự không bảo đảm.
   */
  choToiDuyet(phien: Phien | null): Promise<KetQua<TaskKemDuAn[]>>
  /**
   * Sửa tiêu đề, mô tả, hạn và/hoặc Mức ưu tiên của Task chưa ở trạng thái cuối (ô không gửi thì giữ
   * nguyên; hạn trống hay null là xoá hạn); cập nhật người và ngày chỉnh sửa gần nhất (`bayGio`), người
   * tạo và ngày tạo giữ nguyên. Mức ưu tiên đổi sang mức khác thì ghi một dòng lịch sử (người gọi,
   * `bayGio`, mức cũ, mức mới); gửi đúng mức đang có thì không ghi. PM hoặc Support của Dự án (Người
   * thực hiện, Người kiểm tra có vai Thành viên không đổi được). Lỗi (không đổi gì, không ghi lịch sử),
   * theo thứ tự:
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
