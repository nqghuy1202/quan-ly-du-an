import {
  CAC_TRANG_THAI_DU_AN,
  DO_DAI_TEN_DU_AN_TOI_DA,
  THONG_BAO_DU_AN,
  dauVetMoi,
  dauVetSauSua,
  dinhDangNgayGio,
  duocQuanLyDuAn,
  duocTaoDuAn,
  duocXemDuAn,
  duocXemMoiDuAn,
  kiemGhiDuAn,
  kiemMoLaiDuAn,
  kiemTraDuAn,
  lyDoKhongSuaDuAn,
  xepDuAn,
} from './duAn'
import { CAC_VAI, THONG_BAO, type VaiHeThong } from './taiKhoan'

describe('ngày giờ theo múi giờ Việt Nam', () => {
  it('hiện giờ Việt Nam (UTC+7) dù mốc được cho theo giờ UTC', () => {
    expect(dinhDangNgayGio(new Date('2026-04-10T02:30:00Z'))).toBe('10/04/2026 09:30')
  })

  it('qua nửa đêm ở Việt Nam thì sang ngày hôm sau', () => {
    expect(dinhDangNgayGio(new Date('2026-12-31T17:05:00Z'))).toBe('01/01/2027 00:05')
  })

  it('mốc cho theo giờ Việt Nam hiện đúng như vậy', () => {
    expect(dinhDangNgayGio(new Date('2026-03-01T08:00:00+07:00'))).toBe('01/03/2026 08:00')
  })
})

describe('kiểm dữ liệu Dự án ở ranh giới', () => {
  it('tên bỏ khoảng trắng hai đầu; mô tả thiếu thì là chuỗi rỗng', () => {
    expect(kiemTraDuAn.tao({ ten: '  Dự án A  ' })).toEqual({ ok: true, giaTri: { ten: 'Dự án A', moTa: '' } })
  })

  it('tên đúng 120 ký tự được, 121 ký tự thì không', () => {
    expect(kiemTraDuAn.tao({ ten: 'x'.repeat(DO_DAI_TEN_DU_AN_TOI_DA) }).ok).toBe(true)
    expect(kiemTraDuAn.tao({ ten: 'x'.repeat(DO_DAI_TEN_DU_AN_TOI_DA + 1) })).toEqual({
      ok: false,
      loiTheoO: { ten: THONG_BAO_DU_AN.tenQuaDai },
    })
  })

  it.each(['', '   ', '\t\n'])('tên "%s" bị từ chối vì rỗng', (ten) => {
    expect(kiemTraDuAn.tao({ ten })).toEqual({ ok: false, loiTheoO: { ten: THONG_BAO_DU_AN.tenTrong } })
  })

  it('tên tiếng Việt viết dạng tổ hợp được chuẩn hoá trước khi đếm ký tự', () => {
    // "ệ" viết bằng chữ e + hai dấu tổ hợp: 3 đơn vị mã, sau chuẩn hoá còn 1 ký tự.
    const ten = 'ệ'.repeat(DO_DAI_TEN_DU_AN_TOI_DA)
    const kq = kiemTraDuAn.tao({ ten })
    expect(kq.ok).toBe(true)
    if (kq.ok) expect(kq.giaTri.ten).toBe('ệ'.repeat(DO_DAI_TEN_DU_AN_TOI_DA))
  })

  it('sửa chỉ gửi mô tả thì không đụng tới tên', () => {
    expect(kiemTraDuAn.sua({ moTa: ' Mới ' })).toEqual({ ok: true, giaTri: { moTa: 'Mới' } })
  })
})

