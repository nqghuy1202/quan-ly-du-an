// Luật thuần của trang Tổng quan: từ các Dự án (kèm Task) người gọi được xem và "bây giờ" truyền vào,
// tính hàng ô số, bảng Dự án đang hoạt động, Task Trễ hạn, Task tới hạn trong 7 ngày và phân bố Task
// theo trạng thái. Không I/O, không đọc đồng hồ. Giao diện chỉ hiển thị kết quả của hàm ở đây.
//
// Task của Dự án đã Lưu trữ không tính ở đâu: không vào ô số, danh sách hay phân bố. Dự án Lưu trữ cũng
// không bao giờ Quá hạn dự kiến.
import { duocThayDauChuaCoNguoiPhuTrach, type TrangThaiDuAn } from './duAn'
import type { VaiHeThong } from './taiKhoan'
import { laTaskDaChot } from './task'
import {
  demTaskTheoTrangThai,
  homNayGioVietNam,
  laDuAnQuaHanDuKien,
  laTaskTreHan,
  tinhTienDo,
  tomTatTienDoDuAn,
  xepTaskTreHan,
  type SoTaskTheoTrangThai,
  type TaskDeTinhTienDo,
  type TomTatTienDoDuAn,
} from './tienDo'

/** "Tới hạn trong 7 ngày": hạn từ hôm nay đến hết ngày thứ bảy kể từ hôm nay (giờ Việt Nam). */
export const SO_NGAY_TOI_HAN = 7

/** Phần Dự án mà luật Tổng quan cần đọc. */
export interface DuAnDeTinhTongQuan {
  id: string
  /** Mã Dự án, hiện cạnh tên. */
  ma: string
  ten: string
  trangThai: TrangThaiDuAn
  /** `YYYY-MM-DD`; null khi chưa có Ngày kết thúc dự kiến. */
  ngayKetThucDuKien: string | null
  /** Người phụ trách; null khi chưa có. */
  nguoiPhuTrach: { id: string } | null
}

/** Phần Task mà luật Tổng quan cần đọc. `daRoiDuAn` như ở Kho: người đó đã bị gỡ khỏi Dự án. */
export interface TaskDeTinhTongQuan extends TaskDeTinhTienDo {
  tieuDe: string
  nguoiThucHien: { id: string; daRoiDuAn?: true }
  nguoiKiemTra: { id: string; daRoiDuAn?: true }
}

/** Đầu vào: một Dự án người gọi được xem cùng mọi Task của nó. */
export interface DuAnKemTask<D extends DuAnDeTinhTongQuan, T extends TaskDeTinhTongQuan> {
  duAn: D
  task: readonly T[]
}

/** Một dòng bảng Dự án đang hoạt động: Tiến độ, số Task Trễ hạn... và các Task Trễ hạn (hạn cũ nhất trước). */
export interface DongDuAnTongQuan<D, T> {
  duAn: D
  tomTat: TomTatTienDoDuAn
  taskTreHan: T[]
  /** Dự án đã qua Ngày kết thúc dự kiến mà Tiến độ chưa đủ 100% (nhãn Quá hạn dự kiến trên dòng). */
  quaHanDuKien: boolean
  /** Hiện dấu "chưa có Người phụ trách": Dự án chưa có Người phụ trách và người gọi là PM hoặc Support. */
  chuaCoNguoiPhuTrach: boolean
}

/** Một Task trong hai danh sách của Tổng quan, kèm tên và Mã của Dự án chứa nó. */
export type TaskTongQuan<T> = T & { tenDuAn: string; maDuAn: string }

/** Hàng ô số của Tổng quan. */
export interface OSoTongQuan {
  /** Số Dự án đang hoạt động người gọi được xem. */
  duAnDangHoatDong: number
  /** Số Dự án đang hoạt động người gọi được xem có Quá hạn dự kiến. */
  duAnQuaHanDuKien: number
  /** Task chưa Hoàn thành, chưa Huỷ, thuộc Dự án đang hoạt động. */
  taskDangMo: number
  /** Task Trễ hạn thuộc Dự án đang hoạt động. */
  taskTreHan: number
  /** Task đang Chờ duyệt mà người gọi là Người kiểm tra. */
  choToiDuyet: number
  /** Task đang mở mà người gọi là Người thực hiện. */
  viecCuaToi: number
}

export interface SoLieuTongQuan<D, T> {
  oSo: OSoTongQuan
  /** Dự án đang hoạt động, xếp theo tên (thứ tự tiếng Việt). */
  hoatDong: DongDuAnTongQuan<D, T>[]
  /** Task Trễ hạn qua mọi Dự án đang hoạt động: trễ lâu nhất (hạn cũ nhất) trước, cùng hạn theo tiêu đề. */
  taskTreHan: TaskTongQuan<T>[]
  /** Task đang mở hạn từ hôm nay đến hết ngày thứ bảy (không gồm Task Trễ hạn): hạn gần nhất trước. */
  taskToiHan: TaskTongQuan<T>[]
  /** Số Task theo từng trạng thái, chỉ Task thuộc Dự án đang hoạt động. */
  phanBo: SoTaskTheoTrangThai
}

