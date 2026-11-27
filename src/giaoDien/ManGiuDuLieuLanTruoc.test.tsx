// @vitest-environment jsdom
// Giữ dữ liệu lần trước khi quay lại màn (ticket toi-uu-hieu-nang 08, spec story 27–32).
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { thatBai, type KetQua, type MaLoi } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import type { TrangThaiTask } from '../luat/task'
import { choTongQuanTaiXong, moTabDuAn, type TabChiTietDuAn } from '../test/khungUngDung'
import { maDuAnMoi } from '../test/maDuAn'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-03-01T08:00:00+07:00')
const BAY_GIO = new Date('2026-11-26T00:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }
const DANG_TAI_TONG_QUAN = 'Đang tải tổng quan…'

type User = ReturnType<typeof userEvent.setup>

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function phienCua(kho: KhoDuLieu, email: string): Promise<Phien> {
  return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
}

async function taoNguoi(kho: KhoBoNho, email: string, tenHienThi: string): Promise<string> {
  const hoSo = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
  await kho.moPhong.xacNhanEmail(email)
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
): Promise<Task> {
  const task = giaTri(
    await kho.taoTask(
      await phienCua(kho, PM.email),
      duAnId,
      { tieuDe, han: null, nguoiThucHienId: thucHien, nguoiKiemTraId: kiemTra },
      LUC_TAO,
    ),
  )
  if (trangThai !== 'MOI') giaTri(await kho.chuDuAn.datTrangThaiTask(task.id, trangThai))
  return task
}

/** PM, An và Bình; Dự án "Cửa hàng" (An, Bình) có hai Task đang mở và một repo; Dự án "Kho hàng" chỉ có PM. */
async function dungBoiCanh() {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const an = await taoNguoi(kho, 'an@vi-du.vn', 'An')
  const binh = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình')
  const cuaHang = await taoDuAn(kho, 'Cửa hàng', ['an@vi-du.vn', 'binh@vi-du.vn'])
  await taoDuAn(kho, 'Kho hàng')
  const dangLam = await taoTask(kho, cuaHang.id, 'Viết trang chủ', an, binh, 'DANG_LAM')
  await taoTask(kho, cuaHang.id, 'Làm giỏ hàng', an, binh)
  giaTri(await kho.ganRepoVaoDuAn(await phienCua(kho, PM.email), cuaHang.id, { repo: 'acme/web' }))
  return { kho, cuaHang, dangLam }
}

/**
 * Chốt do test giữ: khi đóng, mọi lần đọc qua các lệnh được bọc chờ tới khi test mở (và trả lỗi `loi`
 * nếu có), để thấy màn trong lúc đọc lại chưa về.
 */
function taoChot() {
  let cho: Promise<void> | null = null
  let tha = () => {}
  let loi: MaLoi | null = null
  let dangCho = 0
  return {
    dong(maLoi: MaLoi | null = null) {
      loi = maLoi
      cho = new Promise<void>((xong) => {
        tha = xong
      })
    },
    mo() {
      cho = null
      loi = null
      tha()
    },
    get dangCho() {
      return dangCho
    },
    async qua(): Promise<MaLoi | null> {
      if (!cho) return null
      const loiKhiMo = loi
      dangCho += 1
      await cho
      dangCho -= 1
      return loiKhiMo
    },
  }
}
type Chot = ReturnType<typeof taoChot>

type LenhDoc = 'danhSachDuAn' | 'layDuAn' | 'danhSachNguoiTrongDuAn' | 'danhSachTask' | 'danhSachRepoCuaDuAn'

/** Kho bộ nhớ có các lệnh đọc `lenh` đi qua chốt. */
function bocKho(goc: KhoBoNho, lenh: LenhDoc[], chot: Chot): KhoDuLieu {
  const kho: KhoDuLieu = { ...goc }
  const bang = kho as unknown as Record<LenhDoc, (...doi: unknown[]) => Promise<KetQua<unknown>>>
  for (const ten of lenh) {
    const goi = bang[ten]
    bang[ten] = async (...doi) => {
      const loi = await chot.qua()
      return loi ? thatBai(loi) : goi(...doi)
    }
  }
  return kho
}

function dungApp(kho: KhoDuLieu, goc: KhoBoNho) {
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={goc.moPhong} dongHo={() => BAY_GIO} />)
  return { user, container }
}

/**
 * Đếm số lần một trong các chữ `chu` được thêm vào vùng ứng dụng, kể cả khi bị gỡ ngay sau đó: chứng
 * minh màn không lúc nào qua trạng thái đó.
 */
