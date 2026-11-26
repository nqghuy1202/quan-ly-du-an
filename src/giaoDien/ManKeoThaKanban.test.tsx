// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { BANG_CA_CHUYEN_TRANG_THAI, type CaChuyenTrangThai, type LoaiNguoiGoi } from '../kho/bangCaChuyenTrangThai'
import { THONG_BAO_CHUYEN_TRANG_THAI, timBuoc } from '../luat/chuyenTrangThai'
import { TEN_TRANG_THAI_TASK, type TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { maDuAnMoi } from '../test/maDuAn'

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

function dungApp(goc: KhoBoNho, kho: KhoDuLieu = goc) {
  const user = userEvent.setup()
  render(<App kho={kho} moPhong={goc.moPhong} dongHo={() => LUC} />)
  return { user }
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

/** Dự án "Cửa hàng": An (làm), Bình (duyệt), Em (Thành viên khác), Chi (Support) trong Dự án. */
async function dungBoiCanh(goc: KhoBoNho = taoKhoBoNho({ pmBanDau: PM })): Promise<BoiCanh> {
  const pm = await phienCua(goc, PM.email)
  const duAn = giaTri(await goc.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC))
  const an = await taoNguoi(goc, 'an@vi-du.vn', 'An')
  const binh = await taoNguoi(goc, 'binh@vi-du.vn', 'Bình')
  await taoNguoi(goc, 'em@vi-du.vn', 'Em')
  await taoNguoi(goc, 'chi@vi-du.vn', 'Chi', 'SUPPORT')
  for (const email of ['an@vi-du.vn', 'binh@vi-du.vn', 'em@vi-du.vn', 'chi@vi-du.vn']) {
    giaTri(await goc.themNguoiVaoDuAn(pm, duAn.id, { email }))
  }
  return { kho: goc, duAn, an, binh }
}

async function taoTask(bc: BoiCanh, tieuDe: string, trangThai: TrangThaiTask = 'MOI'): Promise<Task> {
  const task = giaTri(
    await bc.kho.taoTask(
      await phienCua(bc.kho, PM.email),
      bc.duAn.id,
      { tieuDe, han: null, nguoiThucHienId: bc.an, nguoiKiemTraId: bc.binh },
      LUC,
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
}

/**
 * Đăng nhập rồi mở Dự án Cửa hàng; chờ tới khi bảng đã biết quyền (menu hoặc kéo thả dùng được).
 * PM mở từ Tất cả Dự án, người khác từ Dự án của tôi (Tổng quan không liệt kê Dự án Lưu trữ).
 */
async function moBang(user: User, email: string, laPM = false) {
  await dangNhap(user, email)
  await user.click(screen.getByRole('button', { name: laPM ? 'Tất cả Dự án' : 'Dự án của tôi' }))
  await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
  await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
  await bang()
  // Bảng chỉ kéo thả được khi đã biết quyền của người gọi.
  await waitFor(() => expect(screen.queryByText(/Chưa kiểm xong quyền/)).not.toBeInTheDocument())
}

async function bang() {
  return within(await screen.findByRole('group', { name: 'Bảng Kanban' }))
}

function cot(trangThai: TrangThaiTask) {
  return within(screen.getByRole('group', { name: `Cột ${TEN_TRANG_THAI_TASK[trangThai]}` }))
}

function tieuDeTrongCot(trangThai: TrangThaiTask): string[] {
  return cot(trangThai)
    .queryAllByRole('listitem')
    .map((the) => within(the).getAllByRole('button')[0]?.textContent ?? '')
}

/** Phần tử bên trong thẻ nhưng không phải nút: chỗ người dùng nhấn chuột để kéo. */
function chiaThe(tieuDe: string): HTMLElement {
  const the = screen.getByRole('button', { name: tieuDe }).closest('[role="listitem"]') as HTMLElement
  return within(the).getByText(/^Người thực hiện:/)
}

function tieuDeCot(trangThai: TrangThaiTask): HTMLElement {
  return cot(trangThai).getByRole('heading', { name: TEN_TRANG_THAI_TASK[trangThai] })
}

/** Mô phỏng kéo chuột: nhấn trên thẻ, rê (qua ngưỡng) tới cột đích rồi thả. */
function keo(tieuDe: string, den: HTMLElement | null) {
  fireEvent.pointerDown(chiaThe(tieuDe), { button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 })
  const dich = den ?? document.body
  fireEvent.pointerMove(dich, { pointerType: 'mouse', clientX: 300, clientY: 40 })
  fireEvent.pointerUp(dich, { pointerType: 'mouse', clientX: 300, clientY: 40 })
}

async function task(kho: KhoBoNho, id: string) {
  return giaTri(await kho.layTask(await phienCua(kho, PM.email), id))
}

async function lichSu(kho: KhoBoNho, id: string) {
  return giaTri(await kho.lichSuTask(await phienCua(kho, PM.email), id))
}

/** Trạng thái Kho của một Task, để so sánh trước và sau (không gồm id). */
async function chup(kho: KhoBoNho, id: string) {
  const t = await task(kho, id)
  return {
    trangThai: t.trangThai,
    soLanTraLai: t.soLanTraLai,
    suaBoi: t.dauVet.suaBoi?.tenHienThi ?? null,
    lichSu: (await lichSu(kho, id)).map((d) => ({
      loai: d.loai,
      nguoi: d.nguoiDoi.tenHienThi,
      tu: d.tu,
      sang: d.sang,
      lyDo: d.loai === 'TRANG_THAI' ? d.lyDo : null,
    })),
  }
}

/** Banner lỗi của bảng (Astryx còn có vùng báo động ẩn riêng nên không dò theo role một mình). */
function thongBaoLoi(): HTMLElement | null {
  return screen.queryAllByRole('alert').find((el) => el.textContent?.includes('Chưa chuyển được Task.')) ?? null
}

describe('kéo thả Kanban: thả thẻ vào cột', () => {
  it('thả vào cột hợp lệ với người được phép: Task đổi trạng thái, sinh đúng một dòng lịch sử, thẻ hiện ở cột mới và có thông báo', async () => {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Làm trang chủ')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'an@vi-du.vn')
    expect(tieuDeTrongCot('MOI')).toEqual(['Làm trang chủ'])

    keo('Làm trang chủ', tieuDeCot('DANG_LAM'))

    await waitFor(() => expect(tieuDeTrongCot('DANG_LAM')).toEqual(['Làm trang chủ']))
    expect(tieuDeTrongCot('MOI')).toEqual([])
    expect(await screen.findByText('Đã chuyển Task "Làm trang chủ" sang Đang làm.')).toBeInTheDocument()
    const sau = await task(bc.kho, t.id)
    expect(sau.trangThai).toBe('DANG_LAM')
    expect(sau.dauVet.suaBoi?.tenHienThi).toBe('An')
    const ls = await lichSu(bc.kho, t.id)
    expect(ls).toHaveLength(1)
    expect(ls[0]).toMatchObject({ tu: 'MOI', sang: 'DANG_LAM', lyDo: null, nguoiDoi: { tenHienThi: 'An' } })
    // Số Task mỗi cột cập nhật.
    expect(cot('DANG_LAM').getByText('1')).toBeInTheDocument()
  })

  it('đi liền hai bước: kéo Mới sang Đang làm rồi sang Chờ duyệt, lịch sử đủ hai dòng đúng thứ tự', async () => {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Làm trang chủ')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'an@vi-du.vn')
    keo('Làm trang chủ', tieuDeCot('DANG_LAM'))
    await waitFor(() => expect(tieuDeTrongCot('DANG_LAM')).toEqual(['Làm trang chủ']))
    keo('Làm trang chủ', tieuDeCot('CHO_DUYET'))
    await waitFor(() => expect(tieuDeTrongCot('CHO_DUYET')).toEqual(['Làm trang chủ']))
    expect((await lichSu(bc.kho, t.id)).map((d) => `${d.tu}>${d.sang}`)).toEqual(['MOI>DANG_LAM', 'DANG_LAM>CHO_DUYET'])
  })

  it('thả vào cột mà bước không có trong ma trận: thẻ ở cột cũ, dữ liệu không đổi, thông báo tiếng Việt nêu lý do', async () => {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Làm trang chủ')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'an@vi-du.vn')
    const truoc = await chup(bc.kho, t.id)

    keo('Làm trang chủ', tieuDeCot('HOAN_THANH'))

    expect(await screen.findByText('Không có bước chuyển từ Mới sang Hoàn thành.')).toBeInTheDocument()
    expect(thongBaoLoi()).toHaveTextContent('Không có bước chuyển từ Mới sang Hoàn thành.')
    expect(tieuDeTrongCot('MOI')).toEqual(['Làm trang chủ'])
    expect(tieuDeTrongCot('HOAN_THANH')).toEqual([])
    expect(await chup(bc.kho, t.id)).toEqual(truoc)
  })

  it('thả khi không có quyền (sai vai hoặc không giữ vai nào): thẻ về cột cũ, dữ liệu không đổi, thông báo nêu ai làm được', async () => {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Đang chờ duyệt', 'CHO_DUYET')
    const an = dungApp(bc.kho)
    await moBang(an.user, 'an@vi-du.vn')
    const truoc = await chup(bc.kho, t.id)
    keo('Đang chờ duyệt', tieuDeCot('HOAN_THANH'))
    expect(
      await screen.findByText('Bước Chờ duyệt sang Hoàn thành chỉ Người kiểm tra, Support của Dự án hoặc PM làm được.'),
    ).toBeInTheDocument()
    expect(tieuDeTrongCot('CHO_DUYET')).toEqual(['Đang chờ duyệt'])
    expect(await chup(bc.kho, t.id)).toEqual(truoc)
  })

  it('Thành viên không giữ vai nào trên Task vẫn kéo thử được nhưng bị từ chối kèm lý do', async () => {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Việc của An')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'em@vi-du.vn')
    const truoc = await chup(bc.kho, t.id)
    keo('Việc của An', tieuDeCot('DANG_LAM'))
    expect(await screen.findByText(THONG_BAO_CHUYEN_TRANG_THAI.khongCoVai)).toBeInTheDocument()
    expect(tieuDeTrongCot('MOI')).toEqual(['Việc của An'])
    expect(await chup(bc.kho, t.id)).toEqual(truoc)
  })

  it('Dự án đã Lưu trữ: thả bị từ chối và nói Dự án chỉ xem', async () => {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Việc cũ', 'DANG_LAM')
    giaTri(await bc.kho.luuTruDuAn(await phienCua(bc.kho, PM.email), bc.duAn.id, LUC))
    const { user } = dungApp(bc.kho)
    await moBang(user, 'an@vi-du.vn')
    const truoc = await chup(bc.kho, t.id)
    keo('Việc cũ', tieuDeCot('CHO_DUYET'))
    expect(await screen.findByText(THONG_BAO_CHUYEN_TRANG_THAI.daLuuTru)).toBeInTheDocument()
    expect(tieuDeTrongCot('DANG_LAM')).toEqual(['Việc cũ'])
    expect(await chup(bc.kho, t.id)).toEqual(truoc)
  })

  it('thả lại đúng cột cũ, thả ra ngoài mọi cột, nhấn rồi nhả không rê: không đổi gì và không báo lỗi', async () => {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Làm trang chủ')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'an@vi-du.vn')
    const truoc = await chup(bc.kho, t.id)

    keo('Làm trang chủ', tieuDeCot('MOI'))
    keo('Làm trang chủ', null)
    fireEvent.pointerDown(chiaThe('Làm trang chủ'), { button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 })
    fireEvent.pointerUp(tieuDeCot('DANG_LAM'), { pointerType: 'mouse', clientX: 10, clientY: 10 })
    // Chuột phải không bắt đầu kéo.
    fireEvent.pointerDown(chiaThe('Làm trang chủ'), { button: 2, pointerType: 'mouse', clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tieuDeCot('DANG_LAM'), { pointerType: 'mouse', clientX: 300, clientY: 10 })
    fireEvent.pointerUp(tieuDeCot('DANG_LAM'), { pointerType: 'mouse', clientX: 300, clientY: 10 })

    await Promise.resolve()
    expect(thongBaoLoi()).not.toBeInTheDocument()
    expect(screen.queryByText(/Đã chuyển Task/)).not.toBeInTheDocument()
    expect(tieuDeTrongCot('MOI')).toEqual(['Làm trang chủ'])
    expect(await chup(bc.kho, t.id)).toEqual(truoc)
  })

  it('đang kéo có câu mô tả các cột thả được; Esc huỷ kéo và thả sau đó không đổi gì', async () => {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Chờ kiểm', 'CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'binh@vi-du.vn')
    fireEvent.pointerDown(chiaThe('Chờ kiểm'), { button: 0, pointerType: 'mouse', clientX: 10, clientY: 10 })
    fireEvent.pointerMove(tieuDeCot('DANG_LAM'), { pointerType: 'mouse', clientX: 300, clientY: 40 })
    expect(await screen.findByRole('status', { name: 'Đang kéo Task' })).toHaveTextContent(
      'Đang kéo "Chờ kiểm". Có thể thả vào: Hoàn thành, Trả lại, Bị lỗi.',
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('status', { name: 'Đang kéo Task' })).not.toBeInTheDocument())
    fireEvent.pointerUp(tieuDeCot('HOAN_THANH'), { pointerType: 'mouse', clientX: 300, clientY: 40 })
    await Promise.resolve()
    expect((await task(bc.kho, t.id)).trangThai).toBe('CHO_DUYET')
  })

  it('Kho từ chối vì Task vừa đổi ở nơi khác: thẻ cập nhật theo Kho và thông báo lý do của Kho hiện ra', async () => {
    const goc = taoKhoBoNho({ pmBanDau: PM })
    const bc = await dungBoiCanh(goc)
    const t = await taoTask(bc, 'Làm trang chủ')
    const kho: KhoDuLieu = {
      ...goc,
      doiTrangThaiTask: async (phien, id, dauVao, luc) => {
        // Trước khi lệnh của người dùng tới nơi, người khác đã đưa Task sang Đang làm.
        await goc.chuDuAn.datTrangThaiTask(t.id, 'DANG_LAM')
        return goc.doiTrangThaiTask(phien, id, dauVao, luc)
      },
    }
    const { user } = dungApp(goc, kho)
    await moBang(user, 'an@vi-du.vn')
    keo('Làm trang chủ', tieuDeCot('DANG_LAM'))
    expect(await screen.findByText('Chưa chuyển được Task.')).toBeInTheDocument()
    expect(thongBaoLoi()).toHaveTextContent('Không có bước chuyển từ Đang làm sang Đang làm.')
    // Thẻ đã được đọc lại theo Kho: nằm ở Đang làm.
    await waitFor(() => expect(tieuDeTrongCot('DANG_LAM')).toEqual(['Làm trang chủ']))
  })

  it('thông báo lỗi và thành công đóng được', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'an@vi-du.vn')
    keo('Làm trang chủ', tieuDeCot('HOAN_THANH'))
    await screen.findByText('Chưa chuyển được Task.')
    await user.click(screen.getByRole('button', { name: 'Đóng thông báo' }))
    await waitFor(() => expect(thongBaoLoi()).not.toBeInTheDocument())
  })
})

