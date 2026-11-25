// Logic của Edge Function `doc-github` (ticket 17), kiểm bằng đầu vào giả: không mạng, không Deno.
// Cổng KHÔNG kiểm được việc hàm chạy thật và GitHub thật (supabase/README.md). Ở đây kiểm: từ chối
// người chưa đăng nhập, từ chối repo chưa gắn, chỉ GET tới api.github.com, mã lỗi và trạng thái giống
// hệt bản giả của Cổng GitHub (qua đúng hàm thuần chung), và không bao giờ lộ token.
import { describe, expect, it } from 'vitest'
import {
  GIOI_HAN_LIEN_KET_MOI_LAN,
  THONG_BAO_GITHUB_MAC_DINH,
  khoaLienKet,
  type KetQuaGitHub,
  type LienKetGitHub,
  type TrangThaiLienKet,
} from '../luat/github'
import { loiGia, phanHoiGia, taoCongGiaGitHub } from './congGiaGitHub'
import {
  THONG_BAO_HAM,
  xuLyYeuCau,
  type PhanHoiGitHubTho,
  type PhuThuocHam,
  type YeuCauGitHub,
} from '../../supabase/functions/doc-github/xuLy'

const TOKEN_GIA = 'github_pat_TOKEN-GIA-khong-duoc-lo-ra-0123456789'
const ISSUE_12: LienKetGitHub = { repo: 'acme/web', loai: 'ISSUE', so: 12 }
const PR_34: LienKetGitHub = { repo: 'acme/web', loai: 'PR', so: 34 }

interface LanGoi {
  url: string
  yeuCau: YeuCauGitHub
}

function phanHoiTho(status: number, than: unknown, tieuDe: Record<string, string> = {}): PhanHoiGitHubTho {
  const chu = typeof than === 'string' ? than : JSON.stringify(than)
  return {
    status,
    tieuDe: (ten) => tieuDe[ten.toLowerCase()] ?? null,
    chu: async () => chu,
  }
}

interface TuyChonGia {
  token?: string | undefined
  dangNhap?: boolean
  /** Các repo (khoá chữ thường) đã gắn vào Dự án người gọi thấy. */
  repoDaGan?: string[]
  /** Phản hồi của GitHub theo URL; mặc định 404. */
  github?: (url: string) => PhanHoiGitHubTho | Error
  repoDaGanNem?: boolean
}

function dungPhuThuoc(tuyChon: TuyChonGia = {}) {
  const lanGoi: LanGoi[] = []
  const lanHoiRepo: string[] = []
  let soLanXacThuc = 0
  const phuThuoc: PhuThuocHam = {
    token: 'token' in tuyChon ? tuyChon.token : TOKEN_GIA,
    async xacThuc() {
      soLanXacThuc += 1
      if (tuyChon.dangNhap === false) return null
      return {
        async repoDaGan(khoa: string) {
          lanHoiRepo.push(khoa)
          if (tuyChon.repoDaGanNem) throw new Error(`CSDL hỏng ${TOKEN_GIA}`)
          return (tuyChon.repoDaGan ?? ['acme/web']).includes(khoa)
        },
      }
    },
    async goiGitHub(url, yeuCau) {
      lanGoi.push({ url, yeuCau })
      const kq = (tuyChon.github ?? (() => phanHoiTho(404, { message: 'Not Found' })))(url)
      if (kq instanceof Error) throw kq
      return kq
    },
  }
  return { phuThuoc, lanGoi, lanHoiRepo, soLanXacThuc: () => soLanXacThuc }
}

function yeuCauPost(than: unknown, tieuDe: Record<string, string> = { Authorization: 'Bearer jwt-gia' }): Request {
  return new Request('https://x.supabase.co/functions/v1/doc-github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...tieuDe },
    body: typeof than === 'string' ? than : JSON.stringify(than),
  })
}

async function goi(
  than: unknown,
  tuyChon?: TuyChonGia,
): Promise<{ status: number; chu: string; json: Record<string, unknown>; ketQua: KetQuaGitHub<TrangThaiLienKet>[] } & ReturnType<typeof dungPhuThuoc>> {
  const gia = dungPhuThuoc(tuyChon)
  const phanHoi = await xuLyYeuCau(yeuCauPost(than), gia.phuThuoc)
  const chu = await phanHoi.text()
  const json = JSON.parse(chu) as Record<string, unknown>
  return { status: phanHoi.status, chu, json, ketQua: (json.ketQua ?? []) as KetQuaGitHub<TrangThaiLienKet>[], ...gia }
}