function theoDoiChu(goc: HTMLElement, chu: string[]) {
  let soLan = 0
  const dem = (ghi: MutationRecord[]) => {
    for (const g of ghi) {
      const cacNut = g.type === 'characterData' ? [g.target] : [...g.addedNodes]
      for (const nut of cacNut) if (chu.some((c) => nut.textContent?.includes(c))) soLan += 1
    }
  }
  const quanSat = new MutationObserver(dem)
  quanSat.observe(goc, { childList: true, subtree: true, characterData: true })
  return {
    get soLan() {
      dem(quanSat.takeRecords())
      return soLan
    },
    ngung: () => quanSat.disconnect(),
  }
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

/** Con số đang hiện trong ô số `nhan` của Tổng quan. */
function soTrongO(nhan: string): string | null {
  const o = within(screen.getByRole('group', { name: 'Số liệu chính' })).getByRole('group', { name: nhan })
  return within(o).getAllByText(/^\d+$/)[0]?.textContent ?? null
}

function dangTaiTongQuan() {
  return screen.queryByRole('progressbar', { name: DANG_TAI_TONG_QUAN })
}

describe('Tổng quan giữ số liệu lần trước', () => {
  it('mở một Dự án rồi quay lại: thấy ngay số liệu lần trước, rồi tự cập nhật số mới mà không qua đang tải', async () => {
    const { kho: goc, dangLam } = await dungBoiCanh()
    const chot = taoChot()
    const { user, container } = dungApp(bocKho(goc, ['danhSachDuAn'], chot), goc)
    await dangNhap(user, PM.email)
    await choTongQuanTaiXong()
    expect(soTrongO('Task đang mở')).toBe('2')

    await user.click(screen.getByRole('button', { name: 'Cửa hàng' }))
    await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
    // Trong lúc xem Dự án, một Task Hoàn thành.
    giaTri(await goc.chuDuAn.datTrangThaiTask(dangLam.id, 'HOAN_THANH'))
    chot.dong()
    const dangTai = theoDoiChu(container, [DANG_TAI_TONG_QUAN])
    await user.click(screen.getByRole('button', { name: 'Về danh sách Dự án' }))

    // Đọc lại chưa về: số liệu lần trước hiện ngay.
    expect(screen.getByRole('heading', { level: 2, name: 'Tổng quan' })).toBeInTheDocument()
    expect(soTrongO('Task đang mở')).toBe('2')
    expect(dangTaiTongQuan()).not.toBeInTheDocument()
    await waitFor(() => expect(chot.dangCho).toBe(1))

    chot.mo()
    await waitFor(() => expect(soTrongO('Task đang mở')).toBe('1'))
    expect(dangTai.soLan).toBe(0)
    dangTai.ngung()
  })

  it('rời Tổng quan qua Thanh bên rồi quay lại cũng thấy ngay số liệu lần trước', async () => {
    const { kho: goc } = await dungBoiCanh()
    const chot = taoChot()
    const { user, container } = dungApp(bocKho(goc, ['danhSachDuAn'], chot), goc)
    await dangNhap(user, PM.email)
    await choTongQuanTaiXong()
    await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
    await screen.findByRole('heading', { level: 2, name: 'Tất cả Dự án' })
    await screen.findByRole('button', { name: 'Kho hàng' })

    chot.dong()
    const dangTai = theoDoiChu(container, [DANG_TAI_TONG_QUAN])
    await user.click(screen.getByRole('button', { name: 'Tổng quan' }))
    await screen.findByRole('heading', { level: 2, name: 'Tổng quan' })
    expect(soTrongO('Task đang mở')).toBe('2')
    expect(dangTaiTongQuan()).not.toBeInTheDocument()

    chot.mo()
    await waitFor(() => expect(chot.dangCho).toBe(0))
    expect(soTrongO('Task đang mở')).toBe('2')
    expect(dangTai.soLan).toBe(0)
    dangTai.ngung()
  })

  it('đọc lại ngầm lỗi thì giữ số liệu đang hiện; lỗi chưa đăng nhập thì về màn đăng nhập, đăng nhập lại thì tải từ đầu', async () => {
    const { kho: goc } = await dungBoiCanh()
    const chot = taoChot()
    const { user } = dungApp(bocKho(goc, ['danhSachDuAn'], chot), goc)
    await dangNhap(user, PM.email)
    await choTongQuanTaiXong()

    await user.click(screen.getByRole('button', { name: 'Cửa hàng' }))
    await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
    chot.dong('LOI_HE_THONG')
    await user.click(screen.getByRole('button', { name: 'Về danh sách Dự án' }))
    await waitFor(() => expect(chot.dangCho).toBe(1))
    chot.mo()
    await waitFor(() => expect(chot.dangCho).toBe(0))
    // Lỗi đọc lại ngầm không thay số liệu đang hiện.
    expect(soTrongO('Task đang mở')).toBe('2')
    expect(screen.getByRole('button', { name: 'Kho hàng' })).toBeInTheDocument()
    expect(screen.queryByText('Không tải được tổng quan.')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Cửa hàng' }))
    await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
    chot.dong('CHUA_DANG_NHAP')
    await user.click(screen.getByRole('button', { name: 'Về danh sách Dự án' }))
    await waitFor(() => expect(chot.dangCho).toBe(1))
    chot.mo()
    expect(await screen.findByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument()

    // Hết phiên thì dữ liệu giữ bị bỏ: đăng nhập lại thấy đang tải, không thấy số liệu cũ.
    chot.dong()
    await dangNhap(user, PM.email)
    expect(await screen.findByRole('progressbar', { name: DANG_TAI_TONG_QUAN })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Số liệu chính' })).not.toBeInTheDocument()
    chot.mo()
    await waitFor(() => expect(soTrongO('Task đang mở')).toBe('2'))
  })

  it('mở lần đầu sau đăng nhập và bấm Thử lại sau lỗi vẫn hiện đang tải', async () => {
    const { kho: goc } = await dungBoiCanh()
    const chot = taoChot()
    chot.dong('LOI_HE_THONG')
    const { user } = dungApp(bocKho(goc, ['danhSachDuAn'], chot), goc)
    await dangNhap(user, PM.email)
    expect(await screen.findByRole('progressbar', { name: DANG_TAI_TONG_QUAN })).toBeInTheDocument()
    await waitFor(() => expect(chot.dangCho).toBe(1))
    chot.mo()
    expect(await screen.findByText('Không tải được tổng quan.')).toBeInTheDocument()

    chot.dong()
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByRole('progressbar', { name: DANG_TAI_TONG_QUAN })).toBeInTheDocument()
    chot.mo()
    await waitFor(() => expect(soTrongO('Task đang mở')).toBe('2'))
  })

  it('đăng xuất rồi đăng nhập tài khoản khác trên cùng tab: không lúc nào thấy dữ liệu của người trước', async () => {
    const { kho: goc } = await dungBoiCanh()
    const chot = taoChot()
    const { user, container } = dungApp(bocKho(goc, ['danhSachDuAn'], chot), goc)
    await dangNhap(user, PM.email)
    await choTongQuanTaiXong()
    expect(screen.getByRole('button', { name: 'Kho hàng' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Đăng xuất' }))
    await screen.findByRole('button', { name: 'Đăng nhập' })
    // An không ở "Kho hàng": chữ đó không được xuất hiện lần nào trong phiên của An.
    const cuaNguoiTruoc = theoDoiChu(container, ['Kho hàng'])
    chot.dong()
    await dangNhap(user, 'an@vi-du.vn')
    expect(await screen.findByRole('progressbar', { name: DANG_TAI_TONG_QUAN })).toBeInTheDocument()
    chot.mo()
    expect(await screen.findByRole('button', { name: 'Cửa hàng' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Kho hàng' })).not.toBeInTheDocument()
    expect(cuaNguoiTruoc.soLan).toBe(0)
    cuaNguoiTruoc.ngung()
  })
})

describe('Chi tiết Dự án giữ nội dung tab đã xem', () => {
  /** Kiểm nội dung riêng của từng tab đang hiện. */
  const NOI_DUNG_TAB: Record<TabChiTietDuAn, () => void> = {
    Task: () =>
      expect(within(screen.getByRole('group', { name: 'Task của Dự án' })).getAllByText('Viết trang chủ').length).toBeGreaterThan(0),
    'Người trong dự án': () =>
      expect(within(screen.getByRole('group', { name: 'Người trong dự án' })).getAllByText('Bình').length).toBeGreaterThan(0),
    'Thông tin': () => expect(within(screen.getByRole('group', { name: 'Dấu vết' })).getByText('Người tạo: An PM')).toBeInTheDocument(),
    GitHub: () => expect(within(screen.getByRole('group', { name: 'Repo GitHub' })).getByText('acme/web')).toBeInTheDocument(),
  }
  const THU_TU: TabChiTietDuAn[] = ['Người trong dự án', 'Thông tin', 'GitHub', 'Task']
  const DANG_TAI = [
    'Đang tải Dự án…',
    'Đang tải Task…',
    'Đang tải người trong dự án…',
    'Đang tải repo GitHub…',
    'Đang tính…',
  ]

  it('đổi sang tab khác rồi về tab đã xem: thấy ngay nội dung, không qua trạng thái đang tải', async () => {
    const { kho: goc } = await dungBoiCanh()
    const chot = taoChot()
    const lenh: LenhDoc[] = ['layDuAn', 'danhSachNguoiTrongDuAn', 'danhSachTask', 'danhSachRepoCuaDuAn']
    const { user, container } = dungApp(bocKho(goc, lenh, chot), goc)
    await dangNhap(user, PM.email)
    await choTongQuanTaiXong()
    await user.click(screen.getByRole('button', { name: 'Cửa hàng' }))
    await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
    for (const tab of THU_TU) {
      await moTabDuAn(user, tab)
      await waitFor(NOI_DUNG_TAB[tab])
    }

    // Từ giờ mọi lần đọc lại của Kho đều chưa về.
    chot.dong()
    const dangTai = theoDoiChu(container, DANG_TAI)
    for (const tab of THU_TU) {
      await moTabDuAn(user, tab)
      NOI_DUNG_TAB[tab]()
    }
    expect(dangTai.soLan).toBe(0)

    chot.mo()
    await waitFor(() => expect(chot.dangCho).toBe(0))
    NOI_DUNG_TAB.Task()
    expect(dangTai.soLan).toBe(0)
    dangTai.ngung()
  })
})
