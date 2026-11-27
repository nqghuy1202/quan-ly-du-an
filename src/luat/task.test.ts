import { describe, expect, it } from 'vitest'
import type { VaiHeThong } from './taiKhoan'
import { THONG_BAO_MUC_UU_TIEN } from './mucUuTien'
import {
  DO_DAI_TIEU_DE_TASK_TOI_DA,
  THONG_BAO_TASK,
  dinhDangNgay,
  duocTaoTask,
  duocXemTask,
  kiemNguoiTask,
  kiemTaoTask,
  kiemTraTask,
  laNgayHopLe,
  lyDoKhongTaoTask,
  soTaskDangGiu,
  xepTask,
  type TrangThaiTask,
} from './task'

describe('hạn của Task: một ngày, không có giờ', () => {
  it.each(['2026-12-31', '2020-01-01', '2024-02-29', '2026-02-28', '2026-04-30'])('%s là ngày có thật', (ngay) => {
    expect(laNgayHopLe(ngay)).toBe(true)
  })

  it.each(['2026-02-29', '2026-02-30', '2026-04-31', '2026-13-01', '2026-00-10', '2026-01-00', '31/12/2026', '2026-1-5', '2026-12-31T00:00', '', 'mai'])(
    '"%s" không phải một ngày hợp lệ',
    (ngay) => {
      expect(laNgayHopLe(ngay)).toBe(false)
    },
  )

  it('hiện hạn dạng ngày/tháng/năm, không phụ thuộc múi giờ', () => {
    expect(dinhDangNgay('2026-03-05')).toBe('05/03/2026')
  })
})

describe('kiểm dữ liệu tạo Task', () => {
  it('chuẩn hoá: bỏ khoảng trắng, mô tả và hạn trống thành mặc định, id trống là chưa chọn', () => {
    const kt = kiemTraTask.tao({ tieuDe: '  Việc  ', moTa: '  ', han: ' ', nguoiThucHienId: ' a ', nguoiKiemTraId: '' })
    expect(kt).toEqual({
      ok: true,
      giaTri: { tieuDe: 'Việc', moTa: '', han: null, mucUuTien: 'TRUNG_BINH', nguoiThucHienId: 'a', nguoiKiemTraId: null },
    })
  })

  it('tiêu đề tối đa 200 ký tự, không rỗng', () => {
    expect(kiemTraTask.tao({ tieuDe: 'a'.repeat(DO_DAI_TIEU_DE_TASK_TOI_DA) }).ok).toBe(true)
    expect(kiemTraTask.tao({ tieuDe: 'a'.repeat(DO_DAI_TIEU_DE_TASK_TOI_DA + 1) })).toEqual({
      ok: false,
      loiTheoO: { tieuDe: THONG_BAO_TASK.tieuDeQuaDai },
    })
    expect(kiemTraTask.tao({ tieuDe: '   ' })).toEqual({ ok: false, loiTheoO: { tieuDe: THONG_BAO_TASK.tieuDeTrong } })
  })

  it('Mức ưu tiên: không gửi là Trung bình, gửi mức hợp lệ thì giữ, mức lạ báo ở ô mucUuTien', () => {
    const kt = kiemTraTask.tao({ tieuDe: 'X', mucUuTien: 'CAO' })
    expect(kt.ok && kt.giaTri.mucUuTien).toBe('CAO')
    expect(kiemTraTask.tao({ tieuDe: 'X', mucUuTien: 'KHAN_CAP' })).toEqual({
      ok: false,
      loiTheoO: { mucUuTien: THONG_BAO_MUC_UU_TIEN.sai },
    })
  })

  it('hạn sai báo ở ô hạn', () => {
    expect(kiemTraTask.tao({ tieuDe: 'X', han: '2026-02-30' })).toEqual({
      ok: false,
      loiTheoO: { han: THONG_BAO_TASK.hanSai },
    })
  })
})

describe('luật chọn Người thực hiện và Người kiểm tra', () => {
  const trong = new Set(['an', 'binh'])
  const laNguoiTrongDuAn = (id: string) => trong.has(id)

  it('đủ hai người khác nhau, cùng ở trong Dự án: hợp lệ', () => {
    expect(kiemNguoiTask({ nguoiThucHienId: 'an', nguoiKiemTraId: 'binh', laNguoiTrongDuAn })).toBeNull()
  })

  it('thiếu người: THIEU_NGUOI, báo ở đúng ô', () => {
    expect(kiemNguoiTask({ nguoiThucHienId: null, nguoiKiemTraId: null, laNguoiTrongDuAn })).toEqual({
      ma: 'THIEU_NGUOI',
      loiTheoO: { nguoiThucHienId: THONG_BAO_TASK.thieuNguoiThucHien, nguoiKiemTraId: THONG_BAO_TASK.thieuNguoiKiemTra },
    })
    expect(kiemNguoiTask({ nguoiThucHienId: 'an', nguoiKiemTraId: null, laNguoiTrongDuAn })?.ma).toBe('THIEU_NGUOI')
  })

  it('người ngoài Dự án: NGUOI_NGOAI_DU_AN, kể cả khi trùng người', () => {
    expect(kiemNguoiTask({ nguoiThucHienId: 'la', nguoiKiemTraId: 'binh', laNguoiTrongDuAn })).toEqual({
      ma: 'NGUOI_NGOAI_DU_AN',
      loiTheoO: { nguoiThucHienId: THONG_BAO_TASK.nguoiNgoaiDuAn },
    })
    expect(kiemNguoiTask({ nguoiThucHienId: 'la', nguoiKiemTraId: 'la', laNguoiTrongDuAn })?.ma).toBe('NGUOI_NGOAI_DU_AN')
  })

  it('cùng một người ở hai vai: TRUNG_NGUOI', () => {
    expect(kiemNguoiTask({ nguoiThucHienId: 'an', nguoiKiemTraId: 'an', laNguoiTrongDuAn })).toEqual({
      ma: 'TRUNG_NGUOI',
      loiTheoO: { nguoiKiemTraId: THONG_BAO_TASK.trungNguoi },
    })
  })
})

