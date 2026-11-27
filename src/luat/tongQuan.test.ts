import { describe, expect, it } from 'vitest'
import type { TrangThaiDuAn } from './duAn'
import type { TrangThaiTask } from './task'
import { congNgay, laTaskToiHan, tinhTongQuan, type DuAnKemTask, type TaskDeTinhTongQuan } from './tongQuan'

/** 10:00 ngày 26/11/2026 giờ Việt Nam: hôm nay là 2026-11-26, ngày thứ bảy là 2026-12-03. */
const BAY_GIO = new Date('2026-11-26T10:00:00+07:00')
const TOI = 'toi'
const KHAC = 'khac'

type TaskMau = TaskDeTinhTongQuan & { id: string }
type DuAnMau = {
  id: string
  ma: string
  ten: string
  trangThai: TrangThaiDuAn
  ngayKetThucDuKien: string | null
  nguoiPhuTrach: { id: string } | null
}

let dem = 0
function task(
  tieuDe: string,
  trangThai: TrangThaiTask = 'MOI',
  han: string | null = null,
  nguoi: { thucHien?: string; kiemTra?: string; thucHienDaRoi?: boolean; kiemTraDaRoi?: boolean } = {},
): TaskMau {
  dem += 1
  return {
    id: `t${dem}`,
    tieuDe,
    trangThai,
    han,
    nguoiThucHien: { id: nguoi.thucHien ?? KHAC, ...(nguoi.thucHienDaRoi ? { daRoiDuAn: true as const } : {}) },
    nguoiKiemTra: { id: nguoi.kiemTra ?? KHAC, ...(nguoi.kiemTraDaRoi ? { daRoiDuAn: true as const } : {}) },
  }
}

function duAn(ten: string, trangThai: TrangThaiDuAn, ...cacTask: TaskMau[]): DuAnKemTask<DuAnMau, TaskMau> {
  return {
    duAn: { id: `da-${ten}`, ma: `MA-${ten}`, ten, trangThai, ngayKetThucDuKien: null, nguoiPhuTrach: { id: KHAC } },
    task: cacTask,
  }
}

/** Như `duAn`, kèm Ngày kết thúc dự kiến và Người phụ trách (null là chưa có). */
function duAnCo(
  ten: string,
  trangThai: TrangThaiDuAn,
  them: { ngayKetThucDuKien?: string | null; nguoiPhuTrach?: { id: string } | null },
  ...cacTask: TaskMau[]
): DuAnKemTask<DuAnMau, TaskMau> {
  const kq = duAn(ten, trangThai, ...cacTask)
  return { ...kq, duAn: { ...kq.duAn, ...them } }
}

/** Hai Dự án đang hoạt động và một Dự án Lưu trữ, Task ở mọi trạng thái. */
function duLieuMau() {
  const cuaHang = duAn(
    'Cửa hàng',
    'HOAT_DONG',
    task('Mới của tôi', 'MOI', null, { thucHien: TOI }),
    task('Đang làm trễ', 'DANG_LAM', '2026-11-20', { thucHien: TOI }),
    task('Chờ tôi duyệt', 'CHO_DUYET', '2026-11-26', { kiemTra: TOI }),
    task('Trả lại', 'TRA_LAI', '2026-12-03'),
    task('Xong', 'HOAN_THANH', '2026-11-01', { thucHien: TOI }),
    task('Huỷ', 'HUY', '2026-11-01'),
  )
  const khoHang = duAn(
    'Kho hàng',
    'HOAT_DONG',
    task('Bị lỗi trễ', 'BI_LOI', '2026-11-25'),
    task('Chờ duyệt người khác', 'CHO_DUYET', null, { thucHien: TOI }),
  )
  const cu = duAn(
    'Dự án cũ',
    'LUU_TRU',
    task('Cũ trễ', 'DANG_LAM', '2026-10-01', { thucHien: TOI }),
    task('Cũ chờ tôi duyệt', 'CHO_DUYET', '2026-11-27', { kiemTra: TOI }),
    task('Cũ xong', 'HOAN_THANH'),
  )
  return [khoHang, cu, cuaHang]
}

