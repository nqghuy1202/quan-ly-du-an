import { useCallback, useState } from 'react'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from './astryx-themes'
import type { KhoDuLieu, Phien } from './kho/khoDuLieu'
import { taoKhoBoNho } from './kho/khoBoNho'
import { KhoContext } from './giaoDien/khoContext'
import { KhungUngDung } from './giaoDien/KhungUngDung'
import { ManXacThuc } from './giaoDien/ManXacThuc'

interface Props {
  /** Kho dữ liệu dùng cho ứng dụng; mặc định là bản bộ nhớ (bản Supabase thêm ở ticket sau). */
  kho?: KhoDuLieu
}

export function App({ kho: khoTruyenVao }: Props) {
  const [kho] = useState<KhoDuLieu>(() => khoTruyenVao ?? taoKhoBoNho())
  const [phien, setPhien] = useState<Phien | null>(null)
  const hetPhien = useCallback(() => setPhien(null), [])

  return (
    <Theme theme={themes[defaultThemeSlug]}>
      <KhoContext value={kho}>
        {phien ? (
          <KhungUngDung key={phien.maPhien} phien={phien} onHetPhien={hetPhien} />
        ) : (
          <ManXacThuc onDaDangNhap={setPhien} />
        )}
      </KhoContext>
    </Theme>
  )
}
