import { describe, expect, it } from 'vitest'
import {
  THONG_BAO_GITHUB_MAC_DINH,
  THONG_BAO_LIEN_KET,
  duongDanLienKet,
  kiemGhiLienKet,
  kiemTraLienKet,
  lyDoKhongGhiLienKet,
  tenLienKet,
  thuocRepoDaGan,
  chuyenPhanHoiGitHub,
  kiemTraRepo,
  khoaLienKet,
  khoaRepo,
  laTenRepoHopLe,
  phanTichLienKet,
  tenTrangThaiGitHub,
  xepRepo,
} from './github'

// Mẫu phản hồi cố định, rút gọn từ phản hồi thật của GitHub REST API (chỉ giữ các trường liên quan
// và vài trường nhiễu để chắc hàm không phụ thuộc vào chúng).
const ISSUE_MO = {
  url: 'https://api.github.com/repos/acme/web/issues/12',
  number: 12,
  title: 'Nút đăng nhập không bấm được',
  state: 'open',
  locked: false,
  user: { login: 'an-nguyen', id: 1 },
  labels: [{ name: 'bug' }],
  closed_at: null,
}
const ISSUE_DONG = { ...ISSUE_MO, state: 'closed', state_reason: 'completed', closed_at: '2026-03-01T08:00:00Z' }

const PR_MO = {
  url: 'https://api.github.com/repos/acme/web/pulls/34',
  number: 34,
  title: 'Sửa nút đăng nhập',
  state: 'open',
  draft: false,
  merged: false,
  merged_at: null,
  closed_at: null,
  mergeable: true,
}
const PR_NHAP = { ...PR_MO, draft: true }
const PR_DA_MERGE = { ...PR_MO, state: 'closed', merged: true, merged_at: '2026-03-02T10:00:00Z', closed_at: '2026-03-02T10:00:00Z' }
const PR_DONG = { ...PR_MO, state: 'closed', merged: false, merged_at: null, closed_at: '2026-03-02T10:00:00Z' }

