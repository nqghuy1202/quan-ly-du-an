import { describe, expect, it } from 'vitest'
import { CAC_VAI, type VaiHeThong } from './taiKhoan'
import { TRANG_MO_DAU, duocMoTrang, mucDieuHuong, nhomDieuHuong, trangHienThi, type Trang } from './dieuHuong'

const nhanCua = (vai: VaiHeThong) => mucDieuHuong(vai).map((m) => m.nhan)

describe('mục điều hướng theo vai', () => {
  it('PM thấy đủ bảy mục, gồm Tất cả Dự án và Người dùng, theo thứ tự nhóm', () => {
    expect(nhanCua('PM')).toEqual([
      'Tổng quan',
      'Việc của tôi',
      'Chờ tôi duyệt',
      'Dự án của tôi',
      'Tất cả Dự án',
      'Người dùng',
      'Hồ sơ',
    ])
  })

  it('Support không thấy Tất cả Dự án và Người dùng', () => {
    const nhan = nhanCua('SUPPORT')
    expect(nhan).not.toContain('Tất cả Dự án')
    expect(nhan).not.toContain('Người dùng')
    expect(nhan).toEqual(['Tổng quan', 'Việc của tôi', 'Chờ tôi duyệt', 'Dự án của tôi', 'Hồ sơ'])
  })

  it('Thành viên không thấy Tất cả Dự án và Người dùng', () => {
    const nhan = nhanCua('THANH_VIEN')
    expect(nhan).not.toContain('Tất cả Dự án')
    expect(nhan).not.toContain('Người dùng')
    expect(nhan).toEqual(['Tổng quan', 'Việc của tôi', 'Chờ tôi duyệt', 'Dự án của tôi', 'Hồ sơ'])
  })

  it('mọi vai đều thấy Tổng quan, Việc của tôi, Chờ tôi duyệt, Dự án của tôi và Hồ sơ', () => {
    for (const vai of CAC_VAI) {
      expect(nhanCua(vai)).toEqual(
        expect.arrayContaining(['Tổng quan', 'Việc của tôi', 'Chờ tôi duyệt', 'Dự án của tôi', 'Hồ sơ']),
      )
    }
  })

  it('mỗi trang xuất hiện đúng một lần', () => {
    for (const vai of CAC_VAI) {
      const trang = mucDieuHuong(vai).map((m) => m.trang)
      expect(new Set(trang).size).toBe(trang.length)
    }
  })
})

describe('nhóm trên Thanh bên', () => {
  it('PM: Tổng quan (không tiêu đề), Công việc, Dự án, Quản trị, rồi nhóm tài khoản', () => {
    const nhom = nhomDieuHuong('PM')
    expect(nhom.map((n) => [n.tieuDe, n.muc.map((m) => m.nhan)])).toEqual([
      [null, ['Tổng quan']],
      ['Công việc', ['Việc của tôi', 'Chờ tôi duyệt']],
      ['Dự án', ['Dự án của tôi', 'Tất cả Dự án']],
      ['Quản trị', ['Người dùng']],
      [null, ['Hồ sơ']],
    ])
  })

  it('Support và Thành viên không có nhóm Quản trị', () => {
    for (const vai of ['SUPPORT', 'THANH_VIEN'] as const) {
      expect(nhomDieuHuong(vai).map((n) => n.tieuDe)).not.toContain('Quản trị')
    }
  })

  it('Support và Thành viên: nhóm Dự án chỉ còn Dự án của tôi', () => {
    for (const vai of ['SUPPORT', 'THANH_VIEN'] as const) {
      const duAn = nhomDieuHuong(vai).find((n) => n.tieuDe === 'Dự án')
      expect(duAn?.muc.map((m) => m.nhan)).toEqual(['Dự án của tôi'])
    }
  })
})

describe('trang hiện ra', () => {
  it('trang đầu tiên sau đăng nhập là Tổng quan', () => {
    expect(TRANG_MO_DAU).toBe('tongQuan')
  })

  it('trang được phép thì giữ nguyên', () => {
    expect(trangHienThi('nguoiDung', 'PM')).toBe('nguoiDung')
    expect(trangHienThi('tatCaDuAn', 'PM')).toBe('tatCaDuAn')
  })

  it('trang không còn được phép (bị hạ vai) thì về Tổng quan', () => {
    const cam: Array<[Trang, VaiHeThong]> = [
      ['nguoiDung', 'SUPPORT'],
      ['nguoiDung', 'THANH_VIEN'],
      ['tatCaDuAn', 'SUPPORT'],
      ['tatCaDuAn', 'THANH_VIEN'],
    ]
    for (const [trang, vai] of cam) {
      expect(duocMoTrang(trang, vai)).toBe(false)
      expect(trangHienThi(trang, vai)).toBe('tongQuan')
    }
  })
})
