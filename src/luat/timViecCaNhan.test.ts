import { describe, expect, it } from 'vitest'
import type { MucUuTien } from './mucUuTien'
import type { TrangThaiTask } from './task'
import {
  LOC_VIEC_CA_NHAN_TRONG,
  THONG_BAO_TIM_VIEC_CA_NHAN,
  dangLocViecCaNhan,
  demChipViecCaNhan,
  khopTuKhoaViecCaNhan,
  kiemTraLocViecCaNhan,
  locViecCaNhan,
  type LocViecCaNhan,
} from './timViecCaNhan'

/** 10:00 ngày 26/11/2026 giờ Việt Nam. */
const BAY_GIO = new Date('2026-11-26T10:00:00+07:00')

function task(
  tieuDe: string,
  them: Partial<{ maDuAn: string; tenDuAn: string; trangThai: TrangThaiTask; mucUuTien: MucUuTien; han: string | null }> = {},
) {
  return { tieuDe, maDuAn: 'AMS', tenDuAn: 'Quản lý tài sản', trangThai: 'MOI' as TrangThaiTask, mucUuTien: 'TRUNG_BINH' as MucUuTien, han: null, ...them }
}

const DS = [
  task('[Khớp mã trạng thái DVC] 01', { trangThai: 'MOI', mucUuTien: 'CAO', han: '2026-11-20' }),
  task('Sửa báo cáo tồn kho', { trangThai: 'TRA_LAI', mucUuTien: 'CAO', han: '2026-11-26' }),
  task('Viết tài liệu', { trangThai: 'DANG_LAM', mucUuTien: 'THAP' }),
  task('Đồng bộ DVC', { maDuAn: 'SDV-012', tenDuAn: 'Cổng Hà Nội', trangThai: 'MOI', mucUuTien: 'TRUNG_BINH', han: '2026-11-25' }),
  task('Kiểm thử đăng nhập', { maDuAn: 'SDV-012', tenDuAn: 'Cổng Hà Nội', trangThai: 'TRA_LAI', mucUuTien: 'THAP' }),
  task('Duyệt giao diện', { maDuAn: 'SDV-012', tenDuAn: 'Cổng Hà Nội', trangThai: 'CHO_DUYET', mucUuTien: 'CAO', han: '2026-11-01' }),
]

const tieuDe = (ds: readonly { tieuDe: string }[]) => ds.map((t) => t.tieuDe)
const loc = (them: Partial<LocViecCaNhan>): LocViecCaNhan => ({ ...LOC_VIEC_CA_NHAN_TRONG, ...them })

describe('tìm việc cá nhân theo từ khoá', () => {
  it.each([
    { tuKhoa: 'khop ma', ra: ['[Khớp mã trạng thái DVC] 01'], vi: 'bỏ dấu và hoa thường, khớp tiêu đề' },
    { tuKhoa: 'KHỚP MÃ', ra: ['[Khớp mã trạng thái DVC] 01'], vi: 'gõ có dấu, chữ hoa' },
    { tuKhoa: 'ams', ra: ['[Khớp mã trạng thái DVC] 01', 'Sửa báo cáo tồn kho', 'Viết tài liệu'], vi: 'khớp Mã Dự án AMS' },
    { tuKhoa: 'sdv-012', ra: ['Đồng bộ DVC', 'Kiểm thử đăng nhập', 'Duyệt giao diện'], vi: 'khớp Mã Dự án có gạch nối' },
    { tuKhoa: 'ha noi', ra: ['Đồng bộ DVC', 'Kiểm thử đăng nhập', 'Duyệt giao diện'], vi: 'khớp tên Dự án' },
    { tuKhoa: 'dong bo', ra: ['Đồng bộ DVC'], vi: 'đ khớp d' },
    { tuKhoa: 'dvc', ra: ['[Khớp mã trạng thái DVC] 01', 'Đồng bộ DVC'], vi: 'khớp một phần giữa tiêu đề' },
    { tuKhoa: '   khop ma  ', ra: ['[Khớp mã trạng thái DVC] 01'], vi: 'khoảng trắng hai đầu bị bỏ qua' },
    { tuKhoa: 'khong co gi', ra: [], vi: 'không khớp gì thì rỗng' },
  ])('"$tuKhoa": $vi', ({ tuKhoa, ra }) => {
    expect(tieuDe(locViecCaNhan(DS, loc({ tuKhoa }), BAY_GIO))).toEqual(ra)
  })

  it('từ khoá rỗng hay chỉ có khoảng trắng luôn khớp', () => {
    expect(khopTuKhoaViecCaNhan(DS[0], '')).toBe(true)
    expect(khopTuKhoaViecCaNhan(DS[0], '   ')).toBe(true)
    expect(locViecCaNhan(DS, loc({ tuKhoa: '  ' }), BAY_GIO)).toEqual(DS)
  })
})

