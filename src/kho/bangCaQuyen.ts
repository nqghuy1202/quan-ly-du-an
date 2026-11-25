// Bảng ca dùng chung cho quyền: nguồn sự thật về ai được làm gì, ở dạng dữ liệu thuần.
// Mỗi dòng: vai hệ thống của người gọi, người gọi có ở trong Dự án hay không, trạng thái Dự án,
// hành động và kết quả mong đợi. Mọi bản cài Kho dữ liệu (bộ nhớ trong cổng, Supabase chạy tay)
// chạy hết các dòng qua `chayBangCaQuyen` (hopDong.ts); hai chỗ phân quyền phải khớp bảng này.
// File này không import vitest để bản cài nào cũng đọc được dữ liệu.
import type { MaLoi } from './ketQua'
import type { TrangThaiDuAn } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'

/**
 * Các hành động trong bảng. Cách dựng mỗi ca (xem `chayBangCaQuyen`): một PM chủ tạo một Dự án,
 * thêm sẵn một người cũ vào đó; người gọi có vai của dòng, được PM chủ thêm vào Dự án nếu dòng
 * ghi "trong Dự án"; Dự án được Lưu trữ nếu dòng ghi Lưu trữ; một tài khoản Thành viên "người
 * mới" đã đăng ký nhưng chưa ở trong Dự án.
 *
 * Riêng hành động về Task (`laHanhDongTask`): PM chủ thêm một Thành viên "người kiểm" vào Dự án và
 * tạo sẵn một Task (Người thực hiện là người cũ, Người kiểm tra là người kiểm) trước khi Lưu trữ.
 * Task mới mà người gọi tạo cũng giao cho người cũ và người kiểm.
 */
export const MO_TA_HANH_DONG = {
  // Ticket 03: vai hệ thống.
  XEM_NGUOI_DUNG: 'Liệt kê mọi tài khoản (danhSachNguoiDung).',
  DOI_VAI: 'Đổi vai của người mới (Thành viên) thành Support (doiVai).',
  // Ticket 04: Dự án.
  TAO_DU_AN: 'Tạo một Dự án mới (taoDuAn).',
  DANH_SACH_DU_AN: 'Dự án có hiện trong danh sách Dự án người gọi thấy không (danhSachDuAn).',
  XEM_DU_AN: 'Mở thẳng Dự án (layDuAn).',
  XEM_DU_AN_KHONG_TON_TAI: 'Mở thẳng một Dự án không tồn tại (layDuAn).',
  SUA_DU_AN: 'Sửa tên Dự án (suaDuAn).',
  LUU_TRU_DU_AN: 'Lưu trữ Dự án (luuTruDuAn).',
  MO_LAI_DU_AN: 'Mở lại Dự án (moLaiDuAn).',
  // Ticket 05: người trong dự án và quyền xem.
  DU_AN_CUA_TOI: 'Dự án có hiện trong "Dự án của tôi" không (danhSachDuAnCuaToi).',
  XEM_NGUOI_TRONG_DU_AN: 'Xem người trong dự án (danhSachNguoiTrongDuAn).',
  THEM_NGUOI: 'Thêm người mới vào Dự án bằng email (themNguoiVaoDuAn).',
  GO_NGUOI: 'Gỡ người cũ khỏi Dự án (goNguoiKhoiDuAn).',
  // Ticket 07: Task.
  TAO_TASK: 'Tạo Task giao cho người cũ, người kiểm duyệt (taoTask).',
  DANH_SACH_TASK: 'Task có sẵn có hiện trong danh sách Task của Dự án không (danhSachTask).',
  XEM_TASK: 'Mở thẳng Task có sẵn (layTask).',
} as const

export type HanhDong = keyof typeof MO_TA_HANH_DONG

export const CAC_HANH_DONG = Object.keys(MO_TA_HANH_DONG) as HanhDong[]

const HANH_DONG_TASK: readonly HanhDong[] = ['TAO_TASK', 'DANH_SACH_TASK', 'XEM_TASK']

/** Hành động về Task: cần dựng thêm người kiểm và một Task có sẵn. */
export function laHanhDongTask(hanhDong: HanhDong): boolean {
  return HANH_DONG_TASK.includes(hanhDong)
}

/**
 * Kết quả mong đợi: `DUOC` (lệnh thành công), một mã lỗi của Kho, hoặc với hành động dạng danh
 * sách: `THAY` / `KHONG_THAY` (Dự án có hay không có trong danh sách trả về).
 */
export type KetQuaMongDoi = 'DUOC' | 'THAY' | 'KHONG_THAY' | MaLoi

