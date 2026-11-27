import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer'
import { Icon } from '@astryxdesign/core/Icon'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'

/** Độ rộng của Ngăn trượt trên màn rộng (điểm ảnh); là độ rộng cấu trúc. Màn hẹp: ngăn chiếm cả màn. */
const RONG_NGAN = 640

/** Nhãn nút đóng ở đầu mọi Ngăn trượt. */
export const NHAN_DONG_NGAN = 'Đóng Ngăn trượt'

interface Props {
  /** Ngăn đang mở hay không; nơi gọi giữ trạng thái này. */
  isOpen: boolean
  /** Tiêu đề ở đầu ngăn (tiêu đề cấp 2); cũng là tên của ngăn cho trình đọc màn hình. */
  tieuDe: string
  /** Dòng phụ dưới tiêu đề (vd. tên Dự án). */
  phuDe?: string
  /** Người dùng muốn đóng ngăn: nút đóng, phím Esc hoặc bấm ra ngoài (trừ ngăn chứa biểu mẫu). */
  onDong: () => void
  /** Ngăn trượt xong và đã đóng hẳn: lúc nơi gọi bỏ nội dung cũ (giữ nội dung trong lúc trượt ra). */
  onDaDongXong?: () => void
  /** Ngăn chứa biểu mẫu: bấm ra ngoài không đóng để khỏi mất chữ đang nhập; nút đóng và Esc vẫn đóng. */
  laBieuMau?: boolean
  /** Hàng nút ghim ở chân ngăn (vd. Lưu, Huỷ của biểu mẫu). */
  chan?: ReactNode
  children: ReactNode
}

/**
 * Ngăn trượt: khung mở từ bên phải, đè lên trang hiện tại, để xem hoặc nhập rồi đóng lại (dùng chung
 * cho xem Task, tạo Task, tạo Dự án và sửa Dự án). Dựng trên Drawer của Astryx: focus vào trong
 * ngăn khi mở, đóng bằng nút đóng hoặc Esc thì focus trở lại chỗ đã bấm; trang phía sau vẫn ở nguyên
 * (không bị thay), nên tab và bộ lọc đang xem được giữ. Màn hẹp: ngăn chiếm cả màn.
 */
export function NganTruot({ isOpen, tieuDe, phuDe, onDong, onDaDongXong, laBieuMau = false, chan, children }: Props) {
  const refNgan = useRef<HTMLDialogElement>(null)
  // Giữ hàm mới nhất mà không phải gắn lại bộ nghe mỗi lần vẽ.
  const refDaDongXong = useRef(onDaDongXong)
  useEffect(() => {
    refDaDongXong.current = onDaDongXong
  }, [onDaDongXong])

  // Drawer phát sự kiện `close` của <dialog> sau khi trượt ra xong và trả focus về chỗ đã bấm.
  useEffect(() => {
    const ngan = refNgan.current
    if (!ngan) return
    const khiDong = () => refDaDongXong.current?.()
    ngan.addEventListener('close', khiDong)
    return () => ngan.removeEventListener('close', khiDong)
  }, [])

  return (
    <Drawer
      ref={refNgan}
      isOpen={isOpen}
      onOpenChange={(mo) => {
        if (!mo) onDong()
      }}
      label={tieuDe}
      width={RONG_NGAN}
      experimental={{ isFullWidthOnMobile: true }}
      purpose={laBieuMau ? 'form' : 'info'}
    >
      <Layout
        header={
          <DrawerHeader
            title={tieuDe}
            subtitle={phuDe}
            hasDivider
            endContent={
              <Button
                data-autofocus
                variant="ghost"
                label={NHAN_DONG_NGAN}
                tooltip={NHAN_DONG_NGAN}
                icon={<Icon icon="close" color="inherit" />}
                isIconOnly
                onClick={onDong}
              />
            }
          />
        }
        content={<LayoutContent>{children}</LayoutContent>}
        footer={chan ? <LayoutFooter>{chan}</LayoutFooter> : undefined}
      />
    </Drawer>
  )
}
