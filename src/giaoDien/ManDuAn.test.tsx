// @vitest-environment jsdom
import { screen, render, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { THONG_BAO_MAC_DINH, thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { DO_DAI_TEN_DU_AN_TOI_DA, THONG_BAO_DU_AN } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'

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
  return giaTri(await kho.taoDuAn(await phienCua(kho, PM.email), { ten, moTa }, luc))
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

describe('màn tạo Dự án', () => {
  it('PM tạo Dự án: sang màn chi tiết với dấu vết theo người gọi và đồng hồ, chưa có phần chỉnh sửa', async () => {
    const kho = taoKho()
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    await screen.findByRole('heading', { level: 2, name: 'Tạo Dự án' })

    await user.type(screen.getByLabelText('Tên Dự án'), '  Website bán hàng  ')
    await user.type(screen.getByLabelText('Mô tả'), 'Làm lại trang chủ')
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))

    expect(await screen.findByRole('heading', { level: 2, name: 'Website bán hàng' })).toBeInTheDocument()
    expect(ungDung.getByText('Đã tạo Dự án Website bán hàng.')).toBeInTheDocument()
    expect(dauVet().getByText('Người tạo: An PM')).toBeInTheDocument()
    expect(dauVet().getByText('Ngày tạo: 01/03/2026 08:00')).toBeInTheDocument()
    expect(dauVet().queryByText(/chỉnh sửa gần nhất/)).not.toBeInTheDocument()
    expect(screen.getByLabelText('Mô tả')).toHaveValue('Làm lại trang chủ')

    const ds = giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))
    expect(ds).toEqual([
      expect.objectContaining({
        ten: 'Website bán hàng',
        moTa: 'Làm lại trang chủ',
        trangThai: 'HOAT_DONG',
        dauVet: expect.objectContaining({ taoLuc: LUC, suaBoi: null, suaLuc: null }),
      }),
    ])
  })

  it.each([
    { ca: 'tên chỉ khoảng trắng', ten: '   ', thongBao: THONG_BAO_DU_AN.tenTrong },
    { ca: 'tên quá 120 ký tự', ten: 'a'.repeat(DO_DAI_TEN_DU_AN_TOI_DA + 1), thongBao: THONG_BAO_DU_AN.tenQuaDai },
  ])('$ca bị từ chối kèm thông báo tiếng Việt, không tạo gì', async ({ ten, thongBao }) => {
    const kho = taoKho()
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    await screen.findByRole('heading', { level: 2, name: 'Tạo Dự án' })

    await user.click(screen.getByLabelText('Tên Dự án'))
    await user.paste(ten)
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))

    expect((await screen.findAllByText(thongBao)).length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { level: 2, name: 'Tạo Dự án' })).toBeInTheDocument()
    expect(giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))).toEqual([])
  })

  it('bấm tạo khi đã mất vai PM thì hiện lý do bị từ chối', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, taoDuAn: async () => thatBai('KHONG_CO_QUYEN') }
    const { user, ungDung } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    await user.type(await screen.findByLabelText('Tên Dự án'), 'Dự án X')
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent('Chưa tạo được Dự án.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_CO_QUYEN)
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
    giaTri(await kho.taoDuAn(phienBinh, { ten: 'Hai' }, new Date('2026-04-12T01:15:00Z')))
    const ba = await taoDuAn(kho, 'Ba', new Date('2026-04-13T00:00:00Z'))
    giaTri(await kho.luuTruDuAn(phienBinh, ba.id, new Date('2026-05-01T10:00:00Z')))

    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)

    const bang = await screen.findByRole('table', { name: 'Danh sách Dự án' })
    expect(within(bang).getByRole('button', { name: 'Một' })).toBeInTheDocument()
    expect(within(bang).getByRole('button', { name: 'Hai' })).toBeInTheDocument()
    expect(within(bang).queryByRole('button', { name: 'Ba' })).not.toBeInTheDocument()
    expect(within(bang).getByText('11/04/2026 03:00')).toBeInTheDocument()
    expect(within(bang).getByText('12/04/2026 08:15')).toBeInTheDocument()
    expect(within(bang).getByText('Bình PM')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: 'Lưu trữ' }))
    const bangLuuTru = await screen.findByRole('table', { name: 'Danh sách Dự án' })
    expect(await within(bangLuuTru).findByRole('button', { name: 'Ba' })).toBeInTheDocument()
    expect(within(bangLuuTru).queryByRole('button', { name: 'Một' })).not.toBeInTheDocument()
    // Lưu trữ là một lần chỉnh sửa: hiện người và ngày chỉnh sửa gần nhất theo giờ Việt Nam.
    expect(within(bangLuuTru).getByText('Bình PM, 01/05/2026 17:00')).toBeInTheDocument()
  })

  it('đang tải thì hiện trạng thái đang tải', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, danhSachDuAn: () => new Promise(() => {}) }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    expect(await screen.findByRole('progressbar', { name: 'Đang tải các Dự án…' })).toBeInTheDocument()
  })

  it('lỗi tải thì hiện thông báo tiếng Việt và thử lại được', async () => {
    const goc = taoKho()
    await taoDuAn(goc, 'Một', LUC)
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      danhSachDuAn: async (phien, loc) => {
        lanGoi += 1
        return lanGoi === 1 ? thatBai('KHONG_TIM_THAY') : goc.danhSachDuAn(phien, loc)
      },
    }
    const { user, ungDung } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)

    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent('Không tải được các Dự án.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_TIM_THAY)
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('button', { name: 'Một' })).toBeInTheDocument()
  })

  it('phiên hết hạn khi tải danh sách thì quay về màn đăng nhập', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, danhSachDuAn: async () => thatBai('CHUA_DANG_NHAP') }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Đăng nhập' })).toBeInTheDocument()
  })
})

