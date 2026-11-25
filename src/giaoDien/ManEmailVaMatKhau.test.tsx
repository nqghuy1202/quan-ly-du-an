// @vitest-environment jsdom
import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from '../astryx-themes'
import { THONG_BAO_MAC_DINH, thatBai } from '../kho/ketQua'
import type { KhoDuLieu } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho, type MoPhongThu } from '../kho/khoBoNho'
import { THONG_BAO } from '../luat/taiKhoan'
import { KhoContext } from './khoContext'
import { ManChoXacNhan, ManDatLaiMatKhau, ManGuiLaiThuXacNhan, ManQuenMatKhau } from './ManEmailVaMatKhau'

const MAT_KHAU = 'matkhau-123'
const MOT_GIO = 60 * 60 * 1000
const LUC = new Date('2026-03-01T08:00:00+07:00')
const khongLamGi = () => {}
const treoMai = () => new Promise<never>(() => {})

function dung(noiDung: ReactNode, kho: KhoDuLieu = taoKhoBoNho()) {
  const user = userEvent.setup()
  const { container, unmount } = render(
    <Theme theme={themes[defaultThemeSlug]}>
      <KhoContext value={kho}>{noiDung}</KhoContext>
    </Theme>,
  )
  return { user, ungDung: within(container), unmount }
}

async function taoTaiKhoanDaXacNhan(kho: KhoBoNho, email: string) {
  await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'Ai đó' })
  await kho.moPhong.xacNhanEmail(email)
}

describe('màn chờ xác nhận', () => {
  function choXacNhan(email: string, moPhong: MoPhongThu | null, onDaXacNhan = khongLamGi) {
    return (
      <ManChoXacNhan
        email={email}
        thongBao={null}
        moPhong={moPhong}
        onGuiLai={khongLamGi}
        onDaXacNhan={onDaXacNhan}
        onVeDangNhap={khongLamGi}
      />
    )
  }

  it('trống: chưa có email nào chờ xác nhận thì hướng dẫn gửi lại thư', () => {
    dung(choXacNhan('', null))
    expect(screen.getByRole('heading', { name: 'Chưa có email nào đang chờ xác nhận.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gửi lại thư xác nhận' })).toBeInTheDocument()
  })

  it('có email: nhắc mở thư, có nút gửi lại; Kho gửi thư thật thì không có nút mô phỏng', () => {
    const { ungDung } = dung(choXacNhan('an@vi-du.vn', null))
    expect(ungDung.getByText(/an@vi-du\.vn/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Gửi lại thư xác nhận' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xác nhận email (mô phỏng)' })).not.toBeInTheDocument()
  })

  it('đang tải: đang xác nhận (mô phỏng) thì hiện trạng thái đang tải', async () => {
    const moPhong: MoPhongThu = { xacNhanEmail: treoMai, thuGuiToi: () => [] }
    const { user } = dung(choXacNhan('an@vi-du.vn', moPhong))
    await user.click(screen.getByRole('button', { name: 'Xác nhận email (mô phỏng)' }))
    expect(await screen.findByRole('progressbar', { name: 'Đang xác nhận email…' })).toBeInTheDocument()
  })

  it('lỗi: xác nhận thất bại thì hiện thông báo lỗi', async () => {
    const moPhong: MoPhongThu = { xacNhanEmail: async () => thatBai('KHONG_TIM_THAY'), thuGuiToi: () => [] }
    const { user, ungDung } = dung(choXacNhan('an@vi-du.vn', moPhong))
    await user.click(screen.getByRole('button', { name: 'Xác nhận email (mô phỏng)' }))
    expect(await ungDung.findByRole('alert')).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_TIM_THAY)
  })

  it('xác nhận (mô phỏng) thành công thì báo lên với thông báo chung', async () => {
    const kho = taoKhoBoNho()
    await kho.dangKy({ email: 'an@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An' })
    const daXacNhan = vi.fn()
    const { user } = dung(choXacNhan('an@vi-du.vn', kho.moPhong, daXacNhan), kho)
    await user.click(screen.getByRole('button', { name: 'Xác nhận email (mô phỏng)' }))
    await waitFor(() => expect(daXacNhan).toHaveBeenCalledWith(THONG_BAO.daXacNhanEmail))
    expect((await kho.dangNhap({ email: 'an@vi-du.vn', matKhau: MAT_KHAU })).ok).toBe(true)
  })
})

