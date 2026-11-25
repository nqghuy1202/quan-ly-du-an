// Cổng GitHub gọi Edge Function (ticket 17), kiểm bằng `fetch` giả: không mạng. Kiểm: chỉ thao tác đọc,
// chưa đăng nhập thì không gọi mạng, gửi đúng thứ cần gửi (và không gì khác), phản hồi của hàm được kiểm
// hình dạng, mọi lỗi thành kết quả có mã, và chọn cổng theo cấu hình môi trường.
import { describe, expect, it } from 'vitest'
import { BIEN_KHOA_SUPABASE, BIEN_URL_SUPABASE } from '../kho/cauHinh'
import { chonKho } from '../kho/chonKho'
import {
  GIOI_HAN_LIEN_KET_MOI_LAN,
  THONG_BAO_GITHUB_MAC_DINH,
  type KetQuaGitHub,
  type LienKetGitHub,
  type TrangThaiLienKet,
} from '../luat/github'
import { CAC_THAO_TAC_CONG_GITHUB, type CongGitHub } from './congGitHub'
import { taoCongGitHubEdge } from './congGitHubEdge'
import { taoCongKhongKhaDung } from './congKhongKhaDung'

const URL_GIA = 'https://du-an-gia.supabase.co'
const KHOA_CONG_KHAI = 'sb_publishable_khoa-gia-123'
const MA_TRUY_CAP = 'jwt-cua-nguoi-dung-gia'
const ISSUE_12: LienKetGitHub = { repo: 'acme/web', loai: 'ISSUE', so: 12 }
const PR_34: LienKetGitHub = { repo: 'acme/web', loai: 'PR', so: 34 }

interface LanFetch {
  url: string
  method: string | undefined
  headers: Record<string, string>
  than: { cacLienKet: LienKetGitHub[] }
}

function fetchGia(xuLy: (lan: LanFetch) => Response | Error) {
  const lanGoi: LanFetch[] = []
  const f: typeof fetch = async (url, init) => {
    const lan: LanFetch = {
      url: String(url),
      method: init?.method,
      headers: { ...(init?.headers as Record<string, string>) },
      than: JSON.parse(String(init?.body)),
    }
    lanGoi.push(lan)
    const kq = xuLy(lan)
    if (kq instanceof Error) throw kq
    return kq
  }
  return { fetch: f, lanGoi }
}

const json = (status: number, than: unknown) =>
  new Response(JSON.stringify(than), { status, headers: { 'Content-Type': 'application/json' } })

const trangThaiMo: KetQuaGitHub<TrangThaiLienKet> = { ok: true, giaTri: { loai: 'ISSUE', trangThai: 'MO' } }

function dungCong(xuLy: (lan: LanFetch) => Response | Error, maTruyCap: string | null = MA_TRUY_CAP) {
  const f = fetchGia(xuLy)
  const cong = taoCongGitHubEdge({
    url: `${URL_GIA}/`,
    khoaCongKhai: KHOA_CONG_KHAI,
    layMaTruyCap: async () => maTruyCap,
    fetch: f.fetch,
  })
  return { cong, ...f }
}

describe('Cổng GitHub gọi Edge Function: chỉ có thao tác đọc', () => {
  it('đúng các thao tác đọc của giao diện CongGitHub, không thêm thao tác nào', () => {
    for (const cong of [dungCong(() => json(200, {})).cong, taoCongKhongKhaDung()]) {
      expect(Object.keys(cong).sort()).toEqual([...CAC_THAO_TAC_CONG_GITHUB].sort())
      for (const ten of Object.keys(cong)) expect(ten).toMatch(/^doc[A-Z]/)
    }
  })
})

