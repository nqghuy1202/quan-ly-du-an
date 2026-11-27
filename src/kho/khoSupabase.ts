// Bản cài Supabase của Kho dữ liệu (lát 1: tài khoản, hồ sơ, vai, Dự án, người trong dự án).
//
// - Đăng ký, đăng nhập, xác nhận email, đặt lại mật khẩu: Supabase Auth (thư do Supabase gửi).
// - Dữ liệu: bảng public.ho_so, public.du_an, public.nguoi_trong_du_an và các hàm trong
//   supabase/migrations/20261125000100_lat_1_ho_so_du_an.sql.
// - Quyền được kiểm hai lần: ở đây bằng chính luật thuần (src/luat/) để trả đúng mã lỗi và đúng
//   thứ tự như bản bộ nhớ, và ở cơ sở dữ liệu (phân quyền từng dòng, trigger, hàm) vì trình duyệt
//   không đáng tin. Cơ sở dữ liệu là hàng rào thật; lỗi nó ném ra mang mã lỗi của Kho. Lưu trữ, mở lại Dự án
//   không kiểm trước (ticket toi-uu-hieu-nang 05): hàm của cơ sở dữ liệu kiểm đúng luật, đúng thứ tự và ném đúng mã.
// - Chỉ dùng địa chỉ và khoá công khai; không bao giờ nhận khoá service (xem cauHinh.ts).
//
// Khác bản bộ nhớ (do Supabase quyết, đã ghi trong supabase/README.md):
// - Giờ do máy chủ đặt: tham số `bayGio` bị bỏ qua (ngày tạo, ngày chỉnh sửa, hạn mã đặt lại).
// - Supabase Auth không phân biệt mã đặt lại sai, đã dùng hay hết hạn: cả ba trả `MA_KHONG_HOP_LE`.
// - Đăng ký lại một email đã đăng ký nhưng chưa xác nhận: Supabase gửi lại thư thay vì báo trùng.
//
// Lệnh Task (ticket 07, 08, 09) nằm ở khoSupabaseTask.ts, dùng bảng public.task trong
// supabase/migrations/20261125000200_lat_2_task.sql. Lệnh đổi trạng thái và lịch sử Task (ticket 14)
// nằm ở khoSupabaseVongDuyet.ts, dùng hàm trong supabase/migrations/20261125000300_lat_3_vong_duyet.sql.
// Lệnh repo GitHub và link issue hoặc PR (ticket 15, 16) nằm ở khoSupabaseGitHub.ts (ticket 17), dùng bảng
// trong supabase/migrations/20261125000400_lat_4_github.sql. Trường mới của Dự án (Mã, Khách hàng, hai ngày,
// Mức ưu tiên, Người phụ trách; ticket truong-moi 09): supabase/migrations/20261126000500_truong_du_an.sql.
// Thông tin nhân sự của hồ sơ, Vai trò trong Dự án và Mức ưu tiên của Task (ticket truong-moi 10):
// supabase/migrations/20261126000600_truong_task_ho_so_nguoi.sql.
//
// Xác định người gọi (phiên đang mở, hồ sơ nhớ theo phiên, kiểm ở trong Dự án, đọc Dự án theo luật xem và ghi)
// nằm ở một chỗ: khoSupabaseNguoiGoi.ts (ticket toi-uu-hieu-nang 01). Mọi lệnh nhận phiên chạy theo vai mới nhất.
//
// CỔNG CHƯA KIỂM: các lệnh cần mạng chỉ chạy được với Supabase thật (lệnh riêng, xem
// src/kho/khoSupabase.test.ts). Cổng chỉ kiểm các nhánh không gọi mạng.
import {
  createClient,
  isAuthRetryableFetchError,
  type AuthError,
  type SupabaseClient,
} from '@supabase/supabase-js'
import { THONG_BAO_MAC_DINH, thanhCong, thatBai, type KetQua, type MaLoi } from './ketQua'
import { taoDocLoSupabase } from './khoSupabaseDocLo'
import { taoLenhGitHubSupabase } from './khoSupabaseGitHub'
import {
  COT_TASK_KEM_LIEN_KET,
  SO_LIEN_KET_TOI_DA,
  docDongTaskCuaDuAn,
  taoLenhTaskSupabase,
  trangThaiTaskTuDong,
  type DongTask,
  type DongTaskKemLienKet,
} from './khoSupabaseTask'
import { taoLenhVongDuyetSupabase } from './khoSupabaseVongDuyet'
import { taoXacDinhNguoiGoi, type DongTaskKemDuAn } from './khoSupabaseNguoiGoi'
import type { DocTongQuanTheoLo } from './tongQuan'
import { THONG_BAO_NHAN_SU, THONG_TIN_NHAN_SU_TRONG } from '../luat/thongTinNhanSu'
import type {
  DuAn,
  DuAnTomTat,
  HoSo,
  KhoDuLieu,
  NguoiDungTomTat,
  NguoiTrongDuAn,
  Phien,
  ThongTinNhanSu,
} from './khoDuLieu'
import { soTaskDangGiu } from '../luat/task'
import { MUC_UU_TIEN_MAC_DINH, THONG_BAO_MUC_UU_TIEN, laMucUuTien, type MucUuTien } from '../luat/mucUuTien'
import {
  duocTaoDuAn,
  kiemGhiDuAn,
  duocQuanLyDuAn,
  kiemSuaVaiTroTrongDuAn,
  kiemTraDuAn,
  ngayDuAnSauSua,
  THONG_BAO_DU_AN,
  type LocDuAnDauVao,
  type SuaDuAnDauVao,
  type SuaVaiTroTrongDuAnDauVao,
  type TaoDuAnDauVao,
  type ThemNguoiDauVao,
  type TrangThaiDuAn,
} from '../luat/duAn'
import {
  CAC_VAI,
  THONG_BAO,
  VAI_MAC_DINH,
  dangKySchema,
  dangNhapSchema,
  datLaiMatKhauSchema,
  doiVaiSchema,
  duocQuanLyNguoiDung,
  duocSuaHoSo,
  emailSchema,
  kiemDoiVai,
  kiemTra,
  suaHoSoSchema,
  type DangKyDauVao,
  type DangNhapDauVao,
  type DatLaiMatKhauDauVao,
  type DoiVaiDauVao,
  type EmailDauVao,
  type SuaHoSoDauVao,
  type VaiHeThong,
} from '../luat/taiKhoan'

export interface TuyChonKhoSupabase {
  /** Địa chỉ project Supabase. */
  url: string
  /** Khoá công khai (anon hoặc publishable). Không bao giờ là khoá service. */
  khoaCongKhai: string
  /**
   * Địa chỉ trang mà đường dẫn trong thư (xác nhận email, đặt lại mật khẩu) đưa người dùng về.
   * Mặc định: Site URL cấu hình trên Supabase.
   */
  duongDanQuayLai?: string
  /** Tự làm mới phiên trước khi hết hạn. Mặc định đúng; test chạy ngắn tắt đi để không để lại bộ hẹn giờ. */
  tuDongLamMoiPhien?: boolean
  /** `fetch` dùng cho mọi lần gọi Supabase (test truyền bản cấm gọi mạng). */
  fetch?: typeof fetch
}

/** Thông báo khi mã đặt lại không dùng được: Supabase không cho biết sai, đã dùng hay hết hạn. */
export const THONG_BAO_MA_DAT_LAI_SUPABASE =
  'Mã đặt lại không đúng, đã được dùng hoặc đã hết hạn. Hãy kiểm tra mã trong thư mới nhất, hoặc yêu cầu mã mới.'

// `so_dien_thoai`, `chuc_danh`, `phong_ban` (Thông tin nhân sự, ticket truong-moi 05): migration
// supabase/migrations/20261126000600_truong_task_ho_so_nguoi.sql (ticket truong-moi 10). Quyền xem ép ở phía cơ sở
// dữ liệu: phân quyền từng dòng ho_so_doc chỉ trả hồ sơ người gọi đủ quyền xem ba trường (xem phần 3 của migration).
const COT_HO_SO = 'id, email, ten_hien_thi, github_username, vai, so_dien_thoai, chuc_danh, phong_ban'
// `ma`, `khach_hang` (ticket truong-moi 01), `ngay_bat_dau`, `ngay_ket_thuc_du_kien` (ticket truong-moi 02),
// `muc_uu_tien`, `nguoi_phu_trach_id` (ticket truong-moi 03); migration supabase/migrations/20261126000500_truong_du_an.sql
// (ticket truong-moi 09), kiểm tay theo supabase/README.md.
const COT_DU_AN =
  'id, ma, ten, mo_ta, khach_hang, ngay_bat_dau, ngay_ket_thuc_du_kien, muc_uu_tien, nguoi_phu_trach_id, trang_thai, tao_boi, tao_luc, sua_boi, sua_luc'

