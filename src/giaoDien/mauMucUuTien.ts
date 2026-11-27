import { CAC_MUC_UU_TIEN, TEN_MUC_UU_TIEN, type MucUuTien } from '../luat/mucUuTien'

/**
 * Màu Token (Astryx) của từng Mức ưu tiên, dùng chung cho Dự án và Task; màu đi qua theme, không đặt hex.
 * Màu chỉ đi kèm: Mức ưu tiên luôn hiện bằng nhãn chữ (`TEN_MUC_UU_TIEN`), không phân biệt riêng bằng màu.
 */
export const MAU_MUC_UU_TIEN: Record<MucUuTien, 'gray' | 'blue' | 'orange'> = {
  THAP: 'gray',
  TRUNG_BINH: 'blue',
  CAO: 'orange',
}

/** Lựa chọn Mức ưu tiên cho ô chọn (Selector) của biểu mẫu Dự án và Task: nhãn tiếng Việt, từ thấp lên cao. */
export const LUA_CHON_MUC_UU_TIEN = CAC_MUC_UU_TIEN.map((muc) => ({ value: muc, label: TEN_MUC_UU_TIEN[muc] }))
