// Kết quả của mọi lệnh vào Kho dữ liệu: hoặc giá trị, hoặc một lỗi có mã.

export type MaLoi =
  | 'CHUA_DANG_NHAP'
  | 'KHONG_CO_QUYEN'
  | 'KHONG_TIM_THAY'
  | 'KHONG_HOP_LE'
  | 'EMAIL_DA_DUNG'
  | 'SAI_THONG_TIN_DANG_NHAP'

export interface LoiKho {
  ma: MaLoi
  /** Thông báo tiếng Việt, hiện được thẳng cho người dùng. */
  thongBao: string
  /** Lỗi theo từng ô của biểu mẫu (khi `ma` là `KHONG_HOP_LE`). */
  loiTheoO?: Record<string, string>
}

export type KetQua<T> = { ok: true; giaTri: T } | { ok: false; loi: LoiKho }

export function thanhCong<T>(giaTri: T): KetQua<T> {
  return { ok: true, giaTri }
}

export function thatBai<T = never>(ma: MaLoi, thongBao?: string, loiTheoO?: Record<string, string>): KetQua<T> {
  const loi: LoiKho = { ma, thongBao: thongBao ?? THONG_BAO_MAC_DINH[ma] }
  if (loiTheoO) loi.loiTheoO = loiTheoO
  return { ok: false, loi }
}

export const THONG_BAO_MAC_DINH: Record<MaLoi, string> = {
  CHUA_DANG_NHAP: 'Bạn chưa đăng nhập hoặc phiên đã hết. Hãy đăng nhập lại.',
  KHONG_CO_QUYEN: 'Bạn không có quyền làm việc này.',
  KHONG_TIM_THAY: 'Không tìm thấy dữ liệu yêu cầu.',
  KHONG_HOP_LE: 'Dữ liệu chưa hợp lệ. Hãy kiểm tra các ô được đánh dấu.',
  EMAIL_DA_DUNG: 'Email này đã được dùng để đăng ký.',
  SAI_THONG_TIN_DANG_NHAP: 'Email hoặc mật khẩu không đúng.',
}
