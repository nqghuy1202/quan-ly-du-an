import { describe, expect, it } from 'vitest'
import { CAC_TRANG_THAI_TASK, type TrangThaiTask } from './task'
import {
  demTaskTheoTrangThai,
  duAnTreHan,
  homNayGioVietNam,
  laDuAnQuaHanDuKien,
  laTaskTreHan,
  nhanTienDo,
  taskTreHan,
  tinhSoLieuDuAn,
  tinhTienDo,
  tomTatTienDoDuAn,
  xepTaskTreHan,
} from './tienDo'

const tt = (...ds: TrangThaiTask[]) => ds.map((trangThai) => ({ trangThai }))
const lap = (trangThai: TrangThaiTask, n: number) => Array.from({ length: n }, () => ({ trangThai }))

describe('Tiến độ', () => {
  it('Task Huỷ không nằm trong mẫu số: 1 Hoàn thành, 1 Huỷ, 1 Mới là 50%', () => {
    expect(tinhTienDo(tt('HOAN_THANH', 'HUY', 'MOI'))).toEqual({ chuaCoTask: false, phanTram: 50 })
  })

  it('làm tròn xuống: 1/3 là 33%, 2/3 là 66%, 1/6 là 16%', () => {
    expect(tinhTienDo(tt('HOAN_THANH', 'MOI', 'MOI'))).toEqual({ chuaCoTask: false, phanTram: 33 })
    expect(tinhTienDo(tt('HOAN_THANH', 'HOAN_THANH', 'DANG_LAM'))).toEqual({ chuaCoTask: false, phanTram: 66 })
    expect(tinhTienDo(tt('HOAN_THANH', ...Array<TrangThaiTask>(5).fill('MOI')))).toEqual({ chuaCoTask: false, phanTram: 16 })
  })

  it('còn một Task chưa Hoàn thành thì không bao giờ hiện 100%, kể cả khi 999/1000 đã xong', () => {
    const ds = [...lap('HOAN_THANH', 999), ...lap('CHO_DUYET', 1)]
    expect(tinhTienDo(ds)).toEqual({ chuaCoTask: false, phanTram: 99 })
    expect(nhanTienDo(tinhTienDo(ds))).toBe('99%')
  })

  it('100% chỉ khi mọi Task đáng tính đã Hoàn thành (Huỷ không cản)', () => {
    expect(tinhTienDo(tt('HOAN_THANH', 'HOAN_THANH', 'HUY'))).toEqual({ chuaCoTask: false, phanTram: 100 })
  })

  it('chưa có Task hoặc chỉ có Task Huỷ thì "chưa có task", không phải 0%', () => {
    expect(tinhTienDo([])).toEqual({ chuaCoTask: true })
    expect(tinhTienDo(tt('HUY', 'HUY'))).toEqual({ chuaCoTask: true })
    expect(nhanTienDo(tinhTienDo([]))).toBe('chưa có task')
    expect(nhanTienDo(tinhTienDo(tt('MOI')))).toBe('0%')
  })

  it('đếm Task theo từng trạng thái, trạng thái không có là 0', () => {
    const dem = demTaskTheoTrangThai(tt('MOI', 'MOI', 'HUY', 'CHO_DUYET'))
    expect(dem).toEqual({ MOI: 2, DANG_LAM: 0, CHO_DUYET: 1, TRA_LAI: 0, BI_LOI: 0, HOAN_THANH: 0, HUY: 1 })
    expect(Object.keys(dem)).toEqual([...CAC_TRANG_THAI_TASK])
  })
})