describe('Cổng GitHub gọi Edge Function: yêu cầu gửi đi', () => {
  it('gửi POST tới /functions/v1/doc-github với mã truy cập của người dùng, khoá công khai và chỉ (repo, loại, số)', async () => {
    const { cong, lanGoi } = dungCong(() => json(200, { ketQua: [trangThaiMo] }))
    const kq = await cong.docTrangThai({ ...ISSUE_12, ...({ duongDan: 'https://github.com/x', token: 'x' } as object) })
    expect(kq).toEqual(trangThaiMo)
    expect(lanGoi).toHaveLength(1)
    expect(lanGoi[0].url).toBe(`${URL_GIA}/functions/v1/doc-github`)
    expect(lanGoi[0].method).toBe('POST')
    expect(lanGoi[0].headers).toEqual({
      Authorization: `Bearer ${MA_TRUY_CAP}`,
      apikey: KHOA_CONG_KHAI,
      'Content-Type': 'application/json',
    })
    expect(lanGoi[0].than).toEqual({ cacLienKet: [ISSUE_12] })
  })

  it('đọc nhiều link bằng một lần gọi, đúng thứ tự; danh sách rỗng không gọi mạng', async () => {
    const mong: KetQuaGitHub<TrangThaiLienKet>[] = [
      trangThaiMo,
      { ok: true, giaTri: { loai: 'PR', trangThai: 'DA_MERGE' } },
      { ok: false, loi: { ma: 'RIENG_TU', thongBao: THONG_BAO_GITHUB_MAC_DINH.RIENG_TU } },
    ]
    const { cong, lanGoi } = dungCong(() => json(200, { ketQua: mong }))
    expect(await cong.docNhieuTrangThai([ISSUE_12, PR_34, { ...ISSUE_12, so: 3 }])).toEqual(mong)
    expect(lanGoi).toHaveLength(1)
    expect(await cong.docNhieuTrangThai([])).toEqual([])
    expect(lanGoi).toHaveLength(1)
  })

  it('nhiều hơn giới hạn của hàm thì chia thành nhiều lần gọi, vẫn đúng thứ tự', async () => {
    const tong = GIOI_HAN_LIEN_KET_MOI_LAN * 2 + 3
    const cacLienKet = Array.from({ length: tong }, (_, i): LienKetGitHub => ({ ...ISSUE_12, so: i + 1 }))
    const { cong, lanGoi } = dungCong((lan) =>
      json(200, { ketQua: lan.than.cacLienKet.map((l) => ({ ok: true, giaTri: { loai: 'ISSUE', trangThai: l.so % 2 ? 'MO' : 'DONG' } })) }),
    )
    const kq = await cong.docNhieuTrangThai(cacLienKet)
    expect(lanGoi.map((l) => l.than.cacLienKet.length)).toEqual([GIOI_HAN_LIEN_KET_MOI_LAN, GIOI_HAN_LIEN_KET_MOI_LAN, 3])
    expect(kq.map((k) => (k.ok ? k.giaTri.trangThai : 'LOI'))).toEqual(cacLienKet.map((l) => (l.so % 2 ? 'MO' : 'DONG')))
  })
})

describe('Cổng GitHub gọi Edge Function: lỗi thành kết quả có mã, không ném', () => {
  it('chưa có mã truy cập (chưa đăng nhập): GITHUB_KHONG_KHA_DUNG và không gọi mạng', async () => {
    const { cong, lanGoi } = dungCong(() => json(200, { ketQua: [] }), null)
    expect(await cong.docNhieuTrangThai([ISSUE_12, PR_34])).toEqual([
      { ok: false, loi: { ma: 'GITHUB_KHONG_KHA_DUNG', thongBao: THONG_BAO_GITHUB_MAC_DINH.GITHUB_KHONG_KHA_DUNG } },
      { ok: false, loi: { ma: 'GITHUB_KHONG_KHA_DUNG', thongBao: THONG_BAO_GITHUB_MAC_DINH.GITHUB_KHONG_KHA_DUNG } },
    ])
    expect(lanGoi).toHaveLength(0)
  })

  it('lấy mã truy cập ném lỗi: coi như chưa đăng nhập', async () => {
    const f = fetchGia(() => json(200, {}))
    const cong = taoCongGitHubEdge({
      url: URL_GIA,
      khoaCongKhai: KHOA_CONG_KHAI,
      layMaTruyCap: async () => {
        throw new Error('hỏng')
      },
      fetch: f.fetch,
    })
    expect(await cong.docTrangThai(ISSUE_12)).toMatchObject({ ok: false, loi: { ma: 'GITHUB_KHONG_KHA_DUNG' } })
    expect(f.lanGoi).toHaveLength(0)
  })

  it('mất mạng (fetch ném lỗi): MAT_MANG cho từng link', async () => {
    const { cong } = dungCong(() => new Error('Failed to fetch'))
    expect(await cong.docNhieuTrangThai([ISSUE_12, PR_34])).toEqual([
      { ok: false, loi: { ma: 'MAT_MANG', thongBao: THONG_BAO_GITHUB_MAC_DINH.MAT_MANG } },
      { ok: false, loi: { ma: 'MAT_MANG', thongBao: THONG_BAO_GITHUB_MAC_DINH.MAT_MANG } },
    ])
  })

  it('hàm chưa triển khai (404 của nền tảng): GITHUB_KHONG_KHA_DUNG', async () => {
    const { cong } = dungCong(() => json(404, { message: 'Function not found' }))
    expect(await cong.docTrangThai(ISSUE_12)).toMatchObject({ ok: false, loi: { ma: 'GITHUB_KHONG_KHA_DUNG' } })
  })

  it('hàm báo lỗi chung đúng hình (401, 503): dùng mã và thông báo của hàm', async () => {
    const { cong } = dungCong(() => json(503, { loi: { ma: 'GITHUB_KHONG_KHA_DUNG', thongBao: 'Chưa có token.' } }))
    expect(await cong.docTrangThai(ISSUE_12)).toEqual({ ok: false, loi: { ma: 'GITHUB_KHONG_KHA_DUNG', thongBao: 'Chưa có token.' } })
  })

  it('hàm lỗi 500 hay trả thân lạ: MAT_MANG hoặc GITHUB_KHONG_KHA_DUNG, thông báo mặc định', async () => {
    expect(await dungCong(() => json(500, 'x')).cong.docTrangThai(ISSUE_12)).toMatchObject({ ok: false, loi: { ma: 'MAT_MANG' } })
    expect(await dungCong(() => new Response('<html>', { status: 401 })).cong.docTrangThai(ISSUE_12)).toEqual({
      ok: false,
      loi: { ma: 'GITHUB_KHONG_KHA_DUNG', thongBao: THONG_BAO_GITHUB_MAC_DINH.GITHUB_KHONG_KHA_DUNG },
    })
  })

  it('200 nhưng sai hình: DU_LIEU_LA, không tin phản hồi của hàm', async () => {
    const lech = { ok: false, loi: { ma: 'DU_LIEU_LA', thongBao: THONG_BAO_GITHUB_MAC_DINH.DU_LIEU_LA } }
    for (const than of [
      new Response('không phải json', { status: 200 }),
      json(200, null),
      json(200, {}),
      json(200, { ketQua: 'x' }),
      json(200, { ketQua: [] }),
      json(200, { ketQua: [trangThaiMo, trangThaiMo] }),
    ]) {
      expect(await dungCong(() => than.clone()).cong.docTrangThai(ISSUE_12)).toEqual(lech)
    }
    const phanTuLa = [
      null,
      'x',
      { ok: 'co' },
      { ok: true },
      { ok: true, giaTri: { loai: 'PR', trangThai: 'MO' } },
      { ok: true, giaTri: { loai: 'ISSUE', trangThai: 'LUNG_TUNG' } },
      { ok: true, giaTri: { loai: 'ISSUE', trangThai: 'DA_MERGE' } },
    ]
    for (const phanTu of phanTuLa) {
      expect(await dungCong(() => json(200, { ketQua: [phanTu] })).cong.docTrangThai(ISSUE_12), JSON.stringify(phanTu)).toEqual(lech)
    }
  })

  it('lỗi riêng từng link: mã lạ thành DU_LIEU_LA, mã đúng giữ nguyên, kèm thông báo của hàm nếu có', async () => {
    const { cong } = dungCong(() =>
      json(200, {
        ketQua: [
          { ok: false, loi: { ma: 'HET_LUOT_GOI', thongBao: 'Hết lượt.' } },
          { ok: false, loi: { ma: 'MA_LA', thongBao: 'x' } },
          { ok: false, loi: { ma: 'KHONG_TIM_THAY' } },
        ],
      }),
    )
    expect(await cong.docNhieuTrangThai([ISSUE_12, PR_34, { ...ISSUE_12, so: 3 }])).toEqual([
      { ok: false, loi: { ma: 'HET_LUOT_GOI', thongBao: 'Hết lượt.' } },
      { ok: false, loi: { ma: 'DU_LIEU_LA', thongBao: THONG_BAO_GITHUB_MAC_DINH.DU_LIEU_LA } },
      { ok: false, loi: { ma: 'KHONG_TIM_THAY', thongBao: THONG_BAO_GITHUB_MAC_DINH.KHONG_TIM_THAY } },
    ])
  })
})