describe('Edge Function doc-github: đăng nhập', () => {
  it('người chưa đăng nhập bị từ chối 401 và không có yêu cầu nào tới GitHub', async () => {
    const r = await goi({ cacLienKet: [ISSUE_12] }, { dangNhap: false })
    expect(r.status).toBe(401)
    expect(r.json).toEqual({ loi: { ma: 'GITHUB_KHONG_KHA_DUNG', thongBao: THONG_BAO_HAM.chuaDangNhap } })
    expect(r.lanGoi).toHaveLength(0)
    expect(r.lanHoiRepo).toHaveLength(0)
  })

  it('thiếu tiêu đề Authorization cũng bị từ chối khi bước xác thực trả null; xác thực được hỏi trước mọi thứ khác', async () => {
    const gia = dungPhuThuoc({ dangNhap: false, token: undefined })
    const phanHoi = await xuLyYeuCau(yeuCauPost('không phải JSON', {}), gia.phuThuoc)
    // Chưa đăng nhập thì chưa biết cả cấu hình (thiếu token) lẫn thân yêu cầu hỏng.
    expect(phanHoi.status).toBe(401)
    expect(gia.soLanXacThuc()).toBe(1)
  })

  it('xác thực ném lỗi thì coi như chưa đăng nhập', async () => {
    const gia = dungPhuThuoc()
    gia.phuThuoc.xacThuc = async () => {
      throw new Error(`hỏng ${TOKEN_GIA}`)
    }
    const phanHoi = await xuLyYeuCau(yeuCauPost({ cacLienKet: [ISSUE_12] }), gia.phuThuoc)
    expect(phanHoi.status).toBe(401)
    expect(await phanHoi.text()).not.toContain(TOKEN_GIA)
    expect(gia.lanGoi).toHaveLength(0)
  })
})

describe('Edge Function doc-github: repo đã gắn vào Dự án người gọi thấy', () => {
  it('repo chưa gắn: KHONG_TIM_THAY và KHÔNG gọi GitHub; repo đã gắn (không phân biệt hoa thường) thì đọc', async () => {
    const r = await goi(
      { cacLienKet: [{ repo: 'nguoi-la/repo', loai: 'ISSUE', so: 1 }, { repo: 'ACME/Web', loai: 'ISSUE', so: 12 }] },
      { github: () => phanHoiTho(200, { state: 'open' }) },
    )
    expect(r.status).toBe(200)
    expect(r.ketQua[0]).toEqual({ ok: false, loi: { ma: 'KHONG_TIM_THAY', thongBao: THONG_BAO_HAM.repoChuaGan } })
    expect(r.ketQua[1]).toEqual({ ok: true, giaTri: { loai: 'ISSUE', trangThai: 'MO' } })
    expect(r.lanGoi.map((l) => l.url)).toEqual(['https://api.github.com/repos/ACME/Web/issues/12'])
    // Hỏi theo khoá chữ thường, mỗi repo một lần dù có nhiều link.
    expect(r.lanHoiRepo.sort()).toEqual(['acme/web', 'nguoi-la/repo'])
  })

  it('hỏi repo đã gắn một lần cho nhiều link cùng repo', async () => {
    const r = await goi(
      { cacLienKet: [ISSUE_12, PR_34, { ...ISSUE_12, so: 13 }] },
      { github: () => phanHoiTho(200, { state: 'open' }) },
    )
    expect(r.lanHoiRepo).toEqual(['acme/web'])
    expect(r.lanGoi).toHaveLength(3)
  })

  it('không hỏi được cơ sở dữ liệu: GITHUB_KHONG_KHA_DUNG cho link đó, không gọi GitHub, không lộ lỗi', async () => {
    const r = await goi({ cacLienKet: [ISSUE_12] }, { repoDaGanNem: true })
    expect(r.ketQua[0]).toEqual({ ok: false, loi: { ma: 'GITHUB_KHONG_KHA_DUNG', thongBao: THONG_BAO_GITHUB_MAC_DINH.GITHUB_KHONG_KHA_DUNG } })
    expect(r.lanGoi).toHaveLength(0)
    expect(r.chu).not.toContain(TOKEN_GIA)
  })
})

