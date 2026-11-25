// Lệnh repo GitHub của Dự án (ticket 15) và link issue hoặc PR của Task (ticket 16) cho bản cài
// Supabase (ticket 17). Chỉ ghi và đọc TÊN và LINK; không gọi GitHub (việc đó là của Cổng GitHub,
// qua Edge Function `doc-github`, xem supabase/functions/doc-github/).
//
// - Dữ liệu: bảng public.repo_du_an, public.lien_ket_task và các hàm them_lien_ket_vao_task,
//   go_lien_ket_khoi_task trong supabase/migrations/20261125000400_lat_4_github.sql.
// - Như phần Dự án và Task: quyền được kiểm hai lần, ở đây bằng chính luật thuần (src/luat/github.ts,
//   duAn.ts) để trả đúng mã lỗi và đúng thứ tự như bản bộ nhớ, và ở cơ sở dữ liệu (phân quyền từng
//   dòng, trigger, hàm) vì trình duyệt không đáng tin. Lỗi mà cơ sở dữ liệu ném ra mang mã lỗi của Kho.
// - Link chỉ ghi qua hai hàm của cơ sở dữ liệu (cùng một giao dịch với việc cập nhật dấu vết chỉnh sửa
//   của Task); client không có quyền ghi thẳng bảng link.
// - Giờ do máy chủ đặt: tham số `bayGio` bị bỏ qua (như phần Dự án và Task).
//
// File này nhận các hàm dùng chung của khoSupabase.ts qua `PhuThuocLenhTask` (cùng kiểu với lệnh Task)
// để không import vòng.
//
// CỔNG CHƯA KIỂM: các lệnh cần mạng chỉ chạy được với Supabase thật (lệnh riêng, xem
// src/kho/khoSupabase.test.ts). Cổng chỉ kiểm nhánh không gọi mạng (chưa đăng nhập).
import { thanhCong, thatBai, THONG_BAO_MAC_DINH, type KetQua, type MaLoi } from './ketQua'
import type { KhoDuLieu, LienKetTask, Phien, RepoDuAn } from './khoDuLieu'
import type { PhuThuocLenhTask } from './khoSupabaseTask'
import {
  THONG_BAO_LIEN_KET,
  duongDanLienKet,
  kiemGhiLienKet,
  kiemTraLienKet,
  kiemTraRepo,
  khoaRepo,
  type LienKetGitHub,
} from '../luat/github'
import { kiemGhiDuAn, type TrangThaiDuAn } from '../luat/duAn'

export type LenhGitHubSupabase = Pick<
  KhoDuLieu,
  | 'ganRepoVaoDuAn'
  | 'goRepoKhoiDuAn'
  | 'danhSachRepoCuaDuAn'
  | 'themLienKetVaoTask'
  | 'goLienKetKhoiTask'
  | 'danhSachLienKetCuaTask'
>

/** Mã lỗi nghiệp vụ riêng của phần GitHub mà migration lát 4 ném ra bằng `raise exception '<MÃ>'`. */
const MA_GITHUB_TU_CSDL: readonly MaLoi[] = [
  'REPO_KHONG_HOP_LE',
  'REPO_DA_GAN',
  'LINK_KHONG_HOP_LE',
  'LINK_REPO_CHUA_GAN',
  'LINK_TRUNG',
]

/** Ô của biểu mẫu mà mỗi mã lỗi gắn vào (như bản bộ nhớ). */
const O_CUA_MA: Partial<Record<MaLoi, { o: string; thongBao: string }>> = {
  REPO_KHONG_HOP_LE: { o: 'repo', thongBao: THONG_BAO_MAC_DINH.REPO_KHONG_HOP_LE },
  REPO_DA_GAN: { o: 'repo', thongBao: THONG_BAO_MAC_DINH.REPO_DA_GAN },
  LINK_KHONG_HOP_LE: { o: 'duongDan', thongBao: THONG_BAO_LIEN_KET.sai },
  LINK_REPO_CHUA_GAN: { o: 'duongDan', thongBao: THONG_BAO_LIEN_KET.chuaGan },
  LINK_TRUNG: { o: 'duongDan', thongBao: THONG_BAO_LIEN_KET.trung },
}

/** Lỗi trả về từ PostgREST (bảng, RPC). */
interface LoiCsdl {
  code?: string
  message?: string
}

interface DongRepo {
  ten_repo: string
}

interface DongLienKet {
  repo: string
  loai: string
  so: number
}

function laLoaiLienKet(loai: unknown): loai is LienKetGitHub['loai'] {
  return loai === 'ISSUE' || loai === 'PR'
}

