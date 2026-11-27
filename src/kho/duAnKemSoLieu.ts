// Danh sách Dự án kèm số liệu ghép từ các lệnh đọc có sẵn của Kho dữ liệu (`danhSachDuAn`,
// `danhSachDuAnCuaToi`, `danhSachTask`, đã áp quyền xem), rồi tính Tiến độ, số Trễ hạn, cờ Quá hạn dự
// kiến bằng luật thuần `tinhSoLieuDuAn`. Bản Supabase dùng hàm này (tính phía client, chưa có hàm cơ sở
// dữ liệu riêng); bản bộ nhớ tự tính trên dữ liệu của nó. "Bây giờ" truyền vào, không đọc đồng hồ.
import { laPhamViDanhSachDuAn } from '../luat/duAn'
import { tinhSoLieuDuAn } from '../luat/tienDo'
import { thanhCong, thatBai, type KetQua } from './ketQua'
import type { DuAnKemSoLieu, KhoDuLieu, PhamViDanhSachDuAn, Phien } from './khoDuLieu'

type LenhCan = Pick<KhoDuLieu, 'danhSachDuAn' | 'danhSachDuAnCuaToi' | 'danhSachTask'>

/**
 * Đọc danh sách Dự án kèm số liệu theo phạm vi. Lỗi của lệnh Kho nào (vd. `CHUA_DANG_NHAP`,
 * `LOI_HE_THONG`) được trả nguyên.
 */
export async function docDuAnKemSoLieu(
  kho: LenhCan,
  phien: Phien | null,
  phamVi: PhamViDanhSachDuAn,
  bayGio: Date,
): Promise<KetQua<DuAnKemSoLieu[]>> {
  const duAn = await kho.danhSachDuAn(phien)
  if (!duAn.ok) return duAn
  if (!laPhamViDanhSachDuAn(phamVi)) return thatBai('KHONG_HOP_LE')
  let trongPhamVi = duAn.giaTri
  if (phamVi === 'CUA_TOI') {
    const cuaToi = await kho.danhSachDuAnCuaToi(phien)
    if (!cuaToi.ok) return cuaToi
    const ids = new Set(cuaToi.giaTri.map((d) => d.id))
    trongPhamVi = trongPhamVi.filter((d) => ids.has(d.id))
  }
  const taskTheoDuAn = await Promise.all(trongPhamVi.map((d) => kho.danhSachTask(phien, d.id)))
  const ketQua: DuAnKemSoLieu[] = []
  for (let i = 0; i < trongPhamVi.length; i++) {
    const task = taskTheoDuAn[i]
    if (!task.ok) return task
    ketQua.push({ ...trongPhamVi[i], ...tinhSoLieuDuAn(trongPhamVi[i], task.giaTri, bayGio) })
  }
  return thanhCong(ketQua)
}
