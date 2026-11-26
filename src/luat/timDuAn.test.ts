import { describe, expect, it } from 'vitest'
import type { MucUuTien } from './mucUuTien'
import {
  LOC_DU_AN_TRONG,
  THONG_BAO_TIM_DU_AN,
  cacNguoiPhuTrach,
  chuanHoaDeTim,
  dangLocDuAn,
  khopTuKhoa,
  kiemTraLocDuAn,
  locDuAn,
  type DuAnDeLoc,
  type LocDuAn,
} from './timDuAn'

const AN = { id: 'an', tenHienThi: 'An' }
const BINH = { id: 'binh', tenHienThi: 'Bình' }

function duAn(
  ma: string,
  ten: string,
  them: Partial<Omit<DuAnDeLoc, 'ma' | 'ten'>> & { nguoiPhuTrach?: { id: string; tenHienThi: string } | null } = {},
) {
  return {
    ma,
    ten,
    mucUuTien: 'TRUNG_BINH' as MucUuTien,
    nguoiPhuTrach: null,
    trangThai: 'HOAT_DONG' as const,
    quaHanDuKien: false,
    ...them,
  }
}

const DS = [
  duAn('SDV-012', 'Cổng thông tin Hà Nội', { mucUuTien: 'CAO', nguoiPhuTrach: AN, quaHanDuKien: true }),
  duAn('SDV-013', 'Kho Đà Nẵng', { mucUuTien: 'CAO', nguoiPhuTrach: BINH }),
  duAn('HCM-001', 'Website Hồ Chí Minh', { mucUuTien: 'THAP', nguoiPhuTrach: AN }),
  duAn('HN-02', 'Ứng dụng Hà Nam', { mucUuTien: 'CAO', nguoiPhuTrach: AN, trangThai: 'LUU_TRU' }),
  duAn('KT-1', 'Kế toán', { mucUuTien: 'CAO', quaHanDuKien: true }),
  duAn('HT-1', 'Bến cảng Hà Tĩnh', { mucUuTien: 'THAP', nguoiPhuTrach: AN }),
  duAn('HP-1', 'Hải Phòng', { mucUuTien: 'CAO', nguoiPhuTrach: BINH }),
]

const ten = (ds: readonly { ten: string }[]) => ds.map((d) => d.ten)
const loc = (them: Partial<LocDuAn>): LocDuAn => ({ ...LOC_DU_AN_TRONG, ...them })

describe('tìm Dự án theo tên hoặc Mã', () => {
  it('"ha noi" khớp Dự án tên "Hà Nội" (bỏ qua hoa thường và dấu); "sdv" khớp Mã SDV-012', () => {
    expect(khopTuKhoa({ ten: 'Hà Nội', ma: 'X-1' }, 'ha noi')).toBe(true)
    expect(khopTuKhoa({ ten: 'Website', ma: 'SDV-012' }, 'sdv')).toBe(true)
    expect(ten(locDuAn(DS, loc({ tuKhoa: 'ha noi' })))).toEqual(['Cổng thông tin Hà Nội'])
    expect(ten(locDuAn(DS, loc({ tuKhoa: 'sdv' })))).toEqual(['Cổng thông tin Hà Nội', 'Kho Đà Nẵng'])
  })

  it('đ khớp d, chữ có dấu gõ không dấu hay có dấu đều khớp; gõ có dấu cũng khớp tên không dấu', () => {
    expect(ten(locDuAn(DS, loc({ tuKhoa: 'da nang' })))).toEqual(['Kho Đà Nẵng'])
    expect(ten(locDuAn(DS, loc({ tuKhoa: 'ĐÀ NẴNG' })))).toEqual(['Kho Đà Nẵng'])
    expect(khopTuKhoa({ ten: 'Ke toan', ma: 'KT-1' }, 'Kế Toán')).toBe(true)
    expect(chuanHoaDeTim('  Hà   Nội  ')).toBe('ha noi')
  })

  it('khớp một phần ở giữa tên hay Mã; từ khoá rỗng hay chỉ khoảng trắng giữ toàn bộ; không khớp thì rỗng', () => {
    expect(ten(locDuAn(DS, loc({ tuKhoa: 'chi minh' })))).toEqual(['Website Hồ Chí Minh'])
    expect(ten(locDuAn(DS, loc({ tuKhoa: '-001' })))).toEqual(['Website Hồ Chí Minh'])
    expect(locDuAn(DS, loc({ tuKhoa: '   ' }))).toEqual(DS)
    expect(locDuAn(DS, loc({ tuKhoa: 'khong co' }))).toEqual([])
  })
})