describe('Edge Function doc-github: chỉ đọc', () => {
  it('mọi yêu cầu tới GitHub là GET tới api.github.com/repos/.../(issues|pulls)/số, URL dựng từ phần đã kiểm', async () => {
    const r = await goi({ cacLienKet: [ISSUE_12, PR_34] }, { github: () => phanHoiTho(200, { state: 'open' }) })
    expect(r.lanGoi.map((l) => [l.yeuCau.method, l.url])).toEqual([
      ['GET', 'https://api.github.com/repos/acme/web/issues/12'],
      ['GET', 'https://api.github.com/repos/acme/web/pulls/34'],
    ])
    for (const l of r.lanGoi) {
      expect(l.url).toMatch(/^https:\/\/api\.github\.com\/repos\/[\w.-]+\/[\w.-]+\/(issues|pulls)\/[1-9]\d*$/)
      expect(Object.keys(l.yeuCau).sort()).toEqual(['headers', 'method'])
    }
  })

  it('chuỗi người gọi gửi không đi vào URL: repo, loại, số sai hình bị loại với LINK_KHONG_HOP_LE và không gọi GitHub', async () => {
    const sai = [
      { repo: 'acme/web/../../user', loai: 'ISSUE', so: 1 },
      { repo: 'acme/web?x=1', loai: 'ISSUE', so: 1 },
      { repo: 'https://evil.example/a', loai: 'ISSUE', so: 1 },
      { repo: 'acme/web', loai: 'COMMIT', so: 1 },
      { repo: 'acme/web', loai: 'issues', so: 1 },
      { repo: 'acme/web', loai: 'ISSUE', so: '12' },
      { repo: 'acme/web', loai: 'ISSUE', so: 0 },
      { repo: 'acme/web', loai: 'ISSUE', so: -1 },
      { repo: 'acme/web', loai: 'ISSUE', so: 1.5 },
      { repo: 'acme/web', loai: 'ISSUE', so: 2 ** 60 },
      { repo: 12, loai: 'ISSUE', so: 1 },
      null,
      'acme/web#1',
      [],
    ]
    const r = await goi({ cacLienKet: sai })
    expect(r.status).toBe(200)
    expect(r.ketQua).toHaveLength(sai.length)
    for (const kq of r.ketQua) expect(kq).toEqual({ ok: false, loi: { ma: 'LINK_KHONG_HOP_LE', thongBao: THONG_BAO_GITHUB_MAC_DINH.LINK_KHONG_HOP_LE } })
    expect(r.lanGoi).toHaveLength(0)
  })

  it('chỉ nhận POST (và OPTIONS cho CORS); các phương thức khác bị từ chối và không gọi GitHub', async () => {
    for (const method of ['GET', 'PUT', 'DELETE', 'PATCH']) {
      const gia = dungPhuThuoc()
      const phanHoi = await xuLyYeuCau(new Request('https://x.supabase.co/f', { method, headers: { Authorization: 'Bearer a' } }), gia.phuThuoc)
      expect(phanHoi.status, method).toBe(405)
      expect(gia.lanGoi).toHaveLength(0)
      expect(gia.soLanXacThuc()).toBe(0)
    }
    const gia = dungPhuThuoc()
    const phanHoi = await xuLyYeuCau(new Request('https://x.supabase.co/f', { method: 'OPTIONS' }), gia.phuThuoc)
    expect(phanHoi.status).toBe(204)
    expect(phanHoi.headers.get('Access-Control-Allow-Methods')).toBe('POST, OPTIONS')
  })
})

describe('Edge Function doc-github: thân yêu cầu', () => {
  it.each([
    ['không phải JSON', 'abc {'],
    ['không phải đối tượng', '[]'],
    ['thiếu cacLienKet', '{}'],
    ['cacLienKet không phải mảng', '{"cacLienKet": "x"}'],
    ['quá giới hạn', JSON.stringify({ cacLienKet: Array.from({ length: GIOI_HAN_LIEN_KET_MOI_LAN + 1 }, () => ISSUE_12) })],
  ])('%s: 400, không gọi GitHub', async (_ten, than) => {
    const r = await goi(than)
    expect(r.status).toBe(400)
    expect(r.json).toEqual({ loi: { ma: 'LINK_KHONG_HOP_LE', thongBao: THONG_BAO_HAM.yeuCauSai } })
    expect(r.lanGoi).toHaveLength(0)
  })

  it('danh sách rỗng: 200 với kết quả rỗng; đúng giới hạn thì nhận', async () => {
    expect((await goi({ cacLienKet: [] })).ketQua).toEqual([])
    const r = await goi(
      { cacLienKet: Array.from({ length: GIOI_HAN_LIEN_KET_MOI_LAN }, () => ISSUE_12) },
      { github: () => phanHoiTho(200, { state: 'closed' }) },
    )
    expect(r.ketQua).toHaveLength(GIOI_HAN_LIEN_KET_MOI_LAN)
  })
})

