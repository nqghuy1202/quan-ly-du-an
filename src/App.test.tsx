// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from './App'
import { THONG_BAO_MAC_DINH, thatBai, thanhCong } from './kho/ketQua'
import type { KhoDuLieu } from './kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from './kho/khoBoNho'
import { THONG_BAO } from './luat/taiKhoan'

const MAT_KHAU = 'matkhau-123'
const CAU_MAN_TRONG = /bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn/i
const LUC = new Date('2026-03-01T08:00:00+07:00')

/**
 * Dựng ứng dụng với bản bộ nhớ `goc` (kèm hộp thư mô phỏng của nó). `kho` là Kho mà ứng dụng
 * dùng, mặc định chính là `goc`; test bọc `goc` để giả lỗi hoặc đang tải.
 */
function dungApp(goc: KhoBoNho = taoKhoBoNho(), kho: KhoDuLieu = goc) {
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={goc.moPhong} dongHo={() => LUC} />)
  // Astryx gắn vùng thông báo (live region, role="alert") thẳng vào body, ngoài vùng render;
  // tìm cảnh báo trong vùng của ứng dụng để chỉ lấy Banner lỗi trên màn.
  const ungDung = within(container)
  return { user, kho: goc, ungDung }
}

/** Đăng ký thẳng qua Kho và xác nhận email (bước mô phỏng), để vào thẳng phần sau đăng nhập. */
async function dangKyDaXacNhan(kho: KhoBoNho, email: string, tenHienThi: string) {
  const kq = await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi })
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  await kho.moPhong.xacNhanEmail(email)
}

async function dangNhapQuaGiaoDien(user: ReturnType<typeof userEvent.setup>, email: string, matKhau = MAT_KHAU) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), matKhau)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
}

/** Mở một mục trên Thanh bên (chờ khung tải hồ sơ xong). */
async function moMuc(user: ReturnType<typeof userEvent.setup>, nhan: string) {
  await user.click(await screen.findByRole('button', { name: nhan }))
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

  it('đăng ký hợp lệ thì sang màn chờ xác nhận; xác nhận xong đăng nhập vào khung, thấy tên, vai và màn trống', async () => {
    const { user, ungDung } = dungApp()
    await user.click(screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }))
    await user.type(screen.getByLabelText('Email'), 'An@Vi-Du.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
    await user.type(screen.getByLabelText('Tên hiển thị'), 'An Nguyễn')
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }))

    // Chưa vào khung: phải xác nhận email trước.
    expect(await screen.findByRole('heading', { level: 1, name: 'Xác nhận email' })).toBeInTheDocument()
    expect(ungDung.getByText(/an@vi-du\.vn/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Tài khoản đang đăng nhập' })).not.toBeInTheDocument()

    // Bước mô phỏng thay cho bấm đường dẫn trong thư.
    await user.click(screen.getByRole('button', { name: 'Xác nhận email (mô phỏng)' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
    expect(ungDung.getByText(THONG_BAO.daXacNhanEmail)).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('an@vi-du.vn')

    await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))

    await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
    expect(vungTaiKhoan().getByText('An Nguyễn')).toBeInTheDocument()
    expect(vungTaiKhoan().getByText('Thành viên')).toBeInTheDocument()
    // Trang đầu là Tổng quan; màn trống của Dự án của tôi mở từ Thanh bên.
    expect(await screen.findByRole('heading', { level: 2, name: 'Tổng quan' })).toBeInTheDocument()
    await moMuc(user, 'Dự án của tôi')
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
    const { user, kho, ungDung } = dungApp()
    await kho.dangKy({ email: 'binh@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'Bình' })
    await user.click(screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }))
    await user.type(screen.getByLabelText('Email'), 'BINH@vi-du.vn')
    await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
    await user.type(screen.getByLabelText('Tên hiển thị'), 'Bình khác')
    await user.click(screen.getByRole('button', { name: 'Đăng ký' }))

    expect(await ungDung.findByRole('alert')).toHaveTextContent('Email này đã được dùng để đăng ký.')
  })

  it('sai mật khẩu và email chưa đăng ký hiện cùng một thông báo chung', async () => {
    const { user, kho, ungDung } = dungApp()
    await dangKyDaXacNhan(kho, 'ha@vi-du.vn', 'Hà')

    await dangNhapQuaGiaoDien(user, 'ha@vi-du.vn', 'sai-mat-khau')
    const thongBaoSaiMatKhau = (await ungDung.findByRole('alert')).textContent

    await user.clear(screen.getByLabelText('Email'))
    await user.clear(screen.getByLabelText('Mật khẩu'))
    await dangNhapQuaGiaoDien(user, 'chua-co@vi-du.vn')
    await waitFor(() => expect(ungDung.getByRole('alert')).toBeInTheDocument())
    expect(ungDung.getByRole('alert').textContent).toBe(thongBaoSaiMatKhau)
    expect(thongBaoSaiMatKhau).toContain('Email hoặc mật khẩu không đúng.')
  })
})

