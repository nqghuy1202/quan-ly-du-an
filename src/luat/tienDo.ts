// Luật thuần về Tiến độ và Trễ hạn của Dự án. Không I/O, không đọc đồng hồ: "ngày hôm nay" luôn
// được truyền vào (một thời điểm `Date`, đổi sang ngày theo giờ Việt Nam ở đây).
// Kho dữ liệu và giao diện cùng dùng các hàm ở đây.
import type { TrangThaiDuAn } from './duAn'
import { CAC_TRANG_THAI_TASK, laTaskDaChot, type TrangThaiTask } from './task'

/** Việt Nam lệch UTC +7 quanh năm, không có giờ mùa hè nên cộng thẳng 7 giờ là đủ. */
const MUOI_BAY_GIO_MS = 7 * 60 * 60 * 1000

/**
 * Ngày hôm nay theo giờ Việt Nam, dạng `YYYY-MM-DD`, từ một thời điểm. Không phụ thuộc múi giờ của
 * máy: 23:59 ngày 25/11 giờ Việt Nam vẫn là 2026-11-25, 00:00 ngày 26/11 giờ Việt Nam đã là 2026-11-26.
 */
export function homNayGioVietNam(bayGio: Date): string {
  return new Date(bayGio.getTime() + MUOI_BAY_GIO_MS).toISOString().slice(0, 10)
}

/** Phần Task mà các luật ở đây cần đọc. */
export interface TaskDeTinhTienDo {
  /** `YYYY-MM-DD`; null khi không có hạn. */
  han: string | null
  trangThai: TrangThaiTask
}

/**
 * Task có Trễ hạn không: có hạn, hạn trước ngày hôm nay (theo giờ Việt Nam), và chưa Hoàn thành,
 * chưa Huỷ. Hạn bằng hôm nay thì chưa trễ; Task đang Chờ duyệt vẫn là chưa hoàn thành nên vẫn trễ;
 * Task không có hạn không bao giờ trễ.
 */
export function laTaskTreHan(task: TaskDeTinhTienDo, bayGio: Date): boolean {
  if (task.han === null || laTaskDaChot(task.trangThai)) return false
  // `YYYY-MM-DD` cùng độ dài nên so chuỗi chính là so ngày.
  return task.han < homNayGioVietNam(bayGio)
}

/** Các Task Trễ hạn trong danh sách, giữ nguyên thứ tự đầu vào. */
export function taskTreHan<T extends TaskDeTinhTienDo>(danhSach: readonly T[], bayGio: Date): T[] {
  return danhSach.filter((task) => laTaskTreHan(task, bayGio))
}

/** Dự án có cờ Trễ hạn khi có ít nhất một Task Trễ hạn. */
export function duAnTreHan(danhSach: readonly TaskDeTinhTienDo[], bayGio: Date): boolean {
  return danhSach.some((task) => laTaskTreHan(task, bayGio))
}

/**
 * Tiến độ của Dự án: `chuaCoTask` khi không có Task nào đáng tính (chưa có Task, hoặc toàn Huỷ);
 * ngược lại là số nguyên phần trăm làm tròn xuống, nên 100 chỉ có khi mọi Task đáng tính đã Hoàn thành.
 */
export type TienDo = { chuaCoTask: true } | { chuaCoTask: false; phanTram: number }

/** Tiến độ = số Task Hoàn thành chia (tổng Task trừ Task Huỷ), làm tròn xuống. */
export function tinhTienDo(danhSach: readonly Pick<TaskDeTinhTienDo, 'trangThai'>[]): TienDo {
  const mau = danhSach.filter((task) => task.trangThai !== 'HUY').length
  if (mau === 0) return { chuaCoTask: true }
  const hoanThanh = danhSach.filter((task) => task.trangThai === 'HOAN_THANH').length
  // Chia nguyên: hoanThanh * 100 / mau, không qua số thực nên không có sai số làm tròn lên.
  return { chuaCoTask: false, phanTram: Math.floor((hoanThanh * 100) / mau) }
}

/** Nhãn hiện trên Dự án có Quá hạn dự kiến (chữ, không chỉ dựa vào màu). */
export const NHAN_QUA_HAN_DU_KIEN = 'Quá hạn dự kiến'

/** Phần Dự án mà luật Quá hạn dự kiến cần đọc. */
export interface DuAnDeTinhQuaHan {
  trangThai: TrangThaiDuAn
  /** `YYYY-MM-DD`; null khi chưa có Ngày kết thúc dự kiến. */
  ngayKetThucDuKien: string | null
}

/**
 * Dự án có Quá hạn dự kiến không: đang hoạt động, có Ngày kết thúc dự kiến, ngày đó trước ngày hôm nay
 * theo giờ Việt Nam (`bayGio` truyền vào), và Tiến độ chưa đủ 100%. Dự án "chưa có task" vẫn tính là
 * chưa đủ. Kết thúc đúng hôm nay thì chưa quá hạn. Khác với Trễ hạn (của Task).
 */
