// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { CAC_THAO_TAC_CONG_GITHUB, type CongGitHub } from '../github/congGitHub'
import { loiGia, phanHoiGia, taoCongGiaGitHub, type KichBanCongGia, type PhanUngGia } from '../github/congGiaGitHub'
import { THONG_BAO_MAC_DINH, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { THONG_BAO_GITHUB_MAC_DINH, THONG_BAO_LIEN_KET, khoaLienKet, type LienKetGitHub } from '../luat/github'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-123'
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }
const O_LINK = 'Link issue hoặc PR'

type User = ReturnType<typeof userEvent.setup>

const url = (loai: 'issues' | 'pull', so: number, repo = 'acme/web') => `https://github.com/${repo}/${loai}/${so}`
const issue = (so: number): LienKetGitHub => ({ repo: 'acme/web', loai: 'ISSUE', so })
const pr = (so: number): LienKetGitHub => ({ repo: 'acme/web', loai: 'PR', so })

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

interface BoiCanh {
  kho: KhoBoNho
  duAn: DuAn
  task: Task
  pm: Phien
}

/** Dự án "Cửa hàng" gắn repo acme/web, Task "Làm trang chủ" (An làm, Bình duyệt) và các link đã dán sẵn. */
async function dungBoiCanh(cacLink: string[] = []): Promise<BoiCanh> {
  const kho = taoKhoBoNho({ pmBanDau: PM })
  const pm = await phienCua(kho, PM.email)
  const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Cửa hàng' }, LUC))
  const anId = await taoNguoi(kho, 'an@vi-du.vn', 'An', 'THANH_VIEN')
  const binhId = await taoNguoi(kho, 'binh@vi-du.vn', 'Bình', 'THANH_VIEN')
  giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: 'an@vi-du.vn' }))
  giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: 'binh@vi-du.vn' }))
  giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/web' }))
  const task = giaTri(
    await kho.taoTask(pm, duAn.id, { tieuDe: 'Làm trang chủ', nguoiThucHienId: anId, nguoiKiemTraId: binhId }, LUC),
  )
  for (const duongDan of cacLink) giaTri(await kho.themLienKetVaoTask(pm, task.id, { duongDan }, LUC))
  return { kho, duAn, task, pm }
}

/**
 * Bọc Cổng GitHub để ghi lại tên mọi thuộc tính mà ứng dụng chạm vào (để khẳng định chỉ có thao
 * tác đọc), và để cho test chen vào việc trả lời (đang tải).
 */
function theoDoiCong(cong: CongGitHub) {
  const daChamVao: string[] = []
  const boc = new Proxy(cong, {
    get(goc, ten, nguoiNhan) {
      if (typeof ten === 'string') daChamVao.push(ten)
      return Reflect.get(goc, ten, nguoiNhan)
    },
  })
  return { boc, daChamVao }
}