describe('khung ứng dụng', () => {
  it('đăng nhập thì thấy tên và vai; đăng xuất thì về màn đăng nhập', async () => {
    const { user, kho } = dungApp()
    await dangKyDaXacNhan(kho, 'dung@vi-du.vn', 'Dũng')
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
    const { user } = dungApp(goc, kho)
    await dangKyDaXacNhan(goc, 'e@vi-du.vn', 'E')
    await dangNhapQuaGiaoDien(user, 'e@vi-du.vn')
    expect(await screen.findByRole('progressbar', { name: 'Đang tải hồ sơ…' })).toBeInTheDocument()
  })

  it('lỗi tải danh sách Dự án hiện thông báo và thử lại được', async () => {
    const goc = taoKhoBoNho()
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      danhSachDuAnKemSoLieu: async (phien, phamVi, bayGio) => {
        lanGoi += 1
        return lanGoi === 1 ? thatBai('KHONG_TIM_THAY') : goc.danhSachDuAnKemSoLieu(phien, phamVi, bayGio)
      },
    }
    const { user, ungDung } = dungApp(goc, kho)
    await dangKyDaXacNhan(goc, 'g@vi-du.vn', 'G')
    await dangNhapQuaGiaoDien(user, 'g@vi-du.vn')
    await moMuc(user, 'Dự án của tôi')

    expect(await ungDung.findByRole('alert')).toHaveTextContent('Không tải được danh sách Dự án.')
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('heading', { name: CAU_MAN_TRONG })).toBeInTheDocument()
  })

  it('đang tải danh sách Dự án thì hiện trạng thái đang tải', async () => {
    const goc = taoKhoBoNho()
    const kho: KhoDuLieu = { ...goc, danhSachDuAnKemSoLieu: () => new Promise(() => {}) }
    const { user } = dungApp(goc, kho)
    await dangKyDaXacNhan(goc, 'h@vi-du.vn', 'H')
    await dangNhapQuaGiaoDien(user, 'h@vi-du.vn')
    await moMuc(user, 'Dự án của tôi')
    expect(await screen.findByRole('progressbar', { name: 'Đang tải danh sách Dự án…' })).toBeInTheDocument()
  })

  it('phiên hết hạn giữa chừng thì quay về màn đăng nhập', async () => {
    const goc = taoKhoBoNho()
    const kho: KhoDuLieu = { ...goc, danhSachDuAnKemSoLieu: async () => thatBai('CHUA_DANG_NHAP') }
    const { user } = dungApp(goc, kho)
    await dangKyDaXacNhan(goc, 'i@vi-du.vn', 'I')
    await dangNhapQuaGiaoDien(user, 'i@vi-du.vn')
    await moMuc(user, 'Dự án của tôi')
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
  })
})

