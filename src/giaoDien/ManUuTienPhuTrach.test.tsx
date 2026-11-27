// @vitest-environment jsdom
// Mức ưu tiên của Dự án và Người phụ trách trên giao diện (ticket truong-moi 03): ô chọn Mức ưu tiên và ô
// chọn Người phụ trách trong biểu mẫu tạo và sửa Dự án (Người phụ trách chỉ liệt kê Người trong dự án), cả
// hai hiện ở dải tóm tắt (Mức ưu tiên bằng chữ kèm màu), gỡ Người phụ trách làm ô về "Chưa có", và Thành
// viên là Người phụ trách không thấy thêm nút ghi nào.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { THONG_BAO_DU_AN } from '../luat/duAn'
import type { MucUuTien } from '../luat/mucUuTien'
import { choNganTruot, moTabDuAn } from '../test/khungUngDung'
import { maDuAnMoi } from '../test/maDuAn'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-02-20T03:00:00Z')
const HOM_NAY = new Date('2026-11-26T09:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

function dungApp(kho: KhoBoNho) {
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => HOM_NAY} />)
  return { user, ungDung: within(container) }
}

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function phienCua(kho: KhoDuLieu, email: string): Promise<Phien> {
  return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
}

async function taoDuAn(kho: KhoBoNho, ten: string, mucUuTien?: MucUuTien): Promise<DuAn> {
  return giaTri(
    await kho.taoDuAn(await phienCua(kho, PM.email), { ma: maDuAnMoi(), ten, ...(mucUuTien ? { mucUuTien } : {}) }, LUC_TAO),
  )
}

/** Đăng ký một tài khoản (Thành viên), thêm vào Dự án `duAn` nếu có; trả id. */
async function taoNguoi(kho: KhoBoNho, email: string, tenHienThi: string, duAn: DuAn | null): Promise<string> {
  const id = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi })).id
  await kho.moPhong.xacNhanEmail(email)
  if (duAn) giaTri(await kho.themNguoiVaoDuAn(await phienCua(kho, PM.email), duAn.id, { email }))
  return id
}

