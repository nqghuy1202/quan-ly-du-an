import { taoManTaiLuoi } from './taoManTaiLuoi'

/*
 * Các màn sau đăng nhập, mỗi màn một phần mã tải khi mở tới (gói đầu chỉ chứa phần trước đăng
 * nhập). Chỉ import các màn này qua đây, không import tĩnh, để chúng không rơi lại vào gói đầu.
 */

export const ManTongQuanTaiLuoi = taoManTaiLuoi(() => import('./ManTongQuan').then((m) => m.ManTongQuan), 'Tổng quan')

export const ManDuAnTaiLuoi = taoManTaiLuoi(() => import('./ManDuAn').then((m) => m.ManDuAn), 'Tất cả Dự án')

export const TrangDuAnCuaToiTaiLuoi = taoManTaiLuoi(
  () => import('./TrangDuAnCuaToi').then((m) => m.TrangDuAnCuaToi),
  'Dự án của tôi',
)

export const ManChiTietDuAnTaiLuoi = taoManTaiLuoi(
  () => import('./ManChiTietDuAn').then((m) => m.ManChiTietDuAn),
  'Chi tiết Dự án',
)

/** Việc của tôi và Chờ tôi duyệt dùng chung một phần mã, mỗi mục một tên khi đang tải hay lỗi. */
const napTrangViecCaNhan = () => import('./TrangViecCaNhan').then((m) => m.TrangViecCaNhan)
export const ViecCuaToiTaiLuoi = taoManTaiLuoi(napTrangViecCaNhan, 'Việc của tôi')
export const ChoToiDuyetTaiLuoi = taoManTaiLuoi(napTrangViecCaNhan, 'Chờ tôi duyệt')

export const ManNguoiDungTaiLuoi = taoManTaiLuoi(() => import('./ManNguoiDung').then((m) => m.ManNguoiDung), 'Người dùng')

export const ManHoSoTaiLuoi = taoManTaiLuoi(() => import('./ManHoSo').then((m) => m.ManHoSo), 'Hồ sơ')
