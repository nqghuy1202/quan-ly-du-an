import { useCallback, useState } from 'react'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from './astryx-themes'
import type { KhoDuLieu, Phien } from './kho/khoDuLieu'
import { PM_CHAY_THU, taoKhoBoNho, type MoPhongThu } from './kho/khoBoNho'
import { KhoContext } from './giaoDien/khoContext'
import { KhungUngDung } from './giaoDien/KhungUngDung'
import { ManXacThuc } from './giaoDien/ManXacThuc'

interface Props {
  /**
   * Kho dữ liệu dùng cho ứng dụng. `main.tsx` chọn theo cấu hình môi trường (`chonKho`: Supabase
   * hoặc bản bộ nhớ); không truyền thì dùng bản bộ nhớ có sẵn một PM chạy thử.
   */
  kho?: KhoDuLieu
  /**
   * Hộp thư mô phỏng đi cùng `kho` khi đó là bản bộ nhớ (thay cho thư thật). Khi không truyền `kho`,
   * ứng dụng dùng hộp thư của bản bộ nhớ nó tự tạo.
   */
  moPhong?: MoPhongThu | null
  /**
   * Đồng hồ cho hạn mã đặt lại mật khẩu và dấu vết (ngày tạo, ngày chỉnh sửa); mặc định là giờ
   * của máy. Test truyền đồng hồ cố định.
   */
  dongHo?: () => Date
}

const gioCuaMay = () => new Date()

export function App({ kho: khoTruyenVao, moPhong: moPhongTruyenVao, dongHo = gioCuaMay }: Props) {
  const [{ kho, moPhong }] = useState<{ kho: KhoDuLieu; moPhong: MoPhongThu | null }>(() => {
    if (khoTruyenVao) return { kho: khoTruyenVao, moPhong: moPhongTruyenVao ?? null }
    const boNho = taoKhoBoNho({ pmBanDau: PM_CHAY_THU })
    return { kho: boNho, moPhong: boNho.moPhong }
  })
  const [phien, setPhien] = useState<Phien | null>(null)
  const hetPhien = useCallback(() => setPhien(null), [])

  return (
    <Theme theme={themes[defaultThemeSlug]}>
      <KhoContext value={kho}>
        {phien ? (
          <KhungUngDung key={phien.maPhien} phien={phien} onHetPhien={hetPhien} dongHo={dongHo} />
        ) : (
          <ManXacThuc onDaDangNhap={setPhien} moPhong={moPhong} dongHo={dongHo} />
        )}
      </KhoContext>
    </Theme>
  )
}
