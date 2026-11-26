// @vitest-environment jsdom
// Ticket theme-03: logo SDVICO ở đầu màn đăng nhập và đầu khung ứng dụng, văn bản thay thế "SDVICO",
// không làm vỡ trạng thái trống, đang tải, lỗi hay thứ tự phím Tab. Không mạng, không DB, đồng hồ cố định.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { App } from './App'
import { themes } from './astryx-themes'
import { thatBai } from './kho/ketQua'
import type { KhoDuLieu } from './kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from './kho/khoBoNho'
import { ThuongHieu } from './giaoDien/ThuongHieu'
import { TEN_UNG_DUNG } from './tenUngDung'
import logoSdvico from './assets/sdvico-logo.png'

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const CAU_MAN_TRONG = /bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn/i

function dungApp(goc: KhoBoNho = taoKhoBoNho(), kho: KhoDuLieu = goc) {
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={goc.moPhong} dongHo={() => LUC} />)
  return { user, goc, ungDung: within(container) }
}

async function dangKyDaXacNhan(kho: KhoBoNho, email: string) {
  const kq = await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Khánh' })
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  await kho.moPhong.xacNhanEmail(email)
}

async function dangNhap(user: ReturnType<typeof userEvent.setup>, email: string, matKhau = MAT_KHAU) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), matKhau)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
}

/** Logo: một hình có văn bản thay thế "SDVICO", vẽ đúng file logo của repo. */
function kiemLogo(logo: HTMLElement) {
  expect(logo).toHaveAccessibleName('SDVICO')
  const anh = logo.querySelector('img')
  expect(anh).not.toBeNull()
  expect(anh?.getAttribute('src')).toBe(logoSdvico)
  // Hình tĩnh: không nhận focus, không chen vào thứ tự phím Tab.
  expect(logo).not.toHaveAttribute('tabindex')
  expect(logo.closest('a, button')).toBeNull()
}

describe('logo SDVICO ở màn đăng nhập', () => {
  it('hiện logo với văn bản thay thế "SDVICO" ở đầu màn, trước tên và tiêu đề Đăng nhập', () => {
    dungApp()
    const logo = screen.getByRole('img', { name: 'SDVICO' })
    kiemLogo(logo)
    const ten = screen.getByText(TEN_UNG_DUNG)
    const tieuDe = screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })
    expect(logo.compareDocumentPosition(ten) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(logo.compareDocumentPosition(tieuDe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('img', { name: 'SDVICO' })).toHaveLength(1)
  })

  it('các màn trước đăng nhập khác (Đăng ký) cũng có logo', async () => {
    const { user } = dungApp()
    await user.click(screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng ký' })).toBeInTheDocument()
    kiemLogo(screen.getByRole('img', { name: 'SDVICO' }))
  })

  it('thứ tự phím Tab không đổi: Tab đầu vào ô Email, rồi Mật khẩu', async () => {
    const { user } = dungApp()
    await user.tab()
    expect(screen.getByLabelText('Email')).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('Mật khẩu')).toHaveFocus()
  })

  it('lỗi đăng nhập vẫn hiện thông báo lỗi cạnh logo', async () => {
    const { user, ungDung } = dungApp()
    await dangNhap(user, 'chua-co@vi-du.vn')
    await waitFor(() => expect(ungDung.getByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.'))
    expect(screen.getByRole('img', { name: 'SDVICO' })).toBeInTheDocument()
  })
})

describe('logo SDVICO ở đầu khung ứng dụng', () => {
  it('đầu khung sau khi đăng nhập hiện logo "SDVICO" cạnh tên tiêu đề cấp 1, tên tiêu đề không đổi', async () => {
    const { user, goc } = dungApp()
    await dangKyDaXacNhan(goc, 'k@vi-du.vn')
    await dangNhap(user, 'k@vi-du.vn')
    const dau = within(await screen.findByRole('banner'))
    const logo = dau.getByRole('img', { name: 'SDVICO' })
    kiemLogo(logo)
    const tieuDe = dau.getByRole('heading', { level: 1 })
    expect(tieuDe).toHaveAccessibleName(TEN_UNG_DUNG)
    expect(logo.compareDocumentPosition(tieuDe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByRole('img', { name: 'SDVICO' })).toHaveLength(1)
  })

  it('trạng thái trống của trang Dự án của tôi vẫn hiện, cùng logo ở đầu', async () => {
    const { user, goc } = dungApp()
    await dangKyDaXacNhan(goc, 'tr@vi-du.vn')
    await dangNhap(user, 'tr@vi-du.vn')
    expect(await screen.findByRole('heading', { name: CAU_MAN_TRONG })).toBeInTheDocument()
    expect(within(screen.getByRole('banner')).getByRole('img', { name: 'SDVICO' })).toBeInTheDocument()
  })

  it('thứ tự phím Tab trong đầu khung không đổi: logo bị bỏ qua, đi lần lượt các nút điều hướng', async () => {
    const { user, goc } = dungApp()
    await dangKyDaXacNhan(goc, 'tab@vi-du.vn')
    await dangNhap(user, 'tab@vi-du.vn')
    const dau = await screen.findByRole('banner')
    await screen.findByRole('heading', { name: CAU_MAN_TRONG })
    ;(document.activeElement as HTMLElement | null)?.blur()
    const thuTu: string[] = []
    for (let i = 0; i < 6; i++) {
      await user.tab()
      const dangFocus = document.activeElement as HTMLElement
      expect(dau.contains(dangFocus)).toBe(true)
      thuTu.push(dangFocus.textContent ?? '')
    }
    expect(thuTu).toEqual(['Tổng quan', 'Dự án của tôi', 'Việc của tôi', 'Chờ tôi duyệt', 'Hồ sơ', 'Đăng xuất'])
  })

  it('trạng thái đang tải hồ sơ vẫn hiện như trước', async () => {
    const goc = taoKhoBoNho()
    const kho: KhoDuLieu = { ...goc, layHoSoCuaToi: () => new Promise(() => {}) }
    const { user } = dungApp(goc, kho)
    await dangKyDaXacNhan(goc, 'tai@vi-du.vn')
    await dangNhap(user, 'tai@vi-du.vn')
    expect(await screen.findByRole('progressbar', { name: 'Đang tải hồ sơ…' })).toBeInTheDocument()
  })

  it('lỗi tải hồ sơ vẫn hiện thông báo và nút Thử lại như trước', async () => {
    const goc = taoKhoBoNho()
    const kho: KhoDuLieu = { ...goc, layHoSoCuaToi: async () => thatBai('KHONG_TIM_THAY') }
    const { user, ungDung } = dungApp(goc, kho)
    await dangKyDaXacNhan(goc, 'loi@vi-du.vn')
    await dangNhap(user, 'loi@vi-du.vn')
    expect(await ungDung.findByRole('alert')).toHaveTextContent('Không tải được hồ sơ của bạn.')
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
  })
})

describe('logo SDVICO ở chế độ tối', () => {
  it('phần đầu dùng chung hiện đúng logo và văn bản thay thế khi theme sdvico ở chế độ tối', () => {
    const { container } = render(
      <Theme theme={themes.sdvico} mode="dark">
        <ThuongHieu laTieuDeTrang />
      </Theme>,
    )
    expect(container.querySelector('[data-astryx-theme]')).toHaveAttribute('data-theme', 'dark')
    kiemLogo(screen.getByRole('img', { name: 'SDVICO' }))
  })
})