describe('Edge Function doc-github: trạng thái và mã lỗi giống hệt bản giả của Cổng GitHub', () => {
  const casTrangThai: [string, LienKetGitHub, unknown][] = [
    ['issue mở', ISSUE_12, { state: 'open' }],
    ['issue đóng', ISSUE_12, { state: 'closed' }],
    ['PR mở', PR_34, { state: 'open', merged: false, draft: false }],
    ['PR nháp coi là mở', PR_34, { state: 'open', draft: true, merged: false }],
    ['PR đã merge', PR_34, { state: 'closed', merged: true, merged_at: '2026-03-02T10:00:00Z' }],
    ['PR đóng chưa merge', PR_34, { state: 'closed', merged: false, merged_at: null }],
    ['phản hồi lạ (state lạ)', ISSUE_12, { state: 'la' }],
    ['phản hồi lạ (không phải đối tượng)', ISSUE_12, [1, 2]],
    ['PR đóng thiếu merged', PR_34, { state: 'closed' }],
  ]

  it.each(casTrangThai)('%s: cùng kết quả với bản giả (cùng hàm chuyển đổi thuần)', async (_ten, lienKet, phanHoi) => {
    const { cong } = taoCongGiaGitHub({ theoLienKet: { [khoaLienKet(lienKet)]: phanHoiGia(phanHoi) } })
    const mong = await cong.docTrangThai(lienKet)
    const r = await goi({ cacLienKet: [lienKet] }, { github: () => phanHoiTho(200, phanHoi) })
    expect(r.ketQua[0]).toEqual(mong)
  })

  it('thân 200 không phải JSON: DU_LIEU_LA', async () => {
    const r = await goi({ cacLienKet: [ISSUE_12] }, { github: () => phanHoiTho(200, '<html>không phải json</html>') })
    expect(r.ketQua[0]).toEqual({ ok: false, loi: { ma: 'DU_LIEU_LA', thongBao: THONG_BAO_GITHUB_MAC_DINH.DU_LIEU_LA } })
  })

  const casLoi: [string, () => PhanHoiGitHubTho | Error, 'KHONG_TIM_THAY' | 'RIENG_TU' | 'HET_LUOT_GOI' | 'MAT_MANG'][] = [
    ['404 không tìm thấy', () => phanHoiTho(404, { message: 'Not Found' }), 'KHONG_TIM_THAY'],
    ['410 đã bị xoá', () => phanHoiTho(410, { message: 'Gone' }), 'KHONG_TIM_THAY'],
    ['403 repo riêng tư mà token không thấy', () => phanHoiTho(403, { message: 'Resource not accessible by personal access token' }), 'RIENG_TU'],
    ['403 hết lượt gọi (tiêu đề remaining 0)', () => phanHoiTho(403, { message: 'x' }, { 'x-ratelimit-remaining': '0' }), 'HET_LUOT_GOI'],
    ['403 hết lượt gọi (thông điệp rate limit)', () => phanHoiTho(403, { message: 'API rate limit exceeded for user' }), 'HET_LUOT_GOI'],
    ['403 giới hạn phụ (retry-after)', () => phanHoiTho(403, { message: 'secondary' }, { 'retry-after': '60' }), 'HET_LUOT_GOI'],
    ['429 quá nhiều yêu cầu', () => phanHoiTho(429, ''), 'HET_LUOT_GOI'],
    ['502 GitHub lỗi', () => phanHoiTho(502, 'Bad Gateway'), 'MAT_MANG'],
    ['mất mạng (ném lỗi)', () => new Error(`ECONNRESET ${TOKEN_GIA}`), 'MAT_MANG'],
  ]

  it.each(casLoi)('%s → mã %s, đúng mã và thông báo của bản giả', async (_ten, github, ma) => {
    const { cong } = taoCongGiaGitHub({ theoLienKet: { [khoaLienKet(ISSUE_12)]: loiGia(ma) } })
    const mong = await cong.docTrangThai(ISSUE_12)
    const r = await goi({ cacLienKet: [ISSUE_12] }, { github })
    expect(r.status).toBe(200)
    expect(r.ketQua[0]).toEqual(mong)
  })

  it('token GitHub bị từ chối (401): GITHUB_KHONG_KHA_DUNG, không phải lỗi của link', async () => {
    const r = await goi({ cacLienKet: [ISSUE_12] }, { github: () => phanHoiTho(401, { message: 'Bad credentials' }) })
    expect(r.ketQua[0]).toMatchObject({ ok: false, loi: { ma: 'GITHUB_KHONG_KHA_DUNG' } })
  })

  it('mã trạng thái lạ: DU_LIEU_LA; một link lỗi không làm hỏng link khác; đúng thứ tự', async () => {
    const r = await goi(
      { cacLienKet: [ISSUE_12, PR_34, { ...ISSUE_12, so: 99 }] },
      {
        github: (url) =>
          url.endsWith('/issues/12') ? phanHoiTho(200, { state: 'open' }) : url.endsWith('/pulls/34') ? phanHoiTho(418, '') : phanHoiTho(404, ''),
      },
    )
    expect(r.ketQua.map((k) => (k.ok ? k.giaTri.trangThai : k.loi.ma))).toEqual(['MO', 'DU_LIEU_LA', 'KHONG_TIM_THAY'])
  })
})

