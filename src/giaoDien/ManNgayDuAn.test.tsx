// @vitest-environment jsdom
// Ngày bắt đầu, Ngày kết thúc dự kiến và nhãn Quá hạn dự kiến trên giao diện (ticket truong-moi 02): ô ngày
// trong biểu mẫu tạo và sửa Dự án, lỗi cạnh ô, hai ngày dạng ngày/tháng/năm ở dải tóm tắt và nhãn Quá hạn
// dự kiến khi đúng điều kiện. Ngày hôm nay là đồng hồ truyền vào ứng dụng, không đọc giờ thật.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { THONG_BAO_DU_AN } from '../luat/duAn'
import type { TrangThaiTask } from '../luat/task'
import { choNganTruot, moTabDuAn } from '../test/khungUngDung'
import { maDuAnMoi } from '../test/maDuAn'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-02-20T03:00:00Z') // 10:00 ở Việt Nam
/** Hôm nay theo giờ Việt Nam là 26/11/2026 (đồng hồ ứng dụng, cũng là giờ lưu Dấu vết). */
const HOM_NAY = new Date('2026-11-26T09:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

function dungApp(kho: KhoBoNho, bayGio: Date = HOM_NAY) {
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => bayGio} />)
  return { user, ungDung: within(container) }
}

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function phienCua(kho: KhoDuLieu, email: string): Promise<Phien> {
  return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
}

async function taoDuAn(
  kho: KhoBoNho,
  ten: string,
  ngay: { ngayBatDau?: string | null; ngayKetThucDuKien?: string | null } = {},
): Promise<DuAn> {
  return giaTri(await kho.taoDuAn(await phienCua(kho, PM.email), { ma: maDuAnMoi(), ten, ...ngay }, LUC_TAO))
}

/** Thêm hai người vào Dự án và tạo một Task cho mỗi trạng thái trong `cacTrangThai`. */
async function taoTask(kho: KhoBoNho, duAn: DuAn, cacTrangThai: TrangThaiTask[]) {
  const pm = await phienCua(kho, PM.email)
  const nguoi: string[] = []
  for (const [email, ten] of [
    [`an-${duAn.id}@vi-du.vn`, 'An'],
    [`binh-${duAn.id}@vi-du.vn`, 'Bình'],
  ]) {
    nguoi.push(giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten })).id)
    await kho.moPhong.xacNhanEmail(email)
    giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email }))
  }
  for (const [i, trangThai] of cacTrangThai.entries()) {
    const task = giaTri(
      await kho.taoTask(pm, duAn.id, { tieuDe: `Việc ${i + 1}`, nguoiThucHienId: nguoi[0], nguoiKiemTraId: nguoi[1] }, LUC_TAO),
    )
    if (trangThai !== 'MOI') giaTri(await kho.chuDuAn.datTrangThaiTask(task.id, trangThai))
  }
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

/** Mở chi tiết Dự án `ten` từ "Tất cả Dự án" và chờ dải tóm tắt tính xong Tiến độ. */
async function moChiTiet(user: User, ten: string, trangThai: 'HOAT_DONG' | 'LUU_TRU' = 'HOAT_DONG') {
  await moMuc(user, 'Tất cả Dự án')
  if (trangThai === 'LUU_TRU') await user.click(screen.getByRole('radio', { name: 'Lưu trữ' }))
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
  await waitFor(() => expect(o('Tiến độ của Dự án')).not.toHaveTextContent('Đang tính…'))
}

function tomTat() {
  return within(screen.getByRole('group', { name: 'Tóm tắt Dự án' }))
}

/** Một ô có tên trong dải tóm tắt. */
function o(ten: string) {
  return tomTat().getByRole('group', { name: ten })
}

/** Thông báo lỗi Astryx đặt cạnh ô (mô tả truy cập được của ô). */
function loiCanhO(oNhap: HTMLElement, thongBao: string) {
  expect(oNhap).toHaveAccessibleDescription(expect.stringContaining(thongBao))
}

/** Dán một ngày `YYYY-MM-DD` vào ô ngày rồi rời ô (DateInput đọc chữ gõ khi rời ô). */
async function nhapNgay(user: User, oNgay: HTMLElement, ngay: string) {
  await user.click(oNgay)
  await user.paste(ngay)
  await user.tab()
}

async function choNganDong() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

