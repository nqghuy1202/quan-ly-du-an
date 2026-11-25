// Bảng ca dùng chung cho ma trận chuyển trạng thái của Task (ticket 11): nguồn sự thật về "bước nào,
// ai làm, kết quả gì", ở dạng dữ liệu thuần. Mỗi dòng: loại người gọi, trạng thái Task trước bước,
// trạng thái muốn sang, trạng thái Dự án, cách điền lý do và kết quả mong đợi. Mọi bản cài Kho dữ
// liệu (bộ nhớ trong cổng, Supabase chạy tay) chạy hết các dòng qua `chayHopDongChuyenTrangThai`
// (hopDongChuyenTrangThai.ts); luật thuần và hàm của cơ sở dữ liệu phải khớp bảng này.
//
// Bảng này CỐ Ý tự viết lại ma trận của spec bằng dữ liệu riêng, không import từ
// `luat/chuyenTrangThai.ts`: nếu import thì test chỉ so luật với chính nó. File này là bảng mở rộng
// của `bangCaQuyen.ts` cho riêng vòng duyệt (bảng quyền cũ có trục khác: vai hệ thống và Dự án).
// Không import vitest để bản cài nào cũng đọc được dữ liệu.
import type { MaLoi } from './ketQua'
import type { TrangThaiDuAn } from '../luat/duAn'
import { CAC_TRANG_THAI_TASK, type TrangThaiTask } from '../luat/task'

/**
 * Loại người gọi. Cách dựng (xem `chayHopDongChuyenTrangThai`): một PM chủ tạo Dự án, thêm vào đó
 * An (Người thực hiện, Thành viên), Bình (Người kiểm tra, Thành viên), Chi (Support của Dự án) và
 * Em (Thành viên chỉ ở trong Dự án); Dũng (Support) và Phương (Thành viên) có tài khoản nhưng ngoài
 * Dự án; một PM thứ hai không ở trong Dự án.
 */
export const CAC_LOAI_NGUOI_GOI = [
  'NGUOI_THUC_HIEN',
  'NGUOI_KIEM_TRA',
  'SUPPORT_CUA_DU_AN',
  'SUPPORT_NGOAI_DU_AN',
  'PM',
  'THANH_VIEN_KHAC',
  'THANH_VIEN_NGOAI',
] as const

export type LoaiNguoiGoi = (typeof CAC_LOAI_NGUOI_GOI)[number]

export const MO_TA_LOAI_NGUOI_GOI: Record<LoaiNguoiGoi, string> = {
  NGUOI_THUC_HIEN: 'Người thực hiện của Task',
  NGUOI_KIEM_TRA: 'Người kiểm tra của Task',
  SUPPORT_CUA_DU_AN: 'Support của Dự án',
  SUPPORT_NGOAI_DU_AN: 'Support ngoài Dự án',
  PM: 'PM (không ở trong Dự án)',
  THANH_VIEN_KHAC: 'Thành viên khác trong Dự án',
  THANH_VIEN_NGOAI: 'Thành viên ngoài Dự án',
}

/** Loại người gọi giữ ít nhất một vai trên Task. */
const CO_VAI: readonly LoaiNguoiGoi[] = ['NGUOI_THUC_HIEN', 'NGUOI_KIEM_TRA', 'SUPPORT_CUA_DU_AN', 'PM']

/**
 * Cách điền lý do: `KHONG` (không gửi), `CO` (một lý do có khoảng trắng hai đầu; Kho lưu bản đã cắt),
 * `TRONG` (chỉ khoảng trắng).
 */
export type CachDienLyDo = 'KHONG' | 'CO' | 'TRONG'

export type KetQuaChuyenMongDoi = 'DUOC' | MaLoi

export interface CaChuyenTrangThai {
  nguoiGoi: LoaiNguoiGoi
  tu: TrangThaiTask
  sang: TrangThaiTask
  trangThaiDuAn: TrangThaiDuAn
  lyDo: CachDienLyDo
  ketQua: KetQuaChuyenMongDoi
}

type BuocHopLe = readonly [TrangThaiTask, TrangThaiTask, boolean, readonly LoaiNguoiGoi[]]

const THUC_HIEN: readonly LoaiNguoiGoi[] = ['NGUOI_THUC_HIEN', 'SUPPORT_CUA_DU_AN', 'PM']
const KIEM_TRA: readonly LoaiNguoiGoi[] = ['NGUOI_KIEM_TRA', 'SUPPORT_CUA_DU_AN', 'PM']
const QUAN_LY: readonly LoaiNguoiGoi[] = ['SUPPORT_CUA_DU_AN', 'PM']

/** Các bước trong ma trận của spec: (từ, sang, cần lý do, loại người gọi được làm). */
// prettier-ignore
const BUOC_HOP_LE: readonly BuocHopLe[] = [
  ['MOI',       'DANG_LAM',   false, THUC_HIEN],
  ['DANG_LAM',  'CHO_DUYET',  false, THUC_HIEN],
  ['CHO_DUYET', 'HOAN_THANH', false, KIEM_TRA],
  ['CHO_DUYET', 'TRA_LAI',    true,  KIEM_TRA],
  ['CHO_DUYET', 'BI_LOI',     true,  KIEM_TRA],
  ['TRA_LAI',   'DANG_LAM',   false, THUC_HIEN],
  ['BI_LOI',    'DANG_LAM',   false, QUAN_LY],
  ['MOI',       'HUY',        true,  QUAN_LY],
  ['DANG_LAM',  'HUY',        true,  QUAN_LY],
  ['CHO_DUYET', 'HUY',        true,  QUAN_LY],
  ['TRA_LAI',   'HUY',        true,  QUAN_LY],
  ['BI_LOI',    'HUY',        true,  QUAN_LY],
]

