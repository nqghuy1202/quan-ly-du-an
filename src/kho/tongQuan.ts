// Dữ liệu cho trang Tổng quan: đọc các Dự án đang hoạt động người gọi được xem cùng Task của chúng
// qua các lệnh có sẵn của Kho dữ liệu (`danhSachDuAn`, `danhSachTask`, đã áp quyền xem), rồi tính mọi
// số liệu bằng luật thuần `luat/tongQuan.ts`. Mọi bản cài của Kho dùng chung hàm này mà không phải
// viết lại luật. "Bây giờ" truyền vào, không đọc đồng hồ.
import { tinhTongQuan, type DongDuAnTongQuan, type SoLieuTongQuan, type TaskTongQuan } from '../luat/tongQuan'
import { thanhCong, type KetQua } from './ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from './khoDuLieu'

/** Một dòng bảng Dự án đang hoạt động: Dự án, Tiến độ và các con số, Task Trễ hạn (hạn cũ nhất trước). */
export type DongTongQuan = DongDuAnTongQuan<DuAn, Task>

/** Một Task trong hai danh sách của Tổng quan, kèm tên Dự án. */
export type TaskCuaTongQuan = TaskTongQuan<Task>

/** Tổng quan của một người: ô số, bảng Dự án đang hoạt động, Task Trễ hạn, Task tới hạn, phân bố. */
export type TongQuan = SoLieuTongQuan<DuAn, Task>

/**
 * Đọc Tổng quan của người gọi. PM thấy mọi Dự án; Support và Thành viên chỉ Dự án mình ở trong (do
 * `danhSachDuAn` quyết định). Chỉ Dự án đang hoạt động được đọc: Task của Dự án Lưu trữ không tính ở
 * đâu trên Tổng quan. Dấu "chưa có Người phụ trách" chỉ bật khi người gọi là PM hoặc Support (vai đọc
 * từ hồ sơ). Người chưa ở Dự án nào nhận mọi số 0 và danh sách rỗng. Lỗi của lệnh Kho nào
 * (vd. `CHUA_DANG_NHAP`, `LOI_HE_THONG`) được trả nguyên.
 */
export async function docTongQuan(kho: KhoDuLieu, phien: Phien | null, bayGio: Date): Promise<KetQua<TongQuan>> {
  const duAn = await kho.danhSachDuAn(phien, { trangThai: 'HOAT_DONG' })
  if (!duAn.ok) return duAn
  // Vai hệ thống của người gọi lấy từ hồ sơ trong Kho (không tin giao diện): quyết định dấu "chưa có
  // Người phụ trách".
  const hoSo = await kho.layHoSoCuaToi(phien)
  if (!hoSo.ok) return hoSo
  const taskTheoDuAn = await Promise.all(duAn.giaTri.map((d) => kho.danhSachTask(phien, d.id)))
  const duLieu = []
  for (let i = 0; i < duAn.giaTri.length; i++) {
    const task = taskTheoDuAn[i]
    if (!task.ok) return task
    duLieu.push({ duAn: duAn.giaTri[i], task: task.giaTri })
  }
  return thanhCong(tinhTongQuan(duLieu, bayGio, hoSo.giaTri.id, hoSo.giaTri.vai))
}