export interface CaQuyen {
  vai: VaiHeThong
  trongDuAn: boolean
  trangThaiDuAn: TrangThaiDuAn
  hanhDong: HanhDong
  ketQua: KetQuaMongDoi
}

type Dong = readonly [VaiHeThong, boolean, TrangThaiDuAn, HanhDong, KetQuaMongDoi]

const HD = 'HOAT_DONG'
const LT = 'LUU_TRU'

// prettier-ignore
const DONG: readonly Dong[] = [
  // vai          trong Dự án  Dự án  hành động                   kết quả
  // --- Ticket 03: chỉ PM xem danh sách người dùng và đổi vai, dù có trong Dự án nào hay không.
  ['PM',          true,        HD,    'XEM_NGUOI_DUNG',           'DUOC'],
  ['PM',          false,       HD,    'XEM_NGUOI_DUNG',           'DUOC'],
  ['SUPPORT',     true,        HD,    'XEM_NGUOI_DUNG',           'KHONG_CO_QUYEN'],
  ['SUPPORT',     false,       HD,    'XEM_NGUOI_DUNG',           'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        HD,    'XEM_NGUOI_DUNG',           'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       HD,    'XEM_NGUOI_DUNG',           'KHONG_CO_QUYEN'],
  ['PM',          true,        HD,    'DOI_VAI',                  'DUOC'],
  ['PM',          false,       HD,    'DOI_VAI',                  'DUOC'],
  ['SUPPORT',     true,        HD,    'DOI_VAI',                  'KHONG_CO_QUYEN'],
  ['SUPPORT',     false,       HD,    'DOI_VAI',                  'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        HD,    'DOI_VAI',                  'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       HD,    'DOI_VAI',                  'KHONG_CO_QUYEN'],

  // --- Ticket 04: chỉ PM tạo Dự án, kể cả Support của một Dự án khác.
  ['PM',          true,        HD,    'TAO_DU_AN',                'DUOC'],
  ['PM',          false,       HD,    'TAO_DU_AN',                'DUOC'],
  ['SUPPORT',     true,        HD,    'TAO_DU_AN',                'KHONG_CO_QUYEN'],
  ['SUPPORT',     false,       HD,    'TAO_DU_AN',                'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        HD,    'TAO_DU_AN',                'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       HD,    'TAO_DU_AN',                'KHONG_CO_QUYEN'],

  // --- Quyền xem: PM thấy mọi Dự án; Support và Thành viên chỉ thấy Dự án mình ở trong.
  ['PM',          true,        HD,    'DANH_SACH_DU_AN',          'THAY'],
  ['PM',          false,       HD,    'DANH_SACH_DU_AN',          'THAY'],
  ['SUPPORT',     true,        HD,    'DANH_SACH_DU_AN',          'THAY'],
  ['SUPPORT',     false,       HD,    'DANH_SACH_DU_AN',          'KHONG_THAY'],
  ['THANH_VIEN',  true,        HD,    'DANH_SACH_DU_AN',          'THAY'],
  ['THANH_VIEN',  false,       HD,    'DANH_SACH_DU_AN',          'KHONG_THAY'],
  ['PM',          true,        LT,    'DANH_SACH_DU_AN',          'THAY'],
  ['PM',          false,       LT,    'DANH_SACH_DU_AN',          'THAY'],
  ['SUPPORT',     true,        LT,    'DANH_SACH_DU_AN',          'THAY'],
  ['SUPPORT',     false,       LT,    'DANH_SACH_DU_AN',          'KHONG_THAY'],
  ['THANH_VIEN',  true,        LT,    'DANH_SACH_DU_AN',          'THAY'],
  ['THANH_VIEN',  false,       LT,    'DANH_SACH_DU_AN',          'KHONG_THAY'],
  // "Dự án của tôi" chỉ gồm Dự án mình ở trong, với mọi vai.
  ['PM',          true,        HD,    'DU_AN_CUA_TOI',            'THAY'],
  ['PM',          false,       HD,    'DU_AN_CUA_TOI',            'KHONG_THAY'],
  ['SUPPORT',     true,        HD,    'DU_AN_CUA_TOI',            'THAY'],
  ['SUPPORT',     false,       HD,    'DU_AN_CUA_TOI',            'KHONG_THAY'],
  ['THANH_VIEN',  true,        HD,    'DU_AN_CUA_TOI',            'THAY'],
  ['THANH_VIEN',  false,       HD,    'DU_AN_CUA_TOI',            'KHONG_THAY'],
  // Mở thẳng Dự án không thuộc về mình: "không tìm thấy", giống hệt Dự án không tồn tại.
  ['PM',          true,        HD,    'XEM_DU_AN',                'DUOC'],
  ['PM',          false,       HD,    'XEM_DU_AN',                'DUOC'],
  ['SUPPORT',     true,        HD,    'XEM_DU_AN',                'DUOC'],
  ['SUPPORT',     false,       HD,    'XEM_DU_AN',                'KHONG_TIM_THAY'],
  ['THANH_VIEN',  true,        HD,    'XEM_DU_AN',                'DUOC'],
  ['THANH_VIEN',  false,       HD,    'XEM_DU_AN',                'KHONG_TIM_THAY'],
  ['PM',          true,        LT,    'XEM_DU_AN',                'DUOC'],
  ['PM',          false,       LT,    'XEM_DU_AN',                'DUOC'],
  ['SUPPORT',     true,        LT,    'XEM_DU_AN',                'DUOC'],
  ['SUPPORT',     false,       LT,    'XEM_DU_AN',                'KHONG_TIM_THAY'],
  ['THANH_VIEN',  true,        LT,    'XEM_DU_AN',                'DUOC'],
  ['THANH_VIEN',  false,       LT,    'XEM_DU_AN',                'KHONG_TIM_THAY'],
  ['PM',          true,        HD,    'XEM_DU_AN_KHONG_TON_TAI',  'KHONG_TIM_THAY'],
  ['PM',          false,       HD,    'XEM_DU_AN_KHONG_TON_TAI',  'KHONG_TIM_THAY'],
  ['SUPPORT',     true,        HD,    'XEM_DU_AN_KHONG_TON_TAI',  'KHONG_TIM_THAY'],
  ['SUPPORT',     false,       HD,    'XEM_DU_AN_KHONG_TON_TAI',  'KHONG_TIM_THAY'],
  ['THANH_VIEN',  true,        HD,    'XEM_DU_AN_KHONG_TON_TAI',  'KHONG_TIM_THAY'],
  ['THANH_VIEN',  false,       HD,    'XEM_DU_AN_KHONG_TON_TAI',  'KHONG_TIM_THAY'],
  ['PM',          true,        HD,    'XEM_NGUOI_TRONG_DU_AN',    'DUOC'],
  ['PM',          false,       HD,    'XEM_NGUOI_TRONG_DU_AN',    'DUOC'],
  ['SUPPORT',     true,        HD,    'XEM_NGUOI_TRONG_DU_AN',    'DUOC'],
  ['SUPPORT',     false,       HD,    'XEM_NGUOI_TRONG_DU_AN',    'KHONG_TIM_THAY'],
  ['THANH_VIEN',  true,        HD,    'XEM_NGUOI_TRONG_DU_AN',    'DUOC'],
  ['THANH_VIEN',  false,       HD,    'XEM_NGUOI_TRONG_DU_AN',    'KHONG_TIM_THAY'],

  // --- Quyền quản lý: PM ở mọi Dự án; Support chỉ ở Dự án mình ở trong; Thành viên không.
  ['PM',          true,        HD,    'SUA_DU_AN',                'DUOC'],
  ['PM',          false,       HD,    'SUA_DU_AN',                'DUOC'],
  ['SUPPORT',     true,        HD,    'SUA_DU_AN',                'DUOC'],
  ['SUPPORT',     false,       HD,    'SUA_DU_AN',                'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        HD,    'SUA_DU_AN',                'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       HD,    'SUA_DU_AN',                'KHONG_CO_QUYEN'],
  ['PM',          true,        HD,    'LUU_TRU_DU_AN',            'DUOC'],
  ['PM',          false,       HD,    'LUU_TRU_DU_AN',            'DUOC'],
  ['SUPPORT',     true,        HD,    'LUU_TRU_DU_AN',            'DUOC'],
  ['SUPPORT',     false,       HD,    'LUU_TRU_DU_AN',            'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        HD,    'LUU_TRU_DU_AN',            'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       HD,    'LUU_TRU_DU_AN',            'KHONG_CO_QUYEN'],
  ['PM',          true,        HD,    'MO_LAI_DU_AN',             'DU_AN_DANG_HOAT_DONG'],
  ['PM',          false,       HD,    'MO_LAI_DU_AN',             'DU_AN_DANG_HOAT_DONG'],
  ['SUPPORT',     true,        HD,    'MO_LAI_DU_AN',             'DU_AN_DANG_HOAT_DONG'],
  ['SUPPORT',     false,       HD,    'MO_LAI_DU_AN',             'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        HD,    'MO_LAI_DU_AN',             'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       HD,    'MO_LAI_DU_AN',             'KHONG_CO_QUYEN'],
  ['PM',          true,        HD,    'THEM_NGUOI',               'DUOC'],
  ['PM',          false,       HD,    'THEM_NGUOI',               'DUOC'],
  ['SUPPORT',     true,        HD,    'THEM_NGUOI',               'DUOC'],
  ['SUPPORT',     false,       HD,    'THEM_NGUOI',               'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        HD,    'THEM_NGUOI',               'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       HD,    'THEM_NGUOI',               'KHONG_CO_QUYEN'],
  ['PM',          true,        HD,    'GO_NGUOI',                 'DUOC'],
  ['PM',          false,       HD,    'GO_NGUOI',                 'DUOC'],
  ['SUPPORT',     true,        HD,    'GO_NGUOI',                 'DUOC'],
  ['SUPPORT',     false,       HD,    'GO_NGUOI',                 'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        HD,    'GO_NGUOI',                 'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       HD,    'GO_NGUOI',                 'KHONG_CO_QUYEN'],

  // --- Dự án đã Lưu trữ: người quản lý được nhận DU_AN_DA_LUU_TRU với mọi lệnh ghi, và mở lại được;
  // người không quản lý được vẫn chỉ nhận KHONG_CO_QUYEN (kiểm quyền trước trạng thái).
  ['PM',          true,        LT,    'SUA_DU_AN',                'DU_AN_DA_LUU_TRU'],
  ['PM',          false,       LT,    'SUA_DU_AN',                'DU_AN_DA_LUU_TRU'],
  ['SUPPORT',     true,        LT,    'SUA_DU_AN',                'DU_AN_DA_LUU_TRU'],
  ['SUPPORT',     false,       LT,    'SUA_DU_AN',                'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        LT,    'SUA_DU_AN',                'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       LT,    'SUA_DU_AN',                'KHONG_CO_QUYEN'],
  ['PM',          true,        LT,    'LUU_TRU_DU_AN',            'DU_AN_DA_LUU_TRU'],
  ['PM',          false,       LT,    'LUU_TRU_DU_AN',            'DU_AN_DA_LUU_TRU'],
  ['SUPPORT',     true,        LT,    'LUU_TRU_DU_AN',            'DU_AN_DA_LUU_TRU'],
  ['SUPPORT',     false,       LT,    'LUU_TRU_DU_AN',            'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        LT,    'LUU_TRU_DU_AN',            'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       LT,    'LUU_TRU_DU_AN',            'KHONG_CO_QUYEN'],
  ['PM',          true,        LT,    'MO_LAI_DU_AN',             'DUOC'],
  ['PM',          false,       LT,    'MO_LAI_DU_AN',             'DUOC'],
  ['SUPPORT',     true,        LT,    'MO_LAI_DU_AN',             'DUOC'],
  ['SUPPORT',     false,       LT,    'MO_LAI_DU_AN',             'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        LT,    'MO_LAI_DU_AN',             'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       LT,    'MO_LAI_DU_AN',             'KHONG_CO_QUYEN'],
  ['PM',          true,        LT,    'THEM_NGUOI',               'DU_AN_DA_LUU_TRU'],
  ['PM',          false,       LT,    'THEM_NGUOI',               'DU_AN_DA_LUU_TRU'],
  ['SUPPORT',     true,        LT,    'THEM_NGUOI',               'DU_AN_DA_LUU_TRU'],
  ['SUPPORT',     false,       LT,    'THEM_NGUOI',               'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        LT,    'THEM_NGUOI',               'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       LT,    'THEM_NGUOI',               'KHONG_CO_QUYEN'],
  ['PM',          true,        LT,    'GO_NGUOI',                 'DU_AN_DA_LUU_TRU'],
  ['PM',          false,       LT,    'GO_NGUOI',                 'DU_AN_DA_LUU_TRU'],
  ['SUPPORT',     true,        LT,    'GO_NGUOI',                 'DU_AN_DA_LUU_TRU'],
  ['SUPPORT',     false,       LT,    'GO_NGUOI',                 'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        LT,    'GO_NGUOI',                 'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       LT,    'GO_NGUOI',                 'KHONG_CO_QUYEN'],
  ['PM',          true,        LT,    'XEM_NGUOI_TRONG_DU_AN',    'DUOC'],
  ['PM',          false,       LT,    'XEM_NGUOI_TRONG_DU_AN',    'DUOC'],
  ['SUPPORT',     true,        LT,    'XEM_NGUOI_TRONG_DU_AN',    'DUOC'],
  ['SUPPORT',     false,       LT,    'XEM_NGUOI_TRONG_DU_AN',    'KHONG_TIM_THAY'],
  ['THANH_VIEN',  true,        LT,    'XEM_NGUOI_TRONG_DU_AN',    'DUOC'],
  ['THANH_VIEN',  false,       LT,    'XEM_NGUOI_TRONG_DU_AN',    'KHONG_TIM_THAY'],

  // --- Ticket 07: tạo Task như quyền quản lý Dự án (PM ở mọi Dự án, Support của Dự án). Thành viên
  // không tạo được, kể cả khi ở trong Dự án. Dự án Lưu trữ: DU_AN_DA_LUU_TRU sau khi kiểm quyền.
  ['PM',          true,        HD,    'TAO_TASK',                 'DUOC'],
  ['PM',          false,       HD,    'TAO_TASK',                 'DUOC'],
  ['SUPPORT',     true,        HD,    'TAO_TASK',                 'DUOC'],
  ['SUPPORT',     false,       HD,    'TAO_TASK',                 'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        HD,    'TAO_TASK',                 'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       HD,    'TAO_TASK',                 'KHONG_CO_QUYEN'],
  ['PM',          true,        LT,    'TAO_TASK',                 'DU_AN_DA_LUU_TRU'],
  ['PM',          false,       LT,    'TAO_TASK',                 'DU_AN_DA_LUU_TRU'],
  ['SUPPORT',     true,        LT,    'TAO_TASK',                 'DU_AN_DA_LUU_TRU'],
  ['SUPPORT',     false,       LT,    'TAO_TASK',                 'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  true,        LT,    'TAO_TASK',                 'KHONG_CO_QUYEN'],
  ['THANH_VIEN',  false,       LT,    'TAO_TASK',                 'KHONG_CO_QUYEN'],
  // Xem Task: ai thấy Dự án thì thấy mọi Task của nó, kể cả khi Dự án đã Lưu trữ; người ngoài nhận
  // "không tìm thấy".
  ['PM',          true,        HD,    'DANH_SACH_TASK',           'THAY'],
  ['PM',          false,       HD,    'DANH_SACH_TASK',           'THAY'],
  ['SUPPORT',     true,        HD,    'DANH_SACH_TASK',           'THAY'],
  ['SUPPORT',     false,       HD,    'DANH_SACH_TASK',           'KHONG_TIM_THAY'],
  ['THANH_VIEN',  true,        HD,    'DANH_SACH_TASK',           'THAY'],
  ['THANH_VIEN',  false,       HD,    'DANH_SACH_TASK',           'KHONG_TIM_THAY'],
  ['PM',          true,        LT,    'DANH_SACH_TASK',           'THAY'],
  ['PM',          false,       LT,    'DANH_SACH_TASK',           'THAY'],
  ['SUPPORT',     true,        LT,    'DANH_SACH_TASK',           'THAY'],
  ['SUPPORT',     false,       LT,    'DANH_SACH_TASK',           'KHONG_TIM_THAY'],
  ['THANH_VIEN',  true,        LT,    'DANH_SACH_TASK',           'THAY'],
  ['THANH_VIEN',  false,       LT,    'DANH_SACH_TASK',           'KHONG_TIM_THAY'],
  ['PM',          true,        HD,    'XEM_TASK',                 'DUOC'],
  ['PM',          false,       HD,    'XEM_TASK',                 'DUOC'],
  ['SUPPORT',     true,        HD,    'XEM_TASK',                 'DUOC'],
  ['SUPPORT',     false,       HD,    'XEM_TASK',                 'KHONG_TIM_THAY'],
  ['THANH_VIEN',  true,        HD,    'XEM_TASK',                 'DUOC'],
  ['THANH_VIEN',  false,       HD,    'XEM_TASK',                 'KHONG_TIM_THAY'],
  ['PM',          true,        LT,    'XEM_TASK',                 'DUOC'],
  ['PM',          false,       LT,    'XEM_TASK',                 'DUOC'],
  ['SUPPORT',     true,        LT,    'XEM_TASK',                 'DUOC'],
  ['SUPPORT',     false,       LT,    'XEM_TASK',                 'KHONG_TIM_THAY'],
  ['THANH_VIEN',  true,        LT,    'XEM_TASK',                 'DUOC'],
  ['THANH_VIEN',  false,       LT,    'XEM_TASK',                 'KHONG_TIM_THAY'],
]

/** Bảng ca dùng chung cho quyền: mỗi phần tử là một dòng. */
export const BANG_CA_QUYEN: readonly CaQuyen[] = DONG.map(([vai, trongDuAn, trangThaiDuAn, hanhDong, ketQua]) => ({
  vai,
  trongDuAn,
  trangThaiDuAn,
  hanhDong,
  ketQua,
}))