describe('màn gửi lại thư xác nhận', () => {
  it('trống: ô email rỗng có nhắc, gửi khi rỗng thì báo lỗi tiếng Việt', async () => {
    const { user, ungDung } = dung(<ManGuiLaiThuXacNhan emailBanDau="" onDaGui={khongLamGi} onVeDangNhap={khongLamGi} />)
    expect(ungDung.getByText('Chưa nhập email.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gửi lại thư' }))
    expect(await ungDung.findByRole('alert')).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_HOP_LE)
    expect((await screen.findAllByText(THONG_BAO.emailSai)).length).toBeGreaterThan(0)
  })

  it('đang tải: đang gửi thì hiện trạng thái đang tải', async () => {
    const kho: KhoDuLieu = { ...taoKhoBoNho(), guiLaiThuXacNhan: treoMai }
    const { user } = dung(
      <ManGuiLaiThuXacNhan emailBanDau="an@vi-du.vn" onDaGui={khongLamGi} onVeDangNhap={khongLamGi} />,
      kho,
    )
    await user.click(screen.getByRole('button', { name: 'Gửi lại thư' }))
    expect(await screen.findByRole('progressbar', { name: 'Đang gửi lại thư xác nhận…' })).toBeInTheDocument()
  })

  it('lỗi: Kho trả lỗi thì hiện thông báo lỗi', async () => {
    const kho: KhoDuLieu = { ...taoKhoBoNho(), guiLaiThuXacNhan: async () => thatBai('KHONG_TIM_THAY') }
    const { user, ungDung } = dung(
      <ManGuiLaiThuXacNhan emailBanDau="an@vi-du.vn" onDaGui={khongLamGi} onVeDangNhap={khongLamGi} />,
      kho,
    )
    await user.click(screen.getByRole('button', { name: 'Gửi lại thư' }))
    expect(await ungDung.findByRole('alert')).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_TIM_THAY)
  })

  it('gửi được thì báo lên cùng một thông báo dù email có tài khoản hay không', async () => {
    const kho = taoKhoBoNho()
    await kho.dangKy({ email: 'an@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An' })
    for (const email of ['An@Vi-Du.vn', 'khong-co@vi-du.vn']) {
      const daGui = vi.fn()
      const { user, unmount } = dung(
        <ManGuiLaiThuXacNhan emailBanDau={email} onDaGui={daGui} onVeDangNhap={khongLamGi} />,
        kho,
      )
      await user.click(screen.getByRole('button', { name: 'Gửi lại thư' }))
      await waitFor(() => expect(daGui).toHaveBeenCalledWith(email.toLowerCase(), THONG_BAO.daGuiLaiThuXacNhan))
      unmount()
    }
  })
})

