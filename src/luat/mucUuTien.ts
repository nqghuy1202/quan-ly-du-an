// Luật thuần về Mức ưu tiên, dùng chung cho Dự án và Task: ba mức, nhãn tiếng Việt, mức mặc định và
// cách kiểm ở ranh giới. Không I/O. Kho dữ liệu và giao diện cùng dùng các định nghĩa ở đây.
import { z } from 'zod'

/** Ba Mức ưu tiên, theo thứ tự hiện trên ô chọn (từ thấp lên cao). */
export const CAC_MUC_UU_TIEN = ['THAP', 'TRUNG_BINH', 'CAO'] as const

export type MucUuTien = (typeof CAC_MUC_UU_TIEN)[number]

/** Mức ưu tiên khi người dùng không chọn. */
export const MUC_UU_TIEN_MAC_DINH: MucUuTien = 'TRUNG_BINH'

/** Nhãn tiếng Việt của từng Mức ưu tiên; giao diện luôn hiện nhãn này (màu chỉ đi kèm). */
export const TEN_MUC_UU_TIEN: Record<MucUuTien, string> = {
  THAP: 'Thấp',
  TRUNG_BINH: 'Trung bình',
  CAO: 'Cao',
}

export const THONG_BAO_MUC_UU_TIEN = {
  sai: 'Mức ưu tiên phải là Thấp, Trung bình hoặc Cao.',
} as const

/** Mức ưu tiên ở ranh giới: chỉ nhận đúng một trong ba giá trị. */
export const mucUuTienSchema = z.enum(CAC_MUC_UU_TIEN, { error: THONG_BAO_MUC_UU_TIEN.sai })

/** Giá trị (chưa tin được, vd đọc từ cơ sở dữ liệu) có phải một Mức ưu tiên không. */
export function laMucUuTien(giaTri: unknown): giaTri is MucUuTien {
  return typeof giaTri === 'string' && (CAC_MUC_UU_TIEN as readonly string[]).includes(giaTri)
}
