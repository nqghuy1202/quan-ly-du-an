import {
  THONG_BAO,
  TEN_VAI,
  dangKySchema,
  datLaiMatKhauSchema,
  duocSuaHoSo,
  emailSchema,
  hetHanLuc,
  kiemTra,
  suaHoSoSchema,
  tinhTrangMaDatLai,
} from './taiKhoan'

describe('luật tài khoản', () => {
  it('chuẩn hoá email về chữ thường và bỏ khoảng trắng hai đầu', () => {
    const kq = kiemTra(dangKySchema, { email: '  An@Vi-Du.VN ', matKhau: '12345678', tenHienThi: 'An' })
    expect(kq).toEqual({ ok: true, giaTri: { email: 'an@vi-du.vn', matKhau: '12345678', tenHienThi: 'An' } })
  })

  it('báo lỗi từng ô bằng tiếng Việt', () => {
    const kq = kiemTra(dangKySchema, { email: 'x', matKhau: '1', tenHienThi: '  ' })
    expect(kq).toEqual({
      ok: false,
      loiTheoO: { email: THONG_BAO.emailSai, matKhau: THONG_BAO.matKhauNgan, tenHienThi: THONG_BAO.tenTrong },
    })
  })

  it('thiếu ô cũng báo bằng tiếng Việt', () => {
    const kq = kiemTra(dangKySchema, {})
    expect(kq.ok).toBe(false)
    if (!kq.ok) expect(kq.loiTheoO.email).toBe(THONG_BAO.emailSai)
  })

  it.each(['a', 'octocat', 'lan-tran', 'A1-b2', 'a'.repeat(39)])('chấp nhận GitHub username "%s"', (username) => {
    expect(kiemTra(suaHoSoSchema, { githubUsername: username }).ok).toBe(true)
  })

  it('GitHub username để trống thành null (xoá)', () => {
    expect(kiemTra(suaHoSoSchema, { githubUsername: '' })).toEqual({ ok: true, giaTri: { githubUsername: null } })
  })

  it('chỉ chủ hồ sơ được sửa hồ sơ', () => {
    expect(duocSuaHoSo('a', 'a')).toBe(true)
    expect(duocSuaHoSo('a', 'b')).toBe(false)
  })

  it('tên vai bằng tiếng Việt', () => {
    expect(TEN_VAI.THANH_VIEN).toBe('Thành viên')
  })
})

describe('luật mã đặt lại mật khẩu', () => {
  const LUC_CAP = new Date('2026-03-01T08:00:00+07:00')
  const MUOI_PHUT = 10 * 60 * 1000
  const het = hetHanLuc(LUC_CAP, MUOI_PHUT)

  it('hết hạn sau đúng thời hạn tính từ lúc cấp', () => {
    expect(het).toEqual(new Date('2026-03-01T08:10:00+07:00'))
  })

  it('còn hợp lệ trước hạn, hết hạn từ đúng lúc hạn trở đi', () => {
    expect(tinhTrangMaDatLai({ daDung: false, hetHanLuc: het }, LUC_CAP)).toBe('HOP_LE')
    expect(tinhTrangMaDatLai({ daDung: false, hetHanLuc: het }, new Date(het.getTime() - 1))).toBe('HOP_LE')
    expect(tinhTrangMaDatLai({ daDung: false, hetHanLuc: het }, het)).toBe('HET_HAN')
    expect(tinhTrangMaDatLai({ daDung: false, hetHanLuc: het }, new Date(het.getTime() + 1))).toBe('HET_HAN')
  })

  it('mã đã dùng thì luôn là đã dùng, kể cả khi còn hạn', () => {
    expect(tinhTrangMaDatLai({ daDung: true, hetHanLuc: het }, LUC_CAP)).toBe('DA_DUNG')
  })

  it('đặt lại cần email đúng định dạng, mã không rỗng và mật khẩu mới đủ 8 ký tự', () => {
    expect(kiemTra(datLaiMatKhauSchema, { email: 'x', ma: '  ', matKhauMoi: '1234567' })).toEqual({
      ok: false,
      loiTheoO: { email: THONG_BAO.emailSai, ma: THONG_BAO.maTrong, matKhauMoi: THONG_BAO.matKhauNgan },
    })
    expect(kiemTra(datLaiMatKhauSchema, { email: ' A@Vi-Du.vn ', ma: ' 000001 ', matKhauMoi: '12345678' })).toEqual({
      ok: true,
      giaTri: { email: 'a@vi-du.vn', ma: '000001', matKhauMoi: '12345678' },
    })
  })

  it('gửi lại thư và yêu cầu đặt lại chỉ cần email đúng định dạng', () => {
    expect(kiemTra(emailSchema, { email: '' })).toEqual({ ok: false, loiTheoO: { email: THONG_BAO.emailSai } })
    expect(kiemTra(emailSchema, { email: 'B@vi-du.vn' })).toEqual({ ok: true, giaTri: { email: 'b@vi-du.vn' } })
  })
})