describe('chuyển phản hồi GitHub thành trạng thái hiển thị', () => {
  it('issue mở và issue đóng', () => {
    expect(chuyenPhanHoiGitHub('ISSUE', ISSUE_MO)).toEqual({ ok: true, giaTri: { loai: 'ISSUE', trangThai: 'MO' } })
    expect(chuyenPhanHoiGitHub('ISSUE', ISSUE_DONG)).toEqual({ ok: true, giaTri: { loai: 'ISSUE', trangThai: 'DONG' } })
  })

  it('PR mở, PR nháp (hiện là mở), PR đã merge và PR đóng chưa merge', () => {
    expect(chuyenPhanHoiGitHub('PR', PR_MO)).toEqual({ ok: true, giaTri: { loai: 'PR', trangThai: 'MO' } })
    expect(chuyenPhanHoiGitHub('PR', PR_NHAP)).toEqual({ ok: true, giaTri: { loai: 'PR', trangThai: 'MO' } })
    expect(chuyenPhanHoiGitHub('PR', PR_DA_MERGE)).toEqual({ ok: true, giaTri: { loai: 'PR', trangThai: 'DA_MERGE' } })
    expect(chuyenPhanHoiGitHub('PR', PR_DONG)).toEqual({ ok: true, giaTri: { loai: 'PR', trangThai: 'DONG' } })
  })

  it('PR đã merge nhận ra được chỉ nhờ merged hoặc chỉ nhờ merged_at; PR đóng thiếu cả hai là dữ liệu lạ', () => {
    const chiMerged = { state: 'closed', merged: true }
    const chiMergedAt = { state: 'closed', merged_at: '2026-03-02T10:00:00Z' }
    const chiDong = { state: 'closed', merged: false }
    expect(chuyenPhanHoiGitHub('PR', chiMerged)).toEqual({ ok: true, giaTri: { loai: 'PR', trangThai: 'DA_MERGE' } })
    expect(chuyenPhanHoiGitHub('PR', chiMergedAt)).toEqual({ ok: true, giaTri: { loai: 'PR', trangThai: 'DA_MERGE' } })
    expect(chuyenPhanHoiGitHub('PR', chiDong)).toEqual({ ok: true, giaTri: { loai: 'PR', trangThai: 'DONG' } })
    expect(chuyenPhanHoiGitHub('PR', { state: 'closed' })).toMatchObject({ ok: false, loi: { ma: 'DU_LIEU_LA' } })
    // PR mở chỉ cần state.
    expect(chuyenPhanHoiGitHub('PR', { state: 'open' })).toEqual({ ok: true, giaTri: { loai: 'PR', trangThai: 'MO' } })
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['chuỗi', 'open'],
    ['số', 42],
    ['mảng', [ISSUE_MO]],
    ['đối tượng rỗng', {}],
    ['thiếu state', { number: 1, title: 'x' }],
    ['state lạ', { state: 'merged' }],
    ['state sai kiểu', { state: true }],
    ['state viết hoa', { state: 'OPEN' }],
  ])('dữ liệu lạ (%s) trả DU_LIEU_LA cho cả issue lẫn PR, không ném lỗi', (_ten, phanHoi) => {
    for (const loai of ['ISSUE', 'PR'] as const) {
      const kq = chuyenPhanHoiGitHub(loai, phanHoi)
      expect(kq).toEqual({ ok: false, loi: { ma: 'DU_LIEU_LA', thongBao: THONG_BAO_GITHUB_MAC_DINH.DU_LIEU_LA } })
    }
  })

  it.each([
    ['merged sai kiểu', { state: 'closed', merged: 'true' }],
    ['merged_at sai kiểu', { state: 'closed', merged_at: 123 }],
    ['draft sai kiểu', { state: 'open', draft: 'yes' }],
    ['PR mở mà đã merge', { state: 'open', merged: true }],
    ['PR mở mà có merged_at', { state: 'open', merged_at: '2026-03-02T10:00:00Z' }],
    ['merged false nhưng có merged_at', { state: 'closed', merged: false, merged_at: '2026-03-02T10:00:00Z' }],
  ])('PR dữ liệu mâu thuẫn hoặc sai kiểu (%s) trả DU_LIEU_LA', (_ten, phanHoi) => {
    expect(chuyenPhanHoiGitHub('PR', phanHoi)).toMatchObject({ ok: false, loi: { ma: 'DU_LIEU_LA' } })
  })

  it('loại lạ hoặc đối tượng có getter ném lỗi vẫn không ném lỗi trần', () => {
    expect(chuyenPhanHoiGitHub('KHAC' as never, ISSUE_MO)).toMatchObject({ ok: false, loi: { ma: 'DU_LIEU_LA' } })
    const doc = {
      get state(): string {
        throw new Error('nổ')
      },
    }
    expect(chuyenPhanHoiGitHub('ISSUE', doc)).toMatchObject({ ok: false, loi: { ma: 'DU_LIEU_LA' } })
  })

  it('chữ hiện trên giao diện cho từng trạng thái', () => {
    expect(tenTrangThaiGitHub({ loai: 'ISSUE', trangThai: 'MO' })).toBe('Issue đang mở')
    expect(tenTrangThaiGitHub({ loai: 'ISSUE', trangThai: 'DONG' })).toBe('Issue đã đóng')
    expect(tenTrangThaiGitHub({ loai: 'PR', trangThai: 'MO' })).toBe('PR đang mở')
    expect(tenTrangThaiGitHub({ loai: 'PR', trangThai: 'DA_MERGE' })).toBe('PR đã merge')
    expect(tenTrangThaiGitHub({ loai: 'PR', trangThai: 'DONG' })).toBe('PR đã đóng')
  })
})

