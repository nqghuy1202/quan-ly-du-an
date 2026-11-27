// Lệnh vòng duyệt của bản cài Supabase (ticket 14): đổi trạng thái Task và đọc lịch sử trạng thái
// (ticket 11).
//
// - Dữ liệu: hàm public.doi_trang_thai_task, public.lich_su_task và bảng
//   public.lich_su_trang_thai_task trong supabase/migrations/20261125000300_lat_3_vong_duyet.sql. Hàm
//   lich_su_task được thay ở supabase/migrations/20261126000600_truong_task_ho_so_nguoi.sql để trả thêm dòng
//   đổi Mức ưu tiên (bảng public.lich_su_muc_uu_tien_task) trên cùng dòng thời gian.
// - Như phần Dự án và Task: quyền được kiểm hai lần. Ở đây bằng chính luật thuần
//   (`kiemChuyenTrangThai` trong src/luat/chuyenTrangThai.ts, không viết lại luật) để trả đúng mã
//   lỗi, đúng thông báo và đúng thứ tự như bản bộ nhớ; ở cơ sở dữ liệu bằng hàm security definer,
//   hàng rào thật vì trình duyệt không đáng tin. Hàm lấy người gọi từ phiên đăng nhập (auth.uid()),
//   không nhận người gọi qua tham số. Lỗi mà cơ sở dữ liệu ném ra mang mã lỗi của Kho.
// - Đổi trạng thái gọi hàm TRƯỚC, không đọc trước (ticket toi-uu-hieu-nang 06; hàm kiểm cùng bảy bước, cùng thứ tự
//   với luật thuần): bị từ chối vì luật thì mới đọc Task và chạy luật thuần để trả đúng mã, thông báo và lỗi theo ô.
//   Dữ liệu biểu mẫu chắc chắn sai thì đọc Task và để luật thuần từ chối, không gửi lệnh ghi nào.
// - Client không bao giờ ghi thẳng cột trạng thái, số lần Trả lại hay bảng lịch sử: chỉ gọi hàm.
// - Giờ do máy chủ đặt: tham số `bayGio` bị bỏ qua (thời điểm của dòng lịch sử, ngày chỉnh sửa).
// - Tiến độ và Trễ hạn KHÔNG có truy vấn riêng ở đây: chúng tính bằng hàm thuần của ticket 13 trên
//   danh sách Task mà `danhSachTask` (khoSupabaseTask.ts) đọc, đã có đủ trạng thái và hạn.
//
// File này nhận các hàm dùng chung của khoSupabase.ts qua `PhuThuocLenhVongDuyet` để không import vòng.
//
// CỔNG CHƯA KIỂM: các lệnh cần mạng chỉ chạy được với Supabase thật (lệnh riêng, xem
// src/kho/khoSupabase.test.ts). Cổng kiểm các nhánh với một `fetch` giả (src/kho/khoSupabaseVongDuyet.test.ts).
import { thanhCong, thatBai, type KetQua, type MaLoi } from './ketQua'
import type { DongLichSuTask, KhoDuLieu, Phien, Task } from './khoDuLieu'
import type { NguCanhDuAn as NguCanhDuAnChung, NguoiGoi } from './khoSupabaseNguoiGoi'
import {
  MA_TRAN_CHUYEN_TRANG_THAI,
  THONG_BAO_CHUYEN_TRANG_THAI,
  doiTrangThaiSchema,
  kiemChuyenTrangThai,
  xepLichSuTask,
} from '../luat/chuyenTrangThai'
import { kiemTra } from '../luat/taiKhoan'
import { CAC_TRANG_THAI_TASK, type TrangThaiTask } from '../luat/task'
import type { TrangThaiDuAn } from '../luat/duAn'
import { MUC_UU_TIEN_MAC_DINH, laMucUuTien, type MucUuTien } from '../luat/mucUuTien'

/** Lỗi trả về từ PostgREST (bảng, RPC). */
interface LoiCsdl {
  code?: string
  message?: string
}

type NguCanhDuAn = NguCanhDuAnChung<{ id: string; trang_thai: string }>

/** Các hàm dùng chung mà khoSupabase.ts đưa vào (xác thực, đọc Task kèm Dự án theo đúng luật xem). */
export interface PhuThuocLenhVongDuyet {
  xacThuc(phien: Phien | null): Promise<KetQua<NguoiGoi>>
  /**
   * Một Task kèm Dự án và Người trong dự án trong MỘT lượt đọc, không dùng chung khi đang bay
   * (khoSupabaseNguoiGoi.ts). Task không tồn tại, không thấy được hay id sai dạng: `KHONG_TIM_THAY`.
   */
  xemTaskDeGhi(
    phien: Phien | null,
    taskId: string,
  ): Promise<KetQua<NguCanhDuAn & { nguoiTrong: readonly { nguoi_dung_id: string }[]; task: DongTaskChuyen }>>
  /** `layTask` của bản cài này: đọc lại Task đầy đủ sau khi đổi trạng thái. */
  layTask: KhoDuLieu['layTask']
  laUuid(id: string): boolean
  loiTuCsdl<T = never>(loi: LoiCsdl): KetQua<T>
}