interface DongHoSo {
  id: string
  email: string
  ten_hien_thi: string
  github_username: string | null
  vai: string
  /**
   * Ba cột Thông tin nhân sự; null khi trống hoặc người gọi không đủ quyền xem (hàm them_nguoi_vao_du_an trả
   * null), thiếu khi cơ sở dữ liệu chưa áp migration 20261126000600_truong_task_ho_so_nguoi.sql: đọc thành null.
   */
  so_dien_thoai?: string | null
  chuc_danh?: string | null
  phong_ban?: string | null
}

interface DongDuAn {
  id: string
  /** Thiếu khi cơ sở dữ liệu chưa áp migration trường mới (20261126000500_truong_du_an.sql): đọc thành chuỗi rỗng. */
  ma?: string | null
  ten: string
  mo_ta: string
  khach_hang?: string | null
  /** Kiểu `date` (`YYYY-MM-DD`); thiếu khi chưa áp migration trường mới (20261126000500_truong_du_an.sql): đọc thành null. */
  ngay_bat_dau?: string | null
  ngay_ket_thuc_du_kien?: string | null
  /** `THAP`, `TRUNG_BINH`, `CAO`; thiếu hay lạ (chưa áp migration 20261126000500_truong_du_an.sql) thì đọc thành Trung bình. */
  muc_uu_tien?: string | null
  /** Id tài khoản của Người phụ trách; thiếu khi chưa áp migration (20261126000500_truong_du_an.sql): đọc thành chưa có. */
  nguoi_phu_trach_id?: string | null
  trang_thai: string
  tao_boi: string
  tao_luc: string
  sua_boi: string | null
  sua_luc: string | null
}

/** Lỗi trả về từ PostgREST (bảng, RPC). */
interface LoiCsdl {
  code?: string
  message?: string
}

/** Các mã lỗi nghiệp vụ mà migration ném ra bằng `raise exception '<MÃ>'`. */
const MA_TU_CSDL: readonly MaLoi[] = [
  'CHUA_DANG_NHAP',
  'KHONG_CO_QUYEN',
  'KHONG_TIM_THAY',
  'PHAI_CON_PM',
  'DU_AN_DA_LUU_TRU',
  'DU_AN_DANG_HOAT_DONG',
  'CHUA_DANG_KY',
  'DA_TRONG_DU_AN',
  'THIEU_NGUOI',
  'NGUOI_NGOAI_DU_AN',
  'TRUNG_NGUOI',
]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Id không phải uuid thì chắc chắn không có trong cơ sở dữ liệu (và gửi đi sẽ gây lỗi kiểu). */
function laUuid(id: string): boolean {
  return UUID.test(id)
}

/** Id người cần tên hiển thị trên một Dự án: người tạo, người sửa, Người phụ trách. */
function idNguoiCuaDuAn(d: DongDuAn): string[] {
  return [d.tao_boi, ...(d.sua_boi ? [d.sua_boi] : []), ...(d.nguoi_phu_trach_id ? [d.nguoi_phu_trach_id] : [])]
}

/** Dự án như giao diện Kho trả ra từ một dòng; `ten` cho tên hiển thị hiện tại theo id. */
function duAnTuDong(d: DongDuAn, ten: (id: string) => string): DuAn {
  const nguoi = (id: string) => ({ id, tenHienThi: ten(id) })
  return {
    id: d.id,
    ma: d.ma ?? '',
    ten: d.ten,
    moTa: d.mo_ta,
    khachHang: d.khach_hang ?? '',
    ngayBatDau: d.ngay_bat_dau ?? null,
    ngayKetThucDuKien: d.ngay_ket_thuc_du_kien ?? null,
    mucUuTien: laMucUuTien(d.muc_uu_tien) ? d.muc_uu_tien : MUC_UU_TIEN_MAC_DINH,
    nguoiPhuTrach: d.nguoi_phu_trach_id ? nguoi(d.nguoi_phu_trach_id) : null,
    trangThai: trangThaiTuDong(d.trang_thai),
    dauVet: {
      taoBoi: nguoi(d.tao_boi),
      taoLuc: new Date(d.tao_luc),
      suaBoi: d.sua_boi ? nguoi(d.sua_boi) : null,
      suaLuc: d.sua_luc ? new Date(d.sua_luc) : null,
    },
  }
}

function laVai(giaTri: string): giaTri is VaiHeThong {
  return (CAC_VAI as readonly string[]).includes(giaTri)
}

/**
 * Trạng thái đọc từ cơ sở dữ liệu; giá trị lạ (không thể có nhờ ràng buộc) coi như Lưu trữ, trạng
 * thái chặn mọi lệnh ghi.
 */
function trangThaiTuDong(giaTri: string): TrangThaiDuAn {
  return giaTri === 'HOAT_DONG' ? 'HOAT_DONG' : 'LUU_TRU'
}

/** Vai đọc từ cơ sở dữ liệu; giá trị lạ (không thể có nhờ ràng buộc) coi như Thành viên, quyền thấp nhất. */
function vaiTuDong(giaTri: string): VaiHeThong {
  return laVai(giaTri) ? giaTri : VAI_MAC_DINH
}

function nhanSuTuDong(dong: DongHoSo): ThongTinNhanSu {
  return {
    soDienThoai: dong.so_dien_thoai ?? null,
    chucDanh: dong.chuc_danh ?? null,
    phongBan: dong.phong_ban ?? null,
  }
}

function hoSoTuDong(dong: DongHoSo): HoSo {
  return {
    id: dong.id,
    email: dong.email,
    tenHienThi: dong.ten_hien_thi,
    githubUsername: dong.github_username,
    vai: vaiTuDong(dong.vai),
    ...nhanSuTuDong(dong),
  }
}

/**
 * Tóm tắt một tài khoản. Thông tin nhân sự lấy như cơ sở dữ liệu trả về: quyền xem được ép ở phía cơ sở
 * dữ liệu (migration 20261126000600_truong_task_ho_so_nguoi.sql), khớp `duocXemThongTinNhanSu`; trống hay
 * không đủ quyền thì null, như bản bộ nhớ.
 */
function tomTatTuDong(dong: DongHoSo): NguoiDungTomTat {
  return {
    id: dong.id,
    email: dong.email,
    tenHienThi: dong.ten_hien_thi,
    vai: vaiTuDong(dong.vai),
    ...nhanSuTuDong(dong),
  }
}

/**
 * Một dòng của bảng nguoi_trong_du_an kèm hồ sơ. Cột `vai_tro` (Vai trò trong Dự án) do migration
 * 20261126000600_truong_task_ho_so_nguoi.sql thêm; trước đó cơ sở dữ liệu thật chưa có cột này.
 */
interface DongNguoiTrongDuAn {
  vai_tro?: string | null
  ho_so: DongHoSo | null
}

/** Dòng Người trong dự án kèm id người (đọc lúc kiểm xem Dự án, dùng cả cho danh sách Người trong dự án). */
interface DongNguoiTrongDuAnKemId extends DongNguoiTrongDuAn {
  nguoi_dung_id: string
}

/** Cột đọc của bảng nguoi_trong_du_an: Vai trò trong Dự án và hồ sơ của người đó. */
const COT_NGUOI_TRONG_DU_AN = `vai_tro, ho_so!nguoi_trong_du_an_nguoi_dung_id_fkey(${COT_HO_SO})`
const COT_NGUOI_TRONG_DU_AN_KEM_ID = `nguoi_dung_id, ${COT_NGUOI_TRONG_DU_AN}`

/** Lượt kiểm quản lý Dự án (`quanLyDuAn`): dòng Dự án kèm id mọi Người trong dự án nhúng. */
const COT_DU_AN_KEM_ID_NGUOI_TRONG = `${COT_DU_AN}, nguoi_trong_du_an!nguoi_trong_du_an_du_an_id_fkey(nguoi_dung_id)`

/** Lượt đọc Task theo id (`docTaskKemDuAn`): Task, link, và Dự án kèm Người trong dự án nhúng lồng. */
const COT_TASK_KEM_DU_AN = `${COT_TASK_KEM_LIEN_KET}, du_an!task_du_an_id_fkey(${COT_DU_AN}, nguoi_trong_du_an!nguoi_trong_du_an_du_an_id_fkey(${COT_NGUOI_TRONG_DU_AN_KEM_ID}))`

/** Dòng Task như lượt đọc `COT_TASK_KEM_DU_AN` trả về (Dự án nhúng là một dòng, PostgREST trả đối tượng). */
interface DongTaskNhungDuAn extends DongTaskKemLienKet {
  du_an: DongDuAnNhungNguoiTrong | DongDuAnNhungNguoiTrong[] | null
}

type DongDuAnNhungNguoiTrong = DongDuAn & { nguoi_trong_du_an?: DongNguoiTrongDuAnKemId[] | null }