describe('kéo thả Kanban: hộp nhập lý do', () => {
  async function dungChoDuyet(email: string) {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Chờ kiểm', 'CHO_DUYET')
    const app = dungApp(bc.kho)
    await moBang(app.user, email)
    return { bc, t, user: app.user }
  }

  it.each([
    ['Trả lại', 'TRA_LAI', 'Trả lại', 'binh@vi-du.vn'],
    ['Bị lỗi', 'BI_LOI', 'Báo Bị lỗi', 'binh@vi-du.vn'],
    ['Huỷ', 'HUY', 'Huỷ Task', 'chi@vi-du.vn'],
  ] as const)('thả vào %s mở hộp lý do; lý do trống không gửi được; gửi lý do hợp lệ thì áp dụng và lưu vào lịch sử', async (_ten, sang, nhan, email) => {
    const { bc, t, user } = await dungChoDuyet(email)
    keo('Chờ kiểm', tieuDeCot(sang))
    const hop = within(await screen.findByRole('dialog'))
    expect(screen.getByRole('dialog')).toHaveAccessibleName(`${nhan}: nhập lý do`)
    // Chưa áp dụng gì khi hộp mới mở.
    expect((await task(bc.kho, t.id)).trangThai).toBe('CHO_DUYET')
    const gui = hop.getByRole('button', { name: nhan })
    expect(gui).toHaveAttribute('aria-disabled', 'true')
    await user.click(gui)
    await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), '   ')
    expect(hop.getByRole('button', { name: nhan })).toHaveAttribute('aria-disabled', 'true')
    expect((await task(bc.kho, t.id)).trangThai).toBe('CHO_DUYET')

    await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), 'Thiếu ảnh sản phẩm')
    await user.click(hop.getByRole('button', { name: nhan }))

    await waitFor(() => expect(tieuDeTrongCot(sang)).toEqual(['Chờ kiểm']))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    const sau = await task(bc.kho, t.id)
    expect(sau.trangThai).toBe(sang)
    expect(sau.soLanTraLai).toBe(sang === 'TRA_LAI' ? 1 : 0)
    const ls = await lichSu(bc.kho, t.id)
    expect(ls).toHaveLength(1)
    expect(ls[0]).toMatchObject({ tu: 'CHO_DUYET', sang, lyDo: 'Thiếu ảnh sản phẩm' })
    expect(tieuDeTrongCot('CHO_DUYET')).toEqual([])
  })

  it('đóng hộp (nút Đóng hoặc Esc) thì không đổi gì và thẻ ở cột cũ; kéo lại thì hộp bắt đầu với ô trống', async () => {
    const { bc, t, user } = await dungChoDuyet('binh@vi-du.vn')
    const truoc = await chup(bc.kho, t.id)

    keo('Chờ kiểm', tieuDeCot('TRA_LAI'))
    let hop = within(await screen.findByRole('dialog'))
    await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), 'Nháp dở')
    await user.click(hop.getByRole('button', { name: 'Đóng' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(tieuDeTrongCot('CHO_DUYET')).toEqual(['Chờ kiểm'])
    expect(await chup(bc.kho, t.id)).toEqual(truoc)

    keo('Chờ kiểm', tieuDeCot('BI_LOI'))
    hop = within(await screen.findByRole('dialog'))
    expect(hop.getByRole('textbox', { name: /^Lý do/ })).toHaveValue('')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(tieuDeTrongCot('CHO_DUYET')).toEqual(['Chờ kiểm'])
    expect(await chup(bc.kho, t.id)).toEqual(truoc)
  })

  it('Kho từ chối khi gửi lý do: lỗi hiện ngay trong hộp, thẻ vẫn ở cột cũ', async () => {
    const goc = taoKhoBoNho({ pmBanDau: PM })
    const bc = await dungBoiCanh(goc)
    const t = await taoTask(bc, 'Chờ kiểm', 'CHO_DUYET')
    const kho: KhoDuLieu = { ...goc, doiTrangThaiTask: async () => thatBai('LOI_HE_THONG') }
    const { user } = dungApp(goc, kho)
    await moBang(user, 'binh@vi-du.vn')
    keo('Chờ kiểm', tieuDeCot('TRA_LAI'))
    const hop = within(await screen.findByRole('dialog'))
    await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), 'Thiếu ảnh')
    await user.click(hop.getByRole('button', { name: 'Trả lại' }))
    expect(await hop.findByRole('alert')).toHaveTextContent('Chưa thực hiện được.')
    expect(tieuDeTrongCot('CHO_DUYET')).toEqual(['Chờ kiểm'])
    expect((await task(goc, t.id)).trangThai).toBe('CHO_DUYET')
  })
})

