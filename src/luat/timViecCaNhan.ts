// Luật thuần tìm và lọc hai danh sách cá nhân ("Việc của tôi", "Chờ tôi duyệt"): ô tìm theo tiêu đề Task,
// Mã Dự án hoặc tên Dự án (bỏ qua hoa thường, dấu tiếng Việt, khoảng trắng hai đầu), chip Trạng thái,
// chip Mức ưu tiên và chip Trễ hạn. Trong một nhóm chip là "hoặc", giữa các nhóm và với từ khoá là "và".
// Chạy trên danh sách đã đọc từ Kho dữ liệu. Không I/O, không đọc đồng hồ: thời điểm hiện tại truyền vào.
import { z } from 'zod'
import { kiemTra, type KiemTra } from './taiKhoan'
import { CAC_MUC_UU_TIEN, type MucUuTien } from './mucUuTien'
import { CAC_TRANG_THAI_TASK, type TrangThaiTask } from './task'
import { laTaskTreHan, type TaskDeTinhTienDo } from './tienDo'
import { chuanHoaDeTim } from './timDuAn'

/**
 * Các chip Trạng thái của "Việc của tôi": mọi trạng thái chưa chốt (Task Hoàn thành hay Huỷ không bao
 * giờ có ở đây). "Chờ tôi duyệt" không có nhóm này vì mọi Task ở đó đều Chờ duyệt.
 */
export const CAC_TRANG_THAI_LOC_VIEC_CA_NHAN = ['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI'] as const satisfies readonly TrangThaiTask[]

export const THONG_BAO_TIM_VIEC_CA_NHAN = {
  tuKhoaSai: 'Từ khoá tìm không hợp lệ.',
  trangThaiLocSai: 'Trạng thái lọc không hợp lệ.',
  mucUuTienLocSai: 'Mức ưu tiên lọc không hợp lệ.',
  treHanSai: 'Lọc Trễ hạn không hợp lệ.',
} as const

/**
 * Bộ tìm và lọc việc cá nhân. Nhóm rỗng (hay `treHan` tắt) là không lọc theo nhóm đó. `tuKhoa` giữ
 * nguyên chữ người dùng gõ (kể cả khoảng trắng) để ô tìm không nhảy; so khớp tự chuẩn hoá.
 */
export interface LocViecCaNhan {
  tuKhoa: string
  trangThai: readonly TrangThaiTask[]
  mucUuTien: readonly MucUuTien[]
  treHan: boolean
}

/** Không tìm, không lọc gì: trả lại đầy đủ. Cũng là bộ lọc mỗi lần mở trang. */
export const LOC_VIEC_CA_NHAN_TRONG: LocViecCaNhan = { tuKhoa: '', trangThai: [], mucUuTien: [], treHan: false }

/** Dữ liệu bộ lọc vào từ giao diện (ô tìm, nhóm chip); thiếu hay null là không lọc theo tiêu chí đó. */
export const locViecCaNhanSchema = z.object({
  tuKhoa: z.string({ error: THONG_BAO_TIM_VIEC_CA_NHAN.tuKhoaSai }).nullish(),
  trangThai: z
    .array(z.enum(CAC_TRANG_THAI_TASK, { error: THONG_BAO_TIM_VIEC_CA_NHAN.trangThaiLocSai }), {
      error: THONG_BAO_TIM_VIEC_CA_NHAN.trangThaiLocSai,
    })
    .nullish(),
  mucUuTien: z
    .array(z.enum(CAC_MUC_UU_TIEN, { error: THONG_BAO_TIM_VIEC_CA_NHAN.mucUuTienLocSai }), {
      error: THONG_BAO_TIM_VIEC_CA_NHAN.mucUuTienLocSai,
    })
    .nullish(),
  treHan: z.boolean({ error: THONG_BAO_TIM_VIEC_CA_NHAN.treHanSai }).nullish(),
})