describe('Cổng chưa cấu hình', () => {
  it('trả GITHUB_KHONG_KHA_DUNG cho mọi link thay vì chết, không mạng', async () => {
    const cong: CongGitHub = taoCongKhongKhaDung()
    const mong = { ok: false, loi: { ma: 'GITHUB_KHONG_KHA_DUNG', thongBao: THONG_BAO_GITHUB_MAC_DINH.GITHUB_KHONG_KHA_DUNG } }
    expect(await cong.docTrangThai(ISSUE_12)).toEqual(mong)
    expect(await cong.docNhieuTrangThai([ISSUE_12, PR_34])).toEqual([mong, mong])
    expect(await cong.docNhieuTrangThai([])).toEqual([])
  })
})

describe('chọn Cổng GitHub theo cấu hình môi trường', () => {
  it('có cấu hình Supabase: cổng gọi hàm; chưa đăng nhập thì không gọi mạng và trả GITHUB_KHONG_KHA_DUNG', async () => {
    const f = fetchGia(() => new Error('Test không được gọi mạng'))
    const chon = chonKho({ [BIEN_URL_SUPABASE]: URL_GIA, [BIEN_KHOA_SUPABASE]: KHOA_CONG_KHAI }, { fetch: f.fetch })
    if (chon.loai !== 'SUPABASE') throw new Error(`Mong đợi bản Supabase, nhận ${chon.loai}`)
    expect(await chon.congGitHub.docTrangThai(ISSUE_12)).toMatchObject({ ok: false, loi: { ma: 'GITHUB_KHONG_KHA_DUNG' } })
    expect(f.lanGoi).toHaveLength(0)
  })

  it('không có cấu hình Supabase (bản bộ nhớ): cổng giả, không mạng', async () => {
    const chon = chonKho({ DEV: true })
    if (chon.loai !== 'BO_NHO') throw new Error(`Mong đợi bản bộ nhớ, nhận ${chon.loai}`)
    expect(await chon.congGitHub.docTrangThai(ISSUE_12)).toMatchObject({ ok: false, loi: { ma: 'MAT_MANG' } })
  })
})
