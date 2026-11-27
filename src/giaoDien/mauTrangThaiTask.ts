import type { TrangThaiTask } from '../luat/task'

/** Màu Token (Astryx) của từng trạng thái Task; màu đi qua theme, không đặt hex. */
export const MAU_TRANG_THAI_TASK: Record<TrangThaiTask, 'default' | 'blue' | 'yellow' | 'orange' | 'red' | 'green' | 'gray'> = {
  MOI: 'default',
  DANG_LAM: 'blue',
  CHO_DUYET: 'yellow',
  TRA_LAI: 'orange',
  BI_LOI: 'red',
  HOAN_THANH: 'green',
  HUY: 'gray',
}

/** Biến thể thanh tiến độ (Astryx ProgressBar) của từng trạng thái, cho phân bố ở Tổng quan; luôn kèm tên trạng thái. */
export const BIEN_THE_THANH_TRANG_THAI_TASK: Record<TrangThaiTask, 'accent' | 'success' | 'warning' | 'error' | 'neutral'> = {
  MOI: 'neutral',
  DANG_LAM: 'accent',
  CHO_DUYET: 'warning',
  TRA_LAI: 'warning',
  BI_LOI: 'error',
  HOAN_THANH: 'success',
  HUY: 'neutral',
}
