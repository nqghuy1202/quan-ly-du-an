// @vitest-environment jsdom
// Tìm và lọc ở "Việc của tôi" và "Chờ tôi duyệt" (ticket sap-xep-giao-dien 02): ô tìm, chip Trạng thái
// (chỉ Việc của tôi), chip Mức ưu tiên, chip Trễ hạn, dòng "Hiện X trên Y Task", báo trống khi lọc kèm
// Xoá bộ lọc, giữ bộ lọc qua Ngăn trượt, về trống khi đổi trang. Dựng thẳng trang với bản bộ nhớ (không qua
// màn đăng nhập) để test gọn; riêng việc đổi trang đi qua cả ứng dụng.
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Theme } from '@astryxdesign/core/theme'
import { App } from '../App'
import { themes, defaultThemeSlug } from '../astryx-themes'
import { taoCongKhongKhaDung } from '../github/congKhongKhaDung'
import { thatBai, type KetQua } from '../kho/ketQua'
import type { KhoDuLieu, Phien } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import type { MucUuTien } from '../luat/mucUuTien'
import type { TrangThaiTask } from '../luat/task'
import { choNganTruot, choTongQuanTaiXong, dongNganTruot } from '../test/khungUngDung'
import { CongGitHubContext } from './congGitHubContext'
import { KhoContext } from './khoContext'
import { TrangViecCaNhan, type LoaiViecCaNhan } from './TrangViecCaNhan'

const MAT_KHAU = 'matkhau-123'
const LUC_TAO = new Date('2026-03-01T08:00:00+07:00')
/** Đồng hồ ứng dụng: 10:00 ngày 26/11/2026 giờ Việt Nam, nên hạn 25/11 đã Trễ hạn, hạn 26/11 thì chưa. */
const BAY_GIO = new Date('2026-11-26T10:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'Huy PM' }

type User = ReturnType<typeof userEvent.setup>

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(kq.loi.thongBao)
  return kq.giaTri
}

async function phienCua(kho: KhoDuLieu, email: string): Promise<Phien> {
  return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
}

/**
 * Hai Dự án: AMS ("Quản lý tài sản") và SDV-012 ("Cổng Hà Nội"); An, Bình, Chi ở cả hai.
 *
 * Việc của An (Bình kiểm tra): Mới 2, Đang làm 1, Chờ duyệt 1, Trả lại 1, Bị lỗi 0; Thấp 1, Trung bình 1,
 * Cao 3; Trễ hạn 2. Chờ Bình duyệt: ba Task (Thấp 1, Trung bình 0, Cao 2; Trễ hạn 1).
 */
async function dungDuLieu(): Promise<KhoBoNho> {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const pm = await phienCua(kho, PM.email)
  const id: Record<string, string> = {}
  for (const [ten, email] of [
    ['An', 'an@vi-du.vn'],
    ['Bình', 'binh@vi-du.vn'],
    ['Chi', 'chi@vi-du.vn'],
  ]) {
    id[ten] = giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten })).id
    await kho.moPhong.xacNhanEmail(email)
  }
  const duAn: Record<string, string> = {}
  for (const [ma, ten] of [
    ['AMS', 'Quản lý tài sản'],
    ['SDV-012', 'Cổng Hà Nội'],
  ]) {
    duAn[ma] = giaTri(await kho.taoDuAn(pm, { ma, ten }, LUC_TAO)).id
    for (const email of ['an@vi-du.vn', 'binh@vi-du.vn', 'chi@vi-du.vn']) {
      giaTri(await kho.themNguoiVaoDuAn(pm, duAn[ma], { email }))
    }
  }
  async function task(
    ma: string,
    tieuDe: string,
    trangThai: TrangThaiTask,
    mucUuTien: MucUuTien,
    han: string | null,
    thucHien = 'An',
  ) {
    const t = giaTri(
      await kho.taoTask(
        pm,
        duAn[ma],
        { tieuDe, han, mucUuTien, nguoiThucHienId: id[thucHien], nguoiKiemTraId: id['Bình'] },
        LUC_TAO,
      ),
    )
    if (trangThai !== 'MOI') giaTri(await kho.chuDuAn.datTrangThaiTask(t.id, trangThai))
  }
  await task('AMS', '[Khớp mã trạng thái DVC] 01', 'MOI', 'CAO', '2026-11-20')
  await task('AMS', 'Sửa báo cáo tồn kho', 'TRA_LAI', 'CAO', '2026-11-26')
  await task('AMS', 'Viết tài liệu', 'DANG_LAM', 'THAP', null)
  await task('SDV-012', 'Đồng bộ DVC', 'MOI', 'TRUNG_BINH', '2026-11-25')
  await task('SDV-012', 'Duyệt giao diện', 'CHO_DUYET', 'CAO', null)
  await task('SDV-012', 'Kiểm thử đăng nhập', 'CHO_DUYET', 'THAP', '2026-11-01', 'Chi')
  await task('AMS', 'Duyệt hợp đồng', 'CHO_DUYET', 'CAO', null, 'Chi')
  return kho
}