describe('quyền tạo và xem Task', () => {
  const cacCa: { vai: VaiHeThong; trong: boolean; tao: boolean; xem: boolean }[] = [
    { vai: 'PM', trong: true, tao: true, xem: true },
    { vai: 'PM', trong: false, tao: true, xem: true },
    { vai: 'SUPPORT', trong: true, tao: true, xem: true },
    { vai: 'SUPPORT', trong: false, tao: false, xem: false },
    { vai: 'THANH_VIEN', trong: true, tao: false, xem: true },
    { vai: 'THANH_VIEN', trong: false, tao: false, xem: false },
  ]

  it.each(cacCa)('$vai, trong Dự án: $trong → tạo: $tao, xem: $xem', ({ vai, trong, tao, xem }) => {
    const nguoiGoi = { vaiNguoiGoi: vai, laNguoiTrongDuAn: trong }
    expect(duocTaoTask(nguoiGoi)).toBe(tao)
    expect(duocXemTask(nguoiGoi)).toBe(xem)
    expect(kiemTaoTask({ ...nguoiGoi, trangThai: 'HOAT_DONG' })).toBe(tao ? null : 'KHONG_CO_QUYEN')
    expect(lyDoKhongTaoTask({ ...nguoiGoi, trangThai: 'HOAT_DONG' })).toBe(tao ? null : THONG_BAO_TASK.khongQuanLy)
  })

  it('Dự án đã Lưu trữ: người tạo được nhận DU_AN_DA_LUU_TRU; người không có quyền vẫn chỉ nhận KHONG_CO_QUYEN', () => {
    expect(kiemTaoTask({ vaiNguoiGoi: 'PM', laNguoiTrongDuAn: false, trangThai: 'LUU_TRU' })).toBe('DU_AN_DA_LUU_TRU')
    expect(lyDoKhongTaoTask({ vaiNguoiGoi: 'SUPPORT', laNguoiTrongDuAn: true, trangThai: 'LUU_TRU' })).toBe(
      THONG_BAO_TASK.daLuuTru,
    )
    expect(kiemTaoTask({ vaiNguoiGoi: 'THANH_VIEN', laNguoiTrongDuAn: true, trangThai: 'LUU_TRU' })).toBe(
      'KHONG_CO_QUYEN',
    )
  })
})

describe('xếp Task', () => {
  it('mới tạo trước; cùng lúc thì theo tiêu đề', () => {
    const luc = (gio: number) => ({ taoLuc: new Date(Date.UTC(2026, 0, 1, gio)) })
    const ds = [
      { tieuDe: 'B', dauVet: luc(1) },
      { tieuDe: 'C', dauVet: luc(2) },
      { tieuDe: 'A', dauVet: luc(1) },
    ]
    expect(xepTask(ds).map((t) => t.tieuDe)).toEqual(['C', 'A', 'B'])
  })
})

describe('số Task đang giữ', () => {
  const task = (trangThai: TrangThaiTask, nguoiThucHienId: string) => ({ trangThai, nguoiThucHienId })

  it('chỉ đếm Task chưa Hoàn thành, chưa Huỷ mà người đó là Người thực hiện', () => {
    const danhSach = [
      task('MOI', 'an'),
      task('DANG_LAM', 'an'),
      task('CHO_DUYET', 'an'),
      task('TRA_LAI', 'an'),
      task('BI_LOI', 'an'),
      task('HOAN_THANH', 'an'),
      task('HUY', 'an'),
      task('DANG_LAM', 'binh'),
    ]
    expect(soTaskDangGiu(danhSach, 'an')).toBe(5)
    expect(soTaskDangGiu(danhSach, 'binh')).toBe(1)
  })

  it('không giữ Task nào (hoặc chỉ là Người kiểm tra, vốn không có trong ô Người thực hiện) thì là 0', () => {
    expect(soTaskDangGiu([], 'an')).toBe(0)
    expect(soTaskDangGiu([task('DANG_LAM', 'binh'), task('HOAN_THANH', 'an')], 'an')).toBe(0)
  })
})