/**
 * Một Người trong dự án từ dòng của cơ sở dữ liệu; số Task đang giữ tính phía client (`demTask`) bằng luật
 * thuần trên bảng task mà người gọi đọc được (ai thấy Dự án thì thấy mọi Task của nó, nên đếm đủ).
 */
/**
 * Bộ đếm số Task đang giữ (Task chưa Hoàn thành, chưa Huỷ mà người đó là Người thực hiện) trên các dòng Task của
 * một Dự án, bằng luật thuần `soTaskDangGiu`. Giá trị trạng thái lạ (không thể có nhờ ràng buộc) coi như Huỷ.
 */
function boDemTaskDangGiu(dong: readonly Pick<DongTask, 'nguoi_thuc_hien_id' | 'trang_thai'>[]): (id: string) => number {
  const task = dong.map((d) => ({ nguoiThucHienId: d.nguoi_thuc_hien_id, trangThai: trangThaiTaskTuDong(d.trang_thai) }))
  return (id: string) => soTaskDangGiu(task, id)
}

function nguoiTrongDuAnTuDong(hoSo: DongHoSo, vaiTro: string | null | undefined, demTask: (id: string) => number): NguoiTrongDuAn {
  return { ...tomTatTuDong(hoSo), vaiTroTrongDuAn: vaiTro ?? null, soTaskDangGiu: demTask(hoSo.id) }
}

/**
 * Ô của biểu mẫu Dự án và lỗi tiếng Việt (như luật thuần báo) theo tên ràng buộc kiểm tra của bảng du_an
 * (supabase/migrations/20261126000500_truong_du_an.sql). Luật thuần đã kiểm trước khi gửi, nên các lỗi
 * này chỉ xảy ra khi cơ sở dữ liệu là hàng rào cuối (vd. hai người sửa cùng lúc).
 */
const O_THEO_RANG_BUOC_DU_AN: Readonly<Record<string, Record<string, string>>> = {
  du_an_ma_hop_le: { ma: THONG_BAO_DU_AN.maSai },
  du_an_khach_hang_hop_le: { khachHang: THONG_BAO_DU_AN.khachHangQuaDai },
  du_an_muc_uu_tien_hop_le: { mucUuTien: THONG_BAO_MUC_UU_TIEN.sai },
}

/**
 * Ô của biểu mẫu hồ sơ và lỗi tiếng Việt (như luật thuần báo) theo tên ràng buộc kiểm tra của bảng ho_so
 * (supabase/migrations/20261126000600_truong_task_ho_so_nguoi.sql).
 */
const O_THEO_RANG_BUOC_HO_SO: Readonly<Record<string, Record<string, string>>> = {
  ho_so_so_dien_thoai_hop_le: { soDienThoai: THONG_BAO_NHAN_SU.soDienThoaiSai },
  ho_so_chuc_danh_hop_le: { chucDanh: THONG_BAO_NHAN_SU.chucDanhQuaDai },
  ho_so_phong_ban_hop_le: { phongBan: THONG_BAO_NHAN_SU.phongBanQuaDai },
}

/** Tên ràng buộc trong thông báo lỗi của PostgreSQL (`... constraint "ten_rang_buoc"`), nếu có. */
function tenRangBuoc(loi: LoiCsdl): string | null {
  return /constraint "([^"]+)"/.exec(loi.message ?? '')?.[1] ?? null
}

/** Thông điệp lỗi là đúng mã `ma` do `raise exception` ném (kèm hay không kèm phần giải thích). */
function laMaCsdl(loi: LoiCsdl, ma: string): boolean {
  const thongDiep = (loi.message ?? '').trim()
  return thongDiep === ma || thongDiep.startsWith(`${ma}:`)
}

/**
 * Lỗi khi sửa hồ sơ, đổi về đúng mã và ô như bản bộ nhớ: 23514 (ràng buộc dạng Số điện thoại, độ dài Chức
 * danh, Phòng ban) → `KHONG_HOP_LE` ở ô tương ứng; lỗi khác như `loiTuCsdl` (trigger ho_so_truoc_khi_sua ném
 * `KHONG_CO_QUYEN` khi sửa hồ sơ của người khác).
 */
function loiGhiHoSo<T = never>(loi: LoiCsdl): KetQua<T> {
  if (loi.code === '23514') {
    const rangBuoc = tenRangBuoc(loi)
    return thatBai('KHONG_HOP_LE', undefined, rangBuoc ? O_THEO_RANG_BUOC_HO_SO[rangBuoc] : undefined)
  }
  return loiTuCsdl(loi)
}

/**
 * Lỗi khi ghi Vai trò trong Dự án (thêm người kèm vai trò, sửa vai trò), đổi về đúng mã và ô như bản bộ nhớ:
 * vai trò quá dài (hàm them_nguoi_vao_du_an ném `KHONG_HOP_LE`, hoặc ràng buộc `nguoi_trong_du_an_vai_tro_hop_le`)
 * → `KHONG_HOP_LE` ở ô `vaiTroTrongDuAn`; lỗi khác như `loiTuCsdl`.
 */
function loiGhiVaiTro<T = never>(loi: LoiCsdl): KetQua<T> {
  if (laMaCsdl(loi, 'KHONG_HOP_LE') || (loi.code === '23514' && tenRangBuoc(loi) === 'nguoi_trong_du_an_vai_tro_hop_le')) {
    return thatBai('KHONG_HOP_LE', undefined, { vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroQuaDai })
  }
  return loiTuCsdl(loi)
}

/** Lỗi Người phụ trách ngoài Dự án, đúng như bản bộ nhớ: thông báo riêng kèm lỗi ở ô `nguoiPhuTrachId`. */
function loiNguoiPhuTrachNgoaiDuAn<T = never>(): KetQua<T> {
  return thatBai('NGUOI_NGOAI_DU_AN', THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn, {
    nguoiPhuTrachId: THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn,
  })
}

/**
 * Lỗi khi ghi bảng du_an (tạo, sửa), đổi về đúng mã và ô như bản bộ nhớ:
 * - 23505 (chỉ mục duy nhất `du_an_ma_key` trên upper(ma)): Mã Dự án trùng → `MA_DU_AN_DA_DUNG` ở ô Mã;
 * - 23514 `du_an_ngay_hop_le`: Ngày kết thúc dự kiến trước Ngày bắt đầu → `KHONG_HOP_LE` ở ô `oNgay` (ô vừa
 *   gửi, như `ngayDuAnSauSua`); ràng buộc kiểm tra khác → `KHONG_HOP_LE` ở ô tương ứng;
 * - `NGUOI_NGOAI_DU_AN` do trigger ném, hoặc 23503 của khoá ngoại `du_an_nguoi_phu_trach_fkey` (người vừa bị
 *   gỡ khỏi Dự án cùng lúc): Người phụ trách ngoài Dự án;
 * - lỗi khác như `loiTuCsdl`.
 */
function loiGhiDuAn<T = never>(
  loi: LoiCsdl,
  oNgay: 'ngayBatDau' | 'ngayKetThucDuKien' = 'ngayKetThucDuKien',
): KetQua<T> {
  if (loi.code === '23505') return thatBai('MA_DU_AN_DA_DUNG', undefined, { ma: THONG_BAO_DU_AN.maTrung })
  if (loi.code === '23514') {
    const rangBuoc = tenRangBuoc(loi)
    if (rangBuoc === 'du_an_ngay_hop_le') {
      return thatBai('KHONG_HOP_LE', undefined, { [oNgay]: THONG_BAO_DU_AN.ngayKetThucTruocBatDau })
    }
    const o = rangBuoc ? O_THEO_RANG_BUOC_DU_AN[rangBuoc] : undefined
    return thatBai('KHONG_HOP_LE', undefined, o)
  }
  if (loi.code === '23503' && tenRangBuoc(loi) === 'du_an_nguoi_phu_trach_fkey') return loiNguoiPhuTrachNgoaiDuAn()
  const thongDiep = (loi.message ?? '').trim()
  if (thongDiep === 'NGUOI_NGOAI_DU_AN' || thongDiep.startsWith('NGUOI_NGOAI_DU_AN:')) return loiNguoiPhuTrachNgoaiDuAn()
  return loiTuCsdl(loi)
}

/** Đổi lỗi của cơ sở dữ liệu thành lỗi có mã của Kho. */
function loiTuCsdl<T = never>(loi: LoiCsdl): KetQua<T> {
  const thongDiep = (loi.message ?? '').trim()
  const ma = MA_TU_CSDL.find((m) => thongDiep === m || thongDiep.startsWith(`${m}:`))
  if (ma === 'CHUA_DANG_KY' || ma === 'DA_TRONG_DU_AN') {
    return thatBai(ma, undefined, { email: THONG_BAO_MAC_DINH[ma] })
  }
  if (ma) return thatBai(ma)
  // Vi phạm phân quyền từng dòng hay quyền cột.
  if (loi.code === '42501') return thatBai('KHONG_CO_QUYEN')
  // Phiên hết hạn hoặc JWT không hợp lệ.
  if (loi.code === 'PGRST301' || loi.code === 'PGRST302' || loi.code === 'PGRST303') return thatBai('CHUA_DANG_NHAP')
  return thatBai('LOI_HE_THONG')
}

