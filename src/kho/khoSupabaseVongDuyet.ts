// Lệnh vòng duyệt của bản cài Supabase (ticket 14): đổi trạng thái Task và đọc lịch sử trạng thái
// (ticket 11).
//
// - Dữ liệu: hàm public.doi_trang_thai_task, public.lich_su_task và bảng
//   public.lich_su_trang_thai_task trong supabase/migrations/20261125000300_lat_3_vong_duyet.sql.
// - Như phần Dự án và Task: quyền được kiểm hai lần. Ở đây bằng chính luật thuần
//   (`kiemChuyenTrangThai` trong src/luat/chuyenTrangThai.ts, không viết lại luật) để trả đúng mã
//   lỗi, đúng thông báo và đúng thứ tự như bản bộ nhớ; ở cơ sở dữ liệu bằng hàm security definer,
//   hàng rào thật vì trình duyệt không đáng tin. Hàm lấy người gọi từ phiên đăng nhập (auth.uid()),
//   không nhận người gọi qua tham số. Lỗi mà cơ sở dữ liệu ném ra mang mã lỗi của Kho.
// - Client không bao giờ ghi thẳng cột trạng thái, số lần Trả lại hay bảng lịch sử: chỉ gọi hàm.
// - Giờ do máy chủ đặt: tham số `bayGio` bị bỏ qua (thời điểm của dòng lịch sử, ngày chỉnh sửa).
// - Tiến độ và Trễ hạn KHÔNG có truy vấn riêng ở đây: chúng tính bằng hàm thuần của ticket 13 trên
//   danh sách Task mà `danhSachTask` (khoSupabaseTask.ts) đọc, đã có đủ trạng thái và hạn.
//
// File này nhận các hàm dùng chung của khoSupabase.ts qua `PhuThuocLenhVongDuyet` để không import vòng.
//
// CỔNG CHƯA KIỂM: các lệnh cần mạng chỉ chạy được với Supabase thật (lệnh riêng, xem
// src/kho/khoSupabase.test.ts). Cổng kiểm các nhánh với một `fetch` giả (src/kho/khoSupabaseVongDuyet.test.ts).
import type { SupabaseClient } from '@supabase/supabase-js'
import { thanhCong, thatBai, type KetQua, type MaLoi } from './ketQua'
import type { DongLichSuTask, HoSo, KhoDuLieu, Phien } from './khoDuLieu'
import { THONG_BAO_CHUYEN_TRANG_THAI, kiemChuyenTrangThai, xepLichSuTask } from '../luat/chuyenTrangThai'
import { CAC_TRANG_THAI_TASK, type TrangThaiTask } from '../luat/task'
import type { NguoiGoiDuAn, TrangThaiDuAn } from '../luat/duAn'

/** Lỗi trả về từ PostgREST (bảng, RPC). */
interface LoiCsdl {
  code?: string
  message?: string
}

interface NguoiGoiTask {
  db: SupabaseClient
  hoSo: HoSo
}

interface NguCanhDuAn {
  nguoiGoi: NguoiGoiTask
  duAn: { id: string; trang_thai: string }
  nhin: NguoiGoiDuAn
}

/** Các hàm dùng chung mà khoSupabase.ts đưa vào (xác thực, đọc Dự án theo đúng luật xem). */
export interface PhuThuocLenhVongDuyet {
  xacThuc(phien: Phien | null): Promise<KetQua<NguoiGoiTask>>
  /** Như `layDuAn`: không tồn tại và không thấy được cùng trả `KHONG_TIM_THAY`. */
  xemDuAn(phien: Phien | null, duAnId: string): Promise<KetQua<NguCanhDuAn>>
  /** `layTask` của bản cài này: đọc lại Task đầy đủ sau khi đổi trạng thái. */
  layTask: KhoDuLieu['layTask']
  laUuid(id: string): boolean
  loiTuCsdl<T = never>(loi: LoiCsdl): KetQua<T>
}

export type LenhVongDuyetSupabase = Pick<KhoDuLieu, 'doiTrangThaiTask' | 'lichSuTask'>

/** Cột của Task mà luật chuyển trạng thái cần. */
const COT_TASK_CHUYEN = 'id, du_an_id, nguoi_thuc_hien_id, nguoi_kiem_tra_id, trang_thai'

interface DongTaskChuyen {
  id: string
  du_an_id: string
  nguoi_thuc_hien_id: string
  nguoi_kiem_tra_id: string
  trang_thai: string
}

/** Một dòng do hàm `lich_su_task` trả về. */
interface DongLichSuCsdl {
  stt: number
  nguoi_doi_id: string
  ten_hien_thi: string
  luc: string
  tu: string
  sang: string
  ly_do: string | null
}

/** Các mã lỗi của vòng duyệt mà hàm cơ sở dữ liệu ném thêm so với `MA_TU_CSDL` của khoSupabase.ts. */
const MA_VONG_DUYET: readonly MaLoi[] = ['TASK_DA_CHOT', 'KHONG_HOP_LE', 'BUOC_KHONG_HOP_LE', 'LY_DO_BAT_BUOC']

/** Trạng thái Dự án đọc từ cơ sở dữ liệu; giá trị lạ coi như Lưu trữ, trạng thái chặn mọi lệnh ghi. */
function trangThaiDuAnTuDong(giaTri: string): TrangThaiDuAn {
  return giaTri === 'HOAT_DONG' ? 'HOAT_DONG' : 'LUU_TRU'
}

/** Trạng thái Task đọc từ cơ sở dữ liệu; giá trị lạ (không thể có nhờ ràng buộc) coi như Huỷ, trạng thái chặn mọi lệnh ghi. */
function trangThaiTaskTuDong(giaTri: string): TrangThaiTask {
  return (CAC_TRANG_THAI_TASK as readonly string[]).includes(giaTri) ? (giaTri as TrangThaiTask) : 'HUY'
}

