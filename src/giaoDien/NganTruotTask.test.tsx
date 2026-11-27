// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { cacBuocLamDuoc, lyDoKhongCoBuoc, type TinhHuongChuyen } from '../luat/chuyenTrangThai'
import { THONG_BAO_SUA_TASK, TEN_TRANG_THAI_TASK, type TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { choNganTruot, choTongQuanTaiXong, dongNganTruot, moTabDuAn, moTabTask } from '../test/khungUngDung'
import { maDuAnMoi } from '../test/maDuAn'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-03-01T08:00:00+07:00')
/** Đồng hồ ứng dụng: 00:00 ngày 26/11 giờ Việt Nam, nên Task hạn 25/11 đã Trễ hạn. */
const BAY_GIO = new Date('2026-11-26T00:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

function dungApp(kho: KhoBoNho) {
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => BAY_GIO} />)
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

interface BoiCanh {
  kho: KhoBoNho
  duAn: DuAn
  an: string
  binh: string
}

/** Dự án "Cửa hàng" có An và Bình (Thành viên) ở trong. */
async function dungBoiCanh(): Promise<BoiCanh> {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const pm = await phienCua(kho, PM.email)
  const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
  const an = await taoNguoi(kho, 'an@vi-du.vn', 'An')
  const binh = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình')
  for (const email of ['an@vi-du.vn', 'binh@vi-du.vn']) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email }))
  return { kho, duAn, an, binh }
}

/** PM tạo Task qua Kho rồi đặt thẳng trạng thái. */
async function taoTask(
  bc: BoiCanh,
  tieuDe: string,
  thucHien: string,
  kiemTra: string,
  trangThai: TrangThaiTask = 'MOI',
  han: string | null = null,
): Promise<Task> {
  const task = giaTri(
    await bc.kho.taoTask(
      await phienCua(bc.kho, PM.email),
      bc.duAn.id,
      { tieuDe, han, nguoiThucHienId: thucHien, nguoiKiemTraId: kiemTra },
      LUC_TAO,
    ),
  )
  if (trangThai !== 'MOI') giaTri(await bc.kho.chuDuAn.datTrangThaiTask(task.id, trangThai))
  return task
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
  await choTongQuanTaiXong()
}

/** Mở trang chi tiết Dự án "Cửa hàng" từ Dự án của tôi (hoặc Tất cả Dự án với PM) và chờ bảng Kanban. */
async function moCuaHang(user: User, laPM = false) {
  await user.click(screen.getByRole('button', { name: laPM ? 'Tất cả Dự án' : 'Dự án của tôi' }))
  await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
  await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
  return bangKanban()
}

async function bangKanban() {
  return within(await screen.findByRole('group', { name: 'Bảng Kanban' }))
}

function cot(trangThai: TrangThaiTask) {
  return within(
    within(screen.getByRole('group', { name: 'Bảng Kanban' })).getByRole('group', {
      name: `Cột ${TEN_TRANG_THAI_TASK[trangThai]}`,
    }),
  )
}

/** Chọn giá trị ở một ô lọc của Kanban. */
async function chonLoc(user: User, nhan: string, lua: string) {
  const boLoc = within(screen.getByRole('group', { name: 'Bộ lọc Task' }))
  await user.click(boLoc.getByRole('combobox', { name: new RegExp(`^${nhan}`) }))
  await user.click(await screen.findByRole('option', { name: lua }))
}

/** Tên các nút chuyển trạng thái đang hiện trong ngăn (chờ kiểm xong các bước làm được). */
async function cacNutChuyen(ngan: HTMLElement): Promise<string[]> {
  const vung = within(await within(ngan).findByRole('group', { name: 'Chuyển trạng thái' }))
  await waitFor(() => expect(vung.queryByRole('progressbar')).not.toBeInTheDocument())
  return vung.queryAllByRole('button').map((nut) => nut.textContent ?? '')
}

