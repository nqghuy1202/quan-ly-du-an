// @vitest-environment jsdom
// Ticket tối ưu hiệu năng 07: chia gói theo màn. Các màn sau đăng nhập là phần mã tải lười; phần mã của
// mỗi màn ở đây được "giữ cổng" (vi.mock chờ tới khi test mở cổng) để thấy rõ lúc đang tải. Đi qua App
// với bản bộ nhớ của Kho; không mạng, không DB, đồng hồ cố định.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import type { KetQua } from '../kho/ketQua'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { maDuAnMoi } from '../test/maDuAn'

/** Cổng giữ phần mã của từng màn: khi `dangChan`, màn chỉ nạp xong sau khi test gọi `mo(tenModule)`. */
const cong = vi.hoisted(() => {
  // Không để `src/test/setup.ts` nạp trước các màn: file này tự giữ lúc nạp.
  globalThis.khongNapTruocManTaiLuoi = true
  const moCong = new Map<string, () => void>()
  const choCong = new Map<string, Promise<void>>()
  const lay = (ten: string) => {
    let p = choCong.get(ten)
    if (!p) {
      p = new Promise<void>((xong) => moCong.set(ten, xong))
      choCong.set(ten, p)
    }
    return p
  }
  const trangThai = { dangChan: false, daNap: new Set<string>() }
  return {
    trangThai,
    async giu(ten: string) {
      trangThai.daNap.add(ten)
      if (trangThai.dangChan) await lay(ten)
    },
    mo(ten: string) {
      void lay(ten)
      moCong.get(ten)?.()
    },
  }
})

vi.mock('./ManTongQuan', async (goc) => (await cong.giu('ManTongQuan'), goc()))
vi.mock('./ManDuAn', async (goc) => (await cong.giu('ManDuAn'), goc()))
vi.mock('./ManChiTietDuAn', async (goc) => (await cong.giu('ManChiTietDuAn'), goc()))
vi.mock('./TrangDuAnCuaToi', async (goc) => (await cong.giu('TrangDuAnCuaToi'), goc()))
vi.mock('./TrangViecCaNhan', async (goc) => (await cong.giu('TrangViecCaNhan'), goc()))
vi.mock('./ManNguoiDung', async (goc) => (await cong.giu('ManNguoiDung'), goc()))
vi.mock('./ManHoSo', async (goc) => (await cong.giu('ManHoSo'), goc()))

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

/** Hạn chờ một màn nạp lần đầu (chưa nạp trước), và hạn cho ca mở lần lượt bảy màn như thế. */
const HAN_NAP_MAN = 4000
const HAN_CA_BAY_MAN = 30_000

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function dungKho(): Promise<KhoBoNho> {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const phien = giaTri(await kho.dangNhap({ email: PM.email, matKhau: MAT_KHAU }))
  giaTri(await kho.taoDuAn(phien, { ma: maDuAnMoi(), ten: 'Cửa hàng', moTa: '' }, LUC))
  return kho
}

function vungNoiDung() {
  return screen.getByRole('main')
}

function thanhBen() {
  return within(screen.getByRole('navigation', { name: 'Điều hướng chính' }))
}

/**
 * Ghi lại mọi lúc vùng nội dung trống (không chữ nào) từ giờ tới khi gọi hàm trả về. Đang tải thì vùng
 * nội dung có chữ "Đang tải màn …", nên vùng trống nghĩa là có lúc không có gì để xem.
 */
function theoDoiVungTrong(): () => number {
  let soLanTrong = 0
  const kiem = () => {
    const vung = screen.queryByRole('main')
    if (!vung || (vung.textContent ?? '').trim() === '') soLanTrong += 1
  }
  kiem()
  const quanSat = new MutationObserver(kiem)
  quanSat.observe(document.body, { childList: true, subtree: true, characterData: true })
  return () => {
    quanSat.takeRecords()
    kiem()
    quanSat.disconnect()
    return soLanTrong
  }
}

/**
 * Màn `tenMan` đang tải trong vùng nội dung (Thanh bên vẫn còn), rồi mở cổng của `tenModule` và chờ
 * tiêu đề cấp 2 `tieuDe` của màn hiện ra. Suốt quá trình, vùng nội dung không lúc nào trống.
 */
