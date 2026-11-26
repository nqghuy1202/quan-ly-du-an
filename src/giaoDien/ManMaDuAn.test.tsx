// @vitest-environment jsdom
// Mã Dự án và Khách hàng trên giao diện (ticket truong-moi 01): ô trong biểu mẫu tạo và sửa Dự án, lỗi
// cạnh ô, và Mã đứng cạnh tên Dự án ở danh sách Dự án, Tổng quan, dải tóm tắt và trang việc cá nhân.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { DO_DAI_KHACH_HANG_TOI_DA, THONG_BAO_DU_AN } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { choNganTruot, choTongQuanTaiXong, moTabDuAn } from '../test/khungUngDung'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-02-20T03:00:00Z') // 10:00 ở Việt Nam
/** Đồng hồ ứng dụng dùng khi bấm tạo, lưu. */
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

function dungApp(kho: KhoBoNho) {
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => LUC} />)
  return { user, ungDung: within(container) }
}

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function phienCua(kho: KhoDuLieu, email: string): Promise<Phien> {
  return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
}

async function taoNguoi(kho: KhoBoNho, email: string, tenHienThi: string, vai: VaiHeThong = 'THANH_VIEN') {
  const hoSo = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
  await kho.moPhong.xacNhanEmail(email)
  if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(await phienCua(kho, PM.email), hoSo.id, { vai }))
  return hoSo
}

