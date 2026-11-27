// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { THONG_BAO_MAC_DINH, thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { THONG_BAO_DU_AN } from '../luat/duAn'
import type { TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { choNganTruot, moTabDuAn } from '../test/khungUngDung'
import { maDuAnMoi } from '../test/maDuAn'

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }
const O_EMAIL = 'Email người cần thêm'

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

async function taoDuAn(kho: KhoBoNho, ten: string): Promise<DuAn> {
  return giaTri(await kho.taoDuAn(await phienCua(kho, PM.email), { ma: maDuAnMoi(), ten }, LUC))
}

async function themVao(kho: KhoBoNho, duAn: DuAn, email: string) {
  giaTri(await kho.themNguoiVaoDuAn(await phienCua(kho, PM.email), duAn.id, { email }))
}

async function idNguoiTrong(kho: KhoBoNho, duAn: DuAn): Promise<string[]> {
  return giaTri(await kho.danhSachNguoiTrongDuAn(await phienCua(kho, PM.email), duAn.id)).map((n) => n.id)
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

/** PM mở chi tiết Dự án `ten` từ mục Tất cả Dự án, sang tab Người trong dự án. */
async function pmMoDuAn(user: User, ten: string) {
  await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
  await moTabDuAn(user, 'Người trong dự án')
}

/** Mở chi tiết Dự án `ten` từ mục Dự án của tôi (mục mặc định sau đăng nhập), sang tab Người trong dự án. */
async function moDuAnCuaToi(user: User, ten: string) {
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
  await moTabDuAn(user, 'Người trong dự án')
}

function vungNguoi() {
  return within(screen.getByRole('group', { name: 'Người trong dự án' }))
}

describe('màn người trong dự án: thêm và gỡ', () => {
  it('trống thì hiện trạng thái trống; PM thêm người bằng email đã đăng ký thì người đó hiện với tên, email và vai', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    const binhId = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', 'SUPPORT')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')

    expect(await vungNguoi().findByRole('heading', { name: 'Dự án chưa có ai.' })).toBeInTheDocument()

    await user.type(screen.getByLabelText(O_EMAIL), 'BINH@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Thêm vào Dự án' }))

    expect(await ungDung.findByText('Đã thêm Bình vào Dự án.')).toBeInTheDocument()
    const bang = within(screen.getByRole('table', { name: 'Danh sách người trong dự án' }))
    expect(bang.getByText('Bình')).toBeInTheDocument()
    expect(bang.getByText('binh@vi-du.vn')).toBeInTheDocument()
    expect(bang.getByText('Support')).toBeInTheDocument()
    expect(screen.getByLabelText(O_EMAIL)).toHaveValue('')
    expect(await idNguoiTrong(kho, duAn)).toEqual([binhId])
  })

  it('email chưa đăng ký báo "chưa đăng ký"; người đã trong Dự án báo đã ở trong; không thêm gì', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    const chiId = await taoNguoi(kho, 'chi@vi-du.vn', 'Chi', 'THANH_VIEN')
    await themVao(kho, duAn, 'chi@vi-du.vn')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await vungNguoi().findByRole('table', { name: 'Danh sách người trong dự án' })

    await user.type(screen.getByLabelText(O_EMAIL), 'chua-co@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Thêm vào Dự án' }))
    expect(await ungDung.findByText('Chưa thêm được người vào Dự án.')).toBeInTheDocument()
    expect(ungDung.getAllByText(/chưa đăng ký/).length).toBeGreaterThan(0)

    await user.clear(screen.getByLabelText(O_EMAIL))
    await user.type(screen.getByLabelText(O_EMAIL), 'chi@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Thêm vào Dự án' }))
    expect((await ungDung.findAllByText(THONG_BAO_MAC_DINH.DA_TRONG_DU_AN)).length).toBeGreaterThan(0)

    expect(await idNguoiTrong(kho, duAn)).toEqual([chiId])
  })

  it('PM gỡ một người: người đó biến khỏi danh sách, tài khoản và hồ sơ giữ nguyên', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    await taoNguoi(kho, 'dung@vi-du.vn', 'Dũng', 'THANH_VIEN')
    await themVao(kho, duAn, 'dung@vi-du.vn')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')

    await user.click(await vungNguoi().findByRole('button', { name: 'Gỡ Dũng' }))

    expect(
      await ungDung.findByText('Đã gỡ Dũng khỏi Dự án. Tài khoản và hồ sơ của họ vẫn giữ nguyên.'),
    ).toBeInTheDocument()
    expect(vungNguoi().getByRole('heading', { name: 'Dự án chưa có ai.' })).toBeInTheDocument()
    expect(await idNguoiTrong(kho, duAn)).toEqual([])
    const hoSo = giaTri(await kho.layHoSoCuaToi(await phienCua(kho, 'dung@vi-du.vn')))
    expect(hoSo).toEqual(expect.objectContaining({ email: 'dung@vi-du.vn', tenHienThi: 'Dũng', vai: 'THANH_VIEN' }))
  })

  it('Support của Dự án thấy Dự án ở mục Dự án của tôi, sửa được Dự án và thêm được người', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    await taoNguoi(kho, 'son@vi-du.vn', 'Sơn', 'SUPPORT')
    const lanId = await taoNguoi(kho, 'lan@vi-du.vn', 'Lan', 'THANH_VIEN')
    await themVao(kho, duAn, 'son@vi-du.vn')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, 'son@vi-du.vn')
    await moDuAnCuaToi(user, 'Cửa hàng')

    await user.type(await screen.findByLabelText(O_EMAIL), 'lan@vi-du.vn')
    await user.click(await screen.findByRole('button', { name: 'Thêm vào Dự án' }))
    expect(await ungDung.findByText('Đã thêm Lan vào Dự án.')).toBeInTheDocument()
    expect(await idNguoiTrong(kho, duAn)).toContain(lanId)

    // Sửa (trong Ngăn trượt) và Lưu trữ nằm ở tab Thông tin.
    await moTabDuAn(user, 'Thông tin')
    expect(await screen.findByRole('button', { name: 'Sửa Dự án' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Lưu trữ Dự án' })).toBeInTheDocument()
    expect(ungDung.queryByText(THONG_BAO_DU_AN.khongQuanLy)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Sửa Dự án' }))
    const ngan = within(await choNganTruot('Sửa Dự án'))
    await user.clear(ngan.getByLabelText('Tên Dự án'))
    await user.paste('Cửa hàng mới')
    await user.click(ngan.getByRole('button', { name: 'Lưu thay đổi' }))
    expect(await ungDung.findByText('Đã lưu thay đổi.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Cửa hàng mới' })).toBeInTheDocument()
  })

  it('Thành viên của Dự án xem được người trong dự án nhưng nút ghi bị ẩn, ô email vô hiệu, kèm lý do', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    await taoNguoi(kho, 'ha@vi-du.vn', 'Hà', 'THANH_VIEN')
    await taoNguoi(kho, 'khoa@vi-du.vn', 'Khoa', 'SUPPORT')
    await themVao(kho, duAn, 'ha@vi-du.vn')
    await themVao(kho, duAn, 'khoa@vi-du.vn')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, 'ha@vi-du.vn')
    await moDuAnCuaToi(user, 'Cửa hàng')

    const bang = within(await vungNguoi().findByRole('table', { name: 'Danh sách người trong dự án' }))
    expect(bang.getByText('Hà')).toBeInTheDocument()
    expect(bang.getByText('khoa@vi-du.vn')).toBeInTheDocument()
    expect(bang.getByText('Support')).toBeInTheDocument()

    expect(ungDung.getAllByText(THONG_BAO_DU_AN.khongQuanLy).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Thêm vào Dự án' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Gỡ / })).not.toBeInTheDocument()
    expect(screen.getByLabelText(O_EMAIL)).toHaveAttribute('aria-disabled', 'true')

    // Tab Thông tin: chỉ xem, không có nút sửa hay Lưu trữ, không có ô nhập.
    await moTabDuAn(user, 'Thông tin')
    expect(screen.queryByRole('button', { name: 'Sửa Dự án' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Lưu trữ Dự án' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Tên Dự án')).not.toBeInTheDocument()
  })

  it.each<VaiHeThong>(['SUPPORT', 'THANH_VIEN'])(
    '%s không ở trong Dự án nào thì Dự án của tôi trống và không có mục Tất cả Dự án',
    async (vai) => {
      const kho = taoKho()
      await taoDuAn(kho, 'Bí mật')
      await taoNguoi(kho, 'la@vi-du.vn', 'Lạ', vai)
      const { user } = dungApp(kho)
      await dangNhap(user, 'la@vi-du.vn')
      await user.click(screen.getByRole('button', { name: 'Dự án của tôi' }))
      expect(
        await screen.findByRole('heading', { name: 'Bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn.' }),
      ).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Bí mật' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Tất cả Dự án' })).not.toBeInTheDocument()
    },
  )

  it('Dự án đã Lưu trữ: nút thêm và gỡ bị ẩn, ô email vô hiệu, kèm lý do', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Đã xong')
    await taoNguoi(kho, 'dung@vi-du.vn', 'Dũng', 'THANH_VIEN')
    await themVao(kho, duAn, 'dung@vi-du.vn')
    giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), duAn.id, LUC))
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
    await user.click(await screen.findByRole('radio', { name: 'Lưu trữ' }))
    await user.click(await screen.findByRole('button', { name: 'Đã xong' }))
    await screen.findByRole('heading', { level: 2, name: 'Đã xong' })
    await moTabDuAn(user, 'Người trong dự án')

    expect(await vungNguoi().findByText('Dũng')).toBeInTheDocument()
    expect(ungDung.getAllByText(THONG_BAO_DU_AN.daLuuTru).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Thêm vào Dự án' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gỡ Dũng' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(O_EMAIL)).toHaveAttribute('aria-disabled', 'true')
  })

  it('Dự án bị Lưu trữ ở nơi khác rồi bấm thêm thì bị từ chối kèm lý do và nút thêm ẩn đi', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Đang mở')
    await taoNguoi(kho, 'moi@vi-du.vn', 'Mới', 'THANH_VIEN')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Đang mở')
    await vungNguoi().findByRole('heading', { name: 'Dự án chưa có ai.' })

    giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), duAn.id, LUC))
    await user.type(screen.getByLabelText(O_EMAIL), 'moi@vi-du.vn')
    await user.click(screen.getByRole('button', { name: 'Thêm vào Dự án' }))

    expect(await ungDung.findByText('Chưa thêm được người vào Dự án.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Thêm vào Dự án' })).not.toBeInTheDocument())
    expect(await idNguoiTrong(kho, duAn)).toEqual([])
    // Nút mở lại nằm ở tab Thông tin.
    await moTabDuAn(user, 'Thông tin')
    expect(await screen.findByRole('button', { name: 'Mở lại Dự án' })).toBeInTheDocument()
  })

  it('đang tải thì hiện trạng thái đang tải', async () => {
    const goc = taoKho()
    await taoDuAn(goc, 'Cửa hàng')
    const kho: KhoDuLieu = { ...goc, danhSachNguoiTrongDuAn: () => new Promise(() => {}) }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    expect(await screen.findByRole('progressbar', { name: 'Đang tải người trong dự án…' })).toBeInTheDocument()
  })

  it('lỗi tải thì hiện thông báo tiếng Việt và thử lại được', async () => {
    const goc = taoKho()
    const duAn = await taoDuAn(goc, 'Cửa hàng')
    await taoNguoi(goc, 'binh@vi-du.vn', 'Bình', 'THANH_VIEN')
    await themVao(goc, duAn, 'binh@vi-du.vn')
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      danhSachNguoiTrongDuAn: async (phien, id) => {
        lanGoi += 1
        return lanGoi === 1 ? thatBai('KHONG_TIM_THAY') : goc.danhSachNguoiTrongDuAn(phien, id)
      },
    }
    const { user, ungDung } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')

    const canhBao = await ungDung.findByRole('alert')
    expect(canhBao).toHaveTextContent('Không tải được người trong dự án.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.KHONG_TIM_THAY)
    await user.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await vungNguoi().findByText('Bình')).toBeInTheDocument()
  })
})