describe('kéo thả Kanban: thẻ đã chốt', () => {
  it('thẻ Hoàn thành và Huỷ không kéo ra khỏi cột được, kể cả với PM: không hộp lý do, không thông báo, không đổi gì', async () => {
    const bc = await dungBoiCanh()
    const xong = await taoTask(bc, 'Đã xong', 'HOAN_THANH')
    const huy = await taoTask(bc, 'Đã huỷ', 'HUY')
    const { user } = dungApp(bc.kho)
    await moBang(user, PM.email, true)
    const truoc = [await chup(bc.kho, xong.id), await chup(bc.kho, huy.id)]

    for (const tieuDe of ['Đã xong', 'Đã huỷ']) {
      for (const dich of ['MOI', 'DANG_LAM', 'TRA_LAI', 'HUY', 'HOAN_THANH'] as const) keo(tieuDe, tieuDeCot(dich))
    }

    await Promise.resolve()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(thongBaoLoi()).not.toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Đang kéo Task' })).not.toBeInTheDocument()
    expect(tieuDeTrongCot('HOAN_THANH')).toEqual(['Đã xong'])
    expect(tieuDeTrongCot('HUY')).toEqual(['Đã huỷ'])
    expect([await chup(bc.kho, xong.id), await chup(bc.kho, huy.id)]).toEqual(truoc)
  })

  it('cùng PM thì thẻ chưa chốt kéo được, còn thẻ đã chốt thì không có menu chuyển cột', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Đã xong', 'HOAN_THANH')
    await taoTask(bc, 'Đang làm', 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await moBang(user, PM.email, true)
    expect(screen.getByRole('button', { name: 'Chuyển Task "Đang làm" sang cột khác' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chuyển Task "Đã xong" sang cột khác' })).not.toBeInTheDocument()
    keo('Đang làm', tieuDeCot('CHO_DUYET'))
    await waitFor(() => expect(tieuDeTrongCot('CHO_DUYET')).toEqual(['Đang làm']))
  })
})

describe('kéo thả Kanban: bàn phím và menu trên thẻ', () => {
  it('menu chỉ liệt kê các cột người gọi chuyển được: Người kiểm tra thấy Hoàn thành, Trả lại, Bị lỗi; Thành viên khác không có menu', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Chờ kiểm', 'CHO_DUYET')
    const binh = dungApp(bc.kho)
    await moBang(binh.user, 'binh@vi-du.vn')
    await binh.user.click(screen.getByRole('button', { name: 'Chuyển Task "Chờ kiểm" sang cột khác' }))
    const muc = (await screen.findAllByRole('menuitem')).map((m) => m.textContent)
    expect(muc).toEqual(['Chuyển sang Hoàn thành', 'Chuyển sang Trả lại', 'Chuyển sang Bị lỗi'])
  })

  it('Thành viên không giữ vai nào trên Task không có menu chuyển cột', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Chờ kiểm', 'CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'em@vi-du.vn')
    expect(screen.queryByRole('button', { name: /sang cột khác/ })).not.toBeInTheDocument()
  })

  it('chỉ dùng bàn phím: Tab tới menu của thẻ, Enter mở, mũi tên chọn cột, Enter đổi trạng thái; có lịch sử và thẻ sang cột mới', async () => {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Làm trang chủ')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'an@vi-du.vn')

    const menu = screen.getByRole('button', { name: 'Chuyển Task "Làm trang chủ" sang cột khác' })
    screen.getByRole('button', { name: 'Làm trang chủ' }).focus()
    await user.tab()
    expect(document.activeElement).toBe(menu)
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('menuitem', { name: 'Chuyển sang Đang làm' })).toBeInTheDocument()
    await user.keyboard('{ArrowDown}{Enter}')

    await waitFor(() => expect(tieuDeTrongCot('DANG_LAM')).toEqual(['Làm trang chủ']))
    expect(await screen.findByText('Đã chuyển Task "Làm trang chủ" sang Đang làm.')).toBeInTheDocument()
    expect((await lichSu(bc.kho, t.id)).map((d) => `${d.tu}>${d.sang}`)).toEqual(['MOI>DANG_LAM'])
  })

  it('bàn phím với bước cần lý do: chọn Trả lại từ menu mở hộp lý do, nhập, Tab tới nút gửi, Enter', async () => {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Chờ kiểm', 'CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'binh@vi-du.vn')

    screen.getByRole('button', { name: 'Chờ kiểm' }).focus()
    await user.tab()
    await user.keyboard('{Enter}')
    await user.click(await screen.findByRole('menuitem', { name: 'Chuyển sang Trả lại' }))
    const hop = within(await screen.findByRole('dialog'))
    await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), 'Thiếu ảnh')
    // Tab từ ô lý do tới nút gửi (đi qua các điều khiển khác của hộp nếu có).
    const gui = hop.getByRole('button', { name: 'Trả lại' })
    for (let i = 0; i < 5 && document.activeElement !== gui; i++) await user.tab()
    expect(document.activeElement).toBe(gui)
    await user.keyboard('{Enter}')
    await waitFor(() => expect(tieuDeTrongCot('TRA_LAI')).toEqual(['Chờ kiểm']))
    expect((await lichSu(bc.kho, t.id))[0]).toMatchObject({ tu: 'CHO_DUYET', sang: 'TRA_LAI', lyDo: 'Thiếu ảnh' })
  })

  it('bước đổi cột bằng menu cho cùng kết quả với kéo thả', async () => {
    const dung = async (cach: 'keo' | 'menu') => {
      const bc = await dungBoiCanh()
      const t = await taoTask(bc, 'Chờ kiểm', 'CHO_DUYET')
      const { user } = dungApp(bc.kho)
      await moBang(user, 'binh@vi-du.vn')
      if (cach === 'keo') keo('Chờ kiểm', tieuDeCot('HOAN_THANH'))
      else {
        await user.click(screen.getByRole('button', { name: 'Chuyển Task "Chờ kiểm" sang cột khác' }))
        await user.click(await screen.findByRole('menuitem', { name: 'Chuyển sang Hoàn thành' }))
      }
      await waitFor(() => expect(tieuDeTrongCot('HOAN_THANH')).toEqual(['Chờ kiểm']))
      const ket = await chup(bc.kho, t.id)
      cleanup()
      return ket
    }
    expect(await dung('menu')).toEqual(await dung('keo'))
  })

  it('điều khiển của thẻ (tiêu đề, menu) đi tới được bằng Tab theo thứ tự cột', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Việc một')
    await taoTask(bc, 'Việc hai', 'CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await moBang(user, 'chi@vi-du.vn')
    screen.getByRole('combobox', { name: /^Trạng thái/ }).focus()
    const gap: string[] = []
    for (let i = 0; i < 8; i++) {
      await user.tab()
      gap.push((document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? '').trim())
    }
    expect(gap).toEqual(expect.arrayContaining(['Việc một', 'Chuyển Task "Việc một" sang cột khác', 'Việc hai', 'Chuyển Task "Việc hai" sang cột khác']))
    expect(gap.indexOf('Việc hai')).toBeGreaterThan(gap.indexOf('Chuyển Task "Việc một" sang cột khác'))
  })
})