describe('quyền và Lưu trữ', () => {
  const trong = (vaiNguoiGoi: VaiHeThong) => ({ vaiNguoiGoi, laNguoiTrongDuAn: true })
  const ngoai = (vaiNguoiGoi: VaiHeThong) => ({ vaiNguoiGoi, laNguoiTrongDuAn: false })

  it('chỉ PM tạo Dự án và thấy mọi Dự án', () => {
    expect(CAC_VAI.filter(duocTaoDuAn)).toEqual(['PM'])
    expect(CAC_VAI.filter(duocXemMoiDuAn)).toEqual(['PM'])
  })

  it('xem: PM thấy mọi Dự án; người khác chỉ Dự án mình ở trong', () => {
    expect(CAC_VAI.filter((vai) => duocXemDuAn(trong(vai)))).toEqual(['PM', 'SUPPORT', 'THANH_VIEN'])
    expect(CAC_VAI.filter((vai) => duocXemDuAn(ngoai(vai)))).toEqual(['PM'])
  })

  it('quản lý: PM ở mọi Dự án; Support chỉ Dự án mình ở trong; Thành viên không', () => {
    expect(CAC_VAI.filter((vai) => duocQuanLyDuAn(trong(vai)))).toEqual(['PM', 'SUPPORT'])
    expect(CAC_VAI.filter((vai) => duocQuanLyDuAn(ngoai(vai)))).toEqual(['PM'])
  })

  it('ghi lên Dự án: không quản lý được thì không có quyền (trước cả trạng thái); đã Lưu trữ thì bị từ chối', () => {
    for (const nguoiGoi of [trong('PM'), ngoai('PM'), trong('SUPPORT')]) {
      expect(kiemGhiDuAn({ ...nguoiGoi, trangThai: 'HOAT_DONG' })).toBeNull()
      expect(kiemGhiDuAn({ ...nguoiGoi, trangThai: 'LUU_TRU' })).toBe('DU_AN_DA_LUU_TRU')
    }
    for (const trangThai of CAC_TRANG_THAI_DU_AN) {
      for (const nguoiGoi of [ngoai('SUPPORT'), trong('THANH_VIEN'), ngoai('THANH_VIEN')]) {
        expect(kiemGhiDuAn({ ...nguoiGoi, trangThai })).toBe('KHONG_CO_QUYEN')
      }
    }
  })

  it('mở lại: người quản lý được, chỉ Dự án đang Lưu trữ', () => {
    expect(kiemMoLaiDuAn({ ...ngoai('PM'), trangThai: 'LUU_TRU' })).toBeNull()
    expect(kiemMoLaiDuAn({ ...trong('SUPPORT'), trangThai: 'LUU_TRU' })).toBeNull()
    expect(kiemMoLaiDuAn({ ...ngoai('PM'), trangThai: 'HOAT_DONG' })).toBe('DU_AN_DANG_HOAT_DONG')
    expect(kiemMoLaiDuAn({ ...ngoai('SUPPORT'), trangThai: 'LUU_TRU' })).toBe('KHONG_CO_QUYEN')
    expect(kiemMoLaiDuAn({ ...trong('THANH_VIEN'), trangThai: 'LUU_TRU' })).toBe('KHONG_CO_QUYEN')
  })

  it('lý do tiếng Việt cho giao diện khi nút ghi bị ẩn', () => {
    expect(lyDoKhongSuaDuAn({ ...ngoai('PM'), trangThai: 'HOAT_DONG' })).toBeNull()
    expect(lyDoKhongSuaDuAn({ ...trong('SUPPORT'), trangThai: 'HOAT_DONG' })).toBeNull()
    expect(lyDoKhongSuaDuAn({ ...ngoai('PM'), trangThai: 'LUU_TRU' })).toBe(THONG_BAO_DU_AN.daLuuTru)
    expect(lyDoKhongSuaDuAn({ ...trong('THANH_VIEN'), trangThai: 'HOAT_DONG' })).toBe(THONG_BAO_DU_AN.khongQuanLy)
    expect(lyDoKhongSuaDuAn({ ...ngoai('SUPPORT'), trangThai: 'LUU_TRU' })).toBe(THONG_BAO_DU_AN.khongQuanLy)
  })
})

describe('thêm người vào Dự án: kiểm email ở ranh giới', () => {
  it('bỏ khoảng trắng và chuyển chữ thường', () => {
    expect(kiemTraDuAn.themNguoi({ email: '  An@Vi-Du.VN ' })).toEqual({ ok: true, giaTri: { email: 'an@vi-du.vn' } })
  })

  it.each(['', 'khong-phai-email', 'a@'])('email "%s" bị từ chối', (email) => {
    expect(kiemTraDuAn.themNguoi({ email })).toEqual({ ok: false, loiTheoO: { email: THONG_BAO.emailSai } })
  })
})

describe('dấu vết', () => {
  const TAO = new Date('2026-04-10T09:00:00+07:00')
  const SUA = new Date('2026-04-11T10:00:00+07:00')

  it('bản ghi mới có người và ngày tạo, chưa có phần chỉnh sửa', () => {
    expect(dauVetMoi('an', TAO)).toEqual({ taoBoi: 'an', taoLuc: TAO, suaBoi: null, suaLuc: null })
  })

  it('sau khi sửa: cập nhật người và ngày chỉnh sửa, giữ người và ngày tạo', () => {
    const sua = dauVetSauSua(dauVetMoi('an', TAO), 'binh', SUA)
    expect(sua).toEqual({ taoBoi: 'an', taoLuc: TAO, suaBoi: 'binh', suaLuc: SUA })
  })

  it('không giữ tham chiếu tới đồng hồ truyền vào', () => {
    const moc = new Date(TAO.getTime())
    const dauVet = dauVetMoi('an', moc)
    moc.setFullYear(2000)
    expect(dauVet.taoLuc).toEqual(TAO)
  })
})

describe('xếp Dự án', () => {
  it('mới tạo trước; cùng lúc thì theo tên', () => {
    const cu = { ten: 'Cũ', dauVet: { taoLuc: new Date('2026-01-01T00:00:00Z') } }
    const moiB = { ten: 'Bê', dauVet: { taoLuc: new Date('2026-02-01T00:00:00Z') } }
    const moiA = { ten: 'An', dauVet: { taoLuc: new Date('2026-02-01T00:00:00Z') } }
    expect(xepDuAn([cu, moiB, moiA]).map((d) => d.ten)).toEqual(['An', 'Bê', 'Cũ'])
  })
})
