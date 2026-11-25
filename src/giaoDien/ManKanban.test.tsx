// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { CAC_TRANG_THAI_TASK, TEN_TRANG_THAI_TASK, type TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

function dungApp(goc: KhoBoNho, kho: KhoDuLieu = goc) {
  const user = userEvent.setup()
  const { container } = render(<App kho={kho} moPhong={goc.moPhong} dongHo={() => LUC} />)
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
  chi: string
}

/** Dự án "Cửa hàng" với ba Thành viên trong đó: An, Bình, Chi. */
async function dungBoiCanh(goc: KhoBoNho = taoKhoBoNho({ pmBanDau: PM })): Promise<BoiCanh> {
  const pm = await phienCua(goc, PM.email)
  const duAn = giaTri(await goc.taoDuAn(pm, { ten: 'Cửa hàng' }, LUC))
  const an = await taoNguoi(goc, 'an@vi-du.vn', 'An')
  const binh = await taoNguoi(goc, 'binh@vi-du.vn', 'Bình')
  const chi = await taoNguoi(goc, 'chi@vi-du.vn', 'Chi')
  for (const email of ['an@vi-du.vn', 'binh@vi-du.vn', 'chi@vi-du.vn']) {
    giaTri(await goc.themNguoiVaoDuAn(pm, duAn.id, { email }))
  }
  return { kho: goc, duAn, an, binh, chi }
}

/** PM tạo Task qua Kho rồi đặt thẳng trạng thái. */
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
      LUC,
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

async function moDuAn(user: User, ten: string) {
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
}

async function bang() {
  return within(await screen.findByRole('group', { name: 'Bảng Kanban' }))
}

function cot(b: ReturnType<typeof within>, trangThai: TrangThaiTask) {
  return within(b.getByRole('group', { name: `Cột ${TEN_TRANG_THAI_TASK[trangThai]}` }))
}

/** Tiêu đề các thẻ trong từng cột, theo trạng thái. */
function theTheoCot(b: ReturnType<typeof within>): Record<string, string[]> {
  return Object.fromEntries(
    CAC_TRANG_THAI_TASK.map((trangThai) => [
      trangThai,
      cot(b, trangThai)
        .queryAllByRole('button')
        // Bỏ menu "Chuyển Task … sang cột khác" của thẻ (đường đổi cột bằng bàn phím, ticket 12).
        .filter((nut) => !(nut.getAttribute('aria-label') ?? '').startsWith('Chuyển Task'))
        .map((nut) => nut.textContent ?? '')
        .sort(),
    ]),
  )
}

async function chonLoc(user: User, nhan: string, lua: string) {
  await user.click(screen.getByRole('combobox', { name: new RegExp(`^${nhan}`) }))
  await user.click(await screen.findByRole('option', { name: lua }))
}

