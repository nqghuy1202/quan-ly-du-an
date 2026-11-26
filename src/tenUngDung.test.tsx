// @vitest-environment jsdom
// Ticket theme-02: tên "Quản lý dự án SDVICO" ở tiêu đề tab, đầu màn đăng nhập và đầu khung ứng dụng.
// Chỉ đọc file thuộc repo (`index.html`) qua Vite; không mạng, không DB, không đồng hồ thật.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { taoKhoBoNho } from './kho/khoBoNho'
import { TEN_UNG_DUNG } from './tenUngDung'

const TRANG_GOC = import.meta.glob('/index.html', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')

/** Các từ GLOSSARY.md ghi "Đừng viết" (và từ "project" thay cho Dự án). */
const TU_CAM = [/\bproject\b/i, /\bassignee\b/i, /\breviewer\b/i, /\bticket\b/i, /\bissue\b/i, /công việc/i, /audit log/i]

function dungApp() {
  const kho = taoKhoBoNho()
  const user = userEvent.setup()
  render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => LUC} />)
  return { kho, user }
}

async function vaoKhungUngDung() {
  const { kho, user } = dungApp()
  const dk = await kho.dangKy({ email: 'k@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'Khánh' })
  if (!dk.ok) throw new Error(dk.loi.thongBao)
  await kho.moPhong.xacNhanEmail('k@vi-du.vn')
  await user.type(screen.getByLabelText('Email'), 'k@vi-du.vn')
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  return within(await screen.findByRole('banner'))
}

function khongCoTuCam(vanBan: string) {
  for (const mau of TU_CAM) expect(vanBan).not.toMatch(mau)
}

describe('tên hiển thị của ứng dụng', () => {
  it('tên đã chốt là "Quản lý dự án SDVICO"', () => {
    expect(TEN_UNG_DUNG).toBe('Quản lý dự án SDVICO')
  })

  it('tiêu đề tab của trình duyệt (trang HTML gốc) là đúng tên đó, chỉ một thẻ title', () => {
    const html = TRANG_GOC['/index.html']
    expect(html).toBeDefined()
    const cacTieuDe = [...html.matchAll(/<title>([\s\S]*?)<\/title>/g)].map((m) => m[1].trim())
    expect(cacTieuDe).toEqual([TEN_UNG_DUNG])
  })

  it('màn đăng nhập hiện tên ở phần đầu màn, trước tiêu đề Đăng nhập; chữ cũ giữ nguyên', () => {
    dungApp()
    const ten = screen.getByText(TEN_UNG_DUNG)
    const tieuDe = screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })
    // Tên đứng trước tiêu đề của màn theo thứ tự tài liệu (phần đầu màn).
    expect(ten.compareDocumentPosition(tieuDe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Tiêu đề cấp 1 vẫn là tên của màn, chữ giới thiệu không đổi.
    expect(screen.getAllByRole('heading', { level: 1 }).map((h) => h.textContent)).toEqual(['Đăng nhập'])
    expect(screen.getByText('Quản lý dự án cho PM và Support.')).toBeInTheDocument()
  })

  it('tên ở màn đăng nhập không chen vào thứ tự phím Tab: Tab đầu tiên vẫn vào ô Email', async () => {
    const { user } = dungApp()
    await user.tab()
    expect(screen.getByLabelText('Email')).toHaveFocus()
  })

  it('các màn trước đăng nhập khác (Đăng ký) cũng giữ tên ở đầu và tiêu đề riêng của màn', async () => {
    const { user } = dungApp()
    await user.click(screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng ký' })).toBeInTheDocument()
    expect(screen.getByText(TEN_UNG_DUNG)).toBeInTheDocument()
  })

  it('đầu khung ứng dụng sau khi đăng nhập hiện tên là tiêu đề cấp 1, điều hướng giữ nguyên chữ', async () => {
    const dau = await vaoKhungUngDung()
    expect(dau.getByRole('heading', { level: 1 })).toHaveTextContent(TEN_UNG_DUNG)
    expect(screen.getAllByRole('heading', { level: 1, name: TEN_UNG_DUNG })).toHaveLength(1)
    const dieuHuong = within(dau.getByRole('navigation', { name: 'Điều hướng chính' }))
    expect(dieuHuong.getAllByRole('button').map((b) => b.textContent)).toEqual([
      'Tổng quan',
      'Dự án của tôi',
      'Việc của tôi',
      'Chờ tôi duyệt',
      'Hồ sơ',
      'Đăng xuất',
    ])
  })
})

describe('tên và chữ quanh tên dùng đúng bảng thuật ngữ', () => {
  it('tên giữ từ "dự án", không dùng từ bị cấm của GLOSSARY', () => {
    expect(TEN_UNG_DUNG).toMatch(/dự án/)
    khongCoTuCam(TEN_UNG_DUNG)
  })

  it('màn đăng nhập không có từ bị cấm của GLOSSARY', () => {
    dungApp()
    khongCoTuCam(document.body.textContent ?? '')
  })

  it('đầu khung ứng dụng không có từ bị cấm của GLOSSARY', async () => {
    await vaoKhungUngDung()
    const vanBan = screen.getByRole('banner').textContent ?? ''
    expect(vanBan).toContain('Dự án của tôi')
    khongCoTuCam(vanBan)
  })
})