export type LenhVongDuyetSupabase = Pick<KhoDuLieu, 'doiTrangThaiTask' | 'lichSuTask'>

/** Cột của Task mà luật chuyển trạng thái cần. */
interface DongTaskChuyen {
  id: string
  du_an_id: string
  nguoi_thuc_hien_id: string
  nguoi_kiem_tra_id: string
  trang_thai: string
}

/**
 * Một dòng do hàm `lich_su_task` trả về. `loai` (ticket truong-moi 04; hàm mới trong
 * supabase/migrations/20261126000600_truong_task_ho_so_nguoi.sql): `'MUC_UU_TIEN'` là dòng đổi Mức ưu tiên (`tu`,
 * `sang` là mức); `'TRANG_THAI'`, thiếu (trước migration) hay giá trị khác là dòng trạng thái. `stt` là thứ tự
 * trên dòng thời gian chung của hai loại.
 */
interface DongLichSuCsdl {
  stt: number
  loai?: string | null
  nguoi_doi_id: string
  ten_hien_thi: string
  luc: string
  tu: string
  sang: string
  ly_do: string | null
}

/** Mức ưu tiên đọc từ cơ sở dữ liệu; giá trị lạ (không thể có nhờ ràng buộc) coi như mức mặc định. */
function mucUuTienTuDong(giaTri: string): MucUuTien {
  return laMucUuTien(giaTri) ? giaTri : MUC_UU_TIEN_MAC_DINH
}

/** Các mã lỗi của vòng duyệt mà hàm cơ sở dữ liệu ném thêm so với `MA_TU_CSDL` của khoSupabase.ts. */
const MA_VONG_DUYET: readonly MaLoi[] = ['TASK_DA_CHOT', 'KHONG_HOP_LE', 'BUOC_KHONG_HOP_LE', 'LY_DO_BAT_BUOC']

/** Mã lỗi mà hàm `doi_trang_thai_task` ném vì luật (không phải phiên hay lỗi hệ thống): đọc Task để chọn đúng lỗi. */
const MA_TU_CHOI_VI_LUAT: readonly MaLoi[] = ['KHONG_CO_QUYEN', 'KHONG_TIM_THAY', 'DU_AN_DA_LUU_TRU', ...MA_VONG_DUYET]

/**
 * Thiếu lý do chắc chắn bị luật từ chối (bước 7 của `kiemChuyenTrangThai`, không phụ thuộc Task): mọi bước sang
 * trạng thái đích đều cần lý do (Trả lại, Bị lỗi, Huỷ) mà không có lý do.
 */
function chacChanThieuLyDo(sang: TrangThaiTask, lyDo: string | null): boolean {
  const buocSang = MA_TRAN_CHUYEN_TRANG_THAI.filter((b) => b.sang === sang)
  return lyDo === null && buocSang.length > 0 && buocSang.every((b) => b.canLyDo)
}

/** Trạng thái Dự án đọc từ cơ sở dữ liệu; giá trị lạ coi như Lưu trữ, trạng thái chặn mọi lệnh ghi. */
function trangThaiDuAnTuDong(giaTri: string): TrangThaiDuAn {
  return giaTri === 'HOAT_DONG' ? 'HOAT_DONG' : 'LUU_TRU'
}

/** Trạng thái Task đọc từ cơ sở dữ liệu; giá trị lạ (không thể có nhờ ràng buộc) coi như Huỷ, trạng thái chặn mọi lệnh ghi. */
function trangThaiTaskTuDong(giaTri: string): TrangThaiTask {
  return (CAC_TRANG_THAI_TASK as readonly string[]).includes(giaTri) ? (giaTri as TrangThaiTask) : 'HUY'
}

