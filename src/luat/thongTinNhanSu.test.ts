import { kiemTra, suaHoSoSchema, type VaiHeThong } from './taiKhoan'
import {
  THONG_BAO_NHAN_SU,
  THONG_TIN_NHAN_SU_TRONG,
  apQuyenXemNhanSu,
  chuanHoaSoDienThoai,
  duocXemThongTinNhanSu,
} from './thongTinNhanSu'

describe('luật Số điện thoại', () => {
  it.each([
    ['0901 234 567', '0901234567'],
    ['0901.234.567', '0901234567'],
    ['0901-234-567', '0901234567'],
    ['  0901234567 ', '0901234567'],
    ['+84901234567', '+84901234567'],
    ['+84 901.234-567', '+84901234567'],
  ])('nhận "%s" và lưu dạng chuẩn hoá "%s"', (nhap, luu) => {
    expect(chuanHoaSoDienThoai(nhap)).toBe(luu)
    expect(kiemTra(suaHoSoSchema, { soDienThoai: nhap })).toEqual({ ok: true, giaTri: { soDienThoai: luu } })
  })

  it.each([
    ['090123456', '9 chữ số'],
    ['09012345678', '11 chữ số bắt đầu bằng 0'],
    ['0901 234 56a', 'có chữ cái'],
    ['abcdefghij', 'toàn chữ cái'],
    ['1901234567', '10 chữ số không bắt đầu bằng 0'],
    ['+8490123456', '+84 và 8 chữ số'],
    ['+849012345678', '+84 và 10 chữ số'],
    ['84901234567', '84 thiếu dấu +'],
    ['(090) 1234567', 'có ngoặc'],
  ])('từ chối "%s" (%s) với thông báo tiếng Việt', (sai) => {
    expect(chuanHoaSoDienThoai(sai)).toBeNull()
    expect(kiemTra(suaHoSoSchema, { soDienThoai: sai })).toEqual({
      ok: false,
      loiTheoO: { soDienThoai: THONG_BAO_NHAN_SU.soDienThoaiSai },
    })
  })

  it('thông báo giải thích dạng đúng', () => {
    expect(THONG_BAO_NHAN_SU.soDienThoaiSai).toContain('10 chữ số bắt đầu bằng 0')
    expect(THONG_BAO_NHAN_SU.soDienThoaiSai).toContain('+84')
  })

  it('để trống (hay chỉ khoảng trắng, dấu chấm, gạch nối) là xoá', () => {
    for (const trong of ['', '   ', ' . - '])
      expect(kiemTra(suaHoSoSchema, { soDienThoai: trong })).toEqual({ ok: true, giaTri: { soDienThoai: null } })
  })
})

describe('luật Chức danh và Phòng ban', () => {
  it('tối đa 60 ký tự sau khi cắt khoảng trắng hai đầu; trống là xoá', () => {
    expect(kiemTra(suaHoSoSchema, { chucDanh: `  ${'C'.repeat(60)}  `, phongBan: 'P'.repeat(60) })).toEqual({
      ok: true,
      giaTri: { chucDanh: 'C'.repeat(60), phongBan: 'P'.repeat(60) },
    })
    expect(kiemTra(suaHoSoSchema, { chucDanh: '  ', phongBan: '' })).toEqual({
      ok: true,
      giaTri: { chucDanh: null, phongBan: null },
    })
  })

  it('dài hơn 60 ký tự bị từ chối với thông báo tiếng Việt ở đúng ô', () => {
    expect(kiemTra(suaHoSoSchema, { chucDanh: 'C'.repeat(61), phongBan: 'P'.repeat(61) })).toEqual({
      ok: false,
      loiTheoO: { chucDanh: THONG_BAO_NHAN_SU.chucDanhQuaDai, phongBan: THONG_BAO_NHAN_SU.phongBanQuaDai },
    })
    expect(THONG_BAO_NHAN_SU.chucDanhQuaDai).toBe('Chức danh tối đa 60 ký tự.')
    expect(THONG_BAO_NHAN_SU.phongBanQuaDai).toBe('Phòng ban tối đa 60 ký tự.')
  })
})

describe('luật quyền xem Thông tin nhân sự', () => {
  // Người gọi "goi" ở các Dự án A (đang hoạt động) và L (đã Lưu trữ: trạng thái không ảnh hưởng, chỉ tính có ở trong).
  type Ca = [string, VaiHeThong, string, string[], boolean]
  // prettier-ignore
  const CA: Ca[] = [
    // mô tả                                        vai người gọi  chủ hồ sơ  Dự án của chủ hồ sơ  thấy
    ['chính chủ, Thành viên, không ở Dự án nào',     'THANH_VIEN',  'goi',     [],                   true],
    ['PM, không cùng Dự án nào',                     'PM',          'khac',    ['X'],                true],
    ['PM, người kia không ở Dự án nào',              'PM',          'khac',    [],                   true],
    ['Support, không cùng Dự án nào',                'SUPPORT',     'khac',    ['X'],                true],
    ['Thành viên, cùng Dự án đang hoạt động',        'THANH_VIEN',  'khac',    ['X', 'A'],           true],
    ['Thành viên, cùng Dự án đã Lưu trữ',            'THANH_VIEN',  'khac',    ['L'],                true],
    ['Thành viên, không cùng Dự án nào',             'THANH_VIEN',  'khac',    ['X', 'Y'],           false],
    ['Thành viên, người kia không ở Dự án nào',      'THANH_VIEN',  'khac',    [],                   false],
  ]

  it.each(CA)('%s', (_moTa, vaiNguoiGoi, chuHoSoId, duAnCuaChuHoSo, thay) => {
    expect(
      duocXemThongTinNhanSu({
        nguoiGoiId: 'goi',
        vaiNguoiGoi,
        chuHoSoId,
        duAnCuaNguoiGoi: chuHoSoId === 'goi' ? [] : ['A', 'L'],
        duAnCuaChuHoSo,
      }),
    ).toBe(thay)
  })

  it('không đủ quyền thì ba trường về trống, các trường khác không đổi', () => {
    const nguoi = {
      id: 'b',
      email: 'b@vi-du.vn',
      tenHienThi: 'Bình',
      vai: 'THANH_VIEN' as const,
      soDienThoai: '0901234567',
      chucDanh: 'Kỹ sư',
      phongBan: 'Kỹ thuật',
    }
    expect(apQuyenXemNhanSu(nguoi, true)).toEqual(nguoi)
    expect(apQuyenXemNhanSu(nguoi, false)).toEqual({
      id: 'b',
      email: 'b@vi-du.vn',
      tenHienThi: 'Bình',
      vai: 'THANH_VIEN',
      ...THONG_TIN_NHAN_SU_TRONG,
    })
    // Không đụng vào đối tượng gốc.
    expect(nguoi.soDienThoai).toBe('0901234567')
  })
})