async function taoDuAn(kho: KhoBoNho, ma: string, ten: string, khachHang = ''): Promise<DuAn> {
  return giaTri(await kho.taoDuAn(await phienCua(kho, PM.email), { ma, ten, khachHang }, LUC_TAO))
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

async function moChiTiet(user: User, ten: string) {
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
}

/** Chữ trong từng ô của mỗi dòng (bỏ dòng tiêu đề) của bảng. */
function dongCua(bang: HTMLElement): (string | null)[][] {
  return within(bang)
    .getAllByRole('row')
    .slice(1)
    .map((dong) => within(dong).getAllByRole('cell').map((o) => o.textContent))
}

/** Thông báo lỗi Astryx đặt cạnh ô (mô tả truy cập được của ô). */
function loiCanhO(o: HTMLElement, thongBao: string) {
  expect(o).toHaveAccessibleDescription(expect.stringContaining(thongBao))
}

function tomTat() {
  return within(screen.getByRole('group', { name: 'Tóm tắt Dự án' }))
}

async function choNganDong() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('Mã Dự án và Khách hàng trong biểu mẫu', () => {
  it('PM tạo Dự án với Mã viết thường và Khách hàng: Mã lưu in hoa, hiện cạnh tên ở danh sách, dải tóm tắt và tab Thông tin', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moMuc(user, 'Tất cả Dự án')
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    const ngan = within(await choNganTruot('Tạo Dự án'))

    await user.click(ngan.getByLabelText('Mã Dự án'))
    await user.paste(' sdv-012 ')
    await user.click(ngan.getByLabelText('Tên Dự án'))
    await user.paste('Cửa hàng')
    await user.click(ngan.getByLabelText('Khách hàng'))
    await user.paste('Công ty An Phát')
    await user.click(ngan.getByRole('button', { name: 'Tạo Dự án' }))
    await choNganDong()

    const bang = await screen.findByRole('table', { name: 'Danh sách Dự án' })
    expect(dongCua(bang)[0].slice(0, 2)).toEqual(['SDV-012', 'Cửa hàng'])

    await moChiTiet(user, 'Cửa hàng')
    expect(tomTat().getByText('SDV-012')).toBeInTheDocument()
    expect(within(tomTat().getByRole('group', { name: 'Khách hàng' })).getByText('Công ty An Phát')).toBeInTheDocument()
    await moTabDuAn(user, 'Thông tin')
    expect(within(screen.getByRole('group', { name: 'Khách hàng của Dự án' })).getByText('Công ty An Phát')).toBeInTheDocument()

    const ds = giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))
    expect(ds).toEqual([expect.objectContaining({ ma: 'SDV-012', ten: 'Cửa hàng', khachHang: 'Công ty An Phát' })])
  })

  it.each([
    { ca: 'thiếu Mã', ma: '', thongBao: THONG_BAO_DU_AN.maTrong },
    { ca: 'Mã sai dạng', ma: 'SDV 012', thongBao: THONG_BAO_DU_AN.maSai },
    { ca: 'Mã trùng Mã của Dự án khác (khác hoa thường)', ma: 'kh-1', thongBao: THONG_BAO_DU_AN.maTrung },
  ])('$ca: lỗi tiếng Việt cạnh ô Mã, ngăn vẫn mở, không tạo gì', async ({ ma, thongBao }) => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    await taoDuAn(kho, 'KH-1', 'Có sẵn')
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moMuc(user, 'Tất cả Dự án')
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    const ngan = within(await choNganTruot('Tạo Dự án'))

    if (ma !== '') await user.type(ngan.getByLabelText('Mã Dự án'), ma)
    await user.type(ngan.getByLabelText('Tên Dự án'), 'Mới')
    await user.click(ngan.getByRole('button', { name: 'Tạo Dự án' }))

    expect(await ngan.findByText('Chưa tạo được Dự án.')).toBeInTheDocument()
    loiCanhO(ngan.getByLabelText('Mã Dự án'), thongBao)
    expect(screen.getByRole('dialog', { name: 'Tạo Dự án' })).toBeInTheDocument()
    expect(giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email))).map((d) => d.ten)).toEqual(['Có sẵn'])
  })

  it('Khách hàng quá 120 ký tự: lỗi cạnh ô Khách hàng, ngăn vẫn mở, không tạo gì', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moMuc(user, 'Tất cả Dự án')
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    const ngan = within(await choNganTruot('Tạo Dự án'))

    await user.type(ngan.getByLabelText('Mã Dự án'), 'DA-1')
    await user.type(ngan.getByLabelText('Tên Dự án'), 'Mới')
    await user.click(ngan.getByLabelText('Khách hàng'))
    await user.paste('k'.repeat(DO_DAI_KHACH_HANG_TOI_DA + 1))
    await user.click(ngan.getByRole('button', { name: 'Tạo Dự án' }))

    expect(await ngan.findByText('Chưa tạo được Dự án.')).toBeInTheDocument()
    loiCanhO(ngan.getByLabelText('Khách hàng'), THONG_BAO_DU_AN.khachHangQuaDai)
    expect(screen.getByRole('dialog', { name: 'Tạo Dự án' })).toBeInTheDocument()
    expect(giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))).toEqual([])
  })

  it('PM sửa Mã và Khách hàng trong Ngăn trượt: ô có giá trị đang có; Mã trùng báo lỗi cạnh ô; lưu được thì dải tóm tắt và Dấu vết cập nhật', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    await taoDuAn(kho, 'KH-1', 'Khác')
    await taoDuAn(kho, 'CH-1', 'Cửa hàng', 'Khách cũ')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moMuc(user, 'Tất cả Dự án')
    await moChiTiet(user, 'Cửa hàng')
    await moTabDuAn(user, 'Thông tin')

    await user.click(screen.getByRole('button', { name: 'Sửa Dự án' }))
    const ngan = within(await choNganTruot('Sửa Dự án'))
    expect(ngan.getByText('CH-1 · Cửa hàng')).toBeInTheDocument()
    expect(ngan.getByLabelText('Mã Dự án')).toHaveValue('CH-1')
    expect(ngan.getByLabelText('Khách hàng')).toHaveValue('Khách cũ')

    await user.clear(ngan.getByLabelText('Mã Dự án'))
    await user.type(ngan.getByLabelText('Mã Dự án'), 'kh-1')
    await user.click(ngan.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await ngan.findByText('Chưa lưu được thay đổi.')).toBeInTheDocument()
    loiCanhO(ngan.getByLabelText('Mã Dự án'), THONG_BAO_DU_AN.maTrung)
    expect(screen.getByRole('dialog', { name: 'Sửa Dự án' })).toBeInTheDocument()

    await user.clear(ngan.getByLabelText('Mã Dự án'))
    await user.type(ngan.getByLabelText('Mã Dự án'), 'ch-2')
    await user.clear(ngan.getByLabelText('Khách hàng'))
    await user.type(ngan.getByLabelText('Khách hàng'), 'Mới')
    await user.click(ngan.getByRole('button', { name: 'Lưu thay đổi' }))
    await choNganDong()
    expect(await ungDung.findByText('Đã lưu thay đổi.')).toBeInTheDocument()

    expect(tomTat().getByText('CH-2')).toBeInTheDocument()
    expect(within(tomTat().getByRole('group', { name: 'Khách hàng' })).getByText('Mới')).toBeInTheDocument()
    const dauVet = within(screen.getByRole('group', { name: 'Dấu vết' }))
    expect(dauVet.getByText('Người chỉnh sửa gần nhất: An PM')).toBeInTheDocument()
    expect(dauVet.getByText('Ngày chỉnh sửa gần nhất: 01/03/2026 08:00')).toBeInTheDocument()
  })

  it('Dự án đã Lưu trữ: ô Mã và Khách hàng không sửa được', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const duAn = await taoDuAn(kho, 'CH-1', 'Cửa hàng')
    giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), duAn.id, LUC_TAO))
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moMuc(user, 'Tất cả Dự án')
    await user.click(screen.getByRole('radio', { name: 'Lưu trữ' }))
    await moChiTiet(user, 'Cửa hàng')
    await moTabDuAn(user, 'Thông tin')
    expect(screen.queryByRole('button', { name: 'Sửa Dự án' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Mã Dự án' })).not.toBeInTheDocument()
    expect(tomTat().getByText('CH-1')).toBeInTheDocument()
  })
})

