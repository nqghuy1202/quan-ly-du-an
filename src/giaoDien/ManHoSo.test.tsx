// @vitest-environment jsdom
// Trang Hồ sơ (ticket truong-moi 05): ba ô Thông tin nhân sự (Số điện thoại, Chức danh, Phòng ban), lỗi tiếng Việt
// cạnh ô, lưu xong hiện giá trị mới (Số điện thoại ở dạng đã chuẩn hoá).
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import type { Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { THONG_BAO_NHAN_SU } from '../luat/thongTinNhanSu'

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const EMAIL = 'lan@vi-du.vn'

async function phienCua(kho: KhoBoNho): Promise<Phien> {
  const kq = await kho.dangNhap({ email: EMAIL, matKhau: MAT_KHAU })
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function hoSoTrongKho(kho: KhoBoNho) {
  const kq = await kho.layHoSoCuaToi(await phienCua(kho))
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

/** Đăng ký, xác nhận, đăng nhập qua giao diện rồi mở trang Hồ sơ. */
async function moHoSo(truocKhiMo?: (kho: KhoBoNho) => Promise<void>) {
  const kho = taoKhoBoNho()
  const dk = await kho.dangKy({ email: EMAIL, matKhau: MAT_KHAU, tenHienThi: 'Lan' })
  if (!dk.ok) throw new Error(dk.loi.thongBao)
  await kho.moPhong.xacNhanEmail(EMAIL)
  if (truocKhiMo) await truocKhiMo(kho)
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => LUC} />)
  await user.type(screen.getByLabelText('Email'), EMAIL)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await user.click(await screen.findByRole('button', { name: 'Hồ sơ' }))
  await screen.findByRole('heading', { level: 2, name: 'Hồ sơ của tôi' })
  return { kho, user, ungDung: within(container) }
}

/** Thay nội dung một ô (dán thay vì gõ từng phím cho nhanh). */
async function dien(user: ReturnType<typeof userEvent.setup>, nhan: string, giaTri: string) {
  const o = screen.getByLabelText(nhan)
  await user.clear(o)
  if (giaTri !== '') {
    await user.click(o)
    await user.paste(giaTri)
  }
}

/** Thông báo lỗi Astryx đặt cạnh ô (mô tả truy cập được của ô). */
function coLoiCanhO(nhan: string, thongBao: string) {
  expect(screen.getByLabelText(nhan)).toHaveAccessibleDescription(expect.stringContaining(thongBao))
}

describe('Thông tin nhân sự trên trang Hồ sơ', () => {
  it('có ba ô mới, trống khi chưa nhập; lưu xong hiện giá trị mới, Số điện thoại ở dạng đã chuẩn hoá', async () => {
    const { kho, user, ungDung } = await moHoSo()
    for (const nhan of ['Số điện thoại', 'Chức danh', 'Phòng ban']) expect(screen.getByLabelText(nhan)).toHaveValue('')

    await dien(user, 'Số điện thoại', '0901 234.567')
    await dien(user, 'Chức danh', '  Trưởng nhóm  ')
    await dien(user, 'Phòng ban', 'Phòng Kỹ thuật')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))

    expect(await ungDung.findByText('Đã lưu hồ sơ.')).toBeInTheDocument()
    expect(screen.getByLabelText('Số điện thoại')).toHaveValue('0901234567')
    expect(screen.getByLabelText('Chức danh')).toHaveValue('Trưởng nhóm')
    expect(screen.getByLabelText('Phòng ban')).toHaveValue('Phòng Kỹ thuật')
    expect(await hoSoTrongKho(kho)).toMatchObject({
      tenHienThi: 'Lan',
      soDienThoai: '0901234567',
      chucDanh: 'Trưởng nhóm',
      phongBan: 'Phòng Kỹ thuật',
    })
  })

  it('mở trang thấy giá trị đã lưu; xoá trống rồi lưu thì Kho xoá ba trường', async () => {
    const { kho, user, ungDung } = await moHoSo(async (k) => {
      const kq = await k.suaHoSo(await phienCua(k), (await hoSoTrongKho(k)).id, {
        soDienThoai: '+84901234567',
        chucDanh: 'Kế toán',
        phongBan: 'Tài chính',
      })
      if (!kq.ok) throw new Error(kq.loi.thongBao)
    })
    expect(screen.getByLabelText('Số điện thoại')).toHaveValue('+84901234567')
    expect(screen.getByLabelText('Chức danh')).toHaveValue('Kế toán')
    expect(screen.getByLabelText('Phòng ban')).toHaveValue('Tài chính')

    for (const nhan of ['Số điện thoại', 'Chức danh', 'Phòng ban']) await dien(user, nhan, '')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    expect(await ungDung.findByText('Đã lưu hồ sơ.')).toBeInTheDocument()
    expect(await hoSoTrongKho(kho)).toMatchObject({ soDienThoai: null, chucDanh: null, phongBan: null })
  })

  it('Số điện thoại sai dạng: lỗi tiếng Việt cạnh ô, không lưu gì', async () => {
    const { kho, user, ungDung } = await moHoSo()
    await dien(user, 'Số điện thoại', '090123456')
    await dien(user, 'Chức danh', 'Không lưu')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))

    await ungDung.findByRole('alert')
    coLoiCanhO('Số điện thoại', THONG_BAO_NHAN_SU.soDienThoaiSai)
    expect(ungDung.queryByText('Đã lưu hồ sơ.')).not.toBeInTheDocument()
    expect(await hoSoTrongKho(kho)).toMatchObject({ soDienThoai: null, chucDanh: null })
  })

  it('Chức danh và Phòng ban dài hơn 60 ký tự: lỗi cạnh từng ô, không lưu gì', async () => {
    const { kho, user, ungDung } = await moHoSo()
    await dien(user, 'Chức danh', 'C'.repeat(61))
    await dien(user, 'Phòng ban', 'P'.repeat(61))
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))

    await ungDung.findByRole('alert')
    coLoiCanhO('Chức danh', THONG_BAO_NHAN_SU.chucDanhQuaDai)
    coLoiCanhO('Phòng ban', THONG_BAO_NHAN_SU.phongBanQuaDai)
    expect(await hoSoTrongKho(kho)).toMatchObject({ chucDanh: null, phongBan: null })
  })
})
