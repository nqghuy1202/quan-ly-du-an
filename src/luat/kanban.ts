// Luật thuần cho bảng Kanban và hai danh sách cá nhân ("Việc của tôi", "Chờ tôi duyệt"): nhóm Task
// theo cột trạng thái, lọc, và Task nào thuộc danh sách cá nhân của ai. Không I/O, không đọc đồng hồ.
// Kho dữ liệu (hai danh sách cá nhân) và giao diện (bảng, bộ lọc) cùng dùng các hàm ở đây.
import { z } from 'zod'
import { kiemTra, type KiemTra } from './taiKhoan'
import { CAC_TRANG_THAI_TASK, xepTask, type TrangThaiTask } from './task'

/** Các cột của bảng Kanban: đúng bảy trạng thái, theo thứ tự của `CAC_TRANG_THAI_TASK`. */
export const CAC_COT_KANBAN = CAC_TRANG_THAI_TASK

export const THONG_BAO_KANBAN = {
  trangThaiLocSai: 'Trạng thái lọc không hợp lệ.',
  nguoiLocSai: 'Người được chọn để lọc không hợp lệ.',
} as const

/** Task đã chốt (Hoàn thành hoặc Huỷ): không còn là việc phải làm. */
export function laTrangThaiDaChot(trangThai: TrangThaiTask): boolean {
  return trangThai === 'HOAN_THANH' || trangThai === 'HUY'
}

/** Bộ lọc của bảng Kanban; `null` ở một tiêu chí là không lọc theo tiêu chí đó. */
export interface LocTask {
  nguoiThucHienId: string | null
  nguoiKiemTraId: string | null
  trangThai: TrangThaiTask | null
}

/** Không lọc gì: trả lại đầy đủ. */
export const LOC_TASK_TRONG: LocTask = { nguoiThucHienId: null, nguoiKiemTraId: null, trangThai: null }

const idNguoiLoc = z.string({ error: THONG_BAO_KANBAN.nguoiLocSai }).nullish()

/** Dữ liệu bộ lọc vào từ giao diện; trống, null hay thiếu là không lọc tiêu chí đó. */
export const locTaskSchema = z.object({
  nguoiThucHienId: idNguoiLoc,
  nguoiKiemTraId: idNguoiLoc,
  trangThai: z
    .string({ error: THONG_BAO_KANBAN.trangThaiLocSai })
    .refine((giaTri) => giaTri.trim() === '' || (CAC_TRANG_THAI_TASK as readonly string[]).includes(giaTri.trim()), {
      error: THONG_BAO_KANBAN.trangThaiLocSai,
    })
    .nullish(),
})

function chuoiHoacNull(giaTri: string | null | undefined): string | null {
  const daCat = (giaTri ?? '').trim()
  return daCat === '' ? null : daCat
}

/** Kiểm bộ lọc ở ranh giới (giao diện); trả lỗi theo từng ô bằng tiếng Việt. */
export const kiemTraLocTask = {
  loc: (dauVao: unknown): KiemTra<LocTask> => {
    const kt = kiemTra(locTaskSchema, dauVao)
    if (!kt.ok) return kt
    const { nguoiThucHienId, nguoiKiemTraId, trangThai } = kt.giaTri
    const trangThaiLoc = chuoiHoacNull(trangThai)
    return {
      ok: true,
      giaTri: {
        nguoiThucHienId: chuoiHoacNull(nguoiThucHienId),
        nguoiKiemTraId: chuoiHoacNull(nguoiKiemTraId),
        // Đã qua refine: chuỗi không rỗng chắc chắn là một trạng thái.
        trangThai: trangThaiLoc as TrangThaiTask | null,
      },
    }
  },
}

/** Có đang lọc theo tiêu chí nào không. */
export function dangLoc(loc: LocTask): boolean {
  return loc.nguoiThucHienId !== null || loc.nguoiKiemTraId !== null || loc.trangThai !== null
}

interface TaskDeLoc {
  trangThai: TrangThaiTask
  nguoiThucHien: { id: string }
  nguoiKiemTra: { id: string }
}

/**
 * Lọc Task: một Task giữ lại khi khớp mọi tiêu chí đang bật (kết hợp bằng "và"); không bật tiêu
 * chí nào thì giữ nguyên toàn bộ. Giữ nguyên thứ tự đầu vào.
 */
export function locTask<T extends TaskDeLoc>(danhSach: readonly T[], loc: LocTask): T[] {
  return danhSach.filter(
    (task) =>
      (loc.nguoiThucHienId === null || task.nguoiThucHien.id === loc.nguoiThucHienId) &&
      (loc.nguoiKiemTraId === null || task.nguoiKiemTra.id === loc.nguoiKiemTraId) &&
      (loc.trangThai === null || task.trangThai === loc.trangThai),
  )
}

/**
 * Chia Task vào bảy cột theo trạng thái: mỗi Task nằm đúng một cột, cột nào cũng có mặt (có thể
 * rỗng). Trong mỗi cột, Task mới tạo xếp trước (xem `xepTask`).
 */
export function nhomTheoCot<T extends TaskDeLoc & { tieuDe: string; dauVet: { taoLuc: Date } }>(
  danhSach: readonly T[],
): Record<TrangThaiTask, T[]> {
  const cot = Object.fromEntries(CAC_COT_KANBAN.map((trangThai) => [trangThai, [] as T[]])) as Record<
    TrangThaiTask,
    T[]
  >
  for (const task of xepTask(danhSach)) cot[task.trangThai].push(task)
  return cot
}

/** Task có phải "Việc của tôi" của `nguoiDungId` không: mình là Người thực hiện, chưa Hoàn thành, chưa Huỷ. */
export function laViecCuaToi(
  task: { trangThai: TrangThaiTask; nguoiThucHien: { id: string } },
  nguoiDungId: string,
): boolean {
  return task.nguoiThucHien.id === nguoiDungId && !laTrangThaiDaChot(task.trangThai)
}

/** Task có phải "Chờ tôi duyệt" của `nguoiDungId` không: mình là Người kiểm tra và Task đang Chờ duyệt. */
export function laChoToiDuyet(
  task: { trangThai: TrangThaiTask; nguoiKiemTra: { id: string } },
  nguoiDungId: string,
): boolean {
  return task.nguoiKiemTra.id === nguoiDungId && task.trangThai === 'CHO_DUYET'
}

/**
 * Xếp một danh sách cá nhân: theo tên Dự án (thứ tự tiếng Việt), rồi Task có hạn gần nhất trước
 * (Task không có hạn xếp sau), rồi theo tiêu đề.
 */
export function xepViecCaNhan<T extends { tenDuAn: string; han: string | null; tieuDe: string }>(
  danhSach: readonly T[],
): T[] {
  return [...danhSach].sort((a, b) => {
    const theoDuAn = a.tenDuAn.localeCompare(b.tenDuAn, 'vi')
    if (theoDuAn !== 0) return theoDuAn
    if (a.han !== b.han) {
      if (a.han === null) return 1
      if (b.han === null) return -1
      return a.han < b.han ? -1 : 1
    }
    return a.tieuDe.localeCompare(b.tieuDe, 'vi')
  })
}