describe('phân tích đường dẫn issue hoặc PR', () => {
  it.each([
    ['https://github.com/acme/web/issues/12', { repo: 'acme/web', loai: 'ISSUE', so: 12 }],
    ['https://github.com/acme/web/pull/34', { repo: 'acme/web', loai: 'PR', so: 34 }],
    ['  https://github.com/Acme/Web.js/pull/1  ', { repo: 'Acme/Web.js', loai: 'PR', so: 1 }],
    ['http://github.com/acme/web/issues/7', { repo: 'acme/web', loai: 'ISSUE', so: 7 }],
    ['https://www.github.com/acme/web/issues/7', { repo: 'acme/web', loai: 'ISSUE', so: 7 }],
    ['https://GitHub.com/acme/web/issues/7', { repo: 'acme/web', loai: 'ISSUE', so: 7 }],
    ['https://github.com/acme/web/issues/12/', { repo: 'acme/web', loai: 'ISSUE', so: 12 }],
    ['https://github.com/acme/web/pull/34?notification_referrer_id=abc', { repo: 'acme/web', loai: 'PR', so: 34 }],
    ['https://github.com/acme/web/issues/12#issuecomment-99', { repo: 'acme/web', loai: 'ISSUE', so: 12 }],
    ['https://github.com/a-b/c_d.e-f/issues/9007199254740991', { repo: 'a-b/c_d.e-f', loai: 'ISSUE', so: 9007199254740991 }],
  ])('"%s" ra (repo, loại, số)', (duongDan, mong) => {
    expect(phanTichLienKet(duongDan)).toEqual({ ok: true, giaTri: mong })
  })

  it.each([
    ['host khác', 'https://gitlab.com/acme/web/issues/12'],
    ['host giả có chứa github.com', 'https://github.com.evil.vn/acme/web/issues/12'],
    ['host giả có tiền tố', 'https://notgithub.com/acme/web/issues/12'],
    ['thông tin đăng nhập trong link', 'https://github.com@evil.vn/acme/web/issues/12'],
    ['có cổng', 'https://github.com:8443/acme/web/issues/12'],
    ['giao thức khác', 'ftp://github.com/acme/web/issues/12'],
    ['không có giao thức', 'github.com/acme/web/issues/12'],
    ['trang repo', 'https://github.com/acme/web'],
    ['danh sách issue', 'https://github.com/acme/web/issues'],
    ['danh sách PR', 'https://github.com/acme/web/pulls'],
    ['dạng khác', 'https://github.com/acme/web/discussions/12'],
    ['commit', 'https://github.com/acme/web/commit/abc123'],
    ['PR kèm trang con', 'https://github.com/acme/web/pull/34/files'],
    ['pulls số nhiều', 'https://github.com/acme/web/pulls/34'],
    ['issue số nhiều sai', 'https://github.com/acme/web/issue/12'],
    ['số bằng 0', 'https://github.com/acme/web/issues/0'],
    ['số âm', 'https://github.com/acme/web/issues/-3'],
    ['số thập phân', 'https://github.com/acme/web/issues/1.5'],
    ['số có số 0 đầu', 'https://github.com/acme/web/issues/012'],
    ['số không phải số', 'https://github.com/acme/web/issues/abc'],
    ['số quá lớn', 'https://github.com/acme/web/issues/99999999999999999999'],
    ['thiếu số', 'https://github.com/acme/web/issues/'],
    ['thiếu repo', 'https://github.com/acme/issues/12'],
    ['thiếu chủ sở hữu và repo', 'https://github.com/issues/12'],
    ['chủ sở hữu sai định dạng', 'https://github.com/-acme/web/issues/12'],
    ['repo là ..', 'https://github.com/acme/../issues/12'],
    ['chuỗi rỗng', ''],
    ['chỉ khoảng trắng', '   '],
    ['không phải link', 'mở lại issue số 12 giúp mình'],
  ])('%s trả LINK_KHONG_HOP_LE', (_ten, duongDan) => {
    expect(phanTichLienKet(duongDan)).toEqual({
      ok: false,
      loi: { ma: 'LINK_KHONG_HOP_LE', thongBao: THONG_BAO_GITHUB_MAC_DINH.LINK_KHONG_HOP_LE },
    })
  })

  it('đầu vào không phải chuỗi trả LINK_KHONG_HOP_LE, không ném lỗi', () => {
    for (const dauVao of [null, undefined, 12, {}, ['https://github.com/a/b/issues/1']]) {
      expect(phanTichLienKet(dauVao)).toMatchObject({ ok: false, loi: { ma: 'LINK_KHONG_HOP_LE' } })
    }
  })

  it('khoá liên kết không phân biệt hoa thường ở tên repo', () => {
    expect(khoaLienKet({ repo: 'Acme/Web', loai: 'PR', so: 3 })).toBe(khoaLienKet({ repo: 'acme/WEB', loai: 'PR', so: 3 }))
    expect(khoaLienKet({ repo: 'acme/web', loai: 'PR', so: 3 })).not.toBe(khoaLienKet({ repo: 'acme/web', loai: 'ISSUE', so: 3 }))
    expect(khoaLienKet({ repo: 'acme/web', loai: 'PR', so: 3 })).not.toBe(khoaLienKet({ repo: 'acme/web', loai: 'PR', so: 4 }))
  })
})

describe('tên repo gắn vào Dự án', () => {
  it.each(['vercel/next.js', 'a/b', 'Acme-Co/web_app.v2', '0-9/1', `${'a'.repeat(39)}/${'r'.repeat(100)}`, 'acme/.github', 'acme/a..b'])(
    '"%s" hợp lệ',
    (repo) => {
      expect(laTenRepoHopLe(repo)).toBe(true)
    },
  )

  it.each(['', 'a', 'a/', '/a', 'a/b/c', 'a b/c', 'a/b c', '-a/b', 'a-/b', 'a_b/c', 'a/.', 'a/..', 'a/b?', 'a/b#1', 'a/b\\c', 'ạ/b', `${'a'.repeat(40)}/b`])(
    '"%s" không hợp lệ',
    (repo) => {
      expect(laTenRepoHopLe(repo)).toBe(false)
    },
  )

  it('kiểm dữ liệu gắn repo: bỏ khoảng trắng hai đầu, lỗi theo ô repo bằng tiếng Việt', () => {
    expect(kiemTraRepo.gan({ repo: '  acme/web ' })).toEqual({ ok: true, giaTri: { repo: 'acme/web' } })
    for (const dauVao of [{ repo: 'sai' }, { repo: 12 }, {}, null]) {
      const kt = kiemTraRepo.gan(dauVao)
      expect(kt.ok).toBe(false)
      if (!kt.ok) expect(Object.values(kt.loiTheoO).join(' ')).toMatch(/chu-so-huu\/ten-repo/)
    }
  })

  it('khoá repo không phân biệt hoa thường; xếp repo theo tên', () => {
    expect(khoaRepo(' Acme/Web ')).toBe('acme/web')
    expect(xepRepo(['b/z', 'A/y', 'a/x'])).toEqual(['a/x', 'A/y', 'b/z'])
  })
})

