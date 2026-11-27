// @vitest-environment jsdom
// Tìm và lọc Dự án (ticket truong-moi 07): bảng tám cột ở "Tất cả Dự án" và "Dự án của tôi" (một bảng dùng
// chung), ô tìm theo tên hoặc Mã, bộ lọc Mức ưu tiên, Người phụ trách, tình trạng, và trạng thái trống có
// nút bỏ lọc. Dựng thẳng trang với bản bộ nhớ (không qua màn đăng nhập) để test gọn.
import type { ReactNode } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from '../astryx-themes'
import type { KetQua } from '../kho/ketQua'
import type { DuAn, Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { KhoContext } from './khoContext'
import { ManDuAn } from './ManDuAn'
import { TrangDuAnCuaToi } from './TrangDuAnCuaToi'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-03-01T08:00:00+07:00')
/** Hôm nay 26/11/2026 theo giờ Việt Nam: đồng hồ truyền vào trang. */
const HOM_NAY = new Date('2026-11-26T09:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

/**
 * Ba Dự án: "Cổng Hà Nội" (Cao, Bình phụ trách, kết thúc 20/11 nên Quá hạn dự kiến), "Kho Đà Nẵng" (Thấp,
 * Chi phụ trách, một Task Trễ hạn), "Website Hà Tĩnh" (Cao, Chi phụ trách). Bình và Chi ở cả ba Dự án.
 */
async function dungDuLieu() {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const pm = giaTri(await kho.dangNhap({ email: PM.email, matKhau: MAT_KHAU }))
  const id: Record<string, string> = {}
  for (const [email, ten] of [
    ['binh@vi-du.vn', 'Bình'],
    ['chi@vi-du.vn', 'Chi'],
  ]) {
    id[email] = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten })).id
    await kho.moPhong.xacNhanEmail(email)
  }
  async function taoDuAn(dauVao: Parameters<KhoBoNho['taoDuAn']>[1], phuTrach: string): Promise<DuAn> {
    const duAn = giaTri(await kho.taoDuAn(pm, dauVao, LUC_TAO))
    for (const email of Object.keys(id)) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email }))
    giaTri(await kho.suaDuAn(pm, duAn.id, { nguoiPhuTrachId: id[phuTrach] }, LUC_TAO))
    return duAn
  }
  await taoDuAn(
    { ma: 'SDV-012', ten: 'Cổng Hà Nội', khachHang: 'Sở Xây dựng', mucUuTien: 'CAO', ngayKetThucDuKien: '2026-11-20' },
    'binh@vi-du.vn',
  )
  const daNang = await taoDuAn({ ma: 'DN-1', ten: 'Kho Đà Nẵng', mucUuTien: 'THAP' }, 'chi@vi-du.vn')
  await taoDuAn({ ma: 'HT-1', ten: 'Website Hà Tĩnh', mucUuTien: 'CAO' }, 'chi@vi-du.vn')
  const giao = { nguoiThucHienId: id['binh@vi-du.vn'], nguoiKiemTraId: id['chi@vi-du.vn'] }
  giaTri(await kho.taoTask(pm, daNang.id, { tieuDe: 'Kiểm kho', han: '2026-11-01', ...giao }, LUC_TAO))
  return { kho, pm }
}

function dung(kho: KhoBoNho, noiDung: ReactNode) {
  const user = userEvent.setup()
  render(
    <Theme theme={themes[defaultThemeSlug]} mode="light">
      <KhoContext value={kho}>{noiDung}</KhoContext>
    </Theme>,
  )
  return user
}

const dongHo = () => HOM_NAY
const boQua = () => {}

/** Tên các Dự án đang hiện trong bảng (nút mở ở cột Tên), theo thứ tự trên bảng. */
async function tenTrongBang(tenBang: string): Promise<string[]> {
  const bang = await screen.findByRole('table', { name: tenBang })
  return within(bang)
    .getAllByRole('button')
    .map((nut) => nut.textContent ?? '')
    .sort((a, b) => a.localeCompare(b, 'vi'))
}

async function chonLoc(user: User, nhan: string, lua: string) {
  await user.click(screen.getByRole('combobox', { name: new RegExp(`^${nhan}`) }))
  await user.click(await screen.findByRole('option', { name: lua }))
}

async function tim(user: User, tuKhoa: string) {
  const o = screen.getByRole('searchbox', { name: 'Tìm Dự án' })
  await user.clear(o)
  await user.click(o)
  await user.paste(tuKhoa)
}

