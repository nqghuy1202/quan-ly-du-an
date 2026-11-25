import { describe, expect, it } from 'vitest'
import { khoaLienKet, THONG_BAO_GITHUB_MAC_DINH, type LienKetGitHub } from '../luat/github'
import { CAC_THAO_TAC_CONG_GITHUB, type CongGitHub } from './congGitHub'
import { loiGia, phanHoiGia, taoCongGiaGitHub } from './congGiaGitHub'

const ISSUE_12: LienKetGitHub = { repo: 'acme/web', loai: 'ISSUE', so: 12 }
const PR_34: LienKetGitHub = { repo: 'acme/web', loai: 'PR', so: 34 }

describe('Cổng GitHub: chỉ có thao tác đọc', () => {
  it('giao diện của bản giả có đúng các thao tác trong danh sách, và tất cả đều là thao tác đọc', () => {
    const { cong } = taoCongGiaGitHub()
    expect(Object.keys(cong).sort()).toEqual([...CAC_THAO_TAC_CONG_GITHUB].sort())
    for (const ten of Object.keys(cong)) expect(ten, ten).toMatch(/^doc[A-Z]/)
    for (const ten of CAC_THAO_TAC_CONG_GITHUB) expect(ten).not.toMatch(/^(tao|sua|xoa|ghi|dong|merge|gui|them|go|cap|doi)/i)
  })

  it('không có thao tác ghi nào dù thử đoán tên', () => {
    const cong = taoCongGiaGitHub().cong as unknown as Record<string, unknown>
    for (const ten of ['taoIssue', 'suaIssue', 'dongIssue', 'moLaiIssue', 'taoPR', 'mergePR', 'dongPR', 'binhLuan', 'ghi', 'guiBinhLuan', 'themNhan']) {
      expect(cong[ten], ten).toBeUndefined()
    }
  })
})

describe('bản giả của Cổng GitHub chạy theo kịch bản', () => {
  const kichBan = {
    theoLienKet: {
      [khoaLienKet(ISSUE_12)]: phanHoiGia({ state: 'open' }),
      [khoaLienKet(PR_34)]: phanHoiGia({ state: 'closed', merged: true, merged_at: '2026-03-02T10:00:00Z' }),
      [khoaLienKet({ repo: 'acme/web', loai: 'ISSUE', so: 1 })]: loiGia('KHONG_TIM_THAY'),
      [khoaLienKet({ repo: 'acme/rieng', loai: 'ISSUE', so: 2 })]: loiGia('RIENG_TU'),
      [khoaLienKet({ repo: 'acme/web', loai: 'ISSUE', so: 3 })]: loiGia('HET_LUOT_GOI'),
      [khoaLienKet({ repo: 'acme/web', loai: 'ISSUE', so: 4 })]: loiGia('MAT_MANG'),
      [khoaLienKet({ repo: 'acme/web', loai: 'ISSUE', so: 5 })]: phanHoiGia({ trangThai: 'la' }),
    },
  }

  it('thành công: trả trạng thái đã chuẩn hoá qua hàm chuyển đổi thuần', async () => {
    const { cong } = taoCongGiaGitHub(kichBan)
    expect(await cong.docTrangThai(ISSUE_12)).toEqual({ ok: true, giaTri: { loai: 'ISSUE', trangThai: 'MO' } })
    expect(await cong.docTrangThai(PR_34)).toEqual({ ok: true, giaTri: { loai: 'PR', trangThai: 'DA_MERGE' } })
    // Repo không phân biệt hoa thường.
    expect(await cong.docTrangThai({ ...ISSUE_12, repo: 'ACME/Web' })).toMatchObject({ ok: true })
  })

  it.each([
    ['không tìm thấy', { repo: 'acme/web', loai: 'ISSUE', so: 1 }, 'KHONG_TIM_THAY'],
    ['repo riêng tư mà token không thấy', { repo: 'acme/rieng', loai: 'ISSUE', so: 2 }, 'RIENG_TU'],
    ['hết lượt gọi', { repo: 'acme/web', loai: 'ISSUE', so: 3 }, 'HET_LUOT_GOI'],
    ['mất mạng', { repo: 'acme/web', loai: 'ISSUE', so: 4 }, 'MAT_MANG'],
    ['phản hồi lạ', { repo: 'acme/web', loai: 'ISSUE', so: 5 }, 'DU_LIEU_LA'],
  ] as const)('kịch bản lỗi %s trả mã %s riêng, kèm thông báo tiếng Việt', async (_ten, lienKet, ma) => {
    const { cong } = taoCongGiaGitHub(kichBan)
    expect(await cong.docTrangThai(lienKet)).toEqual({
      ok: false,
      loi: { ma, thongBao: THONG_BAO_GITHUB_MAC_DINH[ma] },
    })
  })

  it('bốn mã lỗi của GitHub khác nhau và có thông báo khác nhau', () => {
    const ma = ['KHONG_TIM_THAY', 'RIENG_TU', 'HET_LUOT_GOI', 'MAT_MANG'] as const
    expect(new Set(ma.map((m) => THONG_BAO_GITHUB_MAC_DINH[m])).size).toBe(4)
  })

  it('liên kết ngoài kịch bản: mặc định không tìm thấy, hoặc phản ứng mặc định do kịch bản đặt', async () => {
    expect(await taoCongGiaGitHub().cong.docTrangThai(ISSUE_12)).toMatchObject({ ok: false, loi: { ma: 'KHONG_TIM_THAY' } })
    const { cong } = taoCongGiaGitHub({ macDinh: loiGia('MAT_MANG') })
    expect(await cong.docTrangThai(ISSUE_12)).toMatchObject({ ok: false, loi: { ma: 'MAT_MANG' } })
  })

  it('đọc nhiều liên kết: mỗi liên kết một kết quả theo đúng thứ tự, một lỗi không làm hỏng các liên kết khác', async () => {
    const { cong, cacLanGoi } = taoCongGiaGitHub(kichBan)
    const cacLienKet: LienKetGitHub[] = [ISSUE_12, { repo: 'acme/rieng', loai: 'ISSUE', so: 2 }, PR_34]
    const kq = await cong.docNhieuTrangThai(cacLienKet)
    expect(kq).toHaveLength(3)
    expect(kq[0]).toMatchObject({ ok: true, giaTri: { trangThai: 'MO' } })
    expect(kq[1]).toMatchObject({ ok: false, loi: { ma: 'RIENG_TU' } })
    expect(kq[2]).toMatchObject({ ok: true, giaTri: { trangThai: 'DA_MERGE' } })
    expect(cacLanGoi()).toEqual(cacLienKet)
    expect(await cong.docNhieuTrangThai([])).toEqual([])
  })

  it('kiểu: bản giả thoả giao diện CongGitHub', () => {
    const cong: CongGitHub = taoCongGiaGitHub().cong
    expect(typeof cong.docTrangThai).toBe('function')
  })
})