async function datPhuTrach(kho: KhoBoNho, duAn: DuAn, nguoiDungId: string) {
  giaTri(await kho.suaDuAn(await phienCua(kho, PM.email), duAn.id, { nguoiPhuTrachId: nguoiDungId }, LUC_TAO))
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

async function moMuc(user: User, muc: string) {
  await user.click(screen.getByRole('button', { name: muc }))
  await screen.findByRole('heading', { level: 2, name: muc })
}

async function moChiTiet(user: User, muc: 'Tất cả Dự án' | 'Dự án của tôi', ten: string) {
  await moMuc(user, muc)
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
}

/** Một ô có tên trong dải tóm tắt. */
function o(ten: string) {
  return within(screen.getByRole('group', { name: 'Tóm tắt Dự án' })).getByRole('group', { name: ten })
}

/** Ô chọn có nhãn `nhan` trong Ngăn trượt `ngan`. */
function oChon(ngan: ReturnType<typeof within>, nhan: string) {
  return ngan.getByRole('combobox', { name: new RegExp(`^${nhan}`) })
}

/** Mở ô chọn, đọc tên các lựa chọn, rồi đóng lại bằng Esc. */
async function cacLuaChon(user: User, oNhap: HTMLElement): Promise<string[]> {
  await user.click(oNhap)
  const ten = (await screen.findAllByRole('option')).map((lc) => lc.textContent ?? '')
  await user.keyboard('{Escape}')
  return ten
}

async function chon(user: User, oNhap: HTMLElement, luaChon: string | RegExp) {
  await user.click(oNhap)
  await user.click(await screen.findByRole('option', { name: luaChon }))
}

async function choNganDong() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('Mức ưu tiên và Người phụ trách trong biểu mẫu tạo Dự án', () => {
  it('ô Mức ưu tiên mặc định Trung bình, có đủ ba mức; ô Người phụ trách chỉ có "Chưa có"; chọn Cao thì dải tóm tắt hiện chữ "Cao"', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moMuc(user, 'Tất cả Dự án')
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    const ngan = within(await choNganTruot('Tạo Dự án'))

    expect(oChon(ngan, 'Mức ưu tiên')).toHaveTextContent('Trung bình')
    expect(await cacLuaChon(user, oChon(ngan, 'Mức ưu tiên'))).toEqual(['Thấp', 'Trung bình', 'Cao'])
    expect(oChon(ngan, 'Người phụ trách')).toHaveTextContent('Chưa có')
    expect(await cacLuaChon(user, oChon(ngan, 'Người phụ trách'))).toEqual(['Chưa có'])

    await user.type(ngan.getByLabelText('Mã Dự án'), 'CH-1')
    await user.type(ngan.getByLabelText('Tên Dự án'), 'Cửa hàng')
    await chon(user, oChon(ngan, 'Mức ưu tiên'), 'Cao')
    await user.click(ngan.getByRole('button', { name: 'Tạo Dự án' }))
    await choNganDong()

    const ds = giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))
    expect(ds).toEqual([expect.objectContaining({ ten: 'Cửa hàng', mucUuTien: 'CAO', nguoiPhuTrach: null })])
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
    expect(within(o('Mức ưu tiên')).getByText('Cao')).toBeInTheDocument()
    expect(within(o('Người phụ trách')).getByText('Chưa có')).toBeInTheDocument()
  })

  it('không chọn Mức ưu tiên thì Dự án mới là Trung bình, hiện bằng chữ ở dải tóm tắt', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moMuc(user, 'Tất cả Dự án')
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    const ngan = within(await choNganTruot('Tạo Dự án'))
    await user.type(ngan.getByLabelText('Mã Dự án'), 'CH-1')
    await user.type(ngan.getByLabelText('Tên Dự án'), 'Cửa hàng')
    await user.click(ngan.getByRole('button', { name: 'Tạo Dự án' }))
    await choNganDong()

    expect(giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))[0].mucUuTien).toBe('TRUNG_BINH')
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
    expect(within(o('Mức ưu tiên')).getByText('Trung bình')).toBeInTheDocument()
  })
})

