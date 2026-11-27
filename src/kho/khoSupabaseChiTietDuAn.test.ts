// Chi tiết Dự án của bản Supabase trong 5 lượt gọi (ticket toi-uu-hieu-nang 03), không cần mạng hay DB: máy chủ là
// một `fetch` giả trong bộ nhớ đóng vai PostgREST, ghi lại mọi địa chỉ được gọi để đếm lượt.
//
// Màn Chi tiết Dự án gọi cùng lúc ba lệnh: `layDuAn`, `danhSachNguoiTrongDuAn`, `danhSachTask`. Một lượt gọi là một
// yêu cầu tới PostgREST (`/rest/v1/`: đọc bảng hoặc gọi hàm); không tính Auth (`/auth/v1/`: đăng nhập, làm mới phiên),
// đúng cách đếm của spec `.scratch/toi-uu-hieu-nang/spec.md`.
//
// `fetch` giả bắt chước thô phân quyền từng dòng (PM thấy mọi Dự án; người khác Dự án mình ở trong; hồ sơ theo
// ho_so_doc), lọc `eq.`/`in.(...)`, xếp `order`, trang `offset`/`limit`, nhúng hồ sơ vào nguoi_trong_du_an, và các
// lệnh ghi Người trong dự án (them_nguoi_vao_du_an, xoá dòng nguoi_trong_du_an). Phản hồi được tính ngay lúc nhận
// yêu cầu; `giu` cho phép giữ phản hồi lại (đã tính xong) để dựng tình huống một lệnh đọc còn đang bay khi lệnh
// ghi chạy xong.
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

const URL_GIA = 'https://chi-tiet-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'chi-tiet-gia', role: 'anon' })
const MAT_KHAU = 'matkhau-dung-1'

/** Trần lượt gọi của ticket. */
const TRAN = 5

type Dong = Record<string, unknown>

const id = (so: number) => `00000000-0000-4000-8000-${String(so).padStart(12, '0')}`
const ID = {
  pm: id(1),
  an: id(2),
  binh: id(3),
  chi: id(4),
  dung: id(5),
  em: id(6),
  giang: id(7),
  duAn: id(100),
  duAnKhac: id(101),
  khongCo: id(199),
}

interface GiuPhanHoi {
  /** Yêu cầu nào bị giữ phản hồi. */
  neu(url: URL, phuongThuc: string): boolean
  /** Phản hồi (đã tính xong lúc nhận yêu cầu) chỉ trả về khi lời hứa này xong. */
  cho: Promise<void>
}