/** Hàng của người tên `ten` trong bảng Người trong dự án. */
function hangCua(ten: string): HTMLElement {
  const bang = screen.getByRole('table', { name: 'Danh sách người trong dự án' })
  const hang = within(bang)
    .getAllByRole('row')
    .find((h) => within(h).queryByText(ten, { exact: true }))
  if (!hang) throw new Error(`Không thấy hàng của ${ten}`)
  return hang
}

async function vaiTroTrongKho(kho: KhoBoNho, duAn: DuAn, id: string): Promise<string | null | undefined> {
  const danhSach = giaTri(await kho.danhSachNguoiTrongDuAn(await phienCua(kho, PM.email), duAn.id))
  return danhSach.find((n) => n.id === id)?.vaiTroTrongDuAn
}

/** Tạo Task do PM giao (thực hiện, kiểm tra) rồi đặt thẳng trạng thái. */
async function taoTask(kho: KhoBoNho, duAn: DuAn, tieuDe: string, thucHien: string, kiemTra: string, trangThai: TrangThaiTask) {
  const pm = await phienCua(kho, PM.email)
  const task = giaTri(await kho.taoTask(pm, duAn.id, { tieuDe, nguoiThucHienId: thucHien, nguoiKiemTraId: kiemTra }, LUC))
  if (trangThai !== 'MOI') giaTri(await kho.chuDuAn.datTrangThaiTask(task.id, trangThai))
}