/** Kiểm bộ lọc ở ranh giới (giao diện); trả lỗi theo từng ô bằng tiếng Việt. Giá trị trùng chỉ giữ một. */
export const kiemTraLocViecCaNhan = {
  loc: (dauVao: unknown): KiemTra<LocViecCaNhan> => {
    const kt = kiemTra(locViecCaNhanSchema, dauVao)
    if (!kt.ok) return kt
    const { tuKhoa, trangThai, mucUuTien, treHan } = kt.giaTri
    return {
      ok: true,
      giaTri: {
        tuKhoa: tuKhoa ?? '',
        trangThai: [...new Set(trangThai ?? [])],
        mucUuTien: [...new Set(mucUuTien ?? [])],
        treHan: treHan ?? false,
      },
    }
  },
}

/** Phần Task (kèm Dự án) mà luật tìm và lọc việc cá nhân cần đọc. */
export interface TaskDeLocViecCaNhan extends TaskDeTinhTienDo {
  tieuDe: string
  maDuAn: string
  tenDuAn: string
  mucUuTien: MucUuTien
}

/**
 * Task có khớp từ khoá không: từ khoá (đã chuẩn hoá như ô tìm Dự án) nằm trong tiêu đề Task, Mã Dự án
 * hoặc tên Dự án. Từ khoá rỗng hay chỉ có khoảng trắng luôn khớp.
 */
export function khopTuKhoaViecCaNhan(
  task: Pick<TaskDeLocViecCaNhan, 'tieuDe' | 'maDuAn' | 'tenDuAn'>,
  tuKhoa: string,
): boolean {
  const can = chuanHoaDeTim(tuKhoa)
  if (can === '') return true
  return [task.tieuDe, task.maDuAn, task.tenDuAn].some((chu) => chuanHoaDeTim(chu).includes(can))
}

/** Có đang tìm hay lọc không: từ khoá khác trống (sau khi bỏ khoảng trắng hai đầu) hoặc có chip được bật. */
export function dangLocViecCaNhan(loc: LocViecCaNhan): boolean {
  return chuanHoaDeTim(loc.tuKhoa) !== '' || loc.trangThai.length > 0 || loc.mucUuTien.length > 0 || loc.treHan
}

/**
 * Tìm và lọc việc cá nhân: Task giữ lại khi khớp từ khoá, khớp một trong các Trạng thái được chọn, khớp
 * một trong các Mức ưu tiên được chọn, và Trễ hạn khi chip Trễ hạn bật (luật Trễ hạn theo ngày giờ Việt
 * Nam tại `bayGio`). Nhóm không chọn gì thì không lọc theo nhóm đó. Giữ nguyên thứ tự đầu vào.
 */
export function locViecCaNhan<T extends TaskDeLocViecCaNhan>(
  danhSach: readonly T[],
  loc: LocViecCaNhan,
  bayGio: Date,
): T[] {
  return danhSach.filter(
    (task) =>
      khopTuKhoaViecCaNhan(task, loc.tuKhoa) &&
      (loc.trangThai.length === 0 || loc.trangThai.includes(task.trangThai)) &&
      (loc.mucUuTien.length === 0 || loc.mucUuTien.includes(task.mucUuTien)) &&
      (!loc.treHan || laTaskTreHan(task, bayGio)),
  )
}

/** Số Task khớp từng chip. */
export interface SoChipViecCaNhan {
  trangThai: Record<TrangThaiTask, number>
  mucUuTien: Record<MucUuTien, number>
  treHan: number
}

/**
 * Số Task khớp từng chip, đếm trên toàn danh sách đã đọc: mỗi chip đếm riêng, không phụ thuộc chip khác
 * hay từ khoá, nên số trên chip không đổi khi người dùng bật tắt chip khác hay gõ tìm. Chip không có Task
 * nào là 0.
 */
export function demChipViecCaNhan(danhSach: readonly TaskDeLocViecCaNhan[], bayGio: Date): SoChipViecCaNhan {
  const trangThai = Object.fromEntries(CAC_TRANG_THAI_TASK.map((tt) => [tt, 0])) as Record<TrangThaiTask, number>
  const mucUuTien = Object.fromEntries(CAC_MUC_UU_TIEN.map((muc) => [muc, 0])) as Record<MucUuTien, number>
  let treHan = 0
  for (const task of danhSach) {
    trangThai[task.trangThai] += 1
    mucUuTien[task.mucUuTien] += 1
    if (laTaskTreHan(task, bayGio)) treHan += 1
  }
  return { trangThai, mucUuTien, treHan }
}
