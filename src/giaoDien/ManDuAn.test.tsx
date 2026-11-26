// @vitest-environment jsdom
import { screen, render, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { THONG_BAO_MAC_DINH, thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { DO_DAI_TEN_DU_AN_TOI_DA, THONG_BAO_DU_AN } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { choNganTruot, choTongQuanTaiXong, moTabDuAn } from '../test/khungUngDung'
import { maDuAnMoi } from '../test/maDuAn'

const MAT_KHAU = 'matkhau-123'
/** Đồng hồ ứng dụng dùng khi PM bấm tạo, lưu, Lưu trữ, mở lại. */
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

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

/**
 * Cảnh báo (role alert) có chứa `chu`. Biểu mẫu Dự án có ô ngày của Astryx, mỗi ô mang sẵn một vùng
 * alert ẩn cho lỗi gõ ngày, nên lọc theo chữ thay vì lấy alert duy nhất.
 */
async function timCanhBao(vung: ReturnType<typeof within>, chu: string): Promise<HTMLElement> {
  return waitFor(() => {
    const thay = vung.getAllByRole('alert').find((phanTu: HTMLElement) => phanTu.textContent?.includes(chu))
    if (!thay) throw new Error(`Không thấy cảnh báo "${chu}"`)
    return thay
  })
}

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function phienCua(kho: KhoDuLieu, email: string): Promise<Phien> {
  return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
}

async function taoNguoi(kho: KhoBoNho, email: string, tenHienThi: string, vai: VaiHeThong) {
  const hoSo = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
  await kho.moPhong.xacNhanEmail(email)
  if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(await phienCua(kho, PM.email), hoSo.id, { vai }))
}

/** Tạo Dự án thẳng qua Kho với đồng hồ `luc`. */
async function taoDuAn(kho: KhoBoNho, ten: string, luc: Date, moTa = ''): Promise<DuAn> {
  return giaTri(await kho.taoDuAn(await phienCua(kho, PM.email), { ma: maDuAnMoi(), ten, moTa }, luc))
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

async function moTatCaDuAn(user: User) {
  await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
  await screen.findByRole('heading', { level: 2, name: 'Tất cả Dự án' })
}

async function moChiTiet(user: User, ten: string) {
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
}

function dauVet() {
  return within(screen.getByRole('group', { name: 'Dấu vết' }))
}

async function choNganDong() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

/** Thông báo lỗi Astryx đặt cạnh ô (mô tả truy cập được của ô). */
function loiCanhO(o: HTMLElement, thongBao: string) {
  expect(o).toHaveAccessibleDescription(expect.stringContaining(thongBao))
}

/** Bấm "Tạo Dự án" ở đầu trang: biểu mẫu mở trong Ngăn trượt, trang ở nguyên phía sau. */
async function moNganTao(user: User) {
  await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
  const vung = within(await choNganTruot('Tạo Dự án'))
  expect(vung.getByRole('heading', { level: 2, name: 'Tạo Dự án' })).toBeInTheDocument()
  return vung
}

/** Ở tab Thông tin, bấm "Sửa Dự án": biểu mẫu mở trong Ngăn trượt. */
async function moNganSua(user: User) {
  await user.click(screen.getByRole('button', { name: 'Sửa Dự án' }))
  return within(await choNganTruot('Sửa Dự án'))
}

/** Thay nội dung ô `o` bằng `noiDung` (dán, nhanh hơn gõ từng ký tự). */
async function thay(user: User, o: HTMLElement, noiDung: string) {
  await user.clear(o)
  if (noiDung !== '') await user.paste(noiDung)
}

/** Mô tả Dự án đang hiện (chỉ xem) ở tab Thông tin. */
function moTaDuAn() {
  return within(screen.getByRole('group', { name: 'Mô tả Dự án' }))
}

describe('mục Tất cả Dự án theo vai', () => {
  it.each<VaiHeThong>(['SUPPORT', 'THANH_VIEN'])('%s không thấy mục Tất cả Dự án', async (vai) => {
    const kho = taoKho()
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', vai)
    const { user } = dungApp(kho)
    await dangNhap(user, 'binh@vi-du.vn')
    expect(screen.getByRole('button', { name: 'Dự án của tôi' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tất cả Dự án' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo Dự án' })).not.toBeInTheDocument()
  })

  it('PM thấy mục Tất cả Dự án và nút Tạo Dự án', async () => {
    const { user } = dungApp(taoKho())
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    expect(screen.getByRole('button', { name: 'Tạo Dự án' })).toBeInTheDocument()
  })
})

describe('tạo Dự án trong Ngăn trượt', () => {
  it('PM tạo Dự án: ngăn đóng, Dự án mới hiện trong danh sách với dấu vết theo người gọi và đồng hồ, chưa có phần chỉnh sửa', async () => {
    const kho = taoKho()
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    expect(await screen.findByRole('heading', { name: 'Chưa có Dự án nào đang hoạt động.' })).toBeInTheDocument()
    const vung = await moNganTao(user)
    // Trang danh sách ở nguyên phía sau ngăn.
    expect(ungDung.getByRole('heading', { level: 2, name: 'Tất cả Dự án' })).toBeInTheDocument()

    await user.type(vung.getByLabelText('Mã Dự án'), 'web-1')
    await user.click(vung.getByLabelText('Tên Dự án'))
    await user.paste('  Website bán hàng  ')
    await user.click(vung.getByLabelText('Mô tả'))
    await user.paste('Làm lại trang chủ')
    await user.click(vung.getByRole('button', { name: 'Tạo Dự án' }))

    await choNganDong()
    expect(await ungDung.findByText('Đã tạo Dự án Website bán hàng.')).toBeInTheDocument()
    const bang = within(await screen.findByRole('table', { name: 'Danh sách Dự án' }))
    expect(bang.getByRole('button', { name: 'Website bán hàng' })).toBeInTheDocument()
    expect(bang.getByText('WEB-1')).toBeInTheDocument()
    expect(bang.getByText('chưa có task')).toBeInTheDocument()

    // Dấu vết và mô tả nằm ở tab Thông tin của Dự án mới.
    await moChiTiet(user, 'Website bán hàng')
    await moTabDuAn(user, 'Thông tin')
    expect(dauVet().getByText('Người tạo: An PM')).toBeInTheDocument()
    expect(dauVet().getByText('Ngày tạo: 01/03/2026 08:00')).toBeInTheDocument()
    expect(dauVet().queryByText(/chỉnh sửa gần nhất/)).not.toBeInTheDocument()
    expect(moTaDuAn().getByText('Làm lại trang chủ')).toBeInTheDocument()

    const ds = giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))
    expect(ds).toEqual([
      expect.objectContaining({
        ma: 'WEB-1',
        ten: 'Website bán hàng',
        moTa: 'Làm lại trang chủ',
        khachHang: '',
        trangThai: 'HOAT_DONG',
        dauVet: expect.objectContaining({ taoLuc: LUC, suaBoi: null, suaLuc: null }),
      }),
    ])
  })

  it.each([
    { ca: 'tên chỉ khoảng trắng', ten: '   ', thongBao: THONG_BAO_DU_AN.tenTrong },
    { ca: 'tên quá 120 ký tự', ten: 'a'.repeat(DO_DAI_TEN_DU_AN_TOI_DA + 1), thongBao: THONG_BAO_DU_AN.tenQuaDai },
  ])('$ca bị từ chối: lỗi tiếng Việt cạnh ô tên, ngăn vẫn mở, không tạo gì', async ({ ten, thongBao }) => {
    const kho = taoKho()
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    const vung = await moNganTao(user)

    await user.type(vung.getByLabelText('Mã Dự án'), 'DA-1')
    await user.click(vung.getByLabelText('Tên Dự án'))
    await user.paste(ten)
    await user.click(vung.getByRole('button', { name: 'Tạo Dự án' }))

    expect(await vung.findByText('Chưa tạo được Dự án.')).toBeInTheDocument()
    loiCanhO(vung.getByLabelText('Tên Dự án'), thongBao)
    expect(screen.getByRole('dialog', { name: 'Tạo Dự án' })).toBeInTheDocument()
    expect(giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))).toEqual([])
  })

  it('bấm tạo khi đã mất vai PM thì hiện lý do bị từ chối trong ngăn', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, taoDuAn: async () => thatBai('KHONG_CO_QUYEN') }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    const vung = await moNganTao(user)
    await user.type(vung.getByLabelText('Tên Dự án'), 'X')
    await user.click(vung.getByRole('button', { name: 'Tạo Dự án' }))
    const canhBao = await timCanhBao(vung, 'Chưa tạo được Dự án.')
    expect(canhBao).toHaveTextContent('Chưa tạo được Dự án.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_CO_QUYEN)
    expect(screen.getByRole('dialog', { name: 'Tạo Dự án' })).toBeInTheDocument()
  })

  it.each(['Huỷ', 'Esc'] as const)('đóng ngăn tạo Dự án bằng %s: không tạo gì', async (cach) => {
    const kho = taoKho()
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    const vung = await moNganTao(user)
    await user.type(vung.getByLabelText('Tên Dự án'), 'Bỏ')
    if (cach === 'Huỷ') await user.click(vung.getByRole('button', { name: 'Huỷ' }))
    else await user.keyboard('{Escape}')

    await choNganDong()
    expect(ungDung.queryByText(/^Đã tạo Dự án/)).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Chưa có Dự án nào đang hoạt động.' })).toBeInTheDocument()
    expect(giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))).toEqual([])
  })

  it('PM tạo Dự án từ Dự án của tôi: ngăn đóng, có thông báo và mở ngay được Dự án mới', async () => {
    const kho = taoKho()
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await user.click(screen.getByRole('button', { name: 'Dự án của tôi' }))
    await screen.findByRole('heading', { level: 2, name: 'Dự án của tôi' })
    const vung = await moNganTao(user)
    await user.type(vung.getByLabelText('Mã Dự án'), 'KHO')
    await user.type(vung.getByLabelText('Tên Dự án'), 'Kho')
    await user.click(vung.getByRole('button', { name: 'Tạo Dự án' }))

    await choNganDong()
    expect(await ungDung.findByText('Đã tạo Dự án Kho.')).toBeInTheDocument()
    expect(giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email))).map((d) => d.ten)).toEqual(['Kho'])
    await user.click(screen.getByRole('button', { name: 'Mở Dự án Kho' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Kho' })).toBeInTheDocument()
  })

  it.each<VaiHeThong>(['SUPPORT', 'THANH_VIEN'])('%s không thấy nút Tạo Dự án ở Dự án của tôi', async (vai) => {
    const kho = taoKho()
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', vai)
    const duAn = await taoDuAn(kho, 'Có Bình', LUC)
    giaTri(await kho.themNguoiVaoDuAn(await phienCua(kho, PM.email), duAn.id, { email: 'binh@vi-du.vn' }))
    const { user } = dungApp(kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Dự án của tôi' }))
    expect(await screen.findByRole('button', { name: 'Có Bình' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo Dự án' })).not.toBeInTheDocument()
  })
})

describe('màn danh sách Dự án', () => {
  it('trống thì hiện trạng thái trống cho từng bộ lọc', async () => {
    const { user } = dungApp(taoKho())
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    expect(await screen.findByRole('heading', { name: 'Chưa có Dự án nào đang hoạt động.' })).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Lưu trữ' }))
    expect(await screen.findByRole('heading', { name: 'Chưa có Dự án nào được Lưu trữ.' })).toBeInTheDocument()
  })

  it('PM thấy mọi Dự án, lọc được giữa đang hoạt động và Lưu trữ; ngày giờ theo giờ Việt Nam', async () => {
    const kho = taoKho()
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình PM', 'PM')
    // 20:00 UTC ngày 10/4 là 03:00 sáng 11/4 ở Việt Nam.
    await taoDuAn(kho, 'Một', new Date('2026-04-10T20:00:00Z'))
    const phienBinh = await phienCua(kho, 'binh@vi-du.vn')
    giaTri(await kho.taoDuAn(phienBinh, { ma: maDuAnMoi(), ten: 'Hai' }, new Date('2026-04-12T01:15:00Z')))
    const ba = await taoDuAn(kho, 'Ba', new Date('2026-04-12T20:00:00Z'))
    giaTri(await kho.luuTruDuAn(phienBinh, ba.id, new Date('2026-05-01T10:00:00Z')))

    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)

    // Mặc định các Dự án đang hoạt động, kể cả Dự án PM khác tạo.
    const bang = await screen.findByRole('table', { name: 'Danh sách Dự án' })
    expect(within(bang).getByRole('button', { name: 'Một' })).toBeInTheDocument()
    expect(within(bang).getByRole('button', { name: 'Hai' })).toBeInTheDocument()
    expect(within(bang).queryByRole('button', { name: 'Ba' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Lưu trữ' }))
    const bangLuuTru = await screen.findByRole('table', { name: 'Danh sách Dự án' })
    expect(await within(bangLuuTru).findByRole('button', { name: 'Ba' })).toBeInTheDocument()
    expect(within(bangLuuTru).queryByRole('button', { name: 'Một' })).not.toBeInTheDocument()
    expect(within(bangLuuTru).getByText('Lưu trữ')).toBeInTheDocument()

    // Dấu vết (ở tab Thông tin) theo giờ Việt Nam: tạo 03:00 ngày 13/4; Lưu trữ là một lần chỉnh sửa.
    await moChiTiet(user, 'Ba')
    await moTabDuAn(user, 'Thông tin')
    expect(dauVet().getByText('Ngày tạo: 13/04/2026 03:00')).toBeInTheDocument()
    expect(dauVet().getByText('Người chỉnh sửa gần nhất: Bình PM')).toBeInTheDocument()
    expect(dauVet().getByText('Ngày chỉnh sửa gần nhất: 01/05/2026 17:00')).toBeInTheDocument()
  })

  it('đang tải thì hiện trạng thái đang tải', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, danhSachDuAnKemSoLieu: () => new Promise(() => {}) }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    expect(await screen.findByRole('progressbar', { name: 'Đang tải các Dự án…' })).toBeInTheDocument()
  })

  it('lỗi tải thì hiện thông báo tiếng Việt và thử lại được', async () => {
    const goc = taoKho()
    await taoDuAn(goc, 'Một', LUC)
    let lanGoi = 0
    // Chỉ trang Tất cả Dự án đọc lệnh này (Tổng quan đọc danh sách Dự án bằng lệnh khác).
    const kho: KhoDuLieu = {
      ...goc,
      danhSachDuAnKemSoLieu: async (phien, phamVi, bayGio) => {
        lanGoi += 1
        return lanGoi === 1 ? thatBai('KHONG_TIM_THAY') : goc.danhSachDuAnKemSoLieu(phien, phamVi, bayGio)
      },
    }
    const { user, ungDung } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await choTongQuanTaiXong()
    await moTatCaDuAn(user)

    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent('Không tải được các Dự án.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_TIM_THAY)
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('button', { name: 'Một' })).toBeInTheDocument()
  })

  it('phiên hết hạn khi tải danh sách thì quay về màn đăng nhập', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, danhSachDuAnKemSoLieu: async () => thatBai('CHUA_DANG_NHAP') }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await choTongQuanTaiXong()
    await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
  })
})

describe('màn chi tiết Dự án', () => {
  const LUC_TAO = new Date('2026-02-20T03:00:00Z') // 10:00 ở Việt Nam

  it('PM sửa tên và mô tả trong Ngăn trượt: ngăn đóng, dấu vết chỉnh sửa cập nhật, người và ngày tạo giữ nguyên', async () => {
    const kho = taoKho()
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình PM', 'PM')
    const phienBinh = await phienCua(kho, 'binh@vi-du.vn')
    giaTri(await kho.taoDuAn(phienBinh, { ma: maDuAnMoi(), ten: 'Tên cũ', moTa: 'Mô tả cũ' }, LUC_TAO))

    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await moChiTiet(user, 'Tên cũ')
    await moTabDuAn(user, 'Thông tin')

    expect(moTaDuAn().getByText('Mô tả cũ')).toBeInTheDocument()
    expect(dauVet().getByText('Người tạo: Bình PM')).toBeInTheDocument()
    expect(dauVet().getByText('Ngày tạo: 20/02/2026 10:00')).toBeInTheDocument()
    expect(dauVet().queryByText(/chỉnh sửa gần nhất/)).not.toBeInTheDocument()
    // Tab Thông tin chỉ xem: không có ô nhập.
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    const vung = await moNganSua(user)
    expect(vung.getByLabelText('Tên Dự án')).toHaveValue('Tên cũ')
    expect(vung.getByLabelText('Mô tả')).toHaveValue('Mô tả cũ')
    await thay(user, vung.getByLabelText('Tên Dự án'), 'Tên mới')
    await thay(user, vung.getByLabelText('Mô tả'), 'Mô tả mới')
    await user.click(vung.getByRole('button', { name: 'Lưu thay đổi' }))

    await choNganDong()
    expect(await ungDung.findByText('Đã lưu thay đổi.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Tên mới' })).toBeInTheDocument()
    expect(moTaDuAn().getByText('Mô tả mới')).toBeInTheDocument()
    expect(dauVet().getByText('Người tạo: Bình PM')).toBeInTheDocument()
    expect(dauVet().getByText('Ngày tạo: 20/02/2026 10:00')).toBeInTheDocument()
    expect(dauVet().getByText('Người chỉnh sửa gần nhất: An PM')).toBeInTheDocument()
    expect(dauVet().getByText('Ngày chỉnh sửa gần nhất: 01/03/2026 08:00')).toBeInTheDocument()

    const ds = giaTri(await kho.danhSachDuAn(phienBinh))
    expect(ds[0]).toEqual(
      expect.objectContaining({
        ten: 'Tên mới',
        moTa: 'Mô tả mới',
        dauVet: expect.objectContaining({ taoLuc: LUC_TAO, suaLuc: LUC }),
      }),
    )
  })

  it('sửa tên thành rỗng bị từ chối: lỗi cạnh ô tên, ngăn vẫn mở, không đổi gì', async () => {
    const kho = taoKho()
    await taoDuAn(kho, 'Giữ nguyên', LUC_TAO)
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await moChiTiet(user, 'Giữ nguyên')
    await moTabDuAn(user, 'Thông tin')

    const vung = await moNganSua(user)
    await user.clear(vung.getByLabelText('Tên Dự án'))
    await user.click(vung.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await vung.findByText('Chưa lưu được thay đổi.')).toBeInTheDocument()
    loiCanhO(vung.getByLabelText('Tên Dự án'), THONG_BAO_DU_AN.tenTrong)
    expect(screen.getByRole('dialog', { name: 'Sửa Dự án' })).toBeInTheDocument()
    expect(dauVet().queryByText(/chỉnh sửa gần nhất/)).not.toBeInTheDocument()
    const ds = giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))
    expect(ds[0]).toEqual(expect.objectContaining({ ten: 'Giữ nguyên', dauVet: expect.objectContaining({ suaLuc: null }) }))
  })

  it.each(['Huỷ', 'Esc'] as const)('đóng ngăn sửa Dự án bằng %s: không lưu gì, mở lại thấy giá trị đang có', async (cach) => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Giữ nguyên', LUC_TAO, 'Mô tả gốc')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await moChiTiet(user, 'Giữ nguyên')
    await moTabDuAn(user, 'Thông tin')

    const vung = await moNganSua(user)
    await thay(user, vung.getByLabelText('Tên Dự án'), 'Đổi ý')
    if (cach === 'Huỷ') await user.click(vung.getByRole('button', { name: 'Huỷ' }))
    else await user.keyboard('{Escape}')

    await choNganDong()
    expect(ungDung.queryByText('Đã lưu thay đổi.')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Giữ nguyên' })).toBeInTheDocument()
    expect(giaTri(await kho.layDuAn(await phienCua(kho, PM.email), duAn.id))).toEqual(duAn)

    const lai = await moNganSua(user)
    expect(lai.getByLabelText('Tên Dự án')).toHaveValue('Giữ nguyên')
    expect(lai.getByLabelText('Mô tả')).toHaveValue('Mô tả gốc')
  })

  it('Lưu trữ thì chỉ xem được: nút ghi ẩn, có lý do, mô tả vẫn xem được; mở lại thì sửa được trở lại', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Sắp xong', LUC_TAO, 'Gần xong rồi')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await moChiTiet(user, 'Sắp xong')
    await moTabDuAn(user, 'Thông tin')

    await user.click(screen.getByRole('button', { name: 'Lưu trữ Dự án' }))
    expect(await ungDung.findByText('Đã Lưu trữ Dự án. Dự án giờ chỉ xem được.')).toBeInTheDocument()
    expect(ungDung.getAllByText(THONG_BAO_DU_AN.daLuuTru).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Sửa Dự án' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu trữ Dự án' })).not.toBeInTheDocument()
    // Vẫn xem được, dấu vết cập nhật.
    expect(screen.getByRole('heading', { level: 2, name: 'Sắp xong' })).toBeInTheDocument()
    expect(moTaDuAn().getByText('Gần xong rồi')).toBeInTheDocument()
    expect(dauVet().getByText('Người chỉnh sửa gần nhất: An PM')).toBeInTheDocument()
    expect(giaTri(await kho.layDuAn(await phienCua(kho, PM.email), duAn.id)).trangThai).toBe('LUU_TRU')

    await user.click(screen.getByRole('button', { name: 'Mở lại Dự án' }))
    expect(await ungDung.findByText('Đã mở lại Dự án. Bạn có thể sửa tiếp.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mở lại Dự án' })).not.toBeInTheDocument()
    expect(ungDung.queryByText(THONG_BAO_DU_AN.daLuuTru)).not.toBeInTheDocument()

    const vung = await moNganSua(user)
    await user.type(vung.getByLabelText('Tên Dự án'), ' 2')
    await user.click(vung.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await ungDung.findByText('Đã lưu thay đổi.')).toBeInTheDocument()
    expect(giaTri(await kho.layDuAn(await phienCua(kho, PM.email), duAn.id)).ten).toBe('Sắp xong 2')
  })

  it('Dự án bị Lưu trữ ở nơi khác rồi bấm lưu thì bị từ chối kèm lý do, nút ghi ẩn đi trong ngăn và ở trang', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Đang mở', LUC_TAO)
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await moChiTiet(user, 'Đang mở')
    await moTabDuAn(user, 'Thông tin')

    const vung = await moNganSua(user)
    giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), duAn.id, LUC))
    await user.type(vung.getByLabelText('Tên Dự án'), ' x')
    await user.click(vung.getByRole('button', { name: 'Lưu thay đổi' }))

    const canhBao = await timCanhBao(vung, 'Chưa lưu được thay đổi.')
    expect(canhBao).toHaveTextContent('Chưa lưu được thay đổi.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.DU_AN_DA_LUU_TRU)
    // Trang phía sau đọc lại: có nút Mở lại, hết nút sửa; ngăn chỉ còn lý do, không còn nút lưu.
    expect(await screen.findByRole('button', { name: 'Mở lại Dự án' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sửa Dự án' })).not.toBeInTheDocument()
    expect(vung.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument()
    expect(vung.getAllByText(THONG_BAO_DU_AN.daLuuTru).length).toBeGreaterThan(0)
    expect(giaTri(await kho.layDuAn(await phienCua(kho, PM.email), duAn.id)).ten).toBe('Đang mở')
  })

  it('đang tải thì hiện trạng thái đang tải', async () => {
    const goc = taoKho()
    await taoDuAn(goc, 'Một', LUC_TAO)
    const kho: KhoDuLieu = { ...goc, layDuAn: () => new Promise(() => {}) }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await user.click(await screen.findByRole('button', { name: 'Một' }))
    expect(await screen.findByRole('progressbar', { name: 'Đang tải Dự án…' })).toBeInTheDocument()
  })

  it('lỗi tải thì hiện thông báo tiếng Việt, thử lại được và quay về danh sách được', async () => {
    const goc = taoKho()
    await taoDuAn(goc, 'Một', LUC_TAO)
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      layDuAn: async (phien, id) => {
        lanGoi += 1
        return lanGoi === 1 ? thatBai('KHONG_TIM_THAY') : goc.layDuAn(phien, id)
      },
    }
    const { user, ungDung } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await user.click(await screen.findByRole('button', { name: 'Một' }))

    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent('Không tải được Dự án.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_TIM_THAY)
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Một' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Về danh sách Dự án' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Tất cả Dự án' })).toBeInTheDocument()
  })
})