describe('lọc việc cá nhân bằng chip', () => {
  it.each([
    { vi: 'chọn Mới và Trả lại: Task ở một trong hai trạng thái', loc: { trangThai: ['MOI', 'TRA_LAI'] }, ra: ['[Khớp mã trạng thái DVC] 01', 'Sửa báo cáo tồn kho', 'Đồng bộ DVC', 'Kiểm thử đăng nhập'] },
    { vi: 'thêm Mức ưu tiên Cao: chỉ còn Task thoả cả hai nhóm', loc: { trangThai: ['MOI', 'TRA_LAI'], mucUuTien: ['CAO'] }, ra: ['[Khớp mã trạng thái DVC] 01', 'Sửa báo cáo tồn kho'] },
    { vi: 'thêm từ khoá: phải khớp cả từ khoá', loc: { trangThai: ['MOI', 'TRA_LAI'], mucUuTien: ['CAO'], tuKhoa: 'dvc' }, ra: ['[Khớp mã trạng thái DVC] 01'] },
    { vi: 'Thấp hoặc Cao trong nhóm Mức ưu tiên', loc: { mucUuTien: ['THAP', 'CAO'] }, ra: ['[Khớp mã trạng thái DVC] 01', 'Sửa báo cáo tồn kho', 'Viết tài liệu', 'Kiểm thử đăng nhập', 'Duyệt giao diện'] },
    { vi: 'chỉ chip Trễ hạn', loc: { treHan: true }, ra: ['[Khớp mã trạng thái DVC] 01', 'Đồng bộ DVC', 'Duyệt giao diện'] },
    { vi: 'Trễ hạn và Mức ưu tiên Cao', loc: { treHan: true, mucUuTien: ['CAO'] }, ra: ['[Khớp mã trạng thái DVC] 01', 'Duyệt giao diện'] },
    { vi: 'chip ứng với 0 Task: rỗng', loc: { trangThai: ['BI_LOI'] }, ra: [] },
  ] satisfies { vi: string; loc: Partial<LocViecCaNhan>; ra: string[] }[])('$vi', ({ loc: them, ra }) => {
    expect(tieuDe(locViecCaNhan(DS, loc(them), BAY_GIO))).toEqual(ra)
  })

  it('bộ lọc trống trả đủ danh sách, đúng thứ tự đầu vào; kết quả lọc luôn giữ thứ tự đầu vào', () => {
    expect(locViecCaNhan(DS, LOC_VIEC_CA_NHAN_TRONG, BAY_GIO)).toEqual(DS)
    const daoNguoc = [...DS].reverse()
    expect(locViecCaNhan(daoNguoc, LOC_VIEC_CA_NHAN_TRONG, BAY_GIO)).toEqual(daoNguoc)
    expect(tieuDe(locViecCaNhan(daoNguoc, loc({ trangThai: ['TRA_LAI', 'MOI'] }), BAY_GIO))).toEqual([
      'Kiểm thử đăng nhập',
      'Đồng bộ DVC',
      'Sửa báo cáo tồn kho',
      '[Khớp mã trạng thái DVC] 01',
    ])
  })
})

describe('chip Trễ hạn: biên nửa đêm giờ Việt Nam', () => {
  const homQua = task('Hạn hôm qua', { han: '2026-11-25' })
  const homNay = task('Hạn hôm nay', { han: '2026-11-26' })
  const khongHan = task('Không có hạn', { han: null })
  const bon = [homQua, homNay, khongHan]
  it.each([
    { bayGio: '2026-11-26T00:00:00+07:00', ra: ['Hạn hôm qua'], vi: '00:00 ngày 26/11: hạn 25/11 đã trễ, hạn hôm nay chưa' },
    { bayGio: '2026-11-26T23:59:59+07:00', ra: ['Hạn hôm qua'], vi: '23:59 ngày 26/11: hạn hôm nay vẫn chưa trễ' },
    { bayGio: '2026-11-25T23:59:59+07:00', ra: [], vi: '23:59 ngày 25/11: hạn 25/11 chưa trễ' },
    { bayGio: '2026-11-25T17:00:00Z', ra: ['Hạn hôm qua'], vi: '17:00 UTC ngày 25/11 đã là 26/11 giờ Việt Nam' },
    { bayGio: '2026-11-27T00:00:00+07:00', ra: ['Hạn hôm qua', 'Hạn hôm nay'], vi: 'qua nửa đêm 27/11: hạn 26/11 đã trễ' },
    { bayGio: '2099-01-01T00:00:00+07:00', ra: ['Hạn hôm qua', 'Hạn hôm nay'], vi: 'Task không có hạn không bao giờ trễ' },
  ])('$vi', ({ bayGio, ra }) => {
    expect(tieuDe(locViecCaNhan(bon, loc({ treHan: true }), new Date(bayGio)))).toEqual(ra)
    expect(demChipViecCaNhan(bon, new Date(bayGio)).treHan).toBe(ra.length)
  })
})

