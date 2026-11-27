import { useCallback, useState } from 'react'
import { InternationalizationProvider } from '@astryxdesign/core/i18n'
import viVN from '@astryxdesign/core/locales/vi-VN.generated.js'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from './astryx-themes'
import type { KhoDuLieu, Phien } from './kho/khoDuLieu'
import { PM_CHAY_THU, taoKhoBoNho, type MoPhongThu } from './kho/khoBoNho'
import type { CongGitHub } from './github/congGitHub'
import { taoCongKhongKhaDung } from './github/congKhongKhaDung'
import { CongGitHubContext } from './giaoDien/congGitHubContext'
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
  /**
   * Cổng GitHub (chỉ đọc) để đọc trạng thái link issue và PR trên Task. `main.tsx` chọn theo cấu
   * hình môi trường (`chonKho`: bản gọi Edge Function khi chạy Supabase, bản giả khi chạy bản bộ
   * nhớ). Không truyền thì dùng cổng báo `GITHUB_KHONG_KHA_DUNG` cho mọi link: Task vẫn dùng được,
   * chỉ không có trạng thái GitHub. Test truyền bản giả theo kịch bản.
   */
  congGitHub?: CongGitHub
}

const gioCuaMay = () => new Date()

/**
 * Chữ có sẵn của khung ứng dụng Astryx (liên kết bỏ qua đến nội dung, nút mở trình đơn ở màn hẹp,
 * tên vùng điều hướng...) lấy bản tiếng Việt của chính Astryx. Chỉ lấy nhóm chữ của khung: nạp cả bộ
 * tiếng Việt thì nút X của hộp thoại cũng thành "Đóng", trùng tên với nút Đóng của các hộp hiện có.
 */
const CHU_KHUNG_TIENG_VIET = {
  'vi-VN': Object.fromEntries(
    Object.entries(viVN).filter(([khoa]) => /^@astryx\.(appShell|mobileNav|sideNav|sideNavCollapseButton|sideNavItem|topNav)\./.test(khoa)),
  ),
}

/** Chưa cấu hình cổng nào: mọi link báo GitHub không khả dụng thay vì làm hỏng trang. */
const CONG_CHUA_CAU_HINH: CongGitHub = taoCongKhongKhaDung()

export function App({
  kho: khoTruyenVao,
  moPhong: moPhongTruyenVao,
  dongHo = gioCuaMay,
  congGitHub = CONG_CHUA_CAU_HINH,
}: Props) {
  const [{ kho, moPhong }] = useState<{ kho: KhoDuLieu; moPhong: MoPhongThu | null }>(() => {
    if (khoTruyenVao) return { kho: khoTruyenVao, moPhong: moPhongTruyenVao ?? null }
    const boNho = taoKhoBoNho({ pmBanDau: PM_CHAY_THU })
    return { kho: boNho, moPhong: boNho.moPhong }
  })
  const [phien, setPhien] = useState<Phien | null>(null)
  const hetPhien = useCallback(() => setPhien(null), [])

  return (
    <Theme theme={themes[defaultThemeSlug]} mode="light">
      <InternationalizationProvider locale="vi-VN" overrides={CHU_KHUNG_TIENG_VIET}>
        <KhoContext value={kho}>
          <CongGitHubContext value={congGitHub}>
            {phien ? (
              <KhungUngDung key={phien.maPhien} phien={phien} onHetPhien={hetPhien} dongHo={dongHo} />
            ) : (
              <ManXacThuc onDaDangNhap={setPhien} moPhong={moPhong} dongHo={dongHo} />
            )}
          </CongGitHubContext>
        </KhoContext>
      </InternationalizationProvider>
    </Theme>
  )
}
