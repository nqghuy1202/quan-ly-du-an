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
