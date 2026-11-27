// Dữ liệu cho trang Tổng quan: đọc các Dự án đang hoạt động người gọi được xem cùng Task của chúng
// qua các lệnh có sẵn của Kho dữ liệu (`danhSachDuAn`, `danhSachTask`, đã áp quyền xem), rồi tính mọi
// số liệu bằng luật thuần `luat/tongQuan.ts`. Mọi bản cài của Kho dùng chung hàm này mà không phải
// viết lại luật. "Bây giờ" truyền vào, không đọc đồng hồ.
//
// Bản cài nào đọc được cùng dữ liệu theo lô (bản Supabase, ticket toi-uu-hieu-nang 02: một số lượt gọi cố định thay
// vì một lượt mỗi Dự án) thì có thêm `docDuLieuTongQuan` (không thuộc giao diện Kho); số liệu vẫn tính ở đây bằng
// cùng luật thuần.
import {
  tinhTongQuan,
  type DongDuAnTongQuan,
  type DuAnKemTask,
  type SoLieuTongQuan,
  type TaskTongQuan,
} from '../luat/tongQuan'
import type { VaiHeThong } from '../luat/taiKhoan'
import { thanhCong, type KetQua } from './ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from './khoDuLieu'

/** Một dòng bảng Dự án đang hoạt động: Dự án, Tiến độ và các con số, Task Trễ hạn (hạn cũ nhất trước). */
export type DongTongQuan = DongDuAnTongQuan<DuAn, Task>

/** Một Task trong hai danh sách của Tổng quan, kèm tên Dự án. */
export type TaskCuaTongQuan = TaskTongQuan<Task>

/** Tổng quan của một người: ô số, bảng Dự án đang hoạt động, Task Trễ hạn, Task tới hạn, phân bố. */
export type TongQuan = SoLieuTongQuan<DuAn, Task>

/**
 * Dữ liệu thô của Tổng quan: các Dự án đang hoạt động người gọi được xem, mỗi Dự án kèm mọi Task của nó (như
 * `danhSachTask`), và người gọi (id, vai hệ thống).
 */
export interface DuLieuTongQuan {
  duAn: DuAnKemTask<DuAn, Task>[]
  nguoiGoi: { id: string; vai: VaiHeThong }
}

/** Bản cài của Kho đọc được dữ liệu Tổng quan theo lô (bản Supabase). Không thuộc giao diện Kho. */
export interface DocTongQuanTheoLo {
  docDuLieuTongQuan(phien: Phien | null): Promise<KetQua<DuLieuTongQuan>>
}

/**
 * Dữ liệu Tổng quan ghép từ các lệnh đọc có sẵn của Kho (`danhSachDuAn`, `layHoSoCuaToi`, `danhSachTask` cho từng
 * Dự án). Chỉ Dự án đang hoạt động được đọc: Task của Dự án Lưu trữ không tính ở đâu trên Tổng quan. Vai hệ thống
 * của người gọi lấy từ hồ sơ trong Kho (không tin giao diện).
 */
export async function docDuLieuTongQuanTuLenh(kho: KhoDuLieu, phien: Phien | null): Promise<KetQua<DuLieuTongQuan>> {
  const duAn = await kho.danhSachDuAn(phien, { trangThai: 'HOAT_DONG' })
  if (!duAn.ok) return duAn
  const hoSo = await kho.layHoSoCuaToi(phien)
  if (!hoSo.ok) return hoSo
  const taskTheoDuAn = await Promise.all(duAn.giaTri.map((d) => kho.danhSachTask(phien, d.id)))
  const duLieu: DuAnKemTask<DuAn, Task>[] = []
  for (let i = 0; i < duAn.giaTri.length; i++) {
    const task = taskTheoDuAn[i]
    if (!task.ok) return task
    duLieu.push({ duAn: duAn.giaTri[i], task: task.giaTri })
  }
  return thanhCong({ duAn: duLieu, nguoiGoi: { id: hoSo.giaTri.id, vai: hoSo.giaTri.vai } })
}

/**
 * Đọc Tổng quan của người gọi. PM thấy mọi Dự án; Support và Thành viên chỉ Dự án mình ở trong (do quyền xem của
 * Kho quyết định). Dấu "chưa có Người phụ trách" chỉ bật khi người gọi là PM hoặc Support. Người chưa ở Dự án nào
 * nhận mọi số 0 và danh sách rỗng. Lỗi của Kho (vd. `CHUA_DANG_NHAP`, `LOI_HE_THONG`) được trả nguyên. Kho đọc
 * được theo lô (`docDuLieuTongQuan`) thì dùng lối đó, không thì ghép từ các lệnh đọc.
 */
export async function docTongQuan(
  kho: KhoDuLieu & Partial<DocTongQuanTheoLo>,
  phien: Phien | null,
  bayGio: Date,
): Promise<KetQua<TongQuan>> {
  const duLieu = kho.docDuLieuTongQuan ? await kho.docDuLieuTongQuan(phien) : await docDuLieuTongQuanTuLenh(kho, phien)
  if (!duLieu.ok) return duLieu
  const { duAn, nguoiGoi } = duLieu.giaTri
  return thanhCong(tinhTongQuan(duAn, bayGio, nguoiGoi.id, nguoiGoi.vai))
}
