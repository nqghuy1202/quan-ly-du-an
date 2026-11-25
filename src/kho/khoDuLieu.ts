// Kho dữ liệu: giao diện lưu trữ duy nhất mà phần còn lại của ứng dụng dùng.
// Mọi lệnh cần danh tính nhận `phien` của người gọi (null = chưa đăng nhập) và trả
// `KetQua`: giá trị đã áp luật và quyền, hoặc một lỗi có mã. Bản cài: bộ nhớ (test, dev),
// sau này thêm bản Supabase; mọi bản cài phải qua `chayBoTestHopDong`.
import type { KetQua } from './ketQua'
import type { DangKyDauVao, DangNhapDauVao, SuaHoSoDauVao, VaiHeThong } from '../luat/taiKhoan'

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

export interface KhoDuLieu {
  /** Đăng ký tài khoản mới; hồ sơ có vai Thành viên. Lỗi: `KHONG_HOP_LE`, `EMAIL_DA_DUNG`. */
  dangKy(dauVao: DangKyDauVao): Promise<KetQua<HoSo>>
  /** Đăng nhập; sai email hay sai mật khẩu đều trả `SAI_THONG_TIN_DANG_NHAP`. */
  dangNhap(dauVao: DangNhapDauVao): Promise<KetQua<Phien>>
  /** Kết thúc phiên; sau đó mọi lệnh với phiên này trả `CHUA_DANG_NHAP`. */
  dangXuat(phien: Phien | null): Promise<KetQua<null>>
  /** Hồ sơ của người gọi. */
  layHoSoCuaToi(phien: Phien | null): Promise<KetQua<HoSo>>
  /** Sửa tên hiển thị và GitHub username; chỉ hồ sơ của chính mình. */
  suaHoSo(phien: Phien | null, nguoiDungId: string, dauVao: SuaHoSoDauVao): Promise<KetQua<HoSo>>
  /** Các Dự án người gọi được thấy. */
  danhSachDuAnCuaToi(phien: Phien | null): Promise<KetQua<DuAnTomTat[]>>
}