describe('Tổng quan: năm ô số', () => {
  it('đếm đúng với Dự án đang hoạt động và Lưu trữ; Task của Dự án Lưu trữ không được tính', () => {
    const tq = tinhTongQuan(duLieuMau(), BAY_GIO, TOI, 'THANH_VIEN')
    expect(tq.oSo).toEqual({
      duAnDangHoatDong: 2,
      // Dữ liệu mẫu không có Ngày kết thúc dự kiến.
      duAnQuaHanDuKien: 0,
      // Cửa hàng: Mới, Đang làm, Chờ duyệt, Trả lại; Kho hàng: Bị lỗi, Chờ duyệt.
      taskDangMo: 6,
      // Đang làm trễ (20/11), Bị lỗi trễ (25/11); "Cũ trễ" thuộc Dự án Lưu trữ.
      taskTreHan: 2,
      // Chỉ "Chờ tôi duyệt"; "Cũ chờ tôi duyệt" thuộc Dự án Lưu trữ.
      choToiDuyet: 1,
      // Mới của tôi, Đang làm trễ, Chờ duyệt người khác; "Xong" đã chốt, "Cũ trễ" thuộc Dự án Lưu trữ.
      viecCuaToi: 3,
    })
  })

  it('Chờ tôi duyệt chỉ tính Task đang Chờ duyệt; Việc của tôi không tính Hoàn thành, Huỷ', () => {
    const tq = tinhTongQuan(
      [
        duAn(
          'A',
          'HOAT_DONG',
          task('Đang làm, tôi kiểm tra', 'DANG_LAM', null, { kiemTra: TOI }),
          task('Trả lại, tôi kiểm tra', 'TRA_LAI', null, { kiemTra: TOI }),
          task('Chờ duyệt, tôi kiểm tra', 'CHO_DUYET', null, { kiemTra: TOI }),
          task('Hoàn thành của tôi', 'HOAN_THANH', null, { thucHien: TOI }),
          task('Huỷ của tôi', 'HUY', null, { thucHien: TOI }),
          task('Bị lỗi của tôi', 'BI_LOI', null, { thucHien: TOI }),
        ),
      ],
      BAY_GIO,
      TOI,
      'THANH_VIEN',
    )
    expect(tq.oSo.choToiDuyet).toBe(1)
    expect(tq.oSo.viecCuaToi).toBe(1)
  })

  it('người đã bị gỡ khỏi Dự án mà vẫn được ghi trên Task thì Task đó không vào Chờ tôi duyệt, Việc của tôi', () => {
    const tq = tinhTongQuan(
      [
        duAn(
          'A',
          'HOAT_DONG',
          task('Đã rời, làm', 'MOI', null, { thucHien: TOI, thucHienDaRoi: true }),
          task('Đã rời, duyệt', 'CHO_DUYET', null, { kiemTra: TOI, kiemTraDaRoi: true }),
        ),
      ],
      BAY_GIO,
      TOI,
      'THANH_VIEN',
    )
    expect(tq.oSo.choToiDuyet).toBe(0)
    expect(tq.oSo.viecCuaToi).toBe(0)
    expect(tq.oSo.taskDangMo).toBe(2)
  })

  it('không có Dự án nào thì mọi số là 0 và các danh sách rỗng', () => {
    const tq = tinhTongQuan([], BAY_GIO, TOI, 'THANH_VIEN')
    expect(tq.oSo).toEqual({
      duAnDangHoatDong: 0,
      duAnQuaHanDuKien: 0,
      taskDangMo: 0,
      taskTreHan: 0,
      choToiDuyet: 0,
      viecCuaToi: 0,
    })
    expect(tq.hoatDong).toEqual([])
    expect(tq.taskTreHan).toEqual([])
    expect(tq.taskToiHan).toEqual([])
  })
})

describe('Tổng quan: bảng Dự án đang hoạt động', () => {
  it('chỉ Dự án đang hoạt động, xếp theo tên, kèm Tiến độ và số Task Trễ hạn', () => {
    const tq = tinhTongQuan(duLieuMau(), BAY_GIO, TOI, 'THANH_VIEN')
    expect(tq.hoatDong.map((d) => d.duAn.ten)).toEqual(['Cửa hàng', 'Kho hàng'])
    const [cuaHang, khoHang] = tq.hoatDong
    // 1 Hoàn thành trên 5 Task không Huỷ.
    expect(cuaHang.tomTat.tienDo).toEqual({ chuaCoTask: false, phanTram: 20 })
    expect(cuaHang.tomTat.soTaskTreHan).toBe(1)
    expect(cuaHang.taskTreHan.map((t) => t.tieuDe)).toEqual(['Đang làm trễ'])
    expect(khoHang.tomTat.tienDo).toEqual({ chuaCoTask: false, phanTram: 0 })
    expect(khoHang.tomTat.soTaskTreHan).toBe(1)
  })
})

