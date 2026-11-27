// Đọc theo lô của bản Supabase (ticket toi-uu-hieu-nang 02): Tổng quan và danh sách Dự án kèm số liệu tốn một số
// lượt gọi cố định, không tăng theo số Dự án hay số Task.
//
// - Dự án người gọi thấy được đọc trong MỘT lượt (phân quyền từng dòng du_an_doc đã lọc), kèm id Người trong dự án
//   nhúng cùng lượt khi cần (phân quyền nguoi_trong_du_an_doc theo cùng luật xem Dự án, nên đủ người của Dự án).
// - Task của mọi Dự án người gọi thấy được đọc trong MỘT lượt (task_doc lọc theo cùng luật xem Dự án; đọc từng
//   trang `CO_TRANG` dòng nên trên cỡ đó mới thêm lượt), rồi chia theo Dự án ở đây.
// - Tên người: một lượt `ten_nguoi_dau_vet` cho mọi Dự án, một lượt `ten_nguoi_cua_task` cho mọi Task (hai hàm của
//   cơ sở dữ liệu có luật xem tên khác nhau, không gộp được khi không thêm migration).
// - Số liệu tính bằng chính luật thuần như trước (`tinhSoLieuDuAn`; Tổng quan: `tinhTongQuan` ở tongQuan.ts).
//
// Đếm lượt (đường thành công, sau khi đăng nhập; hồ sơ người gọi lấy từ bản nhớ của phiên, khoSupabaseNguoiGoi.ts):
// - Tổng quan: Dự án đang hoạt động kèm Người trong dự án (1), rồi cùng lúc Task và tên cho Dự án (2), rồi tên cho
//   Task (1): 4. Không thấy Dự án nào: 1, không đọc Task.
// - Dự án kèm số liệu: Dự án (kèm Người trong dự án khi phạm vi là của tôi) (1), rồi cùng lúc Task và tên (2): 3.
//   Không có Dự án nào trong phạm vi: 1, không đọc Task.
import type { SupabaseClient } from '@supabase/supabase-js'
import { laPhamViDanhSachDuAn } from '../luat/duAn'
import { tinhSoLieuDuAn } from '../luat/tienDo'
import { thanhCong, thatBai, type KetQua } from './ketQua'
import type { DuAn, DuAnKemSoLieu, PhamViDanhSachDuAn, Phien } from './khoDuLieu'
import type { NguoiGoi } from './khoSupabaseNguoiGoi'
import { COT_TASK, docTatCaTrang, idNguoiCuaTask, taskTuDong, trangThaiTaskTuDong, type DongTask } from './khoSupabaseTask'
import type { DuLieuTongQuan } from './tongQuan'

/** Lỗi trả về từ PostgREST (bảng, RPC). */
interface LoiCsdl {
  code?: string
  message?: string
}

/**
 * Cột nhúng Người trong dự án vào dòng Dự án. Bảng du_an và nguoi_trong_du_an nối nhau bằng hai khoá ngoại
 * (nguoi_trong_du_an.du_an_id, và du_an_nguoi_phu_trach_fkey của Người phụ trách), nên phải gọi đúng tên khoá.
 */
const NHUNG_NGUOI_TRONG_DU_AN = 'nguoi_trong_du_an!nguoi_trong_du_an_du_an_id_fkey(nguoi_dung_id)'

/** Những gì khoSupabase.ts đưa vào: người gọi, cột và cách dựng Dự án từ dòng, cách đổi lỗi. */
export interface PhuThuocDocLo<DongDuAn extends { id: string; trang_thai: string }> {
  xacThuc(phien: Phien | null): Promise<KetQua<NguoiGoi>>
  cotDuAn: string
  idNguoiCuaDuAn(dong: DongDuAn): string[]
  duAnTuDong(dong: DongDuAn, ten: (id: string) => string): DuAn
  loiTuCsdl<T = never>(loi: LoiCsdl): KetQua<T>
}

