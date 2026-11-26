import {
  CAC_TRANG_THAI_DU_AN,
  DO_DAI_KHACH_HANG_TOI_DA,
  DO_DAI_TEN_DU_AN_TOI_DA,
  DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA,
  chuanHoaMaDuAn,
  maDuAnBiTrung,
  tenKemMa,
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
  kiemNgayDuAn,
  kiemNguoiPhuTrach,
  kiemSuaVaiTroTrongDuAn,
  kiemTraDuAn,
  lyDoKhongSuaDuAn,
  ngayDuAnSauSua,
  xepDuAn,
} from './duAn'
import { CAC_MUC_UU_TIEN, MUC_UU_TIEN_MAC_DINH, TEN_MUC_UU_TIEN, THONG_BAO_MUC_UU_TIEN, laMucUuTien } from './mucUuTien'
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
  it('tên bỏ khoảng trắng hai đầu; mô tả thiếu thì là chuỗi rỗng; Mức ưu tiên thiếu thì là Trung bình', () => {
    expect(kiemTraDuAn.tao({ ma: 'DA-1', ten: '  Dự án A  ' })).toEqual({
      ok: true,
      giaTri: {
        ma: 'DA-1',
        ten: 'Dự án A',
        moTa: '',
        khachHang: '',
        ngayBatDau: null,
        ngayKetThucDuKien: null,
        mucUuTien: 'TRUNG_BINH',
      },
    })
  })

  it('tên đúng 120 ký tự được, 121 ký tự thì không', () => {
    expect(kiemTraDuAn.tao({ ma: 'DA-1', ten: 'x'.repeat(DO_DAI_TEN_DU_AN_TOI_DA) }).ok).toBe(true)
    expect(kiemTraDuAn.tao({ ma: 'DA-1', ten: 'x'.repeat(DO_DAI_TEN_DU_AN_TOI_DA + 1) })).toEqual({
      ok: false,
      loiTheoO: { ten: THONG_BAO_DU_AN.tenQuaDai },
    })
  })

  it.each(['', '   ', '\t\n'])('tên "%s" bị từ chối vì rỗng', (ten) => {
    expect(kiemTraDuAn.tao({ ma: 'DA-1', ten })).toEqual({ ok: false, loiTheoO: { ten: THONG_BAO_DU_AN.tenTrong } })
  })

  it('tên tiếng Việt viết dạng tổ hợp được chuẩn hoá trước khi đếm ký tự', () => {
    // "ệ" viết bằng chữ e + hai dấu tổ hợp: 3 đơn vị mã, sau chuẩn hoá còn 1 ký tự.
    const ten = 'ệ'.repeat(DO_DAI_TEN_DU_AN_TOI_DA)
    const kq = kiemTraDuAn.tao({ ma: 'DA-1', ten })
    expect(kq.ok).toBe(true)
    if (kq.ok) expect(kq.giaTri.ten).toBe('ệ'.repeat(DO_DAI_TEN_DU_AN_TOI_DA))
  })

  it('sửa chỉ gửi mô tả thì không đụng tới tên', () => {
    expect(kiemTraDuAn.sua({ moTa: ' Mới ' })).toEqual({ ok: true, giaTri: { moTa: 'Mới' } })
  })
})

