import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { HStack } from '@astryxdesign/core/HStack'
import { TextArea } from '@astryxdesign/core/TextArea'
import { VStack } from '@astryxdesign/core/VStack'
import { DO_DAI_LY_DO_TOI_DA, THONG_BAO_CHUYEN_TRANG_THAI } from '../luat/chuyenTrangThai'

interface Props {
  /** Tiêu đề hộp, vd. "Trả lại Task". */
  tieuDe: string
  /** Chữ trên nút gửi, vd. "Trả lại". */
  nhanGui: string
  /** Đang gửi lệnh: khoá nút và chặn gửi lần hai. */
  dangGui: boolean
  /** Lỗi từ Kho (vd. bị từ chối) để hiện ngay trong hộp. */
  loi: string | null
  /** Người dùng gửi lý do (đã cắt khoảng trắng, không rỗng). */
  onGui: (lyDo: string) => void
  /** Đóng hộp mà không đổi gì (nút Đóng, nút X, phím Esc). */
  onDong: () => void
}

/**
 * Hộp nhập lý do cho các bước bắt buộc có lý do (Trả lại, Bị lỗi, Huỷ). Không cho gửi khi lý do
 * rỗng hay chỉ khoảng trắng. Hộp chỉ được dựng khi cần mở (đóng là tháo ra, ô nhập bắt đầu trống).
 */
export function HopNhapLyDo({ tieuDe, nhanGui, dangGui, loi, onGui, onDong }: Props) {
  const [lyDo, setLyDo] = useState('')
  const daNhap = lyDo.trim() !== ''
  const quaDai = lyDo.trim().length > DO_DAI_LY_DO_TOI_DA

  function gui() {
    if (dangGui || !daNhap || quaDai) return
    onGui(lyDo.trim())
  }

  return (
    <Dialog isOpen purpose="form" onOpenChange={(moLai) => !moLai && onDong()}>
      <DialogHeader title={tieuDe} onOpenChange={(moLai) => !moLai && onDong()} />
      <VStack gap={3} padding={4}>
        {loi && <Banner status="error" title="Chưa thực hiện được." description={loi} role="alert" />}
        <TextArea
          label="Lý do"
          description="Bắt buộc. Lý do được lưu vào lịch sử trạng thái của Task."
          isRequired
          hasAutoFocus
          value={lyDo}
          onChange={setLyDo}
          status={quaDai ? { type: 'error', message: THONG_BAO_CHUYEN_TRANG_THAI.lyDoQuaDai } : undefined}
        />
        <HStack gap={2} hAlign="end">
          <Button label="Đóng" variant="ghost" onClick={onDong} />
          <Button
            label={nhanGui}
            variant="primary"
            isDisabled={!daNhap || quaDai}
            isLoading={dangGui}
            onClick={gui}
          />
        </HStack>
      </VStack>
    </Dialog>
  )
}
