// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { THONG_BAO_MAC_DINH, thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { THONG_BAO_SUA_TASK } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-123'
/** Đồng hồ ứng dụng dùng khi bấm lưu. */
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

async function taoNguoi(kho: KhoBoNho, email: string, tenHienThi: string, vai: VaiHeThong): Promise<string> {
  const hoSo = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
  await kho.moPhong.xacNhanEmail(email)
  if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(await phienCua(kho, PM.email), hoSo.id, { vai }))
  return hoSo.id
}

async function themVao(kho: KhoBoNho, duAn: DuAn, email: string) {
  giaTri(await kho.themNguoiVaoDuAn(await phienCua(kho, PM.email), duAn.id, { email }))
}

interface BoiCanh {
  kho: KhoBoNho
  duAn: DuAn
  anId: string
  binhId: string
  chiId: string
  task: Task
}

/** Dự án "Cửa hàng" có An, Bình, Chi (Thành viên) và một Task "Làm trang chủ": An làm, Bình duyệt. */
async function dungBoiCanh(goc: KhoBoNho = taoKho()): Promise<BoiCanh> {
  const pm = await phienCua(goc, PM.email)
  const duAn = giaTri(await goc.taoDuAn(pm, { ten: 'Cửa hàng' }, LUC))
  const anId = await taoNguoi(goc, 'an@vi-du.vn', 'An', 'THANH_VIEN')
  const binhId = await taoNguoi(goc, 'binh@vi-du.vn', 'Bình', 'THANH_VIEN')
  const chiId = await taoNguoi(goc, 'chi@vi-du.vn', 'Chi', 'THANH_VIEN')
  for (const email of ['an@vi-du.vn', 'binh@vi-du.vn', 'chi@vi-du.vn']) await themVao(goc, duAn, email)
  const task = giaTri(
    await goc.taoTask(
      pm,
      duAn.id,
      { tieuDe: 'Làm trang chủ', moTa: 'Theo bản thiết kế', nguoiThucHienId: anId, nguoiKiemTraId: binhId },
      LUC,
    ),
  )
  return { kho: goc, duAn, anId, binhId, chiId, task }
}

