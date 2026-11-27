import { createContext, useContext, useEffect } from 'react'
import type { KetQua } from '../kho/ketQua'

/**
 * Bộ giữ dữ liệu lần trước của các màn, theo phiên đăng nhập: mỗi khoá giữ kết quả đọc thành công gần
 * nhất. Màn mở lại hiện ngay bản đã giữ rồi đọc lại ngầm và thay. Không có hạn theo thời gian; bộ giữ
 * sống cùng khung ứng dụng của một phiên (`KhungUngDung`), nên đăng xuất hay hết phiên là bỏ hết.
 */
export interface BoGiuDuLieu {
  lay<T>(khoa: string): T | undefined
  dat<T>(khoa: string, giaTri: T): void
}

export function taoBoGiuDuLieu(): BoGiuDuLieu {
  const giu = new Map<string, unknown>()
  return {
    lay: <T>(khoa: string) => giu.get(khoa) as T | undefined,
    dat: (khoa, giaTri) => {
      giu.set(khoa, giaTri)
    },
  }
}

/** Ngoài khung ứng dụng (vd test dựng riêng một màn): không giữ gì, màn tải như trước. */
const KHONG_GIU: BoGiuDuLieu = { lay: () => undefined, dat: () => {} }

export const BoGiuDuLieuContext = createContext<BoGiuDuLieu>(KHONG_GIU)

export function useBoGiuDuLieu(): BoGiuDuLieu {
  return useContext(BoGiuDuLieuContext)
}

/** Giữ lại kết quả `kq` dưới `khoa` mỗi khi nó là một lần đọc thành công mới. */
export function useGiuKetQua<T>(khoa: string, kq: KetQua<T> | null) {
  const boGiu = useBoGiuDuLieu()
  useEffect(() => {
    if (kq?.ok) boGiu.dat(khoa, kq.giaTri)
  }, [boGiu, khoa, kq])
}
