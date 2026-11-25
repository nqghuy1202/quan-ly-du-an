import { createContext, useContext } from 'react'
import type { KhoDuLieu } from '../kho/khoDuLieu'

export const KhoContext = createContext<KhoDuLieu | null>(null)

/** Kho dữ liệu mà giao diện dùng (bộ nhớ khi test và chạy thử, Supabase khi có cấu hình). */
export function useKho(): KhoDuLieu {
  const kho = useContext(KhoContext)
  if (!kho) throw new Error('Thiếu KhoContext: bọc ứng dụng trong <KhoContext value={kho}>.')
  return kho
}