describe('dải tóm tắt: hai ngày và nhãn Quá hạn dự kiến', () => {
  it('hiện hai ngày dạng ngày/tháng/năm; kết thúc hôm qua, Tiến độ 50%: có nhãn Quá hạn dự kiến bằng chữ', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const duAn = await taoDuAn(kho, 'Cửa hàng', { ngayBatDau: '2026-05-01', ngayKetThucDuKien: '2026-11-25' })
    await taoTask(kho, duAn, ['HOAN_THANH', 'DANG_LAM'])
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moChiTiet(user, 'Cửa hàng')

    expect(within(o('Ngày bắt đầu')).getByText('01/05/2026')).toBeInTheDocument()
    expect(within(o('Ngày kết thúc dự kiến')).getByText('25/11/2026')).toBeInTheDocument()
    expect(o('Tiến độ của Dự án')).toHaveTextContent('50%')
    expect(tomTat().getByText('Quá hạn dự kiến')).toBeInTheDocument()
  })

  it('Dự án "chưa có task" mà đã qua Ngày kết thúc dự kiến: có nhãn', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    await taoDuAn(kho, 'Cửa hàng', { ngayKetThucDuKien: '2026-11-25' })
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moChiTiet(user, 'Cửa hàng')
    expect(o('Tiến độ của Dự án')).toHaveTextContent('chưa có task')
    expect(tomTat().getByText('Quá hạn dự kiến')).toBeInTheDocument()
  })

  it.each<{ ca: string; ngayKetThucDuKien: string | null; task: TrangThaiTask[]; luuTru?: true; hienKetThuc: string }>([
    { ca: 'kết thúc đúng hôm nay', ngayKetThucDuKien: '2026-11-26', task: ['MOI'], hienKetThuc: '26/11/2026' },
    { ca: 'Tiến độ 100%', ngayKetThucDuKien: '2026-11-25', task: ['HOAN_THANH', 'HUY'], hienKetThuc: '25/11/2026' },
    { ca: 'Dự án đã Lưu trữ', ngayKetThucDuKien: '2026-11-25', task: ['MOI'], luuTru: true, hienKetThuc: '25/11/2026' },
    { ca: 'không có Ngày kết thúc dự kiến', ngayKetThucDuKien: null, task: ['MOI'], hienKetThuc: 'Chưa ghi' },
  ])('$ca: không có nhãn Quá hạn dự kiến', async ({ ngayKetThucDuKien, task, luuTru, hienKetThuc }) => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const duAn = await taoDuAn(kho, 'Cửa hàng', { ngayKetThucDuKien })
    await taoTask(kho, duAn, task)
    if (luuTru) giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), duAn.id, LUC_TAO))
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moChiTiet(user, 'Cửa hàng', luuTru ? 'LUU_TRU' : 'HOAT_DONG')
    expect(within(o('Ngày kết thúc dự kiến')).getByText(hienKetThuc)).toBeInTheDocument()
    expect(within(o('Ngày bắt đầu')).getByText('Chưa ghi')).toBeInTheDocument()
    expect(tomTat().queryByText('Quá hạn dự kiến')).not.toBeInTheDocument()
  })

  it('mốc theo giờ Việt Nam: kết thúc 25/11, lúc 23:59 ngày 25/11 chưa có nhãn, lúc 00:00 ngày 26/11 thì có', async () => {
    for (const [bayGio, coNhan] of [
      [new Date('2026-11-25T23:59:00+07:00'), false],
      [new Date('2026-11-26T00:00:00+07:00'), true],
    ] as const) {
      const kho = taoKhoBoNho({ pmBanDau: PM })
      await taoDuAn(kho, 'Cửa hàng', { ngayKetThucDuKien: '2026-11-25' })
      const { user } = dungApp(kho, bayGio)
      await dangNhap(user, PM.email)
      await moChiTiet(user, 'Cửa hàng')
      expect(tomTat().queryByText('Quá hạn dự kiến') !== null).toBe(coNhan)
      cleanup()
    }
  })
})

