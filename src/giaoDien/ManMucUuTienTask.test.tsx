// @vitest-environment jsdom
// Mức ưu tiên của Task trên giao diện (ticket truong-moi 04): chọn khi tạo, đổi ở tab Sửa của Ngăn trượt
// (kèm dòng lịch sử), hiện trên thẻ Kanban, thứ tự trong cột, bộ lọc, và cột ở Việc của tôi, Chờ tôi duyệt.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import type { MucUuTien } from '../luat/mucUuTien'
import { THONG_BAO_SUA_TASK, TEN_TRANG_THAI_TASK, type TrangThaiTask } from '../luat/task'
import { choNganTruot, moTabTask } from '../test/khungUngDung'
import { maDuAnMoi } from '../test/maDuAn'

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function phienCua(kho: KhoDuLieu, email: string): Promise<Phien> {
  return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
}

interface BoiCanh {
  kho: KhoBoNho
  duAn: DuAn
  an: string
  binh: string
}

/** Dự án "Cửa hàng" với hai Thành viên trong đó: An và Bình. */
async function dungBoiCanh(): Promise<BoiCanh> {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const pm = await phienCua(kho, PM.email)
  const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC))
  const id: Record<string, string> = {}
  for (const [email, ten] of [
    ['an@vi-du.vn', 'An'],
    ['binh@vi-du.vn', 'Bình'],
  ]) {
    id[ten] = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten })).id
    await kho.moPhong.xacNhanEmail(email)
    giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email }))
  }
  return { kho, duAn, an: id.An, binh: id.Bình }
}

/** PM tạo Task qua Kho (An làm, Bình duyệt) với mức và hạn cho trước, rồi đặt thẳng trạng thái. */
async function taoTask(
  bc: BoiCanh,
  tieuDe: string,
  mucUuTien?: MucUuTien,
  han: string | null = null,
  trangThai: TrangThaiTask = 'MOI',
): Promise<Task> {
  const task = giaTri(
    await bc.kho.taoTask(
      await phienCua(bc.kho, PM.email),
      bc.duAn.id,
      { tieuDe, han, ...(mucUuTien ? { mucUuTien } : {}), nguoiThucHienId: bc.an, nguoiKiemTraId: bc.binh },
      LUC,
    ),
  )
  if (trangThai !== 'MOI') giaTri(await bc.kho.chuDuAn.datTrangThaiTask(task.id, trangThai))
  return task
}

function dungApp(kho: KhoBoNho) {
  const user = userEvent.setup()
  render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => LUC} />)
  return { user }
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

/** PM mở Dự án "Cửa hàng" từ mục Tất cả Dự án. */
async function pmMoCuaHang(user: User) {
  await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
  await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
  await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
}

async function bang() {
  return within(await screen.findByRole('group', { name: 'Bảng Kanban' }))
}

function cot(b: ReturnType<typeof within>, trangThai: TrangThaiTask) {
  return within(b.getByRole('group', { name: `Cột ${TEN_TRANG_THAI_TASK[trangThai]}` }))
}

/** Tiêu đề các thẻ trong một cột, theo đúng thứ tự hiện. */
function thuTuThe(b: ReturnType<typeof within>, trangThai: TrangThaiTask): string[] {
  const ds = cot(b, trangThai).queryByRole('list')
  if (!ds) return []
  return within(ds)
    .getAllByRole('listitem')
    .map((the) => within(the).getAllByRole('button')[0].textContent ?? '')
}

function theCua(b: ReturnType<typeof within>, tieuDe: string) {
  return within(b.getByRole('button', { name: tieuDe }).closest('[role="listitem"]') as HTMLElement)
}

async function chonO(user: User, vung: ReturnType<typeof within>, nhan: string, lua: string) {
  await user.click(vung.getByRole('combobox', { name: new RegExp(`^${nhan}`) }))
  await user.click(await screen.findByRole('option', { name: lua }))
}

async function cacTask(bc: BoiCanh): Promise<Task[]> {
  return giaTri(await bc.kho.danhSachTask(await phienCua(bc.kho, PM.email), bc.duAn.id))
}

