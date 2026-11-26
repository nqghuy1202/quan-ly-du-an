// @vitest-environment jsdom
// Tổng quan thêm số liệu Dự án (ticket truong-moi 08): ô số "Dự án Quá hạn dự kiến", Mã và nhãn Quá hạn
// dự kiến trên đúng dòng bảng Dự án đang hoạt động, dấu "chưa có Người phụ trách" chỉ cho PM và Support.
// Dựng thẳng màn với bản bộ nhớ (không qua màn đăng nhập) để test gọn; ngày hôm nay truyền vào.
import { render, screen, within } from '@testing-library/react'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from '../astryx-themes'
import type { KetQua } from '../kho/ketQua'
import type { Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import type { VaiHeThong } from '../luat/taiKhoan'
import { KhoContext } from './khoContext'
import { ManTongQuan } from './ManTongQuan'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-03-01T08:00:00+07:00')
/** Hôm nay 26/11/2026 theo giờ Việt Nam. */
const HOM_NAY = new Date('2026-11-26T09:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

/**
 * Ba Dự án, Bình (Thành viên) và Chi (Support) ở cả ba: "Cổng Hà Nội" (SDV-012, kết thúc 20/11 nên Quá hạn
 * dự kiến, Bình phụ trách), "Kho Đà Nẵng" (DN-1, chưa có Người phụ trách, không ngày kết thúc) và "Cũ"
 * (LT-1, kết thúc 01/11, chưa có Người phụ trách, đã Lưu trữ: không hiện, không đếm).
 */
async function dungDuLieu() {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const pm = giaTri(await kho.dangNhap({ email: PM.email, matKhau: MAT_KHAU }))
  const phien: Record<'binh' | 'chi', Phien> = {} as Record<'binh' | 'chi', Phien>
  for (const [ten, vai] of [
    ['binh', 'THANH_VIEN'],
    ['chi', 'SUPPORT'],
  ] as const) {
    const email = `${ten}@vi-du.vn`
    const hoSo = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten === 'binh' ? 'Bình' : 'Chi' }))
    await kho.moPhong.xacNhanEmail(email)
    if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, hoSo.id, { vai }))
    phien[ten] = giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
  }
  async function taoDuAn(dauVao: Parameters<KhoBoNho['taoDuAn']>[1]) {
    const duAn = giaTri(await kho.taoDuAn(pm, dauVao, LUC_TAO))
    for (const email of ['binh@vi-du.vn', 'chi@vi-du.vn']) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email }))
    return duAn
  }
  const haNoi = await taoDuAn({ ma: 'SDV-012', ten: 'Cổng Hà Nội', ngayKetThucDuKien: '2026-11-20' })
  giaTri(await kho.suaDuAn(pm, haNoi.id, { nguoiPhuTrachId: phien.binh.nguoiDungId }, LUC_TAO))
  await taoDuAn({ ma: 'DN-1', ten: 'Kho Đà Nẵng' })
  const cu = await taoDuAn({ ma: 'LT-1', ten: 'Cũ', ngayKetThucDuKien: '2026-11-01' })
  giaTri(await kho.luuTruDuAn(pm, cu.id, LUC_TAO))
  return { kho, pm, ...phien }
}

const boQua = () => {}

function dung(kho: KhoBoNho, phien: Phien, vai: VaiHeThong) {
  return render(
    <Theme theme={themes[defaultThemeSlug]} mode="light">
      <KhoContext value={kho}>
        <ManTongQuan phien={phien} vai={vai} dongHo={() => HOM_NAY} onMoTrang={boQua} onHetPhien={boQua} />
      </KhoContext>
    </Theme>,
  )
}

/** Ô của dòng Dự án `ten` trong bảng Dự án đang hoạt động. */
async function dongDuAn(ten: string) {
  const bang = await screen.findByRole('table', { name: 'Bảng Dự án đang hoạt động' })
  const dong = within(bang).getByRole('button', { name: ten }).closest('tr')
  if (!dong) throw new Error(`Không thấy dòng của Dự án ${ten}`)
  return within(dong)
}

describe('Tổng quan: số liệu Dự án', () => {
  it('PM thấy ô số Dự án Quá hạn dự kiến (Lưu trữ không đếm), Mã và nhãn Quá hạn dự kiến trên đúng dòng, dấu chưa có Người phụ trách', async () => {
    const { kho, pm } = await dungDuLieu()
    dung(kho, pm, 'PM')

    const hang = await screen.findByRole('group', { name: 'Số liệu chính' })
    const o = within(hang).getByRole('group', { name: 'Dự án Quá hạn dự kiến' })
    expect(within(o).getByText(/^\d+$/)).toHaveTextContent(/^1$/)

    const haNoi = await dongDuAn('Cổng Hà Nội')
    expect(haNoi.getByText('SDV-012')).toBeInTheDocument()
    expect(haNoi.getByText('Quá hạn dự kiến')).toBeInTheDocument()
    expect(haNoi.queryByText('Chưa có Người phụ trách')).not.toBeInTheDocument()

    const daNang = await dongDuAn('Kho Đà Nẵng')
    expect(daNang.getByText('DN-1')).toBeInTheDocument()
    expect(daNang.queryByText('Quá hạn dự kiến')).not.toBeInTheDocument()
    expect(daNang.getByText('Chưa có Người phụ trách')).toBeInTheDocument()

    expect(screen.queryByRole('button', { name: 'Cũ' })).not.toBeInTheDocument()
  })

  it('Support thấy dấu chưa có Người phụ trách; Thành viên không thấy dấu này nhưng vẫn thấy nhãn Quá hạn dự kiến', async () => {
    const { kho, binh, chi } = await dungDuLieu()
    const support = dung(kho, chi, 'SUPPORT')
    expect((await dongDuAn('Kho Đà Nẵng')).getByText('Chưa có Người phụ trách')).toBeInTheDocument()
    expect((await dongDuAn('Cổng Hà Nội')).queryByText('Chưa có Người phụ trách')).not.toBeInTheDocument()
    support.unmount()

    dung(kho, binh, 'THANH_VIEN')
    expect((await dongDuAn('Cổng Hà Nội')).getByText('Quá hạn dự kiến')).toBeInTheDocument()
    expect((await dongDuAn('Kho Đà Nẵng')).getByText('DN-1')).toBeInTheDocument()
    expect(screen.queryByText('Chưa có Người phụ trách')).not.toBeInTheDocument()
    const o = within(screen.getByRole('group', { name: 'Số liệu chính' })).getByRole('group', {
      name: 'Dự án Quá hạn dự kiến',
    })
    expect(within(o).getByText(/^\d+$/)).toHaveTextContent(/^1$/)
  })
})
