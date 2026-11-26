// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import type { TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { choNganTruot, dongNganTruot } from '../test/khungUngDung'
import { maDuAnMoi } from '../test/maDuAn'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-03-01T08:00:00+07:00')
/** Đồng hồ ứng dụng: 00:00 ngày 26/11 giờ Việt Nam, nên Task hạn 25/11 đã trễ. */
const BAY_GIO = new Date('2026-11-26T00:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

function dungApp(goc: KhoBoNho, kho: KhoDuLieu = goc, dongHo: () => Date = () => BAY_GIO) {
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={goc.moPhong} dongHo={dongHo} />)
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
  return hoSo.id
}

async function taoDuAn(kho: KhoBoNho, ten: string, emails: string[] = []): Promise<DuAn> {
  const pm = await phienCua(kho, PM.email)
  const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten }, LUC_TAO))
  for (const email of emails) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email }))
  return duAn
}

async function taoTask(
  kho: KhoBoNho,
  duAnId: string,
  tieuDe: string,
  thucHien: string,
  kiemTra: string,
  trangThai: TrangThaiTask = 'MOI',
  han: string | null = null,
): Promise<Task> {
  const task = giaTri(
    await kho.taoTask(
      await phienCua(kho, PM.email),
      duAnId,
      { tieuDe, han, nguoiThucHienId: thucHien, nguoiKiemTraId: kiemTra },
      LUC_TAO,
    ),
  )
  if (trangThai !== 'MOI') giaTri(await kho.chuDuAn.datTrangThaiTask(task.id, trangThai))
  return task
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

async function moTongQuan(user: User) {
  await user.click(screen.getByRole('button', { name: 'Tổng quan' }))
  await screen.findByRole('heading', { level: 2, name: 'Tổng quan' })
}

/** Ô của dòng Dự án `ten` trong bảng, theo chữ trong ô. */
async function dongDuAn(ten: string) {
  const nut = await screen.findByRole('button', { name: ten })
  const dong = nut.closest('tr')
  if (!dong) throw new Error(`Không thấy dòng của Dự án ${ten}`)
  return within(dong)
}

/** Con số trong ô số `nhan` của hàng ô số. */
async function soTrongO(nhan: string): Promise<string | null> {
  const hang = await screen.findByRole('group', { name: 'Số liệu chính' })
  const o = within(hang).getByRole('group', { name: nhan })
  const so = within(o).getAllByText(/^\d+$/)
  return so[0]?.textContent ?? null
}

async function dungBoiCanh() {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const an = await taoNguoi(kho, 'an@vi-du.vn', 'An')
  const binh = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình')
  await taoNguoi(kho, 'cuong@vi-du.vn', 'Cường')
  return { kho, an, binh }
}

describe('Tổng quan', () => {
  it('PM thấy mọi Dự án (kể cả Dự án PM không ở trong): tên, Tiến độ, số Task Trễ hạn; phân bố theo trạng thái', async () => {
    const { kho, an, binh } = await dungBoiCanh()
    const cuaHang = await taoDuAn(kho, 'Cửa hàng', ['an@vi-du.vn', 'binh@vi-du.vn'])
    await taoDuAn(kho, 'Kho hàng', ['an@vi-du.vn'])
    await taoDuAn(kho, 'Dự án mới')
    await taoTask(kho, cuaHang.id, 'Xong', an, binh, 'HOAN_THANH')
    await taoTask(kho, cuaHang.id, 'Huỷ', an, binh, 'HUY')
    await taoTask(kho, cuaHang.id, 'Mới', an, binh)
    await taoTask(kho, cuaHang.id, 'Đang làm', an, binh, 'DANG_LAM', '2026-11-25')
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTongQuan(user)

    const ch = await dongDuAn('Cửa hàng')
    expect(ch.getByText('33%')).toBeInTheDocument()
    expect(ch.getByRole('cell', { name: '1' })).toBeInTheDocument()

    // Dự án không có Task đáng tính: "chưa có task", không phải 0%, và 0 Task Trễ hạn.
    const moi = await dongDuAn('Dự án mới')
    expect(moi.getByText('chưa có task')).toBeInTheDocument()
    expect(moi.queryByText('0%')).not.toBeInTheDocument()
    expect(moi.getByRole('cell', { name: '0' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kho hàng' })).toBeInTheDocument()

    const phanBo = within(screen.getByRole('group', { name: 'Phân bố Task theo trạng thái' }))
    const thanh = (ten: string) => phanBo.getByRole('progressbar', { name: ten })
    expect(thanh('Mới')).toHaveAttribute('aria-valuenow', '1')
    expect(thanh('Đang làm')).toHaveAttribute('aria-valuenow', '1')
    expect(thanh('Chờ duyệt')).toHaveAttribute('aria-valuenow', '0')
    expect(thanh('Hoàn thành')).toHaveAttribute('aria-valuenow', '1')
    expect(thanh('Huỷ')).toHaveAttribute('aria-valuenow', '1')
    expect(thanh('Huỷ')).toHaveAttribute('aria-valuemax', '4')
  })

  it('còn Task chưa xong thì không hiện 100%; xong hết (Huỷ không cản) thì hiện 100%', async () => {
    const { kho, an, binh } = await dungBoiCanh()
    const a = await taoDuAn(kho, 'Gần xong', ['an@vi-du.vn', 'binh@vi-du.vn'])
    const b = await taoDuAn(kho, 'Xong hết', ['an@vi-du.vn', 'binh@vi-du.vn'])
    for (let i = 1; i <= 6; i++) await taoTask(kho, a.id, `Xong ${i}`, an, binh, 'HOAN_THANH')
    await taoTask(kho, a.id, 'Chờ', an, binh, 'CHO_DUYET')
    await taoTask(kho, b.id, 'Xong', an, binh, 'HOAN_THANH')
    await taoTask(kho, b.id, 'Bỏ', an, binh, 'HUY')
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTongQuan(user)
    expect((await dongDuAn('Gần xong')).getByText('85%')).toBeInTheDocument()
    expect((await dongDuAn('Xong hết')).getByText('100%')).toBeInTheDocument()
  })

  it('Thành viên chỉ thấy Dự án mình ở trong; ô Chờ tôi duyệt và Việc của tôi tính Task của riêng mình', async () => {
    const { kho, an, binh } = await dungBoiCanh()
    const cuaHang = await taoDuAn(kho, 'Cửa hàng', ['an@vi-du.vn', 'binh@vi-du.vn'])
    const khac = await taoDuAn(kho, 'Dự án của người khác', ['binh@vi-du.vn', 'cuong@vi-du.vn'])
    await taoTask(kho, cuaHang.id, 'An làm', an, binh)
    await taoTask(kho, cuaHang.id, 'An duyệt', binh, an, 'CHO_DUYET')
    await taoTask(kho, cuaHang.id, 'An xong', an, binh, 'HOAN_THANH')
    await taoTask(kho, cuaHang.id, 'Bình làm', binh, an, 'MOI')
    await taoTask(kho, khac.id, 'Việc người khác trễ', binh, (await phienCua(kho, 'cuong@vi-du.vn')).nguoiDungId, 'MOI', '2026-11-01')
    const { user } = dungApp(kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moTongQuan(user)
    await dongDuAn('Cửa hàng')
    // Việc của tôi: "An làm" ("An xong" đã chốt). Chờ tôi duyệt: "An duyệt". Task đang mở: 3 của Cửa hàng.
    expect(await soTrongO('Việc của tôi')).toBe('1')
    expect(await soTrongO('Chờ tôi duyệt')).toBe('1')
    expect(await soTrongO('Task đang mở')).toBe('3')
    expect(await soTrongO('Dự án đang hoạt động')).toBe('1')
    expect(await soTrongO('Task Trễ hạn')).toBe('0')
    expect(screen.queryByRole('button', { name: 'Dự án của người khác' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Việc người khác trễ' })).not.toBeInTheDocument()
  })

  it('không còn bảng Dự án đã Lưu trữ ở Tổng quan; Task của Dự án Lưu trữ không được tính; PM vẫn xem ở Tất cả Dự án', async () => {
    const { kho, an, binh } = await dungBoiCanh()
    const cu = await taoDuAn(kho, 'Dự án cũ', ['an@vi-du.vn', 'binh@vi-du.vn'])
    await taoDuAn(kho, 'Đang chạy')
    await taoTask(kho, cu.id, 'Việc cũ trễ', an, binh, 'DANG_LAM', '2026-11-01')
    giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), cu.id, LUC_TAO))
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTongQuan(user)
    const hoatDong = within(await screen.findByRole('table', { name: 'Bảng Dự án đang hoạt động' }))
    expect(hoatDong.getByRole('button', { name: 'Đang chạy' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Dự án đã Lưu trữ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dự án cũ' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Việc cũ trễ' })).not.toBeInTheDocument()
    expect(await soTrongO('Task đang mở')).toBe('0')
    expect(await soTrongO('Task Trễ hạn')).toBe('0')

    await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
    await user.click(await screen.findByRole('radio', { name: 'Lưu trữ' }))
    expect(await screen.findByRole('button', { name: 'Dự án cũ' })).toBeInTheDocument()
  })

  it('người chưa ở Dự án nào thấy trạng thái trống', async () => {
    const { kho } = await dungBoiCanh()
    await taoDuAn(kho, 'Của người khác')
    const { user } = dungApp(kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moTongQuan(user)
    expect(
      await screen.findByRole('heading', { level: 3, name: /bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Dự án đang hoạt động' })).not.toBeInTheDocument()
  })

  it('đang tải thì hiện chỉ báo, lỗi thì báo bằng tiếng Việt và Thử lại tải lại được', async () => {
    const { kho: goc } = await dungBoiCanh()
    await taoDuAn(goc, 'Cửa hàng')
    let lanGoi = 0
    let tiepTuc: () => void = () => {}
    const kho: KhoDuLieu = {
      ...goc,
      danhSachDuAn: async (phien, loc) => {
        lanGoi += 1
        if (lanGoi === 1) {
          await new Promise<void>((xong) => (tiepTuc = xong))
          return thatBai('LOI_HE_THONG')
        }
        return goc.danhSachDuAn(phien, loc)
      },
    }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await user.click(screen.getByRole('button', { name: 'Tổng quan' }))
    // Tìm theo vai trò: tải lâu thì vùng thông báo (live region) của Astryx cũng đọc lại chữ này.
    expect(await screen.findByRole('progressbar', { name: 'Đang tải tổng quan…' })).toBeInTheDocument()
    // Tổng quan giờ là trang đầu nên bắt đầu tải ngay khi đăng nhập; chờ lần đọc đầu thật sự đến Kho.
    await waitFor(() => expect(lanGoi).toBeGreaterThanOrEqual(1))
    tiepTuc()
    expect(await screen.findByText('Không tải được tổng quan.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('button', { name: 'Cửa hàng' })).toBeInTheDocument()
  })

  it('trang Dự án liệt kê các Task Trễ hạn (kể cả Chờ duyệt quá hạn), không liệt kê Task chưa tới hạn hay đã xong', async () => {
    const { kho, an, binh } = await dungBoiCanh()
    const cuaHang = await taoDuAn(kho, 'Cửa hàng', ['an@vi-du.vn', 'binh@vi-du.vn'])
    await taoTask(kho, cuaHang.id, 'Giao hàng', an, binh, 'DANG_LAM', '2026-11-25')
    await taoTask(kho, cuaHang.id, 'Chờ duyệt quá hạn', an, binh, 'CHO_DUYET', '2026-11-20')
    await taoTask(kho, cuaHang.id, 'Hạn hôm nay', an, binh, 'MOI', '2026-11-26')
    await taoTask(kho, cuaHang.id, 'Đã xong', an, binh, 'HOAN_THANH', '2026-11-01')
    await taoTask(kho, cuaHang.id, 'Không hạn', an, binh)
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTongQuan(user)
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    const nhom = within(await screen.findByRole('group', { name: 'Task Trễ hạn' }))
    const cacTask = nhom
      .getAllByRole('button')
      .map((n) => n.textContent)
    // Hạn cũ nhất trước.
    expect(cacTask).toEqual(['Chờ duyệt quá hạn', 'Giao hàng'])
  })

  it('trước nửa đêm giờ Việt Nam Task hạn hôm nay chưa trễ: tổng quan không có cờ, trang Dự án không có danh sách', async () => {
    const { kho, an, binh } = await dungBoiCanh()
    const cuaHang = await taoDuAn(kho, 'Cửa hàng', ['an@vi-du.vn', 'binh@vi-du.vn'])
    await taoTask(kho, cuaHang.id, 'Giao hàng', an, binh, 'DANG_LAM', '2026-11-25')
    const { user } = dungApp(kho, kho, () => new Date('2026-11-25T23:59:00+07:00'))
    await dangNhap(user, PM.email)
    await moTongQuan(user)
    const ch = await dongDuAn('Cửa hàng')
    expect(ch.queryByText(/Trễ hạn/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cửa hàng' }))
    await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
    await screen.findByRole('group', { name: 'Bảng Kanban' })
    expect(screen.queryByRole('group', { name: 'Task Trễ hạn' })).not.toBeInTheDocument()
  })

  it('hai danh sách Task: Trễ hạn (trễ lâu nhất trước) và tới hạn trong 7 ngày (hôm nay đến ngày thứ bảy), kèm Dự án, Người thực hiện, hạn', async () => {
    const { kho, an, binh } = await dungBoiCanh()
    const cuaHang = await taoDuAn(kho, 'Cửa hàng', ['an@vi-du.vn', 'binh@vi-du.vn'])
    const khoHang = await taoDuAn(kho, 'Kho hàng', ['an@vi-du.vn', 'binh@vi-du.vn'])
    await taoTask(kho, cuaHang.id, 'Trễ 1 ngày', an, binh, 'DANG_LAM', '2026-11-25')
    await taoTask(kho, khoHang.id, 'Trễ 6 ngày', binh, an, 'CHO_DUYET', '2026-11-20')
    await taoTask(kho, cuaHang.id, 'Hạn ngày thứ bảy', an, binh, 'MOI', '2026-12-03')
    await taoTask(kho, khoHang.id, 'Hạn hôm nay', binh, an, 'TRA_LAI', '2026-11-26')
    await taoTask(kho, cuaHang.id, 'Hạn ngày thứ tám', an, binh, 'MOI', '2026-12-04')
    await taoTask(kho, cuaHang.id, 'Xong sắp hạn', an, binh, 'HOAN_THANH', '2026-11-27')
    await taoTask(kho, cuaHang.id, 'Huỷ đã trễ', an, binh, 'HUY', '2026-11-01')
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTongQuan(user)

    const dongCua = (bang: HTMLElement) =>
      within(bang)
        .getAllByRole('row')
        .slice(1)
        .map((dong) => within(dong).getAllByRole('cell').map((o) => o.textContent))
    const treHan = await screen.findByRole('table', { name: 'Task Trễ hạn' })
    // Mã Dự án đứng cạnh tên Dự án.
    expect(dongCua(treHan)).toEqual([
      ['Trễ 6 ngày', khoHang.ma, 'Kho hàng', 'Bình', '20/11/2026'],
      ['Trễ 1 ngày', cuaHang.ma, 'Cửa hàng', 'An', '25/11/2026'],
    ])
    const toiHan = screen.getByRole('table', { name: 'Task tới hạn trong 7 ngày' })
    expect(dongCua(toiHan)).toEqual([
      ['Hạn hôm nay', khoHang.ma, 'Kho hàng', 'Bình', '26/11/2026'],
      ['Hạn ngày thứ bảy', cuaHang.ma, 'Cửa hàng', 'An', '03/12/2026'],
    ])
    expect(await soTrongO('Task Trễ hạn')).toBe('2')

    // Bấm một Task mở Task trong Ngăn trượt, Tổng quan ở nguyên phía sau; đóng ngăn thì vẫn ở Tổng quan.
    await user.click(within(toiHan).getByRole('button', { name: 'Hạn hôm nay' }))
    const ngan = within(await choNganTruot('Hạn hôm nay'))
    expect(ngan.getByRole('heading', { level: 2, name: 'Hạn hôm nay' })).toBeInTheDocument()
    expect(await ngan.findByRole('group', { name: 'Thông tin Task' })).toHaveTextContent('Người thực hiện: Bình')
    expect(screen.getByRole('table', { name: 'Task Trễ hạn' })).toBeInTheDocument()
    await dongNganTruot(user)
    expect(screen.getByRole('heading', { level: 2, name: 'Tổng quan' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Task Trễ hạn' })).toBeInTheDocument()
  })

  it('không có Task Trễ hạn hay tới hạn thì hai danh sách báo trống', async () => {
    const { kho, an, binh } = await dungBoiCanh()
    const cuaHang = await taoDuAn(kho, 'Cửa hàng', ['an@vi-du.vn', 'binh@vi-du.vn'])
    await taoTask(kho, cuaHang.id, 'Không hạn', an, binh)
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTongQuan(user)
    expect(await screen.findByRole('heading', { name: 'Không có Task Trễ hạn.' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Không có Task tới hạn trong 7 ngày.' })).toBeInTheDocument()
  })

  it('bấm ô Chờ tôi duyệt, Việc của tôi mở đúng trang; bấm dòng Dự án mở Dự án đó', async () => {
    const { kho, an, binh } = await dungBoiCanh()
    const cuaHang = await taoDuAn(kho, 'Cửa hàng', ['an@vi-du.vn', 'binh@vi-du.vn'])
    await taoTask(kho, cuaHang.id, 'An làm', an, binh, 'DANG_LAM')
    await taoTask(kho, cuaHang.id, 'Bình làm, An duyệt', binh, an, 'CHO_DUYET')
    const { user } = dungApp(kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moTongQuan(user)

    await user.click(await screen.findByRole('button', { name: /^Chờ tôi duyệt: 1\./ }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Chờ tôi duyệt' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Bình làm, An duyệt' })).toBeInTheDocument()

    await moTongQuan(user)
    await user.click(await screen.findByRole('button', { name: /^Việc của tôi: 1\./ }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Việc của tôi' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'An làm' })).toBeInTheDocument()

    await moTongQuan(user)
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })).toBeInTheDocument()
  })

  it('trạng thái trống: PM tạo Dự án trong Ngăn trượt, ngăn đóng và Dự án mới hiện ở Tổng quan; Support và Thành viên chưa ở Dự án nào không thấy nút', async () => {
    const { kho } = await dungBoiCanh()
    await taoNguoi(kho, 'support@vi-du.vn', 'Sơn', 'SUPPORT')
    const { user, ungDung } = dungApp(kho)
    const canhBao = vi.spyOn(console, 'warn')
    try {
      await dangNhap(user, PM.email)
      await moTongQuan(user)
      expect(await screen.findByRole('heading', { level: 3, name: 'Chưa có Dự án đang hoạt động nào.' })).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Số liệu chính' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Tạo Dự án' }))
      const ngan = within(await choNganTruot('Tạo Dự án'))
      // Tổng quan ở nguyên phía sau ngăn.
      expect(ungDung.getByRole('heading', { level: 2, name: 'Tổng quan' })).toBeInTheDocument()
      await user.type(ngan.getByLabelText(/Mã Dự án/), 'da-1')
      await user.type(ngan.getByLabelText(/Tên Dự án/), 'Dự án 1')
      await user.click(ngan.getByRole('button', { name: 'Tạo Dự án' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(await ungDung.findByText('Đã tạo Dự án Dự án 1.')).toBeInTheDocument()
      // Tổng quan đọc lại: Dự án mới vào bảng Dự án đang hoạt động, hết trạng thái trống.
      expect(await screen.findByRole('button', { name: 'Dự án 1' })).toBeInTheDocument()
      expect(screen.queryByRole('heading', { name: 'Chưa có Dự án đang hoạt động nào.' })).not.toBeInTheDocument()
      expect(canhBao.mock.calls.filter((loi) => String(loi[0]).includes('focus'))).toEqual([])
    } finally {
      canhBao.mockRestore()
    }

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    await dangNhap(user, 'support@vi-du.vn')
    await moTongQuan(user)
    expect(
      await screen.findByRole('heading', { level: 3, name: /bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn/i }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tạo Dự án' })).not.toBeInTheDocument()
  })
})