describe('kéo thả Kanban: chưa biết quyền', () => {
  it('chưa tải được người trong dự án thì bảng chỉ xem, nói rõ, không có menu và kéo thả không làm gì', async () => {
    const goc = taoKhoBoNho({ pmBanDau: PM })
    const bc = await dungBoiCanh(goc)
    const t = await taoTask(bc, 'Làm trang chủ')
    const kho: KhoDuLieu = { ...goc, danhSachNguoiTrongDuAn: async () => thatBai('LOI_HE_THONG') }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, 'an@vi-du.vn')
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await bang()
    expect(await screen.findByText('Chưa kiểm xong quyền đổi trạng thái của bạn nên chưa kéo thả được.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sang cột khác/ })).not.toBeInTheDocument()
    keo('Làm trang chủ', tieuDeCot('DANG_LAM'))
    await Promise.resolve()
    expect((await task(goc, t.id)).trangThai).toBe('MOI')
    expect(tieuDeTrongCot('MOI')).toEqual(['Làm trang chủ'])
  })
})

describe('kéo thả và nút ở Ngăn trượt của Task cho cùng kết quả (bảng ca dùng chung của ticket 11)', () => {
  // Những loại người gọi đăng nhập và thấy bảng được; hai đường đi qua giao diện thật.
  const EMAIL: Partial<Record<LoaiNguoiGoi, string>> = {
    NGUOI_THUC_HIEN: 'an@vi-du.vn',
    NGUOI_KIEM_TRA: 'binh@vi-du.vn',
    SUPPORT_CUA_DU_AN: 'chi@vi-du.vn',
    THANH_VIEN_KHAC: 'em@vi-du.vn',
  }
  // Mọi bước của ma trận (Dự án hoạt động, lý do hợp lệ nếu bước cần) cho từng loại người gọi.
  const cacCa = BANG_CA_CHUYEN_TRANG_THAI.filter(
    (ca) =>
      EMAIL[ca.nguoiGoi] !== undefined &&
      ca.trangThaiDuAn === 'HOAT_DONG' &&
      timBuoc(ca.tu, ca.sang) !== undefined &&
      ca.lyDo === (timBuoc(ca.tu, ca.sang)?.canLyDo ? 'CO' : 'KHONG'),
  )
  const LY_DO = 'Chưa đạt yêu cầu'

  async function chayCa(cach: 'keo' | 'nut', ca: CaChuyenTrangThai): Promise<Awaited<ReturnType<typeof chup>>> {
    const bc = await dungBoiCanh()
    const t = await taoTask(bc, 'Làm trang chủ', ca.tu)
    const buoc = timBuoc(ca.tu, ca.sang)
    if (!buoc) throw new Error('Ca ngoài ma trận')
    const { user } = dungApp(bc.kho)
    await moBang(user, EMAIL[ca.nguoiGoi] as string)
    const truoc = await chup(bc.kho, t.id)

    if (cach === 'keo') {
      keo('Làm trang chủ', tieuDeCot(ca.sang))
    } else {
      await user.click(screen.getByRole('button', { name: 'Làm trang chủ' }))
      await screen.findByRole('dialog', { name: 'Làm trang chủ' })
      await waitFor(() =>
        expect(screen.queryByRole('progressbar', { name: 'Đang kiểm các bước làm được…' })).not.toBeInTheDocument(),
      )
      const nut = within(screen.getByRole('group', { name: 'Chuyển trạng thái' })).queryByRole('button', { name: buoc.nhan })
      if (nut) await user.click(nut)
    }
    if (ca.ketQua === 'DUOC' && buoc.canLyDo) {
      // Hộp nhập lý do; với đường "nút" nó mở đè lên Ngăn trượt của Task.
      const hop = within(await screen.findByRole('dialog', { name: `${buoc.nhan}: nhập lý do` }))
      await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), LY_DO)
      await user.click(hop.getByRole('button', { name: buoc.nhan }))
    }
    if (ca.ketQua === 'DUOC') await waitFor(async () => expect(await chup(bc.kho, t.id)).not.toEqual(truoc))
    else await new Promise((xong) => setTimeout(xong, 20))
    const sau = await chup(bc.kho, t.id)
    if (ca.ketQua !== 'DUOC') expect(sau).toEqual(truoc)
    cleanup()
    return sau
  }

  it('bảng ca có đủ ca: mọi bước của ma trận cho bốn loại người gọi', () => {
    expect(cacCa).toHaveLength(12 * 4)
    expect(cacCa.some((ca) => ca.ketQua === 'DUOC')).toBe(true)
    expect(cacCa.some((ca) => ca.ketQua === 'KHONG_CO_QUYEN')).toBe(true)
  })

  it.each(cacCa)('$nguoiGoi: $tu → $sang → $ketQua', async (ca: CaChuyenTrangThai) => {
    const keoTha = await chayCa('keo', ca)
    const nut = await chayCa('nut', ca)
    expect(keoTha).toEqual(nut)
    expect(keoTha.trangThai).toBe(ca.ketQua === 'DUOC' ? ca.sang : ca.tu)
    expect(keoTha.lichSu).toHaveLength(ca.ketQua === 'DUOC' ? 1 : 0)
  })
})