describe('màn quên mật khẩu', () => {
  function quenMatKhau(onDaGui: (email: string, thongBao: string) => void = khongLamGi, emailBanDau = '') {
    return (
      <ManQuenMatKhau
        emailBanDau={emailBanDau}
        dongHo={() => LUC}
        onDaGui={onDaGui}
        onDaCoMa={khongLamGi}
        onVeDangNhap={khongLamGi}
      />
    )
  }

  it('trống: ô email rỗng có nhắc, gửi khi rỗng thì báo lỗi tiếng Việt', async () => {
    const { user, ungDung } = dung(quenMatKhau())
    expect(ungDung.getByText('Chưa nhập email.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gửi mã đặt lại' }))
    expect(await ungDung.findByRole('alert')).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_HOP_LE)
    expect((await screen.findAllByText(THONG_BAO.emailSai)).length).toBeGreaterThan(0)
  })

  it('đang tải: đang gửi thì hiện trạng thái đang tải', async () => {
    const kho: KhoDuLieu = { ...taoKhoBoNho(), yeuCauDatLaiMatKhau: treoMai }
    const { user } = dung(quenMatKhau(khongLamGi, 'an@vi-du.vn'), kho)
    await user.click(screen.getByRole('button', { name: 'Gửi mã đặt lại' }))
    expect(await screen.findByRole('progressbar', { name: 'Đang gửi mã đặt lại…' })).toBeInTheDocument()
  })

  it('lỗi: Kho trả lỗi thì hiện thông báo lỗi', async () => {
    const kho: KhoDuLieu = { ...taoKhoBoNho(), yeuCauDatLaiMatKhau: async () => thatBai('KHONG_TIM_THAY') }
    const { user, ungDung } = dung(quenMatKhau(khongLamGi, 'an@vi-du.vn'), kho)
    await user.click(screen.getByRole('button', { name: 'Gửi mã đặt lại' }))
    expect(await ungDung.findByRole('alert')).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_TIM_THAY)
  })

  it('dùng đồng hồ truyền vào cho hạn của mã', async () => {
    const kho = taoKhoBoNho()
    await taoTaiKhoanDaXacNhan(kho, 'an@vi-du.vn')
    const daGui = vi.fn()
    const { user } = dung(quenMatKhau(daGui, 'an@vi-du.vn'), kho)
    await user.click(screen.getByRole('button', { name: 'Gửi mã đặt lại' }))
    await waitFor(() => expect(daGui).toHaveBeenCalledWith('an@vi-du.vn', THONG_BAO.daGuiMaDatLai))
    expect(kho.moPhong.thuGuiToi('an@vi-du.vn')).toContainEqual(
      expect.objectContaining({ loai: 'DAT_LAI_MAT_KHAU', hetHanLuc: new Date(LUC.getTime() + MOT_GIO) }),
    )
  })
})