describe('bảng Người trong dự án: Vai trò trong Dự án, Thông tin nhân sự, số Task đang giữ', () => {
  it('bảng có đủ năm cột: tên, Vai trò trong Dự án, Chức danh, Số điện thoại, số Task đang giữ (chỉ Task chưa chốt mà người đó thực hiện)', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    const binhId = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', 'THANH_VIEN')
    const chiId = await taoNguoi(kho, 'chi@vi-du.vn', 'Chi', 'THANH_VIEN')
    const binh = await phienCua(kho, 'binh@vi-du.vn')
    giaTri(await kho.suaHoSo(binh, binhId, { soDienThoai: '0901 234 567', chucDanh: 'Kỹ sư phần mềm' }))
    giaTri(
      await kho.themNguoiVaoDuAn(await phienCua(kho, PM.email), duAn.id, {
        email: 'binh@vi-du.vn',
        vaiTroTrongDuAn: 'Trưởng nhóm',
      }),
    )
    await themVao(kho, duAn, 'chi@vi-du.vn')
    // Bình thực hiện: Mới, Chờ duyệt (tính); Hoàn thành, Huỷ (không tính). Bình kiểm tra một Task của Chi (không tính cho Bình).
    await taoTask(kho, duAn, 'Một', binhId, chiId, 'MOI')
    await taoTask(kho, duAn, 'Hai', binhId, chiId, 'CHO_DUYET')
    await taoTask(kho, duAn, 'Ba', binhId, chiId, 'HOAN_THANH')
    await taoTask(kho, duAn, 'Bốn', binhId, chiId, 'HUY')
    await taoTask(kho, duAn, 'Năm', chiId, binhId, 'DANG_LAM')

    const { user } = dungApp(kho)
    await dangNhap(user, 'chi@vi-du.vn')
    await moDuAnCuaToi(user, 'Cửa hàng')
    const bang = within(await vungNguoi().findByRole('table', { name: 'Danh sách người trong dự án' }))
    for (const cot of ['Tên', 'Vai trò trong Dự án', 'Chức danh', 'Số điện thoại', 'Task đang giữ']) {
      expect(bang.getByRole('columnheader', { name: cot })).toBeInTheDocument()
    }

    const hangBinh = within(hangCua('Bình'))
    expect(hangBinh.getByText('binh@vi-du.vn')).toBeInTheDocument()
    expect(hangBinh.getByText('Trưởng nhóm')).toBeInTheDocument()
    expect(hangBinh.getByText('Kỹ sư phần mềm')).toBeInTheDocument()
    expect(hangBinh.getByText('0901234567')).toBeInTheDocument()
    expect(hangBinh.getByText('2')).toBeInTheDocument()

    // Chi chưa có vai trò, chưa nhập Thông tin nhân sự: "Chưa có"; giữ 1 Task (Năm).
    const hangChi = within(hangCua('Chi'))
    expect(hangChi.getAllByText('Chưa có')).toHaveLength(3)
    expect(hangChi.getByText('1')).toBeInTheDocument()
  })

  it('PM thêm người kèm Vai trò trong Dự án: người đó hiện với vai trò; dài hơn 60 ký tự thì báo lỗi cạnh ô, không thêm', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    const binhId = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', 'THANH_VIEN')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await vungNguoi().findByRole('heading', { name: 'Dự án chưa có ai.' })

    await user.click(screen.getByLabelText(O_EMAIL))
    await user.paste('binh@vi-du.vn')
    await user.click(screen.getByLabelText(/^Vai trò trong Dự án/))
    await user.paste('V'.repeat(61))
    await user.click(screen.getByRole('button', { name: 'Thêm vào Dự án' }))
    expect(await ungDung.findByText('Chưa thêm được người vào Dự án.')).toBeInTheDocument()
    expect(ungDung.getAllByText(THONG_BAO_DU_AN.vaiTroQuaDai).length).toBeGreaterThan(0)
    expect(await idNguoiTrong(kho, duAn)).toEqual([])

    await user.clear(screen.getByLabelText(/^Vai trò trong Dự án/))
    await user.paste('Kiểm thử')
    await user.click(screen.getByRole('button', { name: 'Thêm vào Dự án' }))
    expect(await ungDung.findByText('Đã thêm Bình vào Dự án.')).toBeInTheDocument()
    expect(within(hangCua('Bình')).getByText('Kiểm thử')).toBeInTheDocument()
    expect(screen.getByLabelText(/^Vai trò trong Dự án/)).toHaveValue('')
    expect(await vaiTroTrongKho(kho, duAn, binhId)).toBe('Kiểm thử')
  })

  it('PM sửa Vai trò trong Dự án ngay trên hàng: lưu được thì hàng hiện vai trò mới; dài hơn 60 ký tự thì báo lỗi cạnh ô; Huỷ thì không đổi', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    const binhId = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', 'THANH_VIEN')
    await themVao(kho, duAn, 'binh@vi-du.vn')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await vungNguoi().findByRole('table', { name: 'Danh sách người trong dự án' })

    // Huỷ: ô đóng, không đổi gì.
    await user.click(within(hangCua('Bình')).getByRole('button', { name: 'Sửa vai trò của Bình' }))
    await user.paste('Bỏ đi')
    await user.click(within(hangCua('Bình')).getByRole('button', { name: 'Huỷ' }))
    expect(screen.queryByLabelText('Vai trò trong Dự án của Bình')).not.toBeInTheDocument()
    expect(await vaiTroTrongKho(kho, duAn, binhId)).toBeNull()

    // Quá dài: lỗi cạnh ô, ô vẫn mở, Kho không đổi.
    await user.click(within(hangCua('Bình')).getByRole('button', { name: 'Sửa vai trò của Bình' }))
    const o = screen.getByLabelText('Vai trò trong Dự án của Bình')
    expect(o).toHaveFocus()
    await user.paste('V'.repeat(61))
    await user.click(within(hangCua('Bình')).getByRole('button', { name: 'Lưu vai trò' }))
    expect((await ungDung.findAllByText(THONG_BAO_DU_AN.vaiTroQuaDai)).length).toBeGreaterThan(0)
    expect(screen.getByLabelText('Vai trò trong Dự án của Bình')).toBeInTheDocument()
    expect(await vaiTroTrongKho(kho, duAn, binhId)).toBeNull()

    // Lưu được (Enter cũng lưu).
    await user.clear(screen.getByLabelText('Vai trò trong Dự án của Bình'))
    await user.paste('Trưởng nhóm')
    await user.keyboard('{Enter}')
    expect(await ungDung.findByText('Đã lưu Vai trò trong Dự án của Bình.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Vai trò trong Dự án của Bình')).not.toBeInTheDocument()
    expect(within(hangCua('Bình')).getByText('Trưởng nhóm')).toBeInTheDocument()
    expect(await vaiTroTrongKho(kho, duAn, binhId)).toBe('Trưởng nhóm')
  })

  it('Support của Dự án sửa được Vai trò trong Dự án trên tab', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    await taoNguoi(kho, 'son@vi-du.vn', 'Sơn', 'SUPPORT')
    const lanId = await taoNguoi(kho, 'lan@vi-du.vn', 'Lan', 'THANH_VIEN')
    await themVao(kho, duAn, 'son@vi-du.vn')
    await themVao(kho, duAn, 'lan@vi-du.vn')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, 'son@vi-du.vn')
    await moDuAnCuaToi(user, 'Cửa hàng')
    await vungNguoi().findByRole('table', { name: 'Danh sách người trong dự án' })

    await user.click(within(hangCua('Lan')).getByRole('button', { name: 'Sửa vai trò của Lan' }))
    await user.paste('Thiết kế')
    await user.click(within(hangCua('Lan')).getByRole('button', { name: 'Lưu vai trò' }))
    expect(await ungDung.findByText('Đã lưu Vai trò trong Dự án của Lan.')).toBeInTheDocument()
    expect(await vaiTroTrongKho(kho, duAn, lanId)).toBe('Thiết kế')
  })

  it('Thành viên của Dự án: thấy Vai trò trong Dự án nhưng không có chỗ sửa; ô vai trò khi thêm vô hiệu', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    await taoNguoi(kho, 'ha@vi-du.vn', 'Hà', 'THANH_VIEN')
    await taoNguoi(kho, 'khoa@vi-du.vn', 'Khoa', 'THANH_VIEN')
    await themVao(kho, duAn, 'ha@vi-du.vn')
    giaTri(
      await kho.themNguoiVaoDuAn(await phienCua(kho, PM.email), duAn.id, {
        email: 'khoa@vi-du.vn',
        vaiTroTrongDuAn: 'Trưởng nhóm',
      }),
    )
    const { user } = dungApp(kho)
    await dangNhap(user, 'ha@vi-du.vn')
    await moDuAnCuaToi(user, 'Cửa hàng')
    await vungNguoi().findByRole('table', { name: 'Danh sách người trong dự án' })
    expect(within(hangCua('Khoa')).getByText('Trưởng nhóm')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Sửa vai trò/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/^Vai trò trong Dự án/)).toHaveAttribute('aria-disabled', 'true')
  })

  it('Dự án đã Lưu trữ: PM thấy Vai trò trong Dự án nhưng không có nút sửa', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Đã xong')
    await taoNguoi(kho, 'dung@vi-du.vn', 'Dũng', 'THANH_VIEN')
    giaTri(
      await kho.themNguoiVaoDuAn(await phienCua(kho, PM.email), duAn.id, { email: 'dung@vi-du.vn', vaiTroTrongDuAn: 'Kiểm thử' }),
    )
    giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), duAn.id, LUC))
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
    await user.click(await screen.findByRole('radio', { name: 'Lưu trữ' }))
    await user.click(await screen.findByRole('button', { name: 'Đã xong' }))
    await screen.findByRole('heading', { level: 2, name: 'Đã xong' })
    await moTabDuAn(user, 'Người trong dự án')

    expect(within(await vungNguoi().findByRole('table')).getByText('Kiểm thử')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sửa vai trò của Dũng' })).not.toBeInTheDocument()
  })

  it('mở lại tab Người trong dự án thì số Task đang giữ khớp với Task vừa tạo ở nơi khác', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    const binhId = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', 'THANH_VIEN')
    const chiId = await taoNguoi(kho, 'chi@vi-du.vn', 'Chi', 'THANH_VIEN')
    await themVao(kho, duAn, 'binh@vi-du.vn')
    await themVao(kho, duAn, 'chi@vi-du.vn')
    const { user } = dungApp(kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    await vungNguoi().findByRole('table', { name: 'Danh sách người trong dự án' })
    expect(within(hangCua('Bình')).getByText('0')).toBeInTheDocument()

    await taoTask(kho, duAn, 'Việc mới', binhId, chiId, 'DANG_LAM')
    await moTabDuAn(user, 'Task')
    await moTabDuAn(user, 'Người trong dự án')
    await waitFor(() => expect(within(hangCua('Bình')).getByText('1')).toBeInTheDocument())
  })
})