export function laDuAnQuaHanDuKien(duAn: DuAnDeTinhQuaHan, tienDo: TienDo, bayGio: Date): boolean {
  if (duAn.trangThai !== 'HOAT_DONG' || duAn.ngayKetThucDuKien === null) return false
  if (!tienDo.chuaCoTask && tienDo.phanTram >= 100) return false
  // `YYYY-MM-DD` cùng độ dài nên so chuỗi chính là so ngày.
  return duAn.ngayKetThucDuKien < homNayGioVietNam(bayGio)
}

/** Số liệu của một Dự án cho bảng Dự án: Tiến độ, số Task Trễ hạn, cờ Quá hạn dự kiến. */
export interface SoLieuDuAn {
  tienDo: TienDo
  soTaskTreHan: number
  quaHanDuKien: boolean
}

/**
 * Gom số liệu của một Dự án từ các Task của nó, theo ngày hôm nay của `bayGio` (giờ Việt Nam, truyền
 * vào). Kho dữ liệu dùng hàm này để trả danh sách Dự án kèm số liệu trong một lần đọc.
 */
export function tinhSoLieuDuAn(
  duAn: DuAnDeTinhQuaHan,
  danhSachTask: readonly TaskDeTinhTienDo[],
  bayGio: Date,
): SoLieuDuAn {
  const tienDo = tinhTienDo(danhSachTask)
  return {
    tienDo,
    soTaskTreHan: taskTreHan(danhSachTask, bayGio).length,
    quaHanDuKien: laDuAnQuaHanDuKien(duAn, tienDo, bayGio),
  }
}

/** Nhãn Tiến độ để hiện: "chưa có task" hoặc "NN%". */
export function nhanTienDo(tienDo: TienDo): string {
  return tienDo.chuaCoTask ? 'chưa có task' : `${tienDo.phanTram}%`
}

/** Số Task theo từng trạng thái; trạng thái không có Task nào là 0. */
export type SoTaskTheoTrangThai = Record<TrangThaiTask, number>

export function demTaskTheoTrangThai(danhSach: readonly Pick<TaskDeTinhTienDo, 'trangThai'>[]): SoTaskTheoTrangThai {
  const dem = Object.fromEntries(CAC_TRANG_THAI_TASK.map((t) => [t, 0])) as SoTaskTheoTrangThai
  for (const task of danhSach) dem[task.trangThai] += 1
  return dem
}

/** Một dòng tổng quan của một Dự án, tính từ các Task của nó. */
export interface TomTatTienDoDuAn {
  tienDo: TienDo
  soTaskTheoTrangThai: SoTaskTheoTrangThai
  /** Có ít nhất một Task Trễ hạn. */
  treHan: boolean
  /** Số Task Trễ hạn. */
  soTaskTreHan: number
  /** Số Task chưa chốt (không phải Hoàn thành, không phải Huỷ) mà người xem đang giữ, thực hiện hoặc kiểm tra. */
  soTaskChuaChotCuaToi: number
}

/**
 * Gom Tiến độ, số Task theo trạng thái, cờ Trễ hạn và số Task chưa chốt của riêng `nguoiDungId`
 * trong một Dự án. `bayGio` là thời điểm "bây giờ" truyền vào.
 */
export function tomTatTienDoDuAn<
  T extends TaskDeTinhTienDo & { nguoiThucHien: { id: string }; nguoiKiemTra: { id: string } },
>(danhSach: readonly T[], bayGio: Date, nguoiDungId: string): TomTatTienDoDuAn {
  const soTaskTreHan = taskTreHan(danhSach, bayGio).length
  return {
    tienDo: tinhTienDo(danhSach),
    soTaskTheoTrangThai: demTaskTheoTrangThai(danhSach),
    treHan: soTaskTreHan > 0,
    soTaskTreHan,
    soTaskChuaChotCuaToi: danhSach.filter(
      (task) =>
        !laTaskDaChot(task.trangThai) &&
        (task.nguoiThucHien.id === nguoiDungId || task.nguoiKiemTra.id === nguoiDungId),
    ).length,
  }
}

/** Xếp Task Trễ hạn: hạn cũ nhất (trễ nhiều nhất) trước; cùng hạn thì theo tiêu đề (thứ tự tiếng Việt). */
export function xepTaskTreHan<T extends TaskDeTinhTienDo & { tieuDe: string }>(danhSach: readonly T[]): T[] {
  return [...danhSach].sort(
    (a, b) => (a.han ?? '').localeCompare(b.han ?? '') || a.tieuDe.localeCompare(b.tieuDe, 'vi'),
  )
}
