// @vitest-environment jsdom
// Tổng quan xếp dọc một cột (ticket sap-xep-giao-dien 01): thứ tự các vùng, vùng Task trống chỉ còn một dòng
// chữ (không bảng), mỗi vùng Task tối đa 5 dòng kèm nút "Xem tất cả (N)". Dựng thẳng màn với bản bộ nhớ
// (không qua màn đăng nhập); ngày hôm nay truyền vào, không đọc đồng hồ thật.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { themes, defaultThemeSlug } from '../astryx-themes'
import type { KetQua } from '../kho/ketQua'
import type { Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { choNganTruot, dongNganTruot } from '../test/khungUngDung'
import { KhoContext } from './khoContext'
import { ManTongQuan } from './ManTongQuan'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-03-01T08:00:00+07:00')
/** Hôm nay 26/11/2026 theo giờ Việt Nam: hạn trước 26/11 là Trễ hạn, hạn 26/11 đến 03/12 là tới hạn. */
const HOM_NAY = new Date('2026-11-26T09:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

const TRE_HAN = 'Task Trễ hạn'
const TOI_HAN = 'Task tới hạn trong 7 ngày'

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

/**
 * Một Dự án "Cửa hàng" (Bình thực hiện, Chi kiểm tra) với `soTre` Task Trễ hạn (hạn 01/11, 02/11...: trễ
 * lâu nhất đứng đầu, nên "Trễ 1" đứng đầu) và `soToi` Task tới hạn (hạn 26/11, 27/11...).
 */
async function dungDuLieu(soTre: number, soToi: number) {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const pm = giaTri(await kho.dangNhap({ email: PM.email, matKhau: MAT_KHAU }))
  const id: Record<'binh' | 'chi', string> = { binh: '', chi: '' }
  for (const ten of ['binh', 'chi'] as const) {
    const email = `${ten}@vi-du.vn`
    id[ten] = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten === 'binh' ? 'Bình' : 'Chi' })).id
    await kho.moPhong.xacNhanEmail(email)
  }
  const duAn = giaTri(await kho.taoDuAn(pm, { ma: 'CH-1', ten: 'Cửa hàng' }, LUC_TAO))
  for (const ten of ['binh', 'chi']) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: `${ten}@vi-du.vn` }))
  const tao = async (tieuDe: string, han: string) =>
    giaTri(
      await kho.taoTask(pm, duAn.id, { tieuDe, han, nguoiThucHienId: id.binh, nguoiKiemTraId: id.chi }, LUC_TAO),
    )
  for (let i = 1; i <= soTre; i++) await tao(`Trễ ${i}`, `2026-11-0${i}`)
  const hanToi = ['2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-01']
  for (let i = 1; i <= soToi; i++) await tao(`Tới hạn ${i}`, hanToi[i - 1] ?? '2026-12-02')
  return { kho, pm }
}

function dung(kho: KhoBoNho, phien: Phien) {
  const user = userEvent.setup()
  render(
    <Theme theme={themes[defaultThemeSlug]} mode="light">
      <KhoContext value={kho}>
        <ManTongQuan phien={phien} vai="PM" dongHo={() => HOM_NAY} onMoTrang={() => {}} onHetPhien={() => {}} />
      </KhoContext>
    </Theme>,
  )
  return user
}

/** Vùng Task có tiêu đề `ten` (ô số "Task Trễ hạn" cũng là một nhóm cùng tên, nên chọn nhóm có tiêu đề). */
async function vung(ten: string) {
  await screen.findByRole('heading', { level: 3, name: ten })
  const nhom = screen
    .getAllByRole('group', { name: ten })
    .find((g) => within(g).queryByRole('heading', { level: 3, name: ten }))
  if (!nhom) throw new Error(`Không thấy vùng ${ten}`)
  return within(nhom)
}