describe('Mã Dự án và Khách hàng', () => {
  const tao = (ma: unknown, khachHang?: unknown) =>
    kiemTraDuAn.tao({ ma, ten: 'Dự án', ...(khachHang === undefined ? {} : { khachHang }) })

  it('nhận "sdv-012": cắt khoảng trắng và chuẩn hoá thành SDV-012', () => {
    const kq = tao('  sdv-012 ')
    expect(kq.ok).toBe(true)
    if (kq.ok) expect(kq.giaTri.ma).toBe('SDV-012')
  })

  it.each(['AB', 'A1', '12', 'ABCDEFGHIJKL', 'sdv-2026-001'])('nhận mã đúng dạng "%s" (2 đến 12 ký tự)', (ma) => {
    const kq = tao(ma)
    expect(kq.ok).toBe(true)
    if (kq.ok) expect(kq.giaTri.ma).toBe(ma.toUpperCase())
  })

  it.each([
    { ca: '1 ký tự', ma: 'A' },
    { ca: '13 ký tự', ma: 'ABCDEFGHIJKLM' },
    { ca: 'có dấu cách ở giữa', ma: 'SDV 012' },
    { ca: 'có chữ có dấu', ma: 'ĐỨC-01' },
    { ca: 'có chữ có dấu viết thường', ma: 'dự-án' },
    { ca: 'có ký tự khác gạch nối', ma: 'SDV_012' },
  ])('từ chối mã $ca với thông báo tiếng Việt nêu dạng đúng', ({ ma }) => {
    const kq = tao(ma)
    expect(kq).toEqual({ ok: false, loiTheoO: { ma: THONG_BAO_DU_AN.maSai } })
    expect(THONG_BAO_DU_AN.maSai).toMatch(/2 đến 12 ký tự/)
    expect(THONG_BAO_DU_AN.maSai).toMatch(/chữ in hoa không dấu/)
    expect(THONG_BAO_DU_AN.maSai).toMatch(/chữ số/)
    expect(THONG_BAO_DU_AN.maSai).toMatch(/gạch nối/)
  })

  it.each([undefined, '', '   '])('tạo thiếu Mã (%j) bị từ chối vì để trống', (ma) => {
    const kq = kiemTraDuAn.tao(ma === undefined ? { ten: 'Dự án' } : { ma, ten: 'Dự án' })
    expect(kq).toEqual({ ok: false, loiTheoO: { ma: THONG_BAO_DU_AN.maTrong } })
  })

  it('sửa không gửi Mã thì giữ nguyên; gửi Mã thì cũng được chuẩn hoá và kiểm dạng', () => {
    expect(kiemTraDuAn.sua({ ten: 'Mới' })).toEqual({ ok: true, giaTri: { ten: 'Mới' } })
    expect(kiemTraDuAn.sua({ ma: ' kh-9 ' })).toEqual({ ok: true, giaTri: { ma: 'KH-9' } })
    expect(kiemTraDuAn.sua({ ma: 'A' })).toEqual({ ok: false, loiTheoO: { ma: THONG_BAO_DU_AN.maSai } })
  })

  it('Khách hàng tuỳ chọn: thiếu thì là chuỗi rỗng, bỏ khoảng trắng hai đầu', () => {
    const thieu = tao('DA-1')
    expect(thieu.ok && thieu.giaTri.khachHang).toBe('')
    const co = tao('DA-1', '  Công ty An Phát ')
    expect(co.ok && co.giaTri.khachHang).toBe('Công ty An Phát')
    expect(kiemTraDuAn.sua({ khachHang: '   ' })).toEqual({ ok: true, giaTri: { khachHang: '' } })
  })

  it('Khách hàng đúng 120 ký tự được, 121 ký tự bị từ chối (khi tạo và khi sửa)', () => {
    expect(tao('DA-1', 'k'.repeat(DO_DAI_KHACH_HANG_TOI_DA)).ok).toBe(true)
    const quaDai = { ok: false, loiTheoO: { khachHang: THONG_BAO_DU_AN.khachHangQuaDai } }
    expect(tao('DA-1', 'k'.repeat(DO_DAI_KHACH_HANG_TOI_DA + 1))).toEqual(quaDai)
    expect(kiemTraDuAn.sua({ khachHang: 'k'.repeat(DO_DAI_KHACH_HANG_TOI_DA + 1) })).toEqual(quaDai)
  })

  it('so trùng Mã không phân biệt hoa thường; Mã của chính Dự án đang sửa không bị coi là trùng', () => {
    const cacDuAn = [
      { id: 'a', ma: 'SDV-012' },
      { id: 'b', ma: 'KH-1' },
    ]
    expect(chuanHoaMaDuAn(' sdv-012 ')).toBe('SDV-012')
    expect(maDuAnBiTrung('sdv-012', cacDuAn)).toBe(true)
    expect(maDuAnBiTrung('SDV-013', cacDuAn)).toBe(false)
    expect(maDuAnBiTrung('sdv-012', cacDuAn, 'a')).toBe(false)
    expect(maDuAnBiTrung('kh-1', cacDuAn, 'a')).toBe(true)
  })

  it('tên kèm Mã đứng trước', () => {
    expect(tenKemMa({ ma: 'SDV-012', ten: 'Cửa hàng' })).toBe('SDV-012 · Cửa hàng')
    expect(tenKemMa({ ma: '', ten: 'Cửa hàng' })).toBe('Cửa hàng')
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
  it('bỏ khoảng trắng và chuyển chữ thường; không gửi Vai trò trong Dự án thì không có vai trò', () => {
    expect(kiemTraDuAn.themNguoi({ email: '  An@Vi-Du.VN ' })).toEqual({
      ok: true,
      giaTri: { email: 'an@vi-du.vn', vaiTroTrongDuAn: null },
    })
  })

  it.each(['', 'khong-phai-email', 'a@'])('email "%s" bị từ chối', (email) => {
    expect(kiemTraDuAn.themNguoi({ email })).toEqual({ ok: false, loiTheoO: { email: THONG_BAO.emailSai } })
  })

  it('thêm kèm Vai trò trong Dự án: cắt khoảng trắng hai đầu; trống hay chỉ khoảng trắng là không có', () => {
    expect(kiemTraDuAn.themNguoi({ email: 'an@vi-du.vn', vaiTroTrongDuAn: '  Trưởng nhóm ' })).toEqual({
      ok: true,
      giaTri: { email: 'an@vi-du.vn', vaiTroTrongDuAn: 'Trưởng nhóm' },
    })
    for (const trong of ['', '   ', null]) {
      expect(kiemTraDuAn.themNguoi({ email: 'an@vi-du.vn', vaiTroTrongDuAn: trong })).toEqual({
        ok: true,
        giaTri: { email: 'an@vi-du.vn', vaiTroTrongDuAn: null },
      })
    }
  })

  it('Vai trò trong Dự án dài hơn 60 ký tự bị từ chối kèm lỗi ở ô đó, cùng lỗi email nếu có', () => {
    expect(kiemTraDuAn.themNguoi({ email: 'sai', vaiTroTrongDuAn: 'V'.repeat(61) })).toEqual({
      ok: false,
      loiTheoO: { email: THONG_BAO.emailSai, vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroQuaDai },
    })
  })
})

describe('Vai trò trong Dự án', () => {
  const trong = (vaiNguoiGoi: VaiHeThong) => ({ vaiNguoiGoi, laNguoiTrongDuAn: true })
  const ngoai = (vaiNguoiGoi: VaiHeThong) => ({ vaiNguoiGoi, laNguoiTrongDuAn: false })

  it('tối đa 60 ký tự sau khi cắt khoảng trắng hai đầu: đúng 60 thì được, 61 thì bị từ chối', () => {
    expect(DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA).toBe(60)
    const vuaDu = 'V'.repeat(60)
    expect(kiemTraDuAn.suaVaiTro({ vaiTroTrongDuAn: `  ${vuaDu}  ` })).toEqual({
      ok: true,
      giaTri: { vaiTroTrongDuAn: vuaDu },
    })
    expect(kiemTraDuAn.suaVaiTro({ vaiTroTrongDuAn: 'V'.repeat(61) })).toEqual({
      ok: false,
      loiTheoO: { vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroQuaDai },
    })
  })

  it('sửa về trống, chỉ khoảng trắng hay null là xoá vai trò; thiếu ô hay sai kiểu bị từ chối', () => {
    for (const xoa of ['', '  ', null]) {
      expect(kiemTraDuAn.suaVaiTro({ vaiTroTrongDuAn: xoa })).toEqual({ ok: true, giaTri: { vaiTroTrongDuAn: null } })
    }
    expect(kiemTraDuAn.suaVaiTro({})).toEqual({ ok: false, loiTheoO: { vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroSai } })
    expect(kiemTraDuAn.suaVaiTro({ vaiTroTrongDuAn: 12 })).toEqual({
      ok: false,
      loiTheoO: { vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroSai },
    })
  })

  it('quyền sửa: PM ở mọi Dự án và Support của Dự án; Thành viên, Support ngoài Dự án bị từ chối; Lưu trữ bị từ chối', () => {
    for (const nguoiGoi of [trong('PM'), ngoai('PM'), trong('SUPPORT')]) {
      expect(kiemSuaVaiTroTrongDuAn({ ...nguoiGoi, trangThai: 'HOAT_DONG' })).toBeNull()
      expect(kiemSuaVaiTroTrongDuAn({ ...nguoiGoi, trangThai: 'LUU_TRU' })).toBe('DU_AN_DA_LUU_TRU')
    }
    for (const trangThai of CAC_TRANG_THAI_DU_AN) {
      for (const nguoiGoi of [ngoai('SUPPORT'), trong('THANH_VIEN'), ngoai('THANH_VIEN')]) {
        expect(kiemSuaVaiTroTrongDuAn({ ...nguoiGoi, trangThai })).toBe('KHONG_CO_QUYEN')
      }
    }
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

describe('ngày của Dự án', () => {
  const tao = (ngay: { ngayBatDau?: unknown; ngayKetThucDuKien?: unknown }) =>
    kiemTraDuAn.tao({ ma: 'DA-1', ten: 'Dự án', ...ngay })
  const ngayCua = (kq: ReturnType<typeof tao>) =>
    kq.ok ? { ngayBatDau: kq.giaTri.ngayBatDau, ngayKetThucDuKien: kq.giaTri.ngayKetThucDuKien } : kq

  it('Ngày kết thúc dự kiến trước Ngày bắt đầu bị từ chối với thông báo tiếng Việt ở ô Ngày kết thúc dự kiến', () => {
    expect(tao({ ngayBatDau: '2026-12-10', ngayKetThucDuKien: '2026-12-09' })).toEqual({
      ok: false,
      loiTheoO: { ngayKetThucDuKien: THONG_BAO_DU_AN.ngayKetThucTruocBatDau },
    })
    expect(THONG_BAO_DU_AN.ngayKetThucTruocBatDau).toBe('Ngày kết thúc dự kiến không được trước Ngày bắt đầu.')
    expect(kiemTraDuAn.sua({ ngayBatDau: '2027-01-01', ngayKetThucDuKien: '2026-12-31' })).toEqual({
      ok: false,
      loiTheoO: { ngayKetThucDuKien: THONG_BAO_DU_AN.ngayKetThucTruocBatDau },
    })
  })

  it('hai ngày bằng nhau thì hợp lệ', () => {
    expect(ngayCua(tao({ ngayBatDau: '2026-12-10', ngayKetThucDuKien: '2026-12-10' }))).toEqual({
      ngayBatDau: '2026-12-10',
      ngayKetThucDuKien: '2026-12-10',
    })
  })

  it('chỉ có một trong hai ngày thì hợp lệ; không có ngày nào thì cả hai là null', () => {
    expect(ngayCua(tao({ ngayBatDau: '2026-12-10' }))).toEqual({ ngayBatDau: '2026-12-10', ngayKetThucDuKien: null })
    expect(ngayCua(tao({ ngayKetThucDuKien: '2026-01-01' }))).toEqual({ ngayBatDau: null, ngayKetThucDuKien: '2026-01-01' })
    expect(ngayCua(tao({ ngayBatDau: '', ngayKetThucDuKien: null }))).toEqual({ ngayBatDau: null, ngayKetThucDuKien: null })
    expect(ngayCua(tao({}))).toEqual({ ngayBatDau: null, ngayKetThucDuKien: null })
  })

  it('cắt khoảng trắng; ngày đã qua vẫn nhận', () => {
    expect(ngayCua(tao({ ngayBatDau: ' 2020-02-29 ' }))).toEqual({ ngayBatDau: '2020-02-29', ngayKetThucDuKien: null })
  })

  it.each([
    { ca: 'ngày không có thật', ngay: '2026-02-30' },
    { ca: 'sai dạng ngày/tháng/năm', ngay: '10/12/2026' },
    { ca: 'có giờ', ngay: '2026-12-10T08:00' },
    { ca: 'không phải chuỗi', ngay: 20261210 },
  ])('$ca bị từ chối ở đúng ô với thông báo tiếng Việt', ({ ngay }) => {
    expect(tao({ ngayBatDau: ngay })).toEqual({ ok: false, loiTheoO: { ngayBatDau: THONG_BAO_DU_AN.ngayBatDauSai } })
    expect(tao({ ngayKetThucDuKien: ngay })).toEqual({
      ok: false,
      loiTheoO: { ngayKetThucDuKien: THONG_BAO_DU_AN.ngayKetThucSai },
    })
  })

  it('sửa: ngày không gửi thì giữ nguyên; gửi trống hay null là xoá ngày đó', () => {
    expect(kiemTraDuAn.sua({ ten: 'Mới' })).toEqual({ ok: true, giaTri: { ten: 'Mới' } })
    expect(kiemTraDuAn.sua({ ngayBatDau: '', ngayKetThucDuKien: null })).toEqual({
      ok: true,
      giaTri: { ngayBatDau: null, ngayKetThucDuKien: null },
    })
  })

  it('kiemNgayDuAn: chỉ từ chối khi có cả hai và kết thúc trước bắt đầu', () => {
    expect(kiemNgayDuAn({ ngayBatDau: '2026-12-10', ngayKetThucDuKien: '2026-12-09' })).toEqual({
      ngayKetThucDuKien: THONG_BAO_DU_AN.ngayKetThucTruocBatDau,
    })
    expect(kiemNgayDuAn({ ngayBatDau: '2026-12-10', ngayKetThucDuKien: '2026-12-10' })).toBeNull()
    expect(kiemNgayDuAn({ ngayBatDau: '2026-12-10', ngayKetThucDuKien: null })).toBeNull()
    expect(kiemNgayDuAn({ ngayBatDau: null, ngayKetThucDuKien: '2026-12-09' })).toBeNull()
  })

  it('ngày sau khi sửa ghép với ngày đang lưu rồi mới kiểm; lỗi nằm ở ô vừa gửi', () => {
    const dangLuu = { ngayBatDau: '2026-12-01', ngayKetThucDuKien: '2026-12-31' }
    expect(ngayDuAnSauSua(dangLuu, { ngayKetThucDuKien: '2026-11-30' })).toEqual({
      ok: false,
      loiTheoO: { ngayKetThucDuKien: THONG_BAO_DU_AN.ngayKetThucTruocBatDau },
    })
    expect(ngayDuAnSauSua(dangLuu, { ngayBatDau: '2027-01-01' })).toEqual({
      ok: false,
      loiTheoO: { ngayBatDau: THONG_BAO_DU_AN.ngayKetThucTruocBatDau },
    })
    expect(ngayDuAnSauSua(dangLuu, { ngayBatDau: '2026-12-31' })).toEqual({
      ok: true,
      ngay: { ngayBatDau: '2026-12-31', ngayKetThucDuKien: '2026-12-31' },
    })
    expect(ngayDuAnSauSua(dangLuu, { ngayBatDau: null })).toEqual({
      ok: true,
      ngay: { ngayBatDau: null, ngayKetThucDuKien: '2026-12-31' },
    })
    expect(ngayDuAnSauSua(dangLuu, {})).toEqual({ ok: true, ngay: dangLuu })
  })
})

describe('Mức ưu tiên của Dự án', () => {
  it('ba mức Thấp, Trung bình, Cao với nhãn tiếng Việt; mặc định Trung bình', () => {
    expect(CAC_MUC_UU_TIEN.map((muc) => TEN_MUC_UU_TIEN[muc])).toEqual(['Thấp', 'Trung bình', 'Cao'])
    expect(MUC_UU_TIEN_MAC_DINH).toBe('TRUNG_BINH')
    expect(laMucUuTien('CAO')).toBe(true)
    expect(laMucUuTien('KHAN_CAP')).toBe(false)
    expect(laMucUuTien(null)).toBe(false)
  })

  it.each(CAC_MUC_UU_TIEN)('tạo và sửa nhận mức %s', (mucUuTien) => {
    const tao = kiemTraDuAn.tao({ ma: 'DA-1', ten: 'Dự án', mucUuTien })
    expect(tao.ok && tao.giaTri.mucUuTien).toBe(mucUuTien)
    expect(kiemTraDuAn.sua({ mucUuTien })).toEqual({ ok: true, giaTri: { mucUuTien } })
  })

  it.each(['KHAN_CAP', 'cao', 'Cao', '', null, 3])('mức "%s" ngoài ba giá trị bị từ chối ở ô Mức ưu tiên', (mucUuTien) => {
    const loi = { ok: false, loiTheoO: { mucUuTien: THONG_BAO_MUC_UU_TIEN.sai } }
    expect(kiemTraDuAn.tao({ ma: 'DA-1', ten: 'Dự án', mucUuTien })).toEqual(loi)
    expect(kiemTraDuAn.sua({ mucUuTien })).toEqual(loi)
  })
})

describe('Người phụ trách', () => {
  const trongDuAn = new Set(['an', 'binh'])
  const laNguoiTrong = (id: string) => trongDuAn.has(id)

  it('trống luôn được; Người trong dự án được; người ngoài Dự án bị từ chối ở ô Người phụ trách', () => {
    expect(kiemNguoiPhuTrach(null, laNguoiTrong)).toBeNull()
    expect(kiemNguoiPhuTrach('an', laNguoiTrong)).toBeNull()
    expect(kiemNguoiPhuTrach('chi', laNguoiTrong)).toEqual({ nguoiPhuTrachId: THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn })
  })

  it('sửa gửi trống hay null là bỏ Người phụ trách; không gửi thì giữ nguyên; id bỏ khoảng trắng', () => {
    expect(kiemTraDuAn.sua({ nguoiPhuTrachId: '' })).toEqual({ ok: true, giaTri: { nguoiPhuTrachId: null } })
    expect(kiemTraDuAn.sua({ nguoiPhuTrachId: null })).toEqual({ ok: true, giaTri: { nguoiPhuTrachId: null } })
    expect(kiemTraDuAn.sua({ nguoiPhuTrachId: ' an ' })).toEqual({ ok: true, giaTri: { nguoiPhuTrachId: 'an' } })
    expect(kiemTraDuAn.sua({ ten: 'Mới' })).toEqual({ ok: true, giaTri: { ten: 'Mới' } })
    expect(kiemTraDuAn.sua({ nguoiPhuTrachId: 12 })).toEqual({
      ok: false,
      loiTheoO: { nguoiPhuTrachId: THONG_BAO_DU_AN.nguoiPhuTrachSai },
    })
  })
})
