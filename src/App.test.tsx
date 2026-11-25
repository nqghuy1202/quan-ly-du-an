// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { thatBai, thanhCong } from './kho/ketQua'
import type { KhoDuLieu } from './kho/khoDuLieu'
import { taoKhoBoNho } from './kho/khoBoNho'
import { THONG_BAO } from './luat/taiKhoan'

const MAT_KHAU = 'matkhau-123'
const CAU_MAN_TRONG = /bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn/i

function dungApp(kho: KhoDuLieu = taoKhoBoNho()) {
  const user = userEvent.setup()
  render(<App kho={kho} />)
  return { user, kho }
}

async function dangNhapQuaGiaoDien(user: ReturnType<typeof userEvent.setup>, email: string, matKhau = MAT_KHAU) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), matKhau)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
}

function vungTaiKhoan() {
  return within(screen.getByRole('group', { name: 'Tài khoản đang đăng nhập' }))
}

describe('màn đăng nhập và đăng ký', () => {
  it('người mới mở ứng dụng thấy màn đăng nhập tiếng Việt và chuyển được sang đăng ký', async () => {
    const { user } = dungApp()
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }))
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng ký' })).toBeInTheDocument()
    expect(screen.getByLabelText('Tên hiển thị')).toBeInTheDocument()
  })

  it('đăng ký hợp lệ thì vào khung ứng dụng, thấy tên, vai Thành viên và màn trống', async () => {
    const { user } = dungApp()
    await user.click(screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }))
    await user.type(screen.getByLabelText('Email'), 'an@vi-du.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
    await user.type(screen.getByLabelText('Tên hiển thị'), 'An Nguyễn')
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }))

    await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
    expect(vungTaiKhoan().getByText('An Nguyễn')).toBeInTheDocument()
    expect(vungTaiKhoan().getByText('Thành viên')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: CAU_MAN_TRONG })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeInTheDocument()
  })

  it.each([
    ['email sai định dạng', 'khong-phai-email', MAT_KHAU, 'Chi', THONG_BAO.emailSai],
    ['mật khẩu ngắn', 'chi@vi-du.vn', '1234567', 'Chi', THONG_BAO.matKhauNgan],
    ['tên chỉ toàn khoảng trắng', 'chi@vi-du.vn', MAT_KHAU, '   ', THONG_BAO.tenTrong],
  ])('đăng ký với %s bị từ chối kèm thông báo tiếng Việt, không tạo gì', async (_ca, email, matKhau, ten, thongBao) => {
    const { user, kho } = dungApp()
    await user.click(screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }))
    await user.type(screen.getByLabelText('Email'), email)
    await user.type(screen.getByLabelText('Mật khẩu'), matKhau)
    await user.type(screen.getByLabelText('Tên hiển thị'), ten)
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }))

    expect((await screen.findAllByText(thongBao)).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 1, name: 'Đăng ký' })).toBeInTheDocument()
    expect((await kho.dangNhap({ email, matKhau })).ok).toBe(false)
  })

  it('email đã dùng (khác hoa thường) báo lỗi tiếng Việt', async () => {
    const { user, kho } = dungApp()
    await kho.dangKy({ email: 'binh@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'Bình' })
    await user.click(screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }))
    await user.type(screen.getByLabelText('Email'), 'BINH@vi-du.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
    await user.type(screen.getByLabelText('Tên hiển thị'), 'Bình khác')
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Email này đã được dùng để đăng ký.')
  })

  it('sai mật khẩu và email chưa đăng ký hiện cùng một thông báo chung', async () => {
    const { user, kho } = dungApp()
    await kho.dangKy({ email: 'ha@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'Hà' })

    await dangNhapQuaGiaoDien(user, 'ha@vi-du.vn', 'sai-mat-khau')
    const thongBaoSaiMatKhau = (await screen.findByRole('alert')).textContent

    await user.clear(screen.getByLabelText('Email'))
    await user.clear(screen.getByLabelText('Mật khẩu'))
    await dangNhapQuaGiaoDien(user, 'chua-co@vi-du.vn')
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert').textContent).toBe(thongBaoSaiMatKhau)
    expect(thongBaoSaiMatKhau).toContain('Email hoặc mật khẩu không đúng.')
  })
})

describe('khung ứng dụng', () => {
  it('đăng nhập thì thấy tên và vai; đăng xuất thì về màn đăng nhập', async () => {
    const { user, kho } = dungApp()
    await kho.dangKy({ email: 'dung@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'Dũng' })
    await dangNhapQuaGiaoDien(user, 'dung@vi-du.vn')

    await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
    expect(vungTaiKhoan().getByText('Dũng')).toBeInTheDocument()
    expect(vungTaiKhoan().getByText('Thành viên')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Tài khoản đang đăng nhập' })).not.toBeInTheDocument()
  })

  it('hiện trạng thái đang tải khi hồ sơ chưa về', async () => {
    const goc = taoKhoBoNho()
    const kho: KhoDuLieu = { ...goc, layHoSoCuaToi: () => new Promise(() => {}) }
    const { user } = dungApp(kho)
    await goc.dangKy({ email: 'e@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'E' })
    await dangNhapQuaGiaoDien(user, 'e@vi-du.vn')
    expect(await screen.findByRole('progressbar', { name: 'Đang tải hồ sơ…' })).toBeInTheDocument()
  })

  it('lỗi tải danh sách Dự án hiện thông báo và thử lại được', async () => {
    const goc = taoKhoBoNho()
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      danhSachDuAnCuaToi: async (phien) => {
        lanGoi += 1
        return lanGoi === 1 ? thatBai('KHONG_TIM_THAY') : goc.danhSachDuAnCuaToi(phien)
      },
    }
    const { user } = dungApp(kho)
    await goc.dangKy({ email: 'g@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'G' })
    await dangNhapQuaGiaoDien(user, 'g@vi-du.vn')

    expect(await screen.findByRole('alert')).toHaveTextContent('Không tải được danh sách Dự án.')
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('heading', { name: CAU_MAN_TRONG })).toBeInTheDocument()
  })

  it('đang tải danh sách Dự án thì hiện trạng thái đang tải', async () => {
    const goc = taoKhoBoNho()
    const kho: KhoDuLieu = { ...goc, danhSachDuAnCuaToi: () => new Promise(() => {}) }
    const { user } = dungApp(kho)
    await goc.dangKy({ email: 'h@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'H' })
    await dangNhapQuaGiaoDien(user, 'h@vi-du.vn')
    expect(await screen.findByRole('progressbar', { name: 'Đang tải danh sách Dự án…' })).toBeInTheDocument()
  })

  it('phiên hết hạn giữa chừng thì quay về màn đăng nhập', async () => {
    const goc = taoKhoBoNho()
    const kho: KhoDuLieu = { ...goc, danhSachDuAnCuaToi: async () => thatBai('CHUA_DANG_NHAP') }
    const { user } = dungApp(kho)
    await goc.dangKy({ email: 'i@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'I' })
    await dangNhapQuaGiaoDien(user, 'i@vi-du.vn')
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
  })
})

describe('màn hồ sơ', () => {
  async function moHoSo() {
    const ctx = dungApp()
    await ctx.kho.dangKy({ email: 'lan@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'Lan' })
    await dangNhapQuaGiaoDien(ctx.user, 'lan@vi-du.vn')
    await ctx.user.click(await screen.findByRole('button', { name: 'Hồ sơ' }))
    await screen.findByRole('heading', { level: 2, name: 'Hồ sơ của tôi' })
    return ctx
  }

  it('sửa tên hiển thị và GitHub username thì lưu và khung cập nhật tên', async () => {
    const { user, kho } = await moHoSo()
    await user.clear(screen.getByLabelText('Tên hiển thị'))
    await user.type(screen.getByLabelText('Tên hiển thị'), 'Lan Trần')
    await user.type(screen.getByLabelText('GitHub username'), 'lan-tran')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))

    expect(await screen.findByText('Đã lưu hồ sơ.')).toBeInTheDocument()
    expect(vungTaiKhoan().getByText('Lan Trần')).toBeInTheDocument()

    const phien = await kho.dangNhap({ email: 'lan@vi-du.vn', matKhau: MAT_KHAU })
    if (!phien.ok) throw new Error('không đăng nhập được')
    expect(await kho.layHoSoCuaToi(phien.giaTri)).toEqual(
      thanhCong(expect.objectContaining({ tenHienThi: 'Lan Trần', githubUsername: 'lan-tran' })),
    )
  })

  it('GitHub username sai định dạng bị từ chối kèm thông báo tiếng Việt', async () => {
    const { user } = await moHoSo()
    await user.type(screen.getByLabelText('GitHub username'), '-sai-')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    expect((await screen.findAllByText(THONG_BAO.githubSai)).length).toBeGreaterThan(0)
    expect(screen.queryByText('Đã lưu hồ sơ.')).not.toBeInTheDocument()
  })

  it('tên hiển thị toàn khoảng trắng bị từ chối và tên trên khung không đổi', async () => {
    const { user } = await moHoSo()
    await user.clear(screen.getByLabelText('Tên hiển thị'))
    await user.type(screen.getByLabelText('Tên hiển thị'), '   ')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    expect((await screen.findAllByText(THONG_BAO.tenTrong)).length).toBeGreaterThan(0)
    expect(vungTaiKhoan().getByText('Lan')).toBeInTheDocument()
  })
})

describe('điều hướng bằng phím', () => {
  it('đi qua và dùng được mọi điều khiển bằng Tab, Enter', async () => {
    const { user, kho } = dungApp()
    await kho.dangKy({ email: 'k@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'Khánh' })

    // Màn đăng nhập: Email → Mật khẩu → Đăng nhập → Đăng ký.
    await user.tab()
    expect(screen.getByLabelText('Email')).toHaveFocus()
    await user.keyboard('k@vi-du.vn')
    await user.tab()
    expect(screen.getByLabelText('Mật khẩu')).toHaveFocus()
    await user.keyboard(MAT_KHAU)
    await user.tab()
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' })).toHaveFocus()

    // Quay lại nút Đăng nhập và bấm bằng Enter.
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })

    // Khung: Dự án của tôi → Hồ sơ → Đăng xuất.
    await user.tab()
    expect(screen.getByRole('button', { name: 'Dự án của tôi' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Hồ sơ' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await screen.findByRole('heading', { level: 2, name: 'Hồ sơ của tôi' })

    // Màn hồ sơ: tới ô Tên hiển thị, GitHub username và nút Lưu bằng Tab.
    await user.tab()
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toHaveFocus()
    await user.tab() // Email (chỉ đọc)
    await user.tab() // Vai (chỉ đọc)
    await user.tab()
    expect(screen.getByLabelText('Tên hiển thị')).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('GitHub username')).toHaveFocus()
    await user.keyboard('khanh-gh')
    await user.tab()
    expect(screen.getByRole('button', { name: 'Lưu hồ sơ' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Đã lưu hồ sơ.')).toBeInTheDocument()

    // Đăng xuất bằng phím.
    screen.getByRole('button', { name: 'Đăng xuất' }).focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
  })

  it('đăng ký đi được bằng phím: Enter trong ô cuối gửi biểu mẫu', async () => {
    const { user } = dungApp()
    await user.tab()
    await user.tab()
    await user.tab()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await screen.findByRole('heading', { level: 1, name: 'Đăng ký' })

    screen.getByLabelText('Email').focus()
    await user.keyboard('moi@vi-du.vn')
    await user.tab()
    await user.keyboard(MAT_KHAU)
    await user.tab()
    expect(screen.getByLabelText('Tên hiển thị')).toHaveFocus()
    await user.keyboard('Người Mới{Enter}')
    await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
    expect(vungTaiKhoan().getByText('Người Mới')).toBeInTheDocument()
  })
})