describe('Bảng Kanban của Dự án', () => {
  it('hiện đủ bảy cột; mỗi Task nằm đúng một cột và thẻ hiện tiêu đề, Người thực hiện, Người kiểm tra, hạn', async () => {
    const bc = await dungBoiCanh()
    for (const trangThai of CAC_TRANG_THAI_TASK) {
      await taoTask(bc.kho, bc.duAn.id, `Việc ${TEN_TRANG_THAI_TASK[trangThai]}`, bc.an, bc.binh, trangThai)
    }
    await taoTask(bc.kho, bc.duAn.id, 'Việc có hạn', bc.binh, bc.chi, 'DANG_LAM', '2026-12-31')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'chi@vi-du.vn')
    await moDuAn(user, 'Cửa hàng')

    const b = await bang()
    for (const trangThai of CAC_TRANG_THAI_TASK) {
      expect(b.getByRole('group', { name: `Cột ${TEN_TRANG_THAI_TASK[trangThai]}` })).toBeInTheDocument()
    }
    expect(b.getAllByRole('group', { name: /^Cột / })).toHaveLength(7)
    expect(theTheoCot(b)).toEqual({
      MOI: ['Việc Mới'],
      DANG_LAM: ['Việc Đang làm', 'Việc có hạn'].sort(),
      CHO_DUYET: ['Việc Chờ duyệt'],
      TRA_LAI: ['Việc Trả lại'],
      BI_LOI: ['Việc Bị lỗi'],
      HOAN_THANH: ['Việc Hoàn thành'],
      HUY: ['Việc Huỷ'],
    })

    // Thẻ có hạn: tiêu đề, hai người, hạn.
    const the = within(cot(b, 'DANG_LAM').getByRole('button', { name: 'Việc có hạn' }).closest('[role="listitem"]') as HTMLElement)
    expect(the.getByText('Người thực hiện: Bình')).toBeInTheDocument()
    expect(the.getByText('Người kiểm tra: Chi')).toBeInTheDocument()
    expect(the.getByText('Hạn: 31/12/2026')).toBeInTheDocument()
    // Thẻ không hạn nói rõ.
    const theKhongHan = within(
      cot(b, 'MOI').getByRole('button', { name: 'Việc Mới' }).closest('[role="listitem"]') as HTMLElement,
    )
    expect(theKhongHan.getByText('Hạn: Không có hạn')).toBeInTheDocument()
    expect(theKhongHan.getByText('Người thực hiện: An')).toBeInTheDocument()
  })

  it('cột trống hiện trạng thái trống rõ ràng; số Task của mỗi cột hiện cạnh tên cột', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc.kho, bc.duAn.id, 'Một việc', bc.an, bc.binh, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moDuAn(user, 'Cửa hàng')

    const b = await bang()
    expect(cot(b, 'MOI').getByText('Chưa có Task nào.')).toBeInTheDocument()
    expect(cot(b, 'HUY').getByText('Chưa có Task nào.')).toBeInTheDocument()
    expect(cot(b, 'DANG_LAM').queryByText('Chưa có Task nào.')).not.toBeInTheDocument()
    expect(cot(b, 'DANG_LAM').getByText('1')).toBeInTheDocument()
    expect(cot(b, 'MOI').getByText('0')).toBeInTheDocument()
  })

  it('Dự án chưa có Task nào: hiện trạng thái trống chung thay vì bảy cột trống', async () => {
    const bc = await dungBoiCanh()
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moDuAn(user, 'Cửa hàng')
    expect(await screen.findByRole('heading', { name: 'Dự án chưa có Task nào.' })).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Bảng Kanban' })).not.toBeInTheDocument()
  })

  it('bấm tiêu đề thẻ mở chi tiết Task, quay lại thì về bảng', async () => {
    const bc = await dungBoiCanh()
    await taoTask(bc.kho, bc.duAn.id, 'Viết tài liệu', bc.an, bc.binh, 'CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await moDuAn(user, 'Cửa hàng')
    await user.click(cot(await bang(), 'CHO_DUYET').getByRole('button', { name: 'Viết tài liệu' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Viết tài liệu' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Về Dự án Cửa hàng' }))
    expect(cot(await bang(), 'CHO_DUYET').getByRole('button', { name: 'Viết tài liệu' })).toBeInTheDocument()
  })

  describe('bộ lọc', () => {
    async function dungBoLoc() {
      const bc = await dungBoiCanh()
      await taoTask(bc.kho, bc.duAn.id, 'A: An làm, Bình duyệt, mới', bc.an, bc.binh, 'MOI')
      await taoTask(bc.kho, bc.duAn.id, 'B: An làm, Chi duyệt, đang làm', bc.an, bc.chi, 'DANG_LAM')
      await taoTask(bc.kho, bc.duAn.id, 'C: Bình làm, An duyệt, đang làm', bc.binh, bc.an, 'DANG_LAM')
      await taoTask(bc.kho, bc.duAn.id, 'D: Chi làm, Bình duyệt, xong', bc.chi, bc.binh, 'HOAN_THANH')
      const { user } = dungApp(bc.kho)
      await dangNhap(user, 'chi@vi-du.vn')
      await moDuAn(user, 'Cửa hàng')
      await bang()
      return { user }
    }

    const tatCaTieuDe = async () => Object.values(theTheoCot(await bang())).flat().sort()

    it('lọc theo Người thực hiện, theo Người kiểm tra và theo trạng thái cho đúng tập Task', async () => {
      const { user } = await dungBoLoc()
      expect(await tatCaTieuDe()).toHaveLength(4)

      await chonLoc(user, 'Người thực hiện', 'An')
      expect((await tatCaTieuDe()).map((t) => t[0])).toEqual(['A', 'B'])
      expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Đang lọc: 2 trên 4 Task.')

      await user.click(screen.getByRole('button', { name: 'Bỏ lọc' }))
      await chonLoc(user, 'Người kiểm tra', 'Bình')
      expect((await tatCaTieuDe()).map((t) => t[0])).toEqual(['A', 'D'])

      await user.click(screen.getByRole('button', { name: 'Bỏ lọc' }))
      await chonLoc(user, 'Trạng thái', 'Đang làm')
      expect((await tatCaTieuDe()).map((t) => t[0])).toEqual(['B', 'C'])
      // Cột khác vẫn còn, trống và nói là không khớp bộ lọc.
      expect(cot(await bang(), 'MOI').getByText('Không có Task nào khớp bộ lọc.')).toBeInTheDocument()
    })

    it('kết hợp nhiều bộ lọc cùng lúc; bỏ lọc thì trả lại đầy đủ', async () => {
      const { user } = await dungBoLoc()
      await chonLoc(user, 'Người thực hiện', 'An')
      await chonLoc(user, 'Trạng thái', 'Đang làm')
      expect((await tatCaTieuDe()).map((t) => t[0])).toEqual(['B'])
      await chonLoc(user, 'Người kiểm tra', 'Chi')
      expect((await tatCaTieuDe()).map((t) => t[0])).toEqual(['B'])
      await chonLoc(user, 'Người kiểm tra', 'Bình')
      expect(await tatCaTieuDe()).toEqual([])
      expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Đang lọc: 0 trên 4 Task.')

      await user.click(screen.getByRole('button', { name: 'Bỏ lọc' }))
      expect(await tatCaTieuDe()).toHaveLength(4)
      expect(screen.queryByRole('button', { name: 'Bỏ lọc' })).not.toBeInTheDocument()
      expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('4 Task.')
    })

    it('chọn lại "Tất cả" ở một ô cũng bỏ lọc ô đó', async () => {
      const { user } = await dungBoLoc()
      await chonLoc(user, 'Trạng thái', 'Hoàn thành')
      expect(await tatCaTieuDe()).toHaveLength(1)
      await chonLoc(user, 'Trạng thái', 'Tất cả trạng thái')
      expect(await tatCaTieuDe()).toHaveLength(4)
    })
  })

  describe('dùng được bằng bàn phím', () => {
    it('Tab đi qua các ô lọc rồi tới từng thẻ theo thứ tự cột; Enter trên thẻ mở chi tiết Task', async () => {
      const bc = await dungBoiCanh()
      await taoTask(bc.kho, bc.duAn.id, 'Việc một', bc.an, bc.binh, 'MOI')
      await taoTask(bc.kho, bc.duAn.id, 'Việc hai', bc.an, bc.binh, 'CHO_DUYET')
      const { user } = dungApp(bc.kho)
      await dangNhap(user, 'an@vi-du.vn')
      await moDuAn(user, 'Cửa hàng')
      await bang()

      // Đặt tiêu điểm ở ô lọc đầu tiên rồi Tab.
      screen.getByRole('combobox', { name: /^Người thực hiện/ }).focus()
      const gap: string[] = []
      for (let i = 0; i < 12 && !gap.includes('Việc hai'); i++) {
        await user.tab()
        const dangFocus = document.activeElement
        gap.push((dangFocus?.getAttribute('aria-label') ?? dangFocus?.textContent ?? '').trim())
      }
      // Thứ tự: Người kiểm tra, Trạng thái, thẻ ở cột Mới, thẻ ở cột Chờ duyệt.
      const viTri = (nhan: string | RegExp) =>
        gap.findIndex((chuoi) => (typeof nhan === 'string' ? chuoi === nhan : nhan.test(chuoi)))
      expect(viTri('Việc một')).toBeGreaterThan(-1)
      expect(viTri('Việc hai')).toBeGreaterThan(viTri('Việc một'))
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Việc hai' }))

      await user.keyboard('{Enter}')
      expect(await screen.findByRole('heading', { level: 2, name: 'Việc hai' })).toBeInTheDocument()
    })

    it('lọc được bằng bàn phím: mở ô chọn bằng Enter, chọn bằng mũi tên và Enter', async () => {
      const bc = await dungBoiCanh()
      await taoTask(bc.kho, bc.duAn.id, 'Của An', bc.an, bc.binh, 'DANG_LAM')
      await taoTask(bc.kho, bc.duAn.id, 'Của Bình', bc.binh, bc.an, 'DANG_LAM')
      const { user } = dungApp(bc.kho)
      await dangNhap(user, 'chi@vi-du.vn')
      await moDuAn(user, 'Cửa hàng')
      await bang()

      screen.getByRole('combobox', { name: /^Người thực hiện/ }).focus()
      await user.keyboard('{Enter}')
      const lua = await screen.findByRole('option', { name: 'Bình' })
      expect(lua).toBeInTheDocument()
      // Mũi tên xuống tới "Bình" (Tất cả, An, Bình) rồi Enter.
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')
      await waitFor(() => expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Đang lọc: 1 trên 2 Task.'))
      expect(cot(await bang(), 'DANG_LAM').queryByRole('button', { name: 'Của An' })).not.toBeInTheDocument()
      expect(cot(await bang(), 'DANG_LAM').getByRole('button', { name: 'Của Bình' })).toBeInTheDocument()
    })
  })

  describe('Dự án đã Lưu trữ và người ngoài Dự án', () => {
    it('Dự án đã Lưu trữ vẫn hiện bảng, chỉ xem: không có điều khiển ghi nào ngoài mở Task', async () => {
      const bc = await dungBoiCanh()
      await taoTask(bc.kho, bc.duAn.id, 'Việc cũ', bc.an, bc.binh, 'DANG_LAM')
      await taoTask(bc.kho, bc.duAn.id, 'Việc xong', bc.an, bc.binh, 'HOAN_THANH')
      giaTri(await bc.kho.luuTruDuAn(await phienCua(bc.kho, PM.email), bc.duAn.id, LUC))
      const { user } = dungApp(bc.kho)
      await dangNhap(user, 'an@vi-du.vn')
      await moDuAn(user, 'Cửa hàng')
      const b = await bang()
      expect(cot(b, 'DANG_LAM').getByRole('button', { name: 'Việc cũ' })).toBeInTheDocument()
      expect(cot(b, 'HOAN_THANH').getByRole('button', { name: 'Việc xong' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Tạo Task' })).not.toBeInTheDocument()
      // Chỉ có các nút mở Task trong bảng, không kéo thả, không nút đổi trạng thái.
      expect(b.getAllByRole('button').map((nut) => nut.textContent).sort()).toEqual(['Việc cũ', 'Việc xong'])
    })

    it('Kho trả không tìm thấy (người ngoài Dự án): hiện lỗi, không hiện bảng', async () => {
      const goc = taoKhoBoNho({ pmBanDau: PM })
      const bc = await dungBoiCanh(goc)
      const kho: KhoDuLieu = { ...goc, danhSachTask: async () => thatBai('KHONG_TIM_THAY') }
      const { user, ungDung } = dungApp(goc, kho)
      await dangNhap(user, 'an@vi-du.vn')
      await moDuAn(user, bc.duAn.ten)
      expect(await ungDung.findByText('Không tải được Task của Dự án.')).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Bảng Kanban' })).not.toBeInTheDocument()
    })
  })

  describe('đang tải và lỗi', () => {
    it('đang tải hiện chỉ báo; lỗi hiện thông báo kèm nút Thử lại, thử lại được thì hiện bảng', async () => {
      const goc = taoKhoBoNho({ pmBanDau: PM })
      const bc = await dungBoiCanh(goc)
      await taoTask(goc, bc.duAn.id, 'Việc', bc.an, bc.binh, 'MOI')
      let lanGoi = 0
      let tiepTuc: (() => void) | null = null
      const kho: KhoDuLieu = {
        ...goc,
        danhSachTask: async (phien, id) => {
          lanGoi += 1
          if (lanGoi === 1) await new Promise<void>((xong) => (tiepTuc = xong))
          return lanGoi === 1 ? thatBai('LOI_HE_THONG') : goc.danhSachTask(phien, id)
        },
      }
      const { user, ungDung } = dungApp(goc, kho)
      await dangNhap(user, 'an@vi-du.vn')
      await moDuAn(user, 'Cửa hàng')
      expect(await ungDung.findByText('Đang tải Task…')).toBeInTheDocument()
      ;(tiepTuc as (() => void) | null)?.()
      expect(await ungDung.findByText('Không tải được Task của Dự án.')).toBeInTheDocument()
      await user.click(ungDung.getByRole('button', { name: 'Thử lại' }))
      expect(cot(await bang(), 'MOI').getByRole('button', { name: 'Việc' })).toBeInTheDocument()
    })
  })
})

describe('"Việc của tôi" và "Chờ tôi duyệt"', () => {
  async function moMuc(user: User, ten: string) {
    await user.click(screen.getByRole('button', { name: ten }))
    await screen.findByRole('heading', { level: 2, name: ten })
  }

  async function dungHaiDuAn() {
    const bc = await dungBoiCanh()
    const pm = await phienCua(bc.kho, PM.email)
    const khoHang = giaTri(await bc.kho.taoDuAn(pm, { ten: 'Kho hàng' }, LUC))
    for (const email of ['an@vi-du.vn', 'binh@vi-du.vn']) {
      giaTri(await bc.kho.themNguoiVaoDuAn(pm, khoHang.id, { email }))
    }
    return { bc, khoHang }
  }

  it('"Việc của tôi" liệt kê Task chưa chốt mà tôi là Người thực hiện, qua mọi Dự án, kèm tên Dự án; không có Task của người khác', async () => {
    const { bc, khoHang } = await dungHaiDuAn()
    await taoTask(bc.kho, bc.duAn.id, 'An làm mới', bc.an, bc.binh, 'MOI')
    await taoTask(bc.kho, khoHang.id, 'An làm ở kho', bc.an, bc.binh, 'TRA_LAI', '2026-06-30')
    await taoTask(bc.kho, bc.duAn.id, 'An đã xong', bc.an, bc.binh, 'HOAN_THANH')
    await taoTask(bc.kho, bc.duAn.id, 'An đã huỷ', bc.an, bc.binh, 'HUY')
    await taoTask(bc.kho, bc.duAn.id, 'Của Bình', bc.binh, bc.an, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moMuc(user, 'Việc của tôi')

    const bangViec = within(await screen.findByRole('table', { name: 'Việc của tôi' }))
    expect(bangViec.getByRole('button', { name: 'An làm mới' })).toBeInTheDocument()
    expect(bangViec.getByRole('button', { name: 'An làm ở kho' })).toBeInTheDocument()
    expect(bangViec.queryByRole('button', { name: 'An đã xong' })).not.toBeInTheDocument()
    expect(bangViec.queryByRole('button', { name: 'An đã huỷ' })).not.toBeInTheDocument()
    expect(bangViec.queryByRole('button', { name: 'Của Bình' })).not.toBeInTheDocument()
    // Mỗi dòng kèm tên Dự án và hạn.
    const dongKho = within(bangViec.getByRole('button', { name: 'An làm ở kho' }).closest('tr') as HTMLElement)
    expect(dongKho.getByText('Kho hàng')).toBeInTheDocument()
    expect(dongKho.getByText('30/06/2026')).toBeInTheDocument()
    expect(dongKho.getByText('Trả lại')).toBeInTheDocument()
    const dongCuaHang = within(bangViec.getByRole('button', { name: 'An làm mới' }).closest('tr') as HTMLElement)
    expect(dongCuaHang.getByText('Cửa hàng')).toBeInTheDocument()
  })

  it('"Việc của tôi" của Bình không có Task của An; người chưa có việc thấy trạng thái trống', async () => {
    const { bc } = await dungHaiDuAn()
    await taoTask(bc.kho, bc.duAn.id, 'Việc của An', bc.an, bc.binh, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'chi@vi-du.vn')
    await moMuc(user, 'Việc của tôi')
    expect(await screen.findByRole('heading', { name: 'Bạn không có việc nào đang làm.' })).toBeInTheDocument()
    expect(screen.queryByText('Việc của An')).not.toBeInTheDocument()
  })

  it('"Chờ tôi duyệt" liệt kê Task đang Chờ duyệt mà tôi là Người kiểm tra, kèm tên Dự án', async () => {
    const { bc, khoHang } = await dungHaiDuAn()
    await taoTask(bc.kho, bc.duAn.id, 'Cần Bình duyệt', bc.an, bc.binh, 'CHO_DUYET')
    await taoTask(bc.kho, khoHang.id, 'Cần Bình duyệt ở kho', bc.an, bc.binh, 'CHO_DUYET')
    await taoTask(bc.kho, bc.duAn.id, 'Bình duyệt nhưng đang làm', bc.an, bc.binh, 'DANG_LAM')
    await taoTask(bc.kho, bc.duAn.id, 'Cần An duyệt', bc.binh, bc.an, 'CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await moMuc(user, 'Chờ tôi duyệt')

    const bangCho = within(await screen.findByRole('table', { name: 'Chờ tôi duyệt' }))
    expect(bangCho.getByRole('button', { name: 'Cần Bình duyệt' })).toBeInTheDocument()
    expect(bangCho.getByRole('button', { name: 'Cần Bình duyệt ở kho' })).toBeInTheDocument()
    expect(bangCho.queryByRole('button', { name: 'Bình duyệt nhưng đang làm' })).not.toBeInTheDocument()
    expect(bangCho.queryByRole('button', { name: 'Cần An duyệt' })).not.toBeInTheDocument()
    const dongKho = within(bangCho.getByRole('button', { name: 'Cần Bình duyệt ở kho' }).closest('tr') as HTMLElement)
    expect(dongKho.getByText('Kho hàng')).toBeInTheDocument()
    expect(dongKho.getByText('An')).toBeInTheDocument()
  })

  it('"Chờ tôi duyệt" trống: hiện trạng thái trống', async () => {
    const { bc } = await dungHaiDuAn()
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await moMuc(user, 'Chờ tôi duyệt')
    expect(await screen.findByRole('heading', { name: 'Không có Task nào đang chờ bạn duyệt.' })).toBeInTheDocument()
  })

  it('bị gỡ khỏi Dự án thì Task của Dự án đó không còn trong danh sách', async () => {
    const { bc } = await dungHaiDuAn()
    await taoTask(bc.kho, bc.duAn.id, 'Việc ở cửa hàng', bc.an, bc.binh, 'DANG_LAM')
    giaTri(await bc.kho.goNguoiKhoiDuAn(await phienCua(bc.kho, PM.email), bc.duAn.id, bc.an))
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moMuc(user, 'Việc của tôi')
    expect(await screen.findByRole('heading', { name: 'Bạn không có việc nào đang làm.' })).toBeInTheDocument()
  })

  it('mở Task từ danh sách rồi quay lại danh sách', async () => {
    const { bc } = await dungHaiDuAn()
    await taoTask(bc.kho, bc.duAn.id, 'Việc để mở', bc.an, bc.binh, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moMuc(user, 'Việc của tôi')
    await user.click(await screen.findByRole('button', { name: 'Việc để mở' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Việc để mở' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Về Việc của tôi' }))
    expect(await screen.findByRole('button', { name: 'Việc để mở' })).toBeInTheDocument()
  })

  it('đang tải và lỗi: có chỉ báo và nút Thử lại; thử lại được thì hiện danh sách', async () => {
    const goc = taoKhoBoNho({ pmBanDau: PM })
    const bc = await dungBoiCanh(goc)
    await taoTask(goc, bc.duAn.id, 'Việc', bc.an, bc.binh, 'DANG_LAM')
    let lanGoi = 0
    let tiepTuc: (() => void) | null = null
    const kho: KhoDuLieu = {
      ...goc,
      viecCuaToi: async (phien) => {
        lanGoi += 1
        if (lanGoi === 1) await new Promise<void>((xong) => (tiepTuc = xong))
        return lanGoi === 1 ? thatBai('LOI_HE_THONG') : goc.viecCuaToi(phien)
      },
    }
    const { user, ungDung } = dungApp(goc, kho)
    await dangNhap(user, 'an@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Việc của tôi' }))
    expect(await ungDung.findByText('Đang tải Task…')).toBeInTheDocument()
    ;(tiepTuc as (() => void) | null)?.()
    expect(await ungDung.findByText('Không tải được danh sách Việc của tôi.')).toBeInTheDocument()
    await user.click(ungDung.getByRole('button', { name: 'Thử lại' }))
    expect(await ungDung.findByRole('button', { name: 'Việc' })).toBeInTheDocument()
  })

  it('"Chờ tôi duyệt": lỗi hiện thông báo riêng', async () => {
    const goc = taoKhoBoNho({ pmBanDau: PM })
    const bc = await dungBoiCanh(goc)
    const kho: KhoDuLieu = { ...goc, choToiDuyet: async () => thatBai('LOI_HE_THONG') }
    const { user, ungDung } = dungApp(bc.kho, kho)
    await dangNhap(user, 'an@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Chờ tôi duyệt' }))
    expect(await ungDung.findByText('Không tải được danh sách Chờ tôi duyệt.')).toBeInTheDocument()
  })

  it('bàn phím: Tab tới nút Task trong danh sách và Enter mở chi tiết', async () => {
    const { bc } = await dungHaiDuAn()
    await taoTask(bc.kho, bc.duAn.id, 'Việc bàn phím', bc.an, bc.binh, 'DANG_LAM')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moMuc(user, 'Việc của tôi')
    const nut = await screen.findByRole('button', { name: 'Việc bàn phím' })
    for (let i = 0; i < 10 && document.activeElement !== nut; i++) await user.tab()
    expect(document.activeElement).toBe(nut)
    await user.keyboard('{Enter}')
    expect(await screen.findByRole('heading', { level: 2, name: 'Việc bàn phím' })).toBeInTheDocument()
  })
})