describe('lọc Dự án', () => {
  it('lọc Mức ưu tiên Cao', () => {
    expect(ten(locDuAn(DS, loc({ mucUuTien: 'CAO' })))).toEqual([
      'Cổng thông tin Hà Nội',
      'Kho Đà Nẵng',
      'Ứng dụng Hà Nam',
      'Kế toán',
      'Hải Phòng',
    ])
  })

  it('lọc theo một Người phụ trách (Dự án không có Người phụ trách không khớp)', () => {
    expect(ten(locDuAn(DS, loc({ nguoiPhuTrachId: 'an' })))).toEqual([
      'Cổng thông tin Hà Nội',
      'Website Hồ Chí Minh',
      'Ứng dụng Hà Nam',
      'Bến cảng Hà Tĩnh',
    ])
    expect(ten(locDuAn(DS, loc({ nguoiPhuTrachId: 'binh' })))).toEqual(['Kho Đà Nẵng', 'Hải Phòng'])
  })

  it('lọc tình trạng Quá hạn dự kiến, đang hoạt động, Lưu trữ', () => {
    expect(ten(locDuAn(DS, loc({ tinhTrang: 'QUA_HAN_DU_KIEN' })))).toEqual(['Cổng thông tin Hà Nội', 'Kế toán'])
    expect(ten(locDuAn(DS, loc({ tinhTrang: 'LUU_TRU' })))).toEqual(['Ứng dụng Hà Nam'])
    expect(ten(locDuAn(DS, loc({ tinhTrang: 'HOAT_DONG' })))).toEqual([
      'Cổng thông tin Hà Nội',
      'Kho Đà Nẵng',
      'Website Hồ Chí Minh',
      'Kế toán',
      'Bến cảng Hà Tĩnh',
      'Hải Phòng',
    ])
  })

  it('kết hợp tìm với hai bộ lọc cho giao đúng', () => {
    // "ha" khớp Hà Nội, Hà Nam, Hà Tĩnh, Hải Phòng...
    expect(ten(locDuAn(DS, loc({ tuKhoa: 'ha' })))).toEqual([
      'Cổng thông tin Hà Nội',
      'Ứng dụng Hà Nam',
      'Bến cảng Hà Tĩnh',
      'Hải Phòng',
    ])
    // ...giao với Cao và Người phụ trách An: bỏ Hà Tĩnh (Thấp) và Hải Phòng (Bình).
    expect(ten(locDuAn(DS, loc({ tuKhoa: 'ha', mucUuTien: 'CAO', nguoiPhuTrachId: 'an' })))).toEqual([
      'Cổng thông tin Hà Nội',
      'Ứng dụng Hà Nam',
    ])
    // ...giao với Cao và Lưu trữ: chỉ Hà Nam.
    expect(ten(locDuAn(DS, loc({ tuKhoa: 'ha', mucUuTien: 'CAO', tinhTrang: 'LUU_TRU' })))).toEqual(['Ứng dụng Hà Nam'])
    expect(locDuAn(DS, loc({ tuKhoa: 'ha', mucUuTien: 'THAP', tinhTrang: 'LUU_TRU' }))).toEqual([])
  })

  it('không lọc gì thì giữ nguyên toàn bộ và thứ tự đầu vào', () => {
    expect(locDuAn(DS, LOC_DU_AN_TRONG)).toEqual(DS)
    expect(dangLocDuAn(LOC_DU_AN_TRONG)).toBe(false)
    expect(dangLocDuAn(loc({ tuKhoa: '  ' }))).toBe(false)
    expect(dangLocDuAn(loc({ tuKhoa: 'a' }))).toBe(true)
    expect(dangLocDuAn(loc({ tinhTrang: 'LUU_TRU' }))).toBe(true)
  })
})

describe('kiểm bộ lọc ở ranh giới và lựa chọn Người phụ trách', () => {
  it('trống hay null là không lọc; giá trị đúng được giữ', () => {
    expect(kiemTraLocDuAn.loc({ tuKhoa: 'ha', mucUuTien: '', nguoiPhuTrachId: null, tinhTrang: 'QUA_HAN_DU_KIEN' })).toEqual({
      ok: true,
      giaTri: { tuKhoa: 'ha', mucUuTien: null, nguoiPhuTrachId: null, tinhTrang: 'QUA_HAN_DU_KIEN' },
    })
  })

  it('Mức ưu tiên hay tình trạng không có thật: lỗi tiếng Việt ở đúng ô', () => {
    const kq = kiemTraLocDuAn.loc({ mucUuTien: 'GAP', tinhTrang: 'DA_XOA' })
    expect(kq.ok).toBe(false)
    if (!kq.ok) {
      expect(kq.loiTheoO.mucUuTien).toBe(THONG_BAO_TIM_DU_AN.mucUuTienLocSai)
      expect(kq.loiTheoO.tinhTrang).toBe(THONG_BAO_TIM_DU_AN.tinhTrangLocSai)
    }
  })

  it('các Người phụ trách không trùng, xếp theo tên tiếng Việt, bỏ Dự án chưa có Người phụ trách', () => {
    expect(cacNguoiPhuTrach(DS)).toEqual([AN, BINH])
  })
})
