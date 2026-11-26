// @vitest-environment jsdom
// Trang chi tiết Dự án có dải tóm tắt và bốn tab (ticket bố cục 03, spec story 21–27).
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import type { TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { choNganTruot, choTongQuanTaiXong, moTabDuAn, type TabChiTietDuAn } from '../test/khungUngDung'

const MAT_KHAU = 'matkhau-123'
/** Lúc dựng dữ liệu (tạo Dự án, tạo Task). */
const LUC_TAO = new Date('2026-02-01T08:00:00+07:00')
/** Đồng hồ ứng dụng: hôm nay là 01/03/2026 theo giờ Việt Nam. */
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }
const CAC_TAB: TabChiTietDuAn[] = ['Task', 'Người trong dự án', 'Thông tin', 'GitHub']

type User = ReturnType<typeof userEvent.setup>

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

interface BoiCanh {
  kho: KhoBoNho
  duAn: DuAn
  an: string
  binh: string
}

/** Dự án "Cửa hàng" với hai Thành viên An và Bình, một repo đã gắn; chưa có Task. */
async function dungBoiCanh(goc: KhoBoNho = taoKhoBoNho({ pmBanDau: PM })): Promise<BoiCanh> {
  const pm = await phienCua(goc, PM.email)
  const duAn = giaTri(await goc.taoDuAn(pm, { ten: 'Cửa hàng', moTa: 'Bán hàng trực tuyến' }, LUC_TAO))
  const an = await taoNguoi(goc, 'an@vi-du.vn', 'An', 'THANH_VIEN')
  const binh = await taoNguoi(goc, 'binh@vi-du.vn', 'Bình', 'THANH_VIEN')
  for (const email of ['an@vi-du.vn', 'binh@vi-du.vn']) giaTri(await goc.themNguoiVaoDuAn(pm, duAn.id, { email }))
  giaTri(await goc.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/web' }))
  return { kho: goc, duAn, an, binh }
}

/** PM tạo Task qua Kho lúc `LUC_TAO` rồi đặt thẳng trạng thái. */
async function taoTask(
  bc: BoiCanh,
  tieuDe: string,
  trangThai: TrangThaiTask = 'MOI',
  han: string | null = null,
): Promise<Task> {
  const task = giaTri(
    await bc.kho.taoTask(
      await phienCua(bc.kho, PM.email),
      bc.duAn.id,
      { tieuDe, han, nguoiThucHienId: bc.an, nguoiKiemTraId: bc.binh },
      LUC_TAO,
    ),
  )
  if (trangThai !== 'MOI') giaTri(await bc.kho.chuDuAn.datTrangThaiTask(task.id, trangThai))
  return task
}

/**
 * Bảy Task: 2 Hoàn thành, 1 Huỷ (không tính vào mẫu số), 3 chưa xong; Tiến độ 2/5 = 40%. Trễ hạn (hôm
 * nay 01/03/2026): Đang làm hạn 15/02 và Chờ duyệt hạn 20/02, còn Task hạn đúng hôm nay, Task Hoàn
 * thành hay Huỷ đã qua hạn thì không trễ, nên 2 Task Trễ hạn.
 */
async function dungTaskMau(bc: BoiCanh) {
  await taoTask(bc, 'Xong sớm', 'HOAN_THANH')
  await taoTask(bc, 'Xong trễ', 'HOAN_THANH', '2026-02-10')
  await taoTask(bc, 'Bỏ', 'HUY', '2026-02-10')
  await taoTask(bc, 'Đang làm trễ', 'DANG_LAM', '2026-02-15')
  await taoTask(bc, 'Chờ duyệt trễ', 'CHO_DUYET', '2026-02-20')
  await taoTask(bc, 'Hạn hôm nay', 'MOI', '2026-03-01')
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

/** PM mở Dự án từ mục Tất cả Dự án; người khác mở từ mục Dự án của tôi. */
async function moDuAn(user: User, ten: string, quaTatCa: boolean) {
  if (quaTatCa) await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
  else await user.click(screen.getByRole('button', { name: 'Dự án của tôi' }))
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
}

/** Mô tả Dự án đang hiện (chỉ xem) ở tab Thông tin. */
function moTaDuAn() {
  return within(screen.getByRole('group', { name: 'Mô tả Dự án' }))
}

function daiTomTat() {
  return within(screen.getByRole('group', { name: 'Tóm tắt Dự án' }))
}

/** Giá trị đang hiện trong một ô của dải tóm tắt ("Tiến độ của Dự án" hoặc "Số Task Trễ hạn"). */
function oTomTat(nhan: string) {
  return within(daiTomTat().getByRole('group', { name: nhan }))
}

/** Chờ dải tóm tắt hiện đúng Tiến độ và số Task Trễ hạn. */
async function choTomTat(tienDo: string, soTreHan: string) {
  await waitFor(() => {
    expect(oTomTat('Tiến độ của Dự án').getByText(tienDo)).toBeInTheDocument()
    expect(oTomTat('Số Task Trễ hạn').getByText(soTreHan)).toBeInTheDocument()
  })
}

/** Dấu hiệu nội dung riêng của từng tab. */
const NHOM_CUA_TAB: Record<TabChiTietDuAn, string> = {
  Task: 'Task của Dự án',
  'Người trong dự án': 'Người trong dự án',
  'Thông tin': 'Dấu vết',
  GitHub: 'Repo GitHub',
}

describe('dải tóm tắt của trang chi tiết Dự án', () => {
  it('hiện tên, trạng thái, Tiến độ và số Task Trễ hạn đúng với dữ liệu dựng sẵn', async () => {
    const bc = await dungBoiCanh()
    await dungTaskMau(bc)
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await moDuAn(user, 'Cửa hàng', true)

    expect(daiTomTat().getByRole('heading', { level: 2, name: 'Cửa hàng' })).toBeInTheDocument()
    expect(daiTomTat().getByText('Đang hoạt động')).toBeInTheDocument()
    await choTomTat('40%', '2')
  })

  it('Dự án chưa có Task: Tiến độ "chưa có task" và 0 Task Trễ hạn', async () => {
    const bc = await dungBoiCanh()
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await moDuAn(user, 'Cửa hàng', true)
    await choTomTat('chưa có task', '0')
  })

  it('Task đang tải thì dải nói đang tính; tải lỗi thì nói chưa tính được, thử lại thì hiện số', async () => {
    const goc = taoKhoBoNho({ pmBanDau: PM })
    const bc = await dungBoiCanh(goc)
    await dungTaskMau(bc)
    let choTask: (() => void) | null = null
    let lanGoi = 0
    // Chỉ đếm sau khi Tổng quan (cũng đọc Task) đã tải xong.
    let batDauDem = false
    const kho: KhoDuLieu = {
      ...goc,
      danhSachTask: async (phien, duAnId) => {
        if (!batDauDem) return goc.danhSachTask(phien, duAnId)
        lanGoi += 1
        if (lanGoi === 1) {
          await new Promise<void>((xong) => {
            choTask = xong
          })
          return thatBai('LOI_HE_THONG')
        }
        return goc.danhSachTask(phien, duAnId)
      },
    }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await choTongQuanTaiXong()
    batDauDem = true
    await moDuAn(user, 'Cửa hàng', true)
    await choTomTat('Đang tính…', 'Đang tính…')

    await waitFor(() => expect(choTask).not.toBeNull())
    choTask!()
    await choTomTat('Chưa tính được', 'Chưa tính được')

    await user.click(within(screen.getByRole('group', { name: 'Task của Dự án' })).getByRole('button', { name: 'Thử lại' }))
    await choTomTat('40%', '2')
  })
})

describe('các tab của trang chi tiết Dự án', () => {
  it('có bốn tab Task, Người trong dự án, Thông tin, GitHub; tab Task chọn sẵn và hiện bảng Kanban', async () => {
    const bc = await dungBoiCanh()
    await dungTaskMau(bc)
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await moDuAn(user, 'Cửa hàng', true)

    const dai = screen.getByRole('tablist', { name: 'Các phần của Dự án' })
    const cacTab = within(dai).getAllByRole('tab')
    expect(cacTab).toHaveLength(CAC_TAB.length)
    cacTab.forEach((tab, i) => expect(tab).toHaveAccessibleName(CAC_TAB[i]))
    expect(within(dai).getByRole('tab', { name: 'Task' })).toHaveAttribute('aria-selected', 'true')
    for (const ten of CAC_TAB.slice(1)) {
      expect(within(dai).getByRole('tab', { name: ten })).toHaveAttribute('aria-selected', 'false')
    }
    expect(screen.getByRole('tabpanel', { name: 'Task' })).toBeInTheDocument()
    const bang = within(await screen.findByRole('group', { name: 'Bảng Kanban' }))
    expect(bang.getAllByRole('button', { name: /Đang làm trễ/ }).length).toBeGreaterThan(0)
  })

  it('chọn từng tab hiện đúng nội dung của nó, ẩn nội dung các tab khác; dải tóm tắt vẫn hiện, vẫn cùng Dự án', async () => {
    const bc = await dungBoiCanh()
    await dungTaskMau(bc)
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await moDuAn(user, 'Cửa hàng', true)
    await choTomTat('40%', '2')

    // Đi một vòng qua mọi tab rồi về lại tab Task.
    for (const ten of [...CAC_TAB.slice(1), 'Task' as const]) {
      await moTabDuAn(user, ten)
      const vung = within(screen.getByRole('tabpanel', { name: ten }))
      expect(await vung.findByRole('group', { name: NHOM_CUA_TAB[ten] })).toBeInTheDocument()
      for (const khac of CAC_TAB.filter((t) => t !== ten)) {
        expect(screen.queryByRole('group', { name: NHOM_CUA_TAB[khac] })).not.toBeInTheDocument()
      }
      // Dải tóm tắt giữ nguyên, vẫn là Dự án cũ.
      expect(daiTomTat().getByRole('heading', { level: 2, name: 'Cửa hàng' })).toBeInTheDocument()
      expect(daiTomTat().getByText('Đang hoạt động')).toBeInTheDocument()
      await choTomTat('40%', '2')
    }

    // Nội dung từng tab đúng của Dự án này.
    await moTabDuAn(user, 'Người trong dự án')
    expect(await screen.findByRole('table', { name: 'Danh sách người trong dự án' })).toHaveTextContent('Bình')
    await moTabDuAn(user, 'Thông tin')
    expect(moTaDuAn().getByText('Bán hàng trực tuyến')).toBeInTheDocument()
    await moTabDuAn(user, 'GitHub')
    expect(await screen.findByRole('table', { name: 'Danh sách repo GitHub' })).toHaveTextContent('acme/web')
  })
})

describe('quản lý từ tab tương ứng, đúng quyền như trước', () => {
  it('PM thêm và gỡ người ở tab Người trong dự án, gắn và gỡ repo ở tab GitHub, sửa Dự án ở tab Thông tin', async () => {
    const bc = await dungBoiCanh()
    const chi = await taoNguoi(bc.kho, 'chi@vi-du.vn', 'Chi', 'THANH_VIEN')
    const { user, ungDung } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await moDuAn(user, 'Cửa hàng', true)
    const pm = await phienCua(bc.kho, PM.email)

    await moTabDuAn(user, 'Người trong dự án')
    await user.type(await screen.findByLabelText('Email người cần thêm'), 'chi@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Thêm vào Dự án' }))
    expect(await ungDung.findByText('Đã thêm Chi vào Dự án.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gỡ Bình' }))
    expect(await ungDung.findByText(/^Đã gỡ Bình khỏi Dự án/)).toBeInTheDocument()
    expect(giaTri(await bc.kho.danhSachNguoiTrongDuAn(pm, bc.duAn.id)).map((n) => n.id).sort()).toEqual(
      [bc.an, chi].sort(),
    )

    await moTabDuAn(user, 'GitHub')
    await user.type(await screen.findByLabelText('Repo cần gắn'), 'acme/api')
    await user.click(screen.getByRole('button', { name: 'Gắn repo' }))
    expect(await ungDung.findByText('Đã gắn repo acme/api vào Dự án.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gỡ acme/web' }))
    expect(await ungDung.findByText('Đã gỡ repo acme/web khỏi Dự án.')).toBeInTheDocument()
    expect(giaTri(await bc.kho.danhSachRepoCuaDuAn(pm, bc.duAn.id)).map((r) => r.tenRepo)).toEqual(['acme/api'])

    await moTabDuAn(user, 'Thông tin')
    await user.click(screen.getByRole('button', { name: 'Sửa Dự án' }))
    const ngan = within(await choNganTruot('Sửa Dự án'))
    await user.clear(ngan.getByLabelText('Tên Dự án'))
    await user.paste('Cửa hàng mới')
    await user.clear(ngan.getByLabelText('Mô tả'))
    await user.paste('Bán cả sỉ')
    await user.click(ngan.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await ungDung.findByText('Đã lưu thay đổi.')).toBeInTheDocument()
    // Tên mới hiện ngay ở dải tóm tắt, mô tả mới ở tab Thông tin (vẫn đứng ở tab này).
    expect(daiTomTat().getByRole('heading', { level: 2, name: 'Cửa hàng mới' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')
    expect(moTaDuAn().getByText('Bán cả sỉ')).toBeInTheDocument()
    expect(giaTri(await bc.kho.layDuAn(pm, bc.duAn.id))).toEqual(
      expect.objectContaining({ ten: 'Cửa hàng mới', moTa: 'Bán cả sỉ' }),
    )
  })

  it('Support của Dự án vẫn quản lý được ở cả ba tab như trước', async () => {
    const bc = await dungBoiCanh()
    const pm = await phienCua(bc.kho, PM.email)
    await taoNguoi(bc.kho, 'son@vi-du.vn', 'Sơn', 'SUPPORT')
    giaTri(await bc.kho.themNguoiVaoDuAn(pm, bc.duAn.id, { email: 'son@vi-du.vn' }))
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'son@vi-du.vn')
    await moDuAn(user, 'Cửa hàng', false)

    expect(await screen.findByRole('button', { name: 'Tạo Task' })).toBeInTheDocument()
    await moTabDuAn(user, 'Người trong dự án')
    expect(await screen.findByRole('button', { name: 'Thêm vào Dự án' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Gỡ An' })).toBeInTheDocument()
    await moTabDuAn(user, 'Thông tin')
    expect(screen.getByRole('button', { name: 'Sửa Dự án' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu trữ Dự án' })).toBeInTheDocument()
    await moTabDuAn(user, 'GitHub')
    expect(await screen.findByRole('button', { name: 'Gắn repo' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Gỡ acme/web' })).toBeInTheDocument()
  })

  it('Thành viên xem được mọi tab nhưng không thấy nút quản lý nào', async () => {
    const bc = await dungBoiCanh()
    await dungTaskMau(bc)
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moDuAn(user, 'Cửa hàng', false)

    await screen.findByRole('group', { name: 'Bảng Kanban' })
    expect(screen.queryByRole('button', { name: 'Tạo Task' })).not.toBeInTheDocument()

    await moTabDuAn(user, 'Người trong dự án')
    expect(await screen.findByRole('table', { name: 'Danh sách người trong dự án' })).toHaveTextContent('Bình')
    expect(screen.queryByRole('button', { name: 'Thêm vào Dự án' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Gỡ / })).not.toBeInTheDocument()

    await moTabDuAn(user, 'Thông tin')
    expect(screen.getByRole('group', { name: 'Dấu vết' })).toBeInTheDocument()
    expect(moTaDuAn().getByText('Bán hàng trực tuyến')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    for (const nut of ['Sửa Dự án', 'Lưu trữ Dự án', 'Mở lại Dự án']) {
      expect(screen.queryByRole('button', { name: nut })).not.toBeInTheDocument()
    }

    await moTabDuAn(user, 'GitHub')
    expect(await screen.findByRole('table', { name: 'Danh sách repo GitHub' })).toHaveTextContent('acme/web')
    expect(screen.queryByRole('button', { name: 'Gắn repo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Gỡ / })).not.toBeInTheDocument()
  })
})

describe('Lưu trữ từ tab Thông tin', () => {
  it('Lưu trữ làm dải tóm tắt đổi trạng thái thành Lưu trữ; mở lại thì về Đang hoạt động', async () => {
    const bc = await dungBoiCanh()
    await dungTaskMau(bc)
    const { user, ungDung } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await moDuAn(user, 'Cửa hàng', true)
    expect(daiTomTat().getByText('Đang hoạt động')).toBeInTheDocument()

    await moTabDuAn(user, 'Thông tin')
    await user.click(screen.getByRole('button', { name: 'Lưu trữ Dự án' }))
    expect(await ungDung.findByText('Đã Lưu trữ Dự án. Dự án giờ chỉ xem được.')).toBeInTheDocument()
    expect(daiTomTat().getByText('Lưu trữ')).toBeInTheDocument()
    expect(daiTomTat().queryByText('Đang hoạt động')).not.toBeInTheDocument()
    // Vẫn đứng ở tab Thông tin, Tiến độ và Trễ hạn không đổi.
    expect(screen.getByRole('tab', { name: 'Thông tin' })).toHaveAttribute('aria-selected', 'true')
    await choTomTat('40%', '2')
    expect(giaTri(await bc.kho.layDuAn(await phienCua(bc.kho, PM.email), bc.duAn.id)).trangThai).toBe('LUU_TRU')

    // Sang tab khác dải vẫn báo Lưu trữ.
    await moTabDuAn(user, 'Task')
    expect(daiTomTat().getByText('Lưu trữ')).toBeInTheDocument()

    await moTabDuAn(user, 'Thông tin')
    await user.click(screen.getByRole('button', { name: 'Mở lại Dự án' }))
    expect(await ungDung.findByText('Đã mở lại Dự án. Bạn có thể sửa tiếp.')).toBeInTheDocument()
    expect(daiTomTat().getByText('Đang hoạt động')).toBeInTheDocument()
  })
})