/** Lỗi Auth do mạng hay máy chủ (không phải do dữ liệu người dùng nhập). */
function laLoiMayChu(loi: AuthError): boolean {
  return isAuthRetryableFetchError(loi) || loi.status === undefined || loi.status === 0 || loi.status >= 500
}

function loiAuthChung<T = never>(loi: AuthError): KetQua<T> {
  if (loi.status === 429) {
    return thatBai('LOI_HE_THONG', 'Bạn đã gửi quá nhiều yêu cầu. Hãy chờ ít phút rồi thử lại.')
  }
  return thatBai('LOI_HE_THONG')
}

export type KhoSupabase = KhoDuLieu &
  // Tổng quan đọc theo lô (ticket toi-uu-hieu-nang 02, khoSupabaseDocLo.ts): docTongQuan ở tongQuan.ts dùng lối này.
  DocTongQuanTheoLo & {
  /**
   * Mã truy cập (JWT) của phiên đăng nhập đang mở gần nhất, hoặc null nếu chưa có phiên nào. Dành
   * cho Cổng GitHub gọi Edge Function bằng chính phiên của người dùng (hàm kiểm đăng nhập và quyền
   * thấy repo). Không thuộc `KhoDuLieu`: ứng dụng chỉ có một phiên một lúc. Không gọi mạng nếu mã
   * còn hạn; client tự làm mới khi hết hạn.
   */
  maTruyCapHienTai(): Promise<string | null>
}

/**
 * Lệnh chỉ đọc: không bỏ các lượt đọc đang bay dùng chung (khoSupabaseNguoiGoi.ts, `bocQuenDangBayKhiGhi`). Mọi
 * lệnh khác, kể cả lệnh mới thêm vào Kho mà chưa ghi ở đây, được coi là lệnh ghi.
 */
const LENH_CHI_DOC: ReadonlySet<keyof KhoSupabase> = new Set<keyof KhoSupabase>([
  'layHoSoCuaToi',
  'danhSachDuAnCuaToi',
  'danhSachNguoiDung',
  'danhSachDuAn',
  'danhSachDuAnKemSoLieu',
  'docDuLieuTongQuan',
  'layDuAn',
  'danhSachNguoiTrongDuAn',
  'danhSachTask',
  'layTask',
  'lichSuTask',
  'danhSachRepoCuaDuAn',
  'viecCuaToi',
  'choToiDuyet',
  'danhSachTaskNguoiDangGiu',
  'danhSachLienKetCuaTask',
  'maTruyCapHienTai',
])

