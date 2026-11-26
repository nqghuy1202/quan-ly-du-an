// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { THONG_BAO_MAC_DINH, thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { THONG_BAO_DU_AN } from '../luat/duAn'
import { THONG_BAO_REPO } from '../luat/github'
import type { VaiHeThong } from '../luat/taiKhoan'
import { moTabDuAn } from '../test/khungUngDung'

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }
const O_REPO = 'Repo cần gắn'

type User = ReturnType<typeof userEvent.setup>

function taoKho(): KhoBoNho {
  return taoKhoBoNho({ pmBanDau: PM })
}

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

async function taoNguoi(kho: KhoBoNho, email: string, tenHienThi: string, vai: VaiHeThong): Promise<string> {
  const hoSo = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
  await kho.moPhong.xacNhanEmail(email)
  if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(await phienCua(kho, PM.email), hoSo.id, { vai }))
  return hoSo.id
}

async function taoDuAn(kho: KhoBoNho, ten: string): Promise<DuAn> {
  return giaTri(await kho.taoDuAn(await phienCua(kho, PM.email), { ten }, LUC))
}

async function themVao(kho: KhoBoNho, duAn: DuAn, email: string) {
  giaTri(await kho.themNguoiVaoDuAn(await phienCua(kho, PM.email), duAn.id, { email }))
}

async function ganSan(kho: KhoBoNho, duAn: DuAn, repo: string) {
  giaTri(await kho.ganRepoVaoDuAn(await phienCua(kho, PM.email), duAn.id, { repo }))
}