const TRANG_THAI_CUOI: readonly TrangThaiTask[] = ['HOAN_THANH', 'HUY']

function laBuocHopLe(tu: TrangThaiTask, sang: TrangThaiTask): boolean {
  return BUOC_HOP_LE.some(([t, s]) => t === tu && s === sang)
}

/** Người gọi không giữ vai nào thì luôn nhận KHONG_CO_QUYEN, dù bước nào; ngược lại là `ketQua`. */
function theoVai(nguoiGoi: LoaiNguoiGoi, ketQua: KetQuaChuyenMongDoi): KetQuaChuyenMongDoi {
  return CO_VAI.includes(nguoiGoi) ? ketQua : 'KHONG_CO_QUYEN'
}

function dungBang(): CaChuyenTrangThai[] {
  const bang: CaChuyenTrangThai[] = []
  const them = (
    nguoiGoi: LoaiNguoiGoi,
    tu: TrangThaiTask,
    sang: TrangThaiTask,
    trangThaiDuAn: TrangThaiDuAn,
    lyDo: CachDienLyDo,
    ketQua: KetQuaChuyenMongDoi,
  ) => bang.push({ nguoiGoi, tu, sang, trangThaiDuAn, lyDo, ketQua })

  // 1. Từng bước của ma trận, từng loại người gọi, Dự án đang hoạt động: được hay KHONG_CO_QUYEN.
  //    Bước cần lý do thì gửi lý do hợp lệ; thiếu lý do (chỉ khoảng trắng) thì LY_DO_BAT_BUOC cho người
  //    được làm, còn người không được làm vẫn nhận KHONG_CO_QUYEN (quyền kiểm trước lý do).
  for (const [tu, sang, canLyDo, duoc] of BUOC_HOP_LE) {
    for (const nguoiGoi of CAC_LOAI_NGUOI_GOI) {
      const duocLam = duoc.includes(nguoiGoi)
      if (canLyDo) {
        them(nguoiGoi, tu, sang, 'HOAT_DONG', 'CO', duocLam ? 'DUOC' : 'KHONG_CO_QUYEN')
        them(nguoiGoi, tu, sang, 'HOAT_DONG', 'TRONG', duocLam ? 'LY_DO_BAT_BUOC' : 'KHONG_CO_QUYEN')
      } else {
        them(nguoiGoi, tu, sang, 'HOAT_DONG', 'KHONG', duocLam ? 'DUOC' : 'KHONG_CO_QUYEN')
        // Bước không bắt buộc lý do vẫn nhận lý do nếu người đổi nhập.
        them(nguoiGoi, tu, sang, 'HOAT_DONG', 'CO', duocLam ? 'DUOC' : 'KHONG_CO_QUYEN')
      }
    }
  }

  // 2. Bước không có trong ma trận (kể cả sang chính trạng thái hiện tại), từ trạng thái chưa cuối:
  //    người giữ vai nhận BUOC_KHONG_HOP_LE, người không giữ vai nhận KHONG_CO_QUYEN.
  for (const tu of CAC_TRANG_THAI_TASK) {
    if (TRANG_THAI_CUOI.includes(tu)) continue
    for (const sang of CAC_TRANG_THAI_TASK) {
      if (laBuocHopLe(tu, sang)) continue
      for (const nguoiGoi of CAC_LOAI_NGUOI_GOI) {
        them(nguoiGoi, tu, sang, 'HOAT_DONG', 'CO', theoVai(nguoiGoi, 'BUOC_KHONG_HOP_LE'))
      }
    }
  }

  // 3. Hoàn thành và Huỷ không đi tiếp: mọi bước từ đó là TASK_DA_CHOT (với người giữ vai).
  for (const tu of TRANG_THAI_CUOI) {
    for (const sang of CAC_TRANG_THAI_TASK) {
      for (const nguoiGoi of CAC_LOAI_NGUOI_GOI) {
        them(nguoiGoi, tu, sang, 'HOAT_DONG', 'CO', theoVai(nguoiGoi, 'TASK_DA_CHOT'))
      }
    }
  }

  // 4. Dự án đã Lưu trữ: mọi bước hợp lệ nhận DU_AN_DA_LUU_TRU (với người giữ vai).
  for (const [tu, sang, canLyDo] of BUOC_HOP_LE) {
    for (const nguoiGoi of CAC_LOAI_NGUOI_GOI) {
      them(nguoiGoi, tu, sang, 'LUU_TRU', canLyDo ? 'CO' : 'KHONG', theoVai(nguoiGoi, 'DU_AN_DA_LUU_TRU'))
    }
  }

  return bang
}

/** Bảng ca dùng chung cho ma trận chuyển trạng thái: mỗi phần tử là một dòng. */
export const BANG_CA_CHUYEN_TRANG_THAI: readonly CaChuyenTrangThai[] = dungBang()
