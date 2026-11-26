// Luật thuần về điều hướng chính (Thanh bên): có những mục nào, chia nhóm ra sao, vai nào thấy mục nào.
// Không I/O. Giao diện chỉ vẽ lại danh sách này, không tự viết điều kiện hiện mục theo vai.
import { duocXemMoiDuAn } from './duAn'
import { duocQuanLyNguoiDung, type VaiHeThong } from './taiKhoan'

/** Các trang mở được từ điều hướng chính. */
export type Trang = 'tongQuan' | 'viecCuaToi' | 'choToiDuyet' | 'duAn' | 'tatCaDuAn' | 'nguoiDung' | 'hoSo'

/** Nhóm trên Thanh bên. `taiKhoan` không có tiêu đề: nằm cùng chỗ với tên, vai và nút Đăng xuất. */
export type NhomDieuHuong = 'tongQuan' | 'congViec' | 'duAn' | 'quanTri' | 'taiKhoan'

export interface MucDieuHuong {
  trang: Trang
  nhan: string
  nhom: NhomDieuHuong
}

export interface NhomMucDieuHuong {
  nhom: NhomDieuHuong
  /** Tiêu đề nhóm; `null` nghĩa là nhóm không có tiêu đề (mục đứng riêng). */
  tieuDe: string | null
  muc: MucDieuHuong[]
}

/** Trang đầu tiên sau khi đăng nhập. */
export const TRANG_MO_DAU: Trang = 'tongQuan'

/** Thứ tự nhóm trên Thanh bên, kèm tiêu đề của từng nhóm. */
const CAC_NHOM: ReadonlyArray<{ nhom: NhomDieuHuong; tieuDe: string | null }> = [
  { nhom: 'tongQuan', tieuDe: null },
  { nhom: 'congViec', tieuDe: 'Công việc' },
  { nhom: 'duAn', tieuDe: 'Dự án' },
  { nhom: 'quanTri', tieuDe: 'Quản trị' },
  { nhom: 'taiKhoan', tieuDe: null },
]

/** Mọi mục theo thứ tự hiện, kèm điều kiện theo vai. */
const CAC_MUC: ReadonlyArray<MucDieuHuong & { hienVoi: (vai: VaiHeThong) => boolean }> = [
  { trang: 'tongQuan', nhan: 'Tổng quan', nhom: 'tongQuan', hienVoi: () => true },
  { trang: 'viecCuaToi', nhan: 'Việc của tôi', nhom: 'congViec', hienVoi: () => true },
  { trang: 'choToiDuyet', nhan: 'Chờ tôi duyệt', nhom: 'congViec', hienVoi: () => true },
  { trang: 'duAn', nhan: 'Dự án của tôi', nhom: 'duAn', hienVoi: () => true },
  // Cùng luật quyền với Kho: chỉ PM thấy mọi Dự án, nên chỉ PM có mục Tất cả Dự án.
  { trang: 'tatCaDuAn', nhan: 'Tất cả Dự án', nhom: 'duAn', hienVoi: duocXemMoiDuAn },
  { trang: 'nguoiDung', nhan: 'Người dùng', nhom: 'quanTri', hienVoi: duocQuanLyNguoiDung },
  { trang: 'hoSo', nhan: 'Hồ sơ', nhom: 'taiKhoan', hienVoi: () => true },
]

/** Danh sách phẳng các mục điều hướng mà vai này được thấy, theo thứ tự hiện. */
export function mucDieuHuong(vai: VaiHeThong): MucDieuHuong[] {
  return CAC_MUC.filter((muc) => muc.hienVoi(vai)).map(({ trang, nhan, nhom }) => ({ trang, nhan, nhom }))
}

/** Các mục của vai này gom theo nhóm; nhóm không còn mục nào thì bỏ (Thành viên không có nhóm Quản trị). */
export function nhomDieuHuong(vai: VaiHeThong): NhomMucDieuHuong[] {
  const muc = mucDieuHuong(vai)
  return CAC_NHOM.map(({ nhom, tieuDe }) => ({ nhom, tieuDe, muc: muc.filter((m) => m.nhom === nhom) })).filter(
    (nhom) => nhom.muc.length > 0,
  )
}

/** Trang này vai này có được mở không. */
export function duocMoTrang(trang: Trang, vai: VaiHeThong): boolean {
  return mucDieuHuong(vai).some((muc) => muc.trang === trang)
}

/** Trang sẽ thật sự hiện: trang đang chọn nếu vai còn được mở, không thì về trang đầu (Tổng quan). */
export function trangHienThi(trang: Trang, vai: VaiHeThong): Trang {
  return duocMoTrang(trang, vai) ? trang : TRANG_MO_DAU
}