interface DuLieuGia {
  hoSo: Dong[]
  duAn: Dong[]
  thanhVien: Dong[]
  task: Dong[]
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
    so_dien_thoai: `090000000${so}`,
    chuc_danh: `Chức danh ${ten}`,
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

const TRANG_THAI = ['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI', 'HOAN_THANH', 'HUY']

/**
 * Dữ liệu giả. Dự án chính: Chi (Support, Người phụ trách), An (Thành viên) luôn ở trong. Cỡ "nhiều" có 40 Task đủ
 * các trạng thái, thêm Giang (Thành viên) ở trong Dự án, và Dũng chỉ ở Dự án khác nhưng còn ghi trên Task của Dự án
 * chính (dấu "đã rời dự án"). Bình và Em không ở Dự án nào (người không được xem, người được thêm). Dự án khác có
 * Task riêng (không được lẫn vào Dự án chính).
 */
function dungDuLieu(nhieu: boolean): DuLieuGia {
  const du: DuLieuGia = {
    hoSo: [
      hoSoGia(1, 'pm', 'Pm', 'PM'),
      hoSoGia(2, 'an', 'An', 'THANH_VIEN'),
      hoSoGia(3, 'binh', 'Bình', 'THANH_VIEN'),
      hoSoGia(4, 'chi', 'Chi', 'SUPPORT'),
      hoSoGia(5, 'dung', 'Dũng', 'THANH_VIEN'),
      hoSoGia(6, 'em', 'Em', 'THANH_VIEN'),
      hoSoGia(7, 'giang', 'Giang', 'THANH_VIEN'),
    ],
    duAn: [duAnGia(100, 'Dự án chính'), duAnGia(101, 'Dự án khác')],
    thanhVien: [
      { du_an_id: ID.duAn, nguoi_dung_id: ID.chi, vai_tro: 'Trưởng nhóm' },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.an, vai_tro: null },
      ...(nhieu ? [{ du_an_id: ID.duAn, nguoi_dung_id: ID.giang, vai_tro: 'Kiểm thử' }] : []),
      { du_an_id: ID.duAnKhac, nguoi_dung_id: ID.dung, vai_tro: null },
    ],
    task: [],
    diaChi: [],
    giu: null,
  }
  const lam = nhieu ? [ID.an, ID.chi, ID.giang, ID.dung] : [ID.an]
  const soTask = nhieu ? 40 : 1
  for (let k = 0; k < soTask; k++) {
    du.task.push({
      id: id(1000 + k),
      du_an_id: ID.duAn,
      tieu_de: `Task ${k}`,
      mo_ta: '',
      han: k % 3 === 0 ? null : `2026-06-${String(1 + (k % 28)).padStart(2, '0')}`,
      muc_uu_tien: 'TRUNG_BINH',
      nguoi_thuc_hien_id: lam[k % lam.length],
      nguoi_kiem_tra_id: k % 2 === 0 ? ID.chi : ID.an,
      trang_thai: TRANG_THAI[k % TRANG_THAI.length],
      so_lan_tra_lai: 0,
      tao_boi: ID.pm,
      tao_luc: `2026-05-${String(1 + (k % 28)).padStart(2, '0')}T0${k % 10}:00:00+00:00`,
      sua_boi: k % 4 === 1 ? ID.chi : null,
      sua_luc: k % 4 === 1 ? '2026-05-21T02:00:00+00:00' : null,
    })
  }
  // Task của Dự án khác: không được tính vào Dự án chính.
  du.task.push({
    id: id(2000),
    du_an_id: ID.duAnKhac,
    tieu_de: 'Task khác',
    mo_ta: '',
    han: null,
    muc_uu_tien: 'TRUNG_BINH',
    nguoi_thuc_hien_id: ID.an,
    nguoi_kiem_tra_id: ID.dung,
    trang_thai: 'DANG_LAM',
    so_lan_tra_lai: 0,
    tao_boi: ID.pm,
    tao_luc: '2026-05-02T02:00:00+00:00',
    sua_boi: null,
    sua_luc: null,
  })
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

/** Lọc dòng theo `cot=eq.x` và `cot=in.(x,y)` của PostgREST; bỏ qua tham số không phải bộ lọc. */
function loc(dong: readonly Dong[], thamSo: URLSearchParams): Dong[] {
  return dong.filter((d) => {
    for (const [khoa, giaTri] of thamSo) {
      if (['select', 'order', 'offset', 'limit', 'columns'].includes(khoa)) continue
      if (giaTri.startsWith('eq.') && String(d[khoa]) !== giaTri.slice(3)) return false
      if (giaTri.startsWith('in.(')) {
        const cacGiaTri = giaTri.slice(4, -1).split(',').map((g) => g.replace(/^"|"$/g, ''))
        if (!cacGiaTri.includes(String(d[khoa]))) return false
      }
    }
    return true
  })
}

/** Xếp theo `order=cot.desc,cot2.asc` rồi cắt trang theo `offset`, `limit`. */
function xepVaCat(dong: Dong[], thamSo: URLSearchParams): Dong[] {
  const thuTu = (thamSo.get('order') ?? '')
    .split(',')
    .filter((p) => p !== '')
    .map((p) => {
      const [cot, chieu] = p.split('.')
      return { cot, giam: chieu === 'desc' }
    })
  const xep = [...dong].sort((a, b) => {
    for (const { cot, giam } of thuTu) {
      const x = String(a[cot] ?? '')
      const y = String(b[cot] ?? '')
      if (x !== y) return (x < y ? -1 : 1) * (giam ? -1 : 1)
    }
    return 0
  })
  const tu = Number(thamSo.get('offset') ?? 0)
  const gioiHan = thamSo.get('limit')
  return gioiHan === null ? xep.slice(tu) : xep.slice(tu, tu + Number(gioiHan))
}

/** Chỉ giữ các cột được hỏi; `*` hay rỗng thì giữ cả dòng. */
function chonCot(dong: Dong, cot: readonly string[]): Dong {
  if (cot.length === 0 || cot.includes('*')) return { ...dong }
  return Object.fromEntries(cot.map((c) => [c, dong[c]]))
}

const NHUNG_HO_SO = /ho_so!nguoi_trong_du_an_nguoi_dung_id_fkey\(([^)]*)\)/

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
    const duAnQuanLy = (duAnId: unknown) => laPM || (nguoiGoi.vai === 'SUPPORT' && laThanhVien(duAnId, nguoiGoi.id))
    // ho_so_doc: của mình, PM, hoặc người kia ở trong một Dự án người gọi thấy được.
    const thayHoSo = (hoSoId: unknown) =>
      hoSoId === nguoiGoi.id || laPM || du.thanhVien.some((t) => t.nguoi_dung_id === hoSoId && duAnThay(t.du_an_id))
    const motDoiTuong = (tieuDe.get('accept') ?? '').includes('vnd.pgrst.object')
    const traDong = (dong: Dong[]) => tra(200, motDoiTuong ? (dong[0] ?? null) : dong)
    const chon = url.searchParams.get('select') ?? '*'

    /** Dòng nguoi_trong_du_an như PostgREST trả: các cột thường được hỏi, kèm hồ sơ nhúng (`ho_so!...(cột)`). */
    const dongNguoiTrong = (dong: readonly Dong[]): Dong[] => {
      const nhung = NHUNG_HO_SO.exec(chon)
      const cotThuong = chon
        .replace(NHUNG_HO_SO, '')
        .split(',')
        .filter((c) => c !== '')
      return dong.map((t) => {
        const ketQua = chonCot(t, cotThuong)
        if (!nhung) return ketQua
        const hoSo = du.hoSo.find((h) => h.id === t.nguoi_dung_id)
        return { ...ketQua, ho_so: hoSo && thayHoSo(hoSo.id) ? chonCot(hoSo, nhung[1].split(',')) : null }
      })
    }

    if (phuongThuc === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) {
      const ham = url.pathname.slice('/rest/v1/rpc/'.length)
      if (ham === 'ten_nguoi_dau_vet' || ham === 'ten_nguoi_cua_task') {
        const ids = (than.p_ids as string[]) ?? []
        return tra(200, du.hoSo.filter((h) => ids.includes(String(h.id))).map((h) => ({ id: h.id, ten_hien_thi: h.ten_hien_thi })))
      }
      if (ham === 'them_nguoi_vao_du_an') {
        if (!duAnQuanLy(than.p_du_an_id)) return traLoi(400, 'P0001', 'KHONG_CO_QUYEN')
        const dich = du.hoSo.find((h) => h.email === String(than.p_email).trim().toLowerCase())
        if (!dich) return traLoi(400, 'P0001', 'CHUA_DANG_KY')
        if (laThanhVien(than.p_du_an_id, dich.id)) return traLoi(400, 'P0001', 'DA_TRONG_DU_AN')
        const vaiTro = typeof than.p_vai_tro === 'string' && than.p_vai_tro.trim() !== '' ? than.p_vai_tro.trim() : null
        du.thanhVien.push({ du_an_id: than.p_du_an_id, nguoi_dung_id: dich.id, vai_tro: vaiTro })
        return tra(200, { ...dich, vai_tro: vaiTro })
      }
      return traLoi(404, 'PGRST202', `Không có hàm ${ham}`)
    }

    const bang = url.pathname.slice('/rest/v1/'.length)
    if (phuongThuc === 'GET') {
      if (bang === 'ho_so') return traDong(loc(du.hoSo.filter((h) => thayHoSo(h.id)), url.searchParams))
      if (bang === 'du_an') {
        const dong = xepVaCat(loc(du.duAn.filter((d) => duAnThay(d.id)), url.searchParams), url.searchParams)
        // Nhúng id Người trong dự án (lượt kiểm quản lý Dự án, ticket toi-uu-hieu-nang 05).
        if (!chon.includes('nguoi_trong_du_an!nguoi_trong_du_an_du_an_id_fkey(nguoi_dung_id)')) return traDong(dong)
        return traDong(
          dong.map((d) => ({
            ...d,
            nguoi_trong_du_an: du.thanhVien.filter((t) => t.du_an_id === d.id).map((t) => ({ nguoi_dung_id: t.nguoi_dung_id })),
          })),
        )
      }
      if (bang === 'nguoi_trong_du_an') {
        const dong = xepVaCat(loc(du.thanhVien.filter((t) => duAnThay(t.du_an_id)), url.searchParams), url.searchParams)
        return traDong(dongNguoiTrong(dong))
      }
      if (bang === 'task') {
        const dong = xepVaCat(loc(du.task.filter((t) => duAnThay(t.du_an_id)), url.searchParams), url.searchParams)
        return traDong(dong.map((t) => chonCot(t, chon.split(','))))
      }
    }
    if (phuongThuc === 'DELETE' && bang === 'nguoi_trong_du_an') {
      // Policy nguoi_trong_du_an_xoa: PM, Support của Dự án; dòng không xoá được thì không bị xoá (không lỗi).
      const dich = loc(du.thanhVien.filter((t) => duAnQuanLy(t.du_an_id)), url.searchParams)
      du.thanhVien = du.thanhVien.filter((t) => !dich.includes(t))
      return traDong(dongNguoiTrong(dich))
    }
    return traLoi(404, 'PGRST000', `Yêu cầu không mong đợi: ${phuongThuc} ${url.pathname}`)
  }

  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    du.diaChi.push(url.href)
    if (url.origin !== URL_GIA) throw new Error(`Test không được gọi ra ngoài: ${url.href}`)
    const phanHoi = await xuLy(url, init)
    const giu = du.giu
    if (giu && giu.neu(url, (init?.method ?? 'GET').toUpperCase())) await giu.cho
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