type DongDuAnKemNguoi<DongDuAn> = DongDuAn & { nguoi_trong_du_an?: { nguoi_dung_id: string }[] | null }

export function taoDocLoSupabase<DongDuAn extends { id: string; trang_thai: string }>(phuThuoc: PhuThuocDocLo<DongDuAn>) {
  const { xacThuc, loiTuCsdl } = phuThuoc

  /** Dự án người gọi thấy được, một lượt; `kemNguoiTrong` thì nhúng id Người trong dự án vào từng dòng. */
  async function docDongDuAn(
    db: SupabaseClient,
    loc: { chiHoatDong: boolean; kemNguoiTrong: boolean },
  ): Promise<KetQua<DongDuAnKemNguoi<DongDuAn>[]>> {
    const cot = loc.kemNguoiTrong ? `${phuThuoc.cotDuAn}, ${NHUNG_NGUOI_TRONG_DU_AN}` : phuThuoc.cotDuAn
    let truyVan = db.from('du_an').select(cot)
    if (loc.chiHoatDong) truyVan = truyVan.eq('trang_thai', 'HOAT_DONG')
    const { data, error } = await truyVan
    if (error) return loiTuCsdl(error)
    return thanhCong((data ?? []) as unknown as DongDuAnKemNguoi<DongDuAn>[])
  }

  /** Mọi Task người gọi thấy được (phân quyền từng dòng đã lọc), chỉ các cột `cot`, từng trang theo thứ tự ổn định. */
  function docMoiTask<T>(db: SupabaseClient, cot: string): Promise<KetQua<T[]>> {
    return docTatCaTrang<T>(
      (tu, den) => db.from('task').select(cot).order('tao_luc', { ascending: false }).order('id').range(tu, den),
      (loi) => loiTuCsdl(loi),
    )
  }

  /** Tên hiển thị theo id qua một hàm của cơ sở dữ liệu; không có id nào thì không gọi. */
  async function docTen(
    db: SupabaseClient,
    ham: 'ten_nguoi_dau_vet' | 'ten_nguoi_cua_task',
    ids: readonly string[],
  ): Promise<KetQua<(id: string) => string>> {
    const tenTheoId = new Map<string, string>()
    const duyNhat = [...new Set(ids)]
    if (duyNhat.length > 0) {
      const { data, error } = await db.rpc(ham, { p_ids: duyNhat })
      if (error) return loiTuCsdl(error)
      for (const nguoi of (data ?? []) as unknown as { id: string; ten_hien_thi: string }[]) {
        tenTheoId.set(nguoi.id, nguoi.ten_hien_thi)
      }
    }
    return thanhCong((id: string) => tenTheoId.get(id) ?? '')
  }

  /** Dự án như giao diện Kho trả ra, tên người đọc trong một lượt. */
  async function docCacDuAn(db: SupabaseClient, dong: readonly DongDuAn[]): Promise<KetQua<DuAn[]>> {
    const ten = await docTen(db, 'ten_nguoi_dau_vet', dong.flatMap(phuThuoc.idNguoiCuaDuAn))
    if (!ten.ok) return ten
    return thanhCong(dong.map((d) => phuThuoc.duAnTuDong(d, ten.giaTri)))
  }

  /** Chia các dòng theo Dự án, giữ thứ tự đọc về. */
  function theoDuAn<T extends { du_an_id: string }>(dong: readonly T[]): Map<string, T[]> {
    const nhom = new Map<string, T[]>()
    for (const d of dong) {
      const ds = nhom.get(d.du_an_id)
      if (ds) ds.push(d)
      else nhom.set(d.du_an_id, [d])
    }
    return nhom
  }

  return {
    /**
     * Danh sách Dự án kèm số liệu, như `docDuAnKemSoLieu` (duAnKemSoLieu.ts) ghép từ các lệnh đọc nhưng đọc theo
     * lô: `TAT_CA` là mọi Dự án người gọi thấy (như `danhSachDuAn`), `CUA_TOI` là các Dự án đó mà người gọi đang ở
     * trong (như `danhSachDuAnCuaToi`, kể cả Lưu trữ). Thứ tự kiểm như trước: chưa đăng nhập, rồi phạm vi sai.
     */
    async danhSachDuAnKemSoLieu(
      phien: Phien | null,
      phamVi: PhamViDanhSachDuAn,
      bayGio: Date,
    ): Promise<KetQua<DuAnKemSoLieu[]>> {
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      if (!laPhamViDanhSachDuAn(phamVi)) return thatBai('KHONG_HOP_LE')
      const { db, hoSo } = xt.giaTri
      const cuaToi = phamVi === 'CUA_TOI'
      const dong = await docDongDuAn(db, { chiHoatDong: false, kemNguoiTrong: cuaToi })
      if (!dong.ok) return dong
      const trongPhamVi = cuaToi
        ? dong.giaTri.filter((d) => (d.nguoi_trong_du_an ?? []).some((n) => n.nguoi_dung_id === hoSo.id))
        : dong.giaTri
      if (trongPhamVi.length === 0) return thanhCong([])

      const [duAn, task] = await Promise.all([
        docCacDuAn(db, trongPhamVi),
        docMoiTask<Pick<DongTask, 'du_an_id' | 'han' | 'trang_thai'>>(db, 'du_an_id, han, trang_thai'),
      ])
      if (!duAn.ok) return duAn
      if (!task.ok) return task
      const taskTheoDuAn = theoDuAn(task.giaTri)
      return thanhCong(
        duAn.giaTri.map((d) => {
          const cuaDuAn = (taskTheoDuAn.get(d.id) ?? []).map((t) => ({ han: t.han, trangThai: trangThaiTaskTuDong(t.trang_thai) }))
          return { ...d, ...tinhSoLieuDuAn(d, cuaDuAn, bayGio) }
        }),
      )
    },

    /**
     * Dữ liệu của Tổng quan đọc theo lô: các Dự án đang hoạt động người gọi thấy, mỗi Dự án kèm mọi Task của nó
     * (như `danhSachTask`: tên người hiện tại, dấu "đã rời dự án"), và người gọi (id, vai theo hồ sơ của phiên).
     */
    async docDuLieuTongQuan(phien: Phien | null): Promise<KetQua<DuLieuTongQuan>> {
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      const { db, hoSo } = xt.giaTri
      const nguoiGoi = { id: hoSo.id, vai: hoSo.vai }
      const dong = await docDongDuAn(db, { chiHoatDong: true, kemNguoiTrong: true })
      if (!dong.ok) return dong
      if (dong.giaTri.length === 0) return thanhCong({ duAn: [], nguoiGoi })

      const [duAn, moiTask] = await Promise.all([docCacDuAn(db, dong.giaTri), docMoiTask<DongTask>(db, COT_TASK)])
      if (!duAn.ok) return duAn
      if (!moiTask.ok) return moiTask
      // Task của Dự án Lưu trữ (PM thấy) không thuộc Tổng quan.
      const hoatDong = new Set(dong.giaTri.map((d) => d.id))
      const dongTask = moiTask.giaTri.filter((t) => hoatDong.has(t.du_an_id))
      const ten = await docTen(db, 'ten_nguoi_cua_task', dongTask.flatMap(idNguoiCuaTask))
      if (!ten.ok) return ten

      const nguoiTrong = new Set(
        dong.giaTri.flatMap((d) => (d.nguoi_trong_du_an ?? []).map((n) => `${d.id}|${n.nguoi_dung_id}`)),
      )
      const laTrongDuAn = (duAnId: string, id: string) => nguoiTrong.has(`${duAnId}|${id}`)
      const taskTheoDuAn = theoDuAn(dongTask)
      return thanhCong({
        duAn: duAn.giaTri.map((d) => ({
          duAn: d,
          task: (taskTheoDuAn.get(d.id) ?? []).map((t) => taskTuDong(t, ten.giaTri, laTrongDuAn)),
        })),
        nguoiGoi,
      })
    },
  }
}