/** Tên các tab phía dưới của ngăn Task đang hiện, theo thứ tự trên dải tab. */
async function cacTabCuaNgan(ngan: HTMLElement): Promise<string[]> {
  const ds = within(await within(ngan).findByRole('tablist', { name: 'Các phần của Task' }))
  const tatCa = ds.getAllByRole('tab')
  return (['Lịch sử', 'Link GitHub', 'Sửa'] as const)
    .map((ten) => ({ ten, tab: ds.queryByRole('tab', { name: ten }) }))
    .filter((x): x is { ten: 'Lịch sử' | 'Link GitHub' | 'Sửa'; tab: HTMLElement } => x.tab !== null)
    .sort((a, b) => tatCa.indexOf(a.tab) - tatCa.indexOf(b.tab))
    .map((x) => x.ten)
}

/** Con số trong ô số `nhan` của Tổng quan. */
function soTrongO(nhan: string): string | null {
  const o = within(screen.getByRole('group', { name: 'Số liệu chính' })).getByRole('group', { name: nhan })
  return within(o).getAllByText(/^\d+$/)[0]?.textContent ?? null
}

describe('Ngăn trượt của Task: mở mà không rời trang', () => {
  it('bấm thẻ Task trên Kanban mở Ngăn trượt có tiêu đề Task, focus vào trong ngăn; bảng Kanban vẫn còn trong trang', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ', bc.an, bc.binh, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moCuaHang(user)

    await user.click(cot('DANG_LAM').getByRole('button', { name: 'Làm trang chủ' }))
    const ngan = await choNganTruot('Làm trang chủ')
    expect(within(ngan).getByRole('heading', { level: 2, name: 'Làm trang chủ' })).toBeInTheDocument()
    expect(await within(ngan).findByRole('group', { name: 'Thông tin Task' })).toHaveTextContent('Trạng thái: Đang làm')
    await waitFor(() => expect(ngan).toContainElement(document.activeElement as HTMLElement))

    // Trang phía sau ở nguyên: dải tóm tắt, tab Task và bảng Kanban.
    expect(screen.getByRole('group', { name: 'Tóm tắt Dự án' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true')
    expect(cot('DANG_LAM').getByRole('button', { name: 'Làm trang chủ' })).toBeInTheDocument()
  })

  it('mở Task từ Việc của tôi trong Ngăn trượt mà không rời trang đó', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Việc của An', bc.an, bc.binh, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Việc của tôi' }))
    const bang = within(await screen.findByRole('table', { name: 'Việc của tôi' }))

    await user.click(bang.getByRole('button', { name: 'Việc của An' }))
    const ngan = await choNganTruot('Việc của An')
    // Dưới tiêu đề: Mã Dự án đứng cạnh tên Dự án.
    expect(within(ngan).getByText(`${bc.duAn.ma} · Cửa hàng`)).toBeInTheDocument()
    expect(await within(ngan).findByRole('group', { name: 'Thông tin Task' })).toHaveTextContent('Người thực hiện: An')
    expect(screen.getByRole('heading', { level: 2, name: 'Việc của tôi' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Việc của tôi' })).toBeInTheDocument()
  })

  it('mở Task từ Chờ tôi duyệt trong Ngăn trượt mà không rời trang đó', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Cần Bình duyệt', bc.an, bc.binh, 'CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Chờ tôi duyệt' }))
    const bang = within(await screen.findByRole('table', { name: 'Chờ tôi duyệt' }))

    await user.click(bang.getByRole('button', { name: 'Cần Bình duyệt' }))
    const ngan = await choNganTruot('Cần Bình duyệt')
    expect(await within(ngan).findByRole('group', { name: 'Thông tin Task' })).toHaveTextContent('Trạng thái: Chờ duyệt')
    expect(screen.getByRole('heading', { level: 2, name: 'Chờ tôi duyệt' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Chờ tôi duyệt' })).toBeInTheDocument()
  })

  it.each([
    { danhSach: 'Task Trễ hạn', tieuDe: 'Đã trễ', han: '2026-11-25' },
    { danhSach: 'Task tới hạn trong 7 ngày', tieuDe: 'Sắp tới hạn', han: '2026-11-28' },
  ])('mở Task từ danh sách "$danhSach" ở Tổng quan trong Ngăn trượt mà không rời Tổng quan', async ({ danhSach, tieuDe, han }) => {
    const bc = await dungBoiCanh()
    await taoTask(bc, tieuDe, bc.an, bc.binh, 'DANG_LAM', han)
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')

    await user.click(within(screen.getByRole('table', { name: danhSach })).getByRole('button', { name: tieuDe }))
    const ngan = await choNganTruot(tieuDe)
    expect(await within(ngan).findByRole('group', { name: 'Thông tin Task' })).toHaveTextContent('Người thực hiện: An')
    expect(screen.getByRole('heading', { level: 2, name: 'Tổng quan' })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: danhSach })).toBeInTheDocument()
  })
})

describe('Ngăn trượt của Task: nút và tab theo luật', () => {
  it.each([
    { ca: 'Người thực hiện', email: 'an@vi-du.vn', trangThai: 'MOI' as const },
    { ca: 'Người kiểm tra', email: 'binh@vi-du.vn', trangThai: 'CHO_DUYET' as const },
    { ca: 'Người thực hiện khi Chờ duyệt', email: 'an@vi-du.vn', trangThai: 'CHO_DUYET' as const },
    { ca: 'PM', email: PM.email, trangThai: 'DANG_LAM' as const },
  ])('$ca: các nút chuyển trạng thái đúng với luật hiện có, có tab Lịch sử và Link GitHub', async ({ email, trangThai }) => {
    const bc = await dungBoiCanh()
    const task = await taoTask(bc, 'Làm trang chủ', bc.an, bc.binh, trangThai)
    const { user } = dungApp(bc.kho)
    await dangNhap(user, email)
    await moCuaHang(user, email === PM.email)
    await user.click(cot(trangThai).getByRole('button', { name: 'Làm trang chủ' }))
    const ngan = await choNganTruot('Làm trang chủ')

    const phien = await phienCua(bc.kho, email)
    const vai: VaiHeThong = email === PM.email ? 'PM' : 'THANH_VIEN'
    const tinhHuong: TinhHuongChuyen = {
      vaiNguoiGoi: vai,
      laNguoiTrongDuAn: vai !== 'PM',
      nguoiGoiId: phien.nguoiDungId,
      nguoiThucHienId: task.nguoiThucHien.id,
      nguoiKiemTraId: task.nguoiKiemTra.id,
      trangThaiDuAn: 'HOAT_DONG',
      trangThaiTask: trangThai,
    }
    expect(await cacNutChuyen(ngan)).toEqual(cacBuocLamDuoc(tinhHuong).map((buoc) => buoc.nhan))
    const lyDo = lyDoKhongCoBuoc(tinhHuong)
    if (lyDo !== null) expect(within(ngan).getByText(lyDo)).toBeInTheDocument()

    const cacTab = await cacTabCuaNgan(ngan)
    expect(cacTab.slice(0, 2)).toEqual(['Lịch sử', 'Link GitHub'])
  })

  it('tab Sửa hiện với người có quyền sửa (PM): mở được biểu mẫu sửa', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ', bc.an, bc.binh, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await moCuaHang(user, true)
    await user.click(cot('DANG_LAM').getByRole('button', { name: 'Làm trang chủ' }))
    const ngan = await choNganTruot('Làm trang chủ')
    await waitFor(async () => expect(await cacTabCuaNgan(ngan)).toEqual(['Lịch sử', 'Link GitHub', 'Sửa']))
    await moTabTask(user, 'Sửa')
    expect(within(ngan).getByRole('group', { name: 'Sửa Task' })).toBeInTheDocument()
  })

  it('tab Sửa không hiện với người không có quyền sửa (Người thực hiện), kèm lý do', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ', bc.an, bc.binh, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moCuaHang(user)
    await user.click(cot('DANG_LAM').getByRole('button', { name: 'Làm trang chủ' }))
    const ngan = await choNganTruot('Làm trang chủ')
    expect(await within(ngan).findByText(THONG_BAO_SUA_TASK.khongQuanLy)).toBeInTheDocument()
    expect(await cacTabCuaNgan(ngan)).toEqual(['Lịch sử', 'Link GitHub'])
    expect(within(ngan).queryByRole('group', { name: 'Sửa Task' })).not.toBeInTheDocument()
  })
})

