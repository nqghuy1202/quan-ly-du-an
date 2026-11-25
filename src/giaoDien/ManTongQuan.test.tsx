// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import type { TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'

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
  const duAn = giaTri(await kho.taoDuAn(pm, { ten }, LUC_TAO))
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

async function dungBoiCanh() {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const an = await taoNguoi(kho, 'an@vi-du.vn', 'An')
  const binh = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình')
  return { kho, an, binh }
}

describe('Tổng quan', () => {
  it('PM thấy mọi Dự án (kể cả Dự án PM không ở trong): tên, Tiến độ, số Task theo trạng thái và cờ Trễ hạn', async () => {
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
    expect(ch.getByText('Mới 1')).toBeInTheDocument()
    expect(ch.getByText('Đang làm 1')).toBeInTheDocument()
    expect(ch.getByText('Hoàn thành 1')).toBeInTheDocument()
    expect(ch.getByText('Huỷ 1')).toBeInTheDocument()
    expect(ch.getByText('Trễ hạn (1)')).toBeInTheDocument()

    // Dự án không có Task đáng tính: "chưa có task", không phải 0%, và không có cờ.
    const moi = await dongDuAn('Dự án mới')
    expect(moi.getByText('chưa có task')).toBeInTheDocument()
    expect(moi.queryByText('0%')).not.toBeInTheDocument()
    expect(moi.queryByText(/Trễ hạn/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Kho hàng' })).toBeInTheDocument()
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

  it('Thành viên chỉ thấy Dự án mình ở trong, cùng số Task chưa chốt của riêng mình', async () => {
    const { kho, an, binh } = await dungBoiCanh()
    const cuaHang = await taoDuAn(kho, 'Cửa hàng', ['an@vi-du.vn', 'binh@vi-du.vn'])
    await taoDuAn(kho, 'Dự án của người khác', ['binh@vi-du.vn'])
    await taoTask(kho, cuaHang.id, 'An làm', an, binh)
    await taoTask(kho, cuaHang.id, 'An duyệt', binh, an, 'CHO_DUYET')
    await taoTask(kho, cuaHang.id, 'An xong', an, binh, 'HOAN_THANH')
    await taoTask(kho, cuaHang.id, 'Bình làm', binh, an, 'MOI')
    const { user } = dungApp(kho)
    await dangNhap(user, 'an@vi-du.vn')
    await moTongQuan(user)
    const ch = await dongDuAn('Cửa hàng')
    // An: "An làm" (thực hiện), "An duyệt" (kiểm tra), "Bình làm" (kiểm tra); "An xong" đã chốt.
    expect(ch.getByRole('cell', { name: '3' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Dự án của người khác' })).not.toBeInTheDocument()
  })

  it('Dự án Lưu trữ nằm ở nhóm riêng', async () => {
    const { kho } = await dungBoiCanh()
    const cu = await taoDuAn(kho, 'Dự án cũ')
    await taoDuAn(kho, 'Đang chạy')
    giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), cu.id, LUC_TAO))
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await moTongQuan(user)
    const hoatDong = within(await screen.findByRole('group', { name: 'Dự án đang hoạt động' }))
    const luuTru = within(screen.getByRole('group', { name: 'Dự án đã Lưu trữ' }))
    expect(hoatDong.getByRole('button', { name: 'Đang chạy' })).toBeInTheDocument()
    expect(hoatDong.queryByRole('button', { name: 'Dự án cũ' })).not.toBeInTheDocument()
    expect(luuTru.getByRole('button', { name: 'Dự án cũ' })).toBeInTheDocument()
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
    expect(await screen.findByText('Đang tải tổng quan…')).toBeInTheDocument()
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
})