describe('ngày hôm nay theo giờ Việt Nam', () => {
  it('23:59 ngày 25/11 giờ Việt Nam vẫn là 25/11, 00:00 ngày 26/11 giờ Việt Nam là 26/11', () => {
    expect(homNayGioVietNam(new Date('2026-11-25T23:59:00+07:00'))).toBe('2026-11-25')
    expect(homNayGioVietNam(new Date('2026-11-26T00:00:00+07:00'))).toBe('2026-11-26')
    // Cùng hai thời điểm viết theo UTC: 16:59Z và 17:00Z.
    expect(homNayGioVietNam(new Date('2026-11-25T16:59:59Z'))).toBe('2026-11-25')
    expect(homNayGioVietNam(new Date('2026-11-25T17:00:00Z'))).toBe('2026-11-26')
  })

  it('qua ranh giới tháng và năm', () => {
    expect(homNayGioVietNam(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01')
    expect(homNayGioVietNam(new Date('2026-02-28T20:00:00Z'))).toBe('2026-03-01')
  })
})

describe('Trễ hạn', () => {
  const homNay = new Date('2026-11-25T10:00:00+07:00')
  const task = (han: string | null, trangThai: TrangThaiTask) => ({ han, trangThai })

  it('hạn trước hôm nay và chưa Hoàn thành, chưa Huỷ là trễ', () => {
    for (const trangThai of ['MOI', 'DANG_LAM', 'TRA_LAI', 'BI_LOI'] as const) {
      expect(laTaskTreHan(task('2026-11-24', trangThai), homNay), trangThai).toBe(true)
    }
  })

  it('hạn bằng hôm nay thì chưa trễ; hạn sau hôm nay thì chưa trễ', () => {
    expect(laTaskTreHan(task('2026-11-25', 'MOI'), homNay)).toBe(false)
    expect(laTaskTreHan(task('2026-11-26', 'MOI'), homNay)).toBe(false)
  })

  it('Task đang Chờ duyệt quá hạn vẫn trễ', () => {
    expect(laTaskTreHan(task('2026-11-01', 'CHO_DUYET'), homNay)).toBe(true)
  })

  it('Task Hoàn thành hoặc Huỷ không bao giờ trễ', () => {
    expect(laTaskTreHan(task('2026-01-01', 'HOAN_THANH'), homNay)).toBe(false)
    expect(laTaskTreHan(task('2026-01-01', 'HUY'), homNay)).toBe(false)
  })

  it('Task không có hạn không bao giờ trễ', () => {
    for (const trangThai of CAC_TRANG_THAI_TASK) expect(laTaskTreHan(task(null, trangThai), homNay), trangThai).toBe(false)
  })

  it('mốc giờ Việt Nam: Task hạn 25/11 chưa trễ lúc 23:59 ngày 25/11, đã trễ lúc 00:00 ngày 26/11', () => {
    const t = task('2026-11-25', 'DANG_LAM')
    expect(laTaskTreHan(t, new Date('2026-11-25T23:59:00+07:00'))).toBe(false)
    expect(laTaskTreHan(t, new Date('2026-11-26T00:00:00+07:00'))).toBe(true)
    // Đúng cả khi viết theo UTC (máy ở múi giờ nào cũng cho cùng kết quả).
    expect(laTaskTreHan(t, new Date('2026-11-25T16:59:00Z'))).toBe(false)
    expect(laTaskTreHan(t, new Date('2026-11-25T17:00:00Z'))).toBe(true)
  })

  it('cờ Dự án Trễ hạn khi có ít nhất một Task Trễ hạn; lọc và xếp Task Trễ hạn', () => {
    const ds = [
      { tieuDe: 'B', han: '2026-11-20', trangThai: 'MOI' as const },
      { tieuDe: 'A', han: '2026-11-20', trangThai: 'CHO_DUYET' as const },
      { tieuDe: 'C', han: '2026-11-10', trangThai: 'MOI' as const },
      { tieuDe: 'D', han: '2026-11-25', trangThai: 'MOI' as const },
      { tieuDe: 'E', han: null, trangThai: 'MOI' as const },
    ]
    expect(duAnTreHan(ds, homNay)).toBe(true)
    expect(duAnTreHan(ds.slice(3), homNay)).toBe(false)
    expect(duAnTreHan([], homNay)).toBe(false)
    expect(xepTaskTreHan(taskTreHan(ds, homNay)).map((t) => t.tieuDe)).toEqual(['C', 'A', 'B'])
  })

  it('tóm tắt một Dự án: tiến độ, số theo trạng thái, cờ, số Task chưa chốt của riêng người xem', () => {
    const nguoi = (id: string) => ({ id })
    const t = (trangThai: TrangThaiTask, han: string | null, th: string, kt: string) => ({
      trangThai,
      han,
      nguoiThucHien: nguoi(th),
      nguoiKiemTra: nguoi(kt),
    })
    const tomTat = tomTatTienDoDuAn(
      [
        t('HOAN_THANH', null, 'an', 'binh'),
        t('MOI', '2026-11-01', 'an', 'binh'),
        t('CHO_DUYET', null, 'chi', 'an'),
        t('HUY', null, 'an', 'binh'),
        t('DANG_LAM', null, 'chi', 'binh'),
      ],
      homNay,
      'an',
    )
    expect(tomTat.tienDo).toEqual({ chuaCoTask: false, phanTram: 25 })
    expect(tomTat.treHan).toBe(true)
    expect(tomTat.soTaskTreHan).toBe(1)
    // An: Task Mới (thực hiện) và Chờ duyệt (kiểm tra); Hoàn thành và Huỷ không tính.
    expect(tomTat.soTaskChuaChotCuaToi).toBe(2)
    expect(tomTat.soTaskTheoTrangThai.CHO_DUYET).toBe(1)
  })
})

describe('Quá hạn dự kiến của Dự án', () => {
  /** Hôm nay là 26/11/2026 theo giờ Việt Nam. */
  const BAY_GIO = new Date('2026-11-26T10:00:00+07:00')
  const duAn = (ngayKetThucDuKien: string | null, trangThai: 'HOAT_DONG' | 'LUU_TRU' = 'HOAT_DONG') => ({
    trangThai,
    ngayKetThucDuKien,
  })
  const tienDo50 = tinhTienDo(tt('HOAN_THANH', 'MOI'))
  const tienDo100 = tinhTienDo(tt('HOAN_THANH', 'HOAN_THANH', 'HUY'))
  const chuaCoTask = tinhTienDo([])

  it.each([
    { ca: 'kết thúc hôm qua, Tiến độ 50%: quá hạn', da: duAn('2026-11-25'), tienDo: tienDo50, mong: true },
    { ca: 'kết thúc từ lâu, Tiến độ 50%: quá hạn', da: duAn('2025-01-01'), tienDo: tienDo50, mong: true },
    { ca: 'kết thúc hôm nay: chưa', da: duAn('2026-11-26'), tienDo: tienDo50, mong: false },
    { ca: 'kết thúc ngày mai: chưa', da: duAn('2026-11-27'), tienDo: tienDo50, mong: false },
    { ca: 'Tiến độ 100% dù đã qua ngày: không', da: duAn('2026-11-25'), tienDo: tienDo100, mong: false },
    { ca: 'Dự án Lưu trữ dù đã qua ngày: không', da: duAn('2026-11-25', 'LUU_TRU'), tienDo: tienDo50, mong: false },
    { ca: 'không có Ngày kết thúc dự kiến: không', da: duAn(null), tienDo: tienDo50, mong: false },
    { ca: '"chưa có task" mà đã qua ngày: có', da: duAn('2026-11-25'), tienDo: chuaCoTask, mong: true },
    { ca: '"chưa có task", kết thúc hôm nay: chưa', da: duAn('2026-11-26'), tienDo: chuaCoTask, mong: false },
  ])('$ca', ({ da, tienDo, mong }) => {
    expect(laDuAnQuaHanDuKien(da, tienDo, BAY_GIO)).toBe(mong)
  })

  it('Tiến độ 99% (làm tròn xuống) vẫn là chưa đủ', () => {
    const ds = [...lap('HOAN_THANH', 99), ...lap('DANG_LAM', 1)]
    expect(laDuAnQuaHanDuKien(duAn('2026-11-25'), tinhTienDo(ds), BAY_GIO)).toBe(true)
  })

  it('mốc theo giờ Việt Nam: kết thúc 25/11, lúc 23:59 ngày 25/11 chưa quá hạn, lúc 00:00 ngày 26/11 đã quá hạn', () => {
    const ketThuc2511 = duAn('2026-11-25')
    expect(laDuAnQuaHanDuKien(ketThuc2511, tienDo50, new Date('2026-11-25T23:59:00+07:00'))).toBe(false)
    expect(laDuAnQuaHanDuKien(ketThuc2511, tienDo50, new Date('2026-11-25T23:59:59.999+07:00'))).toBe(false)
    expect(laDuAnQuaHanDuKien(ketThuc2511, tienDo50, new Date('2026-11-26T00:00:00+07:00'))).toBe(true)
    // Cùng hai thời điểm viết theo UTC: 16:59 và 17:00 ngày 25/11.
    expect(laDuAnQuaHanDuKien(ketThuc2511, tienDo50, new Date('2026-11-25T16:59:00Z'))).toBe(false)
    expect(laDuAnQuaHanDuKien(ketThuc2511, tienDo50, new Date('2026-11-25T17:00:00Z'))).toBe(true)
  })
})

describe('số liệu của một Dự án cho bảng Dự án', () => {
  const HOM_NAY = new Date('2026-11-26T09:00:00+07:00')

  it('gom Tiến độ, số Task Trễ hạn và cờ Quá hạn dự kiến theo ngày hôm nay truyền vào', () => {
    const task = [
      { trangThai: 'HOAN_THANH' as const, han: '2026-11-01' },
      { trangThai: 'DANG_LAM' as const, han: '2026-11-25' },
      { trangThai: 'CHO_DUYET' as const, han: '2026-11-20' },
      { trangThai: 'MOI' as const, han: '2026-11-26' },
      { trangThai: 'HUY' as const, han: '2026-11-01' },
    ]
    expect(tinhSoLieuDuAn({ trangThai: 'HOAT_DONG', ngayKetThucDuKien: '2026-11-25' }, task, HOM_NAY)).toEqual({
      tienDo: { chuaCoTask: false, phanTram: 25 },
      soTaskTreHan: 2,
      quaHanDuKien: true,
    })
    // Cùng Task, sáu ngày trước: chưa Task nào qua hạn (hạn bằng hôm nay chưa trễ), Dự án chưa qua Ngày kết thúc dự kiến.
    expect(
      tinhSoLieuDuAn({ trangThai: 'HOAT_DONG', ngayKetThucDuKien: '2026-11-25' }, task, new Date('2026-11-20T09:00:00+07:00')),
    ).toEqual({ tienDo: { chuaCoTask: false, phanTram: 25 }, soTaskTreHan: 0, quaHanDuKien: false })
  })

  it('Dự án đã Lưu trữ, không có Ngày kết thúc dự kiến hay Tiến độ 100% thì không Quá hạn dự kiến; chưa có task vẫn Quá hạn', () => {
    const xong = [{ trangThai: 'HOAN_THANH' as const, han: null }]
    expect(tinhSoLieuDuAn({ trangThai: 'LUU_TRU', ngayKetThucDuKien: '2026-01-01' }, [], HOM_NAY).quaHanDuKien).toBe(false)
    expect(tinhSoLieuDuAn({ trangThai: 'HOAT_DONG', ngayKetThucDuKien: null }, [], HOM_NAY).quaHanDuKien).toBe(false)
    expect(tinhSoLieuDuAn({ trangThai: 'HOAT_DONG', ngayKetThucDuKien: '2026-01-01' }, xong, HOM_NAY).quaHanDuKien).toBe(false)
    expect(tinhSoLieuDuAn({ trangThai: 'HOAT_DONG', ngayKetThucDuKien: '2026-01-01' }, [], HOM_NAY)).toEqual({
      tienDo: { chuaCoTask: true },
      soTaskTreHan: 0,
      quaHanDuKien: true,
    })
  })
})