describe('Tổng quan: Task Trễ hạn và Task tới hạn trong 7 ngày', () => {
  it('Task Trễ hạn qua mọi Dự án đang hoạt động, trễ lâu nhất trước, kèm tên Dự án', () => {
    const tq = tinhTongQuan(
      [
        duAn('A', 'HOAT_DONG', task('A trễ 1 ngày', 'MOI', '2026-11-25'), task('A trễ 10 ngày', 'CHO_DUYET', '2026-11-16')),
        duAn('B', 'HOAT_DONG', task('B trễ 3 ngày', 'TRA_LAI', '2026-11-23'), task('B xong', 'HOAN_THANH', '2026-11-01')),
        duAn('C', 'LUU_TRU', task('C trễ 30 ngày', 'MOI', '2026-10-27')),
      ],
      BAY_GIO,
      TOI,
      'THANH_VIEN',
    )
    expect(tq.taskTreHan.map((t) => [t.tieuDe, t.tenDuAn, t.maDuAn])).toEqual([
      ['A trễ 10 ngày', 'A', 'MA-A'],
      ['B trễ 3 ngày', 'B', 'MA-B'],
      ['A trễ 1 ngày', 'A', 'MA-A'],
    ])
  })

  it('tới hạn trong 7 ngày gồm hạn hôm nay và hạn ngày thứ bảy; không gồm ngày thứ tám, Trễ hạn, Hoàn thành, Huỷ', () => {
    const tq = tinhTongQuan(
      [
        duAn(
          'A',
          'HOAT_DONG',
          task('Hạn ngày thứ bảy', 'DANG_LAM', '2026-12-03'),
          task('Hạn hôm nay', 'MOI', '2026-11-26'),
          task('Hạn ngày mai, Chờ duyệt', 'CHO_DUYET', '2026-11-27'),
          task('Hạn ngày thứ tám', 'MOI', '2026-12-04'),
          task('Đã trễ', 'MOI', '2026-11-25'),
          task('Hoàn thành', 'HOAN_THANH', '2026-11-28'),
          task('Huỷ', 'HUY', '2026-11-28'),
          task('Không hạn', 'MOI', null),
        ),
        duAn('Lưu trữ', 'LUU_TRU', task('Lưu trữ hạn mai', 'MOI', '2026-11-27')),
      ],
      BAY_GIO,
      TOI,
      'THANH_VIEN',
    )
    expect(tq.taskToiHan.map((t) => t.tieuDe)).toEqual(['Hạn hôm nay', 'Hạn ngày mai, Chờ duyệt', 'Hạn ngày thứ bảy'])
    expect(tq.taskToiHan.every((t) => t.tenDuAn === 'A')).toBe(true)
    expect(tq.taskTreHan.map((t) => t.tieuDe)).toEqual(['Đã trễ'])
  })

  it('mốc ngày theo giờ Việt Nam: 23:59 và 00:00 giờ Việt Nam đổi "hôm nay"', () => {
    const hanHomNay = task('Hạn 25/11', 'MOI', '2026-11-25')
    const han2Thang12 = task('Hạn 02/12', 'MOI', '2026-12-02')
    // 23:59 ngày 25/11 giờ Việt Nam (16:59 UTC): hôm nay vẫn là 25/11, ngày thứ bảy là 02/12.
    const cuoiNgay = new Date('2026-11-25T23:59:00+07:00')
    expect(laTaskToiHan(hanHomNay, cuoiNgay)).toBe(true)
    expect(laTaskToiHan(han2Thang12, cuoiNgay)).toBe(true)
    // 00:00 ngày 26/11 giờ Việt Nam (vẫn là 25/11 theo UTC): Task hạn 25/11 đã trễ, không còn tới hạn.
    const dauNgaySau = new Date('2026-11-26T00:00:00+07:00')
    expect(laTaskToiHan(hanHomNay, dauNgaySau)).toBe(false)
    expect(laTaskToiHan(han2Thang12, dauNgaySau)).toBe(true)
    expect(tinhTongQuan([duAn('A', 'HOAT_DONG', hanHomNay)], dauNgaySau, TOI, 'THANH_VIEN').taskTreHan.map((t) => t.tieuDe)).toEqual([
      'Hạn 25/11',
    ])
  })

  it('cộng ngày qua cuối tháng và cuối năm', () => {
    expect(congNgay('2026-11-26', 7)).toBe('2026-12-03')
    expect(congNgay('2026-12-28', 7)).toBe('2027-01-04')
    expect(congNgay('2028-02-25', 7)).toBe('2028-03-03')
  })
})

