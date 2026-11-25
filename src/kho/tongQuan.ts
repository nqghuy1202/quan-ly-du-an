// Dữ liệu cho trang tổng quan: mỗi Dự án người gọi được thấy kèm Tiến độ, số Task theo trạng thái,
// cờ Trễ hạn và số Task chưa chốt của riêng người gọi. Chỉ đi qua các lệnh có sẵn của Kho dữ liệu
// (`danhSachDuAn`, `danhSachTask`) rồi áp luật thuần ở `luat/tienDo.ts`, nên mọi bản cài của Kho
// dùng chung hàm này mà không phải viết lại luật. "Bây giờ" truyền vào, không đọc đồng hồ.
import { taskTreHan, tomTatTienDoDuAn, xepTaskTreHan, type TomTatTienDoDuAn } from '../luat/tienDo'
import { thanhCong, type KetQua } from './ketQua'
import type { DuAn, KhoDuLieu, Phien, Task } from './khoDuLieu'

/** Một dòng tổng quan: Dự án, các con số của nó và danh sách Task Trễ hạn (hạn cũ nhất trước). */
export interface DongTongQuan {
  duAn: DuAn
  tomTat: TomTatTienDoDuAn
  taskTreHan: Task[]
}

/** Tổng quan của một người: Dự án đang hoạt động và Dự án Lưu trữ ở nhóm riêng. */
export interface TongQuan {
  hoatDong: DongTongQuan[]
  luuTru: DongTongQuan[]
}

function xepTheoTen(danhSach: DongTongQuan[]): DongTongQuan[] {
  return [...danhSach].sort((a, b) => a.duAn.ten.localeCompare(b.duAn.ten, 'vi'))
}

/**
 * Đọc tổng quan của người gọi. PM thấy mọi Dự án; Support và Thành viên chỉ Dự án mình ở trong
 * (do `danhSachDuAn` quyết định). Người chưa ở Dự án nào nhận hai nhóm rỗng. Lỗi của lệnh Kho nào
 * (vd. `CHUA_DANG_NHAP`, `LOI_HE_THONG`) được trả nguyên.
 */
export async function docTongQuan(kho: KhoDuLieu, phien: Phien | null, bayGio: Date): Promise<KetQua<TongQuan>> {
  const duAn = await kho.danhSachDuAn(phien)
  if (!duAn.ok) return duAn
  const taskTheoDuAn = await Promise.all(duAn.giaTri.map((d) => kho.danhSachTask(phien, d.id)))
  const dong: DongTongQuan[] = []
  for (let i = 0; i < duAn.giaTri.length; i++) {
    const task = taskTheoDuAn[i]
    if (!task.ok) return task
    dong.push({
      duAn: duAn.giaTri[i],
      tomTat: tomTatTienDoDuAn(task.giaTri, bayGio, phien?.nguoiDungId ?? ''),
      taskTreHan: xepTaskTreHan(taskTreHan(task.giaTri, bayGio)),
    })
  }
  return thanhCong({
    hoatDong: xepTheoTen(dong.filter((d) => d.duAn.trangThai === 'HOAT_DONG')),
    luuTru: xepTheoTen(dong.filter((d) => d.duAn.trangThai === 'LUU_TRU')),
  })
}