/** Trạng thái Dự án đọc từ cơ sở dữ liệu; giá trị lạ coi như Lưu trữ, trạng thái chặn mọi lệnh ghi. */
function trangThaiDuAnTuDong(giaTri: string): TrangThaiDuAn {
  return giaTri === 'HOAT_DONG' ? 'HOAT_DONG' : 'LUU_TRU'
}

/** Link đọc từ cơ sở dữ liệu thành `LienKetTask`; dòng lạ (không thể có nhờ ràng buộc) bị bỏ. */
function lienKetTuDong(dong: DongLienKet): LienKetTask | null {
  if (!laLoaiLienKet(dong.loai)) return null
  const lienKet: LienKetGitHub = { repo: dong.repo, loai: dong.loai, so: Number(dong.so) }
  return { ...lienKet, duongDan: duongDanLienKet(lienKet) }
}

export function taoLenhGitHubSupabase(phuThuoc: PhuThuocLenhTask): LenhGitHubSupabase {
  const { xacThuc, xemDuAn, quanLyDuAn, laUuid } = phuThuoc

  /**
   * Mã GitHub do cơ sở dữ liệu ném (kèm lỗi theo ô như bản bộ nhớ); các mã còn lại (không có quyền,
   * Dự án Lưu trữ, không tìm thấy, mất mạng...) do `loiTuCsdl` của khoSupabase.ts đọc.
   */
  function loiGitHub<T = never>(loi: LoiCsdl): KetQua<T> {
    const thongDiep = (loi.message ?? '').trim()
    const ma = MA_GITHUB_TU_CSDL.find((m) => thongDiep === m || thongDiep.startsWith(`${m}:`))
    if (ma) {
      const o = O_CUA_MA[ma]
      return thatBai(ma, undefined, o ? { [o.o]: o.thongBao } : undefined)
    }
    // Vi phạm ràng buộc duy nhất (hai người gắn cùng một repo cùng lúc): như trigger báo trùng.
    if (loi.code === '23505') {
      const trung = /repo_du_an/.test(loi.message ?? '') ? 'REPO_DA_GAN' : 'LINK_TRUNG'
      const o = O_CUA_MA[trung]
      return thatBai(trung, undefined, o ? { [o.o]: o.thongBao } : undefined)
    }
    return phuThuoc.loiTuCsdl<T>(loi)
  }

  /**
   * Task mà người gọi thấy, kèm Dự án của nó: Task không tồn tại, id không phải uuid và Task của Dự
   * án người gọi không thấy đều trả cùng `KHONG_TIM_THAY` (không lộ gì). Phân quyền từng dòng đã giấu
   * Task của Dự án không thấy; luật thuần (`xemDuAn`) kiểm lại lần nữa.
   */
  async function xemTask(phien: Phien | null, taskId: string) {
    const xt = await xacThuc(phien)
    if (!xt.ok) return xt
    if (!laUuid(taskId)) return thatBai('KHONG_TIM_THAY')
    const { data, error } = await xt.giaTri.db.from('task').select('du_an_id').eq('id', taskId).maybeSingle()
    if (error) return loiGitHub(error)
    const dong = data as { du_an_id: string } | null
    if (!dong) return thatBai('KHONG_TIM_THAY')
    return xemDuAn(phien, dong.du_an_id)
  }

  /** `xemTask` rồi kiểm có được thêm hay gỡ link không (Dự án chưa Lưu trữ), như `kiemGhiLienKet`. */
  async function ghiTask(phien: Phien | null, taskId: string) {
    const xt = await xemTask(phien, taskId)
    if (!xt.ok) return xt
    const { duAn, nhin } = xt.giaTri
    const lyDo = kiemGhiLienKet({ ...nhin, trangThai: trangThaiDuAnTuDong(duAn.trang_thai) })
    if (lyDo) return thatBai(lyDo)
    return xt
  }

  return {
    async ganRepoVaoDuAn(phien: Phien | null, duAnId: string, dauVao) {
      // Quyền trước, rồi Dự án có tồn tại, rồi trạng thái, rồi dữ liệu (như bản bộ nhớ).
      const xt = await quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { nguoiGoi, duAn, nhin } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nhin, trangThai: trangThaiDuAnTuDong(duAn.trang_thai) })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraRepo.gan(dauVao)
      if (!kt.ok) return thatBai('REPO_KHONG_HOP_LE', undefined, kt.loiTheoO)
      // Chỉ cột du_an_id và ten_repo; người gắn và ngày gắn do trigger đặt. Trùng (không phân biệt
      // hoa thường) do trigger và ràng buộc duy nhất báo.
      const { data, error } = await nguoiGoi.db
        .from('repo_du_an')
        .insert({ du_an_id: duAnId, ten_repo: kt.giaTri.repo })
        .select('ten_repo')
        .single()
      if (error) return loiGitHub(error)
      const ketQua: RepoDuAn = { tenRepo: (data as unknown as DongRepo).ten_repo }
      return thanhCong(ketQua)
    },

    async goRepoKhoiDuAn(phien: Phien | null, duAnId: string, tenRepo: string) {
      const xt = await quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { nguoiGoi, duAn, nhin } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nhin, trangThai: trangThaiDuAnTuDong(duAn.trang_thai) })
      if (lyDo) return thatBai(lyDo)
      if (typeof tenRepo !== 'string') return thatBai('KHONG_TIM_THAY')
      const { data, error } = await nguoiGoi.db
        .from('repo_du_an')
        .delete()
        .eq('du_an_id', duAnId)
        .eq('ten_repo_khoa', khoaRepo(tenRepo))
        .select('id')
      if (error) return loiGitHub(error)
      if (!data || data.length === 0) return thatBai('KHONG_TIM_THAY')
      return thanhCong(null)
    },

    async danhSachRepoCuaDuAn(phien: Phien | null, duAnId: string) {
      const xt = await xemDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { data, error } = await xt.giaTri.nguoiGoi.db
        .from('repo_du_an')
        .select('ten_repo')
        .eq('du_an_id', duAnId)
        .order('thu_tu')
        .limit(1000)
      if (error) return loiGitHub(error)
      return thanhCong(((data ?? []) as unknown as DongRepo[]).map((dong): RepoDuAn => ({ tenRepo: dong.ten_repo })))
    },

    async themLienKetVaoTask(phien: Phien | null, taskId: string, dauVao) {
      // `bayGio` bị bỏ qua: người và ngày chỉnh sửa của Task do cơ sở dữ liệu đặt.
      const xt = await ghiTask(phien, taskId)
      if (!xt.ok) return xt
      const { nguoiGoi } = xt.giaTri
      const kt = kiemTraLienKet.them(dauVao)
      if (!kt.ok) return thatBai('LINK_KHONG_HOP_LE', undefined, kt.loiTheoO)
      const lienKet = kt.giaTri
      // Repo đã gắn chưa, trùng chưa, và cập nhật dấu vết Task: cùng một giao dịch trong hàm của cơ sở dữ liệu.
      const { error } = await nguoiGoi.db.rpc('them_lien_ket_vao_task', {
        p_task_id: taskId,
        p_repo: lienKet.repo,
        p_loai: lienKet.loai,
        p_so: lienKet.so,
      })
      if (error) return loiGitHub(error)
      const ketQua: LienKetTask = { ...lienKet, duongDan: duongDanLienKet(lienKet) }
      return thanhCong(ketQua)
    },

    async goLienKetKhoiTask(phien: Phien | null, taskId: string, lienKet: LienKetGitHub) {
      const xt = await ghiTask(phien, taskId)
      if (!xt.ok) return xt
      const { nguoiGoi } = xt.giaTri
      // Link sai kiểu không thể có trên Task.
      if (
        typeof lienKet !== 'object' ||
        lienKet === null ||
        typeof lienKet.repo !== 'string' ||
        !laLoaiLienKet(lienKet.loai) ||
        typeof lienKet.so !== 'number' ||
        !Number.isSafeInteger(lienKet.so) ||
        lienKet.so <= 0
      ) {
        return thatBai('KHONG_TIM_THAY')
      }
      const { error } = await nguoiGoi.db.rpc('go_lien_ket_khoi_task', {
        p_task_id: taskId,
        p_repo: lienKet.repo,
        p_loai: lienKet.loai,
        p_so: lienKet.so,
      })
      if (error) return loiGitHub(error)
      return thanhCong(null)
    },

    async danhSachLienKetCuaTask(phien: Phien | null, taskId: string) {
      const xt = await xemTask(phien, taskId)
      if (!xt.ok) return xt
      const { data, error } = await xt.giaTri.nguoiGoi.db
        .from('lien_ket_task')
        .select('repo, loai, so')
        .eq('task_id', taskId)
        .order('thu_tu')
        .limit(1000)
      if (error) return loiGitHub(error)
      const ketQua: LienKetTask[] = []
      for (const dong of (data ?? []) as unknown as DongLienKet[]) {
        const lienKet = lienKetTuDong(dong)
        if (lienKet) ketQua.push(lienKet)
      }
      return thanhCong(ketQua)
    },
  }
}