describe('Tổng quan: phân bố Task theo trạng thái', () => {
  it('đếm đúng từng trạng thái của Task thuộc Dự án đang hoạt động, không tính Dự án Lưu trữ', () => {
    const tq = tinhTongQuan(duLieuMau(), BAY_GIO, TOI, 'THANH_VIEN')
    expect(tq.phanBo).toEqual({ MOI: 1, DANG_LAM: 1, CHO_DUYET: 2, TRA_LAI: 1, BI_LOI: 1, HOAN_THANH: 1, HUY: 1 })
  })
})

describe('Tổng quan: Dự án Quá hạn dự kiến', () => {
  it('đếm Dự án đang hoạt động đã qua Ngày kết thúc dự kiến mà Tiến độ chưa đủ 100%; Dự án Lưu trữ không được đếm', () => {
    const tq = tinhTongQuan(
      [
        // Kết thúc hôm qua, Tiến độ 50%: Quá hạn dự kiến.
        duAnCo('Quá hạn', 'HOAT_DONG', { ngayKetThucDuKien: '2026-11-25' }, task('Xong', 'HOAN_THANH'), task('Mới')),
        // Chưa có Task ("chưa có task") vẫn là chưa đủ 100%.
        duAnCo('Quá hạn chưa có task', 'HOAT_DONG', { ngayKetThucDuKien: '2026-11-01' }),
        // Kết thúc đúng hôm nay: chưa quá hạn.
        duAnCo('Kết thúc hôm nay', 'HOAT_DONG', { ngayKetThucDuKien: '2026-11-26' }, task('Mới')),
        // Tiến độ 100% (Huỷ không tính): không Quá hạn dự kiến.
        duAnCo('Xong hết', 'HOAT_DONG', { ngayKetThucDuKien: '2026-11-01' }, task('Xong', 'HOAN_THANH'), task('Huỷ', 'HUY')),
        // Chưa có Ngày kết thúc dự kiến.
        duAnCo('Không ngày', 'HOAT_DONG', { ngayKetThucDuKien: null }, task('Mới')),
        // Lưu trữ: không đếm, dù đã qua ngày và chưa xong.
        duAnCo('Lưu trữ quá hạn', 'LUU_TRU', { ngayKetThucDuKien: '2026-11-01' }, task('Mới')),
      ],
      BAY_GIO,
      TOI,
      'THANH_VIEN',
    )
    expect(tq.oSo.duAnQuaHanDuKien).toBe(2)
    expect(tq.oSo.duAnDangHoatDong).toBe(5)
    expect(tq.hoatDong.filter((d) => d.quaHanDuKien).map((d) => d.duAn.ten)).toEqual(['Quá hạn', 'Quá hạn chưa có task'])
    expect(tq.hoatDong.map((d) => d.duAn.ten)).not.toContain('Lưu trữ quá hạn')
  })

  it('mốc ngày theo giờ Việt Nam: kết thúc 25/11 chưa quá hạn lúc 23:59 ngày 25/11, đã quá hạn lúc 00:00 ngày 26/11', () => {
    const duLieu = [duAnCo('A', 'HOAT_DONG', { ngayKetThucDuKien: '2026-11-25' }, task('Mới'))]
    expect(tinhTongQuan(duLieu, new Date('2026-11-25T23:59:00+07:00'), TOI, 'PM').oSo.duAnQuaHanDuKien).toBe(0)
    expect(tinhTongQuan(duLieu, new Date('2026-11-26T00:00:00+07:00'), TOI, 'PM').oSo.duAnQuaHanDuKien).toBe(1)
  })
})

describe('Tổng quan: dấu "chưa có Người phụ trách"', () => {
  const duLieu = [
    duAnCo('Chưa phụ trách', 'HOAT_DONG', { nguoiPhuTrach: null }),
    duAnCo('Có phụ trách', 'HOAT_DONG', { nguoiPhuTrach: { id: KHAC } }),
    duAnCo('Lưu trữ chưa phụ trách', 'LUU_TRU', { nguoiPhuTrach: null }),
  ]

  it.each(['PM', 'SUPPORT'] as const)('%s thấy dấu trên đúng Dự án đang hoạt động chưa có Người phụ trách', (vai) => {
    const tq = tinhTongQuan(duLieu, BAY_GIO, TOI, vai)
    expect(tq.hoatDong.map((d) => [d.duAn.ten, d.chuaCoNguoiPhuTrach])).toEqual([
      ['Chưa phụ trách', true],
      ['Có phụ trách', false],
    ])
  })

  it('Thành viên không thấy dấu này', () => {
    const tq = tinhTongQuan(duLieu, BAY_GIO, TOI, 'THANH_VIEN')
    expect(tq.hoatDong.map((d) => d.chuaCoNguoiPhuTrach)).toEqual([false, false])
  })
})
