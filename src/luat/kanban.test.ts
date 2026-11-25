import { describe, expect, it } from 'vitest'
import {
  CAC_COT_KANBAN,
  LOC_TASK_TRONG,
  THONG_BAO_KANBAN,
  dangLoc,
  kiemTraLocTask,
  laChoToiDuyet,
  laTrangThaiDaChot,
  laViecCuaToi,
  locTask,
  nhomTheoCot,
  xepViecCaNhan,
  type LocTask,
} from './kanban'
import { CAC_TRANG_THAI_TASK, type TrangThaiTask } from './task'

interface TaskMau {
  tieuDe: string
  trangThai: TrangThaiTask
  nguoiThucHien: { id: string }
  nguoiKiemTra: { id: string }
  dauVet: { taoLuc: Date }
}

function task(tieuDe: string, trangThai: TrangThaiTask, thucHien = 'an', kiemTra = 'binh', ngay = 1): TaskMau {
  return {
    tieuDe,
    trangThai,
    nguoiThucHien: { id: thucHien },
    nguoiKiemTra: { id: kiemTra },
    dauVet: { taoLuc: new Date(2026, 0, ngay) },
  }
}

const loc = (sua: Partial<LocTask>): LocTask => ({ ...LOC_TASK_TRONG, ...sua })

describe('các cột Kanban', () => {
  it('đúng bảy cột theo thứ tự Mới, Đang làm, Chờ duyệt, Trả lại, Bị lỗi, Hoàn thành, Huỷ', () => {
    expect(CAC_COT_KANBAN).toEqual(['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI', 'HOAN_THANH', 'HUY'])
  })

  it('mỗi Task nằm đúng một cột theo trạng thái; cột nào cũng có mặt, kể cả cột rỗng', () => {
    const danhSach = CAC_TRANG_THAI_TASK.flatMap((trangThai) => [task(`${trangThai} 1`, trangThai)]).concat(
      task('Đang làm 2', 'DANG_LAM'),
    )
    const cot = nhomTheoCot(danhSach)
    expect(Object.keys(cot)).toEqual([...CAC_TRANG_THAI_TASK])
    expect(cot.DANG_LAM.map((t) => t.tieuDe).sort()).toEqual(['DANG_LAM 1', 'Đang làm 2'])
    expect(cot.HUY.map((t) => t.tieuDe)).toEqual(['HUY 1'])
    expect(Object.values(cot).flat()).toHaveLength(danhSach.length)

    const rong = nhomTheoCot([])
    expect(Object.keys(rong)).toEqual([...CAC_TRANG_THAI_TASK])
    expect(Object.values(rong).every((c) => c.length === 0)).toBe(true)
  })

  it('trong một cột, Task mới tạo xếp trước', () => {
    const cot = nhomTheoCot([task('Cũ', 'MOI', 'an', 'binh', 1), task('Mới', 'MOI', 'an', 'binh', 5)])
    expect(cot.MOI.map((t) => t.tieuDe)).toEqual(['Mới', 'Cũ'])
  })
})

describe('lọc Task', () => {
  const danhSach = [
    task('A', 'MOI', 'an', 'binh'),
    task('B', 'DANG_LAM', 'an', 'chi'),
    task('C', 'DANG_LAM', 'binh', 'an'),
    task('D', 'HOAN_THANH', 'chi', 'binh'),
  ]
  const tieuDe = (ds: TaskMau[]) => ds.map((t) => t.tieuDe)

  it('không lọc gì thì trả đủ và đúng thứ tự', () => {
    expect(tieuDe(locTask(danhSach, LOC_TASK_TRONG))).toEqual(['A', 'B', 'C', 'D'])
    expect(dangLoc(LOC_TASK_TRONG)).toBe(false)
  })

  it('lọc theo Người thực hiện, theo Người kiểm tra và theo trạng thái', () => {
    expect(tieuDe(locTask(danhSach, loc({ nguoiThucHienId: 'an' })))).toEqual(['A', 'B'])
    expect(tieuDe(locTask(danhSach, loc({ nguoiKiemTraId: 'binh' })))).toEqual(['A', 'D'])
    expect(tieuDe(locTask(danhSach, loc({ trangThai: 'DANG_LAM' })))).toEqual(['B', 'C'])
    expect(dangLoc(loc({ trangThai: 'MOI' }))).toBe(true)
  })

  it('kết hợp nhiều bộ lọc cùng lúc là "và"', () => {
    expect(tieuDe(locTask(danhSach, loc({ nguoiThucHienId: 'an', trangThai: 'DANG_LAM' })))).toEqual(['B'])
    expect(
      tieuDe(locTask(danhSach, loc({ nguoiThucHienId: 'an', nguoiKiemTraId: 'chi', trangThai: 'DANG_LAM' }))),
    ).toEqual(['B'])
    expect(locTask(danhSach, loc({ nguoiThucHienId: 'an', nguoiKiemTraId: 'an' }))).toEqual([])
  })

  it('bỏ lọc thì trả lại đầy đủ', () => {
    const daLoc = locTask(danhSach, loc({ trangThai: 'HUY' }))
    expect(daLoc).toEqual([])
    expect(locTask(danhSach, LOC_TASK_TRONG)).toHaveLength(danhSach.length)
  })

  it('không đổi danh sách đầu vào', () => {
    const truoc = [...danhSach]
    locTask(danhSach, loc({ nguoiThucHienId: 'an' }))
    expect(danhSach).toEqual(truoc)
  })
})

