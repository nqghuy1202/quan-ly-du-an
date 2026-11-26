// @vitest-environment jsdom
// Ticket bố cục 01: Thanh bên, trang mở đầu Tổng quan, vùng tài khoản và trình đơn ở màn hẹp.
// Đi qua App với bản bộ nhớ của Kho; không mạng, không DB, đồng hồ cố định.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach } from 'vitest'
import { App } from '../App'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import type { Phien } from '../kho/khoDuLieu'
import { mucDieuHuong, type Trang } from '../luat/dieuHuong'
import { TEN_VAI, type VaiHeThong } from '../luat/taiKhoan'
import { TEN_UNG_DUNG } from '../tenUngDung'

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

/** Một vùng có thể tìm nút theo vai trò (Thanh bên hoặc trình đơn ở màn hẹp). */
type VungTim = { getAllByRole: (vaiTro: 'button') => HTMLElement[] }

/** Tiêu đề (cấp 2) của trang mà mỗi mục mở ra. */
const TIEU_DE_TRANG: Record<Trang, string> = {
  tongQuan: 'Tổng quan',
  viecCuaToi: 'Việc của tôi',
  choToiDuyet: 'Chờ tôi duyệt',
  duAn: 'Dự án của tôi',
  tatCaDuAn: 'Tất cả Dự án',
  nguoiDung: 'Người dùng',
  hoSo: 'Hồ sơ của tôi',
}

function giaTri<T>(kq: { ok: true; giaTri: T } | { ok: false; loi: { thongBao: string } }): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function phienCua(kho: KhoBoNho, email: string): Promise<Phien> {
  return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
}

/** Dựng Kho có PM ban đầu; thêm một tài khoản vai `vai` (trừ PM) và trả email để đăng nhập. */
async function dungKho(vai: VaiHeThong): Promise<{ kho: KhoBoNho; email: string; ten: string }> {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  if (vai === 'PM') return { kho, email: PM.email, ten: PM.tenHienThi }
  const email = 'binh@vi-du.vn'
  const ten = 'Bình'
  const hoSo = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten }))
  await kho.moPhong.xacNhanEmail(email)
  if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(await phienCua(kho, PM.email), hoSo.id, { vai }))
  return { kho, email, ten }
}

async function vaoKhung(vai: VaiHeThong) {
  const { kho, email, ten } = await dungKho(vai)
  const user = userEvent.setup()
  render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => LUC} />)
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  // Khung đã tải hồ sơ khi trang đầu hiện (ở màn hẹp, vùng tài khoản nằm trong trình đơn đang đóng).
  await screen.findByRole('heading', { level: 2, name: 'Tổng quan' })
  return { user, kho, ten }
}

function thanhBen() {
  return within(screen.getByRole('navigation', { name: 'Điều hướng chính' }))
}

/**
 * Chữ các mục trên Thanh bên (kể cả Hồ sơ ở chân), theo thứ tự hiện, không gồm Đăng xuất và nút
 * biểu tượng đóng trình đơn (không có chữ, chỉ có tên cho trình đọc màn hình).
 */
function cacMucTren(vung: VungTim): string[] {
  return vung
    .getAllByRole('button')
    .map((nut) => nut.textContent ?? '')
    .filter((chu) => chu !== '' && chu !== 'Đăng xuất')
}

function mucDangMo(vung: VungTim): string[] {
  return vung
    .getAllByRole('button')
    .filter((nut) => nut.getAttribute('aria-current') === 'page')
    .map((nut) => nut.textContent ?? '')
}

