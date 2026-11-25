import { THONG_BAO, TEN_VAI, dangKySchema, duocSuaHoSo, kiemTra, suaHoSoSchema } from './taiKhoan'

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