describe('Mức ưu tiên và Người phụ trách trong biểu mẫu sửa Dự án', () => {
  it('ô Người phụ trách chỉ liệt kê Người trong dự án (không có người ngoài); chọn và đổi mức thì dải tóm tắt và Dấu vết cập nhật', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const duAn = await taoDuAn(kho, 'Cửa hàng', 'CAO')
    await taoNguoi(kho, 'chi@vi-du.vn', 'Chi', duAn)
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', duAn)
    await taoNguoi(kho, 'ngoai@vi-du.vn', 'Người ngoài', null)
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moChiTiet(user, 'Tất cả Dự án', 'Cửa hàng')
    expect(within(o('Mức ưu tiên')).getByText('Cao')).toBeInTheDocument()
    await moTabDuAn(user, 'Thông tin')

    await user.click(screen.getByRole('button', { name: 'Sửa Dự án' }))
    const ngan = within(await choNganTruot('Sửa Dự án'))
    expect(oChon(ngan, 'Mức ưu tiên')).toHaveTextContent('Cao')
    expect(oChon(ngan, 'Người phụ trách')).toHaveTextContent('Chưa có')
    expect(await cacLuaChon(user, oChon(ngan, 'Người phụ trách'))).toEqual([
      'Chưa có',
      'Bình (binh@vi-du.vn)',
      'Chi (chi@vi-du.vn)',
    ])

    await chon(user, oChon(ngan, 'Người phụ trách'), /^Chi \(/)
    await chon(user, oChon(ngan, 'Mức ưu tiên'), 'Thấp')
    await user.click(ngan.getByRole('button', { name: 'Lưu thay đổi' }))
    await choNganDong()
    expect(await ungDung.findByText('Đã lưu thay đổi.')).toBeInTheDocument()

    expect(within(o('Người phụ trách')).getByText('Chi')).toBeInTheDocument()
    expect(within(o('Mức ưu tiên')).getByText('Thấp')).toBeInTheDocument()
    const dauVet = within(screen.getByRole('group', { name: 'Dấu vết' }))
    expect(dauVet.getByText('Người chỉnh sửa gần nhất: An PM')).toBeInTheDocument()
    expect(dauVet.getByText('Ngày chỉnh sửa gần nhất: 26/11/2026 09:00')).toBeInTheDocument()

    // Mở lại: ô có người đang phụ trách; chọn "Chưa có" là bỏ Người phụ trách.
    await user.click(screen.getByRole('button', { name: 'Sửa Dự án' }))
    const nganLai = within(await choNganTruot('Sửa Dự án'))
    expect(oChon(nganLai, 'Người phụ trách')).toHaveTextContent('Chi (chi@vi-du.vn)')
    await chon(user, oChon(nganLai, 'Người phụ trách'), 'Chưa có')
    await user.click(nganLai.getByRole('button', { name: 'Lưu thay đổi' }))
    await choNganDong()
    expect(await within(o('Người phụ trách')).findByText('Chưa có')).toBeInTheDocument()
    expect(giaTri(await kho.layDuAn(await phienCua(kho, PM.email), duAn.id)).nguoiPhuTrach).toBeNull()
  })

  it('gỡ Người phụ trách ở tab Người trong dự án: dải tóm tắt về "Chưa có"', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    const chi = await taoNguoi(kho, 'chi@vi-du.vn', 'Chi', duAn)
    await datPhuTrach(kho, duAn, chi)
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moChiTiet(user, 'Tất cả Dự án', 'Cửa hàng')
    expect(within(o('Người phụ trách')).getByText('Chi')).toBeInTheDocument()

    await moTabDuAn(user, 'Người trong dự án')
    const vungNguoi = within(screen.getByRole('group', { name: 'Người trong dự án' }))
    await user.click(await vungNguoi.findByRole('button', { name: 'Gỡ Chi' }))
    expect(await ungDung.findByText('Đã gỡ Chi khỏi Dự án. Tài khoản và hồ sơ của họ vẫn giữ nguyên.')).toBeInTheDocument()
    expect(await within(o('Người phụ trách')).findByText('Chưa có')).toBeInTheDocument()
  })
})

describe('Thành viên là Người phụ trách', () => {
  it('thấy mình ở dải tóm tắt nhưng không có thêm nút ghi nào: không sửa Dự án, không tạo Task, không thêm hay gỡ người', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const duAn = await taoDuAn(kho, 'Cửa hàng', 'CAO')
    const chi = await taoNguoi(kho, 'chi@vi-du.vn', 'Chi', duAn)
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', duAn)
    await datPhuTrach(kho, duAn, chi)
    const { user } = dungApp(kho)
    await dangNhap(user, 'chi@vi-du.vn')
    await moChiTiet(user, 'Dự án của tôi', 'Cửa hàng')

    expect(within(o('Người phụ trách')).getByText('Chi')).toBeInTheDocument()
    expect(within(o('Mức ưu tiên')).getByText('Cao')).toBeInTheDocument()
    // Đợi Task và người trong dự án tải xong để nút ẩn là do luật quyền, không phải do còn đang tải.
    await waitFor(() => expect(o('Tiến độ của Dự án')).not.toHaveTextContent('Đang tính…'))
    expect(await screen.findByText(THONG_BAO_DU_AN.khongQuanLy)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo Task' })).not.toBeInTheDocument()
    await moTabDuAn(user, 'Thông tin')
    expect(screen.queryByRole('button', { name: 'Sửa Dự án' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu trữ Dự án' })).not.toBeInTheDocument()
    await moTabDuAn(user, 'Người trong dự án')
    await screen.findByText('Bình')
    expect(screen.queryByRole('button', { name: /^Gỡ / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Thêm vào Dự án' })).not.toBeInTheDocument()
  })
})