export function taoLenhVongDuyetSupabase(phuThuoc: PhuThuocLenhVongDuyet): LenhVongDuyetSupabase {
  const { xacThuc, xemDuAn, layTask, laUuid } = phuThuoc

  /**
   * Lỗi do hàm cơ sở dữ liệu ném: bốn mã của vòng duyệt đọc ở đây (cùng thông báo với luật thuần);
   * các mã còn lại (KHONG_CO_QUYEN, KHONG_TIM_THAY, DU_AN_DA_LUU_TRU, CHUA_DANG_NHAP, lỗi quyền, lỗi hệ
   * thống) do `loiTuCsdl` của khoSupabase.ts đọc.
   */
  function loiVongDuyet<T = never>(loi: LoiCsdl): KetQua<T> {
    const thongDiep = (loi.message ?? '').trim()
    const ma = MA_VONG_DUYET.find((m) => thongDiep === m || thongDiep.startsWith(`${m}:`))
    if (ma === 'TASK_DA_CHOT') return thatBai(ma, THONG_BAO_CHUYEN_TRANG_THAI.daChot)
    if (ma === 'LY_DO_BAT_BUOC') {
      return thatBai(ma, THONG_BAO_CHUYEN_TRANG_THAI.lyDoTrong, { lyDo: THONG_BAO_CHUYEN_TRANG_THAI.lyDoTrong })
    }
    if (ma) return thatBai(ma)
    return phuThuoc.loiTuCsdl<T>(loi)
  }

  return {
    async doiTrangThaiTask(phien: Phien | null, taskId: string, dauVao) {
      // `bayGio` bị bỏ qua: thời điểm của dòng lịch sử và ngày chỉnh sửa do cơ sở dữ liệu đặt.
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      const { db, hoSo } = xt.giaTri
      // Task không tồn tại: người không phải PM nhận KHONG_CO_QUYEN (không lộ gì), PM nhận KHONG_TIM_THAY.
      // Phân quyền từng dòng giấu Task của Dự án người gọi không thấy, nên với họ Task như không tồn tại.
      const khongCoTask = (): KetQua<never> =>
        hoSo.vai === 'PM' ? thatBai('KHONG_TIM_THAY') : thatBai('KHONG_CO_QUYEN')
      if (!laUuid(taskId)) return khongCoTask()
      const { data, error } = await db.from('task').select(COT_TASK_CHUYEN).eq('id', taskId).maybeSingle()
      if (error) return loiVongDuyet(error)
      const task = data as unknown as DongTaskChuyen | null
      if (!task) return khongCoTask()

      const ctx = await xemDuAn(phien, task.du_an_id)
      if (!ctx.ok) return ctx.loi.ma === 'KHONG_TIM_THAY' ? thatBai('KHONG_CO_QUYEN') : ctx
      const { duAn, nhin } = ctx.giaTri

      // Luật thuần quyết định chuyển hay từ chối, theo đúng thứ tự và mã lỗi của bản bộ nhớ.
      const kq = kiemChuyenTrangThai(
        {
          ...nhin,
          nguoiGoiId: hoSo.id.toLowerCase(),
          nguoiThucHienId: task.nguoi_thuc_hien_id.toLowerCase(),
          nguoiKiemTraId: task.nguoi_kiem_tra_id.toLowerCase(),
          trangThaiDuAn: trangThaiDuAnTuDong(duAn.trang_thai),
          trangThaiTask: trangThaiTaskTuDong(task.trang_thai),
        },
        dauVao,
      )
      if (!kq.ok) return thatBai(kq.ma, kq.thongBao, kq.loiTheoO)

      // Hàm của cơ sở dữ liệu kiểm lại cùng luật (người gọi lấy từ phiên, không từ tham số) rồi mới ghi:
      // đổi trạng thái, bộ đếm Trả lại, dấu vết chỉnh sửa và một dòng lịch sử trong một giao dịch.
      // Lý do gửi đi là bản đã cắt khoảng trắng; null khi không có.
      const { error: loiHam } = await db.rpc('doi_trang_thai_task', {
        p_task_id: taskId,
        p_sang: kq.buoc.sang,
        p_ly_do: kq.lyDo,
      })
      if (loiHam) return loiVongDuyet(loiHam)
      return layTask(phien, taskId)
    },

    async lichSuTask(phien: Phien | null, taskId: string) {
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      // Không phải uuid thì chắc chắn không có Task nào (và gửi đi sẽ gây lỗi kiểu).
      if (!laUuid(taskId)) return thatBai('KHONG_TIM_THAY')
      // Hàm chỉ trả cho người thấy Dự án của Task; Task không tồn tại hay không thấy được cùng ném KHONG_TIM_THAY.
      const { data, error } = await xt.giaTri.db.rpc('lich_su_task', { p_task_id: taskId })
      if (error) return loiVongDuyet(error)
      const dong = [...((data ?? []) as unknown as DongLichSuCsdl[])].sort((a, b) => a.stt - b.stt)
      const lichSu = dong.map(
        (d): DongLichSuTask => ({
          nguoiDoi: { id: d.nguoi_doi_id, tenHienThi: d.ten_hien_thi },
          luc: new Date(d.luc),
          tu: trangThaiTaskTuDong(d.tu),
          sang: trangThaiTaskTuDong(d.sang),
          lyDo: d.ly_do,
        }),
      )
      // Luật thuần xếp theo thời điểm; sắp xếp ổn định nên cùng lúc thì giữ thứ tự ghi (đã xếp theo stt).
      return thanhCong(xepLichSuTask(lichSu))
    },
  }
}
