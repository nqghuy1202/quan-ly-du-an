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
  | 'PHAI_CON_PM'
  | 'DU_AN_DA_LUU_TRU'
  | 'DU_AN_DANG_HOAT_DONG'
  | 'CHUA_DANG_KY'
  | 'DA_TRONG_DU_AN'
  /** Task thiếu Người thực hiện hoặc Người kiểm tra. */
  | 'THIEU_NGUOI'
  /** Người được chọn cho Task không ở trong Dự án (hoặc không tồn tại). */
  | 'NGUOI_NGOAI_DU_AN'
  /** Cùng một người vừa là Người thực hiện vừa là Người kiểm tra. */
  | 'TRUNG_NGUOI'
  /** Task đã Hoàn thành hoặc Huỷ (trạng thái cuối): không sửa, không đổi người được nữa. */
  | 'TASK_DA_CHOT'
  /** Không gọi được máy chủ (mất mạng, máy chủ lỗi, quá nhiều yêu cầu); chỉ bản cài có I/O trả mã này. */
  | 'LOI_HE_THONG'
  /** Tên repo GitHub không đúng dạng chủ-sở-hữu/tên-repo. */
  | 'REPO_KHONG_HOP_LE'
  /** Repo đã gắn vào Dự án (không phân biệt hoa thường). */
  | 'REPO_DA_GAN'
  /** Bước đổi trạng thái Task không có trong ma trận (vd. Mới sang Hoàn thành). */
  | 'BUOC_KHONG_HOP_LE'
  /** Trả lại, Bị lỗi hay Huỷ mà lý do rỗng hoặc chỉ khoảng trắng. */
  | 'LY_DO_BAT_BUOC'

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
  PHAI_CON_PM:
    'Không hạ được vai: hệ thống phải luôn còn ít nhất một PM. Hãy đặt một người khác làm PM trước.',
  DU_AN_DA_LUU_TRU: 'Dự án đã Lưu trữ nên chỉ xem được. Mở lại Dự án để sửa.',
  DU_AN_DANG_HOAT_DONG: 'Dự án đang hoạt động, không cần mở lại.',
  CHUA_DANG_KY:
    'Email này chưa đăng ký. Hãy nhờ người đó tự đăng ký tài khoản trước rồi thêm lại (hệ thống không gửi thư mời).',
  DA_TRONG_DU_AN: 'Người này đã ở trong Dự án.',
  THIEU_NGUOI: 'Task phải có đủ một Người thực hiện và một Người kiểm tra.',
  NGUOI_NGOAI_DU_AN:
    'Người được chọn không ở trong Dự án. Chỉ chọn được người đang ở trong Dự án làm Người thực hiện hay Người kiểm tra.',
  TRUNG_NGUOI: 'Người kiểm tra phải khác Người thực hiện: không ai tự duyệt việc của mình.',
  TASK_DA_CHOT: 'Task đã Hoàn thành hoặc Huỷ nên không sửa hay đổi người được nữa.',
  LOI_HE_THONG: 'Không kết nối được máy chủ hoặc máy chủ đang lỗi. Hãy thử lại sau ít phút.',
  REPO_KHONG_HOP_LE: 'Tên repo phải có dạng chu-so-huu/ten-repo, ví dụ vercel/next.js.',
  REPO_DA_GAN: 'Repo này đã được gắn vào Dự án.',
  BUOC_KHONG_HOP_LE: 'Bước đổi trạng thái này không có trong vòng duyệt của Task.',
  LY_DO_BAT_BUOC: 'Hãy nhập lý do. Trả lại, báo Bị lỗi và Huỷ Task đều bắt buộc có lý do.',
}