async function thayDangTaiRoiToiNoiDung(tenMan: string, tenModule: string, tieuDe: string) {
  const ketThuc = theoDoiVungTrong()
  expect(
    await within(vungNoiDung()).findByRole('progressbar', { name: `Đang tải màn ${tenMan}…` }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('heading', { level: 2, name: tieuDe })).not.toBeInTheDocument()
  expect(thanhBen().getByRole('button', { name: 'Tổng quan' })).toBeInTheDocument()

  cong.mo(tenModule)
  // File này không nạp trước các màn (xem `cong`), nên lần nạp đầu có thể lâu khi máy tải nặng.
  expect(
    await within(vungNoiDung()).findByRole('heading', { level: 2, name: tieuDe }, { timeout: HAN_NAP_MAN }),
  ).toBeInTheDocument()
  expect(screen.queryByRole('progressbar', { name: `Đang tải màn ${tenMan}…` })).not.toBeInTheDocument()
  expect(ketThuc()).toBe(0)
}

async function moMuc(user: User, nhan: string) {
  await user.click(thanhBen().getByRole('button', { name: nhan }))
}

describe('chia gói theo màn', () => {
  it('màn trước đăng nhập hiện ngay, không chờ tải; chưa nạp phần mã của màn nào sau đăng nhập', async () => {
    const kho = await dungKho()
    render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => LUC} />)
    // getBy (không chờ): màn Đăng nhập nằm trong gói đầu nên hiện ngay ở lần vẽ đầu.
    expect(screen.getByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect([...cong.trangThai.daNap]).toEqual([])
  })

  it('mỗi màn sau đăng nhập tải lười: thấy đang tải rồi tới nội dung, vùng nội dung không lúc nào trống; Thanh bên vẫn điều hướng đúng', async () => {
    cong.trangThai.dangChan = true
    const kho = await dungKho()
    const user = userEvent.setup()
    render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => LUC} />)
    await user.type(screen.getByLabelText('Email'), PM.email)
    await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })

    await thayDangTaiRoiToiNoiDung('Tổng quan', 'ManTongQuan', 'Tổng quan')

    await moMuc(user, 'Tất cả Dự án')
    await thayDangTaiRoiToiNoiDung('Tất cả Dự án', 'ManDuAn', 'Tất cả Dự án')
    expect(thanhBen().getByRole('button', { name: 'Tất cả Dự án' })).toHaveAttribute('aria-current', 'page')

    await user.click(await within(vungNoiDung()).findByRole('button', { name: 'Cửa hàng' }))
    await thayDangTaiRoiToiNoiDung('Chi tiết Dự án', 'ManChiTietDuAn', 'Cửa hàng')

    await moMuc(user, 'Dự án của tôi')
    await thayDangTaiRoiToiNoiDung('Dự án của tôi', 'TrangDuAnCuaToi', 'Dự án của tôi')

    await moMuc(user, 'Việc của tôi')
    await thayDangTaiRoiToiNoiDung('Việc của tôi', 'TrangViecCaNhan', 'Việc của tôi')

    await moMuc(user, 'Người dùng')
    await thayDangTaiRoiToiNoiDung('Người dùng', 'ManNguoiDung', 'Người dùng')

    await moMuc(user, 'Hồ sơ')
    await thayDangTaiRoiToiNoiDung('Hồ sơ', 'ManHoSo', 'Hồ sơ của tôi')

    // Phần mã đã tải: mở lại màn cũ (và Chờ tôi duyệt, cùng phần mã với Việc của tôi) ra nội dung ngay.
    await moMuc(user, 'Chờ tôi duyệt')
    expect(await screen.findByRole('heading', { level: 2, name: 'Chờ tôi duyệt' })).toBeInTheDocument()
    await moMuc(user, 'Tổng quan')
    expect(await screen.findByRole('heading', { level: 2, name: 'Tổng quan' })).toBeInTheDocument()
    expect(thanhBen().getByRole('button', { name: 'Tổng quan' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('progressbar', { name: /^Đang tải màn/ })).not.toBeInTheDocument()
  }, HAN_CA_BAY_MAN)
})