describe('Tất cả Dự án: bảng, tìm và lọc', () => {
  it('bảng hiện đủ tám cột với số liệu; gõ ô tìm và chọn bộ lọc làm bảng chỉ còn Dự án khớp', async () => {
    const { kho, pm } = await dungDuLieu()
    const user = dung(kho, <ManDuAn phien={pm} vai="PM" dongHo={dongHo} onHetPhien={boQua} />)
    const bang = await screen.findByRole('table', { name: 'Danh sách Dự án' })

    expect(within(bang).getAllByRole('columnheader').map((o) => o.textContent)).toEqual([
      'Mã',
      'Tên',
      'Khách hàng',
      'Người phụ trách',
      'Mức ưu tiên',
      'Ngày kết thúc dự kiến',
      'Tiến độ',
      'Trễ hạn',
    ])
    const dongHaNoi = within(within(bang).getByRole('button', { name: 'Cổng Hà Nội' }).closest('tr') as HTMLElement)
    for (const chu of ['SDV-012', 'Sở Xây dựng', 'Bình', 'Cao', '20/11/2026', 'chưa có task', '0', 'Quá hạn dự kiến']) {
      expect(dongHaNoi.getByText(chu)).toBeInTheDocument()
    }
    const dongDaNang = within(within(bang).getByRole('button', { name: 'Kho Đà Nẵng' }).closest('tr') as HTMLElement)
    for (const chu of ['DN-1', 'Chi', 'Thấp', 'Chưa có', '0%', '1']) expect(dongDaNang.getByText(chu)).toBeInTheDocument()

    // Tìm không dấu, không phân biệt hoa thường; theo Mã.
    await tim(user, 'ha noi')
    expect(await tenTrongBang('Danh sách Dự án')).toEqual(['Cổng Hà Nội'])
    await tim(user, 'dn')
    expect(await tenTrongBang('Danh sách Dự án')).toEqual(['Kho Đà Nẵng'])

    // Tìm "hà" kết hợp hai bộ lọc: Cao, rồi Người phụ trách Chi.
    await tim(user, 'hà')
    expect(await tenTrongBang('Danh sách Dự án')).toEqual(['Cổng Hà Nội', 'Website Hà Tĩnh'])
    await chonLoc(user, 'Mức ưu tiên', 'Cao')
    await chonLoc(user, 'Người phụ trách', 'Chi')
    await waitFor(async () => expect(await tenTrongBang('Danh sách Dự án')).toEqual(['Website Hà Tĩnh']))
  })

  it('không Dự án nào khớp thì hiện trạng thái trống có nút bỏ lọc; bấm thì hiện lại toàn bộ', async () => {
    const { kho, pm } = await dungDuLieu()
    const user = dung(kho, <ManDuAn phien={pm} vai="PM" dongHo={dongHo} onHetPhien={boQua} />)
    await screen.findByRole('table', { name: 'Danh sách Dự án' })

    await user.click(screen.getByRole('radio', { name: 'Quá hạn dự kiến' }))
    expect(await tenTrongBang('Danh sách Dự án')).toEqual(['Cổng Hà Nội'])
    await chonLoc(user, 'Mức ưu tiên', 'Thấp')
    expect(await screen.findByRole('heading', { name: 'Không có Dự án nào khớp.' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Danh sách Dự án' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Bỏ lọc' }))
    expect(await tenTrongBang('Danh sách Dự án')).toEqual(['Cổng Hà Nội', 'Kho Đà Nẵng', 'Website Hà Tĩnh'])
    expect(screen.getByRole('radio', { name: 'Tất cả' })).toBeChecked()
  })
})

describe('Dự án của tôi: cùng bảng, tìm và lọc', () => {
  it('Người trong dự án thấy tám cột; tìm không khớp thì trạng thái trống, bỏ lọc thì hiện lại toàn bộ', async () => {
    const { kho } = await dungDuLieu()
    const chi: Phien = giaTri(await kho.dangNhap({ email: 'chi@vi-du.vn', matKhau: MAT_KHAU }))
    const user = dung(kho, <TrangDuAnCuaToi phien={chi} vai="THANH_VIEN" dongHo={dongHo} onHetPhien={boQua} />)
    const bang = await screen.findByRole('table', { name: 'Dự án của tôi' })
    expect(within(bang).getAllByRole('columnheader')).toHaveLength(8)
    expect(await tenTrongBang('Dự án của tôi')).toEqual(['Cổng Hà Nội', 'Kho Đà Nẵng', 'Website Hà Tĩnh'])

    await tim(user, 'sdv')
    expect(await tenTrongBang('Dự án của tôi')).toEqual(['Cổng Hà Nội'])
    await tim(user, 'khong co du an nay')
    expect(await screen.findByRole('heading', { name: 'Không có Dự án nào khớp.' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Bỏ lọc' }))
    expect(await tenTrongBang('Dự án của tôi')).toEqual(['Cổng Hà Nội', 'Kho Đà Nẵng', 'Website Hà Tĩnh'])
    expect(screen.getByRole('searchbox', { name: 'Tìm Dự án' })).toHaveValue('')
  })
})
