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

// Ticket sap-xep-giao-dien 03: Hồ sơ xếp ba hàng (2, 2, 3 ô). Bố cục theo điểm ảnh không kiểm ở đây (chủ dự án
// xem tận mắt); test chỉ giữ nhãn, thứ tự trong tài liệu, thứ tự Tab và việc lưu như trước.
const THU_TU_O = ['Email', 'Vai', 'Tên hiển thị', 'GitHub username', 'Số điện thoại', 'Chức danh', 'Phòng ban']

describe('Hồ sơ xếp nhiều ô trên một hàng', () => {
  it('có đủ bảy ô với đúng nhãn; chỉ Email và Vai là chỉ đọc', async () => {
    await moHoSo()
    for (const nhan of THU_TU_O) {
      const o = screen.getByLabelText(nhan)
      if (nhan === 'Email' || nhan === 'Vai') expect(o).toHaveAttribute('readonly')
      else expect(o).not.toHaveAttribute('readonly')
    }
    expect(screen.getByLabelText('Email')).toHaveValue(EMAIL)
  })

  it('thứ tự các ô trong tài liệu và thứ tự Tab đúng như trên, nút Lưu hồ sơ đứng sau ô cuối', async () => {
    const { user } = await moHoSo()
    const cacO = THU_TU_O.map((nhan) => screen.getByLabelText(nhan))
    const nutLuu = screen.getByRole('button', { name: 'Lưu hồ sơ' })
    const theoThuTu = [...cacO, nutLuu]
    for (let i = 1; i < theoThuTu.length; i++) {
      expect(theoThuTu[i - 1].compareDocumentPosition(theoThuTu[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    }

    await user.click(cacO[0])
    expect(cacO[0]).toHaveFocus()
    for (const o of theoThuTu.slice(1)) {
      await user.tab()
      expect(o).toHaveFocus()
    }
  })

  it('sửa bốn ô rồi lưu: thấy "Đã lưu hồ sơ.", mở lại trang vẫn còn giá trị mới', async () => {
    const { kho, user, ungDung } = await moHoSo()
    await dien(user, 'Tên hiển thị', 'Lan Nguyễn')
    await dien(user, 'Số điện thoại', '+84 901 234 567')
    await dien(user, 'Chức danh', 'Trưởng nhóm')
    await dien(user, 'Phòng ban', 'Phòng Kỹ thuật')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    expect(await ungDung.findByText('Đã lưu hồ sơ.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tổng quan' }))
    await user.click(await screen.findByRole('button', { name: 'Hồ sơ' }))
    await screen.findByRole('heading', { level: 2, name: 'Hồ sơ của tôi' })
    expect(screen.getByLabelText('Tên hiển thị')).toHaveValue('Lan Nguyễn')
    expect(screen.getByLabelText('Số điện thoại')).toHaveValue('+84901234567')
    expect(screen.getByLabelText('Chức danh')).toHaveValue('Trưởng nhóm')
    expect(screen.getByLabelText('Phòng ban')).toHaveValue('Phòng Kỹ thuật')
    expect(ungDung.queryByText('Đã lưu hồ sơ.')).not.toBeInTheDocument()
    expect(await hoSoTrongKho(kho)).toMatchObject({
      tenHienThi: 'Lan Nguyễn',
      soDienThoai: '+84901234567',
      chucDanh: 'Trưởng nhóm',
      phongBan: 'Phòng Kỹ thuật',
    })
  })
})