/** Tiêu đề các Task đang hiện trong bảng của vùng `ten`, theo thứ tự dòng. */
async function taskTrongVung(ten: string) {
  const bang = (await vung(ten)).getByRole('table', { name: ten })
  return within(bang)
    .getAllByRole('row')
    .slice(1)
    .map((dong) => within(dong).getAllByRole('cell')[0]?.textContent)
}

const dsTask = (tien: string, so: number) => Array.from({ length: so }, (_, i) => `${tien} ${i + 1}`)

describe('Tổng quan xếp dọc một cột', () => {
  it('hàng ô số đứng đầu, rồi Task Trễ hạn, Task tới hạn trong 7 ngày, Dự án đang hoạt động, Phân bố', async () => {
    const { kho, pm } = await dungDuLieu(2, 2)
    dung(kho, pm)
    await screen.findByRole('table', { name: 'Bảng Dự án đang hoạt động' })

    const thuTu = [TRE_HAN, TOI_HAN, 'Dự án đang hoạt động', 'Phân bố Task theo trạng thái']
    const tieuDe = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
      .filter((t): t is string => t !== null && thuTu.includes(t))
    expect(tieuDe).toEqual(thuTu)

    const oSo = screen.getByRole('group', { name: 'Số liệu chính' })
    const dauTien = screen.getByRole('heading', { level: 3, name: TRE_HAN })
    expect(oSo.compareDocumentPosition(dauTien) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('không có Task Trễ hạn hay tới hạn: mỗi vùng giữ tiêu đề, mô tả và một dòng báo trống, không có bảng', async () => {
    const { kho, pm } = await dungDuLieu(0, 0)
    dung(kho, pm)

    const tre = await vung(TRE_HAN)
    expect(tre.getByText('Hạn đã qua mà chưa Hoàn thành, chưa Huỷ; trễ lâu nhất đứng đầu.')).toBeInTheDocument()
    expect(tre.getByText('Không có Task Trễ hạn.')).toBeInTheDocument()
    expect(tre.queryByRole('table')).not.toBeInTheDocument()
    expect(tre.queryByRole('columnheader')).not.toBeInTheDocument()

    const toi = await vung(TOI_HAN)
    expect(toi.getByText(/^Chưa Hoàn thành, chưa Huỷ, hạn từ hôm nay/)).toBeInTheDocument()
    expect(toi.getByText('Không có Task tới hạn trong 7 ngày.')).toBeInTheDocument()
    expect(toi.queryByRole('table')).not.toBeInTheDocument()
    expect(toi.queryByRole('columnheader')).not.toBeInTheDocument()
  })

  it('chỉ một vùng trống: vùng có Task vẫn có bảng (Task, Dự án, Người thực hiện, hạn) và bấm Task mở Ngăn trượt', async () => {
    const { kho, pm } = await dungDuLieu(2, 0)
    const user = dung(kho, pm)

    const tre = await vung(TRE_HAN)
    const bang = tre.getByRole('table', { name: TRE_HAN })
    expect(within(bang).getAllByRole('columnheader').map((o) => o.textContent)).toEqual([
      'Task',
      'Mã Dự án',
      'Dự án',
      'Người thực hiện',
      'Hạn',
    ])
    expect(
      within(bang)
        .getAllByRole('row')
        .slice(1)
        .map((dong) => within(dong).getAllByRole('cell').map((o) => o.textContent)),
    ).toEqual([
      ['Trễ 1', 'CH-1', 'Cửa hàng', 'Bình', '01/11/2026'],
      ['Trễ 2', 'CH-1', 'Cửa hàng', 'Bình', '02/11/2026'],
    ])
    expect((await vung(TOI_HAN)).queryByRole('table')).not.toBeInTheDocument()

    await user.click(within(bang).getByRole('button', { name: 'Trễ 1' }))
    const ngan = within(await choNganTruot('Trễ 1'))
    expect(ngan.getByRole('heading', { level: 2, name: 'Trễ 1' })).toBeInTheDocument()
    await dongNganTruot(user)
    expect(screen.getByRole('heading', { level: 2, name: 'Tổng quan' })).toBeInTheDocument()
  })

  it('7 Task Trễ hạn: hiện 5 đầu và "Xem tất cả (7)"; bấm thì hiện đủ 7, nút mất, vùng tới hạn không đổi', async () => {
    const { kho, pm } = await dungDuLieu(7, 6)
    const user = dung(kho, pm)

    expect(await taskTrongVung(TRE_HAN)).toEqual(dsTask('Trễ', 5))
    expect(await taskTrongVung(TOI_HAN)).toEqual(dsTask('Tới hạn', 5))
    const tre = await vung(TRE_HAN)
    expect(tre.queryByRole('button', { name: 'Trễ 6' })).not.toBeInTheDocument()

    await user.click(tre.getByRole('button', { name: 'Xem tất cả (7)' }))

    expect(await taskTrongVung(TRE_HAN)).toEqual(dsTask('Trễ', 7))
    expect(tre.queryByRole('button', { name: /^Xem tất cả/ })).not.toBeInTheDocument()
    // Vùng tới hạn vẫn 5 dòng và vẫn còn nút của nó.
    expect(await taskTrongVung(TOI_HAN)).toEqual(dsTask('Tới hạn', 5))
    expect((await vung(TOI_HAN)).getByRole('button', { name: 'Xem tất cả (6)' })).toBeInTheDocument()
  })

  it('vùng tới hạn có 6 Task cũng theo luật 5 dòng; bấm "Xem tất cả (6)" hiện đủ, vùng Trễ hạn không đổi', async () => {
    const { kho, pm } = await dungDuLieu(7, 6)
    const user = dung(kho, pm)

    await user.click((await vung(TOI_HAN)).getByRole('button', { name: 'Xem tất cả (6)' }))
    expect(await taskTrongVung(TOI_HAN)).toEqual(dsTask('Tới hạn', 6))
    expect((await vung(TOI_HAN)).queryByRole('button', { name: /^Xem tất cả/ })).not.toBeInTheDocument()
    expect(await taskTrongVung(TRE_HAN)).toEqual(dsTask('Trễ', 5))
    expect((await vung(TRE_HAN)).getByRole('button', { name: 'Xem tất cả (7)' })).toBeInTheDocument()
  })

  it('vùng có đúng 5 Task hoặc ít hơn thì hiện đủ, không có nút "Xem tất cả"', async () => {
    const { kho, pm } = await dungDuLieu(5, 3)
    dung(kho, pm)

    expect(await taskTrongVung(TRE_HAN)).toEqual(dsTask('Trễ', 5))
    expect(await taskTrongVung(TOI_HAN)).toEqual(dsTask('Tới hạn', 3))
    expect(screen.queryByRole('button', { name: /^Xem tất cả/ })).not.toBeInTheDocument()
  })

  it('rời Tổng quan (mở một Dự án) rồi quay lại thì vùng đã mở hết về lại 5 dòng', async () => {
    const { kho, pm } = await dungDuLieu(7, 0)
    const user = dung(kho, pm)

    await user.click((await vung(TRE_HAN)).getByRole('button', { name: 'Xem tất cả (7)' }))
    expect(await taskTrongVung(TRE_HAN)).toEqual(dsTask('Trễ', 7))

    const bangDuAn = await screen.findByRole('table', { name: 'Bảng Dự án đang hoạt động' })
    await user.click(within(bangDuAn).getByRole('button', { name: 'Cửa hàng' }))
    await user.click(await screen.findByRole('button', { name: 'Về danh sách Dự án' }))

    expect(await taskTrongVung(TRE_HAN)).toEqual(dsTask('Trễ', 5))
    expect((await vung(TRE_HAN)).getByRole('button', { name: 'Xem tất cả (7)' })).toBeInTheDocument()
  })
})