describe('Mức ưu tiên khi tạo Task', () => {
  it('ô Mức ưu tiên mặc định Trung bình; tạo không đổi thì Task là Trung bình, chọn Cao thì Task là Cao', async () => {
    const bc = await dungBoiCanh()
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await pmMoCuaHang(user)

    async function tao(tieuDe: string, muc: string | null) {
      await user.click(await screen.findByRole('button', { name: 'Tạo Task' }))
      const ngan = within(await choNganTruot('Tạo Task'))
      await user.click(await ngan.findByLabelText('Tiêu đề'))
      await user.paste(tieuDe)
      expect(ngan.getByRole('combobox', { name: /^Mức ưu tiên/ })).toHaveTextContent('Trung bình')
      if (muc) await chonO(user, ngan, 'Mức ưu tiên', muc)
      await chonO(user, ngan, 'Người thực hiện', 'An (an@vi-du.vn)')
      await chonO(user, ngan, 'Người kiểm tra', 'Bình (binh@vi-du.vn)')
      await user.click(ngan.getByRole('button', { name: 'Tạo Task' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    }

    await tao('Việc thường', null)
    await tao('Việc gấp', 'Cao')
    const ds = await cacTask(bc)
    expect(ds.find((t) => t.tieuDe === 'Việc thường')?.mucUuTien).toBe('TRUNG_BINH')
    expect(ds.find((t) => t.tieuDe === 'Việc gấp')?.mucUuTien).toBe('CAO')
    // Thẻ mới hiện Mức ưu tiên bằng chữ.
    const b = await bang()
    expect(theCua(b, 'Việc gấp').getByText('Cao')).toBeInTheDocument()
    expect(theCua(b, 'Việc thường').getByText('Trung bình')).toBeInTheDocument()
  })
})

describe('Mức ưu tiên trên bảng Kanban', () => {
  it('thẻ hiện Mức ưu tiên bằng chữ; trong cột Cao trước Trung bình trước Thấp, cùng mức thì hạn gần trước, không hạn sau', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Thấp gấp', 'THAP', '2026-03-02')
    await taoTask(bc, 'Trung bình không hạn')
    await taoTask(bc, 'Trung bình hạn xa', 'TRUNG_BINH', '2026-09-01')
    await taoTask(bc, 'Trung bình hạn gần', 'TRUNG_BINH', '2026-04-01')
    await taoTask(bc, 'Cao không hạn', 'CAO')
    await taoTask(bc, 'Đang làm cao', 'CAO', null, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))

    const b = await bang()
    expect(thuTuThe(b, 'MOI')).toEqual([
      'Cao không hạn',
      'Trung bình hạn gần',
      'Trung bình hạn xa',
      'Trung bình không hạn',
      'Thấp gấp',
    ])
    expect(thuTuThe(b, 'DANG_LAM')).toEqual(['Đang làm cao'])
    const the = theCua(b, 'Thấp gấp')
    expect(the.getByText('Mức ưu tiên:')).toBeInTheDocument()
    expect(the.getByText('Thấp')).toBeInTheDocument()
    expect(theCua(b, 'Cao không hạn').getByText('Cao')).toBeInTheDocument()
  })

  it('lọc theo Mức ưu tiên Cao chỉ còn Task mức Cao; kết hợp được với lọc trạng thái; bỏ lọc thì đủ lại', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Cao mới', 'CAO')
    await taoTask(bc, 'Cao đang làm', 'CAO', null, 'DANG_LAM')
    await taoTask(bc, 'Trung bình mới')
    await taoTask(bc, 'Thấp đang làm', 'THAP', null, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await bang()
    const boLoc = within(screen.getByRole('group', { name: 'Bộ lọc Task' }))
    const tatCa = async () => [...thuTuThe(await bang(), 'MOI'), ...thuTuThe(await bang(), 'DANG_LAM')].sort()

    await chonO(user, boLoc, 'Mức ưu tiên', 'Cao')
    expect(await tatCa()).toEqual(['Cao mới', 'Cao đang làm'].sort())
    expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Đang lọc: 2 trên 4 Task.')

    await chonO(user, boLoc, 'Trạng thái', 'Đang làm')
    expect(await tatCa()).toEqual(['Cao đang làm'])

    await user.click(screen.getByRole('button', { name: 'Bỏ lọc' }))
    expect(await tatCa()).toEqual(['Cao mới', 'Cao đang làm', 'Thấp đang làm', 'Trung bình mới'].sort())
  })
})

describe('Mức ưu tiên trong Ngăn trượt của Task', () => {
  it('ngăn hiện Mức ưu tiên; PM đổi ở tab Sửa thì ngăn và thẻ hiện mức mới, lịch sử có dòng người đổi, mức cũ, mức mới', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await pmMoCuaHang(user)
    await user.click(cot(await bang(), 'MOI').getByRole('button', { name: 'Làm trang chủ' }))
    const ngan = within(await choNganTruot('Làm trang chủ'))
    const thongTin = within(ngan.getByRole('group', { name: 'Thông tin Task' }))
    expect(thongTin.getByText('Mức ưu tiên:')).toBeInTheDocument()
    expect(thongTin.getByText('Trung bình')).toBeInTheDocument()

    await moTabTask(user, 'Sửa')
    const sua = within(await ngan.findByRole('group', { name: 'Sửa Task' }))
    // Lưu mà không đổi mức: không có dòng lịch sử nào.
    await user.click(sua.getByRole('button', { name: 'Lưu thay đổi' }))
    await ngan.findByText('Đã lưu thay đổi của Task.')
    await chonO(user, sua, 'Mức ưu tiên', 'Cao')
    await user.click(sua.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(thongTin.getByText('Cao')).toBeInTheDocument())

    await moTabTask(user, 'Lịch sử')
    const lichSu = within(await ngan.findByRole('group', { name: 'Lịch sử Task' }))
    expect(await lichSu.findByText('Mức ưu tiên: Trung bình sang Cao')).toBeInTheDocument()
    expect(lichSu.getByText('An PM, 01/03/2026 08:00')).toBeInTheDocument()
    expect(lichSu.getAllByRole('listitem')).toHaveLength(1)
    // Bảng phía sau đọc lại: thẻ hiện mức mới.
    await waitFor(() => expect(theCua(within(screen.getByRole('group', { name: 'Bảng Kanban' })), 'Làm trang chủ').getByText('Cao')).toBeInTheDocument())
  })

  it('lịch sử hiện dòng đổi Mức ưu tiên xen giữa dòng đổi trạng thái, theo thời gian', async () => {
    const bc = await dungBoiCanh()
    const task = await taoTask(bc, 'Làm trang chủ')
    const pm = await phienCua(bc.kho, PM.email)
    const an = await phienCua(bc.kho, 'an@vi-du.vn')
    giaTri(await bc.kho.doiTrangThaiTask(an, task.id, { sang: 'DANG_LAM' }, new Date('2026-03-01T09:00:00+07:00')))
    giaTri(await bc.kho.suaTask(pm, task.id, { mucUuTien: 'THAP' }, new Date('2026-03-01T10:00:00+07:00')))
    giaTri(await bc.kho.doiTrangThaiTask(an, task.id, { sang: 'CHO_DUYET' }, new Date('2026-03-01T11:00:00+07:00')))
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await user.click(cot(await bang(), 'CHO_DUYET').getByRole('button', { name: 'Làm trang chủ' }))
    const ngan = within(await choNganTruot('Làm trang chủ'))
    const lichSu = within(await ngan.findByRole('group', { name: 'Lịch sử Task' }))
    await lichSu.findByText('Mức ưu tiên: Trung bình sang Thấp')
    expect(lichSu.getAllByRole('listitem').map((dong) => dong.textContent)).toEqual([
      expect.stringContaining('Mới sang Đang làm'),
      expect.stringContaining('Mức ưu tiên: Trung bình sang Thấp'),
      expect.stringContaining('Đang làm sang Chờ duyệt'),
    ])
  })

  it('Người thực hiện (Thành viên) thấy Mức ưu tiên nhưng không có tab Sửa để đổi, kèm lý do', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Làm trang chủ', 'CAO')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await user.click(cot(await bang(), 'MOI').getByRole('button', { name: 'Làm trang chủ' }))
    const ngan = within(await choNganTruot('Làm trang chủ'))
    expect(within(ngan.getByRole('group', { name: 'Thông tin Task' })).getByText('Cao')).toBeInTheDocument()
    expect(await ngan.findByText(THONG_BAO_SUA_TASK.khongQuanLy)).toBeInTheDocument()
    expect(ngan.queryByRole('tab', { name: 'Sửa' })).not.toBeInTheDocument()
  })
})

