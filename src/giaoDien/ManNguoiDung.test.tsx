// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { THONG_BAO_MAC_DINH, thanhCong, thatBai } from '../kho/ketQua'
import type { KhoDuLieu, Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

function taoKho(): KhoBoNho {
  return taoKhoBoNho({ pmBanDau: PM })
}

/** Dựng ứng dụng với bản bộ nhớ `goc`; `kho` là Kho ứng dụng dùng (bọc `goc` để giả lỗi, đang tải). */
function dungApp(goc: KhoBoNho, kho: KhoDuLieu = goc) {
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={goc.moPhong} dongHo={() => LUC} />)
  // Astryx gắn vùng thông báo (live region) thẳng vào body; chỉ tìm trong vùng của ứng dụng.
  return { user, ungDung: within(container) }
}

/** Đăng ký, xác nhận email và (nếu cần) để PM ban đầu đặt vai; trả phiên của người mới. */
async function taoNguoi(kho: KhoBoNho, email: string, tenHienThi: string, vai: VaiHeThong = 'THANH_VIEN') {
  const dk = await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi })
  if (!dk.ok) throw new Error(dk.loi.thongBao)
  await kho.moPhong.xacNhanEmail(email)
  if (vai !== 'THANH_VIEN') {
    const kq = await kho.doiVai(await phienCua(kho, PM.email), dk.giaTri.id, { vai })
    if (!kq.ok) throw new Error(kq.loi.thongBao)
  }
  return dk.giaTri
}