type TenNguoi = 'pm' | 'an' | 'binh' | 'chi' | 'em' | 'giang'

interface BoiCanh {
  du: DuLieuGia
  kho: KhoSupabase
  dangNhap(ten: TenNguoi): Promise<Phien>
  /** Các địa chỉ PostgREST (lượt gọi tính vào trần) mà `lam` gọi tới. */
  luotGoi<T>(lam: () => Promise<T>): Promise<{ ketQua: T; diaChi: string[] }>
}

function dungBoiCanh(du: DuLieuGia): BoiCanh {
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

/** Ba lệnh màn Chi tiết Dự án gọi cùng lúc khi mở. */
function moChiTiet(kho: KhoSupabase, phien: Phien | null, duAnId: string) {
  return Promise.all([kho.layDuAn(phien, duAnId), kho.danhSachNguoiTrongDuAn(phien, duAnId), kho.danhSachTask(phien, duAnId)])
}

/** Cùng ba lệnh, gọi lần lượt. */
async function goiLanLuot(kho: KhoSupabase, phien: Phien | null, duAnId: string) {
  const duAn = await kho.layDuAn(phien, duAnId)
  const nguoi = await kho.danhSachNguoiTrongDuAn(phien, duAnId)
  const task = await kho.danhSachTask(phien, duAnId)
  return [duAn, nguoi, task] as const
}

/** Số Task đang giữ tính thẳng từ dữ liệu giả: Người thực hiện, chưa Hoàn thành, chưa Huỷ, của Dự án này. */
function soDangGiu(du: DuLieuGia, duAnId: string, nguoiId: string): number {
  return du.task.filter(
    (t) => t.du_an_id === duAnId && t.nguoi_thuc_hien_id === nguoiId && t.trang_thai !== 'HOAN_THANH' && t.trang_thai !== 'HUY',
  ).length
}

const CO_DU_LIEU = [
  { ten: 'Dự án có 1 Task, 2 người', nhieu: false },
  { ten: 'Dự án có 40 Task, 3 người, một người đã rời', nhieu: true },
] as const

describe('bản Supabase: mở Chi tiết Dự án trong nhiều nhất 5 lượt gọi', () => {
  describe.each(CO_DU_LIEU)('cỡ dữ liệu: $ten', ({ nhieu }) => {
    it.each(['pm', 'chi', 'an'] as const)('%s: ba lệnh gọi cùng lúc tốn nhiều nhất 5 lượt, kết quả bằng gọi lần lượt', async (ten) => {
      const { du, kho, dangNhap, luotGoi } = dungBoiCanh(dungDuLieu(nhieu))
      const phien = await dangNhap(ten)
      const cungLuc = await luotGoi(() => moChiTiet(kho, phien, ID.duAn))
      expect(cungLuc.diaChi.length).toBeLessThanOrEqual(TRAN)
      const lanLuot = await goiLanLuot(kho, phien, ID.duAn)
      expect(cungLuc.ketQua).toEqual(lanLuot)

      const duAn = giaTri(cungLuc.ketQua[0])
      const nguoi = giaTri(cungLuc.ketQua[1])
      const task = giaTri(cungLuc.ketQua[2])
      // Dự án kèm Dấu vết có tên.
      expect(duAn.id).toBe(ID.duAn)
      expect(duAn.dauVet.taoBoi).toEqual({ id: ID.pm, tenHienThi: 'Pm' })
      expect(duAn.dauVet.suaBoi).toEqual({ id: ID.chi, tenHienThi: 'Chi' })
      // Người trong dự án kèm bộ đếm Task đang giữ đúng theo dữ liệu.
      const mongDoiNguoi = du.thanhVien.filter((t) => t.du_an_id === ID.duAn).map((t) => String(t.nguoi_dung_id))
      expect(nguoi.map((n) => n.id).sort()).toEqual([...mongDoiNguoi].sort())
      for (const n of nguoi) expect(n.soTaskDangGiu).toBe(soDangGiu(du, ID.duAn, n.id))
      expect(nguoi.find((n) => n.id === ID.chi)?.vaiTroTrongDuAn).toBe('Trưởng nhóm')
      // Task của đúng Dự án, đủ tên, dấu "đã rời dự án" cho người không còn ở trong.
      expect(task.map((t) => t.id).sort()).toEqual(du.task.filter((t) => t.du_an_id === ID.duAn).map((t) => String(t.id)).sort())
      for (const t of task) {
        expect(t.nguoiThucHien.tenHienThi).not.toBe('')
        expect(t.dauVet.taoBoi.tenHienThi).toBe('Pm')
        expect(t.nguoiThucHien.daRoiDuAn === true).toBe(t.nguoiThucHien.id === ID.dung)
      }
      if (nhieu) {
        expect(nguoi.some((n) => n.soTaskDangGiu > 1)).toBe(true)
        expect(task.some((t) => t.nguoiThucHien.daRoiDuAn === true)).toBe(true)
      }
    })
  })

  it('số lượt gọi không tăng theo số Task hay số người', async () => {
    const dem = async (nhieu: boolean) => {
      const { kho, dangNhap, luotGoi } = dungBoiCanh(dungDuLieu(nhieu))
      const pm = await dangNhap('pm')
      const an = await dangNhap('an')
      return {
        pm: (await luotGoi(() => moChiTiet(kho, pm, ID.duAn))).diaChi.length,
        an: (await luotGoi(() => moChiTiet(kho, an, ID.duAn))).diaChi.length,
      }
    }
    expect(await dem(false)).toEqual({ pm: 5, an: 5 })
    expect(await dem(true)).toEqual({ pm: 5, an: 5 })
  })

  describe('Dự án không tồn tại hoặc không được xem: mã lỗi như trước ở cả ba lệnh', () => {
    it.each([
      { ten: 'an', duAnId: ID.khongCo, mo: 'Dự án không tồn tại' },
      { ten: 'pm', duAnId: ID.khongCo, mo: 'Dự án không tồn tại (PM)' },
      { ten: 'an', duAnId: 'khong-phai-uuid', mo: 'id không phải uuid' },
      { ten: 'an', duAnId: ID.duAnKhac, mo: 'Dự án người gọi không ở trong' },
      { ten: 'binh', duAnId: ID.duAn, mo: 'người chưa ở Dự án nào' },
    ] as const)('$mo: KHONG_TIM_THAY, cùng lúc hay lần lượt', async ({ ten, duAnId }) => {
      const { kho, dangNhap } = dungBoiCanh(dungDuLieu(true))
      const phien = await dangNhap(ten)
      const cungLuc = await moChiTiet(kho, phien, duAnId)
      expect(cungLuc.map((kq) => maLoi<unknown>(kq))).toEqual(['KHONG_TIM_THAY', 'KHONG_TIM_THAY', 'KHONG_TIM_THAY'])
      const lanLuot = await goiLanLuot(kho, phien, duAnId)
      expect(lanLuot.map((kq) => maLoi<unknown>(kq))).toEqual(['KHONG_TIM_THAY', 'KHONG_TIM_THAY', 'KHONG_TIM_THAY'])
    })

    it('chưa đăng nhập: CHUA_DANG_NHAP ở cả ba lệnh, không gọi mạng', async () => {
      const { kho, luotGoi } = dungBoiCanh(dungDuLieu(false))
      const { ketQua, diaChi } = await luotGoi(() => moChiTiet(kho, null, ID.duAn))
      expect(ketQua.map((kq) => maLoi<unknown>(kq))).toEqual(['CHUA_DANG_NHAP', 'CHUA_DANG_NHAP', 'CHUA_DANG_NHAP'])
      expect(diaChi).toEqual([])
    })
  })

  describe('kết quả dùng chung không sống qua lệnh ghi', () => {
    it('sau khi gỡ một Người trong dự án: lần mở kế tiếp thấy danh sách mới, người bị gỡ không còn xem được', async () => {
      const { kho, dangNhap } = dungBoiCanh(dungDuLieu(true))
      const pm = await dangNhap('pm')
      const an = await dangNhap('an')
      await Promise.all([moChiTiet(kho, pm, ID.duAn), moChiTiet(kho, an, ID.duAn)])

      giaTri(await kho.goNguoiKhoiDuAn(pm, ID.duAn, ID.an))
      const [, nguoi, task] = await moChiTiet(kho, pm, ID.duAn)
      expect(giaTri(nguoi).map((n) => n.id)).not.toContain(ID.an)
      // Task An đang làm giờ mang dấu "đã rời dự án".
      expect(giaTri(task).some((t) => t.nguoiThucHien.id === ID.an && t.nguoiThucHien.daRoiDuAn === true)).toBe(true)
      expect((await moChiTiet(kho, an, ID.duAn)).map((kq) => maLoi<unknown>(kq))).toEqual([
        'KHONG_TIM_THAY',
        'KHONG_TIM_THAY',
        'KHONG_TIM_THAY',
      ])
    })

    it('sau khi thêm một người: lần mở kế tiếp thấy người mới, người mới xem được ngay', async () => {
      const { kho, dangNhap } = dungBoiCanh(dungDuLieu(true))
      const chi = await dangNhap('chi')
      const binh = await dangNhap('binh')
      expect(maLoi(await kho.layDuAn(binh, ID.duAn))).toBe('KHONG_TIM_THAY')
      await moChiTiet(kho, chi, ID.duAn)

      giaTri(await kho.themNguoiVaoDuAn(chi, ID.duAn, { email: 'binh@vi-du.vn', vaiTroTrongDuAn: 'Phân tích' }))
      const [, nguoi] = await moChiTiet(kho, chi, ID.duAn)
      expect(giaTri(nguoi).find((n) => n.id === ID.binh)).toMatchObject({ vaiTroTrongDuAn: 'Phân tích', soTaskDangGiu: 0 })
      expect((await moChiTiet(kho, binh, ID.duAn)).map((kq) => maLoi<unknown>(kq))).toEqual([
        'THANH_CONG',
        'THANH_CONG',
        'THANH_CONG',
      ])
    })

    /** Giữ phản hồi lượt đọc Người trong dự án kèm hồ sơ cho tới khi gọi `tha`. */
    function giuDocNguoiTrong(du: DuLieuGia): { tha: () => void } {
      let tha = () => {}
      const cho = new Promise<void>((xong) => {
        tha = xong
      })
      du.giu = {
        neu: (url, phuongThuc) =>
          phuongThuc === 'GET' && url.pathname === '/rest/v1/nguoi_trong_du_an' && (url.searchParams.get('select') ?? '').includes('ho_so!'),
        cho,
      }
      return {
        tha: () => {
          du.giu = null
          tha()
        },
      }
    }

    it('lệnh đọc còn đang bay khi lệnh gỡ người chạy xong: lệnh đọc gọi sau không dùng lại kết quả của nó', async () => {
      const { du, kho, dangNhap, luotGoi } = dungBoiCanh(dungDuLieu(true))
      const pm = await dangNhap('pm')
      const an = await dangNhap('an')
      const giu = giuDocNguoiTrong(du)
      // An mở Chi tiết; lượt đọc của An đã tới máy chủ (khi An còn ở trong Dự án) nhưng phản hồi chưa về.
      const dangBay = moChiTiet(kho, an, ID.duAn)
      await new Promise((xong) => setTimeout(xong, 0))
      giaTri(await kho.goNguoiKhoiDuAn(pm, ID.duAn, ID.an))

      const sau = luotGoi(() => moChiTiet(kho, an, ID.duAn))
      await new Promise((xong) => setTimeout(xong, 0))
      giu.tha()
      // Lần mở bắt đầu trước khi gỡ thấy dữ liệu lúc đó; lần mở sau khi gỡ phải tự đọc lại và bị từ chối.
      expect((await dangBay).map((kq) => maLoi<unknown>(kq))).toEqual(['THANH_CONG', 'THANH_CONG', 'THANH_CONG'])
      const { ketQua, diaChi } = await sau
      expect(ketQua.map((kq) => maLoi<unknown>(kq))).toEqual(['KHONG_TIM_THAY', 'KHONG_TIM_THAY', 'KHONG_TIM_THAY'])
      expect(diaChi.some((d) => new URL(d).pathname === '/rest/v1/du_an')).toBe(true)
    })

    it('lệnh đọc còn đang bay khi lệnh thêm người chạy xong: lần đọc sau thấy người mới', async () => {
      const { du, kho, dangNhap } = dungBoiCanh(dungDuLieu(true))
      const pm = await dangNhap('pm')
      const giu = giuDocNguoiTrong(du)
      const dangBay = kho.danhSachNguoiTrongDuAn(pm, ID.duAn)
      await new Promise((xong) => setTimeout(xong, 0))
      giaTri(await kho.themNguoiVaoDuAn(pm, ID.duAn, { email: 'em@vi-du.vn', vaiTroTrongDuAn: '' }))

      const sau = kho.danhSachNguoiTrongDuAn(pm, ID.duAn)
      await new Promise((xong) => setTimeout(xong, 0))
      giu.tha()
      expect(giaTri(await dangBay).map((n) => n.id)).not.toContain(ID.em)
      expect(giaTri(await sau).map((n) => n.id)).toContain(ID.em)
    })
  })

  it('đăng xuất rồi đăng nhập lại: lần mở mới tự đọc, không dùng gì của phiên cũ', async () => {
    const { du, kho, dangNhap, luotGoi } = dungBoiCanh(dungDuLieu(false))
    const an = await dangNhap('an')
    const giu = giuDocDuAn(du)
    const dangBay = moChiTiet(kho, an, ID.duAn)
    await new Promise((xong) => setTimeout(xong, 0))
    giaTri(await kho.dangXuat(an))
    const anMoi = await dangNhap('an')
    const sau = luotGoi(() => moChiTiet(kho, anMoi, ID.duAn))
    await new Promise((xong) => setTimeout(xong, 0))
    giu()
    await dangBay
    const { ketQua, diaChi } = await sau
    expect(ketQua.map((kq) => maLoi<unknown>(kq))).toEqual(['THANH_CONG', 'THANH_CONG', 'THANH_CONG'])
    expect(diaChi.some((d) => new URL(d).pathname === '/rest/v1/du_an')).toBe(true)
  })

  it('mọi lượt gọi đều tới Supabase giả, không ra mạng', async () => {
    const { du, kho, dangNhap } = dungBoiCanh(dungDuLieu(true))
    const pm = await dangNhap('pm')
    for (const kq of await moChiTiet(kho, pm, ID.duAn)) giaTri<unknown>(kq)
    expect(du.diaChi.length).toBeGreaterThan(0)
    for (const diaChi of du.diaChi) expect(new URL(diaChi).origin).toBe(URL_GIA)
  })
})

/** Giữ phản hồi mọi lượt đọc `du_an` cho tới khi gọi hàm trả về. */
function giuDocDuAn(du: DuLieuGia): () => void {
  let tha = () => {}
  const cho = new Promise<void>((xong) => {
    tha = xong
  })
  du.giu = { neu: (url, phuongThuc) => phuongThuc === 'GET' && url.pathname === '/rest/v1/du_an', cho }
  return () => {
    du.giu = null
    tha()
  }
}
