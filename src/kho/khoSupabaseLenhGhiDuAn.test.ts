// Lệnh ghi Dự án và Người trong dự án của bản Supabase trong 3 lượt gọi (ticket toi-uu-hieu-nang 05), không cần mạng
// hay DB: máy chủ là một `fetch` giả trong bộ nhớ đóng vai PostgREST, ghi lại mọi địa chỉ được gọi để đếm lượt.
//
// Một lượt gọi là một yêu cầu tới PostgREST (`/rest/v1/`: đọc bảng hoặc gọi hàm); không tính Auth (`/auth/v1/`:
// đăng nhập, làm mới phiên), đúng cách đếm của spec `.scratch/toi-uu-hieu-nang/spec.md`. Lệnh: tạo, sửa, Lưu trữ,
// mở lại Dự án; thêm người, gỡ người, sửa Vai trò trong Dự án; gắn repo, gỡ repo.
//
// `fetch` giả bắt chước thô những gì migration hứa (supabase/migrations/): phân quyền từng dòng (PM thấy và quản lý
// mọi Dự án; Support quản lý Dự án mình ở trong; người khác chỉ thấy Dự án mình ở trong), trigger của du_an (Lưu trữ,
// Người phụ trách, Mã trùng, ngày, dấu vết do máy chủ đặt), các hàm luu_tru_du_an, mo_lai_du_an, them_nguoi_vao_du_an
// theo đúng thứ tự kiểm của chúng (quyền, tồn tại, trạng thái, dữ liệu), trigger và policy của nguoi_trong_du_an và
// repo_du_an. KHÔNG thay cho việc chạy SQL thật (bộ test hợp đồng trên Supabase thật, chủ dự án chạy tay).
import { describe, expect, it } from 'vitest'
import { THONG_BAO_MAC_DINH, thatBai, type KetQua, type LoiKho, type MaLoi } from './ketQua'
import type { Phien } from './khoDuLieu'
import { taoKhoSupabase, type KhoSupabase } from './khoSupabase'
import { DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA, THONG_BAO_DU_AN, kiemTraDuAn } from '../luat/duAn'
import { kiemTraRepo, laTenRepoHopLe } from '../luat/github'