describe('link issue hoặc PR trên Task', () => {
  it('kiểm dữ liệu dán link: ra (repo, loại, số); sai thì lỗi ở ô duongDan bằng tiếng Việt', () => {
    expect(kiemTraLienKet.them({ duongDan: ' https://github.com/acme/web/pull/34/ ' })).toEqual({
      ok: true,
      giaTri: { repo: 'acme/web', loai: 'PR', so: 34 },
    })
    for (const dauVao of [{ duongDan: 'sai' }, { duongDan: '' }, { duongDan: 12 }, {}]) {
      expect(kiemTraLienKet.them(dauVao)).toEqual({ ok: false, loiTheoO: { duongDan: THONG_BAO_LIEN_KET.sai } })
    }
    for (const dauVao of [null, 'https://github.com/a/b/issues/1']) {
      const kt = kiemTraLienKet.them(dauVao)
      expect(kt.ok).toBe(false)
      if (!kt.ok) expect(Object.values(kt.loiTheoO)).toEqual([THONG_BAO_LIEN_KET.sai])
    }
  })

  it('đường dẫn chuẩn và tên hiển thị của link', () => {
    expect(duongDanLienKet({ repo: 'Acme/Web', loai: 'ISSUE', so: 12 })).toBe('https://github.com/Acme/Web/issues/12')
    expect(duongDanLienKet({ repo: 'acme/web', loai: 'PR', so: 34 })).toBe('https://github.com/acme/web/pull/34')
    expect(tenLienKet({ repo: 'acme/web', loai: 'ISSUE', so: 12 })).toBe('acme/web · Issue #12')
    expect(tenLienKet({ repo: 'acme/web', loai: 'PR', so: 34 })).toBe('acme/web · PR #34')
    // Đường dẫn chuẩn phân tích ngược ra đúng link.
    const lienKet = { repo: 'acme/web', loai: 'PR', so: 34 } as const
    expect(phanTichLienKet(duongDanLienKet(lienKet))).toEqual({ ok: true, giaTri: lienKet })
  })

  it('link thuộc repo đã gắn không phân biệt hoa thường', () => {
    const lienKet = { repo: 'Acme/Web', loai: 'ISSUE', so: 1 } as const
    expect(thuocRepoDaGan(lienKet, ['acme/web'])).toBe(true)
    expect(thuocRepoDaGan(lienKet, ['acme/api', 'ACME/WEB'])).toBe(true)
    expect(thuocRepoDaGan(lienKet, ['acme/api'])).toBe(false)
    expect(thuocRepoDaGan(lienKet, [])).toBe(false)
  })

  it('quyền ghi link: mọi người thấy Dự án ghi được, trừ Dự án đã Lưu trữ; người không thấy nhận KHONG_TIM_THAY', () => {
    for (const vai of ['PM', 'SUPPORT', 'THANH_VIEN'] as const) {
      expect(kiemGhiLienKet({ vaiNguoiGoi: vai, laNguoiTrongDuAn: true, trangThai: 'HOAT_DONG' }), vai).toBeNull()
      expect(kiemGhiLienKet({ vaiNguoiGoi: vai, laNguoiTrongDuAn: true, trangThai: 'LUU_TRU' }), vai).toBe('DU_AN_DA_LUU_TRU')
    }
    // PM thấy mọi Dự án dù không nằm trong danh sách.
    expect(kiemGhiLienKet({ vaiNguoiGoi: 'PM', laNguoiTrongDuAn: false, trangThai: 'HOAT_DONG' })).toBeNull()
    for (const vai of ['SUPPORT', 'THANH_VIEN'] as const) {
      for (const trangThai of ['HOAT_DONG', 'LUU_TRU'] as const) {
        expect(kiemGhiLienKet({ vaiNguoiGoi: vai, laNguoiTrongDuAn: false, trangThai })).toBe('KHONG_TIM_THAY')
      }
    }
    expect(lyDoKhongGhiLienKet({ vaiNguoiGoi: 'THANH_VIEN', laNguoiTrongDuAn: true, trangThai: 'HOAT_DONG' })).toBeNull()
    expect(lyDoKhongGhiLienKet({ vaiNguoiGoi: 'THANH_VIEN', laNguoiTrongDuAn: true, trangThai: 'LUU_TRU' })).toBe(THONG_BAO_LIEN_KET.daLuuTru)
  })
})