describe('màn chi tiết Dự án', () => {
  const LUC_TAO = new Date('2026-02-20T03:00:00Z') // 10:00 ở Việt Nam

  it('PM sửa tên và mô tả: dấu vết chỉnh sửa cập nhật, người và ngày tạo giữ nguyên', async () => {
    const kho = taoKho()
    await taoNguoi(kho, 'binh@vi-du.vn', 'Bình PM', 'PM')
    const phienBinh = await phienCua(kho, 'binh@vi-du.vn')
    giaTri(await kho.taoDuAn(phienBinh, { ten: 'Tên cũ', moTa: 'Mô tả cũ' }, LUC_TAO))

    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await moChiTiet(user, 'Tên cũ')

    expect(dauVet().getByText('Người tạo: Bình PM')).toBeInTheDocument()
    expect(dauVet().getByText('Ngày tạo: 20/02/2026 10:00')).toBeInTheDocument()
    expect(dauVet().queryByText(/chỉnh sửa gần nhất/)).not.toBeInTheDocument()

    await user.clear(screen.getByLabelText('Tên Dự án'))
    await user.type(screen.getByLabelText('Tên Dự án'), 'Tên mới')
    await user.clear(screen.getByLabelText('Mô tả'))
    await user.type(screen.getByLabelText('Mô tả'), 'Mô tả mới')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await ungDung.findByText('Đã lưu thay đổi.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Tên mới' })).toBeInTheDocument()
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

  it('sửa tên thành rỗng bị từ chối kèm lý do và không đổi gì', async () => {
    const kho = taoKho()
    await taoDuAn(kho, 'Giữ nguyên', LUC_TAO)
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await moChiTiet(user, 'Giữ nguyên')

    await user.clear(screen.getByLabelText('Tên Dự án'))
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect((await screen.findAllByText(THONG_BAO_DU_AN.tenTrong)).length).toBeGreaterThan(0)
    expect(dauVet().queryByText(/chỉnh sửa gần nhất/)).not.toBeInTheDocument()
    const ds = giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))
    expect(ds[0]).toEqual(expect.objectContaining({ ten: 'Giữ nguyên', dauVet: expect.objectContaining({ suaLuc: null }) }))
  })

  it('Lưu trữ thì chỉ xem được: nút ghi ẩn, ô sửa vô hiệu, có lý do; mở lại thì sửa được trở lại', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Sắp xong', LUC_TAO, 'Mô tả')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await moChiTiet(user, 'Sắp xong')

    await user.click(screen.getByRole('button', { name: 'Lưu trữ Dự án' }))
    expect(await ungDung.findByText('Đã Lưu trữ Dự án. Dự án giờ chỉ xem được.')).toBeInTheDocument()
    expect(ungDung.getAllByText(THONG_BAO_DU_AN.daLuuTru).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu trữ Dự án' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Tên Dự án')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByLabelText('Mô tả')).toHaveAttribute('aria-disabled', 'true')
    // Vẫn xem được, dấu vết cập nhật.
    expect(screen.getByLabelText('Tên Dự án')).toHaveValue('Sắp xong')
    expect(dauVet().getByText('Người chỉnh sửa gần nhất: An PM')).toBeInTheDocument()
    expect(giaTri(await kho.layDuAn(await phienCua(kho, PM.email), duAn.id)).trangThai).toBe('LUU_TRU')

    await user.click(screen.getByRole('button', { name: 'Mở lại Dự án' }))
    expect(await ungDung.findByText('Đã mở lại Dự án. Bạn có thể sửa tiếp.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mở lại Dự án' })).not.toBeInTheDocument()
    expect(ungDung.queryByText(THONG_BAO_DU_AN.daLuuTru)).not.toBeInTheDocument()

    await user.type(screen.getByLabelText('Tên Dự án'), ' 2')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await ungDung.findByText('Đã lưu thay đổi.')).toBeInTheDocument()
    expect(giaTri(await kho.layDuAn(await phienCua(kho, PM.email), duAn.id)).ten).toBe('Sắp xong 2')
  })

  it('Dự án bị Lưu trữ ở nơi khác rồi bấm lưu thì bị từ chối kèm lý do và nút ghi ẩn đi', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Đang mở', LUC_TAO)
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTatCaDuAn(user)
    await moChiTiet(user, 'Đang mở')

    giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), duAn.id, LUC))
    await user.type(screen.getByLabelText('Tên Dự án'), ' sửa')
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent('Chưa lưu được thay đổi.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.DU_AN_DA_LUU_TRU)
    expect(await screen.findByRole('button', { name: 'Mở lại Dự án' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument()
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
