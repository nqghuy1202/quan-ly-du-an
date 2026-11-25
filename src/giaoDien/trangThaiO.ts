import type { LoiKho } from '../kho/ketQua'

/** Trạng thái lỗi của một ô biểu mẫu (prop `status` của TextInput) từ lỗi `KHONG_HOP_LE` của Kho. */
export function trangThaiO(loi: LoiKho | null, o: string) {
  const thongBao = loi?.loiTheoO?.[o]
  return thongBao ? { type: 'error' as const, message: thongBao } : undefined
}