describe('Mã Dự án đứng cạnh tên Dự án', () => {
  it('ở Tổng quan, Dự án của tôi, Việc của tôi và Chờ tôi duyệt', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const an = await taoNguoi(kho, 'an@vi-du.vn', 'An')
    const binh = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình')
    const pm = await phienCua(kho, PM.email)
    const duAn = await taoDuAn(kho, 'SDV-012', 'Cửa hàng', 'Công ty An Phát')
    for (const email of ['an@vi-du.vn', 'binh@vi-du.vn']) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email }))
    const task = giaTri(
      await kho.taoTask(pm, duAn.id, { tieuDe: 'Làm giỏ hàng', nguoiThucHienId: an.id, nguoiKiemTraId: binh.id }, LUC_TAO),
    )
    giaTri(await kho.chuDuAn.datTrangThaiTask(task.id, 'CHO_DUYET'))

    const { user } = dungApp(kho)
    await dangNhap(user, 'an@vi-du.vn')
    await choTongQuanTaiXong()
    const bangTongQuan = await screen.findByRole('table', { name: 'Bảng Dự án đang hoạt động' })
    expect(dongCua(bangTongQuan)[0].slice(0, 2)).toEqual(['SDV-012', 'Cửa hàng'])

    await moMuc(user, 'Dự án của tôi')
    const bangCuaToi = await screen.findByRole('table', { name: 'Dự án của tôi' })
    expect(dongCua(bangCuaToi)[0].slice(0, 2)).toEqual(['SDV-012', 'Cửa hàng'])

    await moMuc(user, 'Việc của tôi')
    const bangViec = await screen.findByRole('table', { name: 'Việc của tôi' })
    expect(dongCua(bangViec)[0].slice(0, 3)).toEqual(['Làm giỏ hàng', 'SDV-012', 'Cửa hàng'])

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    await dangNhap(user, 'binh@vi-du.vn')
    await moMuc(user, 'Chờ tôi duyệt')
    const bangCho = await screen.findByRole('table', { name: 'Chờ tôi duyệt' })
    expect(dongCua(bangCho)[0].slice(0, 3)).toEqual(['Làm giỏ hàng', 'SDV-012', 'Cửa hàng'])
  })
})