async function phienCua(kho: KhoDuLieu, email: string): Promise<Phien> {
  const kq = await kho.dangNhap({ email, matKhau: MAT_KHAU })
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function vaiCua(kho: KhoDuLieu, email: string): Promise<VaiHeThong> {
  const kq = await kho.layHoSoCuaToi(await phienCua(kho, email))
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri.vai
}

async function dangNhap(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

async function moManNguoiDung(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Người dùng' }))
  await screen.findByRole('heading', { level: 2, name: 'Người dùng' })
}

/** Nhóm chọn vai của một người trên bảng. */
function vaiTrenBang(tenHienThi: string) {
  return within(screen.getByRole('radiogroup', { name: `Vai của ${tenHienThi}` }))
}

function vaiDangChon(tenHienThi: string): string | null {
  const chon = vaiTrenBang(tenHienThi)
    .getAllByRole('radio')
    .find((nut) => nut.getAttribute('aria-checked') === 'true')
  return chon?.textContent ?? null
}

describe('mục Người dùng theo vai', () => {
  it.each<[VaiHeThong, string]>([
    ['THANH_VIEN', 'Thành viên'],
    ['SUPPORT', 'Support'],
  ])('%s không thấy mục Người dùng', async (vai, tenVai) => {
    const kho = taoKho()
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', vai)
    const { user } = dungApp(kho)
    await dangNhap(user, 'binh@vi-du.vn')

    expect(within(screen.getByRole('group', { name: 'Tài khoản đang đăng nhập' })).getByText(tenVai)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dự án của tôi' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Người dùng' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Người dùng' })).not.toBeInTheDocument()
  })

  it('PM thấy mục Người dùng và mở được danh sách mọi tài khoản với tên, email và vai', async () => {
    const kho = taoKho()
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', 'SUPPORT')
    await taoNguoi(kho, 'chi@vi-du.vn', 'Chi')
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moManNguoiDung(user)

    const bang = await screen.findByRole('table', { name: 'Danh sách người dùng' })
    for (const [ten, email, vai] of [
      ['An PM', PM.email, 'PM'],
      ['Bình', 'binh@vi-du.vn', 'Support'],
      ['Chi', 'chi@vi-du.vn', 'Thành viên'],
    ]) {
      expect(within(bang).getByText(ten)).toBeInTheDocument()
      expect(within(bang).getByText(email)).toBeInTheDocument()
      expect(vaiDangChon(ten)).toBe(vai)
    }
  })
})

describe('đổi vai trên màn Người dùng', () => {
  it('PM đổi vai một người thì bảng hiện vai mới và vai mới có hiệu lực ngay', async () => {
    const kho = taoKho()
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moManNguoiDung(user)
    await screen.findByRole('radiogroup', { name: 'Vai của Bình' })

    await user.click(vaiTrenBang('Bình').getByRole('radio', { name: 'Support' }))
    expect(await ungDung.findByText('Đã đổi vai của Bình thành Support.')).toBeInTheDocument()
    expect(vaiDangChon('Bình')).toBe('Support')
    expect(await vaiCua(kho, 'binh@vi-du.vn')).toBe('SUPPORT')

    await user.click(vaiTrenBang('Bình').getByRole('radio', { name: 'PM' }))
    expect(await ungDung.findByText('Đã đổi vai của Bình thành PM.')).toBeInTheDocument()
    expect(await vaiCua(kho, 'binh@vi-du.vn')).toBe('PM')
  })

  it('PM cuối cùng tự hạ mình bị từ chối, hiện lý do tiếng Việt và vai không đổi', async () => {
    const kho = taoKho()
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moManNguoiDung(user)
    await screen.findByRole('radiogroup', { name: 'Vai của An PM' })

    await user.click(vaiTrenBang('An PM').getByRole('radio', { name: 'Thành viên' }))
    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent('Không đổi được vai của An PM.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.PHAI_CON_PM)
    expect(vaiDangChon('An PM')).toBe('PM')
    expect(await vaiCua(kho, PM.email)).toBe('PM')
    expect(screen.getByRole('button', { name: 'Người dùng' })).toBeInTheDocument()
  })

  it('PM tự hạ mình khi còn PM khác thì được; mục Người dùng biến mất và khung hiện vai mới', async () => {
    const kho = taoKho()
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', 'PM')
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moManNguoiDung(user)
    await screen.findByRole('radiogroup', { name: 'Vai của An PM' })

    await user.click(vaiTrenBang('An PM').getByRole('radio', { name: 'Support' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Người dùng' })).not.toBeInTheDocument())
    expect(within(screen.getByRole('group', { name: 'Tài khoản đang đăng nhập' })).getByText('Support')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { level: 2, name: 'Dự án của tôi' })).toBeInTheDocument()
    expect(await vaiCua(kho, PM.email)).toBe('SUPPORT')
  })

  it('PM bị hạ vai ở nơi khác rồi đổi vai người khác thì bị từ chối kèm lý do tiếng Việt', async () => {
    const kho = taoKho()
    const binh = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', 'PM')
    await taoNguoi(kho, 'chi@vi-du.vn', 'Chi')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moManNguoiDung(user)
    await screen.findByRole('radiogroup', { name: 'Vai của Chi' })

    // Trong lúc màn đang mở, Bình (PM khác) hạ An xuống Thành viên.
    const phienBinh = await phienCua(kho, binh.email)
    const ds = await kho.danhSachNguoiDung(phienBinh)
    const idAn = ds.ok ? ds.giaTri.find((nd) => nd.email === PM.email)?.id : undefined
    expect(await kho.doiVai(phienBinh, idAn ?? '', { vai: 'THANH_VIEN' })).toEqual(
      thanhCong(expect.objectContaining({ vai: 'THANH_VIEN' })),
    )

    await user.click(vaiTrenBang('Chi').getByRole('radio', { name: 'PM' }))
    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent('Không đổi được vai của Chi.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_CO_QUYEN)
    expect(vaiDangChon('Chi')).toBe('Thành viên')
    expect(await vaiCua(kho, 'chi@vi-du.vn')).toBe('THANH_VIEN')
  })
})

describe('trạng thái của màn Người dùng', () => {
  it('đang tải thì hiện trạng thái đang tải', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, danhSachNguoiDung: () => new Promise(() => {}) }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moManNguoiDung(user)
    expect(await screen.findByRole('progressbar', { name: 'Đang tải danh sách người dùng…' })).toBeInTheDocument()
  })

  it('lỗi tải thì hiện thông báo tiếng Việt và thử lại được', async () => {
    const goc = taoKho()
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      danhSachNguoiDung: async (phien) => {
        lanGoi += 1
        return lanGoi === 1 ? thatBai('KHONG_TIM_THAY') : goc.danhSachNguoiDung(phien)
      },
    }
    const { user, ungDung } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moManNguoiDung(user)

    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent('Không tải được danh sách người dùng.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_TIM_THAY)
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('radiogroup', { name: 'Vai của An PM' })).toBeInTheDocument()
  })

  it('bị từ chối xem danh sách thì hiện lý do bằng tiếng Việt', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, danhSachNguoiDung: async () => thatBai('KHONG_CO_QUYEN') }
    const { user, ungDung } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moManNguoiDung(user)
    expect(await ungDung.findByRole('alert')).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_CO_QUYEN)
  })

  it('danh sách trống thì hiện trạng thái trống', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, danhSachNguoiDung: async () => thanhCong([]) }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moManNguoiDung(user)
    expect(await screen.findByRole('heading', { name: 'Chưa có tài khoản nào.' })).toBeInTheDocument()
  })

  it('phiên hết hạn khi tải danh sách thì quay về màn đăng nhập', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, danhSachNguoiDung: async () => thatBai('CHUA_DANG_NHAP') }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await user.click(screen.getByRole('button', { name: 'Người dùng' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
  })

  it('đi tới và đổi vai được bằng bàn phím', async () => {
    const kho = taoKho()
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)

    screen.getByRole('button', { name: 'Người dùng' }).focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('radiogroup', { name: 'Vai của Bình' })

    // Ô chọn vai giữ một điểm dừng Tab ở vai đang chọn; phím mũi tên chuyển sang vai khác.
    vaiTrenBang('Bình').getByRole('radio', { name: 'Thành viên' }).focus()
    await user.keyboard('{ArrowLeft}')
    expect(await ungDung.findByText('Đã đổi vai của Bình thành Support.')).toBeInTheDocument()
    expect(await vaiCua(kho, 'binh@vi-du.vn')).toBe('SUPPORT')
  })
})
