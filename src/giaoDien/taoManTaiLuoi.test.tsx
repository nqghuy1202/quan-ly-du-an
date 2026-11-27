// @vitest-environment jsdom
// Ticket tối ưu hiệu năng 07: màn tải lười khi phần mã tải lỗi (thông báo tiếng Việt, nút Thử lại
// dùng được bằng bàn phím) và khi Thử lại thành công. Hàm nạp giả, không mạng, không đồng hồ thật.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Text } from '@astryxdesign/core/Text'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from '../astryx-themes'
import { taoManTaiLuoi } from './taoManTaiLuoi'

function ManThu({ ten }: { ten: string }) {
  return <Text>Nội dung màn của {ten}</Text>
}

/** Hàm nạp giả: lần đầu lỗi như mất mạng, các lần sau trả màn. */
function napLoiLanDau() {
  // React ghi lỗi bị error boundary bắt ra console; lỗi này là chủ ý nên không in.
  vi.spyOn(console, 'error').mockImplementation(() => {})
  let soLan = 0
  const nap = vi.fn(async () => {
    soLan += 1
    if (soLan === 1) throw new TypeError('Failed to fetch dynamically imported module')
    return ManThu
  })
  return nap
}

function ve(Man: ReturnType<typeof taoManTaiLuoi<{ ten: string }>>) {
  return render(
    <Theme theme={themes[defaultThemeSlug]} mode="light">
      <Man ten="Bình" />
    </Theme>,
  )
}

describe('màn tải lười', () => {
  it('tải lỗi: thấy thông báo tiếng Việt và nút Thử lại; bấm Thử lại mà tải được thì thấy nội dung màn', async () => {
    const nap = napLoiLanDau()
    const Man = taoManTaiLuoi(nap, 'Hồ sơ')
    const user = userEvent.setup()
    ve(Man)

    // Astryx có sẵn vùng thông báo (alert) rỗng trong body; lấy cảnh báo có chữ lỗi.
    const canhBao = await waitFor(() => {
      const thay = screen.getAllByRole('alert').find((a) => a.textContent?.includes('Không tải được'))
      if (!thay) throw new Error('Không thấy cảnh báo lỗi tải')
      return thay
    })
    expect(within(canhBao).getByText('Không tải được màn Hồ sơ.')).toBeInTheDocument()
    expect(within(canhBao).getByText('Kiểm tra kết nối mạng rồi bấm Thử lại.')).toBeInTheDocument()
    expect(screen.queryByText(/Nội dung màn/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Nội dung màn của Bình')).toBeInTheDocument()
    expect(screen.queryByText('Không tải được màn Hồ sơ.')).not.toBeInTheDocument()
    expect(nap).toHaveBeenCalledTimes(2)
  })

  it('nút Thử lại tới được bằng phím Tab (nhận focus bàn phím, thấy focus ring) và bấm được bằng Enter', async () => {
    const nap = napLoiLanDau()
    const Man = taoManTaiLuoi(nap, 'Người dùng')
    const user = userEvent.setup()
    ve(Man)

    const thuLai = await screen.findByRole('button', { name: 'Thử lại' })
    await user.tab()
    expect(thuLai).toHaveFocus()
    // Nút Thử lại là Button của Astryx (focus ring của theme khi focus bằng bàn phím), không bị tắt.
    expect(thuLai).not.toBeDisabled()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Nội dung màn của Bình')).toBeInTheDocument()
  })

  it('đang tải thì hiện "Đang tải màn …", tải xong thì thay bằng nội dung', async () => {
    let traMan: (man: typeof ManThu) => void = () => {}
    const Man = taoManTaiLuoi(
      () =>
        new Promise<typeof ManThu>((xong) => {
          traMan = xong
        }),
      'Tổng quan',
    )
    ve(Man)

    expect(await screen.findByRole('progressbar', { name: 'Đang tải màn Tổng quan…' })).toBeInTheDocument()
    traMan(ManThu)
    expect(await screen.findByText('Nội dung màn của Bình')).toBeInTheDocument()
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })

  it('đã tải xong thì vẽ lại ở chỗ khác không nạp lại', async () => {
    const nap = vi.fn(async () => ManThu)
    const Man = taoManTaiLuoi(nap, 'Hồ sơ')
    const { unmount } = ve(Man)
    expect(await screen.findByText('Nội dung màn của Bình')).toBeInTheDocument()
    unmount()
    ve(Man)
    expect(await screen.findByText('Nội dung màn của Bình')).toBeInTheDocument()
    expect(nap).toHaveBeenCalledTimes(1)
  })
})