const TEN_TRANG: Record<LoaiViecCaNhan, string> = { viecCuaToi: 'Việc của tôi', choToiDuyet: 'Chờ tôi duyệt' }

/** Dựng thẳng một trang cá nhân cho người có `email` (đọc qua `kho`, mặc định chính bản bộ nhớ). */
async function dungTrang(goc: KhoBoNho, email: string, loai: LoaiViecCaNhan, kho: KhoDuLieu = goc) {
  const phien = await phienCua(goc, email)
  const user = userEvent.setup()
  render(
    <Theme theme={themes[defaultThemeSlug]} mode="light">
      <KhoContext value={kho}>
        <CongGitHubContext value={taoCongKhongKhaDung()}>
          <TrangViecCaNhan
            loai={loai}
            phien={phien}
            vai={email === PM.email ? 'PM' : 'THANH_VIEN'}
            dongHo={() => BAY_GIO}
            onHetPhien={() => {}}
          />
        </CongGitHubContext>
      </KhoContext>
    </Theme>,
  )
  return user
}

/** Dựng trang cá nhân và chờ bảng Task hiện. */
async function moTrang(goc: KhoBoNho, email: string, loai: LoaiViecCaNhan) {
  const user = await dungTrang(goc, email, loai)
  await screen.findByRole('table', { name: TEN_TRANG[loai] })
  return user
}

/** Tiêu đề các Task đang hiện trong bảng, theo thứ tự trên bảng. */
function tieuDeTrongBang(ten: string): string[] {
  return within(screen.getByRole('table', { name: ten }))
    .getAllByRole('button')
    .map((nut) => nut.textContent ?? '')
}

function oTim() {
  return screen.getByRole('searchbox', { name: 'Tìm Task' })
}

async function tim(user: User, tuKhoa: string) {
  await user.clear(oTim())
  await user.click(oTim())
  await user.paste(tuKhoa)
}

/** Tên các chip (theo thứ tự) trong một nhóm chip. */
function tenChip(nhom: string): string[] {
  return within(screen.getByRole('group', { name: nhom }))
    .getAllByRole('button')
    .map((nut) => nut.getAttribute('aria-label') ?? nut.textContent ?? '')
}

const chip = (ten: string) => screen.getByRole('button', { name: ten })

/** Thứ tự của luật xếp việc cá nhân: theo tên Dự án ("Cổng Hà Nội" trước), rồi hạn gần trước, rồi tiêu đề. */
const VIEC_CUA_AN = [
  'Đồng bộ DVC',
  'Duyệt giao diện',
  '[Khớp mã trạng thái DVC] 01',
  'Sửa báo cáo tồn kho',
  'Viết tài liệu',
]

