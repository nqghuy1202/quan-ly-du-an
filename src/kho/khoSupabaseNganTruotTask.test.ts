// Ngăn trượt Task của bản Supabase trong 6 lượt gọi (ticket toi-uu-hieu-nang 04), không cần mạng hay DB: máy chủ là
// một `fetch` giả trong bộ nhớ đóng vai PostgREST, ghi lại mọi địa chỉ được gọi để đếm lượt.
//
// Mở Ngăn trượt Task gọi các lệnh: `layTask`, `layDuAn`, `danhSachNguoiTrongDuAn` (NganTruotTask.tsx),
// `lichSuTask` (PhanLichSuTask.tsx), `danhSachLienKetCuaTask` (PhanLienKetTask.tsx), `danhSachDuAnCuaToi`
// (PhanChuyenTrangThaiTask.tsx). Một lượt gọi là một yêu cầu tới PostgREST (`/rest/v1/`: đọc bảng hoặc gọi hàm);
// không tính Auth (`/auth/v1/`) và Cổng GitHub (Edge Function, không đi qua Kho), đúng cách đếm của spec
// `.scratch/toi-uu-hieu-nang/spec.md`.
//
// `fetch` giả bắt chước thô phân quyền từng dòng (PM thấy mọi Dự án; người khác Dự án mình ở trong; Task, link theo
// Dự án; hồ sơ theo ho_so_doc), lọc `eq.`/`in.(...)`, xếp `order`, trang `offset`/`limit`, nhúng bảng theo khoá
// ngoại (kể cả nhúng lồng và `bảng.order` cho bảng nhúng), các hàm tên người, lich_su_task và doi_trang_thai_task.
// `giu` cho phép giữ phản hồi lại (đã tính xong lúc nhận yêu cầu) để dựng tình huống lệnh đọc còn đang bay.
import { describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import type { Phien } from './khoDuLieu'
import { taoKhoSupabase, type KhoSupabase } from './khoSupabase'

/** JWT giả (chữ ký không hợp lệ), như cauHinh.test.ts. */
function jwtGia(than: Record<string, unknown>): string {
  const ma = (doiTuong: Record<string, unknown>) =>
    btoa(JSON.stringify(doiTuong)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${ma({ alg: 'HS256', typ: 'JWT' })}.${ma(than)}.chu-ky-gia`
}

const URL_GIA = 'https://ngan-truot-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'ngan-truot-gia', role: 'anon' })
const MAT_KHAU = 'matkhau-dung-1'

/** Trần lượt gọi của ticket. */
const TRAN = 6

type Dong = Record<string, unknown>

const id = (so: number) => `00000000-0000-4000-8000-${String(so).padStart(12, '0')}`
const ID = {
  pm: id(1),
  an: id(2),
  binh: id(3),
  chi: id(4),
  dung: id(5),
  duAn: id(100),
  duAnKhac: id(101),
  taskNgan: id(1000),
  taskDai: id(1001),
  taskKhac: id(2000),
  khongCo: id(1999),
}

interface GiuPhanHoi {
  /** Yêu cầu nào bị giữ phản hồi (chỉ yêu cầu khớp ĐẦU TIÊN). */
  neu(url: URL, phuongThuc: string): boolean
  /** Phản hồi (đã tính xong lúc nhận yêu cầu) chỉ trả về khi lời hứa này xong. */
  cho: Promise<void>
}

interface DuLieuGia {
  hoSo: Dong[]
  duAn: Dong[]
  thanhVien: Dong[]
  task: Dong[]
  lienKet: Dong[]
  lichSu: Dong[]
  /** Mọi địa chỉ đã gọi. */
  diaChi: string[]
  giu: GiuPhanHoi | null
}

function hoSoGia(so: number, khoa: string, ten: string, vai: string): Dong {
  return {
    id: id(so),
    email: `${khoa}@vi-du.vn`,
    ten_hien_thi: ten,
    github_username: null,
    vai,
    so_dien_thoai: null,
    chuc_danh: null,
    phong_ban: null,
  }
}

function duAnGia(so: number, ten: string): Dong {
  return {
    id: id(so),
    ma: `DA-${so}`,
    ten,
    mo_ta: '',
    khach_hang: 'Khách A',
    ngay_bat_dau: '2026-01-01',
    ngay_ket_thuc_du_kien: '2026-12-31',
    muc_uu_tien: 'CAO',
    nguoi_phu_trach_id: ID.chi,
    trang_thai: 'HOAT_DONG',
    tao_boi: ID.pm,
    tao_luc: '2026-05-01T02:00:00+00:00',
    sua_boi: ID.chi,
    sua_luc: '2026-05-20T02:00:00+00:00',
  }
}

function taskGia(so: number, duAnId: string, lam: string, kiem: string, trangThai: string, k: number): Dong {
  return {
    id: id(so),
    du_an_id: duAnId,
    tieu_de: `Task ${so}`,
    mo_ta: `Mô tả ${so}`,
    han: k % 2 === 0 ? null : '2026-06-15',
    muc_uu_tien: 'TRUNG_BINH',
    nguoi_thuc_hien_id: lam,
    nguoi_kiem_tra_id: kiem,
    trang_thai: trangThai,
    so_lan_tra_lai: 0,
    tao_boi: ID.pm,
    tao_luc: `2026-05-${String(1 + (k % 28)).padStart(2, '0')}T02:00:00+00:00`,
    sua_boi: k % 2 === 1 ? ID.chi : null,
    sua_luc: k % 2 === 1 ? '2026-05-21T02:00:00+00:00' : null,
  }
}

const TRANG_THAI = ['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI', 'HOAN_THANH', 'HUY']

/**
 * Dữ liệu giả. Dự án chính: Chi (Support), An (Thành viên). Task ngắn: An làm, Chi kiểm, một dòng lịch sử, một link.
 * Task dài: Dũng làm (Dũng chỉ ở Dự án khác: dấu "đã rời dự án"), 30 dòng lịch sử trạng thái và Mức ưu tiên, 12 link.
 * Dự án chính có thêm 10 Task (bộ đếm Task đang giữ). Bình không ở Dự án nào. Dự án khác có Task riêng.
 */
function dungDuLieu(): DuLieuGia {
  const du: DuLieuGia = {
    hoSo: [
      hoSoGia(1, 'pm', 'Pm', 'PM'),
      hoSoGia(2, 'an', 'An', 'THANH_VIEN'),
      hoSoGia(3, 'binh', 'Bình', 'THANH_VIEN'),
      hoSoGia(4, 'chi', 'Chi', 'SUPPORT'),
      hoSoGia(5, 'dung', 'Dũng', 'THANH_VIEN'),
    ],
    duAn: [duAnGia(100, 'Dự án chính'), duAnGia(101, 'Dự án khác')],
    thanhVien: [
      { du_an_id: ID.duAn, nguoi_dung_id: ID.chi, vai_tro: 'Trưởng nhóm' },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.an, vai_tro: null },
      { du_an_id: ID.duAnKhac, nguoi_dung_id: ID.dung, vai_tro: null },
    ],
    task: [
      taskGia(1000, ID.duAn, ID.an, ID.chi, 'MOI', 0),
      taskGia(1001, ID.duAn, ID.dung, ID.an, 'DANG_LAM', 1),
      taskGia(2000, ID.duAnKhac, ID.dung, ID.dung, 'DANG_LAM', 2),
    ],
    lienKet: [],
    lichSu: [],
    diaChi: [],
    giu: null,
  }
  for (let k = 0; k < 10; k++) {
    du.task.push(taskGia(1100 + k, ID.duAn, k % 2 === 0 ? ID.an : ID.chi, ID.chi, TRANG_THAI[k % TRANG_THAI.length], k))
  }
  du.lienKet.push({ task_id: ID.taskNgan, repo: 'cong-ty/web', loai: 'ISSUE', so: 7, thu_tu: 1 })
  // Thứ tự thêm (thu_tu) khác thứ tự dòng trong bảng: kết quả phải theo thu_tu.
  for (let k = 0; k < 12; k++) {
    du.lienKet.push({ task_id: ID.taskDai, repo: `cong-ty/repo-${k % 3}`, loai: k % 2 === 0 ? 'PR' : 'ISSUE', so: 100 + k, thu_tu: 50 - k })
  }
  du.lienKet.push({ task_id: ID.taskKhac, repo: 'cong-ty/khac', loai: 'PR', so: 1, thu_tu: 99 })
  du.lichSu.push({ task_id: ID.taskNgan, stt: 1, loai: 'MUC_UU_TIEN', nguoi_doi_id: ID.chi, luc: '2026-05-02T02:00:00+00:00', tu: 'THAP', sang: 'TRUNG_BINH', ly_do: null })
  for (let k = 0; k < 30; k++) {
    du.lichSu.push({
      task_id: ID.taskDai,
      stt: k + 1,
      loai: k % 5 === 0 ? 'MUC_UU_TIEN' : 'TRANG_THAI',
      nguoi_doi_id: k % 2 === 0 ? ID.chi : ID.dung,
      luc: `2026-05-${String(1 + k).padStart(2, '0')}T03:00:00+00:00`,
      tu: k % 5 === 0 ? 'THAP' : 'DANG_LAM',
      sang: k % 5 === 0 ? 'CAO' : 'CHO_DUYET',
      ly_do: k % 3 === 0 ? `Lý do ${k}` : null,
    })
  }
  du.lichSu.push({ task_id: ID.taskKhac, stt: 1, loai: 'TRANG_THAI', nguoi_doi_id: ID.dung, luc: '2026-05-02T02:00:00+00:00', tu: 'MOI', sang: 'DANG_LAM', ly_do: null })
  return du
}

function tra(trangThai: number, than?: unknown): Response {
  return new Response(than === undefined ? null : JSON.stringify(than), {
    status: trangThai,
    headers: { 'content-type': 'application/json' },
  })
}

function traLoi(trangThai: number, code: string, message: string): Response {
  return tra(trangThai, { code, message, details: null, hint: null })
}

/** Tham số không phải bộ lọc của bảng chính (kể cả `bảng_nhúng.order`, `bảng_nhúng.limit`). */
function laThamSoKhongLoc(khoa: string): boolean {
  return ['select', 'order', 'offset', 'limit', 'columns'].includes(khoa) || khoa.includes('.')
}

/** Lọc dòng theo `cot=eq.x` và `cot=in.(x,y)` của PostgREST. */
function loc(dong: readonly Dong[], thamSo: URLSearchParams): Dong[] {
  return dong.filter((d) => {
    for (const [khoa, giaTri] of thamSo) {
      if (laThamSoKhongLoc(khoa)) continue
      if (giaTri.startsWith('eq.') && String(d[khoa]) !== giaTri.slice(3)) return false
      if (giaTri.startsWith('in.(')) {
        const cacGiaTri = giaTri.slice(4, -1).split(',').map((g) => g.replace(/^"|"$/g, ''))
        if (!cacGiaTri.includes(String(d[khoa]))) return false
      }
    }
    return true
  })
}

/** Xếp theo `order` (vd. `cot.desc,cot2.asc`) rồi cắt theo `offset`, `limit`; số so như số, còn lại như chuỗi. */
function xepVaCat(dong: readonly Dong[], order: string | null, offset: string | null, limit: string | null): Dong[] {
  const thuTu = (order ?? '')
    .split(',')
    .filter((p) => p !== '')
    .map((p) => {
      const [cot, chieu] = p.split('.')
      return { cot, giam: chieu === 'desc' }
    })
  const xep = [...dong].sort((a, b) => {
    for (const { cot, giam } of thuTu) {
      const x = a[cot]
      const y = b[cot]
      if (x === y) continue
      const nho = typeof x === 'number' && typeof y === 'number' ? x < y : String(x ?? '') < String(y ?? '')
      return (nho ? -1 : 1) * (giam ? -1 : 1)
    }
    return 0
  })
  const tu = Number(offset ?? 0)
  return limit === null ? xep.slice(tu) : xep.slice(tu, tu + Number(limit))
}

/** Một mục của `select`: cột thường, hoặc bảng nhúng (`bang!khoa(...)`) kèm các mục con. */
interface MucChon {
  ten: string
  con: MucChon[] | null
}

/** Phân tích `select` của PostgREST, kể cả nhúng lồng. */
function phanTichChon(chuoi: string): MucChon[] {
  let i = 0
  const tao = (ten: string, con: MucChon[] | null): MucChon => ({ ten: ten.trim().split('!')[0], con })
  function doc(): MucChon[] {
    const ds: MucChon[] = []
    let ten = ''
    while (i < chuoi.length) {
      const c = chuoi[i]
      i += 1
      if (c === '(') {
        ds.push(tao(ten, doc()))
        ten = ''
      } else if (c === ')') {
        break
      } else if (c === ',') {
        if (ten.trim() !== '') ds.push(tao(ten, null))
        ten = ''
      } else {
        ten += c
      }
    }
    if (ten.trim() !== '') ds.push(tao(ten, null))
    return ds
  }
  return doc()
}

/** Quan hệ nhúng: bảng đích, một dòng hay nhiều dòng, và cách nối. */
interface QuanHe {
  bang: string
  motDong: boolean
  noi(cha: Dong, con: Dong): boolean
}

const QUAN_HE: Record<string, Record<string, QuanHe>> = {
  task: {
    du_an: { bang: 'du_an', motDong: true, noi: (t, d) => d.id === t.du_an_id },
    lien_ket_task: { bang: 'lien_ket_task', motDong: false, noi: (t, l) => l.task_id === t.id },
  },
  du_an: {
    nguoi_trong_du_an: { bang: 'nguoi_trong_du_an', motDong: false, noi: (d, n) => n.du_an_id === d.id },
  },
  nguoi_trong_du_an: {
    ho_so: { bang: 'ho_so', motDong: true, noi: (n, h) => h.id === n.nguoi_dung_id },
    du_an: { bang: 'du_an', motDong: true, noi: (n, d) => d.id === n.du_an_id },
  },
}

function taoFetchGia(du: DuLieuGia): typeof fetch {
  async function xuLy(url: URL, init: RequestInit | undefined): Promise<Response> {
    const phuongThuc = (init?.method ?? 'GET').toUpperCase()
    const than = typeof init?.body === 'string' && init.body !== '' ? (JSON.parse(init.body) as Dong) : {}
    const tieuDe = new Headers(init?.headers)

    if (url.pathname === '/auth/v1/token') {
      const nguoi = du.hoSo.find((h) => h.email === than.email)
      if (!nguoi) return tra(400, { code: 'invalid_grant', error_code: 'invalid_grant', msg: 'sai' })
      return tra(200, {
        access_token: `token-${String(nguoi.id)}`,
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: `lam-moi-${String(nguoi.id)}`,
        user: {
          id: nguoi.id,
          aud: 'authenticated',
          role: 'authenticated',
          email: nguoi.email,
          app_metadata: {},
          user_metadata: {},
          created_at: '2026-01-01T00:00:00+00:00',
        },
      })
    }
    if (url.pathname.startsWith('/auth/v1/')) return tra(204)

    const maTruyCap = /^Bearer (token-.+)$/.exec(tieuDe.get('authorization') ?? '')?.[1]
    const nguoiGoi = du.hoSo.find((h) => `token-${String(h.id)}` === maTruyCap)
    if (!nguoiGoi) return traLoi(401, 'PGRST301', 'JWT expired')
    const laPM = nguoiGoi.vai === 'PM'
    const laThanhVien = (duAnId: unknown, nguoiId: unknown) =>
      du.thanhVien.some((t) => t.du_an_id === duAnId && t.nguoi_dung_id === nguoiId)
    const duAnThay = (duAnId: unknown) => laPM || laThanhVien(duAnId, nguoiGoi.id)
    const taskThay = (taskId: unknown) => du.task.some((t) => t.id === taskId && duAnThay(t.du_an_id))
    // ho_so_doc: của mình, PM, hoặc người kia ở trong một Dự án người gọi thấy được.
    const thayHoSo = (hoSoId: unknown) =>
      hoSoId === nguoiGoi.id || laPM || du.thanhVien.some((t) => t.nguoi_dung_id === hoSoId && duAnThay(t.du_an_id))
    /** Dòng mỗi bảng mà người gọi đọc được (phân quyền từng dòng). */
    const bangThay = (bang: string): Dong[] | null => {
      if (bang === 'ho_so') return du.hoSo.filter((h) => thayHoSo(h.id))
      if (bang === 'du_an') return du.duAn.filter((d) => duAnThay(d.id))
      if (bang === 'nguoi_trong_du_an') return du.thanhVien.filter((t) => duAnThay(t.du_an_id))
      if (bang === 'task') return du.task.filter((t) => duAnThay(t.du_an_id))
      if (bang === 'lien_ket_task') return du.lienKet.filter((l) => taskThay(l.task_id))
      return null
    }
    /** Chiếu một dòng theo `select`, nhúng bảng con (đã qua phân quyền từng dòng) theo `QUAN_HE`. */
    const chieu = (bang: string, dong: Dong, chon: readonly MucChon[]): Dong => {
      if (chon.length === 0 || chon.some((m) => m.ten === '*')) return { ...dong }
      const ketQua: Dong = {}
      for (const muc of chon) {
        if (muc.con === null) {
          ketQua[muc.ten] = dong[muc.ten]
          continue
        }
        const qh = QUAN_HE[bang]?.[muc.ten]
        if (!qh) throw new Error(`Không nhúng được ${muc.ten} vào ${bang}`)
        const khop = (bangThay(qh.bang) ?? []).filter((con) => qh.noi(dong, con))
        if (qh.motDong) {
          ketQua[muc.ten] = khop[0] ? chieu(qh.bang, khop[0], muc.con) : null
        } else {
          const tham = url.searchParams
          const xep = xepVaCat(khop, tham.get(`${muc.ten}.order`), null, tham.get(`${muc.ten}.limit`))
          ketQua[muc.ten] = xep.map((con) => chieu(qh.bang, con, muc.con ?? []))
        }
      }
      return ketQua
    }
    const motDoiTuong = (tieuDe.get('accept') ?? '').includes('vnd.pgrst.object')
    const traDong = (dong: Dong[]) => tra(200, motDoiTuong ? (dong[0] ?? null) : dong)
    const ten = (nguoiId: unknown) => String(du.hoSo.find((h) => h.id === nguoiId)?.ten_hien_thi ?? '')

    if (phuongThuc === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) {
      const ham = url.pathname.slice('/rest/v1/rpc/'.length)
      if (ham === 'ten_nguoi_dau_vet' || ham === 'ten_nguoi_cua_task') {
        const ids = (than.p_ids as string[]) ?? []
        return tra(200, du.hoSo.filter((h) => ids.includes(String(h.id))).map((h) => ({ id: h.id, ten_hien_thi: h.ten_hien_thi })))
      }
      if (ham === 'lich_su_task') {
        if (!taskThay(than.p_task_id)) return traLoi(400, 'P0001', 'KHONG_TIM_THAY')
        return tra(
          200,
          du.lichSu
            .filter((l) => l.task_id === than.p_task_id)
            .map((l) => ({ stt: l.stt, loai: l.loai, nguoi_doi_id: l.nguoi_doi_id, ten_hien_thi: ten(l.nguoi_doi_id), luc: l.luc, tu: l.tu, sang: l.sang, ly_do: l.ly_do })),
        )
      }
      if (ham === 'doi_trang_thai_task') {
        // Không mô phỏng luật (luật thuần đã kiểm phía client): đổi trạng thái và ghi một dòng lịch sử.
        const task = du.task.find((t) => t.id === than.p_task_id)
        if (!task || !taskThay(task.id)) return traLoi(400, 'P0001', 'KHONG_TIM_THAY')
        const stt = du.lichSu.filter((l) => l.task_id === task.id).length + 1
        du.lichSu.push({ task_id: task.id, stt, loai: 'TRANG_THAI', nguoi_doi_id: nguoiGoi.id, luc: '2026-06-01T02:00:00+00:00', tu: task.trang_thai, sang: than.p_sang, ly_do: than.p_ly_do ?? null })
        task.trang_thai = than.p_sang
        task.sua_boi = nguoiGoi.id
        task.sua_luc = '2026-06-01T02:00:00+00:00'
        return tra(204)
      }
      return traLoi(404, 'PGRST202', `Không có hàm ${ham}`)
    }

    const bang = url.pathname.slice('/rest/v1/'.length)
    const goc = bangThay(bang)
    if (phuongThuc === 'GET' && goc) {
      const tham = url.searchParams
      const dong = xepVaCat(loc(goc, tham), tham.get('order'), tham.get('offset'), tham.get('limit'))
      const chon = phanTichChon(tham.get('select') ?? '*')
      return traDong(dong.map((d) => chieu(bang, d, chon)))
    }
    return traLoi(404, 'PGRST000', `Yêu cầu không mong đợi: ${phuongThuc} ${url.pathname}`)
  }

  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    du.diaChi.push(url.href)
    if (url.origin !== URL_GIA) throw new Error(`Test không được gọi ra ngoài: ${url.href}`)
    const phanHoi = await xuLy(url, init)
    const giu = du.giu
    if (giu && giu.neu(url, (init?.method ?? 'GET').toUpperCase())) {
      du.giu = null
      await giu.cho
    }
    return phanHoi
  }
}

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

type TenNguoi = 'pm' | 'an' | 'binh' | 'chi'

interface BoiCanh {
  du: DuLieuGia
  kho: KhoSupabase
  dangNhap(ten: TenNguoi): Promise<Phien>
  /** Các địa chỉ PostgREST (lượt gọi tính vào trần) mà `lam` gọi tới. */
  luotGoi<T>(lam: () => Promise<T>): Promise<{ ketQua: T; diaChi: string[] }>
}

function dungBoiCanh(du: DuLieuGia = dungDuLieu()): BoiCanh {
  const kho = taoKhoSupabase({ url: URL_GIA, khoaCongKhai: KHOA_ANON, tuDongLamMoiPhien: false, fetch: taoFetchGia(du) })
  return {
    du,
    kho,
    dangNhap: async (ten) => giaTri(await kho.dangNhap({ email: `${ten}@vi-du.vn`, matKhau: MAT_KHAU })),
    async luotGoi(lam) {
      const tu = du.diaChi.length
      const ketQua = await lam()
      const diaChi = du.diaChi.slice(tu).filter((d) => new URL(d).pathname.startsWith('/rest/v1/'))
      return { ketQua, diaChi }
    },
  }
}

/** Các lệnh Ngăn trượt Task gọi khi mở (thứ tự như các phần của ngăn gọi), cùng lúc. */
function moNgan(kho: KhoSupabase, phien: Phien | null, taskId: string, duAnId: string) {
  return Promise.all([
    kho.layTask(phien, taskId),
    kho.layDuAn(phien, duAnId),
    kho.danhSachNguoiTrongDuAn(phien, duAnId),
    kho.lichSuTask(phien, taskId),
    kho.danhSachLienKetCuaTask(phien, taskId),
    kho.danhSachDuAnCuaToi(phien),
  ])
}

/** Cùng các lệnh, gọi lần lượt. */
async function goiLanLuot(kho: KhoSupabase, phien: Phien | null, taskId: string, duAnId: string) {
  const task = await kho.layTask(phien, taskId)
  const duAn = await kho.layDuAn(phien, duAnId)
  const nguoi = await kho.danhSachNguoiTrongDuAn(phien, duAnId)
  const lichSu = await kho.lichSuTask(phien, taskId)
  const lienKet = await kho.danhSachLienKetCuaTask(phien, taskId)
  const cuaToi = await kho.danhSachDuAnCuaToi(phien)
  return [task, duAn, nguoi, lichSu, lienKet, cuaToi] as const
}

const CO_TASK = [
  { ten: 'Task có lịch sử ngắn, một link', taskId: ID.taskNgan, soLichSu: 1, soLienKet: 1 },
  { ten: 'Task có lịch sử dài (30 dòng), 12 link, Người thực hiện đã rời dự án', taskId: ID.taskDai, soLichSu: 30, soLienKet: 12 },
] as const

describe('bản Supabase: mở Ngăn trượt Task trong nhiều nhất 6 lượt gọi', () => {
  describe.each(CO_TASK)('$ten', ({ taskId, soLichSu, soLienKet }) => {
    it.each(['pm', 'chi', 'an'] as const)('%s: các lệnh gọi cùng lúc tốn nhiều nhất 6 lượt, kết quả bằng gọi lần lượt', async (ten) => {
      const { du, kho, dangNhap, luotGoi } = dungBoiCanh()
      const phien = await dangNhap(ten)
      const cungLuc = await luotGoi(() => moNgan(kho, phien, taskId, ID.duAn))
      expect(cungLuc.diaChi.length).toBeLessThanOrEqual(TRAN)
      const lanLuot = await goiLanLuot(kho, phien, taskId, ID.duAn)
      expect(cungLuc.ketQua).toEqual(lanLuot)

      const [kqTask, kqDuAn, kqNguoi, kqLichSu, kqLienKet, kqCuaToi] = cungLuc.ketQua
      const task = giaTri(kqTask)
      const dongTask = du.task.find((t) => t.id === taskId) as Dong
      expect(task).toMatchObject({ id: taskId, duAnId: ID.duAn, tieuDe: dongTask.tieu_de, trangThai: dongTask.trang_thai })
      expect(task.dauVet.taoBoi).toEqual({ id: ID.pm, tenHienThi: 'Pm' })
      expect(task.nguoiKiemTra.daRoiDuAn).toBeUndefined()
      expect(task.nguoiThucHien.daRoiDuAn === true).toBe(dongTask.nguoi_thuc_hien_id === ID.dung)
      expect(task.nguoiThucHien.tenHienThi).toBe(dongTask.nguoi_thuc_hien_id === ID.dung ? 'Dũng' : 'An')
      expect(giaTri(kqDuAn)).toMatchObject({ id: ID.duAn, trangThai: 'HOAT_DONG' })
      expect(giaTri(kqDuAn).dauVet.suaBoi).toEqual({ id: ID.chi, tenHienThi: 'Chi' })
      const nguoi = giaTri(kqNguoi)
      expect(nguoi.map((n) => n.id).sort()).toEqual([ID.an, ID.chi].sort())
      expect(nguoi.find((n) => n.id === ID.chi)?.vaiTroTrongDuAn).toBe('Trưởng nhóm')
      for (const n of nguoi) {
        const dangGiu = du.task.filter(
          (t) => t.du_an_id === ID.duAn && t.nguoi_thuc_hien_id === n.id && t.trang_thai !== 'HOAN_THANH' && t.trang_thai !== 'HUY',
        ).length
        expect(n.soTaskDangGiu).toBe(dangGiu)
      }
      const lichSu = giaTri(kqLichSu)
      expect(lichSu).toHaveLength(soLichSu)
      expect(lichSu.some((l) => l.loai === 'MUC_UU_TIEN')).toBe(true)
      const lienKet = giaTri(kqLienKet)
      const mongDoiLienKet = [...du.lienKet.filter((l) => l.task_id === taskId)].sort((a, b) => Number(a.thu_tu) - Number(b.thu_tu))
      expect(lienKet.map((l) => [l.repo, l.loai, l.so])).toEqual(mongDoiLienKet.map((l) => [l.repo, l.loai, l.so]))
      expect(lienKet).toHaveLength(soLienKet)
      expect(lienKet[0].duongDan).toMatch(/^https:\/\/github\.com\//)
      expect(giaTri(kqCuaToi).map((d) => d.id)).toEqual(ten === 'pm' ? [] : [ID.duAn])
    })
  })

  it('số lượt gọi không tăng theo độ dài lịch sử hay số link', async () => {
    const dem = async (taskId: string) => {
      const { kho, dangNhap, luotGoi } = dungBoiCanh()
      const pm = await dangNhap('pm')
      const an = await dangNhap('an')
      return {
        pm: (await luotGoi(() => moNgan(kho, pm, taskId, ID.duAn))).diaChi.length,
        an: (await luotGoi(() => moNgan(kho, an, taskId, ID.duAn))).diaChi.length,
      }
    }
    expect(await dem(ID.taskNgan)).toEqual({ pm: 6, an: 6 })
    expect(await dem(ID.taskDai)).toEqual({ pm: 6, an: 6 })
  })

  describe('Task không tồn tại hoặc thuộc Dự án không được xem: mã lỗi như trước', () => {
    it.each([
      { ten: 'an', taskId: ID.khongCo, duAnId: ID.duAn, mo: 'Task không tồn tại' },
      { ten: 'pm', taskId: ID.khongCo, duAnId: ID.duAn, mo: 'Task không tồn tại (PM)' },
      { ten: 'an', taskId: 'khong-phai-uuid', duAnId: ID.duAn, mo: 'id không phải uuid' },
      { ten: 'an', taskId: ID.taskKhac, duAnId: ID.duAnKhac, mo: 'Task của Dự án người gọi không ở trong' },
      { ten: 'binh', taskId: ID.taskNgan, duAnId: ID.duAn, mo: 'người chưa ở Dự án nào' },
    ] as const)('$mo: cùng lúc hay lần lượt cùng mã lỗi', async ({ ten, taskId, duAnId }) => {
      const { kho, dangNhap } = dungBoiCanh()
      const phien = await dangNhap(ten)
      const cungLuc = (await moNgan(kho, phien, taskId, duAnId)).map((kq) => maLoi<unknown>(kq))
      const lanLuot = (await goiLanLuot(kho, phien, taskId, duAnId)).map((kq) => maLoi<unknown>(kq))
      expect(cungLuc).toEqual(lanLuot)
      // layTask, lichSuTask, danhSachLienKetCuaTask
      expect([cungLuc[0], cungLuc[3], cungLuc[4]]).toEqual(['KHONG_TIM_THAY', 'KHONG_TIM_THAY', 'KHONG_TIM_THAY'])
      expect(cungLuc[5]).toBe('THANH_CONG')
    })

    it('chưa đăng nhập: CHUA_DANG_NHAP ở mọi lệnh, không gọi mạng', async () => {
      const { kho, luotGoi } = dungBoiCanh()
      const { ketQua, diaChi } = await luotGoi(() => moNgan(kho, null, ID.taskNgan, ID.duAn))
      expect(ketQua.map((kq) => maLoi<unknown>(kq))).toEqual(Array(6).fill('CHUA_DANG_NHAP'))
      expect(diaChi).toEqual([])
    })
  })

  describe('lượt đọc dùng chung không lẫn giữa các Dự án, Task', () => {
    it('đọc Dự án khác cùng lúc với mở Task: mỗi lệnh nhận đúng Dự án của mình', async () => {
      const { kho, dangNhap } = dungBoiCanh()
      const pm = await dangNhap('pm')
      const [task, duAnKhac, nguoiKhac, lienKetKhac] = await Promise.all([
        kho.layTask(pm, ID.taskNgan),
        kho.layDuAn(pm, ID.duAnKhac),
        kho.danhSachNguoiTrongDuAn(pm, ID.duAnKhac),
        kho.danhSachLienKetCuaTask(pm, ID.taskKhac),
      ])
      expect(giaTri(task).duAnId).toBe(ID.duAn)
      expect(giaTri(duAnKhac).id).toBe(ID.duAnKhac)
      expect(giaTri(nguoiKhac).map((n) => n.id)).toEqual([ID.dung])
      expect(giaTri(lienKetKhac).map((l) => l.repo)).toEqual(['cong-ty/khac'])
    })

    it('Task không xem được cùng lúc với đọc Dự án xem được: Dự án vẫn đọc đúng', async () => {
      const { kho, dangNhap } = dungBoiCanh()
      const an = await dangNhap('an')
      const [task, duAn, nguoi] = await Promise.all([
        kho.layTask(an, ID.taskKhac),
        kho.layDuAn(an, ID.duAn),
        kho.danhSachNguoiTrongDuAn(an, ID.duAn),
      ])
      expect(maLoi(task)).toBe('KHONG_TIM_THAY')
      expect(giaTri(duAn).id).toBe(ID.duAn)
      expect(giaTri(nguoi).map((n) => n.id).sort()).toEqual([ID.an, ID.chi].sort())
    })
  })

  describe('sau một lệnh đổi trạng thái, lần đọc kế tiếp thấy trạng thái mới', () => {
    it('đọc Task và lịch sử sau khi đổi trạng thái', async () => {
      const { kho, dangNhap } = dungBoiCanh()
      const an = await dangNhap('an')
      const truoc = await moNgan(kho, an, ID.taskNgan, ID.duAn)
      expect(giaTri(truoc[0]).trangThai).toBe('MOI')

      const doi = giaTri(await kho.doiTrangThaiTask(an, ID.taskNgan, { sang: 'DANG_LAM' }, new Date('2026-06-01T02:00:00Z')))
      expect(doi.trangThai).toBe('DANG_LAM')
      const sau = await moNgan(kho, an, ID.taskNgan, ID.duAn)
      expect(giaTri(sau[0]).trangThai).toBe('DANG_LAM')
      expect(giaTri(sau[0]).dauVet.suaBoi).toEqual({ id: ID.an, tenHienThi: 'An' })
      const lichSu = giaTri(sau[3])
      expect(lichSu).toHaveLength(2)
      expect(lichSu[lichSu.length - 1]).toMatchObject({ loai: 'TRANG_THAI', tu: 'MOI', sang: 'DANG_LAM' })
    })

    it('lượt đọc Task còn đang bay khi lệnh đổi trạng thái chạy xong: lần đọc sau không dùng lại kết quả của nó', async () => {
      const { du, kho, dangNhap, luotGoi } = dungBoiCanh()
      const an = await dangNhap('an')
      let tha = () => {}
      const cho = new Promise<void>((xong) => {
        tha = xong
      })
      // Giữ phản hồi của lượt đọc Task đầu tiên (lượt đọc theo id), đã tính lúc Task còn Mới.
      du.giu = { neu: (url, phuongThuc) => phuongThuc === 'GET' && url.pathname === '/rest/v1/task' && url.searchParams.has('id'), cho }
      const dangBay = kho.layTask(an, ID.taskNgan)
      await new Promise((xong) => setTimeout(xong, 0))
      giaTri(await kho.doiTrangThaiTask(an, ID.taskNgan, { sang: 'DANG_LAM' }, new Date('2026-06-01T02:00:00Z')))

      const sau = luotGoi(() => moNgan(kho, an, ID.taskNgan, ID.duAn))
      await new Promise((xong) => setTimeout(xong, 0))
      tha()
      expect(giaTri(await dangBay).trangThai).toBe('MOI')
      const { ketQua, diaChi } = await sau
      expect(giaTri(ketQua[0]).trangThai).toBe('DANG_LAM')
      expect(giaTri(ketQua[3]).map((l) => l.loai === 'TRANG_THAI' && l.sang)).toContain('DANG_LAM')
      expect(diaChi.some((d) => new URL(d).pathname === '/rest/v1/task' && new URL(d).searchParams.has('id'))).toBe(true)
    })
  })

  it('mọi lượt gọi đều tới Supabase giả, không ra mạng', async () => {
    const { du, kho, dangNhap } = dungBoiCanh()
    const pm = await dangNhap('pm')
    for (const kq of await moNgan(kho, pm, ID.taskDai, ID.duAn)) giaTri<unknown>(kq)
    expect(du.diaChi.length).toBeGreaterThan(0)
    for (const diaChi of du.diaChi) expect(new URL(diaChi).origin).toBe(URL_GIA)
  })
})