describe('Edge Function doc-github: token', () => {
  it('thiếu token trong secret (hoặc chỉ khoảng trắng): 503 GITHUB_KHONG_KHA_DUNG, không gọi GitHub', async () => {
    for (const token of [undefined, '', '   ']) {
      const r = await goi({ cacLienKet: [ISSUE_12] }, { token })
      expect(r.status).toBe(503)
      expect(r.json).toEqual({ loi: { ma: 'GITHUB_KHONG_KHA_DUNG', thongBao: THONG_BAO_HAM.thieuToken } })
      expect(r.lanGoi).toHaveLength(0)
    }
  })

  it('token chỉ đi trong tiêu đề Authorization gửi GitHub, không nằm trong URL', async () => {
    const r = await goi({ cacLienKet: [ISSUE_12] }, { github: () => phanHoiTho(200, { state: 'open' }) })
    expect(r.lanGoi[0].yeuCau.headers.Authorization).toBe(`Bearer ${TOKEN_GIA}`)
    expect(r.lanGoi[0].url).not.toContain(TOKEN_GIA)
  })

  it('phản hồi không bao giờ chứa token, kể cả khi GitHub, mạng hay cơ sở dữ liệu nhét token vào nội dung lỗi', async () => {
    const cas: TuyChonGia[] = [
      { github: () => new Error(`fetch failed: Authorization: Bearer ${TOKEN_GIA}`) },
      { github: () => phanHoiTho(200, { state: 'open', ghi_chu: TOKEN_GIA }) },
      { github: () => phanHoiTho(200, `${TOKEN_GIA} không phải json`) },
      { github: () => phanHoiTho(403, { message: `token ${TOKEN_GIA} không đủ quyền` }) },
      { github: () => phanHoiTho(403, { message: `rate limit ${TOKEN_GIA}` }) },
      { github: () => phanHoiTho(401, { message: `Bad credentials ${TOKEN_GIA}` }) },
      { github: () => phanHoiTho(500, TOKEN_GIA) },
      { github: () => phanHoiTho(404, { message: TOKEN_GIA }) },
      { repoDaGanNem: true },
      { dangNhap: false },
    ]
    for (const tuyChon of cas) {
      const r = await goi({ cacLienKet: [ISSUE_12, PR_34] }, tuyChon)
      expect(r.chu).not.toContain(TOKEN_GIA)
    }
    // Thân yêu cầu hỏng, quá giới hạn, hàm bị lỗi bất ngờ: cũng không lộ.
    const gia = dungPhuThuoc()
    gia.phuThuoc.xacThuc = async () => ({
      async repoDaGan() {
        throw new Error(TOKEN_GIA)
      },
    })
    const loi = await xuLyYeuCau(yeuCauPost({ cacLienKet: [ISSUE_12] }), gia.phuThuoc)
    expect(await loi.text()).not.toContain(TOKEN_GIA)
  })
})
