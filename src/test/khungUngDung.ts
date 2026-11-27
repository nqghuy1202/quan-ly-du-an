// Tiện ích dùng chung cho test giao diện đi qua khung ứng dụng (chỉ test dùng).
import { screen, waitFor, within } from '@testing-library/react'
import { expect } from 'vitest'

/**
 * Chờ trang đầu sau đăng nhập (Tổng quan) tải xong. Tổng quan đọc Dự án và Task qua Kho ngay khi mở,
 * nên test đếm số lần gọi Kho để giả lỗi chỉ bắt đầu đếm sau bước này.
 */
export async function choTongQuanTaiXong() {
  await screen.findByRole('heading', { level: 2, name: 'Tổng quan' })
  await waitFor(() =>
    expect(screen.queryByRole('progressbar', { name: 'Đang tải tổng quan…' })).not.toBeInTheDocument(),
  )
}

/** Tên bốn tab của trang chi tiết Dự án. */
export type TabChiTietDuAn = 'Task' | 'Người trong dự án' | 'Thông tin' | 'GitHub'

/** Bấm một tab ở trang chi tiết Dự án và chờ tab đó được chọn. */
export async function moTabDuAn(user: { click: (phanTu: Element) => Promise<void> }, ten: TabChiTietDuAn) {
  await user.click(await screen.findByRole('tab', { name: ten }))
  await waitFor(() => expect(screen.getByRole('tab', { name: ten })).toHaveAttribute('aria-selected', 'true'))
}

/** Ngăn trượt đang mở có tiêu đề `tieuDe` (tiêu đề cũng là tên của ngăn). */
export async function choNganTruot(tieuDe: string): Promise<HTMLElement> {
  return screen.findByRole('dialog', { name: tieuDe })
}

/** Tên ba tab phía dưới của ngăn Task. */
export type TabNganTask = 'Lịch sử' | 'Link GitHub' | 'Sửa'

/** Bấm một tab trong ngăn Task và chờ tab đó được chọn. */
export async function moTabTask(user: { click: (phanTu: Element) => Promise<void> }, ten: TabNganTask) {
  const dsTab = await screen.findByRole('tablist', { name: 'Các phần của Task' })
  await user.click(await within(dsTab).findByRole('tab', { name: ten }))
  await waitFor(() => expect(within(dsTab).getByRole('tab', { name: ten })).toHaveAttribute('aria-selected', 'true'))
}

/** Đóng Ngăn trượt bằng nút đóng ở đầu ngăn và chờ ngăn đóng hẳn. */
export async function dongNganTruot(user: { click: (phanTu: Element) => Promise<void> }) {
  await user.click(screen.getByRole('button', { name: 'Đóng Ngăn trượt' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}