async function docTask(bc: BoiCanh): Promise<Task> {
  return giaTri(await bc.kho.layTask(await phienCua(bc.kho, PM.email), bc.task.id))
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

async function pmMoDuAn(user: User, ten: string) {
  await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
}

async function moDuAnCuaToi(user: User, ten: string) {
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
}

/** Mở chi tiết Task `tieuDe` từ bảng Task của Dự án đang mở. */
async function moTask(user: User, tieuDe: string) {
  const vung = within(screen.getByRole('group', { name: 'Task của Dự án' }))
  await user.click(await vung.findByRole('button', { name: tieuDe }))
  await screen.findByRole('heading', { level: 2, name: tieuDe })
}

async function pmMoTask(user: User, tieuDe = 'Làm trang chủ') {
  await dangNhap(user, PM.email)
  await pmMoDuAn(user, 'Cửa hàng')
  await moTask(user, tieuDe)
}

function vungSua() {
  return within(screen.getByRole('group', { name: 'Sửa Task' }))
}

async function chon(user: User, nhan: string, tenHienThi: string) {
  await user.click(await screen.findByRole('combobox', { name: new RegExp(`^${nhan}`) }))
  await user.click(await screen.findByRole('option', { name: new RegExp(`^${tenHienThi} \\(`) }))
}

describe('sửa Task trên màn chi tiết', () => {
  it('PM sửa tiêu đề và mô tả: dữ liệu và dấu vết đổi, người tạo giữ nguyên', async () => {
    const bc = await dungBoiCanh()
    const { user, ungDung } = dungApp(bc.kho)
    await pmMoTask(user)

    const oTieuDe = await vungSua().findByLabelText('Tiêu đề')
    expect(oTieuDe).toHaveValue('Làm trang chủ')
    expect(vungSua().getByLabelText('Mô tả')).toHaveValue('Theo bản thiết kế')
    await user.clear(oTieuDe)
    await user.type(oTieuDe, '  Làm trang chủ v2  ')
    await user.clear(vungSua().getByLabelText('Mô tả'))
    await user.click(vungSua().getByRole('button', { name: 'Lưu thay đổi' }))

    expect(await ungDung.findByText('Đã lưu thay đổi của Task.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Làm trang chủ v2' })).toBeInTheDocument()
    const dauVet = within(screen.getByRole('group', { name: 'Dấu vết' }))
    expect(dauVet.getByText('Người tạo: An PM')).toBeInTheDocument()
    expect(dauVet.getByText('Người chỉnh sửa gần nhất: An PM')).toBeInTheDocument()
    expect(dauVet.getByText('Ngày chỉnh sửa gần nhất: 01/03/2026 08:00')).toBeInTheDocument()

    const task = await docTask(bc)
    expect(task.tieuDe).toBe('Làm trang chủ v2')
    expect(task.moTa).toBe('')
    expect(task.dauVet.suaBoi).toEqual({ id: expect.any(String), tenHienThi: 'An PM' })
  })

  it('tiêu đề trống: báo lỗi tiếng Việt ở ô tiêu đề, dữ liệu không đổi', async () => {
    const bc = await dungBoiCanh()
    const { user, ungDung } = dungApp(bc.kho)
    await pmMoTask(user)

    await user.clear(await vungSua().findByLabelText('Tiêu đề'))
    await user.click(vungSua().getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await ungDung.findByText('Chưa lưu được thay đổi của Task.')).toBeInTheDocument()
    expect(ungDung.getAllByText('Tiêu đề Task không được để trống.').length).toBeGreaterThan(0)
    expect(await docTask(bc)).toEqual(bc.task)
  })

  it('PM đổi Người thực hiện: tên mới hiện ra, dấu vết đổi', async () => {
    const bc = await dungBoiCanh()
    const { user, ungDung } = dungApp(bc.kho)
    await pmMoTask(user)

    await chon(user, 'Người thực hiện', 'Chi')
    await user.click(vungSua().getByRole('button', { name: 'Đổi người' }))
    expect(await ungDung.findByText('Đã đổi người của Task.')).toBeInTheDocument()
    const thongTin = within(screen.getByRole('group', { name: 'Thông tin Task' }))
    expect(thongTin.getByText('Người thực hiện: Chi')).toBeInTheDocument()
    expect(thongTin.getByText('Người kiểm tra: Bình')).toBeInTheDocument()
    expect((await docTask(bc)).nguoiThucHien).toEqual({ id: bc.chiId, tenHienThi: 'Chi' })
  })

  it('đổi hai vai thành cùng một người: báo TRUNG_NGUOI, không đổi gì', async () => {
    const bc = await dungBoiCanh()
    const { user, ungDung } = dungApp(bc.kho)
    await pmMoTask(user)

    await chon(user, 'Người thực hiện', 'Bình')
    await user.click(vungSua().getByRole('button', { name: 'Đổi người' }))
    expect((await ungDung.findAllByText(THONG_BAO_MAC_DINH.TRUNG_NGUOI)).length).toBeGreaterThan(0)
    expect(await docTask(bc)).toEqual(bc.task)
  })

  it('Kho từ chối vì người được chọn đã rời Dự án: hiện lý do NGUOI_NGOAI_DU_AN', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, doiNguoiTask: async () => thatBai('NGUOI_NGOAI_DU_AN') }
    const bc = await dungBoiCanh(goc)
    const { user, ungDung } = dungApp(goc, kho)
    await pmMoTask(user)
    await user.click(await vungSua().findByRole('button', { name: 'Đổi người' }))
    const canhBao = (await ungDung.findByText('Chưa đổi được người của Task.')).closest('[role="alert"]')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.NGUOI_NGOAI_DU_AN)
    expect(await docTask(bc)).toEqual(bc.task)
  })

  it('Support của Dự án thấy biểu mẫu sửa', async () => {
    const bc = await dungBoiCanh()
    await taoNguoi(bc.kho, 'son@vi-du.vn', 'Sơn', 'SUPPORT')
    await themVao(bc.kho, bc.duAn, 'son@vi-du.vn')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'son@vi-du.vn')
    await moDuAnCuaToi(user, 'Cửa hàng')
    await moTask(user, 'Làm trang chủ')
    expect(await vungSua().findByRole('button', { name: 'Lưu thay đổi' })).toBeInTheDocument()
    expect(vungSua().getByRole('button', { name: 'Đổi người' })).toBeInTheDocument()
  })
})

