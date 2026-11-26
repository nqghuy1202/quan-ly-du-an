// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { App } from '../App'
import { thatBai, type KetQua } from '../kho/ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from '../kho/khoDuLieu'
import { taoKhoBoNho, type KhoBoNho } from '../kho/khoBoNho'
import { THONG_BAO_CHUYEN_TRANG_THAI } from '../luat/chuyenTrangThai'
import type { TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { choNganTruot } from '../test/khungUngDung'

const MAT_KHAU = 'matkhau-123'
/** Đồng hồ ứng dụng dùng khi bấm đổi trạng thái: 01/03/2026 08:00 giờ Việt Nam. */
const LUC = new Date('2026-03-01T08:00:00+07:00')
const PM = { email: 'pm@vi-du.vn', matKhau: MAT_KHAU, tenHienThi: 'An PM' }

type User = ReturnType<typeof userEvent.setup>

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

interface BoiCanh {
  kho: KhoBoNho
  duAn: DuAn
  task: Task
}

/** Dự án "Cửa hàng": An (làm), Bình (duyệt), Em (Thành viên khác) và Chi (Support) trong Dự án; Dũng ngoài Dự án. Một Task ở trạng thái `trangThai`. */
async function dungBoiCanh(trangThai: TrangThaiTask = 'MOI', goc: KhoBoNho = taoKhoBoNho({ pmBanDau: PM })): Promise<BoiCanh> {
  const pm = await phienCua(goc, PM.email)
  const duAn = giaTri(await goc.taoDuAn(pm, { ten: 'Cửa hàng' }, LUC))
  const anId = await taoNguoi(goc, 'an@vi-du.vn', 'An', 'THANH_VIEN')
  const binhId = await taoNguoi(goc, 'binh@vi-du.vn', 'Bình', 'THANH_VIEN')
  await taoNguoi(goc, 'em@vi-du.vn', 'Em', 'THANH_VIEN')
  await taoNguoi(goc, 'chi@vi-du.vn', 'Chi', 'SUPPORT')
  await taoNguoi(goc, 'dung@vi-du.vn', 'Dũng', 'SUPPORT')
  for (const email of ['an@vi-du.vn', 'binh@vi-du.vn', 'em@vi-du.vn', 'chi@vi-du.vn']) {
    giaTri(await goc.themNguoiVaoDuAn(pm, duAn.id, { email }))
  }
  const task = giaTri(
    await goc.taoTask(pm, duAn.id, { tieuDe: 'Làm trang chủ', nguoiThucHienId: anId, nguoiKiemTraId: binhId }, LUC),
  )
  if (trangThai !== 'MOI') giaTri(await goc.chuDuAn.datTrangThaiTask(task.id, trangThai))
  return { kho: goc, duAn, task }
}

async function dangNhap(user: User, email: string) {
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Mật khẩu'), MAT_KHAU)
  await user.click(screen.getByRole('button', { name: 'Đăng nhập' }))
  await screen.findByRole('group', { name: 'Tài khoản đang đăng nhập' })
}

/** Đăng nhập bằng `email`, mở Dự án Cửa hàng rồi Task "Làm trang chủ" trong Ngăn trượt. */
async function moChiTiet(user: User, email: string, laPM = false) {
  await dangNhap(user, email)
  await user.click(screen.getByRole('button', { name: laPM ? 'Tất cả Dự án' : 'Dự án của tôi' }))
  await user.click(await screen.findByRole('button', { name: 'Cửa hàng' }))
  await screen.findByRole('heading', { level: 2, name: 'Cửa hàng' })
  const vung = within(screen.getByRole('group', { name: 'Task của Dự án' }))
  await user.click(await vung.findByRole('button', { name: 'Làm trang chủ' }))
  await choNganTruot('Làm trang chủ')
}

/** Hộp nhập lý do (mở đè lên Ngăn trượt của Task). */
const TEN_HOP_LY_DO = /: nhập lý do$/

async function choHopLyDo() {
  return within(await screen.findByRole('dialog', { name: TEN_HOP_LY_DO }))
}

function hopLyDoDaDong() {
  return screen.queryByRole('dialog', { name: TEN_HOP_LY_DO }) === null
}

function vungChuyen() {
  return within(screen.getByRole('group', { name: 'Chuyển trạng thái' }))
}

async function choCoNut(ten: string) {
  return within(await screen.findByRole('group', { name: 'Chuyển trạng thái' })).findByRole('button', { name: ten })
}

function tenCacNut(): string[] {
  return vungChuyen()
    .queryAllByRole('button')
    .map((nut) => nut.textContent ?? '')
}

async function doiDen(kho: KhoBoNho, taskId: string) {
  return giaTri(await kho.layTask(await phienCua(kho, PM.email), taskId))
}

async function lichSu(kho: KhoBoNho, taskId: string) {
  return giaTri(await kho.lichSuTask(await phienCua(kho, PM.email), taskId))
}

describe('chi tiết Task: chuyển trạng thái', () => {
  it('Người thực hiện chỉ thấy bước của mình; bấm Bắt đầu làm thì Task sang Đang làm, có lịch sử và nút tiếp theo', async () => {
    const bc = await dungBoiCanh()
    const { user } = dungApp(bc.kho)
    await moChiTiet(user, 'an@vi-du.vn')

    await choCoNut('Bắt đầu làm')
    expect(tenCacNut()).toEqual(['Bắt đầu làm'])
    expect(screen.getByRole('group', { name: 'Lịch sử trạng thái' })).toHaveTextContent('Chưa có lần đổi trạng thái nào.')

    await user.click(screen.getByRole('button', { name: 'Bắt đầu làm' }))
    expect(await screen.findByText('Đã chuyển Task sang Đang làm.')).toBeInTheDocument()
    await choCoNut('Báo chờ duyệt')
    expect(tenCacNut()).toEqual(['Báo chờ duyệt'])
    expect(screen.getByRole('group', { name: 'Thông tin Task' })).toHaveTextContent('Trạng thái: Đang làm')

    const ls = await within(screen.getByRole('group', { name: 'Lịch sử trạng thái' })).findByText('Mới sang Đang làm')
    expect(ls).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Lịch sử trạng thái' })).toHaveTextContent('An, 01/03/2026 08:00')

    const task = await doiDen(bc.kho, bc.task.id)
    expect(task.trangThai).toBe('DANG_LAM')
    expect(task.dauVet.suaBoi?.tenHienThi).toBe('An')
    expect(screen.getByRole('group', { name: 'Dấu vết' })).toHaveTextContent('Người chỉnh sửa gần nhất: An')
  })

  it('Người kiểm tra thấy Duyệt đạt, Trả lại, Báo Bị lỗi khi Chờ duyệt (không có Huỷ); Người thực hiện không thấy nút nào và được giải thích', async () => {
    const bc = await dungBoiCanh('CHO_DUYET')
    const binh = dungApp(bc.kho)
    await moChiTiet(binh.user, 'binh@vi-du.vn')
    await choCoNut('Duyệt đạt')
    expect(tenCacNut()).toEqual(['Duyệt đạt', 'Trả lại', 'Báo Bị lỗi'])
  })

  it('Người thực hiện ở trạng thái Chờ duyệt không có nút và thấy ai làm tiếp', async () => {
    const bc = await dungBoiCanh('CHO_DUYET')
    const { user } = dungApp(bc.kho)
    await moChiTiet(user, 'an@vi-du.vn')
    const vung = await screen.findByRole('group', { name: 'Chuyển trạng thái' })
    expect(await within(vung).findByText('Task đang Chờ duyệt: bước tiếp theo do Người kiểm tra, Support của Dự án hoặc PM làm. Bạn chưa có bước nào để làm.')).toBeInTheDocument()
    expect(tenCacNut()).toEqual([])
  })

  it('Thành viên khác trong Dự án không có nút và được giải thích vì sao', async () => {
    const bc = await dungBoiCanh()
    const { user } = dungApp(bc.kho)
    await moChiTiet(user, 'em@vi-du.vn')
    const vung = await screen.findByRole('group', { name: 'Chuyển trạng thái' })
    expect(await within(vung).findByText(THONG_BAO_CHUYEN_TRANG_THAI.khongCoVai)).toBeInTheDocument()
    expect(tenCacNut()).toEqual([])
  })

  it('Task đã Hoàn thành hoặc Huỷ không còn nút, kể cả với PM; Dự án Lưu trữ cũng vậy', async () => {
    const bc = await dungBoiCanh('HOAN_THANH')
    const a = dungApp(bc.kho)
    await moChiTiet(a.user, PM.email, true)
    const vung = await screen.findByRole('group', { name: 'Chuyển trạng thái' })
    expect(await within(vung).findByText(THONG_BAO_CHUYEN_TRANG_THAI.daChot)).toBeInTheDocument()
    expect(tenCacNut()).toEqual([])
  })

  it('Dự án đã Lưu trữ: Support của Dự án không có nút và thấy lý do', async () => {
    const bc = await dungBoiCanh('DANG_LAM')
    giaTri(await bc.kho.luuTruDuAn(await phienCua(bc.kho, PM.email), bc.duAn.id, LUC))
    const { user } = dungApp(bc.kho)
    await moChiTiet(user, 'chi@vi-du.vn')
    const vung = await screen.findByRole('group', { name: 'Chuyển trạng thái' })
    expect(await within(vung).findByText(THONG_BAO_CHUYEN_TRANG_THAI.daLuuTru)).toBeInTheDocument()
    expect(tenCacNut()).toEqual([])
  })

  describe('bước cần lý do', () => {
    it('Trả lại mở hộp nhập lý do, không cho gửi khi lý do trống hay chỉ khoảng trắng; gửi lý do thì Task sang Trả lại, bộ đếm tăng 1 và lịch sử có lý do', async () => {
      const bc = await dungBoiCanh('CHO_DUYET')
      const { user } = dungApp(bc.kho)
      await moChiTiet(user, 'binh@vi-du.vn')
      expect(screen.getByText('Số lần bị Trả lại: 0')).toBeInTheDocument()

      await user.click(await choCoNut('Trả lại'))
      const hop = await choHopLyDo()
      const gui = hop.getByRole('button', { name: 'Trả lại' })
      expect(gui).toHaveAttribute('aria-disabled', 'true')
      await user.click(gui)
      expect((await doiDen(bc.kho, bc.task.id)).trangThai).toBe('CHO_DUYET')

      await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), '   ')
      expect(hop.getByRole('button', { name: 'Trả lại' })).toHaveAttribute('aria-disabled', 'true')
      await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), 'Thiếu ảnh sản phẩm')
      expect(hop.getByRole('button', { name: 'Trả lại' })).not.toHaveAttribute('aria-disabled', 'true')
      await user.click(hop.getByRole('button', { name: 'Trả lại' }))

      expect(await screen.findByText('Số lần bị Trả lại: 1')).toBeInTheDocument()
      expect(hopLyDoDaDong()).toBe(true)
      expect(screen.getByRole('group', { name: 'Thông tin Task' })).toHaveTextContent('Trạng thái: Trả lại')
      const lichSuUi = screen.getByRole('group', { name: 'Lịch sử trạng thái' })
      expect(await within(lichSuUi).findByText('Chờ duyệt sang Trả lại')).toBeInTheDocument()
      expect(lichSuUi).toHaveTextContent('Lý do: Thiếu ảnh sản phẩm')
      expect(lichSuUi).toHaveTextContent('Bình, 01/03/2026 08:00')

      const ls = await lichSu(bc.kho, bc.task.id)
      expect(ls).toHaveLength(1)
      expect(ls[0]).toMatchObject({ tu: 'CHO_DUYET', sang: 'TRA_LAI', lyDo: 'Thiếu ảnh sản phẩm' })
      expect((await doiDen(bc.kho, bc.task.id)).soLanTraLai).toBe(1)
    })

    it('đóng hộp thì không đổi gì; mở lại thì ô lý do trống', async () => {
      const bc = await dungBoiCanh('CHO_DUYET')
      const { user } = dungApp(bc.kho)
      await moChiTiet(user, 'binh@vi-du.vn')
      await user.click(await choCoNut('Báo Bị lỗi'))
      let hop = await choHopLyDo()
      await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), 'Hỏng hẳn')
      await user.click(hop.getByRole('button', { name: 'Đóng' }))
      expect(hopLyDoDaDong()).toBe(true)
      expect((await doiDen(bc.kho, bc.task.id)).trangThai).toBe('CHO_DUYET')
      expect(await lichSu(bc.kho, bc.task.id)).toEqual([])

      await user.click(screen.getByRole('button', { name: 'Báo Bị lỗi' }))
      hop = await choHopLyDo()
      expect(hop.getByRole('textbox', { name: /^Lý do/ })).toHaveValue('')
    })

    it('PM Huỷ Task bằng nút Huỷ Task kèm lý do; sau đó Task chỉ xem', async () => {
      const bc = await dungBoiCanh('DANG_LAM')
      const { user } = dungApp(bc.kho)
      await moChiTiet(user, PM.email, true)
      await user.click(await choCoNut('Huỷ Task'))
      const hop = await choHopLyDo()
      await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), 'Khách đổi ý')
      await user.click(hop.getByRole('button', { name: 'Huỷ Task' }))
      expect(await screen.findByText('Đã chuyển Task sang Huỷ.')).toBeInTheDocument()
      expect((await doiDen(bc.kho, bc.task.id)).trangThai).toBe('HUY')
      expect((await lichSu(bc.kho, bc.task.id))[0]).toMatchObject({ sang: 'HUY', lyDo: 'Khách đổi ý' })
      const vung = await screen.findByRole('group', { name: 'Chuyển trạng thái' })
      expect(await within(vung).findByText(THONG_BAO_CHUYEN_TRANG_THAI.daChot)).toBeInTheDocument()
      expect(tenCacNut()).toEqual([])
    })

    it('Kho từ chối khi đang gửi lý do thì lý do tiếng Việt hiện ngay trong hộp, hộp vẫn mở', async () => {
      const goc = taoKhoBoNho({ pmBanDau: PM })
      const bc = await dungBoiCanh('CHO_DUYET', goc)
      const kho: KhoDuLieu = { ...goc, doiTrangThaiTask: async () => thatBai('KHONG_CO_QUYEN', 'Bạn vừa bị gỡ khỏi Dự án.') }
      const { user } = dungApp(goc, kho)
      await moChiTiet(user, 'binh@vi-du.vn')
      await user.click(await choCoNut('Trả lại'))
      const hop = await choHopLyDo()
      await user.type(hop.getByRole('textbox', { name: /^Lý do/ }), 'Thiếu ảnh')
      await user.click(hop.getByRole('button', { name: 'Trả lại' }))
      expect(await hop.findByRole('alert')).toHaveTextContent('Bạn vừa bị gỡ khỏi Dự án.')
      expect((await doiDen(goc, bc.task.id)).trangThai).toBe('CHO_DUYET')
    })
  })

  describe('khi Kho từ chối', () => {
    it('Task đổi ở nơi khác trong lúc đang xem: hiện lý do bằng tiếng Việt, Task đọc lại cho khớp và nút biến mất', async () => {
      const bc = await dungBoiCanh()
      const { user } = dungApp(bc.kho)
      await moChiTiet(user, 'an@vi-du.vn')
      await choCoNut('Bắt đầu làm')
      // Trong lúc An đang xem, Task bị chốt ở nơi khác.
      giaTri(await bc.kho.chuDuAn.datTrangThaiTask(bc.task.id, 'HOAN_THANH'))
      await user.click(screen.getByRole('button', { name: 'Bắt đầu làm' }))
      // Kho từ chối bằng lý do tiếng Việt; Task đọc lại cho khớp nên cũng chính lý do đó thay chỗ nút.
      expect(await screen.findByText(THONG_BAO_CHUYEN_TRANG_THAI.daChot)).toBeInTheDocument()
      expect(await screen.findByText('Trạng thái: Hoàn thành')).toBeInTheDocument()
      expect(tenCacNut()).toEqual([])
      expect(await lichSu(bc.kho, bc.task.id)).toEqual([])
    })
  })

  describe('khi Kho từ chối mà vẫn còn nút để bấm', () => {
    it('lý do từ chối hiện thành thông báo lỗi tiếng Việt, Task không đổi', async () => {
      const goc = taoKhoBoNho({ pmBanDau: PM })
      const bc = await dungBoiCanh('MOI', goc)
      const kho: KhoDuLieu = { ...goc, doiTrangThaiTask: async () => thatBai('KHONG_CO_QUYEN', 'Bước này chỉ PM làm được.') }
      const { user } = dungApp(goc, kho)
      await moChiTiet(user, 'an@vi-du.vn')
      await user.click(await choCoNut('Bắt đầu làm'))
      expect(await screen.findByText('Chưa chuyển được trạng thái.')).toBeInTheDocument()
      expect(screen.getByText('Bước này chỉ PM làm được.')).toBeInTheDocument()
      expect((await doiDen(goc, bc.task.id)).trangThai).toBe('MOI')
    })
  })

  describe('bàn phím', () => {
    it('bước đổi được bằng phím: tới nút rồi nhấn Enter; hộp lý do gửi được bằng phím', async () => {
      const bc = await dungBoiCanh()
      const { user } = dungApp(bc.kho)
      await moChiTiet(user, PM.email, true)
      const batDau = await choCoNut('Bắt đầu làm')
      batDau.focus()
      expect(batDau).toHaveFocus()
      await user.keyboard('{Enter}')
      expect((await screen.findAllByText('Trạng thái: Đang làm')).length).toBeGreaterThan(0)

      const huy = await choCoNut('Huỷ Task')
      huy.focus()
      await user.keyboard('{Enter}')
      const hop = await choHopLyDo()
      const o = hop.getByRole('textbox', { name: /^Lý do/ })
      o.focus()
      await user.keyboard('Không cần nữa')
      const gui = hop.getByRole('button', { name: 'Huỷ Task' })
      gui.focus()
      await user.keyboard('{Enter}')
      expect(await screen.findByText('Trạng thái: Huỷ')).toBeInTheDocument()
      expect((await doiDen(bc.kho, bc.task.id)).trangThai).toBe('HUY')
    })
  })

  describe('trạng thái đang tải, lỗi và trống', () => {
    it('đang kiểm các bước làm được: hiện đang tải, chưa có nút', async () => {
      const goc = taoKhoBoNho({ pmBanDau: PM })
      await dungBoiCanh('MOI', goc)
      let lanGoi = 0
      const kho: KhoDuLieu = {
        ...goc,
        // Lần đầu (màn Dự án của tôi) bình thường; lần sau (chi tiết Task) treo mãi.
        danhSachDuAnCuaToi: (phien) => {
          lanGoi += 1
          return lanGoi <= 1 ? goc.danhSachDuAnCuaToi(phien) : new Promise(() => {})
        },
      }
      const { user } = dungApp(goc, kho)
      await moChiTiet(user, 'an@vi-du.vn')
      expect(await screen.findByRole('progressbar', { name: 'Đang kiểm các bước làm được…' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Bắt đầu làm' })).not.toBeInTheDocument()
    })

    it('lỗi khi kiểm các bước làm được: hiện thông báo tiếng Việt và thử lại được', async () => {
      const goc = taoKhoBoNho({ pmBanDau: PM })
      await dungBoiCanh('MOI', goc)
      let lanGoi = 0
      const kho: KhoDuLieu = {
        ...goc,
        danhSachDuAnCuaToi: async (phien) => {
          lanGoi += 1
          return lanGoi === 2 ? thatBai('LOI_HE_THONG') : goc.danhSachDuAnCuaToi(phien)
        },
      }
      const { user } = dungApp(goc, kho)
      await moChiTiet(user, 'an@vi-du.vn')
      const vung = await screen.findByRole('group', { name: 'Chuyển trạng thái' })
      expect(await within(vung).findByRole('alert')).toHaveTextContent('Không tải được thông tin để kiểm các bước làm được.')
      await user.click(within(vung).getByRole('button', { name: 'Thử lại' }))
      expect(await choCoNut('Bắt đầu làm')).toBeInTheDocument()
    })

    it('lịch sử đang tải thì hiện đang tải; lỗi thì hiện thông báo và thử lại được', async () => {
      const goc = taoKhoBoNho({ pmBanDau: PM })
      await dungBoiCanh('MOI', goc)
      let lanGoi = 0
      let tiepTuc: () => void = () => {}
      const kho: KhoDuLieu = {
        ...goc,
        lichSuTask: async (phien, id) => {
          lanGoi += 1
          if (lanGoi === 1) await new Promise<void>((xong) => (tiepTuc = xong))
          return lanGoi === 1 ? thatBai('LOI_HE_THONG') : goc.lichSuTask(phien, id)
        },
      }
      const { user } = dungApp(goc, kho)
      await moChiTiet(user, 'an@vi-du.vn')
      expect(await screen.findByRole('progressbar', { name: 'Đang tải lịch sử…' })).toBeInTheDocument()
      tiepTuc()
      const vung = screen.getByRole('group', { name: 'Lịch sử trạng thái' })
      expect(await within(vung).findByRole('alert')).toHaveTextContent('Không tải được lịch sử trạng thái.')
      await user.click(within(vung).getByRole('button', { name: 'Thử lại' }))
      expect(await within(vung).findByText('Chưa có lần đổi trạng thái nào.')).toBeInTheDocument()
    })
  })

  it('lịch sử nhiều dòng hiện theo thứ tự thời gian tăng dần', async () => {
    const bc = await dungBoiCanh()
    const an = await phienCua(bc.kho, 'an@vi-du.vn')
    giaTri(await bc.kho.doiTrangThaiTask(an, bc.task.id, { sang: 'DANG_LAM' }, new Date('2026-03-01T09:00:00+07:00')))
    giaTri(await bc.kho.doiTrangThaiTask(an, bc.task.id, { sang: 'CHO_DUYET' }, new Date('2026-03-01T10:00:00+07:00')))
    const binh = await phienCua(bc.kho, 'binh@vi-du.vn')
    giaTri(await bc.kho.doiTrangThaiTask(binh, bc.task.id, { sang: 'TRA_LAI', lyDo: 'Làm lại' }, new Date('2026-03-01T11:00:00+07:00')))
    const { user } = dungApp(bc.kho)
    await moChiTiet(user, 'em@vi-du.vn')
    const vung = screen.getByRole('group', { name: 'Lịch sử trạng thái' })
    await within(vung).findByText('Mới sang Đang làm')
    const dong = within(vung).getAllByRole('listitem').map((d) => d.textContent ?? '')
    expect(dong).toHaveLength(3)
    expect(dong[0]).toContain('Mới sang Đang làm')
    expect(dong[1]).toContain('Đang làm sang Chờ duyệt')
    expect(dong[2]).toContain('Chờ duyệt sang Trả lại')
    expect(dong[2]).toContain('Lý do: Làm lại')
    expect(screen.getByText('Số lần bị Trả lại: 1')).toBeInTheDocument()
  })
})