describe('màn hồ sơ', () => {
  async function moHoSo() {
    const ctx = dungApp()
    await dangKyDaXacNhan(ctx.kho, 'lan@vi-du.vn', 'Lan')
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

describe('xác nhận email trên giao diện', () => {
  it('đăng nhập khi chưa xác nhận thì bị từ chối, hiện cách gửi lại thư; gửi lại xong về màn chờ xác nhận', async () => {
    const { user, kho, ungDung } = dungApp()
    await kho.dangKy({ email: 'xuan@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'Xuân' })

    await dangNhapQuaGiaoDien(user, 'xuan@vi-du.vn')
    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.EMAIL_CHUA_XAC_NHAN)
    expect(screen.queryByRole('group', { name: 'Tài khoản đang đăng nhập' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Gửi lại thư xác nhận' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Gửi lại thư xác nhận' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveValue('xuan@vi-du.vn')

    await user.click(screen.getByRole('button', { name: 'Gửi lại thư' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Xác nhận email' })).toBeInTheDocument()
    expect(ungDung.getByText(THONG_BAO.daGuiLaiThuXacNhan)).toBeInTheDocument()
    expect(kho.moPhong.thuGuiToi('xuan@vi-du.vn').filter((t) => t.loai === 'XAC_NHAN_EMAIL')).toHaveLength(2)
  })

  it('đăng nhập sai mật khẩu khi chưa xác nhận không hiện cách gửi lại thư (không lộ gì)', async () => {
    const { user, kho, ungDung } = dungApp()
    await kho.dangKy({ email: 'yen@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'Yến' })
    await dangNhapQuaGiaoDien(user, 'yen@vi-du.vn', 'sai-mat-khau')
    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent('Email hoặc mật khẩu không đúng.')
    expect(screen.queryByRole('button', { name: 'Gửi lại thư xác nhận' })).not.toBeInTheDocument()
  })
})

describe('quên mật khẩu trên giao diện', () => {
  async function yeuCauMa(user: ReturnType<typeof userEvent.setup>, email: string) {
    await user.click(screen.getByRole('button', { name: 'Quên mật khẩu?' }))
    await screen.findByRole('heading', { level: 1, name: 'Quên mật khẩu' })
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), email)
    await user.click(screen.getByRole('button', { name: 'Gửi mã đặt lại' }))
    await screen.findByRole('heading', { level: 1, name: 'Đặt mật khẩu mới' })
  }

  it('yêu cầu đặt lại hiện cùng một thông báo dù email có tài khoản hay không', async () => {
    const { user, kho, ungDung } = dungApp()
    await dangKyDaXacNhan(kho, 'quynh@vi-du.vn', 'Quỳnh')

    await yeuCauMa(user, 'quynh@vi-du.vn')
    expect(ungDung.getByText(THONG_BAO.daGuiMaDatLai)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Về đăng nhập' }))
    await yeuCauMa(user, 'khong-co-ai@vi-du.vn')
    expect(ungDung.getByText(THONG_BAO.daGuiMaDatLai)).toBeInTheDocument()
  })

  it('đặt mật khẩu mới bằng mã trong thư: mật khẩu mới vào được, mật khẩu cũ thì không', async () => {
    const { user, kho, ungDung } = dungApp()
    await dangKyDaXacNhan(kho, 'phat@vi-du.vn', 'Phát')
    await yeuCauMa(user, 'phat@vi-du.vn')

    // Bản chạy thử hiện mã trong thư mô phỏng ngay trên màn.
    const thu = kho.moPhong.thuGuiToi('phat@vi-du.vn').find((t) => t.loai === 'DAT_LAI_MAT_KHAU')
    if (!thu || thu.loai !== 'DAT_LAI_MAT_KHAU') throw new Error('không có thư đặt lại')
    expect(ungDung.getByText(new RegExp(`Mã trong thư mới nhất: ${thu.ma}`))).toBeInTheDocument()

    expect(screen.getByLabelText('Email')).toHaveValue('phat@vi-du.vn')
    await user.type(screen.getByLabelText('Mã đặt lại'), thu.ma)
    await user.type(screen.getByLabelText('Mật khẩu mới'), 'mat-khau-moi-2')
    await user.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
    expect(ungDung.getByText(THONG_BAO.daDatLaiMatKhau)).toBeInTheDocument()

    // Mật khẩu cũ không còn dùng được.
    await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await ungDung.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.')

    await user.clear(screen.getByLabelText('Mật khẩu'))
    await user.type(screen.getByLabelText('Mật khẩu'), 'mat-khau-moi-2')
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
    expect(vungTaiKhoan().getByText('Phát')).toBeInTheDocument()
  })
})

describe('điều hướng bằng phím', () => {
  it('đi qua và dùng được mọi điều khiển bằng Tab, Enter', async () => {
    const { user, kho } = dungApp()
    await dangKyDaXacNhan(kho, 'k@vi-du.vn', 'Khánh')

    // Màn đăng nhập: Email → Mật khẩu → Đăng nhập → Đăng ký → Quên mật khẩu.
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
    await user.tab()
    expect(screen.getByRole('button', { name: 'Quên mật khẩu?' })).toHaveFocus()

    // Quay lại nút Đăng nhập và bấm bằng Enter.
    await user.tab({ shift: true })
    await user.tab({ shift: true })
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })

    // Khung: liên kết bỏ qua đến nội dung → Thanh bên (Tổng quan → Việc của tôi → Chờ tôi duyệt →
    // Dự án của tôi) → chân Thanh bên (Hồ sơ → Đăng xuất). Trang đầu là Tổng quan.
    expect(await screen.findByRole('heading', { level: 2, name: 'Tổng quan' })).toBeInTheDocument()
    await user.tab()
    expect(screen.getByRole('link', { name: 'Bỏ qua đến nội dung' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Tổng quan' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Việc của tôi' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Chờ tôi duyệt' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Dự án của tôi' })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole('button', { name: 'Hồ sơ' })).toHaveFocus()
    await user.keyboard('{Enter}')
    await screen.findByRole('heading', { level: 2, name: 'Hồ sơ của tôi' })

    // Màn hồ sơ: tới ô Tên hiển thị, GitHub username, ba ô Thông tin nhân sự và nút Lưu bằng Tab.
    await user.tab()
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toHaveFocus()
    await user.tab() // Email (chỉ đọc)
    await user.tab() // Vai (chỉ đọc)
    await user.tab()
    expect(screen.getByLabelText('Tên hiển thị')).toHaveFocus()
    await user.tab()
    expect(screen.getByLabelText('GitHub username')).toHaveFocus()
    await user.keyboard('khanh-gh')
    for (const nhan of ['Số điện thoại', 'Chức danh', 'Phòng ban']) {
      await user.tab()
      expect(screen.getByLabelText(nhan)).toHaveFocus()
    }
    await user.tab()
    expect(screen.getByRole('button', { name: 'Lưu hồ sơ' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(await screen.findByText('Đã lưu hồ sơ.')).toBeInTheDocument()

    // Đăng xuất bằng phím.
    screen.getByRole('button', { name: 'Đăng xuất' }).focus()
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
  })

  it('đăng ký, xác nhận và đăng nhập đi được bằng phím: Enter trong ô cuối gửi biểu mẫu', async () => {
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
    await screen.findByRole('heading', { level: 1, name: 'Xác nhận email' })

    screen.getByRole('button', { name: 'Xác nhận email (mô phỏng)' }).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })

    screen.getByLabelText('Mật khẩu').focus()
    await user.keyboard(`${MAT_KHAU}{Enter}`)
    await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
    expect(vungTaiKhoan().getByText('Người Mới')).toBeInTheDocument()
  })
})