describe('Task chỉ xem, kèm lý do', () => {
  it.each([
    { ten: 'Hoàn thành', trangThai: 'HOAN_THANH' as const },
    { ten: 'Huỷ', trangThai: 'HUY' as const },
  ])('Task $ten: PM không có biểu mẫu, thấy lý do Task đã chốt', async ({ trangThai }) => {
    const bc = await dungBoiCanh()
    giaTri(await bc.kho.chuDuAn.datTrangThaiTask(bc.task.id, trangThai))
    const { user } = dungApp(bc.kho)
    await pmMoTask(user)
    expect(await vungSua().findByText(THONG_BAO_SUA_TASK.daChot)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đổi người' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Tiêu đề')).not.toBeInTheDocument()
  })

  it.each([
    { ca: 'Người thực hiện', email: 'an@vi-du.vn' },
    { ca: 'Người kiểm tra', email: 'binh@vi-du.vn' },
    { ca: 'Thành viên khác trong Dự án', email: 'chi@vi-du.vn' },
  ])('$ca: không có biểu mẫu, thấy lý do không có quyền', async ({ email }) => {
    const bc = await dungBoiCanh()
    const { user } = dungApp(bc.kho)
    await dangNhap(user, email)
    await moDuAnCuaToi(user, 'Cửa hàng')
    await moTask(user, 'Làm trang chủ')
    expect(await vungSua().findByText(THONG_BAO_SUA_TASK.khongQuanLy)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đổi người' })).not.toBeInTheDocument()
  })

  it('Dự án đã Lưu trữ: PM thấy lý do Dự án đã Lưu trữ, không có biểu mẫu', async () => {
    const bc = await dungBoiCanh()
    giaTri(await bc.kho.luuTruDuAn(await phienCua(bc.kho, PM.email), bc.duAn.id, LUC))
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
    await user.click(await screen.findByRole('radio', { name: 'Lưu trữ' }))
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
    await moTask(user, 'Làm trang chủ')
    expect(await vungSua().findByText(THONG_BAO_SUA_TASK.daLuuTru)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu thay đổi' })).not.toBeInTheDocument()
  })
})

describe('sửa Task: trạng thái đang tải và lỗi', () => {
  it('đang kiểm quyền (tải người trong dự án) thì hiện trạng thái đang tải', async () => {
    const goc = taoKho()
    await dungBoiCanh(goc)
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      // Trang Dự án gọi hai lần (Dự án, bảng Task không gọi); từ lần của PhanSuaTask thì treo.
      danhSachNguoiTrongDuAn: (phien, id) => {
        lanGoi += 1
        return lanGoi <= 1 ? goc.danhSachNguoiTrongDuAn(phien, id) : new Promise(() => {})
      },
    }
    const { user } = dungApp(goc, kho)
    await pmMoTask(user)
    expect(await screen.findByRole('progressbar', { name: 'Đang kiểm quyền sửa Task…' })).toBeInTheDocument()
  })

  it('lỗi tải người trong dự án thì hiện thông báo và thử lại được', async () => {
    const goc = taoKho()
    await dungBoiCanh(goc)
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      danhSachNguoiTrongDuAn: async (phien, id) => {
        lanGoi += 1
        return lanGoi === 2 ? thatBai('LOI_HE_THONG') : goc.danhSachNguoiTrongDuAn(phien, id)
      },
    }
    const { user } = dungApp(goc, kho)
    await pmMoTask(user)
    const canhBao = await vungSua().findByRole('alert')
    expect(canhBao).toHaveTextContent('Không tải được người trong dự án')
    await user.click(vungSua().getByRole('button', { name: 'Thử lại' }))
    expect(await vungSua().findByRole('button', { name: 'Lưu thay đổi' })).toBeInTheDocument()
  })
})