/** Cộng `soNgay` ngày vào một ngày `YYYY-MM-DD`; tính trên UTC nên không phụ thuộc múi giờ của máy. */
export function congNgay(ngay: string, soNgay: number): string {
  const moc = new Date(`${ngay}T00:00:00Z`)
  moc.setUTCDate(moc.getUTCDate() + soNgay)
  return moc.toISOString().slice(0, 10)
}

/**
 * Task có "tới hạn trong 7 ngày" không: chưa Hoàn thành, chưa Huỷ, có hạn từ hôm nay đến hết ngày thứ
 * bảy kể từ hôm nay theo giờ Việt Nam. Task đã Trễ hạn (hạn trước hôm nay) không tính.
 */
export function laTaskToiHan(task: TaskDeTinhTienDo, bayGio: Date): boolean {
  if (task.han === null || laTaskDaChot(task.trangThai)) return false
  const homNay = homNayGioVietNam(bayGio)
  // `YYYY-MM-DD` cùng độ dài nên so chuỗi chính là so ngày.
  return task.han >= homNay && task.han <= congNgay(homNay, SO_NGAY_TOI_HAN)
}

function xepTheoTen<D extends DuAnDeTinhTongQuan, T>(danhSach: DongDuAnTongQuan<D, T>[]): DongDuAnTongQuan<D, T>[] {
  return [...danhSach].sort((a, b) => a.duAn.ten.localeCompare(b.duAn.ten, 'vi'))
}

/**
 * Số liệu Tổng quan của người gọi `nguoiDungId` (vai hệ thống `vaiNguoiGoi`) từ các Dự án người đó được
 * xem (đã áp quyền xem ở Kho). "Chờ tôi duyệt" và "Việc của tôi" chỉ tính Task người gọi đang giữ thật
 * (không tính khi người gọi đã bị gỡ khỏi Dự án mà vẫn được ghi trên Task), như hai trang cùng tên.
 * Dấu "chưa có Người phụ trách" chỉ bật cho PM và Support (`duocThayDauChuaCoNguoiPhuTrach`).
 */
export function tinhTongQuan<D extends DuAnDeTinhTongQuan, T extends TaskDeTinhTongQuan>(
  duLieu: readonly DuAnKemTask<D, T>[],
  bayGio: Date,
  nguoiDungId: string,
  vaiNguoiGoi: VaiHeThong,
): SoLieuTongQuan<D, T> {
  const hoatDong = duLieu.filter((d) => d.duAn.trangThai === 'HOAT_DONG')
  const moiTask: TaskTongQuan<T>[] = hoatDong.flatMap((d) => d.task.map((t) => ({ ...t, tenDuAn: d.duAn.ten, maDuAn: d.duAn.ma })))
  const dangMo = moiTask.filter((t) => !laTaskDaChot(t.trangThai))
  const treHan = xepTaskTreHan(moiTask.filter((t) => laTaskTreHan(t, bayGio)))
  const toiHan = moiTask
    .filter((t) => laTaskToiHan(t, bayGio))
    .sort((a, b) => (a.han ?? '').localeCompare(b.han ?? '') || a.tieuDe.localeCompare(b.tieuDe, 'vi'))
  const thayDauPhuTrach = duocThayDauChuaCoNguoiPhuTrach(vaiNguoiGoi)
  const dong: DongDuAnTongQuan<D, T>[] = hoatDong.map((d) => ({
    duAn: d.duAn,
    tomTat: tomTatTienDoDuAn(d.task, bayGio, nguoiDungId),
    taskTreHan: xepTaskTreHan(d.task.filter((t) => laTaskTreHan(t, bayGio))),
    quaHanDuKien: laDuAnQuaHanDuKien(d.duAn, tinhTienDo(d.task), bayGio),
    chuaCoNguoiPhuTrach: thayDauPhuTrach && d.duAn.nguoiPhuTrach === null,
  }))

  return {
    oSo: {
      duAnDangHoatDong: hoatDong.length,
      duAnQuaHanDuKien: dong.filter((d) => d.quaHanDuKien).length,
      taskDangMo: dangMo.length,
      taskTreHan: treHan.length,
      choToiDuyet: moiTask.filter(
        (t) => t.trangThai === 'CHO_DUYET' && t.nguoiKiemTra.id === nguoiDungId && !t.nguoiKiemTra.daRoiDuAn,
      ).length,
      viecCuaToi: dangMo.filter((t) => t.nguoiThucHien.id === nguoiDungId && !t.nguoiThucHien.daRoiDuAn).length,
    },
    hoatDong: xepTheoTen(dong),
    taskTreHan: treHan,
    taskToiHan: toiHan,
    phanBo: demTaskTheoTrangThai(moiTask),
  }
}