describe('màn đặt mật khẩu mới', () => {
  let bayGio = LUC

  function datLai(kho: KhoBoNho | null, onDaDatLai: (email: string, thongBao: string) => void = khongLamGi) {
    return (
      <ManDatLaiMatKhau
        emailBanDau="an@vi-du.vn"
        thongBao={null}
        moPhong={kho?.moPhong ?? null}
        dongHo={() => bayGio}
        onDaDatLai={onDaDatLai}
        onYeuCauMaMoi={khongLamGi}
        onVeDangNhap={khongLamGi}
      />
    )
  }

  async function khoCoMa(): Promise<{ kho: KhoBoNho; ma: string }> {
    const kho = taoKhoBoNho()
    await taoTaiKhoanDaXacNhan(kho, 'an@vi-du.vn')
    await kho.yeuCauDatLaiMatKhau({ email: 'an@vi-du.vn' }, LUC)
    const thu = kho.moPhong.thuGuiToi('an@vi-du.vn').find((t) => t.loai === 'DAT_LAI_MAT_KHAU')
    if (!thu || thu.loai !== 'DAT_LAI_MAT_KHAU') throw new Error('không có thư đặt lại')
    return { kho, ma: thu.ma }
  }

  async function nhapVaGui(user: ReturnType<typeof userEvent.setup>, ma: string, matKhauMoi: string) {
    if (ma) await user.type(screen.getByLabelText('Mã đặt lại'), ma)
    if (matKhauMoi) await user.type(screen.getByLabelText('Mật khẩu mới'), matKhauMoi)
    await user.click(screen.getByRole('button', { name: 'Đặt mật khẩu mới' }))
  }

  beforeEach(() => {
    bayGio = LUC
  })

  it('trống: chưa có thư đặt lại và ô mã rỗng thì có nhắc; gửi rỗng thì báo lỗi từng ô', async () => {
    const kho = taoKhoBoNho()
    const { user, ungDung } = dung(datLai(kho), kho)
    expect(ungDung.getByText(/Chưa có thư đặt lại nào cho email này/)).toBeInTheDocument()
    expect(ungDung.getByText(/Chưa nhập mã/)).toBeInTheDocument()
    await nhapVaGui(user, '', '')
    expect(await ungDung.findByRole('alert')).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_HOP_LE)
    expect((await screen.findAllByText(THONG_BAO.maTrong)).length).toBeGreaterThan(0)
    expect((await screen.findAllByText(THONG_BAO.matKhauNgan)).length).toBeGreaterThan(0)
  })

  it('đang tải: đang đặt thì hiện trạng thái đang tải', async () => {
    const kho: KhoDuLieu = { ...taoKhoBoNho(), datLaiMatKhau: treoMai }
    const { user } = dung(datLai(null), kho)
    await nhapVaGui(user, '000001', 'mat-khau-moi-2')
    expect(await screen.findByRole('progressbar', { name: 'Đang đặt mật khẩu mới…' })).toBeInTheDocument()
  })

  it('lỗi: mã đã hết hạn theo đồng hồ truyền vào thì báo MA_HET_HAN', async () => {
    const { kho, ma } = await khoCoMa()
    bayGio = new Date(LUC.getTime() + MOT_GIO)
    const { user, ungDung } = dung(datLai(kho), kho)
    await nhapVaGui(user, ma, 'mat-khau-moi-2')
    expect(await ungDung.findByRole('alert')).toHaveTextContent(THONG_BAO_MAC_DINH.MA_HET_HAN)
    expect((await kho.dangNhap({ email: 'an@vi-du.vn', matKhau: MAT_KHAU })).ok).toBe(true)
  })

  it('lỗi: mã đã dùng thì báo MA_DA_DUNG', async () => {
    const { kho, ma } = await khoCoMa()
    await kho.datLaiMatKhau({ email: 'an@vi-du.vn', ma, matKhauMoi: 'mat-khau-lan-1' }, LUC)
    const { user, ungDung } = dung(datLai(kho), kho)
    await nhapVaGui(user, ma, 'mat-khau-moi-2')
    expect(await ungDung.findByRole('alert')).toHaveTextContent(THONG_BAO_MAC_DINH.MA_DA_DUNG)
  })

  it('lỗi: sai mã thì báo MA_KHONG_HOP_LE', async () => {
    const { kho } = await khoCoMa()
    const { user, ungDung } = dung(datLai(kho), kho)
    await nhapVaGui(user, 'sai-ma', 'mat-khau-moi-2')
    expect(await ungDung.findByRole('alert')).toHaveTextContent(THONG_BAO_MAC_DINH.MA_KHONG_HOP_LE)
  })

  it('mã hợp lệ và mật khẩu mới đủ dài thì báo lên; mật khẩu mới dùng được, mật khẩu cũ thì không', async () => {
    const { kho, ma } = await khoCoMa()
    const daDatLai = vi.fn()
    const { user, ungDung } = dung(datLai(kho, daDatLai), kho)
    expect(ungDung.getByText(new RegExp(`Mã trong thư mới nhất: ${ma}`))).toBeInTheDocument()
    await nhapVaGui(user, ma, 'mat-khau-moi-2')
    await waitFor(() => expect(daDatLai).toHaveBeenCalledWith('an@vi-du.vn', THONG_BAO.daDatLaiMatKhau))
    expect((await kho.dangNhap({ email: 'an@vi-du.vn', matKhau: 'mat-khau-moi-2' })).ok).toBe(true)
    expect((await kho.dangNhap({ email: 'an@vi-du.vn', matKhau: MAT_KHAU })).ok).toBe(false)
  })
})