describe('gỡ người khỏi Dự án và giao lại Task', () => {
  const vungNguoi = () => within(screen.getByRole('group', { name: 'Người trong dự án' }))

  it('bấm Gỡ người đang giữ Task chưa chốt: hiện danh sách Task, chưa gỡ cho tới khi xác nhận', async () => {
    const bc = await dungBoiCanh()
    const pm = await phienCua(bc.kho, PM.email)
    // An còn giữ một Task nữa (kiểm tra) đã Hoàn thành: không có trong danh sách.
    const xong = giaTri(
      await bc.kho.taoTask(pm, bc.duAn.id, { tieuDe: 'Việc đã xong', nguoiThucHienId: bc.binhId, nguoiKiemTraId: bc.anId }, LUC),
    )
    giaTri(await bc.kho.chuDuAn.datTrangThaiTask(xong.id, 'HOAN_THANH'))
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')

    await user.click(await vungNguoi().findByRole('button', { name: 'Gỡ An' }))
    const panel = within(await screen.findByRole('group', { name: 'Task đang giữ' }))
    expect(panel.getByText('An đang giữ 1 Task chưa chốt.')).toBeInTheDocument()
    const bang = within(panel.getByRole('table', { name: 'Task chưa chốt của An' }))
    expect(bang.getByText('Làm trang chủ')).toBeInTheDocument()
    expect(bang.getByText('Người thực hiện')).toBeInTheDocument()
    expect(bang.getByText('Mới')).toBeInTheDocument()
    expect(bang.queryByText('Việc đã xong')).not.toBeInTheDocument()
    // Chưa gỡ.
    expect(giaTri(await bc.kho.danhSachNguoiTrongDuAn(pm, bc.duAn.id)).map((n) => n.id)).toContain(bc.anId)

    // Không gỡ: đóng danh sách, An vẫn ở trong Dự án.
    await user.click(panel.getByRole('button', { name: 'Không gỡ' }))
    expect(screen.queryByRole('group', { name: 'Task đang giữ' })).not.toBeInTheDocument()
    expect(giaTri(await bc.kho.danhSachNguoiTrongDuAn(pm, bc.duAn.id)).map((n) => n.id)).toContain(bc.anId)
  })

  it('vẫn gỡ được: Task giữ nguyên An và hiện "đã rời dự án" ở bảng và ở chi tiết; giao lại thì dấu hiệu biến mất', async () => {
    const bc = await dungBoiCanh()
    const { user, ungDung } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')

    await user.click(await vungNguoi().findByRole('button', { name: 'Gỡ An' }))
    const panel = within(await screen.findByRole('group', { name: 'Task đang giữ' }))
    await user.click(panel.getByRole('button', { name: 'Vẫn gỡ An' }))
    expect(await ungDung.findByText(/^Đã gỡ An khỏi Dự án/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Task đang giữ' })).not.toBeInTheDocument()

    const task = await docTask(bc)
    expect(task.nguoiThucHien).toEqual({ id: bc.anId, tenHienThi: 'An', daRoiDuAn: true })

    const bang = within(await screen.findByRole('table', { name: 'Danh sách Task' }))
    expect(bang.getByText('An')).toBeInTheDocument()
    expect(bang.getByText(THONG_BAO_SUA_TASK.daRoiDuAn)).toBeInTheDocument()

    await moTask(user, 'Làm trang chủ')
    const thongTin = within(screen.getByRole('group', { name: 'Thông tin Task' }))
    expect(thongTin.getByText('Người thực hiện: An')).toBeInTheDocument()
    expect(thongTin.getByText(THONG_BAO_SUA_TASK.daRoiDuAn)).toBeInTheDocument()

    await chon(user, 'Người thực hiện', 'Chi')
    await user.click(vungSua().getByRole('button', { name: 'Đổi người' }))
    expect(await ungDung.findByText('Đã đổi người của Task.')).toBeInTheDocument()
    expect(thongTin.getByText('Người thực hiện: Chi')).toBeInTheDocument()
    expect(thongTin.queryByText(THONG_BAO_SUA_TASK.daRoiDuAn)).not.toBeInTheDocument()
    expect((await docTask(bc)).nguoiThucHien.daRoiDuAn).toBeUndefined()
  })

  it('từ danh sách Task đang giữ mở Task để giao lại ngay', async () => {
    const bc = await dungBoiCanh()
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await user.click(await vungNguoi().findByRole('button', { name: 'Gỡ An' }))
    const panel = within(await screen.findByRole('group', { name: 'Task đang giữ' }))
    await user.click(panel.getByRole('button', { name: 'Làm trang chủ' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Làm trang chủ' })).toBeInTheDocument()
    expect(await vungSua().findByRole('button', { name: 'Đổi người' })).toBeInTheDocument()
  })

  it('người không giữ Task chưa chốt nào thì gỡ ngay, không hỏi', async () => {
    const bc = await dungBoiCanh()
    giaTri(await bc.kho.chuDuAn.datTrangThaiTask(bc.task.id, 'HUY'))
    const { user, ungDung } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await user.click(await vungNguoi().findByRole('button', { name: 'Gỡ An' }))
    expect(await ungDung.findByText(/^Đã gỡ An khỏi Dự án/)).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Task đang giữ' })).not.toBeInTheDocument()
  })

  it('không kiểm được Task đang giữ (lỗi): hiện thông báo, vẫn gỡ được khi người dùng chọn', async () => {
    const goc = taoKho()
    const bc = await dungBoiCanh(goc)
    const kho: KhoDuLieu = { ...goc, danhSachTaskNguoiDangGiu: async () => thatBai('LOI_HE_THONG') }
    const { user, ungDung } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await user.click(await vungNguoi().findByRole('button', { name: 'Gỡ An' }))
    const panel = within(await screen.findByRole('group', { name: 'Task đang giữ' }))
    expect(panel.getByText('Chưa kiểm được Task An đang giữ.')).toBeInTheDocument()
    expect(panel.getByText(THONG_BAO_MAC_DINH.LOI_HE_THONG)).toBeInTheDocument()
    expect(panel.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument()
    await user.click(panel.getByRole('button', { name: 'Vẫn gỡ An' }))
    expect(await ungDung.findByText(/^Đã gỡ An khỏi Dự án/)).toBeInTheDocument()
    const pm = await phienCua(goc, PM.email)
    expect(giaTri(await goc.danhSachNguoiTrongDuAn(pm, bc.duAn.id)).map((n) => n.id)).not.toContain(bc.anId)
  })
})