async function tenCacRepo(kho: KhoBoNho, duAn: DuAn): Promise<string[]> {
  return giaTri(await kho.danhSachRepoCuaDuAn(await phienCua(kho, PM.email), duAn.id))
    .map((r) => r.tenRepo)
    .sort()
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

/** PM mở chi tiết Dự án `ten` từ mục Tất cả Dự án, sang tab GitHub. */
async function pmMoDuAn(user: User, ten: string) {
  await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
  await moTabDuAn(user, 'GitHub')
}

/** Mở chi tiết Dự án `ten` từ mục Dự án của tôi, sang tab GitHub. */
async function moDuAnCuaToi(user: User, ten: string) {
  await user.click(await screen.findByRole('button', { name: ten }))
  await screen.findByRole('heading', { level: 2, name: ten })
  await moTabDuAn(user, 'GitHub')
}

function vungRepo() {
  return within(screen.getByRole('group', { name: 'Repo GitHub' }))
}

describe('mục Repo GitHub trên trang Dự án', () => {
  it('trống thì hiện trạng thái trống; PM gắn repo thì repo hiện trong bảng, gắn trùng và sai dạng bị báo', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')

    expect(await vungRepo().findByRole('heading', { name: 'Dự án chưa gắn repo GitHub nào.' })).toBeInTheDocument()

    await user.type(screen.getByLabelText(O_REPO), 'Vercel/Next.js')
    await user.click(screen.getByRole('button', { name: 'Gắn repo' }))
    expect(await ungDung.findByText('Đã gắn repo Vercel/Next.js vào Dự án.')).toBeInTheDocument()
    const bang = within(screen.getByRole('table', { name: 'Danh sách repo GitHub' }))
    expect(bang.getByText('Vercel/Next.js')).toBeInTheDocument()
    expect(screen.getByLabelText(O_REPO)).toHaveValue('')

    await user.type(screen.getByLabelText(O_REPO), 'vercel/next.js')
    await user.click(screen.getByRole('button', { name: 'Gắn repo' }))
    expect(await ungDung.findByText('Chưa gắn được repo vào Dự án.')).toBeInTheDocument()
    expect((await ungDung.findAllByText(THONG_BAO_MAC_DINH.REPO_DA_GAN)).length).toBeGreaterThan(0)

    await user.clear(screen.getByLabelText(O_REPO))
    await user.type(screen.getByLabelText(O_REPO), 'khong-hop-le')
    await user.click(screen.getByRole('button', { name: 'Gắn repo' }))
    expect((await ungDung.findAllByText(THONG_BAO_REPO.sai)).length).toBeGreaterThan(0)

    expect(await tenCacRepo(kho, duAn)).toEqual(['Vercel/Next.js'])
  })

  it('PM gỡ repo: repo biến khỏi bảng và Kho, quay về trạng thái trống', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    await ganSan(kho, duAn, 'acme/api')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')

    await user.click(await vungRepo().findByRole('button', { name: 'Gỡ acme/api' }))

    expect(await ungDung.findByText('Đã gỡ repo acme/api khỏi Dự án.')).toBeInTheDocument()
    expect(vungRepo().getByRole('heading', { name: 'Dự án chưa gắn repo GitHub nào.' })).toBeInTheDocument()
    expect(await tenCacRepo(kho, duAn)).toEqual([])
  })

  it('Support của Dự án gắn được repo', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    await taoNguoi(kho, 'son@vi-du.vn', 'Sơn', 'SUPPORT')
    await themVao(kho, duAn, 'son@vi-du.vn')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, 'son@vi-du.vn')
    await moDuAnCuaToi(user, 'Cửa hàng')

    await user.type(await screen.findByLabelText(O_REPO), 'acme/web')
    await user.click(screen.getByRole('button', { name: 'Gắn repo' }))
    expect(await ungDung.findByText('Đã gắn repo acme/web vào Dự án.')).toBeInTheDocument()
    expect(await tenCacRepo(kho, duAn)).toEqual(['acme/web'])
  })

  it('Thành viên của Dự án xem được repo nhưng nút gắn và gỡ bị ẩn, ô nhập vô hiệu, kèm lý do', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Cửa hàng')
    await taoNguoi(kho, 'ha@vi-du.vn', 'Hà', 'THANH_VIEN')
    await themVao(kho, duAn, 'ha@vi-du.vn')
    await ganSan(kho, duAn, 'acme/api')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, 'ha@vi-du.vn')
    await moDuAnCuaToi(user, 'Cửa hàng')

    const bang = within(await vungRepo().findByRole('table', { name: 'Danh sách repo GitHub' }))
    expect(bang.getByText('acme/api')).toBeInTheDocument()
    expect(ungDung.getAllByText(THONG_BAO_REPO.khongQuanLy).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Gắn repo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Gỡ acme/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText(O_REPO)).toHaveAttribute('aria-disabled', 'true')
  })

  it('Dự án đã Lưu trữ: repo vẫn xem được, nút gắn và gỡ bị ẩn, kèm lý do', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Đã xong')
    await ganSan(kho, duAn, 'acme/api')
    giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), duAn.id, LUC))
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
    await user.click(await screen.findByRole('radio', { name: 'Lưu trữ' }))
    await user.click(await screen.findByRole('button', { name: 'Đã xong' }))
    await screen.findByRole('heading', { level: 2, name: 'Đã xong' })
    await moTabDuAn(user, 'GitHub')

    expect(await vungRepo().findByText('acme/api')).toBeInTheDocument()
    expect(ungDung.getAllByText(THONG_BAO_DU_AN.daLuuTru).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Gắn repo' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Gỡ acme/api' })).not.toBeInTheDocument()
    expect(screen.getByLabelText(O_REPO)).toHaveAttribute('aria-disabled', 'true')
  })

  it('đang tải thì hiện trạng thái đang tải', async () => {
    const goc = taoKho()
    await taoDuAn(goc, 'Cửa hàng')
    const kho: KhoDuLieu = { ...goc, danhSachRepoCuaDuAn: () => new Promise(() => {}) }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')
    expect(await screen.findByRole('progressbar', { name: 'Đang tải repo GitHub…' })).toBeInTheDocument()
  })

  it('lỗi tải thì hiện thông báo tiếng Việt và thử lại được', async () => {
    const goc = taoKho()
    const duAn = await taoDuAn(goc, 'Cửa hàng')
    await ganSan(goc, duAn, 'acme/api')
    let lanGoi = 0
    const kho: KhoDuLieu = {
      ...goc,
      danhSachRepoCuaDuAn: async (phien, id) => {
        lanGoi += 1
        return lanGoi === 1 ? thatBai('LOI_HE_THONG') : goc.danhSachRepoCuaDuAn(phien, id)
      },
    }
    const { user } = dungApp(goc, kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Cửa hàng')

    const canhBao = await vungRepo().findByRole('alert')
    expect(canhBao).toHaveTextContent('Không tải được repo GitHub của Dự án.')
    expect(canhBao).toHaveTextContent(THONG_BAO_MAC_DINH.LOI_HE_THONG)
    await user.click(vungRepo().getByRole('button', { name: 'Thử lại' }))
    expect(await vungRepo().findByText('acme/api')).toBeInTheDocument()
  })

  it('Dự án bị Lưu trữ ở nơi khác rồi bấm gắn thì bị từ chối kèm lý do và nút gắn ẩn đi', async () => {
    const kho = taoKho()
    const duAn = await taoDuAn(kho, 'Đang mở')
    const { user, ungDung } = dungApp(kho)
    await dangNhap(user, PM.email)
    await pmMoDuAn(user, 'Đang mở')
    await vungRepo().findByRole('heading', { name: 'Dự án chưa gắn repo GitHub nào.' })

    giaTri(await kho.luuTruDuAn(await phienCua(kho, PM.email), duAn.id, LUC))
    await user.type(screen.getByLabelText(O_REPO), 'acme/api')
    await user.click(screen.getByRole('button', { name: 'Gắn repo' }))

    expect(await ungDung.findByText('Chưa gắn được repo vào Dự án.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Gắn repo' })).not.toBeInTheDocument())
    expect(await tenCacRepo(kho, duAn)).toEqual([])
    // Nút mở lại nằm ở tab Thông tin.
    await moTabDuAn(user, 'Thông tin')
    expect(await screen.findByRole('button', { name: 'Mở lại Dự án' })).toBeInTheDocument()
  })
})