describe('Việc của tôi: tìm và lọc', () => {
  it('có ô tìm có nhãn và ba nhóm chip kèm số; gõ tìm hay bật chip thì bảng chỉ còn Task khớp; chip bật báo aria-pressed', async () => {
    const kho = await dungDuLieu()
    const user = await moTrang(kho, 'an@vi-du.vn', 'viecCuaToi')

    expect(oTim()).toHaveValue('')
    expect(tenChip('Lọc theo Trạng thái')).toEqual([
      'Mới (2)',
      'Đang làm (1)',
      'Chờ duyệt (1)',
      'Trả lại (1)',
      'Bị lỗi (0)',
    ])
    expect(tenChip('Lọc theo Mức ưu tiên')).toEqual(['Thấp (1)', 'Trung bình (1)', 'Cao (3)'])
    expect(chip('Trễ hạn (2)')).toHaveAttribute('aria-pressed', 'false')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(VIEC_CUA_AN)

    // Tìm không dấu, không phân biệt hoa thường: tiêu đề, rồi Mã Dự án, rồi tên Dự án.
    await tim(user, 'khop ma')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(['[Khớp mã trạng thái DVC] 01'])
    await tim(user, 'ams')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual([
      '[Khớp mã trạng thái DVC] 01',
      'Sửa báo cáo tồn kho',
      'Viết tài liệu',
    ])
    await tim(user, '  ha noi ')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(['Đồng bộ DVC', 'Duyệt giao diện'])
    await user.clear(oTim())
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(VIEC_CUA_AN)

    // Bật chip Mới; bấm lần nữa thì tắt.
    expect(chip('Mới (2)')).toHaveAttribute('aria-pressed', 'false')
    await user.click(chip('Mới (2)'))
    expect(chip('Mới (2)')).toHaveAttribute('aria-pressed', 'true')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(['Đồng bộ DVC', '[Khớp mã trạng thái DVC] 01'])
    await user.click(chip('Mới (2)'))
    expect(chip('Mới (2)')).toHaveAttribute('aria-pressed', 'false')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(VIEC_CUA_AN)

    // Chip Trễ hạn theo luật Trễ hạn tại đồng hồ truyền vào (hạn hôm nay chưa trễ).
    await user.click(chip('Trễ hạn (2)'))
    expect(chip('Trễ hạn (2)')).toHaveAttribute('aria-pressed', 'true')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(['Đồng bộ DVC', '[Khớp mã trạng thái DVC] 01'])
  })

  it('"hoặc" trong nhóm, "và" giữa các nhóm và với ô tìm; số trên chip không đổi; thứ tự giữ như cũ', async () => {
    const kho = await dungDuLieu()
    const user = await moTrang(kho, 'an@vi-du.vn', 'viecCuaToi')

    await user.click(chip('Mới (2)'))
    await user.click(chip('Trả lại (1)'))
    expect(tieuDeTrongBang('Việc của tôi')).toEqual([
      'Đồng bộ DVC',
      '[Khớp mã trạng thái DVC] 01',
      'Sửa báo cáo tồn kho',
    ])
    await user.click(chip('Cao (3)'))
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(['[Khớp mã trạng thái DVC] 01', 'Sửa báo cáo tồn kho'])
    await tim(user, 'DVC')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(['[Khớp mã trạng thái DVC] 01'])
    expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Hiện 1 trên 5 Task')

    // Số trên chip đếm trên toàn danh sách đã đọc.
    expect(tenChip('Lọc theo Trạng thái')).toEqual([
      'Mới (2)',
      'Đang làm (1)',
      'Chờ duyệt (1)',
      'Trả lại (1)',
      'Bị lỗi (0)',
    ])
    expect(tenChip('Lọc theo Mức ưu tiên')).toEqual(['Thấp (1)', 'Trung bình (1)', 'Cao (3)'])
  })

  it('chip số 0 hiện kèm "(0)", không bị vô hiệu; bấm thì bật và bảng báo "Không có Task khớp bộ lọc"', async () => {
    const kho = await dungDuLieu()
    const user = await moTrang(kho, 'an@vi-du.vn', 'viecCuaToi')

    const biLoi = chip('Bị lỗi (0)')
    expect(biLoi).toBeEnabled()
    expect(biLoi).not.toHaveAttribute('aria-disabled', 'true')
    await user.click(biLoi)
    expect(chip('Bị lỗi (0)')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('heading', { name: 'Không có Task khớp bộ lọc' })).toBeInTheDocument()
    expect(screen.queryByRole('table', { name: 'Việc của tôi' })).not.toBeInTheDocument()
  })

  it('dòng "Hiện X trên Y Task" chỉ hiện khi đang lọc; lọc ra rỗng thì Xoá bộ lọc hiện lại đủ Task, ô tìm trống, chip tắt', async () => {
    const kho = await dungDuLieu()
    const user = await moTrang(kho, 'an@vi-du.vn', 'viecCuaToi')

    expect(screen.queryByRole('status', { name: 'Số Task đang hiện' })).not.toBeInTheDocument()
    expect(screen.queryByText(/^Hiện \d+ trên \d+ Task$/)).not.toBeInTheDocument()
    // Từ khoá chỉ có khoảng trắng: không lọc.
    await tim(user, '   ')
    expect(screen.queryByRole('status', { name: 'Số Task đang hiện' })).not.toBeInTheDocument()

    await user.click(chip('Cao (3)'))
    expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Hiện 3 trên 5 Task')
    await tim(user, 'khong co task nay')
    expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Hiện 0 trên 5 Task')
    expect(screen.getByRole('heading', { name: 'Không có Task khớp bộ lọc' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Xoá bộ lọc' }))
    expect(await screen.findByRole('table', { name: 'Việc của tôi' })).toBeInTheDocument()
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(VIEC_CUA_AN)
    expect(oTim()).toHaveValue('')
    for (const ten of ['Mới (2)', 'Cao (3)', 'Trễ hạn (2)', 'Bị lỗi (0)']) {
      expect(chip(ten)).toHaveAttribute('aria-pressed', 'false')
    }
    expect(screen.queryByRole('status', { name: 'Số Task đang hiện' })).not.toBeInTheDocument()
  })

  it('bàn phím: Tab tới một chip và bật tắt bằng phím cách', async () => {
    const kho = await dungDuLieu()
    const user = await moTrang(kho, 'an@vi-du.vn', 'viecCuaToi')

    const cao = chip('Cao (3)')
    for (let i = 0; i < 30 && document.activeElement !== cao; i++) await user.tab()
    expect(document.activeElement).toBe(cao)
    await user.keyboard(' ')
    expect(chip('Cao (3)')).toHaveAttribute('aria-pressed', 'true')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual([
      'Duyệt giao diện',
      '[Khớp mã trạng thái DVC] 01',
      'Sửa báo cáo tồn kho',
    ])
  })
})

describe('Chờ tôi duyệt: tìm và lọc', () => {
  it('có ô tìm, nhóm chip Mức ưu tiên và chip Trễ hạn, không có chip trạng thái; tìm và lọc như Việc của tôi', async () => {
    const kho = await dungDuLieu()
    const user = await moTrang(kho, 'binh@vi-du.vn', 'choToiDuyet')

    expect(oTim()).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Lọc theo Trạng thái' })).not.toBeInTheDocument()
    for (const ten of ['Mới', 'Đang làm', 'Chờ duyệt', 'Trả lại', 'Bị lỗi']) {
      expect(screen.queryByRole('button', { name: new RegExp(`^${ten} \\(\\d+\\)$`) })).not.toBeInTheDocument()
    }
    expect(tenChip('Lọc theo Mức ưu tiên')).toEqual(['Thấp (1)', 'Trung bình (0)', 'Cao (2)'])
    expect(chip('Trễ hạn (1)')).toHaveAttribute('aria-pressed', 'false')
    // Thứ tự của luật xếp việc cá nhân: theo tên Dự án, rồi hạn gần trước (không có hạn sau), rồi tiêu đề.
    expect(tieuDeTrongBang('Chờ tôi duyệt')).toEqual(['Kiểm thử đăng nhập', 'Duyệt giao diện', 'Duyệt hợp đồng'])

    await user.click(chip('Cao (2)'))
    expect(chip('Cao (2)')).toHaveAttribute('aria-pressed', 'true')
    expect(tieuDeTrongBang('Chờ tôi duyệt')).toEqual(['Duyệt giao diện', 'Duyệt hợp đồng'])
    expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Hiện 2 trên 3 Task')
    await tim(user, 'ams')
    expect(tieuDeTrongBang('Chờ tôi duyệt')).toEqual(['Duyệt hợp đồng'])

    await user.click(chip('Trễ hạn (1)'))
    expect(screen.getByRole('heading', { name: 'Không có Task khớp bộ lọc' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Xoá bộ lọc' }))
    expect(await screen.findByRole('table', { name: 'Chờ tôi duyệt' })).toBeInTheDocument()
    expect(tieuDeTrongBang('Chờ tôi duyệt')).toHaveLength(3)
    expect(oTim()).toHaveValue('')
  })
})

describe('bộ lọc qua Ngăn trượt và khi đổi trang', () => {
  it('mở rồi đóng Ngăn trượt giữ ô tìm và chip; chuyển trạng thái trong ngăn thì danh sách và số trên chip cập nhật, bộ lọc giữ', async () => {
    const kho = await dungDuLieu()
    const user = await moTrang(kho, 'an@vi-du.vn', 'viecCuaToi')

    await tim(user, 'dvc')
    await user.click(chip('Mới (2)'))
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(['Đồng bộ DVC', '[Khớp mã trạng thái DVC] 01'])

    await user.click(within(screen.getByRole('table', { name: 'Việc của tôi' })).getByRole('button', { name: 'Đồng bộ DVC' }))
    await choNganTruot('Đồng bộ DVC')
    await dongNganTruot(user)
    expect(oTim()).toHaveValue('dvc')
    expect(chip('Mới (2)')).toHaveAttribute('aria-pressed', 'true')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(['Đồng bộ DVC', '[Khớp mã trạng thái DVC] 01'])

    // Bắt đầu làm "Đồng bộ DVC" trong ngăn: Task rời chip Mới sang Đang làm.
    await user.click(within(screen.getByRole('table', { name: 'Việc của tôi' })).getByRole('button', { name: 'Đồng bộ DVC' }))
    const ngan = await choNganTruot('Đồng bộ DVC')
    await user.click(await within(ngan).findByRole('button', { name: 'Bắt đầu làm' }))
    expect(await within(ngan).findByText('Đã chuyển Task sang Đang làm.')).toBeInTheDocument()
    await dongNganTruot(user)
    await waitFor(() => expect(chip('Mới (1)')).toHaveAttribute('aria-pressed', 'true'))
    expect(chip('Đang làm (2)')).toHaveAttribute('aria-pressed', 'false')
    expect(oTim()).toHaveValue('dvc')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(['[Khớp mã trạng thái DVC] 01'])
    expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Hiện 1 trên 5 Task')
  })

  it('Chờ tôi duyệt: Duyệt đạt trong ngăn thì Task rời danh sách và số trên chip giảm, bộ lọc giữ', async () => {
    const kho = await dungDuLieu()
    const user = await moTrang(kho, 'binh@vi-du.vn', 'choToiDuyet')

    await user.click(chip('Cao (2)'))
    await user.click(within(screen.getByRole('table', { name: 'Chờ tôi duyệt' })).getByRole('button', { name: 'Duyệt hợp đồng' }))
    const ngan = await choNganTruot('Duyệt hợp đồng')
    await user.click(await within(ngan).findByRole('button', { name: 'Duyệt đạt' }))
    await dongNganTruot(user)
    await waitFor(() => expect(chip('Cao (1)')).toHaveAttribute('aria-pressed', 'true'))
    expect(tieuDeTrongBang('Chờ tôi duyệt')).toEqual(['Duyệt giao diện'])
    expect(screen.getByRole('status', { name: 'Số Task đang hiện' })).toHaveTextContent('Hiện 1 trên 2 Task')
  })

  it('rời trang rồi quay lại thì ô tìm và chip về trống', async () => {
    const kho = await dungDuLieu()
    const user = userEvent.setup()
    render(<App kho={kho} moPhong={kho.moPhong} dongHo={() => BAY_GIO} />)
    await user.click(screen.getByLabelText('Email'))
    await user.paste('an@vi-du.vn')
    await user.click(screen.getByLabelText('Mật khẩu'))
    await user.paste(MAT_KHAU)
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    await choTongQuanTaiXong()
    await user.click(screen.getByRole('button', { name: 'Việc của tôi' }))
    await screen.findByRole('table', { name: 'Việc của tôi' })

    await tim(user, 'dvc')
    await user.click(chip('Cao (3)'))
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(['[Khớp mã trạng thái DVC] 01'])
    // Sang Chờ tôi duyệt (An không có Task nào chờ duyệt) rồi quay lại.
    await user.click(screen.getByRole('button', { name: 'Chờ tôi duyệt' }))
    expect(await screen.findByText('Không có Task nào đang chờ bạn duyệt.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Việc của tôi' }))
    await screen.findByRole('table', { name: 'Việc của tôi' })
    expect(oTim()).toHaveValue('')
    expect(chip('Cao (3)')).toHaveAttribute('aria-pressed', 'false')
    expect(tieuDeTrongBang('Việc của tôi')).toEqual(VIEC_CUA_AN)
  })
})

describe('trống, đang tải, lỗi: không có thanh tìm và lọc', () => {
  it.each(['viecCuaToi', 'choToiDuyet'] as const)(
    '%s: người chưa có Task thấy trạng thái trống như trước, không có ô tìm',
    async (loai) => {
      const kho = await dungDuLieu()
      await dungTrang(kho, PM.email, loai)
      const trong = loai === 'viecCuaToi' ? 'Bạn không có việc nào đang làm.' : 'Không có Task nào đang chờ bạn duyệt.'
      expect(await screen.findByText(trong)).toBeInTheDocument()
      expect(screen.queryByRole('searchbox', { name: 'Tìm Task' })).not.toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'Tìm và lọc Task' })).not.toBeInTheDocument()
    },
  )

  it('đang tải và lỗi không có ô tìm', async () => {
    const goc = await dungDuLieu()
    let tiepTuc: (() => void) | null = null
    const kho: KhoDuLieu = {
      ...goc,
      viecCuaToi: async () => {
        await new Promise<void>((xong) => (tiepTuc = xong))
        return thatBai('LOI_HE_THONG')
      },
    }
    await dungTrang(goc, 'an@vi-du.vn', 'viecCuaToi', kho)
    expect(await screen.findByRole('progressbar', { name: 'Đang tải Task…' })).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Tìm Task' })).not.toBeInTheDocument()
    ;(tiepTuc as (() => void) | null)?.()
    expect(await screen.findByText('Không tải được danh sách Việc của tôi.')).toBeInTheDocument()
    expect(screen.queryByRole('searchbox', { name: 'Tìm Task' })).not.toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Tìm và lọc Task' })).not.toBeInTheDocument()
  })
})
