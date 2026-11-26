// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { THONG_BAO_MAC_DINH, thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { THONG_BAO_TASK } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { choNganTruot, choTongQuanTaiXong, dongNganTruot } from '../test/khungUngDung'
import { maDuAnMoi } from '../test/maDuAn'

const MAT_KHAU = 'matkhau-123'
/** Đồng hồ ứng dụng dùng khi bấm tạo Task. */
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
}

/** Một Dự án "Cửa hàng" với hai Thành viên trong đó: An và Bình. */
async function dungBoiCanh(goc: KhoBoNho = taoKho()): Promise<BoiCanh> {
  const duAn = giaTri(await goc.taoDuAn(await phienCua(goc, PM.email), { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC))
  const anId = await taoNguoi(goc, 'an@vi-du.vn', 'An', 'THANH_VIEN')
  const binhId = await taoNguoi(goc, 'binh@vi-du.vn', 'Bình', 'THANH_VIEN')
  await themVao(goc, duAn, 'an@vi-du.vn')
  await themVao(goc, duAn, 'binh@vi-du.vn')
  return { kho: goc, duAn, anId, binhId }
}

/** PM tạo sẵn một Task qua Kho (An làm, Bình duyệt). */
async function taoTaskSan(bc: BoiCanh, tieuDe: string, han: string | null = null): Promise<Task> {
  return giaTri(
    await bc.kho.taoTask(
      await phienCua(bc.kho, PM.email),
      bc.duAn.id,
      { tieuDe, han, nguoiThucHienId: bc.anId, nguoiKiemTraId: bc.binhId },
      LUC,
    ),
  )
}

async function cacTask(bc: BoiCanh): Promise<Task[]> {
  return giaTri(await bc.kho.danhSachTask(await phienCua(bc.kho, PM.email), bc.duAn.id))
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

/** PM mở chi tiết Dự án `ten` từ mục Tất cả Dự án. */
async function pmMoDuAn(user: User, ten: string) {
  await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
}

/** Mở chi tiết Dự án `ten` từ mục Dự án của tôi (mục mặc định sau đăng nhập). */
async function moDuAnCuaToi(user: User, ten: string) {
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
}

function vungTask() {
  return within(screen.getByRole('group', { name: 'Task của Dự án' }))
}

/** Ngăn trượt "Tạo Task" đang mở. */
function nganTao() {
  return within(screen.getByRole('dialog', { name: 'Tạo Task' }))
}

/** Chọn một người trong ô chọn (trong ngăn tạo Task) có nhãn bắt đầu bằng `nhan`. */
async function chon(user: User, nhan: string, tenHienThi: string) {
  await user.click(nganTao().getByRole('combobox', { name: new RegExp(`^${nhan}`) }))
  await user.click(await screen.findByRole('option', { name: new RegExp(`^${tenHienThi} \\(`) }))
}

/** Bấm "Tạo Task" ở tab Task: biểu mẫu mở trong Ngăn trượt, trang Dự án vẫn ở phía sau. */
async function moFormTao(user: User) {
  await user.click(await vungTask().findByRole('button', { name: 'Tạo Task' }))
  const ngan = within(await choNganTruot('Tạo Task'))
  expect(ngan.getByRole('heading', { level: 2, name: 'Tạo Task' })).toBeInTheDocument()
  await ngan.findByLabelText('Tiêu đề')
}

/** Dán `noiDung` vào ô `nhan` của ngăn tạo Task (nhanh hơn gõ từng ký tự). */
async function dan(user: User, nhan: string, noiDung: string) {
  await user.click(nganTao().getByLabelText(nhan))
  await user.paste(noiDung)
}

/** Bấm nút "Tạo Task" ở chân ngăn. */
async function bamTao(user: User) {
  await user.click(nganTao().getByRole('button', { name: 'Tạo Task' }))
}

async function choNganDong() {
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
}

/** Thông báo lỗi Astryx đặt cạnh ô (mô tả truy cập được của ô). */
function loiCanhO(o: HTMLElement, thongBao: string) {
  expect(o).toHaveAccessibleDescription(expect.stringContaining(thongBao))
}

describe('Task trong trang Dự án: tạo và xem', () => {
  it('PM tạo Task trong Ngăn trượt: ngăn đóng, Task mới ở cột Mới (Mới, 0 lần Trả lại, hai người, dấu vết); không cảnh báo focus', async () => {
    const canhBao = vi.spyOn(console, 'warn')
    try {
      const bc = await dungBoiCanh()
      const { user, ungDung } = dungApp(bc.kho)
      await dangNhap(user, PM.email)
      await pmMoDuAn(user, 'Cửa hàng')

      expect(await vungTask().findByRole('heading', { name: 'Dự án chưa có Task nào.' })).toBeInTheDocument()
      await moFormTao(user)
      // Trang Dự án ở nguyên phía sau ngăn.
      expect(ungDung.getByRole('heading', { level: 2, name: 'Cửa hàng' })).toBeInTheDocument()

      await dan(user, 'Tiêu đề', '  Làm trang chủ  ')
      await dan(user, 'Mô tả', 'Theo bản thiết kế')
      await chon(user, 'Người thực hiện', 'An')
      await chon(user, 'Người kiểm tra', 'Bình')
      await bamTao(user)

      await choNganDong()
      expect(await ungDung.findByText('Đã tạo Task Làm trang chủ.')).toBeInTheDocument()
      const bang = within(await vungTask().findByRole('group', { name: 'Bảng Kanban' }))
      expect(
        await within(bang.getByRole('group', { name: 'Cột Mới' })).findByRole('button', { name: 'Làm trang chủ' }),
      ).toBeInTheDocument()

      expect(await cacTask(bc)).toEqual([
        expect.objectContaining({
          tieuDe: 'Làm trang chủ',
          moTa: 'Theo bản thiết kế',
          trangThai: 'MOI',
          soLanTraLai: 0,
          nguoiThucHien: { id: bc.anId, tenHienThi: 'An' },
          nguoiKiemTra: { id: bc.binhId, tenHienThi: 'Bình' },
        }),
      ])

      // Mở Task vừa tạo: đúng trạng thái, người, hạn và dấu vết.
      await user.click(bang.getByRole('button', { name: 'Làm trang chủ' }))
      const ngan = within(await choNganTruot('Làm trang chủ'))
      const thongTin = within(await ngan.findByRole('group', { name: 'Thông tin Task' }))
      expect(thongTin.getByText('Trạng thái: Mới')).toBeInTheDocument()
      expect(thongTin.getByText('Người thực hiện: An')).toBeInTheDocument()
      expect(thongTin.getByText('Người kiểm tra: Bình')).toBeInTheDocument()
      expect(thongTin.getByText('Hạn: Không có hạn')).toBeInTheDocument()
      expect(thongTin.getByText('Số lần bị Trả lại: 0')).toBeInTheDocument()
      const dauVet = within(screen.getByRole('group', { name: 'Dấu vết' }))
      expect(dauVet.getByText('Người tạo: An PM')).toBeInTheDocument()
      expect(dauVet.getByText('Ngày tạo: 01/03/2026 08:00')).toBeInTheDocument()
      await dongNganTruot(user)

      // Đóng ngăn tạo Task trả focus về nút đã bấm, không có cảnh báo "không có chỗ trả focus".
      const veFocus = canhBao.mock.calls.filter((loi) => String(loi[0]).includes('focus'))
      expect(veFocus).toEqual([])
    } finally {
      canhBao.mockRestore()
    }
  })

  it('tạo thiếu tiêu đề và thiếu người: lỗi tiếng Việt cạnh đúng ô, ngăn vẫn mở, không tạo gì', async () => {
    const bc = await dungBoiCanh()
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await moFormTao(user)

    await bamTao(user)
    expect(await nganTao().findByText('Chưa tạo được Task.')).toBeInTheDocument()
    loiCanhO(nganTao().getByLabelText('Tiêu đề'), THONG_BAO_TASK.tieuDeTrong)

    await dan(user, 'Tiêu đề', 'Làm trang chủ')
    await bamTao(user)
    expect((await nganTao().findAllByText(THONG_BAO_MAC_DINH.THIEU_NGUOI)).length).toBeGreaterThan(0)
    loiCanhO(nganTao().getByRole('combobox', { name: /^Người thực hiện/ }), THONG_BAO_TASK.thieuNguoiThucHien)
    loiCanhO(nganTao().getByRole('combobox', { name: /^Người kiểm tra/ }), THONG_BAO_TASK.thieuNguoiKiemTra)

    expect(screen.getByRole('dialog', { name: 'Tạo Task' })).toBeInTheDocument()
    expect(await cacTask(bc)).toEqual([])
  })

  it('chọn cùng một người ở cả hai vai: lỗi TRUNG_NGUOI cạnh ô Người kiểm tra, ngăn vẫn mở, không tạo gì', async () => {
    const bc = await dungBoiCanh()
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await moFormTao(user)

    await dan(user, 'Tiêu đề', 'Tự duyệt')
    await chon(user, 'Người thực hiện', 'An')
    await chon(user, 'Người kiểm tra', 'An')
    await bamTao(user)

    expect((await nganTao().findAllByText(THONG_BAO_MAC_DINH.TRUNG_NGUOI)).length).toBeGreaterThan(0)
    loiCanhO(nganTao().getByRole('combobox', { name: /^Người kiểm tra/ }), THONG_BAO_TASK.trungNguoi)
    expect(screen.getByRole('dialog', { name: 'Tạo Task' })).toBeInTheDocument()
    expect(await cacTask(bc)).toEqual([])
  })

  it('Kho từ chối vì người được chọn đã rời Dự án: hiện lý do NGUOI_NGOAI_DU_AN trong ngăn', async () => {
    const goc = taoKho()
    const kho: KhoDuLieu = { ...goc, taoTask: async () => thatBai('NGUOI_NGOAI_DU_AN') }
    const bc = await dungBoiCanh(goc)
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await moFormTao(user)
    await dan(user, 'Tiêu đề', 'Việc')
    await bamTao(user)
    // Astryx còn một vùng thông báo (aria-live) cũng mang role alert; lấy đúng banner có lý do.
    const canhBao = (await nganTao().findByText('Chưa tạo được Task.')).closest('[role="alert"]')
    expect(canhBao).not.toBeNull()
    expect(canhBao).toHaveTextContent('Chưa tạo được Task.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.NGUOI_NGOAI_DU_AN)
    expect(screen.getByRole('dialog', { name: 'Tạo Task' })).toBeInTheDocument()
    expect(await cacTask(bc)).toEqual([])
  })

  it.each(['Huỷ', 'Esc'] as const)('đóng ngăn tạo Task bằng %s: không tạo gì, mở lại là biểu mẫu trống', async (cach) => {
    const bc = await dungBoiCanh()
    const { user, ungDung } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await moFormTao(user)
    await dan(user, 'Tiêu đề', 'Bỏ dở')
    await chon(user, 'Người thực hiện', 'An')
    await chon(user, 'Người kiểm tra', 'Bình')

    if (cach === 'Huỷ') await user.click(nganTao().getByRole('button', { name: 'Huỷ' }))
    else {
      await user.click(nganTao().getByLabelText('Tiêu đề'))
      await user.keyboard('{Escape}')
    }
    await choNganDong()
    expect(ungDung.queryByText(/^Đã tạo Task/)).not.toBeInTheDocument()
    expect(await cacTask(bc)).toEqual([])
    expect(await vungTask().findByRole('heading', { name: 'Dự án chưa có Task nào.' })).toBeInTheDocument()

    await moFormTao(user)
    expect(nganTao().getByLabelText('Tiêu đề')).toHaveValue('')
  })

  it('Support của Dự án tạo được Task trong Ngăn trượt; Task mới hiện ở cột Mới', async () => {
    const bc = await dungBoiCanh()
    await taoNguoi(bc.kho, 'son@vi-du.vn', 'Sơn', 'SUPPORT')
    await themVao(bc.kho, bc.duAn, 'son@vi-du.vn')
    const { user, ungDung } = dungApp(bc.kho)
    await dangNhap(user, 'son@vi-du.vn')
    await moDuAnCuaToi(user, 'Cửa hàng')
    expect(ungDung.queryByText(THONG_BAO_TASK.khongQuanLy)).not.toBeInTheDocument()

    await moFormTao(user)
    await dan(user, 'Tiêu đề', 'Việc của Sơn')
    await chon(user, 'Người thực hiện', 'An')
    await chon(user, 'Người kiểm tra', 'Bình')
    await bamTao(user)
    await choNganDong()
    const bang = within(await vungTask().findByRole('group', { name: 'Bảng Kanban' }))
    expect(
      await within(bang.getByRole('group', { name: 'Cột Mới' })).findByRole('button', { name: 'Việc của Sơn' }),
    ).toBeInTheDocument()
    expect((await cacTask(bc)).map((task) => task.tieuDe)).toEqual(['Việc của Sơn'])
  })

  it('Thành viên trong Dự án xem được bảng và chi tiết Task kèm dấu vết, nhưng không thấy nút tạo, kèm lý do', async () => {
    const bc = await dungBoiCanh()
    await taoTaskSan(bc, 'Viết tài liệu', '2026-12-31')
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'binh@vi-du.vn')
    await moDuAnCuaToi(user, 'Cửa hàng')

    const bang = within(await vungTask().findByRole('group', { name: 'Bảng Kanban' }))
    expect(bang.getByText('Người thực hiện: An')).toBeInTheDocument()
    expect(bang.getByText('Người kiểm tra: Bình')).toBeInTheDocument()
    expect(bang.getByText('Hạn: 31/12/2026')).toBeInTheDocument()
    expect(vungTask().queryByRole('button', { name: 'Tạo Task' })).not.toBeInTheDocument()
    expect(vungTask().getByText(THONG_BAO_TASK.khongQuanLy)).toBeInTheDocument()

    await user.click(bang.getByRole('button', { name: 'Viết tài liệu' }))
    const ngan = within(await choNganTruot('Viết tài liệu'))
    const thongTin = within(await ngan.findByRole('group', { name: 'Thông tin Task' }))
    expect(thongTin.getByText('Hạn: 31/12/2026')).toBeInTheDocument()
    expect(thongTin.getByText('Người thực hiện: An')).toBeInTheDocument()
    const dauVet = within(screen.getByRole('group', { name: 'Dấu vết' }))
    expect(dauVet.getByText('Người tạo: An PM')).toBeInTheDocument()
    expect(dauVet.getByText('Ngày tạo: 01/03/2026 08:00')).toBeInTheDocument()
    expect(dauVet.getByText('Chưa có ai chỉnh sửa.')).toBeInTheDocument()
  })

  it('Dự án đã Lưu trữ: không có nút tạo Task, kèm lý do, Task cũ vẫn xem được', async () => {
    const bc = await dungBoiCanh()
    await taoTaskSan(bc, 'Việc cũ')
    giaTri(await bc.kho.luuTruDuAn(await phienCua(bc.kho, PM.email), bc.duAn.id, LUC))
    const { user } = dungApp(bc.kho)
    await dangNhap(user, 'an@vi-du.vn')
    // Tổng quan (trang đầu) không còn liệt kê Dự án Lưu trữ; mở từ mục Dự án của tôi.
    await user.click(screen.getByRole('button', { name: 'Dự án của tôi' }))
    await moDuAnCuaToi(user, 'Cửa hàng')
    expect(await vungTask().findByRole('button', { name: 'Việc cũ' })).toBeInTheDocument()
    expect(vungTask().queryByRole('button', { name: 'Tạo Task' })).not.toBeInTheDocument()
  })

  it('PM mở Dự án đã Lưu trữ: lý do là Dự án đã Lưu trữ', async () => {
    const bc = await dungBoiCanh()
    giaTri(await bc.kho.luuTruDuAn(await phienCua(bc.kho, PM.email), bc.duAn.id, LUC))
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
    await user.click(await screen.findByRole('radio', { name: 'Lưu trữ' }))
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
    expect(await vungTask().findByText(THONG_BAO_TASK.daLuuTru)).toBeInTheDocument()
    expect(vungTask().queryByRole('button', { name: 'Tạo Task' })).not.toBeInTheDocument()
  })

  it('Task của Dự án khác không hiện trong Dự án này', async () => {
    const bc = await dungBoiCanh()
    await taoTaskSan(bc, 'Việc ở Cửa hàng')
    const pm = await phienCua(bc.kho, PM.email)
    giaTri(await bc.kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Kho hàng' }, LUC))
    const { user } = dungApp(bc.kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Kho hàng')
    expect(await vungTask().findByRole('heading', { name: 'Dự án chưa có Task nào.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Việc ở Cửa hàng' })).not.toBeInTheDocument()
  })
})

describe('Task: trạng thái đang tải và lỗi', () => {
  it('bảng Task đang tải thì hiện trạng thái đang tải', async () => {
    const goc = taoKho()
    await dungBoiCanh(goc)
    const kho: KhoDuLieu = { ...goc, danhSachTask: () => new Promise(() => {}) }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    expect(await screen.findByRole('progressbar', { name: 'Đang tải Task…' })).toBeInTheDocument()
  })

  it('bảng Task lỗi tải thì hiện thông báo tiếng Việt và thử lại được', async () => {
    const goc = taoKho()
    const bc = await dungBoiCanh(goc)
    await taoTaskSan(bc, 'Làm trang chủ')
    let lanGoi = 0
    // Chỉ đếm sau khi trang đầu (Tổng quan, cũng đọc Task) đã tải xong.
    let batDauDem = false
    const kho: KhoDuLieu = {
      ...goc,
      danhSachTask: async (phien, id) => {
        if (!batDauDem) return goc.danhSachTask(phien, id)
        lanGoi += 1
        return lanGoi === 1 ? thatBai('LOI_HE_THONG') : goc.danhSachTask(phien, id)
      },
    }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await choTongQuanTaiXong()
    batDauDem = true
    await pmMoDuAn(user, 'Cửa hàng')

    const canhBao = await vungTask().findByRole('alert')
    expect(canhBao).toHaveTextContent('Không tải được Task của Dự án.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.LOI_HE_THONG)
    await user.click(vungTask().getByRole('button', { name: 'Thử lại' }))
    expect(await vungTask().findByRole('button', { name: 'Làm trang chủ' })).toBeInTheDocument()
  })

  it('chi tiết Task đang tải thì hiện trạng thái đang tải', async () => {
    const goc = taoKho()
    const bc = await dungBoiCanh(goc)
    await taoTaskSan(bc, 'Làm trang chủ')
    const kho: KhoDuLieu = { ...goc, layTask: () => new Promise(() => {}) }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await user.click(await vungTask().findByRole('button', { name: 'Làm trang chủ' }))
    const ngan = within(await choNganTruot('Làm trang chủ'))
    expect(await ngan.findByRole('progressbar', { name: 'Đang tải Task…' })).toBeInTheDocument()
  })

  it('chi tiết Task lỗi tải thì hiện thông báo tiếng Việt trong Ngăn trượt, thử lại được và đóng ngăn về Dự án được', async () => {
    const goc = taoKho()
    const bc = await dungBoiCanh(goc)
    await taoTaskSan(bc, 'Làm trang chủ')
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      layTask: async (phien, id) => {
        lanGoi += 1
        return lanGoi === 1 ? thatBai('KHONG_TIM_THAY') : goc.layTask(phien, id)
      },
    }
    const { user, ungDung } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await user.click(await vungTask().findByRole('button', { name: 'Làm trang chủ' }))

    const ngan = within(await choNganTruot('Làm trang chủ'))
    const canhBao = await ngan.findByRole('alert')
    expect(canhBao).toHaveTextContent('Không tải được Task.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_TIM_THAY)
    expect(ngan.queryByRole('group', { name: 'Thông tin Task' })).not.toBeInTheDocument()
    await user.click(ngan.getByRole('button', { name: 'Thử lại' }))
    expect(await ngan.findByRole('group', { name: 'Thông tin Task' })).toBeInTheDocument()

    await dongNganTruot(user)
    expect(ungDung.getByRole('heading', { level: 2, name: 'Cửa hàng' })).toBeInTheDocument()
    expect(vungTask().getByRole('button', { name: 'Làm trang chủ' })).toBeInTheDocument()
  })

  it('form tạo Task đang tải người trong dự án thì hiện trạng thái đang tải', async () => {
    const goc = taoKho()
    await dungBoiCanh(goc)
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      // Lần đầu (trang Dự án) trả bình thường; từ lần sau (form tạo Task) treo mãi.
      danhSachNguoiTrongDuAn: (phien, id) => {
        lanGoi += 1
        return lanGoi === 1 ? goc.danhSachNguoiTrongDuAn(phien, id) : new Promise(() => {})
      },
    }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await user.click(await vungTask().findByRole('button', { name: 'Tạo Task' }))
    const ngan = within(await choNganTruot('Tạo Task'))
    expect(await ngan.findByRole('progressbar', { name: 'Đang tải người trong dự án…' })).toBeInTheDocument()
    expect(ngan.queryByLabelText('Tiêu đề')).not.toBeInTheDocument()
    expect(ngan.queryByRole('button', { name: 'Tạo Task' })).not.toBeInTheDocument()
  })

  it('form tạo Task lỗi tải người trong dự án thì hiện thông báo và thử lại được', async () => {
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
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await user.click(await vungTask().findByRole('button', { name: 'Tạo Task' }))

    const ngan = within(await choNganTruot('Tạo Task'))
    const canhBao = await ngan.findByRole('alert')
    expect(canhBao).toHaveTextContent('Không tải được người trong dự án')
    await user.click(ngan.getByRole('button', { name: 'Thử lại' }))
    expect(await ngan.findByLabelText('Tiêu đề')).toBeInTheDocument()
  })
})