export function taoKhoSupabase(tuyChon: TuyChonKhoSupabase): KhoSupabase {
  const { url, khoaCongKhai, duongDanQuayLai } = tuyChon
  const tuDongLamMoiPhien = tuyChon.tuDongLamMoiPhien ?? true
  let demClient = 0
  let demPhien = 0

  /**
   * Mỗi phiên có client riêng (phiên của Supabase Auth gắn với client), không lưu phiên vào
   * bộ nhớ của trình duyệt. Client không phiên dùng cho các lệnh chưa đăng nhập.
   */
  function taoClient(coPhien: boolean): SupabaseClient {
    demClient += 1
    return createClient(url, khoaCongKhai, {
      auth: {
        persistSession: false,
        autoRefreshToken: coPhien && tuDongLamMoiPhien,
        detectSessionInUrl: false,
        storageKey: `quan-ly-du-an-${demClient}`,
      },
      ...(tuyChon.fetch ? { global: { fetch: tuyChon.fetch } } : {}),
    })
  }

  const clientChung = taoClient(false)

  async function docHoSo(db: SupabaseClient, id: string): Promise<KetQua<HoSo | null>> {
    const { data, error } = await db.from('ho_so').select(COT_HO_SO).eq('id', id).maybeSingle()
    if (error) return loiTuCsdl(error)
    const dong = data as unknown as DongHoSo | null
    return thanhCong(dong ? hoSoTuDong(dong) : null)
  }

  async function docDongDuAn(db: SupabaseClient, duAnId: string): Promise<KetQua<DongDuAn | null>> {
    if (!laUuid(duAnId)) return thanhCong(null)
    const { data, error } = await db.from('du_an').select(COT_DU_AN).eq('id', duAnId).maybeSingle()
    if (error) return loiTuCsdl(error)
    return thanhCong(data as unknown as DongDuAn | null)
  }

  /**
   * Một dòng Dự án kèm id mọi Người trong dự án nhúng, trong MỘT lượt (`quanLyDuAn`, ticket toi-uu-hieu-nang 05).
   * Gọi đúng tên khoá ngoại: du_an và nguoi_trong_du_an nối nhau bằng hai khoá (`du_an_nguoi_phu_trach_fkey`).
   */
  async function docDongDuAnKemIdNguoiTrong(
    db: SupabaseClient,
    duAnId: string,
  ): Promise<KetQua<{ duAn: DongDuAn; idNguoiTrong: string[] } | null>> {
    const { data, error } = await db.from('du_an').select(COT_DU_AN_KEM_ID_NGUOI_TRONG).eq('id', duAnId).maybeSingle()
    if (error) return loiTuCsdl(error)
    const dong = data as unknown as (DongDuAn & { nguoi_trong_du_an?: { nguoi_dung_id: string }[] | null }) | null
    if (!dong) return thanhCong(null)
    const { nguoi_trong_du_an: nguoiTrong, ...duAn } = dong
    return thanhCong({ duAn, idNguoiTrong: (nguoiTrong ?? []).map((n) => n.nguoi_dung_id) })
  }

  /** Mọi Người trong dự án người gọi đọc được, kèm hồ sơ và Vai trò trong Dự án. */
  async function docNguoiTrongDuAn(db: SupabaseClient, duAnId: string): Promise<KetQua<DongNguoiTrongDuAnKemId[]>> {
    const { data, error } = await db.from('nguoi_trong_du_an').select(COT_NGUOI_TRONG_DU_AN_KEM_ID).eq('du_an_id', duAnId)
    if (error) return loiTuCsdl(error)
    return thanhCong((data ?? []) as unknown as DongNguoiTrongDuAnKemId[])
  }

  /**
   * Một Task theo id kèm link (theo thứ tự thêm), dòng Dự án và mọi Người trong dự án của nó, trong MỘT lượt
   * (ticket toi-uu-hieu-nang 04). Phần nhúng theo cùng phân quyền từng dòng và cùng cột như `docDongDuAn`,
   * `docNguoiTrongDuAn`, lượt đọc link riêng. Gọi đúng tên khoá ngoại: du_an và nguoi_trong_du_an nối nhau bằng hai
   * khoá (`du_an_nguoi_phu_trach_fkey`).
   */
  async function docTaskKemDuAn(
    db: SupabaseClient,
    taskId: string,
  ): Promise<KetQua<DongTaskKemDuAn<DongTaskKemLienKet, DongDuAn, DongNguoiTrongDuAnKemId> | null>> {
    const { data, error } = await db
      .from('task')
      .select(COT_TASK_KEM_DU_AN)
      .eq('id', taskId)
      .order('thu_tu', { referencedTable: 'lien_ket_task' })
      .limit(SO_LIEN_KET_TOI_DA, { referencedTable: 'lien_ket_task' })
      .maybeSingle()
    if (error) return loiTuCsdl(error)
    const dong = data as unknown as DongTaskNhungDuAn | null
    if (!dong) return thanhCong(null)
    const { du_an: nhung, ...task } = dong
    const duAnNhung = Array.isArray(nhung) ? (nhung[0] ?? null) : nhung
    if (!duAnNhung) return thanhCong({ task, duAn: null, nguoiTrong: [] })
    const { nguoi_trong_du_an: nguoiTrong, ...duAn } = duAnNhung
    return thanhCong({ task, duAn, nguoiTrong: nguoiTrong ?? [] })
  }

  /** Dự án như giao diện Kho trả ra: dấu vết kèm tên hiển thị hiện tại của người tạo và người sửa. */
  async function docCacDuAn(db: SupabaseClient, dong: readonly DongDuAn[]): Promise<KetQua<DuAn[]>> {
    const ids = [...new Set(dong.flatMap(idNguoiCuaDuAn))]
    const tenTheoId = new Map<string, string>()
    if (ids.length > 0) {
      const { data, error } = await db.rpc('ten_nguoi_dau_vet', { p_ids: ids })
      if (error) return loiTuCsdl(error)
      for (const nguoi of (data ?? []) as unknown as { id: string; ten_hien_thi: string }[]) {
        tenTheoId.set(nguoi.id, nguoi.ten_hien_thi)
      }
    }
    return thanhCong(dong.map((d) => duAnTuDong(d, (id) => tenTheoId.get(id) ?? '')))
  }

  async function docMotDuAn(db: SupabaseClient, dong: DongDuAn): Promise<KetQua<DuAn>> {
    const kq = await docCacDuAn(db, [dong])
    if (!kq.ok) return kq
    return thanhCong(kq.giaTri[0])
  }

  /**
   * Xác định người gọi (ticket toi-uu-hieu-nang 01): phiên đang mở, hồ sơ nhớ theo phiên, và chuỗi kiểm ở đầu
   * lệnh trên một Dự án (`xemDuAn`, `quanLyDuAn`). Mọi lệnh dùng chung một chỗ này; xem khoSupabaseNguoiGoi.ts.
   */
  const xacDinh = taoXacDinhNguoiGoi<DongDuAn, DongNguoiTrongDuAnKemId, DongTaskKemLienKet>({
    docHoSo,
    docDongDuAn,
    docDongDuAnKemIdNguoiTrong,
    docNguoiTrongDuAn,
    docTaskKemDuAn,
    laUuid,
    loiTuCsdl,
  })
  const { xacThuc, xemDuAnKemNguoiTrong, quanLyDuAn } = xacDinh

  /**
   * Mọi Task của Dự án, dùng chung khi đang bay giữa các lệnh gọi cùng lúc của phiên (ticket toi-uu-hieu-nang 03):
   * màn Chi tiết Dự án gọi cùng lúc `danhSachTask` và `danhSachNguoiTrongDuAn` (bộ đếm Task đang giữ), cả hai chỉ
   * tốn một lượt đọc Task. Chỉ gọi sau khi người gọi đã được kiểm là xem được Dự án.
   */
  function docTaskCuaDuAn(phien: Phien, db: SupabaseClient, duAnId: string): Promise<KetQua<DongTask[]>> {
    return xacDinh.dungChungKhiDangBay(phien, `task-cua-du-an|${duAnId}`, () => docDongTaskCuaDuAn(db, duAnId, loiTuCsdl))
  }

  /**
   * Bộ đếm số Task đang giữ của Dự án `duAnId` (Task chưa Hoàn thành, chưa Huỷ mà người đó là Người thực
   * hiện), tính phía client bằng luật thuần `soTaskDangGiu` trên các Task người gọi đọc được.
   */
  async function demTaskDangGiu(db: SupabaseClient, duAnId: string): Promise<KetQua<(id: string) => number>> {
    const { data, error } = await db.from('task').select('nguoi_thuc_hien_id, trang_thai').eq('du_an_id', duAnId)
    if (error) return loiTuCsdl(error)
    return thanhCong(boDemTaskDangGiu((data ?? []) as unknown as Pick<DongTask, 'nguoi_thuc_hien_id' | 'trang_thai'>[]))
  }

  /** Đọc lại Dự án sau một lệnh ghi. */
  async function docLaiDuAn(db: SupabaseClient, duAnId: string): Promise<KetQua<DuAn>> {
    const dong = await docDongDuAn(db, duAnId)
    if (!dong.ok) return dong
    if (!dong.giaTri) return thatBai('KHONG_TIM_THAY')
    return docMotDuAn(db, dong.giaTri)
  }

  /**
   * Đổi trạng thái Dự án: chỉ qua hàm của cơ sở dữ liệu, không ghi thẳng cột trạng thái.
   *
   * Không đọc trước khi ghi (ticket toi-uu-hieu-nang 05): hàm luu_tru_du_an, mo_lai_du_an (migration
   * 20261125000100_lat_1_ho_so_du_an.sql) tự kiểm đúng luật và đúng thứ tự của `kiemGhiDuAn`, `kiemMoLaiDuAn` theo vai
   * hiện tại của người gọi: quyền quản lý (`KHONG_CO_QUYEN`), Dự án tồn tại (`KHONG_TIM_THAY`), rồi trạng thái
   * (`DU_AN_DA_LUU_TRU`, `DU_AN_DANG_HOAT_DONG`), và ném đúng các mã đó. Vai theo bản nhớ chỉ khác vai thật khi vừa
   * đổi vai; khi đó `theoVaiMoiNhat` đọc lại hồ sơ sau lần bị từ chối. Ba lượt: gọi hàm, đọc lại dòng Dự án, tên.
   */
  async function doiTrangThaiDuAn(
    phien: Phien | null,
    duAnId: string,
    ham: 'luu_tru_du_an' | 'mo_lai_du_an',
  ): Promise<KetQua<DuAn>> {
    const xt = await xacThuc(phien)
    if (!xt.ok) return xt
    const { db, hoSo } = xt.giaTri
    // Id không phải uuid: chắc chắn không có Dự án này (gửi đi sẽ thành lỗi kiểu), và người gọi không ở trong nó;
    // trả như luật thuần: không quản lý được thì KHONG_CO_QUYEN, rồi mới KHONG_TIM_THAY.
    if (!laUuid(duAnId)) {
      return thatBai(duocQuanLyDuAn({ vaiNguoiGoi: hoSo.vai, laNguoiTrongDuAn: false }) ? 'KHONG_TIM_THAY' : 'KHONG_CO_QUYEN')
    }
    const { error } = await db.rpc(ham, { p_du_an_id: duAnId })
    if (error) return loiTuCsdl(error)
    return docLaiDuAn(db, duAnId)
  }

  /** Các hàm dùng chung đưa vào lệnh Task và lệnh GitHub (không import vòng). */
  const phuThuocLenh = { ...xacDinh, docTaskCuaDuAn, laUuid, loiTuCsdl }
  /** Lệnh Task (ticket 10): xem khoSupabaseTask.ts. Dùng chung xác thực và luật xem, ghi Dự án ở đây. */
  const lenhTask = taoLenhTaskSupabase(phuThuocLenh)
  /** Lệnh vòng duyệt (ticket 14): xem khoSupabaseVongDuyet.ts. Đổi trạng thái chỉ qua hàm của cơ sở dữ liệu. */
  const lenhVongDuyet = taoLenhVongDuyetSupabase({
    xacThuc,
    xemTaskDeGhi: xacDinh.xemTaskDeGhi,
    layTask: lenhTask.layTask,
    laUuid,
    loiTuCsdl,
  })

  /** Lệnh repo GitHub và link của Task (ticket 17): xem khoSupabaseGitHub.ts. */
  const lenhGitHub = taoLenhGitHubSupabase(phuThuocLenh)

  /** Tổng quan và Dự án kèm số liệu đọc theo lô (ticket toi-uu-hieu-nang 02): xem khoSupabaseDocLo.ts. */
  const docLo = taoDocLoSupabase<DongDuAn>({ xacThuc, cotDuAn: COT_DU_AN, idNguoiCuaDuAn, duAnTuDong, loiTuCsdl })

  const khoGoc: KhoSupabase = {
    async dangKy(dauVao: DangKyDauVao) {
      const kt = kiemTra(dangKySchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const { email, matKhau, tenHienThi } = kt.giaTri
      // Client riêng: nếu project tắt xác nhận email, phiên trả về không dính vào client chung.
      const tam = taoClient(false)
      const { data, error } = await tam.auth.signUp({
        email,
        password: matKhau,
        options: {
          // Trigger tao_ho_so_khi_dang_ky đọc tên này; vai luôn là Thành viên, không lấy từ đây.
          data: { ten_hien_thi: tenHienThi },
          ...(duongDanQuayLai ? { emailRedirectTo: duongDanQuayLai } : {}),
        },
      })
      if (data.session) await tam.auth.signOut({ scope: 'local' })
      if (error) {
        if (error.code === 'user_already_exists' || error.code === 'email_exists') {
          return thatBai('EMAIL_DA_DUNG', undefined, { email: THONG_BAO_MAC_DINH.EMAIL_DA_DUNG })
        }
        if (error.code === 'email_address_invalid') {
          return thatBai('KHONG_HOP_LE', undefined, { email: THONG_BAO.emailSai })
        }
        if (error.code === 'weak_password') {
          return thatBai('KHONG_HOP_LE', undefined, {
            matKhau: 'Mật khẩu chưa đủ mạnh theo yêu cầu của máy chủ. Hãy chọn mật khẩu khác.',
          })
        }
        return loiAuthChung(error)
      }
      // Email đã có tài khoản (đã xác nhận): Supabase trả một người dùng giả không có danh tính.
      if (!data.user || (data.user.identities?.length ?? 0) === 0) {
        return thatBai('EMAIL_DA_DUNG', undefined, { email: THONG_BAO_MAC_DINH.EMAIL_DA_DUNG })
      }
      return thanhCong({
        id: data.user.id,
        email,
        tenHienThi,
        githubUsername: null,
        vai: VAI_MAC_DINH,
        ...THONG_TIN_NHAN_SU_TRONG,
      })
    },

    async dangNhap(dauVao: DangNhapDauVao) {
      const kt = kiemTra(dangNhapSchema, dauVao)
      if (!kt.ok || kt.giaTri.email === '' || kt.giaTri.matKhau === '') return thatBai('SAI_THONG_TIN_DANG_NHAP')
      const db = taoClient(true)
      const { data, error } = await db.auth.signInWithPassword({
        email: kt.giaTri.email,
        password: kt.giaTri.matKhau,
      })
      if (error) {
        // Supabase chỉ báo chưa xác nhận khi đã đúng mật khẩu, nên không lộ gì thêm.
        if (error.code === 'email_not_confirmed') return thatBai('EMAIL_CHUA_XAC_NHAN')
        if (laLoiMayChu(error) || error.status === 429) return loiAuthChung(error)
        return thatBai('SAI_THONG_TIN_DANG_NHAP')
      }
      if (!data.user || !data.session) return thatBai('SAI_THONG_TIN_DANG_NHAP')
      demPhien += 1
      const phien: Phien = { maPhien: `phien-supabase-${demPhien}`, nguoiDungId: data.user.id }
      // Hồ sơ đọc một lần ở đây và nhớ theo phiên; đọc không được thì lệnh sau tự đọc (đăng nhập vẫn thành công).
      await xacDinh.moPhien(phien, db)
      return thanhCong(phien)
    },

    async guiLaiThuXacNhan(dauVao: EmailDauVao) {
      const kt = kiemTra(emailSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const { error } = await clientChung.auth.resend({
        type: 'signup',
        email: kt.giaTri.email,
        ...(duongDanQuayLai ? { options: { emailRedirectTo: duongDanQuayLai } } : {}),
      })
      // Mọi lỗi do dữ liệu (email không có, đã xác nhận, gửi quá dày) đều trả cùng một thông báo
      // để không lộ email có tài khoản hay không; chỉ lỗi mạng/máy chủ mới báo khác.
      if (error && laLoiMayChu(error)) return loiAuthChung(error)
      return thanhCong({ thongBao: THONG_BAO.daGuiLaiThuXacNhan })
    },

    async yeuCauDatLaiMatKhau(dauVao: EmailDauVao) {
      // `bayGio` bị bỏ qua: hạn của mã do Supabase Auth tính theo giờ máy chủ.
      const kt = kiemTra(emailSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const { error } = await clientChung.auth.resetPasswordForEmail(
        kt.giaTri.email,
        duongDanQuayLai ? { redirectTo: duongDanQuayLai } : undefined,
      )
      if (error && laLoiMayChu(error)) return loiAuthChung(error)
      return thanhCong({ thongBao: THONG_BAO.daGuiMaDatLai })
    },

    async datLaiMatKhau(dauVao: DatLaiMatKhauDauVao) {
      // Kiểm dữ liệu trước khi gửi mã đi, để dữ liệu sai không tiêu mã.
      const kt = kiemTra(datLaiMatKhauSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const tam = taoClient(false)
      const xacMinh = await tam.auth.verifyOtp({ email: kt.giaTri.email, token: kt.giaTri.ma, type: 'recovery' })
      if (xacMinh.error) {
        if (laLoiMayChu(xacMinh.error)) return loiAuthChung(xacMinh.error)
        return thatBai('MA_KHONG_HOP_LE', THONG_BAO_MA_DAT_LAI_SUPABASE)
      }
      if (!xacMinh.data.session) return thatBai('MA_KHONG_HOP_LE', THONG_BAO_MA_DAT_LAI_SUPABASE)
      const doi = await tam.auth.updateUser({ password: kt.giaTri.matKhauMoi })
      await tam.auth.signOut({ scope: 'local' })
      if (doi.error) {
        if (doi.error.code === 'weak_password') {
          return thatBai('KHONG_HOP_LE', undefined, {
            matKhauMoi: 'Mật khẩu chưa đủ mạnh theo yêu cầu của máy chủ. Hãy yêu cầu mã mới và chọn mật khẩu khác.',
          })
        }
        if (doi.error.code === 'same_password') {
          return thatBai('KHONG_HOP_LE', undefined, { matKhauMoi: 'Mật khẩu mới phải khác mật khẩu cũ.' })
        }
        return loiAuthChung(doi.error)
      }
      return thanhCong({ thongBao: THONG_BAO.daDatLaiMatKhau })
    },

    async dangXuat(phien: Phien | null) {
      // Bỏ phiên cùng hồ sơ đã nhớ: phiên cũ không dùng lại được bản nhớ.
      const db = xacDinh.dongPhien(phien)
      if (!db) return thatBai('CHUA_DANG_NHAP')
      await db.auth.stopAutoRefresh()
      // Chỉ kết thúc phiên này; lỗi mạng lúc đăng xuất không giữ phiên lại phía ứng dụng.
      await db.auth.signOut({ scope: 'local' })
      return thanhCong(null)
    },

    async layHoSoCuaToi(phien: Phien | null) {
      // Luôn đọc mới từ cơ sở dữ liệu và làm mới bản nhớ.
      const xt = await xacDinh.docLaiHoSo(phien)
      if (!xt.ok) return xt
      return thanhCong(xt.giaTri.hoSo)
    },

    async suaHoSo(phien: Phien | null, nguoiDungId: string, dauVao: SuaHoSoDauVao) {
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      if (!duocSuaHoSo(xt.giaTri.hoSo.id, nguoiDungId)) return thatBai('KHONG_CO_QUYEN')
      const kt = kiemTra(suaHoSoSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const thayDoi: {
        ten_hien_thi?: string
        github_username?: string | null
        so_dien_thoai?: string | null
        chuc_danh?: string | null
        phong_ban?: string | null
      } = {}
      if (kt.giaTri.tenHienThi !== undefined) thayDoi.ten_hien_thi = kt.giaTri.tenHienThi
      if (kt.giaTri.githubUsername !== undefined) thayDoi.github_username = kt.giaTri.githubUsername
      if (kt.giaTri.soDienThoai !== undefined) thayDoi.so_dien_thoai = kt.giaTri.soDienThoai
      if (kt.giaTri.chucDanh !== undefined) thayDoi.chuc_danh = kt.giaTri.chucDanh
      if (kt.giaTri.phongBan !== undefined) thayDoi.phong_ban = kt.giaTri.phongBan
      // Không gửi ô nào: trả hồ sơ mới nhất (đọc lại, làm mới bản nhớ) như khi hồ sơ còn đọc ở đầu mọi lệnh.
      if (Object.keys(thayDoi).length === 0) {
        const moi = await xacDinh.docLaiHoSo(phien)
        if (!moi.ok) return moi
        return thanhCong(moi.giaTri.hoSo)
      }
      // Trigger ho_so_truoc_khi_sua chỉ cho chủ hồ sơ đổi các cột này và chuẩn hoá Thông tin nhân sự; ràng buộc
      // của bảng kiểm lại dạng Số điện thoại và độ dài (lỗi đổi về đúng ô như luật thuần).
      const { data, error } = await xt.giaTri.db
        .from('ho_so')
        .update(thayDoi)
        .eq('id', xt.giaTri.hoSo.id)
        .select(COT_HO_SO)
        .maybeSingle()
      if (error) return loiGhiHoSo(error)
      const dong = data as unknown as DongHoSo | null
      if (!dong) {
        xacDinh.quenHoSo(phien)
        return thatBai('CHUA_DANG_NHAP')
      }
      const hoSo = hoSoTuDong(dong)
      // Lệnh kế tiếp thấy ngay tên mới.
      xacDinh.ghiNhoHoSo(phien, hoSo)
      return thanhCong(hoSo)
    },

    async danhSachDuAnCuaToi(phien: Phien | null) {
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      const { data, error } = await xt.giaTri.db
        .from('nguoi_trong_du_an')
        .select('du_an(id, ma, ten, trang_thai)')
        .eq('nguoi_dung_id', xt.giaTri.hoSo.id)
      if (error) return loiTuCsdl(error)
      const dong = (data ?? []) as unknown as {
        du_an: { id: string; ma?: string | null; ten: string; trang_thai: string } | null
      }[]
      const duAn: DuAnTomTat[] = []
      for (const { du_an } of dong) {
        if (du_an) {
          duAn.push({ id: du_an.id, ma: du_an.ma ?? '', ten: du_an.ten, trangThai: trangThaiTuDong(du_an.trang_thai) })
        }
      }
      return thanhCong(duAn)
    },

    async danhSachNguoiDung(phien: Phien | null) {
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      if (!duocQuanLyNguoiDung(xt.giaTri.hoSo.vai)) return thatBai('KHONG_CO_QUYEN')
      const { data, error } = await xt.giaTri.db.from('ho_so').select(COT_HO_SO)
      if (error) return loiTuCsdl(error)
      const dong = (data ?? []) as unknown as DongHoSo[]
      // Hồ sơ của chính người gọi luôn có trong kết quả (ho_so_doc: id = auth.uid()) và là bản mới nhất: dùng nó
      // để kiểm lại vai mà không tốn thêm lượt gọi. PM vừa bị hạ vai (cơ sở dữ liệu vẫn trả các hồ sơ người đó
      // thấy được, không từ chối) nhận KHONG_CO_QUYEN như luật thuần; hồ sơ không còn thì như phiên đã hết.
      const cuaToi = dong.find((d) => d.id === xt.giaTri.hoSo.id)
      if (!cuaToi) {
        xacDinh.quenHoSo(phien)
        return thatBai('CHUA_DANG_NHAP')
      }
      const hoSoMoi = hoSoTuDong(cuaToi)
      xacDinh.ghiNhoHoSo(phien, hoSoMoi)
      if (!duocQuanLyNguoiDung(hoSoMoi.vai)) return thatBai('KHONG_CO_QUYEN')
      return thanhCong(dong.map(tomTatTuDong))
    },

    async doiVai(phien: Phien | null, nguoiDungId: string, dauVao: DoiVaiDauVao) {
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      const { db, hoSo } = xt.giaTri
      // Kiểm quyền trước mọi thứ khác: người không phải PM không biết được gì thêm.
      if (!duocQuanLyNguoiDung(hoSo.vai)) return thatBai('KHONG_CO_QUYEN')
      const kt = kiemTra(doiVaiSchema, dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', THONG_BAO.vaiSai, kt.loiTheoO)
      if (!laUuid(nguoiDungId)) return thatBai('KHONG_TIM_THAY')
      const dich = await db.from('ho_so').select(COT_HO_SO).eq('id', nguoiDungId).maybeSingle()
      if (dich.error) return loiTuCsdl(dich.error)
      const dongDich = dich.data as unknown as DongHoSo | null
      if (!dongDich) return thatBai('KHONG_TIM_THAY')
      const demPM = await db.from('ho_so').select('id', { count: 'exact', head: true }).eq('vai', 'PM')
      if (demPM.error) return loiTuCsdl(demPM.error)
      const lyDo = kiemDoiVai({
        vaiNguoiGoi: hoSo.vai,
        vaiHienTai: vaiTuDong(dongDich.vai),
        vaiMoi: kt.giaTri.vai,
        soPM: demPM.count ?? 0,
      })
      if (lyDo) return thatBai(lyDo)
      // Trigger ho_so_truoc_khi_sua kiểm lại cả hai luật (chỉ PM, luôn còn một PM) trong giao dịch.
      const { data, error } = await db
        .from('ho_so')
        .update({ vai: kt.giaTri.vai })
        .eq('id', nguoiDungId)
        .select(COT_HO_SO)
        .maybeSingle()
      if (error) return loiTuCsdl(error)
      const dong = data as unknown as DongHoSo | null
      if (!dong) return thatBai('KHONG_TIM_THAY')
      // PM tự đổi vai mình: lệnh sau theo vai mới ngay.
      xacDinh.ghiNhoHoSo(phien, hoSoTuDong(dong))
      return thanhCong(tomTatTuDong(dong))
    },

    async taoDuAn(phien: Phien | null, dauVao: TaoDuAnDauVao) {
      // `bayGio` bị bỏ qua: người tạo và ngày tạo do cơ sở dữ liệu đặt (trigger du_an_truoc_khi_tao).
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      if (!duocTaoDuAn(xt.giaTri.hoSo.vai)) return thatBai('KHONG_CO_QUYEN')
      const kt = kiemTraDuAn.tao(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      const { data, error } = await xt.giaTri.db
        .from('du_an')
        .insert({
          ma: kt.giaTri.ma,
          ten: kt.giaTri.ten,
          mo_ta: kt.giaTri.moTa,
          khach_hang: kt.giaTri.khachHang,
          ngay_bat_dau: kt.giaTri.ngayBatDau,
          ngay_ket_thuc_du_kien: kt.giaTri.ngayKetThucDuKien,
          muc_uu_tien: kt.giaTri.mucUuTien,
        })
        .select(COT_DU_AN)
        .single()
      if (error) return loiGhiDuAn(error)
      return docMotDuAn(xt.giaTri.db, data as unknown as DongDuAn)
    },

    async danhSachDuAn(phien: Phien | null, loc: LocDuAnDauVao = {}) {
      const xt = await xacThuc(phien)
      if (!xt.ok) return xt
      const kt = kiemTraDuAn.loc(loc)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      // Phân quyền từng dòng chỉ trả Dự án người gọi được thấy (duocXemDuAn).
      let truyVan = xt.giaTri.db.from('du_an').select(COT_DU_AN)
      if (kt.giaTri.trangThai !== undefined) truyVan = truyVan.eq('trang_thai', kt.giaTri.trangThai)
      const { data, error } = await truyVan
      if (error) return loiTuCsdl(error)
      return docCacDuAn(xt.giaTri.db, (data ?? []) as unknown as DongDuAn[])
    },

    // Dự án kèm số liệu (truong-moi 07) và dữ liệu Tổng quan: đọc theo lô, số lượt gọi cố định (ticket
    // toi-uu-hieu-nang 02), tính phía client bằng luật thuần; xem khoSupabaseDocLo.ts.
    danhSachDuAnKemSoLieu: docLo.danhSachDuAnKemSoLieu,
    docDuLieuTongQuan: docLo.docDuLieuTongQuan,

    async layDuAn(phien: Phien | null, duAnId: string) {
      // Gọi cùng lúc với `danhSachNguoiTrongDuAn`, `danhSachTask` (màn Chi tiết Dự án): dùng chung lượt kiểm xem
      // Dự án đang bay (ticket toi-uu-hieu-nang 03).
      const xt = await xemDuAnKemNguoiTrong(phien, duAnId)
      if (!xt.ok) return xt
      return docMotDuAn(xt.giaTri.nguoiGoi.db, xt.giaTri.duAn)
    },

    async suaDuAn(phien: Phien | null, duAnId: string, dauVao: SuaDuAnDauVao) {
      // `bayGio` bị bỏ qua: người và ngày chỉnh sửa do cơ sở dữ liệu đặt (trigger du_an_truoc_khi_sua).
      const xt = await quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { nguoiGoi, duAn, nhin } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nhin, trangThai: trangThaiTuDong(duAn.trang_thai) })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraDuAn.sua(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      // Ngày gửi lên kiểm cùng ngày đang lưu (luật ngày của Dự án); cơ sở dữ liệu kiểm lại bằng ràng buộc
      // du_an_ngay_hop_le (khi ngày đang lưu vừa bị người khác đổi), lỗi báo ở cùng ô như luật thuần.
      const ngay = ngayDuAnSauSua(
        { ngayBatDau: duAn.ngay_bat_dau ?? null, ngayKetThucDuKien: duAn.ngay_ket_thuc_du_kien ?? null },
        kt.giaTri,
      )
      if (!ngay.ok) return thatBai('KHONG_HOP_LE', undefined, ngay.loiTheoO)
      const oNgay =
        kt.giaTri.ngayBatDau !== undefined && kt.giaTri.ngayKetThucDuKien === undefined ? 'ngayBatDau' : 'ngayKetThucDuKien'
      // Id không phải uuid thì chắc chắn không phải Người trong dự án (gửi đi sẽ thành lỗi kiểu của cơ sở dữ liệu).
      if (kt.giaTri.nguoiPhuTrachId !== undefined && kt.giaTri.nguoiPhuTrachId !== null && !laUuid(kt.giaTri.nguoiPhuTrachId)) {
        return loiNguoiPhuTrachNgoaiDuAn()
      }
      // Không gửi ô nào thì vẫn ghi lại tên cũ, để dấu vết chỉnh sửa được cập nhật như bản bộ nhớ.
      const thayDoi: {
        ten: string
        mo_ta?: string
        ma?: string
        khach_hang?: string
        ngay_bat_dau?: string | null
        ngay_ket_thuc_du_kien?: string | null
        muc_uu_tien?: MucUuTien
        nguoi_phu_trach_id?: string | null
      } = { ten: kt.giaTri.ten ?? duAn.ten }
      if (kt.giaTri.moTa !== undefined) thayDoi.mo_ta = kt.giaTri.moTa
      if (kt.giaTri.ma !== undefined) thayDoi.ma = kt.giaTri.ma
      if (kt.giaTri.khachHang !== undefined) thayDoi.khach_hang = kt.giaTri.khachHang
      if (kt.giaTri.ngayBatDau !== undefined) thayDoi.ngay_bat_dau = kt.giaTri.ngayBatDau
      if (kt.giaTri.ngayKetThucDuKien !== undefined) thayDoi.ngay_ket_thuc_du_kien = kt.giaTri.ngayKetThucDuKien
      if (kt.giaTri.mucUuTien !== undefined) thayDoi.muc_uu_tien = kt.giaTri.mucUuTien
      // Người phụ trách phải là Người trong dự án: trigger du_an_truoc_khi_sua ném NGUOI_NGOAI_DU_AN (trước khi
      // kiểm Mã trùng, như thứ tự của bản bộ nhớ), khoá ngoại du_an_nguoi_phu_trach_fkey là hàng rào cuối và
      // đặt về trống khi người đó bị gỡ (migration 20261126000500_truong_du_an.sql); ở đây chỉ gửi cột.
      if (kt.giaTri.nguoiPhuTrachId !== undefined) thayDoi.nguoi_phu_trach_id = kt.giaTri.nguoiPhuTrachId
      const { data, error } = await nguoiGoi.db
        .from('du_an')
        .update(thayDoi)
        .eq('id', duAnId)
        .select(COT_DU_AN)
        .maybeSingle()
      if (error) return loiGhiDuAn(error, oNgay)
      const dong = data as unknown as DongDuAn | null
      if (!dong) return thatBai('KHONG_TIM_THAY')
      return docMotDuAn(nguoiGoi.db, dong)
    },

    async luuTruDuAn(phien: Phien | null, duAnId: string) {
      return doiTrangThaiDuAn(phien, duAnId, 'luu_tru_du_an')
    },

    async moLaiDuAn(phien: Phien | null, duAnId: string) {
      return doiTrangThaiDuAn(phien, duAnId, 'mo_lai_du_an')
    },

    async danhSachNguoiTrongDuAn(phien: Phien | null, duAnId: string) {
      // Danh sách Người trong dự án đã đọc cùng lượt kiểm xem Dự án; bộ đếm Task đang giữ tính trên lượt đọc Task
      // dùng chung với `danhSachTask` khi hai lệnh gọi cùng lúc (ticket toi-uu-hieu-nang 03).
      const xt = await xemDuAnKemNguoiTrong(phien, duAnId)
      if (!xt.ok) return xt
      if (!phien) return thatBai('CHUA_DANG_NHAP')
      const task = await docTaskCuaDuAn(phien, xt.giaTri.nguoiGoi.db, duAnId)
      if (!task.ok) return task
      const dem = boDemTaskDangGiu(task.giaTri)
      return thanhCong(
        xt.giaTri.nguoiTrong.flatMap(({ ho_so, vai_tro }) => (ho_so ? [nguoiTrongDuAnTuDong(ho_so, vai_tro, dem)] : [])),
      )
    },

    async themNguoiVaoDuAn(phien: Phien | null, duAnId: string, dauVao: ThemNguoiDauVao) {
      const xt = await quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { nguoiGoi, duAn, nhin } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nhin, trangThai: trangThaiTuDong(duAn.trang_thai) })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraDuAn.themNguoi(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      // Chỉ thêm tài khoản đã có; không tạo tài khoản, không gửi thư mời. Hàm của cơ sở dữ liệu tìm
      // theo email mà không cho người gọi đọc danh sách tài khoản, và thêm người kèm Vai trò trong Dự án trong
      // MỘT lệnh (không có lúc nào người đã vào Dự án mà vai trò chưa ghi). Hàm trả hồ sơ của người được thêm
      // (Thông tin nhân sự đã áp quyền xem) và vai trò đã lưu.
      const { data, error } = await nguoiGoi.db.rpc('them_nguoi_vao_du_an', {
        p_du_an_id: duAnId,
        p_email: kt.giaTri.email,
        p_vai_tro: kt.giaTri.vaiTroTrongDuAn,
      })
      if (error) return loiGhiVaiTro(error)
      const dong = data as unknown as DongHoSo & { vai_tro?: string | null }
      const dem = await demTaskDangGiu(nguoiGoi.db, duAnId)
      if (!dem.ok) return dem
      return thanhCong(nguoiTrongDuAnTuDong(dong, dong.vai_tro, dem.giaTri))
    },

    async suaVaiTroTrongDuAn(
      phien: Phien | null,
      duAnId: string,
      nguoiDungId: string,
      dauVao: SuaVaiTroTrongDuAnDauVao,
    ) {
      const xt = await quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { nguoiGoi, duAn, nhin } = xt.giaTri
      const lyDo = kiemSuaVaiTroTrongDuAn({ ...nhin, trangThai: trangThaiTuDong(duAn.trang_thai) })
      if (lyDo) return thatBai(lyDo)
      const kt = kiemTraDuAn.suaVaiTro(dauVao)
      if (!kt.ok) return thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)
      if (!laUuid(nguoiDungId)) return thatBai('KHONG_TIM_THAY', THONG_BAO_DU_AN.khongTrongDuAn)
      // Cơ sở dữ liệu là hàng rào thật (migration 20261126000600_truong_task_ho_so_nguoi.sql): quyền cột chỉ mở
      // vai_tro; policy nguoi_trong_du_an_sua chỉ cho PM, Support của Dự án; trigger chặn Dự án đã Lưu trữ.
      // Người không ở trong Dự án: không dòng nào được sửa (KHONG_TIM_THAY như bản bộ nhớ).
      const { data, error } = await nguoiGoi.db
        .from('nguoi_trong_du_an')
        .update({ vai_tro: kt.giaTri.vaiTroTrongDuAn })
        .eq('du_an_id', duAnId)
        .eq('nguoi_dung_id', nguoiDungId)
        .select(COT_NGUOI_TRONG_DU_AN)
      if (error) return loiGhiVaiTro(error)
      const dong = ((data ?? []) as unknown as DongNguoiTrongDuAn[])[0]
      if (!dong?.ho_so) return thatBai('KHONG_TIM_THAY', THONG_BAO_DU_AN.khongTrongDuAn)
      const dem = await demTaskDangGiu(nguoiGoi.db, duAnId)
      if (!dem.ok) return dem
      return thanhCong(nguoiTrongDuAnTuDong(dong.ho_so, dong.vai_tro, dem.giaTri))
    },

    async goNguoiKhoiDuAn(phien: Phien | null, duAnId: string, nguoiDungId: string) {
      const xt = await quanLyDuAn(phien, duAnId)
      if (!xt.ok) return xt
      const { nguoiGoi, duAn, nhin } = xt.giaTri
      const lyDo = kiemGhiDuAn({ ...nhin, trangThai: trangThaiTuDong(duAn.trang_thai) })
      if (lyDo) return thatBai(lyDo)
      if (!laUuid(nguoiDungId)) return thatBai('KHONG_TIM_THAY')
      // Chỉ bỏ cặp (Dự án, tài khoản); tài khoản và hồ sơ giữ nguyên.
      const { data, error } = await nguoiGoi.db
        .from('nguoi_trong_du_an')
        .delete()
        .eq('du_an_id', duAnId)
        .eq('nguoi_dung_id', nguoiDungId)
        .select('nguoi_dung_id')
      if (error) return loiTuCsdl(error)
      if (!data || data.length === 0) return thatBai('KHONG_TIM_THAY')
      return thanhCong(null)
    },

    // Lệnh Task (ticket 07, 08, 09): bản Supabase ở khoSupabaseTask.ts.
    ...lenhTask,

    // Đổi trạng thái và lịch sử Task (ticket 11, 14): bản Supabase ở khoSupabaseVongDuyet.ts.
    ...lenhVongDuyet,

    // Lệnh repo GitHub và link issue hoặc PR của Task (ticket 15, 16, 17): khoSupabaseGitHub.ts.
    ...lenhGitHub,

    async maTruyCapHienTai() {
      const db = xacDinh.clientPhienCuoi()
      if (!db) return null
      const { data, error } = await db.auth.getSession()
      if (error || !data.session) return null
      return data.session.access_token
    },
  }

  // Mọi lệnh nhận phiên chạy theo vai mới nhất (khoSupabaseNguoiGoi.ts, `theoVaiMoiNhat`): bị từ chối khi đang
  // dùng hồ sơ đã nhớ thì đọc lại hồ sơ một lần, vai đã đổi thì chạy lại. Không bọc: lệnh không có phiên, lệnh
  // luôn đọc hồ sơ mới hay không dùng vai (hồ sơ của tôi).
  const theoVai = xacDinh.bocTheoVaiMoiNhat(
    khoGoc,
    new Set<keyof KhoSupabase>([
      'dangKy',
      'dangNhap',
      'guiLaiThuXacNhan',
      'yeuCauDatLaiMatKhau',
      'datLaiMatKhau',
      'dangXuat',
      'layHoSoCuaToi',
      'suaHoSo',
      'maTruyCapHienTai',
    ]),
  )
  // Lệnh ngoài LENH_CHI_DOC bỏ mọi lượt đọc đang bay dùng chung lúc bắt đầu và lúc xong: kết quả dùng chung không
  // sống qua lệnh ghi (ticket toi-uu-hieu-nang 03).
  return xacDinh.bocQuenDangBayKhiGhi(theoVai, LENH_CHI_DOC)
}
