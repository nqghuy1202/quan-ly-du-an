// Luật thuần cho bảng Kanban và hai danh sách cá nhân ("Việc của tôi", "Chờ tôi duyệt"): nhóm Task
// theo cột trạng thái, lọc, và Task nào thuộc danh sách cá nhân của ai. Không I/O, không đọc đồng hồ.
// Kho dữ liệu (hai danh sách cá nhân) và giao diện (bảng, bộ lọc) cùng dùng các hàm ở đây.
import { z } from 'zod'
import { kiemTra, type KiemTra } from './taiKhoan'
import { CAC_TRANG_THAI_TASK, xepTask, type TrangThaiTask } from './task'
import { CAC_MUC_UU_TIEN, type MucUuTien } from './mucUuTien'

/** Các cột của bảng Kanban: đúng bảy trạng thái, theo thứ tự của `CAC_TRANG_THAI_TASK`. */
export const CAC_COT_KANBAN = CAC_TRANG_THAI_TASK

export const THONG_BAO_KANBAN = {
  trangThaiLocSai: 'Trạng thái lọc không hợp lệ.',
  nguoiLocSai: 'Người được chọn để lọc không hợp lệ.',
  mucUuTienLocSai: 'Mức ưu tiên lọc không hợp lệ.',
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
  mucUuTien: MucUuTien | null
}

/** Không lọc gì: trả lại đầy đủ. */
export const LOC_TASK_TRONG: LocTask = { nguoiThucHienId: null, nguoiKiemTraId: null, trangThai: null, mucUuTien: null }

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
  mucUuTien: z
    .string({ error: THONG_BAO_KANBAN.mucUuTienLocSai })
    .refine((giaTri) => giaTri.trim() === '' || (CAC_MUC_UU_TIEN as readonly string[]).includes(giaTri.trim()), {
      error: THONG_BAO_KANBAN.mucUuTienLocSai,
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
    const { nguoiThucHienId, nguoiKiemTraId, trangThai, mucUuTien } = kt.giaTri
    const trangThaiLoc = chuoiHoacNull(trangThai)
    return {
      ok: true,
      giaTri: {
        nguoiThucHienId: chuoiHoacNull(nguoiThucHienId),
        nguoiKiemTraId: chuoiHoacNull(nguoiKiemTraId),
        // Đã qua refine: chuỗi không rỗng chắc chắn là một trạng thái.
        trangThai: trangThaiLoc as TrangThaiTask | null,
        // Như trạng thái: chuỗi không rỗng chắc chắn là một Mức ưu tiên.
        mucUuTien: chuoiHoacNull(mucUuTien) as MucUuTien | null,
      },
    }
  },
}

/** Có đang lọc theo tiêu chí nào không. */
export function dangLoc(loc: LocTask): boolean {
  return (
    loc.nguoiThucHienId !== null || loc.nguoiKiemTraId !== null || loc.trangThai !== null || loc.mucUuTien !== null
  )
}

interface TaskDeLoc {
  trangThai: TrangThaiTask
  mucUuTien: MucUuTien
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
      (loc.trangThai === null || task.trangThai === loc.trangThai) &&
      (loc.mucUuTien === null || task.mucUuTien === loc.mucUuTien),
  )
}

/** Hạng của Mức ưu tiên trong cột Kanban: số nhỏ đứng trước (Cao, rồi Trung bình, rồi Thấp). */
const HANG_MUC_UU_TIEN: Record<MucUuTien, number> = { CAO: 0, TRUNG_BINH: 1, THAP: 2 }

/** Task đủ trường để xếp trong một cột Kanban. */
interface TaskDeXep {
  mucUuTien: MucUuTien
  /** `YYYY-MM-DD` hoặc null khi không có hạn. */
  han: string | null
  tieuDe: string
  dauVet: { taoLuc: Date }
}

/**
 * Thứ tự trong một cột Kanban: Mức ưu tiên Cao, rồi Trung bình, rồi Thấp; cùng mức thì hạn gần nhất
 * trước, Task không có hạn đứng sau; còn bằng nhau thì theo thứ tự hiện có (`xepTask`: mới tạo trước,
 * rồi theo tiêu đề). Không đổi danh sách đầu vào.
 */
export function xepTrongCot<T extends TaskDeXep>(danhSach: readonly T[]): T[] {
  const thuTuCu = new Map<T, number>(xepTask(danhSach).map((task, i) => [task, i]))
  return [...danhSach].sort((a, b) => {
    const theoMuc = HANG_MUC_UU_TIEN[a.mucUuTien] - HANG_MUC_UU_TIEN[b.mucUuTien]
    if (theoMuc !== 0) return theoMuc
    if (a.han !== b.han) {
      if (a.han === null) return 1
      if (b.han === null) return -1
      return a.han < b.han ? -1 : 1
    }
    return (thuTuCu.get(a) ?? 0) - (thuTuCu.get(b) ?? 0)
  })
}

/**
 * Chia Task vào bảy cột theo trạng thái: mỗi Task nằm đúng một cột, cột nào cũng có mặt (có thể
 * rỗng). Trong mỗi cột, Task xếp theo `xepTrongCot` (Mức ưu tiên, rồi hạn, rồi mới tạo trước).
 */
export function nhomTheoCot<T extends TaskDeLoc & TaskDeXep>(danhSach: readonly T[]): Record<TrangThaiTask, T[]> {
  const cot = Object.fromEntries(CAC_COT_KANBAN.map((trangThai) => [trangThai, [] as T[]])) as Record<
    TrangThaiTask,
    T[]
  >
  for (const task of xepTrongCot(danhSach)) cot[task.trangThai].push(task)
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