/** JWT giả (chữ ký không hợp lệ), như cauHinh.test.ts. */
function jwtGia(than: Record<string, unknown>): string {
  const ma = (doiTuong: Record<string, unknown>) =>
    btoa(JSON.stringify(doiTuong)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${ma({ alg: 'HS256', typ: 'JWT' })}.${ma(than)}.chu-ky-gia`
}

const URL_GIA = 'https://lenh-ghi-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'lenh-ghi-gia', role: 'anon' })
const MAT_KHAU = 'matkhau-dung-1'
const LUC = new Date('2026-06-02T08:30:00+07:00')
/** Giờ "máy chủ" đặt cho dấu vết (bản Supabase bỏ qua giờ truyền vào). */
const GIO_MAY_CHU = '2026-06-02T05:00:00+00:00'

/** Trần lượt gọi của ticket. */
const TRAN = 3

type Dong = Record<string, unknown>

const id = (so: number) => `00000000-0000-4000-8000-${String(so).padStart(12, '0')}`
const ID = {
  pm: id(1),
  an: id(2),
  binh: id(3),
  chi: id(4),
  dung: id(5),
  em: id(6),
  duAn: id(100),
  duAnKhac: id(101),
  duAnLuuTru: id(102),
  khongCo: id(199),
}

interface DuLieuGia {
  hoSo: Dong[]
  duAn: Dong[]
  thanhVien: Dong[]
  task: Dong[]
  repo: Dong[]
  /** Mọi địa chỉ đã gọi. */
  diaChi: string[]
  /** Các yêu cầu ghi (`PHƯƠNG_THỨC /đường_dẫn`): ghi bảng, hoặc gọi hàm ghi. */
  ghi: string[]
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

function duAnGia(so: number, dong: Dong): Dong {
  return {
    id: id(so),
    ma: `DA-${so}`,
    ten: `Dự án ${so}`,
    mo_ta: '',
    khach_hang: 'Khách A',
    ngay_bat_dau: '2026-06-01',
    ngay_ket_thuc_du_kien: '2026-06-30',
    muc_uu_tien: 'CAO',
    nguoi_phu_trach_id: null,
    trang_thai: 'HOAT_DONG',
    tao_boi: ID.pm,
    tao_luc: '2026-05-01T02:00:00+00:00',
    sua_boi: null,
    sua_luc: null,
    ...dong,
  }
}

const TRANG_THAI = ['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI', 'HOAN_THANH', 'HUY']

/**
 * Dữ liệu giả. Dự án chính: Chi (Support, Người phụ trách) và An (Thành viên, đang giữ Task) ở trong; PM không ở
 * trong Dự án nào. Bình, Em chưa ở Dự án nào; Dũng là Support không ở Dự án chính. Dự án Lưu trữ có Chi và An. Cỡ
 * "nhiều" thêm 40 Task và năm người nữa vào Dự án chính.
 */
function dungDuLieu(nhieu: boolean): DuLieuGia {
  const du: DuLieuGia = {
    hoSo: [
      hoSoGia(1, 'pm', 'Pm', 'PM'),
      hoSoGia(2, 'an', 'An', 'THANH_VIEN'),
      hoSoGia(3, 'binh', 'Bình', 'THANH_VIEN'),
      hoSoGia(4, 'chi', 'Chi', 'SUPPORT'),
      hoSoGia(5, 'dung', 'Dũng', 'SUPPORT'),
      hoSoGia(6, 'em', 'Em', 'THANH_VIEN'),
    ],
    duAn: [
      duAnGia(100, { ma: 'CH-01', ten: 'Cửa hàng', nguoi_phu_trach_id: ID.chi, sua_boi: ID.chi, sua_luc: '2026-05-20T02:00:00+00:00' }),
      duAnGia(101, { ma: 'KHO-02', ten: 'Kho' }),
      duAnGia(102, { ma: 'CU-03', ten: 'Cũ', trang_thai: 'LUU_TRU', sua_boi: ID.pm, sua_luc: '2026-05-21T02:00:00+00:00' }),
    ],
    thanhVien: [
      { du_an_id: ID.duAn, nguoi_dung_id: ID.chi, vai_tro: 'Trưởng nhóm' },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.an, vai_tro: null },
      { du_an_id: ID.duAnLuuTru, nguoi_dung_id: ID.chi, vai_tro: null },
      { du_an_id: ID.duAnLuuTru, nguoi_dung_id: ID.an, vai_tro: null },
    ],
    task: [],
    repo: [{ id: id(500), du_an_id: ID.duAn, ten_repo: 'vercel/next.js', ten_repo_khoa: 'vercel/next.js', thu_tu: 1 }],
    diaChi: [],
    ghi: [],
  }
  const lam = nhieu ? [ID.an, ID.chi, id(20), id(21)] : [ID.an]
  const soTask = nhieu ? 40 : 3
  for (let k = 0; k < soTask; k++) {
    du.task.push({
      id: id(1000 + k),
      du_an_id: ID.duAn,
      tieu_de: `Task ${k}`,
      nguoi_thuc_hien_id: lam[k % lam.length],
      nguoi_kiem_tra_id: ID.chi,
      trang_thai: nhieu ? TRANG_THAI[k % TRANG_THAI.length] : ['DANG_LAM', 'CHO_DUYET', 'HOAN_THANH'][k],
      tao_luc: `2026-05-${String(1 + (k % 28)).padStart(2, '0')}T02:00:00+00:00`,
    })
  }
  if (nhieu) {
    for (let k = 20; k < 25; k++) {
      du.hoSo.push(hoSoGia(k, `nguoi-${k}`, `Người ${k}`, 'THANH_VIEN'))
      du.thanhVien.push({ du_an_id: ID.duAn, nguoi_dung_id: id(k), vai_tro: `Vai ${k}` })
    }
  }
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

const loiP0001 = (ma: string) => traLoi(400, 'P0001', ma)

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
/** Bảng du_an và nguoi_trong_du_an nối nhau bằng hai khoá ngoại: không gọi tên khoá thì máy chủ thật báo nhập nhằng. */
const NHUNG_NGUOI_TRONG = 'nguoi_trong_du_an!nguoi_trong_du_an_du_an_id_fkey(nguoi_dung_id)'

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
    // rieng.duoc_xem_du_an, rieng.duoc_quan_ly_du_an, rieng.du_an_dang_hoat_dong.
    const duAnThay = (duAnId: unknown) => laPM || laThanhVien(duAnId, nguoiGoi.id)
    const duAnQuanLy = (duAnId: unknown) => laPM || (nguoiGoi.vai === 'SUPPORT' && laThanhVien(duAnId, nguoiGoi.id))
    const duAnHoatDong = (duAnId: unknown) => du.duAn.some((d) => d.id === duAnId && d.trang_thai === 'HOAT_DONG')
    const thayHoSo = (hoSoId: unknown) =>
      hoSoId === nguoiGoi.id || laPM || du.thanhVien.some((t) => t.nguoi_dung_id === hoSoId && duAnThay(t.du_an_id))
    const motDoiTuong = (tieuDe.get('accept') ?? '').includes('vnd.pgrst.object')
    const traDong = (dong: Dong[], trangThai = 200) => tra(trangThai, motDoiTuong ? (dong[0] ?? null) : dong)
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

    /** Dòng du_an như PostgREST trả, kèm id Người trong dự án nhúng khi được hỏi. */
    const dongDuAn = (dong: readonly Dong[]): Dong[] | Response => {
      if (!chon.includes('nguoi_trong_du_an')) return dong.map((d) => ({ ...d }))
      if (!chon.includes(NHUNG_NGUOI_TRONG)) return traLoi(300, 'PGRST201', 'Could not embed because more than one relationship was found')
      return dong.map((d) => ({
        ...d,
        nguoi_trong_du_an: du.thanhVien
          .filter((t) => t.du_an_id === d.id && duAnThay(t.du_an_id))
          .map((t) => ({ nguoi_dung_id: t.nguoi_dung_id })),
      }))
    }

    /** Trigger du_an_truoc_khi_sua và ràng buộc của bảng du_an (migration 20261126000500_truong_du_an.sql). */
    const kiemDongDuAn = (cu: Dong | null, moi: Dong): Response | null => {
      if (cu?.trang_thai === 'LUU_TRU' && moi.trang_thai !== 'HOAT_DONG') return loiP0001('DU_AN_DA_LUU_TRU')
      if (cu && moi.nguoi_phu_trach_id && moi.nguoi_phu_trach_id !== cu.nguoi_phu_trach_id && !laThanhVien(cu.id, moi.nguoi_phu_trach_id)) {
        return loiP0001('NGUOI_NGOAI_DU_AN')
      }
      if (du.duAn.some((d) => d.id !== moi.id && String(d.ma).toUpperCase() === String(moi.ma).toUpperCase())) {
        return traLoi(409, '23505', 'duplicate key value violates unique constraint "du_an_ma_key"')
      }
      if (moi.ngay_bat_dau && moi.ngay_ket_thuc_du_kien && String(moi.ngay_ket_thuc_du_kien) < String(moi.ngay_bat_dau)) {
        return traLoi(400, '23514', 'new row for relation "du_an" violates check constraint "du_an_ngay_hop_le"')
      }
      return null
    }

    if (phuongThuc === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) {
      const ham = url.pathname.slice('/rest/v1/rpc/'.length)
      if (ham === 'ten_nguoi_dau_vet' || ham === 'ten_nguoi_cua_task') {
        const ids = (than.p_ids as string[]) ?? []
        return tra(200, du.hoSo.filter((h) => ids.includes(String(h.id))).map((h) => ({ id: h.id, ten_hien_thi: h.ten_hien_thi })))
      }
      du.ghi.push(`RPC ${ham}`)
      const duAn = du.duAn.find((d) => d.id === than.p_du_an_id)
      // Thứ tự kiểm của ba hàm: quyền, Dự án tồn tại, trạng thái (rồi dữ liệu).
      if (ham === 'luu_tru_du_an' || ham === 'mo_lai_du_an') {
        if (!duAnQuanLy(than.p_du_an_id)) return loiP0001('KHONG_CO_QUYEN')
        if (!duAn) return loiP0001('KHONG_TIM_THAY')
        if (ham === 'luu_tru_du_an' && duAn.trang_thai === 'LUU_TRU') return loiP0001('DU_AN_DA_LUU_TRU')
        if (ham === 'mo_lai_du_an' && duAn.trang_thai !== 'LUU_TRU') return loiP0001('DU_AN_DANG_HOAT_DONG')
        Object.assign(duAn, { trang_thai: ham === 'luu_tru_du_an' ? 'LUU_TRU' : 'HOAT_DONG', sua_boi: nguoiGoi.id, sua_luc: GIO_MAY_CHU })
        return tra(204)
      }
      if (ham === 'them_nguoi_vao_du_an') {
        if (!duAnQuanLy(than.p_du_an_id)) return loiP0001('KHONG_CO_QUYEN')
        if (!duAn) return loiP0001('KHONG_TIM_THAY')
        if (duAn.trang_thai === 'LUU_TRU') return loiP0001('DU_AN_DA_LUU_TRU')
        const vaiTro = typeof than.p_vai_tro === 'string' && than.p_vai_tro.trim() !== '' ? than.p_vai_tro.trim() : null
        if (vaiTro !== null && vaiTro.length > DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA) return loiP0001('KHONG_HOP_LE')
        const dich = du.hoSo.find((h) => h.email === String(than.p_email).trim().toLowerCase())
        if (!dich) return loiP0001('CHUA_DANG_KY')
        if (laThanhVien(than.p_du_an_id, dich.id)) return loiP0001('DA_TRONG_DU_AN')
        du.thanhVien.push({ du_an_id: than.p_du_an_id, nguoi_dung_id: dich.id, vai_tro: vaiTro })
        return tra(200, { ...dich, vai_tro: vaiTro })
      }
      return traLoi(404, 'PGRST202', `Không có hàm ${ham}`)
    }

    const bang = url.pathname.slice('/rest/v1/'.length)
    if (phuongThuc === 'GET') {
      if (bang === 'ho_so') return traDong(loc(du.hoSo.filter((h) => thayHoSo(h.id)), url.searchParams))
      if (bang === 'du_an') {
        const dong = dongDuAn(xepVaCat(loc(du.duAn.filter((d) => duAnThay(d.id)), url.searchParams), url.searchParams))
        return dong instanceof Response ? dong : traDong(dong)
      }
      if (bang === 'nguoi_trong_du_an') {
        const dong = xepVaCat(loc(du.thanhVien.filter((t) => duAnThay(t.du_an_id)), url.searchParams), url.searchParams)
        return traDong(dongNguoiTrong(dong))
      }
      if (bang === 'task') {
        const dong = xepVaCat(loc(du.task.filter((t) => duAnThay(t.du_an_id)), url.searchParams), url.searchParams)
        return traDong(dong.map((t) => chonCot(t, chon.split(','))))
      }
      if (bang === 'repo_du_an') {
        const dong = xepVaCat(loc(du.repo.filter((r) => duAnThay(r.du_an_id)), url.searchParams), url.searchParams)
        return traDong(dong.map((r) => chonCot(r, chon.split(','))))
      }
      return traLoi(404, 'PGRST205', `Không có bảng ${bang}`)
    }

    du.ghi.push(`${phuongThuc} ${bang}`)
    if (bang === 'du_an' && phuongThuc === 'POST') {
      // Policy du_an_tao: chỉ PM; trigger du_an_truoc_khi_tao đặt người tạo, ngày tạo, trạng thái.
      if (!laPM) return traLoi(403, '42501', 'new row violates row-level security policy for table "du_an"')
      const moi = duAnGia(300 + du.duAn.length, {
        ...than,
        ma: String(than.ma).trim().toUpperCase(),
        tao_boi: nguoiGoi.id,
        tao_luc: GIO_MAY_CHU,
      })
      const loi = kiemDongDuAn(null, moi)
      if (loi) return loi
      du.duAn.push(moi)
      return traDong([moi], 201)
    }
    if (bang === 'du_an' && phuongThuc === 'PATCH') {
      // Policy du_an_sua: dòng người gọi không quản lý được thì không bị sửa (không lỗi).
      const dich = loc(du.duAn.filter((d) => duAnQuanLy(d.id)), url.searchParams)
      for (const cu of dich) {
        const moi: Dong = { ...cu, ...than }
        if (typeof moi.ma === 'string') moi.ma = moi.ma.trim().toUpperCase()
        const loi = kiemDongDuAn(cu, moi)
        if (loi) return loi
        Object.assign(cu, moi, { sua_boi: nguoiGoi.id, sua_luc: GIO_MAY_CHU })
      }
      return traDong(dich.map((d) => ({ ...d })))
    }
    if (bang === 'nguoi_trong_du_an' && phuongThuc === 'PATCH') {
      // Policy nguoi_trong_du_an_sua (PM, Support của Dự án); trigger chặn Dự án đã Lưu trữ; ràng buộc độ dài.
      const dich = loc(du.thanhVien.filter((t) => duAnQuanLy(t.du_an_id)), url.searchParams)
      for (const cu of dich) {
        if (!duAnHoatDong(cu.du_an_id)) return loiP0001('DU_AN_DA_LUU_TRU')
        const vaiTro = typeof than.vai_tro === 'string' && than.vai_tro.trim() !== '' ? than.vai_tro.trim() : null
        if (vaiTro !== null && vaiTro.length > DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA) {
          return traLoi(400, '23514', 'new row violates check constraint "nguoi_trong_du_an_vai_tro_hop_le"')
        }
        cu.vai_tro = vaiTro
      }
      return traDong(dongNguoiTrong(dich))
    }
    if (bang === 'nguoi_trong_du_an' && phuongThuc === 'DELETE') {
      // Policy nguoi_trong_du_an_go: PM, Support của Dự án, Dự án đang hoạt động; dòng khác không bị xoá (không lỗi).
      const dich = loc(du.thanhVien.filter((t) => duAnQuanLy(t.du_an_id) && duAnHoatDong(t.du_an_id)), url.searchParams)
      du.thanhVien = du.thanhVien.filter((t) => !dich.includes(t))
      // Khoá ngoại du_an_nguoi_phu_trach_fkey: on delete set null (nguoi_phu_trach_id).
      for (const t of dich) {
        for (const d of du.duAn) if (d.id === t.du_an_id && d.nguoi_phu_trach_id === t.nguoi_dung_id) d.nguoi_phu_trach_id = null
      }
      return traDong(dongNguoiTrong(dich))
    }
    if (bang === 'repo_du_an' && phuongThuc === 'POST') {
      // Trigger repo_du_an_truoc_khi_them: quyền, Dự án tồn tại, chưa Lưu trữ, tên repo, trùng.
      if (!duAnQuanLy(than.du_an_id)) return loiP0001('KHONG_CO_QUYEN')
      const duAn = du.duAn.find((d) => d.id === than.du_an_id)
      if (!duAn) return loiP0001('KHONG_TIM_THAY')
      if (duAn.trang_thai === 'LUU_TRU') return loiP0001('DU_AN_DA_LUU_TRU')
      const tenRepo = String(than.ten_repo)
      if (!laTenRepoHopLe(tenRepo)) return loiP0001('REPO_KHONG_HOP_LE')
      const khoa = tenRepo.toLowerCase()
      if (du.repo.some((r) => r.du_an_id === than.du_an_id && r.ten_repo_khoa === khoa)) return loiP0001('REPO_DA_GAN')
      const moi = { id: id(600 + du.repo.length), du_an_id: than.du_an_id, ten_repo: tenRepo, ten_repo_khoa: khoa, thu_tu: du.repo.length + 1 }
      du.repo.push(moi)
      return traDong([chonCot(moi, chon.split(','))], 201)
    }
    if (bang === 'repo_du_an' && phuongThuc === 'DELETE') {
      // Policy repo_du_an_go (PM, Support của Dự án); trigger repo_du_an_truoc_khi_go chặn Dự án đã Lưu trữ.
      const dich = loc(du.repo.filter((r) => duAnQuanLy(r.du_an_id)), url.searchParams)
      if (dich.some((r) => !duAnHoatDong(r.du_an_id))) return loiP0001('DU_AN_DA_LUU_TRU')
      du.repo = du.repo.filter((r) => !dich.includes(r))
      return traDong(dich.map((r) => chonCot(r, chon.split(','))))
    }
    return traLoi(404, 'PGRST000', `Yêu cầu không mong đợi: ${phuongThuc} ${url.pathname}`)
  }

  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    du.diaChi.push(url.href)
    if (url.origin !== URL_GIA) throw new Error(`Test không được gọi ra ngoài: ${url.href}`)
    return xuLy(url, init)
  }
}

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

function loiCua<T>(kq: KetQua<T>): LoiKho | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi
}

type TenNguoi = 'pm' | 'an' | 'binh' | 'chi' | 'dung'

interface BoiCanh {
  du: DuLieuGia
  kho: KhoSupabase
  dangNhap(ten: TenNguoi): Promise<Phien>
  /** Các địa chỉ PostgREST (lượt gọi tính vào trần) và các yêu cầu ghi mà `lam` gọi tới. */
  luotGoi<T>(lam: () => Promise<T>): Promise<{ ketQua: T; diaChi: string[]; ghi: string[] }>
}

function dungBoiCanh(nhieu = false): BoiCanh {
  const du = dungDuLieu(nhieu)
  const kho = taoKhoSupabase({ url: URL_GIA, khoaCongKhai: KHOA_ANON, tuDongLamMoiPhien: false, fetch: taoFetchGia(du) })
  return {
    du,
    kho,
    dangNhap: async (ten) => giaTri(await kho.dangNhap({ email: `${ten}@vi-du.vn`, matKhau: MAT_KHAU })),
    async luotGoi(lam) {
      const tu = du.diaChi.length
      const tuGhi = du.ghi.length
      const ketQua = await lam()
      const diaChi = du.diaChi.slice(tu).filter((d) => new URL(d).pathname.startsWith('/rest/v1/'))
      return { ketQua, diaChi, ghi: du.ghi.slice(tuGhi) }
    },
  }
}

/**
 * Một lệnh ghi trên đường thành công: ai gọi, gọi gì, và đọc lại bằng lệnh đọc (đường đã có trước ticket) để so kết
 * quả trả về sau khi ghi.
 */
interface CaThanhCong {
  ten: string
  nguoi: TenNguoi
  /** Số lượt gọi sau ticket này. */
  luot: number
  ghi: (kho: KhoSupabase, phien: Phien) => Promise<KetQua<unknown>>
  docLai?: (kho: KhoSupabase, phien: Phien, ketQua: unknown) => Promise<unknown>
}

const docDuAn = async (kho: KhoSupabase, phien: Phien, ketQua: unknown) =>
  giaTri(await kho.layDuAn(phien, (ketQua as { id: string }).id))
const docNguoi = (nguoiId: string) => async (kho: KhoSupabase, phien: Phien) =>
  giaTri(await kho.danhSachNguoiTrongDuAn(phien, ID.duAn)).find((n) => n.id === nguoiId)

const CA_THANH_CONG: CaThanhCong[] = [
  {
    ten: 'tạo Dự án (PM)',
    nguoi: 'pm',
    luot: 2,
    ghi: (kho, p) => kho.taoDuAn(p, { ma: 'MOI-1', ten: 'Mới', khachHang: 'Khách B', ngayBatDau: '2026-07-01', mucUuTien: 'THAP' }, LUC),
    docLai: docDuAn,
  },
  {
    ten: 'sửa Dự án (Support của Dự án)',
    nguoi: 'chi',
    luot: 3,
    ghi: (kho, p) =>
      kho.suaDuAn(p, ID.duAn, { ma: 'ch-99', ngayKetThucDuKien: '2026-07-15', nguoiPhuTrachId: ID.an, mucUuTien: 'THAP' }, LUC),
    docLai: docDuAn,
  },
  {
    ten: 'sửa Dự án (PM không ở trong Dự án)',
    nguoi: 'pm',
    luot: 3,
    ghi: (kho, p) => kho.suaDuAn(p, ID.duAn, { ten: 'Cửa hàng mới' }, LUC),
    docLai: docDuAn,
  },
  { ten: 'Lưu trữ Dự án (PM)', nguoi: 'pm', luot: 3, ghi: (kho, p) => kho.luuTruDuAn(p, ID.duAn, LUC), docLai: docDuAn },
  { ten: 'Lưu trữ Dự án (Support của Dự án)', nguoi: 'chi', luot: 3, ghi: (kho, p) => kho.luuTruDuAn(p, ID.duAn, LUC), docLai: docDuAn },
  { ten: 'mở lại Dự án (PM)', nguoi: 'pm', luot: 3, ghi: (kho, p) => kho.moLaiDuAn(p, ID.duAnLuuTru, LUC), docLai: docDuAn },
  { ten: 'mở lại Dự án (Support của Dự án)', nguoi: 'chi', luot: 3, ghi: (kho, p) => kho.moLaiDuAn(p, ID.duAnLuuTru, LUC), docLai: docDuAn },
  {
    ten: 'thêm người kèm Vai trò trong Dự án (Support của Dự án)',
    nguoi: 'chi',
    luot: 3,
    ghi: (kho, p) => kho.themNguoiVaoDuAn(p, ID.duAn, { email: ' BINH@vi-du.vn ', vaiTroTrongDuAn: ' Phân tích ' }),
    docLai: docNguoi(ID.binh),
  },
  {
    ten: 'thêm người (PM)',
    nguoi: 'pm',
    luot: 3,
    ghi: (kho, p) => kho.themNguoiVaoDuAn(p, ID.duAn, { email: 'dung@vi-du.vn' }),
    docLai: docNguoi(ID.dung),
  },
  {
    ten: 'sửa Vai trò trong Dự án của người đang giữ Task (Support của Dự án)',
    nguoi: 'chi',
    luot: 3,
    ghi: (kho, p) => kho.suaVaiTroTrongDuAn(p, ID.duAn, ID.an, { vaiTroTrongDuAn: ' Kiểm thử ' }),
    docLai: docNguoi(ID.an),
  },
  {
    ten: 'sửa Vai trò trong Dự án (PM), xoá vai trò',
    nguoi: 'pm',
    luot: 3,
    ghi: (kho, p) => kho.suaVaiTroTrongDuAn(p, ID.duAn, ID.chi, { vaiTroTrongDuAn: '' }),
    docLai: docNguoi(ID.chi),
  },
  { ten: 'gỡ người đang giữ Task (PM)', nguoi: 'pm', luot: 2, ghi: (kho, p) => kho.goNguoiKhoiDuAn(p, ID.duAn, ID.an) },
  { ten: 'gỡ người (Support của Dự án)', nguoi: 'chi', luot: 2, ghi: (kho, p) => kho.goNguoiKhoiDuAn(p, ID.duAn, ID.an) },
  {
    ten: 'gắn repo (Support của Dự án)',
    nguoi: 'chi',
    luot: 2,
    ghi: (kho, p) => kho.ganRepoVaoDuAn(p, ID.duAn, { repo: ' Facebook/React ' }),
    docLai: async (kho, p, kq) =>
      giaTri(await kho.danhSachRepoCuaDuAn(p, ID.duAn)).find((r) => r.tenRepo === (kq as { tenRepo: string }).tenRepo),
  },
  { ten: 'gắn repo (PM)', nguoi: 'pm', luot: 2, ghi: (kho, p) => kho.ganRepoVaoDuAn(p, ID.duAn, { repo: 'a/b' }) },
  { ten: 'gỡ repo (Support của Dự án)', nguoi: 'chi', luot: 2, ghi: (kho, p) => kho.goRepoKhoiDuAn(p, ID.duAn, 'VERCEL/next.js') },
  { ten: 'gỡ repo (PM)', nguoi: 'pm', luot: 2, ghi: (kho, p) => kho.goRepoKhoiDuAn(p, ID.duAn, 'vercel/next.js') },
]

const CO_DU_LIEU = [
  { ten: 'Dự án nhỏ (3 Task, 2 người)', nhieu: false },
  { ten: 'Dự án lớn (40 Task, 7 người)', nhieu: true },
] as const

describe('bản Supabase: mỗi lệnh ghi Dự án và Người trong dự án tốn nhiều nhất 3 lượt gọi', () => {
  describe.each(CO_DU_LIEU)('cỡ dữ liệu: $ten', ({ nhieu }) => {
    it.each(CA_THANH_CONG)('$ten: nhiều nhất 3 lượt kể cả đọc lại kết quả; kết quả bằng lần đọc kế tiếp', async (ca) => {
      const { kho, dangNhap, luotGoi } = dungBoiCanh(nhieu)
      const phien = await dangNhap(ca.nguoi)
      const { ketQua, diaChi, ghi } = await luotGoi(() => ca.ghi(kho, phien))
      const giaTriGhi = giaTri(ketQua)
      expect(diaChi.length).toBeLessThanOrEqual(TRAN)
      expect(diaChi).toHaveLength(ca.luot)
      expect(ghi).toHaveLength(1)
      if (ca.docLai) expect(giaTriGhi).toEqual(await ca.docLai(kho, phien, giaTriGhi))
    })
  })

  it('kết quả sau khi ghi đủ như trước: Dự án kèm Dấu vết có tên, Người trong dự án kèm số Task đang giữ', async () => {
    const { kho, dangNhap } = dungBoiCanh()
    const chi = await dangNhap('chi')
    const pm = await dangNhap('pm')

    const sua = giaTri(await kho.suaDuAn(chi, ID.duAn, { ma: 'ch-99', nguoiPhuTrachId: ID.an }, LUC))
    expect(sua).toMatchObject({
      id: ID.duAn,
      ma: 'CH-99',
      ten: 'Cửa hàng',
      nguoiPhuTrach: { id: ID.an, tenHienThi: 'An' },
      trangThai: 'HOAT_DONG',
      dauVet: {
        taoBoi: { id: ID.pm, tenHienThi: 'Pm' },
        taoLuc: new Date('2026-05-01T02:00:00+00:00'),
        suaBoi: { id: ID.chi, tenHienThi: 'Chi' },
        suaLuc: new Date(GIO_MAY_CHU),
      },
    })

    const luuTru = giaTri(await kho.luuTruDuAn(pm, ID.duAn, LUC))
    expect(luuTru).toEqual({ ...sua, trangThai: 'LUU_TRU', dauVet: { ...sua.dauVet, suaBoi: { id: ID.pm, tenHienThi: 'Pm' } } })
    const moLai = giaTri(await kho.moLaiDuAn(chi, ID.duAn, LUC))
    expect(moLai).toEqual({ ...sua, trangThai: 'HOAT_DONG' })

    const tao = giaTri(await kho.taoDuAn(pm, { ma: 'moi-2', ten: 'Mới' }, LUC))
    expect(tao).toMatchObject({ ma: 'MOI-2', nguoiPhuTrach: null, dauVet: { taoBoi: { id: ID.pm, tenHienThi: 'Pm' }, suaBoi: null, suaLuc: null } })

    expect(giaTri(await kho.suaVaiTroTrongDuAn(chi, ID.duAn, ID.an, { vaiTroTrongDuAn: 'Lập trình' }))).toEqual({
      id: ID.an,
      email: 'an@vi-du.vn',
      tenHienThi: 'An',
      vai: 'THANH_VIEN',
      soDienThoai: '0900000002',
      chucDanh: 'Chức danh An',
      phongBan: null,
      vaiTroTrongDuAn: 'Lập trình',
      soTaskDangGiu: 2,
    })
    expect(giaTri(await kho.themNguoiVaoDuAn(chi, ID.duAn, { email: 'binh@vi-du.vn' }))).toMatchObject({
      id: ID.binh,
      tenHienThi: 'Bình',
      vaiTroTrongDuAn: null,
      soTaskDangGiu: 0,
    })
    expect(giaTri(await kho.ganRepoVaoDuAn(chi, ID.duAn, { repo: ' a/b ' }))).toEqual({ tenRepo: 'a/b' })
  })

  it('gỡ người đang giữ Task vẫn được: người đó rời danh sách, Task giữ nguyên Người thực hiện', async () => {
    const { du, kho, dangNhap } = dungBoiCanh()
    const pm = await dangNhap('pm')
    expect(giaTri(await kho.goNguoiKhoiDuAn(pm, ID.duAn, ID.an))).toBeNull()
    expect(giaTri(await kho.danhSachNguoiTrongDuAn(pm, ID.duAn)).map((n) => n.id)).not.toContain(ID.an)
    expect(du.task.filter((t) => t.nguoi_thuc_hien_id === ID.an)).toHaveLength(3)
  })

  it('số lượt gọi không tăng theo số Task hay số người', async () => {
    const dem = async (nhieu: boolean) => {
      const so: Record<string, number> = {}
      for (const ca of CA_THANH_CONG) {
        const { kho, dangNhap, luotGoi } = dungBoiCanh(nhieu)
        const phien = await dangNhap(ca.nguoi)
        so[ca.ten] = (await luotGoi(() => ca.ghi(kho, phien))).diaChi.length
      }
      return so
    }
    expect(await dem(true)).toEqual(await dem(false))
  })
})

describe('dữ liệu biểu mẫu sai: lỗi theo từng ô như luật thuần, không có lượt gọi nào ghi lên Supabase', () => {
  const kiemLoi = (kt: { ok: true } | { ok: false; loiTheoO: Record<string, string> }, ma: MaLoi = 'KHONG_HOP_LE') => {
    if (kt.ok) throw new Error('Dữ liệu mẫu phải sai')
    const kq = thatBai(ma, undefined, kt.loiTheoO)
    return kq.ok ? 'THANH_CONG' : kq.loi
  }
  const dauVaoSai = {
    taoDuAn: { ma: 'sai mã!', ten: '', ngayBatDau: '2026-07-02', ngayKetThucDuKien: '2026-07-01' },
    suaDuAn: { ma: 'x', ten: '' },
    themNguoi: { email: 'khong-phai-email', vaiTroTrongDuAn: 'x'.repeat(DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA + 1) },
    suaVaiTro: { vaiTroTrongDuAn: 'x'.repeat(DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA + 1) },
    ganRepo: { repo: 'khong-co-gach-cheo' },
  }

  it.each(['pm', 'chi'] as const)('%s: mỗi lệnh trả đúng lỗi theo ô, không ghi gì', async (ten) => {
    const { kho, dangNhap, luotGoi } = dungBoiCanh()
    const phien = await dangNhap(ten)
    const ca: [() => Promise<KetQua<unknown>>, LoiKho | 'THANH_CONG'][] = [
      [() => kho.suaDuAn(phien, ID.duAn, dauVaoSai.suaDuAn, LUC), kiemLoi(kiemTraDuAn.sua(dauVaoSai.suaDuAn))],
      [() => kho.themNguoiVaoDuAn(phien, ID.duAn, dauVaoSai.themNguoi), kiemLoi(kiemTraDuAn.themNguoi(dauVaoSai.themNguoi))],
      [
        () => kho.suaVaiTroTrongDuAn(phien, ID.duAn, ID.an, dauVaoSai.suaVaiTro),
        kiemLoi(kiemTraDuAn.suaVaiTro(dauVaoSai.suaVaiTro)),
      ],
      [() => kho.ganRepoVaoDuAn(phien, ID.duAn, dauVaoSai.ganRepo), kiemLoi(kiemTraRepo.gan(dauVaoSai.ganRepo), 'REPO_KHONG_HOP_LE')],
      // Ngày kết thúc dự kiến trước Ngày bắt đầu đang lưu (2026-06-01): lỗi ở ô vừa gửi.
      [
        () => kho.suaDuAn(phien, ID.duAn, { ngayKetThucDuKien: '2026-05-31' }, LUC),
        { ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE, loiTheoO: { ngayKetThucDuKien: THONG_BAO_DU_AN.ngayKetThucTruocBatDau } },
      ],
      // Người phụ trách id sai dạng: chắc chắn ngoài Dự án.
      [
        () => kho.suaDuAn(phien, ID.duAn, { nguoiPhuTrachId: 'khong-phai-uuid' }, LUC),
        { ma: 'NGUOI_NGOAI_DU_AN', thongBao: THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn, loiTheoO: { nguoiPhuTrachId: THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn } },
      ],
    ]
    if (ten === 'pm') ca.push([() => kho.taoDuAn(phien, dauVaoSai.taoDuAn, LUC), kiemLoi(kiemTraDuAn.tao(dauVaoSai.taoDuAn))])
    for (const [lenh, mongDoi] of ca) {
      const { ketQua, ghi } = await luotGoi(lenh)
      expect(loiCua(ketQua)).toEqual(mongDoi)
      expect(ghi).toEqual([])
    }
  })
})

describe('các ca từ chối: đúng mã lỗi và đúng thứ tự như trước', () => {
  it('không có quyền trước không tìm thấy (kể cả khi dữ liệu biểu mẫu cũng sai); PM nhận không tìm thấy; không ghi gì', async () => {
    const { kho, dangNhap, luotGoi } = dungBoiCanh()
    const lenh = (p: Phien, duAnId: string): (() => Promise<KetQua<unknown>>)[] => [
      () => kho.suaDuAn(p, duAnId, { ma: 'x' }, LUC),
      () => kho.luuTruDuAn(p, duAnId, LUC),
      () => kho.moLaiDuAn(p, duAnId, LUC),
      () => kho.themNguoiVaoDuAn(p, duAnId, { email: 'khong-phai-email' }),
      () => kho.goNguoiKhoiDuAn(p, duAnId, ID.an),
      () => kho.suaVaiTroTrongDuAn(p, duAnId, ID.an, { vaiTroTrongDuAn: 'x'.repeat(DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA + 1) }),
      () => kho.ganRepoVaoDuAn(p, duAnId, { repo: 'sai' }),
      () => kho.goRepoKhoiDuAn(p, duAnId, 'vercel/next.js'),
    ]
    // Thành viên trong Dự án, Thành viên và Support ngoài Dự án; Dự án có, đã Lưu trữ, không có, id sai dạng.
    for (const ten of ['an', 'binh', 'dung'] as const) {
      const phien = await dangNhap(ten)
      for (const duAnId of [ID.duAn, ID.duAnKhac, ID.duAnLuuTru, ID.khongCo, 'khong-phai-uuid']) {
        for (const goi of lenh(phien, duAnId)) {
          const { ketQua, ghi } = await luotGoi(goi)
          expect(maLoi(ketQua), `${ten} ${duAnId}`).toBe('KHONG_CO_QUYEN')
          // Chỉ hàm của cơ sở dữ liệu (Lưu trữ, mở lại) có thể được gửi đi; nó tự từ chối, không ghi gì.
          for (const yeuCau of ghi) expect(yeuCau).toMatch(/^RPC (luu_tru_du_an|mo_lai_du_an)$/)
        }
      }
    }
    expect(maLoi(await kho.taoDuAn(await dangNhap('chi'), { ma: 'sai mã!', ten: '' }, LUC))).toBe('KHONG_CO_QUYEN')

    const pm = await dangNhap('pm')
    for (const duAnId of [ID.khongCo, 'khong-phai-uuid']) {
      for (const goi of lenh(pm, duAnId)) expect(maLoi(await goi()), duAnId).toBe('KHONG_TIM_THAY')
    }
  })

  it('Dự án đã Lưu trữ: DU_AN_DA_LUU_TRU trước lỗi dữ liệu; mở lại Dự án đang hoạt động: DU_AN_DANG_HOAT_DONG', async () => {
    const { du, kho, dangNhap } = dungBoiCanh()
    for (const ten of ['pm', 'chi'] as const) {
      const p = await dangNhap(ten)
      const ca: (() => Promise<KetQua<unknown>>)[] = [
        () => kho.suaDuAn(p, ID.duAnLuuTru, { ma: 'x' }, LUC),
        () => kho.suaDuAn(p, ID.duAnLuuTru, { ten: 'Hợp lệ' }, LUC),
        () => kho.luuTruDuAn(p, ID.duAnLuuTru, LUC),
        () => kho.themNguoiVaoDuAn(p, ID.duAnLuuTru, { email: 'khong-phai-email' }),
        () => kho.themNguoiVaoDuAn(p, ID.duAnLuuTru, { email: 'binh@vi-du.vn' }),
        () => kho.goNguoiKhoiDuAn(p, ID.duAnLuuTru, ID.an),
        () => kho.suaVaiTroTrongDuAn(p, ID.duAnLuuTru, ID.an, { vaiTroTrongDuAn: 'x'.repeat(DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA + 1) }),
        () => kho.suaVaiTroTrongDuAn(p, ID.duAnLuuTru, ID.an, { vaiTroTrongDuAn: 'Hợp lệ' }),
        () => kho.ganRepoVaoDuAn(p, ID.duAnLuuTru, { repo: 'sai' }),
        () => kho.ganRepoVaoDuAn(p, ID.duAnLuuTru, { repo: 'a/b' }),
        () => kho.goRepoKhoiDuAn(p, ID.duAnLuuTru, 'a/b'),
      ]
      for (const goi of ca) expect(maLoi(await goi()), ten).toBe('DU_AN_DA_LUU_TRU')
      expect(maLoi(await kho.moLaiDuAn(p, ID.duAn, LUC)), ten).toBe('DU_AN_DANG_HOAT_DONG')
    }
    expect(du.thanhVien.filter((t) => t.du_an_id === ID.duAnLuuTru)).toHaveLength(2)
    expect(du.duAn.find((d) => d.id === ID.duAnLuuTru)?.trang_thai).toBe('LUU_TRU')
  })

  it('Mã Dự án trùng (khác hoa thường, kể cả Mã của Dự án đã Lưu trữ) khi tạo và sửa: MA_DU_AN_DA_DUNG ở ô Mã', async () => {
    const { kho, dangNhap } = dungBoiCanh()
    const pm = await dangNhap('pm')
    const chi = await dangNhap('chi')
    const trung: LoiKho = { ma: 'MA_DU_AN_DA_DUNG', thongBao: THONG_BAO_MAC_DINH.MA_DU_AN_DA_DUNG, loiTheoO: { ma: THONG_BAO_DU_AN.maTrung } }
    expect(loiCua(await kho.taoDuAn(pm, { ma: 'kho-02', ten: 'Bản sao' }, LUC))).toEqual(trung)
    expect(loiCua(await kho.suaDuAn(chi, ID.duAn, { ma: 'cu-03' }, LUC))).toEqual(trung)
    expect(giaTri(await kho.suaDuAn(chi, ID.duAn, { ma: 'ch-01' }, LUC)).ma).toBe('CH-01')
  })

  it('Người phụ trách ngoài Dự án (đã đăng ký chưa thêm, PM không ở trong, id không tồn tại); báo trước Mã trùng', async () => {
    const { kho, dangNhap } = dungBoiCanh()
    const pm = await dangNhap('pm')
    const ngoai: LoiKho = {
      ma: 'NGUOI_NGOAI_DU_AN',
      thongBao: THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn,
      loiTheoO: { nguoiPhuTrachId: THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn },
    }
    for (const nguoi of [ID.binh, ID.pm, id(999)]) {
      expect(loiCua(await kho.suaDuAn(pm, ID.duAn, { nguoiPhuTrachId: nguoi }, LUC)), nguoi).toEqual(ngoai)
    }
    expect(loiCua(await kho.suaDuAn(pm, ID.duAn, { nguoiPhuTrachId: ID.binh, ma: 'KHO-02' }, LUC))).toEqual(ngoai)
  })

  it('thêm người: chưa đăng ký, đã ở trong Dự án; sửa vai trò và gỡ người ngoài Dự án; gắn repo trùng, gỡ repo chưa gắn', async () => {
    const { kho, dangNhap } = dungBoiCanh()
    const chi = await dangNhap('chi')
    expect(loiCua(await kho.themNguoiVaoDuAn(chi, ID.duAn, { email: 'chua-co@vi-du.vn' }))).toEqual({
      ma: 'CHUA_DANG_KY',
      thongBao: THONG_BAO_MAC_DINH.CHUA_DANG_KY,
      loiTheoO: { email: THONG_BAO_MAC_DINH.CHUA_DANG_KY },
    })
    expect(maLoi(await kho.themNguoiVaoDuAn(chi, ID.duAn, { email: 'an@vi-du.vn' }))).toBe('DA_TRONG_DU_AN')
    expect(loiCua(await kho.suaVaiTroTrongDuAn(chi, ID.duAn, ID.binh, { vaiTroTrongDuAn: 'X' }))).toEqual({
      ma: 'KHONG_TIM_THAY',
      thongBao: THONG_BAO_DU_AN.khongTrongDuAn,
    })
    expect(maLoi(await kho.goNguoiKhoiDuAn(chi, ID.duAn, ID.binh))).toBe('KHONG_TIM_THAY')
    expect(maLoi(await kho.goNguoiKhoiDuAn(chi, ID.duAn, 'khong-phai-uuid'))).toBe('KHONG_TIM_THAY')
    expect(maLoi(await kho.ganRepoVaoDuAn(chi, ID.duAn, { repo: 'Vercel/Next.js' }))).toBe('REPO_DA_GAN')
    expect(maLoi(await kho.goRepoKhoiDuAn(chi, ID.duAn, 'a/chua-gan'))).toBe('KHONG_TIM_THAY')
  })

  it('vai mới có hiệu lực ngay: vừa được nâng lên Support thì Lưu trữ được; vừa bị hạ xuống Thành viên thì KHONG_CO_QUYEN', async () => {
    const { du, kho, dangNhap } = dungBoiCanh()
    const an = await dangNhap('an')
    const chi = await dangNhap('chi')
    const hoSo = (nguoiId: string) => du.hoSo.find((h) => h.id === nguoiId) as Dong
    hoSo(ID.an).vai = 'SUPPORT'
    hoSo(ID.chi).vai = 'THANH_VIEN'
    expect(maLoi(await kho.luuTruDuAn(chi, ID.duAn, LUC))).toBe('KHONG_CO_QUYEN')
    expect(maLoi(await kho.themNguoiVaoDuAn(chi, ID.duAn, { email: 'binh@vi-du.vn' }))).toBe('KHONG_CO_QUYEN')
    expect(giaTri(await kho.luuTruDuAn(an, ID.duAn, LUC)).trangThai).toBe('LUU_TRU')
    expect(giaTri(await kho.moLaiDuAn(an, ID.duAn, LUC)).trangThai).toBe('HOAT_DONG')
    expect(giaTri(await kho.themNguoiVaoDuAn(an, ID.duAn, { email: 'binh@vi-du.vn' })).id).toBe(ID.binh)
  })

  it('chưa đăng nhập: CHUA_DANG_NHAP, không gọi mạng', async () => {
    const { kho, luotGoi } = dungBoiCanh()
    const { ketQua, diaChi } = await luotGoi(() =>
      Promise.all([
        kho.taoDuAn(null, { ma: 'A-1', ten: 'A' }, LUC),
        kho.suaDuAn(null, ID.duAn, { ten: 'A' }, LUC),
        kho.luuTruDuAn(null, ID.duAn, LUC),
        kho.moLaiDuAn(null, ID.duAn, LUC),
        kho.themNguoiVaoDuAn(null, ID.duAn, { email: 'binh@vi-du.vn' }),
        kho.goNguoiKhoiDuAn(null, ID.duAn, ID.an),
        kho.suaVaiTroTrongDuAn(null, ID.duAn, ID.an, { vaiTroTrongDuAn: 'X' }),
        kho.ganRepoVaoDuAn(null, ID.duAn, { repo: 'a/b' }),
        kho.goRepoKhoiDuAn(null, ID.duAn, 'a/b'),
      ]),
    )
    expect(ketQua.map((kq) => maLoi<unknown>(kq))).toEqual(Array(9).fill('CHUA_DANG_NHAP'))
    expect(diaChi).toEqual([])
  })

  it('mọi lượt gọi đều tới Supabase giả, không ra mạng', async () => {
    for (const ca of CA_THANH_CONG) {
      const { du, kho, dangNhap } = dungBoiCanh()
      giaTri(await ca.ghi(kho, await dangNhap(ca.nguoi)))
      expect(du.diaChi.length).toBeGreaterThan(0)
      for (const diaChi of du.diaChi) expect(new URL(diaChi).origin).toBe(URL_GIA)
    }
  })
})
