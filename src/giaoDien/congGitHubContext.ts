import { createContext, useContext } from 'react'
import type { CongGitHub } from '../github/congGitHub'

export const CongGitHubContext = createContext<CongGitHub | null>(null)

/** Cổng GitHub (chỉ đọc) mà giao diện dùng để đọc trạng thái issue và PR. */
export function useCongGitHub(): CongGitHub {
  const cong = useContext(CongGitHubContext)
  if (!cong) throw new Error('Thiếu CongGitHubContext: bọc ứng dụng trong <CongGitHubContext value={cong}>.')
  return cong
}