describe('cột Mức ưu tiên ở Việc của tôi và Chờ tôi duyệt', () => {
  it.each([
    { muc: 'Việc của tôi', email: 'an@vi-du.vn', trangThai: 'DANG_LAM' as const },
    { muc: 'Chờ tôi duyệt', email: 'binh@vi-du.vn', trangThai: 'CHO_DUYET' as const },
  ])('$muc có cột Mức ưu tiên, mỗi dòng hiện mức của Task bằng chữ', async ({ muc, email, trangThai }) => {
    const bc = await dungBoiCanh()
    await taoTask(bc, 'Việc gấp', 'CAO', null, trangThai)
    await taoTask(bc, 'Việc thong thả', 'THAP', null, trangThai)
    const { user } = dungApp(bc.kho)
    await dangNhap(user, email)
    await user.click(screen.getByRole('button', { name: muc }))
    const bangViec = within(await screen.findByRole('table', { name: muc }))
    expect(bangViec.getByRole('columnheader', { name: 'Mức ưu tiên' })).toBeInTheDocument()
    const dong = (tieuDe: string) => within(bangViec.getByRole('button', { name: tieuDe }).closest('tr') as HTMLElement)
    expect(dong('Việc gấp').getByText('Cao')).toBeInTheDocument()
    expect(dong('Việc thong thả').getByText('Thấp')).toBeInTheDocument()
  })
})