describe('kiểm bộ lọc ở ranh giới', () => {
  it('trống, null hay thiếu là không lọc; có giá trị thì giữ', () => {
    expect(kiemTraLocTask.loc({})).toEqual({ ok: true, giaTri: LOC_TASK_TRONG })
    expect(kiemTraLocTask.loc({ nguoiThucHienId: '', nguoiKiemTraId: null, trangThai: ' ' })).toEqual({
      ok: true,
      giaTri: LOC_TASK_TRONG,
    })
    expect(kiemTraLocTask.loc({ nguoiThucHienId: ' an ', nguoiKiemTraId: 'binh', trangThai: 'CHO_DUYET' })).toEqual({
      ok: true,
      giaTri: { nguoiThucHienId: 'an', nguoiKiemTraId: 'binh', trangThai: 'CHO_DUYET' },
    })
  })

  it('trạng thái không có thật bị từ chối bằng tiếng Việt', () => {
    expect(kiemTraLocTask.loc({ trangThai: 'XOA' })).toEqual({
      ok: false,
      loiTheoO: { trangThai: THONG_BAO_KANBAN.trangThaiLocSai },
    })
    expect(kiemTraLocTask.loc({ nguoiThucHienId: 5 })).toEqual({
      ok: false,
      loiTheoO: { nguoiThucHienId: THONG_BAO_KANBAN.nguoiLocSai },
    })
  })
})

describe('danh sách cá nhân', () => {
  it('"Việc của tôi": mình là Người thực hiện và chưa Hoàn thành, chưa Huỷ', () => {
    for (const trangThai of CAC_TRANG_THAI_TASK) {
      expect(laViecCuaToi(task('X', trangThai, 'an', 'binh'), 'an')).toBe(!laTrangThaiDaChot(trangThai))
      expect(laViecCuaToi(task('X', trangThai, 'an', 'binh'), 'binh')).toBe(false)
    }
    expect(laTrangThaiDaChot('HOAN_THANH')).toBe(true)
    expect(laTrangThaiDaChot('HUY')).toBe(true)
  })

  it('"Chờ tôi duyệt": mình là Người kiểm tra và Task đang Chờ duyệt', () => {
    for (const trangThai of CAC_TRANG_THAI_TASK) {
      expect(laChoToiDuyet(task('X', trangThai, 'an', 'binh'), 'binh')).toBe(trangThai === 'CHO_DUYET')
      expect(laChoToiDuyet(task('X', trangThai, 'an', 'binh'), 'an')).toBe(false)
    }
  })

  it('xếp theo tên Dự án, rồi hạn gần nhất trước (không hạn xếp sau), rồi tiêu đề', () => {
    const mau = (tenDuAn: string, han: string | null, tieuDe: string) => ({ tenDuAn, han, tieuDe })
    const xep = xepViecCaNhan([
      mau('Kho', null, 'a'),
      mau('Cửa hàng', '2026-05-01', 'z'),
      mau('Cửa hàng', '2026-04-01', 'y'),
      mau('Cửa hàng', null, 'b'),
      mau('Cửa hàng', '2026-04-01', 'x'),
    ])
    expect(xep.map((m) => `${m.tenDuAn}|${m.han}|${m.tieuDe}`)).toEqual([
      'Cửa hàng|2026-04-01|x',
      'Cửa hàng|2026-04-01|y',
      'Cửa hàng|2026-05-01|z',
      'Cửa hàng|null|b',
      'Kho|null|a',
    ])
  })
})