describe('đếm cho chip', () => {
  it('đúng số cho từng chip, kể cả chip số 0', () => {
    expect(demChipViecCaNhan(DS, BAY_GIO)).toEqual({
      trangThai: { MOI: 2, DANG_LAM: 1, CHO_DUYET: 1, TRA_LAI: 2, BI_LOI: 0, HOAN_THANH: 0, HUY: 0 },
      mucUuTien: { THAP: 2, TRUNG_BINH: 1, CAO: 3 },
      treHan: 3,
    })
  })

  it('danh sách rỗng: mọi chip là 0', () => {
    expect(demChipViecCaNhan([], BAY_GIO)).toEqual({
      trangThai: { MOI: 0, DANG_LAM: 0, CHO_DUYET: 0, TRA_LAI: 0, BI_LOI: 0, HOAN_THANH: 0, HUY: 0 },
      mucUuTien: { THAP: 0, TRUNG_BINH: 0, CAO: 0 },
      treHan: 0,
    })
  })

  it('không phụ thuộc chip khác hay từ khoá: đếm chỉ nhận danh sách đã đọc, nên bộ lọc nào cũng ra cùng số', () => {
    const goc = demChipViecCaNhan(DS, BAY_GIO)
    // Lọc không đổi danh sách đầu vào, nên đếm sau khi lọc trên danh sách gốc vẫn ra đúng số cũ.
    locViecCaNhan(DS, loc({ tuKhoa: 'dvc', trangThai: ['MOI'], mucUuTien: ['CAO'], treHan: true }), BAY_GIO)
    expect(demChipViecCaNhan(DS, BAY_GIO)).toEqual(goc)
  })
})

describe('đang lọc', () => {
  it.each([
    { vi: 'bộ lọc trống', loc: {}, ra: false },
    { vi: 'từ khoá chỉ có khoảng trắng', loc: { tuKhoa: '   ' }, ra: false },
    { vi: 'có từ khoá', loc: { tuKhoa: ' a ' }, ra: true },
    { vi: 'một chip Trạng thái bật', loc: { trangThai: ['BI_LOI'] }, ra: true },
    { vi: 'một chip Mức ưu tiên bật', loc: { mucUuTien: ['THAP'] }, ra: true },
    { vi: 'chip Trễ hạn bật', loc: { treHan: true }, ra: true },
  ] satisfies { vi: string; loc: Partial<LocViecCaNhan>; ra: boolean }[])('$vi: $ra', ({ loc: them, ra }) => {
    expect(dangLocViecCaNhan(loc(them))).toBe(ra)
  })
})

describe('kiểm bộ lọc ở ranh giới', () => {
  it('nhận bộ lọc hợp lệ, thiếu hay null là không lọc, giá trị trùng chỉ giữ một', () => {
    expect(kiemTraLocViecCaNhan.loc({})).toEqual({ ok: true, giaTri: LOC_VIEC_CA_NHAN_TRONG })
    expect(
      kiemTraLocViecCaNhan.loc({ tuKhoa: ' dvc ', trangThai: ['MOI', 'MOI', 'TRA_LAI'], mucUuTien: null, treHan: true }),
    ).toEqual({ ok: true, giaTri: { tuKhoa: ' dvc ', trangThai: ['MOI', 'TRA_LAI'], mucUuTien: [], treHan: true } })
  })

  it.each([
    { dauVao: { trangThai: ['XONG'] }, o: 'trangThai', loi: THONG_BAO_TIM_VIEC_CA_NHAN.trangThaiLocSai },
    { dauVao: { trangThai: 'MOI' }, o: 'trangThai', loi: THONG_BAO_TIM_VIEC_CA_NHAN.trangThaiLocSai },
    { dauVao: { mucUuTien: ['RAT_CAO'] }, o: 'mucUuTien', loi: THONG_BAO_TIM_VIEC_CA_NHAN.mucUuTienLocSai },
    { dauVao: { tuKhoa: 5 }, o: 'tuKhoa', loi: THONG_BAO_TIM_VIEC_CA_NHAN.tuKhoaSai },
    { dauVao: { treHan: 'co' }, o: 'treHan', loi: THONG_BAO_TIM_VIEC_CA_NHAN.treHanSai },
  ])('từ chối $o sai', ({ dauVao, o, loi }) => {
    expect(kiemTraLocViecCaNhan.loc(dauVao)).toEqual({ ok: false, loiTheoO: { [o]: loi } })
  })
})