function dungApp(bc: BoiCanh, cong: CongGitHub, dongHo: () => Date = () => LUC) {
  const user = userEvent.setup()
  const { container } = render(<App kho={bc.kho} moPhong={bc.kho.moPhong} dongHo={dongHo} congGitHub={cong} />)
  return { user, ungDung: within(container) }
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

/** PM mở Task "Làm trang chủ" từ trang Dự án "Cửa hàng". */
async function pmMoTask(user: User) {
  await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
  await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
  await user.click(await screen.findByRole('button', { name: 'Làm trang chủ' }))
  await screen.findByRole('heading', { level: 2, name: 'Làm trang chủ' })
}

function vungLink() {
  return within(screen.getByRole('group', { name: 'Link GitHub' }))
}

/** Dòng của bảng link có tên chứa `ten`. */
async function dongLink(ten: string): Promise<HTMLElement> {
  const lien = await vungLink().findByRole('link', { name: new RegExp(ten.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&')) })
  const dong = lien.closest('tr')
  if (!dong) throw new Error(`Không thấy dòng của link ${ten}`)
  return dong
}

function kichBan(theoLienKet: Array<[LienKetGitHub, PhanUngGia]>): KichBanCongGia {
  return { theoLienKet: Object.fromEntries(theoLienKet.map(([l, p]) => [khoaLienKet(l), p])) }
}

describe('link GitHub trên chi tiết Task: trạng thái đọc từ Cổng GitHub', () => {
  it('hiện đúng trạng thái của issue mở, issue đóng, PR mở, PR đã merge và PR đóng', async () => {
    const bc = await dungBoiCanh([url('issues', 1), url('issues', 2), url('pull', 3), url('pull', 4), url('pull', 5)])
    const { cong } = taoCongGiaGitHub(
      kichBan([
        [issue(1), phanHoiGia({ state: 'open' })],
        [issue(2), phanHoiGia({ state: 'closed' })],
        [pr(3), phanHoiGia({ state: 'open', draft: true })],
        [pr(4), phanHoiGia({ state: 'closed', merged: true, merged_at: '2026-03-02T10:00:00Z' })],
        [pr(5), phanHoiGia({ state: 'closed', merged: false, merged_at: null })],
      ]),
    )
    const { user } = dungApp(bc, cong)
    await dangNhap(user, PM.email)
    await pmMoTask(user)

    expect(await within(await dongLink('Issue #1')).findByText('Issue đang mở')).toBeInTheDocument()
    expect(within(await dongLink('Issue #2')).getByText('Issue đã đóng')).toBeInTheDocument()
    expect(within(await dongLink('PR #3')).getByText('PR đang mở')).toBeInTheDocument()
    expect(within(await dongLink('PR #4')).getByText('PR đã merge')).toBeInTheDocument()
    expect(within(await dongLink('PR #5')).getByText('PR đã đóng')).toBeInTheDocument()
    // Link mở được trên GitHub bằng đường dẫn chuẩn.
    expect(within(await dongLink('PR #4')).getByRole('link')).toHaveAttribute('href', url('pull', 4))
  })

  it('mỗi lỗi của cổng hiện một thông báo tiếng Việt riêng cạnh link; tiêu đề, người, trạng thái và các link khác vẫn hiện và dùng được', async () => {
    const bc = await dungBoiCanh([
      url('issues', 1),
      url('issues', 2),
      url('issues', 3),
      url('issues', 4),
      url('issues', 5),
      url('pull', 6),
    ])
    const { cong } = taoCongGiaGitHub(
      kichBan([
        [issue(1), loiGia('KHONG_TIM_THAY')],
        [issue(2), loiGia('RIENG_TU')],
        [issue(3), loiGia('HET_LUOT_GOI')],
        [issue(4), loiGia('MAT_MANG')],
        [issue(5), phanHoiGia({ trangThai: 'la' })],
        [pr(6), phanHoiGia({ state: 'open' })],
      ]),
    )
    const { user, ungDung } = dungApp(bc, cong)
    await dangNhap(user, PM.email)
    await pmMoTask(user)

    const mong: Array<[string, string]> = [
      ['Issue #1', THONG_BAO_GITHUB_MAC_DINH.KHONG_TIM_THAY],
      ['Issue #2', THONG_BAO_GITHUB_MAC_DINH.RIENG_TU],
      ['Issue #3', THONG_BAO_GITHUB_MAC_DINH.HET_LUOT_GOI],
      ['Issue #4', THONG_BAO_GITHUB_MAC_DINH.MAT_MANG],
      ['Issue #5', THONG_BAO_GITHUB_MAC_DINH.DU_LIEU_LA],
    ]
    expect(new Set(mong.map(([, thongBao]) => thongBao)).size).toBe(5)
    for (const [ten, thongBao] of mong) {
      expect(await within(await dongLink(ten)).findByText(thongBao), ten).toBeInTheDocument()
    }
    expect(within(await dongLink('PR #6')).getByText('PR đang mở')).toBeInTheDocument()

    // Phần còn lại của Task vẫn hiện.
    expect(screen.getByRole('heading', { level: 2, name: 'Làm trang chủ' })).toBeInTheDocument()
    const thongTin = within(screen.getByRole('group', { name: 'Thông tin Task' }))
    expect(thongTin.getByText('Trạng thái: Mới')).toBeInTheDocument()
    expect(thongTin.getByText('Người thực hiện: An')).toBeInTheDocument()
    expect(thongTin.getByText('Người kiểm tra: Bình')).toBeInTheDocument()

    // Và vẫn gỡ, thêm link được dù GitHub lỗi.
    await user.click(within(await dongLink('Issue #1')).getByRole('button', { name: /^Gỡ / }))
    expect(await ungDung.findByText(/Đã gỡ link acme\/web · Issue #1 khỏi Task\./)).toBeInTheDocument()
    await user.type(screen.getByLabelText(O_LINK), url('issues', 7))
    await user.click(screen.getByRole('button', { name: 'Thêm link' }))
    expect(await ungDung.findByText(/Đã thêm link acme\/web · Issue #7 vào Task\./)).toBeInTheDocument()
    // Link mới chưa có trong kịch bản: cổng giả trả "không tìm thấy" cho link đó, các link khác không đổi.
    expect(await within(await dongLink('Issue #7')).findByText(THONG_BAO_GITHUB_MAC_DINH.KHONG_TIM_THAY)).toBeInTheDocument()
    expect(within(await dongLink('Issue #2')).getByText(THONG_BAO_GITHUB_MAC_DINH.RIENG_TU)).toBeInTheDocument()
  })

  it('có trạng thái đang tải trong lúc đọc GitHub; nút làm mới đọc lại và hiện trạng thái mới', async () => {
    const bc = await dungBoiCanh([url('issues', 1)])
    const gia = taoCongGiaGitHub(kichBan([[issue(1), phanHoiGia({ state: 'open' })]]))
    let giaiPhong: () => void = () => {}
    let chan: Promise<void> = new Promise<void>((xong) => {
      giaiPhong = xong
    })
    let kichBanHienTai: KichBanCongGia = kichBan([[issue(1), phanHoiGia({ state: 'open' })]])
    const cong: CongGitHub = {
      docTrangThai: gia.cong.docTrangThai,
      async docNhieuTrangThai(cac) {
        await chan
        return taoCongGiaGitHub(kichBanHienTai).cong.docNhieuTrangThai(cac)
      },
    }
    const { user } = dungApp(bc, cong)
    await dangNhap(user, PM.email)
    await pmMoTask(user)

    // Lần đọc đầu đang chờ: dòng hiện "đang đọc", Task vẫn hiện.
    expect(await within(await dongLink('Issue #1')).findByText('Đang đọc GitHub…')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Làm trang chủ' })).toBeInTheDocument()
    giaiPhong()
    expect(await within(await dongLink('Issue #1')).findByText('Issue đang mở')).toBeInTheDocument()

    // GitHub đổi: bấm làm mới thì đọc lại, đang đọc rồi hiện trạng thái mới.
    kichBanHienTai = kichBan([[issue(1), phanHoiGia({ state: 'closed' })]])
    chan = new Promise<void>((xong) => {
      giaiPhong = xong
    })
    await user.click(screen.getByRole('button', { name: 'Làm mới trạng thái GitHub' }))
    expect(await within(await dongLink('Issue #1')).findByText('Đang đọc GitHub…')).toBeInTheDocument()
    giaiPhong()
    expect(await within(await dongLink('Issue #1')).findByText('Issue đã đóng')).toBeInTheDocument()
  })

  it('mỗi lần mở Task đọc GitHub lại, chưa có bộ nhớ đệm', async () => {
    const bc = await dungBoiCanh([url('issues', 1)])
    const gia = taoCongGiaGitHub(kichBan([[issue(1), phanHoiGia({ state: 'open' })]]))
    const { user } = dungApp(bc, gia.cong)
    await dangNhap(user, PM.email)
    await pmMoTask(user)
    await within(await dongLink('Issue #1')).findByText('Issue đang mở')
    expect(gia.cacLanGoi()).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Về Dự án Cửa hàng' }))
    await user.click(await screen.findByRole('button', { name: 'Làm trang chủ' }))
    await within(await dongLink('Issue #1')).findByText('Issue đang mở')
    expect(gia.cacLanGoi()).toHaveLength(2)
  })

  it('Task không có link thì hiện trạng thái trống và không đọc GitHub', async () => {
    const bc = await dungBoiCanh()
    const gia = taoCongGiaGitHub()
    const theo = theoDoiCong(gia.cong)
    const { user } = dungApp(bc, theo.boc)
    await dangNhap(user, PM.email)
    await pmMoTask(user)

    expect(await vungLink().findByRole('heading', { name: 'Task chưa có link issue hoặc PR nào.' })).toBeInTheDocument()
    expect(vungLink().queryByRole('button', { name: 'Làm mới trạng thái GitHub' })).not.toBeInTheDocument()
    expect(gia.cacLanGoi()).toEqual([])
    expect(theo.daChamVao).toEqual([])
  })

  it('Kho không tải được link: hiện lỗi tiếng Việt và nút Thử lại; thử lại thì hiện link', async () => {
    const bc = await dungBoiCanh([url('issues', 1)])
    let hong = true
    const kho: KhoDuLieu = {
      ...bc.kho,
      danhSachLienKetCuaTask: async (...tham) => {
        if (hong) return { ok: false, loi: { ma: 'LOI_HE_THONG', thongBao: THONG_BAO_MAC_DINH.LOI_HE_THONG } }
        return bc.kho.danhSachLienKetCuaTask(...tham)
      },
    }
    const gia = taoCongGiaGitHub(kichBan([[issue(1), phanHoiGia({ state: 'open' })]]))
    const user = userEvent.setup()
    render(<App kho={kho} moPhong={bc.kho.moPhong} dongHo={() => LUC} congGitHub={gia.cong} />)
    await dangNhap(user, PM.email)
    await pmMoTask(user)

    expect(await vungLink().findByText('Không tải được link GitHub của Task.')).toBeInTheDocument()
    expect(vungLink().getByText(THONG_BAO_MAC_DINH.LOI_HE_THONG)).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Làm trang chủ' })).toBeInTheDocument()
    hong = false
    await user.click(vungLink().getByRole('button', { name: 'Thử lại' }))
    expect(await within(await dongLink('Issue #1')).findByText('Issue đang mở')).toBeInTheDocument()
  })

  it('ứng dụng chỉ gọi Cổng GitHub bằng thao tác đọc, kể cả khi thêm, gỡ và làm mới link', async () => {
    const bc = await dungBoiCanh([url('issues', 1)])
    const gia = taoCongGiaGitHub(kichBan([[issue(1), phanHoiGia({ state: 'open' })]]))
    const theo = theoDoiCong(gia.cong)
    const { user, ungDung } = dungApp(bc, theo.boc)
    await dangNhap(user, PM.email)
    await pmMoTask(user)
    await within(await dongLink('Issue #1')).findByText('Issue đang mở')

    await user.type(screen.getByLabelText(O_LINK), url('pull', 2))
    await user.click(screen.getByRole('button', { name: 'Thêm link' }))
    await ungDung.findByText(/Đã thêm link/)
    await user.click(screen.getByRole('button', { name: 'Làm mới trạng thái GitHub' }))
    await user.click(within(await dongLink('PR #2')).getByRole('button', { name: /^Gỡ / }))
    await ungDung.findByText(/Đã gỡ link/)

    expect(theo.daChamVao.length).toBeGreaterThan(0)
    for (const ten of theo.daChamVao) {
      expect(CAC_THAO_TAC_CONG_GITHUB as readonly string[], ten).toContain(ten)
      expect(ten).toMatch(/^doc[A-Z]/)
    }
  })
})

describe('link GitHub trên chi tiết Task: thêm và gỡ', () => {
  it('dán link: link vào bảng kèm trạng thái, dấu vết chỉnh sửa đổi; link sai, repo chưa gắn và link trùng bị báo bằng tiếng Việt, không lưu', async () => {
    const bc = await dungBoiCanh()
    const gia = taoCongGiaGitHub(kichBan([[issue(12), phanHoiGia({ state: 'open' })]]))
    const { user, ungDung } = dungApp(bc, gia.cong, () => new Date('2026-03-05T15:20:00+07:00'))
    await dangNhap(user, PM.email)
    await pmMoTask(user)
    const dauVet = () => within(screen.getByRole('group', { name: 'Dấu vết' }))
    expect(dauVet().getByText('Chưa có ai chỉnh sửa.')).toBeInTheDocument()

    await user.type(screen.getByLabelText(O_LINK), 'khong-phai-link')
    await user.click(screen.getByRole('button', { name: 'Thêm link' }))
    expect(await ungDung.findByText('Chưa thêm được link vào Task.')).toBeInTheDocument()
    expect((await ungDung.findAllByText(THONG_BAO_LIEN_KET.sai)).length).toBeGreaterThan(0)

    await user.clear(screen.getByLabelText(O_LINK))
    await user.type(screen.getByLabelText(O_LINK), url('issues', 5, 'nguoi-la/repo'))
    await user.click(screen.getByRole('button', { name: 'Thêm link' }))
    expect((await ungDung.findAllByText(THONG_BAO_LIEN_KET.chuaGan)).length).toBeGreaterThan(0)
    expect(dauVet().getByText('Chưa có ai chỉnh sửa.')).toBeInTheDocument()

    await user.clear(screen.getByLabelText(O_LINK))
    await user.type(screen.getByLabelText(O_LINK), `  ${url('issues', 12)}  `)
    await user.click(screen.getByRole('button', { name: 'Thêm link' }))
    expect(await ungDung.findByText('Đã thêm link acme/web · Issue #12 vào Task.')).toBeInTheDocument()
    expect(within(await dongLink('Issue #12')).getByText('Issue đang mở')).toBeInTheDocument()
    expect(screen.getByLabelText(O_LINK)).toHaveValue('')
    await waitFor(() => expect(dauVet().getByText('Người chỉnh sửa gần nhất: An PM')).toBeInTheDocument())
    expect(dauVet().getByText('Ngày chỉnh sửa gần nhất: 05/03/2026 15:20')).toBeInTheDocument()

    await user.type(screen.getByLabelText(O_LINK), url('issues', 12))
    await user.click(screen.getByRole('button', { name: 'Thêm link' }))
    expect((await ungDung.findAllByText(THONG_BAO_LIEN_KET.trung)).length).toBeGreaterThan(0)

    expect(giaTri(await bc.kho.danhSachLienKetCuaTask(bc.pm, bc.task.id))).toHaveLength(1)
  })

  it('gỡ một link không ảnh hưởng link khác; dấu vết chỉnh sửa đổi theo lần gỡ', async () => {
    const bc = await dungBoiCanh([url('issues', 1), url('pull', 2)])
    const gia = taoCongGiaGitHub(kichBan([[issue(1), phanHoiGia({ state: 'open' })], [pr(2), phanHoiGia({ state: 'open' })]]))
    const { user, ungDung } = dungApp(bc, gia.cong, () => new Date('2026-03-06T09:05:00+07:00'))
    await dangNhap(user, PM.email)
    await pmMoTask(user)
    await within(await dongLink('PR #2')).findByText('PR đang mở')

    await user.click(within(await dongLink('Issue #1')).getByRole('button', { name: /^Gỡ / }))
    expect(await ungDung.findByText('Đã gỡ link acme/web · Issue #1 khỏi Task.')).toBeInTheDocument()
    expect(vungLink().queryByRole('link', { name: /Issue #1/ })).not.toBeInTheDocument()
    expect(within(await dongLink('PR #2')).getByText('PR đang mở')).toBeInTheDocument()
    const dauVet = within(screen.getByRole('group', { name: 'Dấu vết' }))
    await waitFor(() => expect(dauVet.getByText('Ngày chỉnh sửa gần nhất: 06/03/2026 09:05')).toBeInTheDocument())
    expect(giaTri(await bc.kho.danhSachLienKetCuaTask(bc.pm, bc.task.id)).map((l) => l.so)).toEqual([2])
  })

  it('Thành viên trong Dự án cũng dán được link', async () => {
    const bc = await dungBoiCanh()
    const gia = taoCongGiaGitHub(kichBan([[issue(9), phanHoiGia({ state: 'closed' })]]))
    const { user, ungDung } = dungApp(bc, gia.cong)
    await dangNhap(user, 'an@vi-du.vn')
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await user.click(await screen.findByRole('button', { name: 'Làm trang chủ' }))
    await screen.findByRole('heading', { level: 2, name: 'Làm trang chủ' })
    await user.type(await screen.findByLabelText(O_LINK), url('issues', 9))
    await user.click(screen.getByRole('button', { name: 'Thêm link' }))
    expect(await ungDung.findByText('Đã thêm link acme/web · Issue #9 vào Task.')).toBeInTheDocument()
    expect(within(await dongLink('Issue #9')).getByText('Issue đã đóng')).toBeInTheDocument()
  })

  it('Dự án đã Lưu trữ: ô dán link bị khoá kèm lý do, không có nút Gỡ; link và trạng thái vẫn xem được', async () => {
    const bc = await dungBoiCanh([url('issues', 1)])
    giaTri(await bc.kho.luuTruDuAn(bc.pm, bc.duAn.id, LUC))
    const gia = taoCongGiaGitHub(kichBan([[issue(1), phanHoiGia({ state: 'open' })]]))
    const { user, ungDung } = dungApp(bc, gia.cong)
    await dangNhap(user, PM.email)
    await user.click(screen.getByRole('button', { name: 'Tất cả Dự án' }))
    await user.click(await screen.findByRole('radio', { name: 'Lưu trữ' }))
    await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
    await user.click(await screen.findByRole('button', { name: 'Làm trang chủ' }))
    await screen.findByRole('heading', { level: 2, name: 'Làm trang chủ' })

    expect(await within(await dongLink('Issue #1')).findByText('Issue đang mở')).toBeInTheDocument()
    expect(screen.getByLabelText(O_LINK)).toHaveAttribute('aria-disabled', 'true')
    expect(vungLink().queryByRole('button', { name: 'Thêm link' })).not.toBeInTheDocument()
    expect(vungLink().queryByRole('button', { name: /^Gỡ / })).not.toBeInTheDocument()
    expect(ungDung.getAllByText(THONG_BAO_LIEN_KET.daLuuTru).length).toBeGreaterThan(0)
  })
})