describe('ô ngày trong biểu mẫu Dự án', () => {
  it('PM tạo Dự án với hai ngày: dải tóm tắt hiện đúng hai ngày dạng ngày/tháng/năm', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moMuc(user, 'Tất cả Dự án')
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    const ngan = within(await choNganTruot('Tạo Dự án'))
    await user.type(ngan.getByLabelText('Mã Dự án'), 'CH-1')
    await user.type(ngan.getByLabelText('Tên Dự án'), 'Cửa hàng')
    await nhapNgay(user, ngan.getByLabelText('Ngày bắt đầu'), '2026-12-01')
    await nhapNgay(user, ngan.getByLabelText('Ngày kết thúc dự kiến'), '2026-12-01')
    await user.click(ngan.getByRole('button', { name: 'Tạo Dự án' }))
    await choNganDong()

    const ds = giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))
    expect(ds).toEqual([expect.objectContaining({ ten: 'Cửa hàng', ngayBatDau: '2026-12-01', ngayKetThucDuKien: '2026-12-01' })])
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
    expect(within(o('Ngày bắt đầu')).getByText('01/12/2026')).toBeInTheDocument()
    expect(within(o('Ngày kết thúc dự kiến')).getByText('01/12/2026')).toBeInTheDocument()
  })

  it('Ngày kết thúc dự kiến trước Ngày bắt đầu: lỗi tiếng Việt cạnh ô Ngày kết thúc dự kiến, ngăn vẫn mở, không tạo gì', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moMuc(user, 'Tất cả Dự án')
    await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
    const ngan = within(await choNganTruot('Tạo Dự án'))
    await user.type(ngan.getByLabelText('Mã Dự án'), 'CH-1')
    await user.type(ngan.getByLabelText('Tên Dự án'), 'Cửa hàng')
    await nhapNgay(user, ngan.getByLabelText('Ngày bắt đầu'), '2026-12-02')
    await nhapNgay(user, ngan.getByLabelText('Ngày kết thúc dự kiến'), '2026-12-01')
    await user.click(ngan.getByRole('button', { name: 'Tạo Dự án' }))

    expect(await ngan.findByText('Chưa tạo được Dự án.')).toBeInTheDocument()
    loiCanhO(ngan.getByLabelText('Ngày kết thúc dự kiến'), THONG_BAO_DU_AN.ngayKetThucTruocBatDau)
    expect(screen.getByRole('dialog', { name: 'Tạo Dự án' })).toBeInTheDocument()
    expect(giaTri(await kho.danhSachDuAn(await phienCua(kho, PM.email)))).toEqual([])
  })

  it('PM sửa hai ngày trong Ngăn trượt: ô có ngày đang có; lưu được thì dải tóm tắt, nhãn Quá hạn dự kiến và Dấu vết cập nhật', async () => {
    const kho = taoKhoBoNho({ pmBanDau: PM })
    await taoDuAn(kho, 'Cửa hàng', { ngayBatDau: '2026-05-01', ngayKetThucDuKien: '2026-12-31' })
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moChiTiet(user, 'Cửa hàng')
    expect(tomTat().queryByText('Quá hạn dự kiến')).not.toBeInTheDocument()
    await moTabDuAn(user, 'Thông tin')

    await user.click(screen.getByRole('button', { name: 'Sửa Dự án' }))
    const ngan = within(await choNganTruot('Sửa Dự án'))
    expect(ngan.getByLabelText('Ngày bắt đầu')).toHaveValue('2026-05-01')
    expect(ngan.getByLabelText('Ngày kết thúc dự kiến')).toHaveValue('2026-12-31')

    await user.clear(ngan.getByLabelText('Ngày kết thúc dự kiến'))
    await nhapNgay(user, ngan.getByLabelText('Ngày kết thúc dự kiến'), '2026-11-20')
    await user.click(ngan.getByRole('button', { name: 'Lưu thay đổi' }))
    await choNganDong()
    expect(await ungDung.findByText('Đã lưu thay đổi.')).toBeInTheDocument()

    expect(within(o('Ngày bắt đầu')).getByText('01/05/2026')).toBeInTheDocument()
    expect(within(o('Ngày kết thúc dự kiến')).getByText('20/11/2026')).toBeInTheDocument()
    expect(tomTat().getByText('Quá hạn dự kiến')).toBeInTheDocument()
    const dauVet = within(screen.getByRole('group', { name: 'Dấu vết' }))
    expect(dauVet.getByText('Người chỉnh sửa gần nhất: An PM')).toBeInTheDocument()
    expect(dauVet.getByText('Ngày chỉnh sửa gần nhất: 26/11/2026 09:00')).toBeInTheDocument()
  })
})