describe('trang mở đầu', () => {
  it.each<VaiHeThong>(['PM', 'SUPPORT', 'THANH_VIEN'])('%s đăng nhập xong vào thẳng Tổng quan, mục Tổng quan được đánh dấu', async (vai) => {
    await vaoKhung(vai)
    expect(await screen.findByRole('heading', { level: 2, name: 'Tổng quan' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 2, name: 'Dự án của tôi' })).not.toBeInTheDocument()
    expect(thanhBen().getByRole('button', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page')
    expect(mucDangMo(thanhBen())).toEqual(['Tổng quan'])
  })
})

describe('Thanh bên theo vai', () => {
  it.each<VaiHeThong>(['PM', 'SUPPORT', 'THANH_VIEN'])('%s thấy đúng các mục của luật điều hướng, theo thứ tự', async (vai) => {
    await vaoKhung(vai)
    expect(cacMucTren(thanhBen())).toEqual(mucDieuHuong(vai).map((m) => m.nhan))
  })

  it('PM thấy nhóm Công việc, Dự án và Quản trị với mục Người dùng', async () => {
    await vaoKhung('PM')
    for (const nhom of ['Công việc', 'Dự án', 'Quản trị']) expect(thanhBen().getByText(nhom)).toBeInTheDocument()
    expect(thanhBen().getByRole('button', { name: 'Người dùng' })).toBeInTheDocument()
    expect(thanhBen().getByRole('button', { name: 'Tất cả Dự án' })).toBeInTheDocument()
  })

  it('Support không thấy Tất cả Dự án, nhóm Quản trị và mục Người dùng', async () => {
    await vaoKhung('SUPPORT')
    expect(thanhBen().queryByRole('button', { name: 'Tất cả Dự án' })).not.toBeInTheDocument()
    expect(thanhBen().queryByRole('button', { name: 'Người dùng' })).not.toBeInTheDocument()
    expect(thanhBen().queryByText('Quản trị')).not.toBeInTheDocument()
  })

  it('Thành viên không thấy Tất cả Dự án và Người dùng', async () => {
    await vaoKhung('THANH_VIEN')
    expect(thanhBen().queryByRole('button', { name: 'Tất cả Dự án' })).not.toBeInTheDocument()
    expect(thanhBen().queryByRole('button', { name: 'Người dùng' })).not.toBeInTheDocument()
    expect(thanhBen().queryByText('Quản trị')).not.toBeInTheDocument()
  })
})

describe('bấm mục trên Thanh bên', () => {
  it('PM bấm lần lượt từng mục: mở đúng trang và chỉ mục đó được đánh dấu đang mở', async () => {
    const { user } = await vaoKhung('PM')
    await screen.findByRole('heading', { level: 2, name: 'Tổng quan' })
    // Đi theo thứ tự ngược để mục nào cũng được bấm khi đang ở trang khác.
    for (const muc of [...mucDieuHuong('PM')].reverse()) {
      await user.click(thanhBen().getByRole('button', { name: muc.nhan }))
      expect(await screen.findByRole('heading', { level: 2, name: TIEU_DE_TRANG[muc.trang] })).toBeInTheDocument()
      expect(thanhBen().getByRole('button', { name: muc.nhan })).toHaveAttribute('aria-current', 'page')
      expect(mucDangMo(thanhBen())).toEqual([muc.nhan])
    }
  })
})

describe('vùng tài khoản trên khung', () => {
  it.each<VaiHeThong>(['PM', 'SUPPORT', 'THANH_VIEN'])('%s: tên và vai hiện ở vùng tài khoản trong Thanh bên', async (vai) => {
    const { ten } = await vaoKhung(vai)
    const taiKhoan = within(screen.getByRole('group', { name: 'Tài khoản đang đăng nhập' }))
    expect(taiKhoan.getByText(ten)).toBeInTheDocument()
    expect(taiKhoan.getByText(TEN_VAI[vai])).toBeInTheDocument()
    expect(thanhBen().getByRole('group', { name: 'Tài khoản đang đăng nhập' })).toBeInTheDocument()
  })

  it('Hồ sơ ở vùng tài khoản mở màn Hồ sơ của tôi và được đánh dấu', async () => {
    const { user } = await vaoKhung('THANH_VIEN')
    const taiKhoan = within(screen.getByRole('group', { name: 'Tài khoản đang đăng nhập' }))
    await user.click(taiKhoan.getByRole('button', { name: 'Hồ sơ' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Hồ sơ của tôi' })).toBeInTheDocument()
    expect(taiKhoan.getByRole('button', { name: 'Hồ sơ' })).toHaveAttribute('aria-current', 'page')
  })

  it('Đăng xuất ở vùng tài khoản đưa về màn đăng nhập', async () => {
    const { user } = await vaoKhung('SUPPORT')
    const taiKhoan = within(screen.getByRole('group', { name: 'Tài khoản đang đăng nhập' }))
    await user.click(taiKhoan.getByRole('button', { name: 'Đăng xuất' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).not.toBeInTheDocument()
  })
})

describe('thương hiệu ở khung mới', () => {
  it('logo SDVICO và tên ứng dụng (tiêu đề cấp 1) nằm ở phần đầu khung, Thanh bên nằm ngoài phần đầu', async () => {
    await vaoKhung('PM')
    const dau = screen.getByRole('banner')
    expect(within(dau).getByRole('img', { name: 'SDVICO' })).toBeInTheDocument()
    expect(within(dau).getByRole('heading', { level: 1, name: TEN_UNG_DUNG })).toBeInTheDocument()
    expect(dau.contains(screen.getByRole('navigation', { name: 'Điều hướng chính' }))).toBe(false)
  })
})

describe('màn hẹp', () => {
  const matchMediaGoc = Object.getOwnPropertyDescriptor(window, 'matchMedia')

  /** Giả màn hẹp: mọi truy vấn "độ rộng dưới N px" đều đúng, truy vấn khác thì sai. */
  function giaManHep() {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: /width\s*<\s*\d/.test(query) || /max-width/.test(query),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    })
  }

  afterEach(() => {
    if (matchMediaGoc) Object.defineProperty(window, 'matchMedia', matchMediaGoc)
    else delete (window as { matchMedia?: unknown }).matchMedia
  })

  it.each<VaiHeThong>(['PM', 'SUPPORT', 'THANH_VIEN'])(
    '%s: Thanh bên thu thành nút mở trình đơn; mở ra thấy đủ các mục đúng theo vai',
    async (vai) => {
      giaManHep()
      const { user } = await vaoKhung(vai)
      // Thanh bên không còn nằm cạnh nội dung; chỉ còn nút mở trình đơn ở phần đầu.
      expect(screen.queryByRole('navigation', { name: 'Điều hướng chính' })).not.toBeInTheDocument()
      const nutMo = within(screen.getByRole('banner')).getByRole('button', { name: 'Mở điều hướng' })
      await user.click(nutMo)
      const trinhDon = within(await screen.findByRole('dialog'))
      expect(cacMucTren(trinhDon)).toEqual(mucDieuHuong(vai).map((m) => m.nhan))
      expect(trinhDon.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
      expect(trinhDon.getByRole('button', { name: 'Đóng điều hướng' })).toBeInTheDocument()
      expect(trinhDon.getByRole('button', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page')
    },
  )

  it('bấm một mục trong trình đơn thì mở đúng trang', async () => {
    giaManHep()
    const { user } = await vaoKhung('PM')
    await user.click(within(screen.getByRole('banner')).getByRole('button', { name: 'Mở điều hướng' }))
    const trinhDon = within(await screen.findByRole('dialog'))
    await user.click(trinhDon.getByRole('button', { name: 'Việc của tôi' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Việc của tôi' })).toBeInTheDocument()
  })

  it('logo và tên SDVICO vẫn ở phần đầu khi màn hẹp', async () => {
    giaManHep()
    await vaoKhung('THANH_VIEN')
    const dau = within(screen.getByRole('banner'))
    expect(dau.getByRole('img', { name: 'SDVICO' })).toBeInTheDocument()
    expect(dau.getByRole('heading', { level: 1, name: TEN_UNG_DUNG })).toBeInTheDocument()
  })
})
