import { Token } from '@astryxdesign/core/Token'
import { TEN_MUC_UU_TIEN, type MucUuTien } from '../luat/mucUuTien'
import { MAU_MUC_UU_TIEN } from './mauMucUuTien'

/**
 * Nhãn Mức ưu tiên: chữ tiếng Việt (Thấp, Trung bình, Cao) kèm màu của mức; dùng chung cho Dự án và Task.
 * Không bao giờ chỉ có màu.
 */
export function NhanMucUuTien({ mucUuTien, size = 'md' }: { mucUuTien: MucUuTien; size?: 'sm' | 'md' }) {
  return <Token label={TEN_MUC_UU_TIEN[mucUuTien]} color={MAU_MUC_UU_TIEN[mucUuTien]} size={size} />
}
