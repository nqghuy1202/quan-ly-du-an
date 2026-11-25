// Kết quả của mọi lệnh vào Kho dữ liệu: hoặc giá trị, hoặc một lỗi có mã.

export type MaLoi =
  | 'CHUA_DANG_NHAP'
  | 'KHONG_CO_QUYEN'
  | 'KHONG_TIM_THAY'
  | 'KHONG_HOP_LE'
  | 'EMAIL_DA_DUNG'
  | 'SAI_THONG_TIN_DANG_NHAP'
  | 'EMAIL_CHUA_XAC_NHAN'
  | 'MA_KHONG_HOP_LE'
  | 'MA_DA_DUNG'
  | 'MA_HET_HAN'

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
  EMAIL_CHUA_XAC_NHAN: 'Email của bạn chưa được xác nhận. Hãy bấm đường dẫn trong thư xác nhận, hoặc gửi lại thư.',
  MA_KHONG_HOP_LE: 'Mã đặt lại không đúng. Hãy kiểm tra email và mã trong thư.',
  MA_DA_DUNG: 'Mã đặt lại này đã được dùng. Hãy yêu cầu mã mới.',
  MA_HET_HAN: 'Mã đặt lại đã hết hạn. Hãy yêu cầu mã mới.',
}