describe('Ngăn trượt của Task: đóng ngăn', () => {
  async function moVoiBoLoc() {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ', bc.an, bc.binh, 'DANG_LAM')
    await taoTask(bc, 'Việc của Bình', bc.binh, bc.an, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moCuaHang(user)
    await chonLoc(user, 'Người thực hiện', 'An')
    expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Đang lọc: 1 trên 2 Task.')
    const the = cot('DANG_LAM').getByRole('button', { name: 'Làm trang chủ' })
    await user.click(the)
    await choNganTruot('Làm trang chủ')
    return { user, bc }
  }

  /** Trang cũ còn nguyên: tab Task, bộ lọc Kanban đang đặt, và focus ở lại thẻ đã bấm. */
  async function vanOTrangCu() {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Đang lọc: 1 trên 2 Task.')
    expect(within(screen.getByRole('group', { name: 'Bộ lọc Task' })).getByRole('combobox', { name: /^Người thực hiện/ })).toHaveTextContent('An')
    expect(screen.queryByRole('button', { name: 'Việc của Bình' })).not.toBeInTheDocument()
    const the = cot('DANG_LAM').getByRole('button', { name: 'Làm trang chủ' })
    await waitFor(() => expect(the).toHaveFocus())
  }

  it('đóng bằng nút đóng: về trang cũ, bộ lọc Kanban giữ nguyên, focus trở lại thẻ đã bấm', async () => {
    const { user } = await moVoiBoLoc()
    await dongNganTruot(user)
    await vanOTrangCu()
  })

  it('đóng bằng phím Esc: về trang cũ, bộ lọc Kanban giữ nguyên, focus trở lại thẻ đã bấm', async () => {
    const { user } = await moVoiBoLoc()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await vanOTrangCu()
  })

  it('Esc trong hộp nhập lý do chỉ đóng hộp, Ngăn trượt vẫn mở', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ', bc.an, bc.binh, 'CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await moCuaHang(user)
    await user.click(cot('CHO_DUYET').getByRole('button', { name: 'Làm trang chủ' }))
    const ngan = await choNganTruot('Làm trang chủ')
    await cacNutChuyen(ngan)
    await user.click(within(ngan).getByRole('button', { name: 'Trả lại' }))
    await screen.findByRole('dialog', { name: 'Trả lại: nhập lý do' })
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Trả lại: nhập lý do' })).not.toBeInTheDocument())
    expect(screen.getByRole('dialog', { name: 'Làm trang chủ' })).toBeInTheDocument()
  })

  it('mở từ tab Người trong dự án (Task đang giữ) rồi đóng thì vẫn ở tab đó', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ', bc.an, bc.binh, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await moCuaHang(user, true)
    await moTabDuAn(user, 'Người trong dự án')
    const vungNguoi = within(screen.getByRole('group', { name: 'Người trong dự án' }))
    await user.click(await vungNguoi.findByRole('button', { name: 'Gỡ An' }))
    const panel = within(await screen.findByRole('group', { name: 'Task đang giữ' }))
    await user.click(panel.getByRole('button', { name: 'Làm trang chủ' }))
    await choNganTruot('Làm trang chủ')
    await dongNganTruot(user)
    expect(screen.getByRole('tab', { name: 'Người trong dự án' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('group', { name: 'Task đang giữ' })).toBeInTheDocument()
  })
})

describe('Ngăn trượt của Task: trang phía sau đọc lại khi Task đổi', () => {
  it('chuyển Đang làm sang Chờ duyệt trong ngăn: thẻ trên Kanban phía sau sang cột Chờ duyệt, bộ lọc vẫn giữ', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ', bc.an, bc.binh, 'DANG_LAM')
    await taoTask(bc, 'Việc của Bình', bc.binh, bc.an, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moCuaHang(user)
    await chonLoc(user, 'Người thực hiện', 'An')
    await user.click(cot('DANG_LAM').getByRole('button', { name: 'Làm trang chủ' }))
    const ngan = await choNganTruot('Làm trang chủ')
    expect(await cacNutChuyen(ngan)).toEqual(['Báo chờ duyệt'])

    await user.click(within(ngan).getByRole('button', { name: 'Báo chờ duyệt' }))
    expect(await within(ngan).findByText('Đã chuyển Task sang Chờ duyệt.')).toBeInTheDocument()
    // Ngăn vẫn mở; bảng phía sau đã đọc lại.
    await waitFor(() => expect(cot('CHO_DUYET').getByRole('button', { name: 'Làm trang chủ' })).toBeInTheDocument())
    expect(cot('DANG_LAM').queryByRole('button', { name: 'Làm trang chủ' })).not.toBeInTheDocument()

    await dongNganTruot(user)
    expect(cot('CHO_DUYET').getByRole('button', { name: 'Làm trang chủ' })).toBeInTheDocument()
    expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Đang lọc: 1 trên 2 Task.')
  })

  it('Duyệt đạt trong ngăn: Tiến độ ở dải tóm tắt phía sau cập nhật', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ', bc.an, bc.binh, 'CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await moCuaHang(user)
    const tienDo = screen.getByRole('group', { name: 'Tiến độ của Dự án' })
    expect(tienDo).toHaveTextContent('0%')
    await user.click(cot('CHO_DUYET').getByRole('button', { name: 'Làm trang chủ' }))
    const ngan = await choNganTruot('Làm trang chủ')
    await cacNutChuyen(ngan)
    await user.click(within(ngan).getByRole('button', { name: 'Duyệt đạt' }))
    await waitFor(() => expect(screen.getByRole('group', { name: 'Tiến độ của Dự án' })).toHaveTextContent('100%'))
    expect(cot('HOAN_THANH').getByRole('button', { name: 'Làm trang chủ' })).toBeInTheDocument()
  })

  it('sửa tiêu đề trong ngăn: tiêu đề ngăn và thẻ Kanban phía sau đổi theo', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ', bc.an, bc.binh, 'MOI')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await moCuaHang(user, true)
    await user.click(cot('MOI').getByRole('button', { name: 'Làm trang chủ' }))
    await choNganTruot('Làm trang chủ')
    await moTabTask(user, 'Sửa')
    const sua = within(screen.getByRole('group', { name: 'Sửa Task' }))
    const o = sua.getByLabelText('Tiêu đề')
    await user.clear(o)
    await user.type(o, 'Làm trang chủ mới')
    await user.click(sua.getByRole('button', { name: 'Lưu thay đổi' }))

    const ngan = await choNganTruot('Làm trang chủ mới')
    expect(within(ngan).getByRole('heading', { level: 2, name: 'Làm trang chủ mới' })).toBeInTheDocument()
    await waitFor(() => expect(cot('MOI').getByRole('button', { name: 'Làm trang chủ mới' })).toBeInTheDocument())
  })

  it('Duyệt đạt từ Chờ tôi duyệt: danh sách phía sau đọc lại và Task không còn trong đó', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Cần Bình duyệt', bc.an, bc.binh, 'CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Chờ tôi duyệt' }))
    const bang = within(await screen.findByRole('table', { name: 'Chờ tôi duyệt' }))
    await user.click(bang.getByRole('button', { name: 'Cần Bình duyệt' }))
    const ngan = await choNganTruot('Cần Bình duyệt')
    await cacNutChuyen(ngan)
    await user.click(within(ngan).getByRole('button', { name: 'Duyệt đạt' }))

    expect(await screen.findByRole('heading', { name: 'Không có Task nào đang chờ bạn duyệt.' })).toBeInTheDocument()
    await dongNganTruot(user)
    expect(screen.getByRole('heading', { level: 2, name: 'Chờ tôi duyệt' })).toBeInTheDocument()
  })

  it('Duyệt đạt từ danh sách Task Trễ hạn ở Tổng quan: ô số và danh sách phía sau đọc lại', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Đã trễ', bc.an, bc.binh, 'CHO_DUYET', '2026-11-25')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    expect(soTrongO('Task Trễ hạn')).toBe('1')
    expect(soTrongO('Chờ tôi duyệt')).toBe('1')

    await user.click(within(screen.getByRole('table', { name: 'Task Trễ hạn' })).getByRole('button', { name: 'Đã trễ' }))
    const ngan = await choNganTruot('Đã trễ')
    await cacNutChuyen(ngan)
    await user.click(within(ngan).getByRole('button', { name: 'Duyệt đạt' }))

    await waitFor(() => expect(soTrongO('Task Trễ hạn')).toBe('0'))
    expect(soTrongO('Chờ tôi duyệt')).toBe('0')
    // Hết Task Trễ hạn: vùng chỉ còn dòng báo trống, không còn bảng (Tổng quan xếp dọc, ticket sap-xep-giao-dien 01).
    expect(screen.queryByRole('table', { name: 'Task Trễ hạn' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đã trễ' })).not.toBeInTheDocument()
    expect(screen.getByText('Không có Task Trễ hạn.')).toBeInTheDocument()
  })
})