export function taoLenhVongDuyetSupabase(phuThuoc: PhuThuocLenhVongDuyet): LenhVongDuyetSupabase {
  const { xacThuc, xemTaskDeGhi, layTask, laUuid } = phuThuoc

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

  /**
   * Lỗi của một lần đổi trạng thái theo đúng luật thuần (mã, thông báo, lỗi theo ô, thứ tự từ chối): đọc Task kèm Dự
   * án trong một lượt rồi chạy `kiemChuyenTrangThai`. Task không thấy được: PM nhận KHONG_TIM_THAY, người khác
   * KHONG_CO_QUYEN (phân quyền từng dòng giấu Task của Dự án người gọi không thấy). Luật thuần cho qua mà cơ sở dữ
   * liệu đã từ chối (`daTuChoi`: đua với người khác, hay vai vừa đổi) thì trả lỗi của cơ sở dữ liệu. Luật thuần cho
   * qua và chưa gọi hàm (`daTuChoi` null) thì gọi hàm rồi đọc lại như đường thành công.
   */
  async function tuChoiTheoLuat(
    phien: Phien | null,
    taskId: string,
    dauVao: unknown,
    daTuChoi: KetQua<never> | null,
  ): Promise<KetQua<Task>> {
    const xt = await xacThuc(phien)
    if (!xt.ok) return xt
    const { db, hoSo } = xt.giaTri
    const doc = await xemTaskDeGhi(phien, taskId)
    if (!doc.ok) {
      if (doc.loi.ma !== 'KHONG_TIM_THAY') return daTuChoi && doc.loi.ma !== 'CHUA_DANG_NHAP' ? daTuChoi : doc
      return thatBai(hoSo.vai === 'PM' ? 'KHONG_TIM_THAY' : 'KHONG_CO_QUYEN')
    }
    const { duAn, nhin, task } = doc.giaTri
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
    if (daTuChoi) return daTuChoi
    const { error: loiHam } = await db.rpc('doi_trang_thai_task', {
      p_task_id: taskId,
      p_sang: kq.buoc.sang,
      p_ly_do: kq.lyDo,
    })
    if (loiHam) return loiVongDuyet(loiHam)
    return layTask(phien, taskId)
  }

  return {
    async doiTrangThaiTask(phien: Phien | null, taskId: string, dauVao) {
      // `bayGio` bị bỏ qua: thời điểm của dòng lịch sử và ngày chỉnh sửa do cơ sở dữ liệu đặt.
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      const { db, hoSo } = xt.giaTri
      // Task không tồn tại: người không phải PM nhận KHONG_CO_QUYEN (không lộ gì), PM nhận KHONG_TIM_THAY.
      if (!laUuid(taskId)) return thatBai(hoSo.vai === 'PM' ? 'KHONG_TIM_THAY' : 'KHONG_CO_QUYEN')

      // Dữ liệu biểu mẫu chắc chắn sai (trạng thái đích hay lý do sai dạng, thiếu lý do bắt buộc): đọc Task rồi để
      // luật thuần từ chối đúng thứ tự (quyền, Lưu trữ, Task đã chốt trước lỗi dữ liệu); không gửi lệnh ghi nào.
      const kt = kiemTra(doiTrangThaiSchema, dauVao)
      const lyDo = kt.ok && (kt.giaTri.lyDo ?? '') !== '' ? (kt.giaTri.lyDo ?? null) : null
      if (!kt.ok || chacChanThieuLyDo(kt.giaTri.sang, lyDo)) return tuChoiTheoLuat(phien, taskId, dauVao, null)

      // Gọi hàm trước, không đọc trước (ticket toi-uu-hieu-nang 06): hàm `doi_trang_thai_task` tự kiểm đủ bảy bước
      // của `kiemChuyenTrangThai`, đúng thứ tự (người gọi lấy từ phiên, không từ tham số), rồi mới ghi trạng thái, bộ
      // đếm Trả lại, dấu vết chỉnh sửa và một dòng lịch sử trong một giao dịch. Lý do gửi đi là bản đã cắt khoảng
      // trắng; null khi không có. Ba lượt: gọi hàm, đọc lại Task (`layTask`: Task kèm Dự án, rồi tên người).
      const { error: loiHam } = await db.rpc('doi_trang_thai_task', {
        p_task_id: taskId,
        p_sang: kt.giaTri.sang,
        p_ly_do: lyDo,
      })
      if (!loiHam) return layTask(phien, taskId)
      const loi = loiVongDuyet<never>(loiHam)
      if (loi.ok || !MA_TU_CHOI_VI_LUAT.includes(loi.loi.ma)) return loi
      // Bị từ chối vì luật: đọc Task để trả đúng mã, thông báo và lỗi theo ô của luật thuần, như khi kiểm trước.
      return tuChoiTheoLuat(phien, taskId, dauVao, loi)
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
      const lichSu = dong.map((d): DongLichSuTask => {
        const nguoiDoi = { id: d.nguoi_doi_id, tenHienThi: d.ten_hien_thi }
        if (d.loai === 'MUC_UU_TIEN') {
          return { loai: 'MUC_UU_TIEN', nguoiDoi, luc: new Date(d.luc), tu: mucUuTienTuDong(d.tu), sang: mucUuTienTuDong(d.sang) }
        }
        return {
          loai: 'TRANG_THAI',
          nguoiDoi,
          luc: new Date(d.luc),
          tu: trangThaiTaskTuDong(d.tu),
          sang: trangThaiTaskTuDong(d.sang),
          lyDo: d.ly_do,
        }
      })
      // Luật thuần xếp theo thời điểm; sắp xếp ổn định nên cùng lúc thì giữ thứ tự ghi (đã xếp theo stt).
      return thanhCong(xepLichSuTask(lichSu))
    },
  }
}
