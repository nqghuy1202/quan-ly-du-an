// Xác định người gọi một chỗ và nhớ hồ sơ theo phiên trên bản Supabase (ticket toi-uu-hieu-nang 01), không cần
// mạng hay DB: máy chủ là một `fetch` giả trong bộ nhớ, ghi lại mọi địa chỉ được gọi để đếm lượt gọi.
//
// Một lượt gọi là một yêu cầu tới PostgREST (`/rest/v1/`: đọc bảng hoặc gọi hàm). Không tính Auth (`/auth/v1/`:
// đăng nhập, làm mới phiên), đúng cách đếm của spec `.scratch/toi-uu-hieu-nang/spec.md`. `fetch` giả bắt chước thô
// phân quyền từng dòng (PM thấy mọi Dự án; người khác Dự án mình ở trong; Support sửa Dự án mình ở trong) và trigger
// ho_so_truoc_khi_sua (chỉ PM đổi vai; chỉ chủ hồ sơ sửa hồ sơ mình), theo vai ĐANG LƯU ở máy chủ: đổi vai giữa
// hai lệnh là sửa thẳng dữ liệu giả, như PM khác vừa đổi vai ở một trình duyệt khác.
import { describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import { taoKhoSupabase } from './khoSupabase'
import type { KhoDuLieu, Phien } from './khoDuLieu'

/** JWT giả (chữ ký không hợp lệ), như cauHinh.test.ts. */
function jwtGia(than: Record<string, unknown>): string {
  const ma = (doiTuong: Record<string, unknown>) =>
    btoa(JSON.stringify(doiTuong)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${ma({ alg: 'HS256', typ: 'JWT' })}.${ma(than)}.chu-ky-gia`
}

const URL_GIA = 'https://nguoi-goi-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'nguoi-goi-gia', role: 'anon' })
const MAT_KHAU = 'matkhau-dung-1'
const LUC = new Date('2026-06-02T08:30:00+07:00')

type Dong = Record<string, unknown>

const id = (so: number) => `00000000-0000-4000-8000-${String(so).padStart(12, '0')}`
const ID = { pm: id(1), an: id(2), binh: id(3), chi: id(4), duAn: id(10), duAnKhac: id(11) }

/**
 * Số lượt gọi của từng lệnh đọc đơn TRƯỚC ticket này (đếm bằng chính các ca dưới đây trên mã cũ, khi mọi lệnh
 * còn đọc hồ sơ người gọi trước khi làm việc chính).
 */
const TRUOC = { danhSachNguoiDung: 2, danhSachDuAnCuaToi: 2, danhSachDuAn: 3 }

interface DuLieuGia {
  hoSo: Dong[]
  duAn: Dong[]
  thanhVien: Dong[]
  /** Mã truy cập máy chủ không còn nhận (phiên bị thu hồi hay JWT hết hạn): PostgREST trả 401 PGRST301. */
  maBiThuHoi: Set<string>
  /** Thời hạn (giây) của mã truy cập cấp khi đăng nhập. */
  thoiHan: number
  /** Mọi địa chỉ đã gọi. */
  diaChi: string[]
}

function hoSoGia(so: number, ten: string, vai: string): Dong {
  return {
    id: id(so),
    email: `${ten.toLowerCase()}@vi-du.vn`,
    ten_hien_thi: ten,
    github_username: null,
    vai,
    so_dien_thoai: null,
    chuc_danh: null,
    phong_ban: null,
  }
}

function duAnGia(dong: Dong): Dong {
  return {
    mo_ta: '',
    khach_hang: '',
    ngay_bat_dau: null,
    ngay_ket_thuc_du_kien: null,
    muc_uu_tien: 'TRUNG_BINH',
    nguoi_phu_trach_id: null,
    trang_thai: 'HOAT_DONG',
    tao_boi: ID.pm,
    tao_luc: '2026-06-01T02:00:00+00:00',
    sua_boi: null,
    sua_luc: null,
    ...dong,
  }
}

function dungDuLieu(): DuLieuGia {
  return {
    hoSo: [hoSoGia(1, 'Pm', 'PM'), hoSoGia(2, 'An', 'THANH_VIEN'), hoSoGia(3, 'Binh', 'THANH_VIEN'), hoSoGia(4, 'Chi', 'SUPPORT')],
    duAn: [duAnGia({ id: ID.duAn, ma: 'CH-01', ten: 'Cửa hàng' }), duAnGia({ id: ID.duAnKhac, ma: 'KHO-02', ten: 'Kho' })],
    thanhVien: [
      { du_an_id: ID.duAn, nguoi_dung_id: ID.an },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.chi },
      { du_an_id: ID.duAnKhac, nguoi_dung_id: ID.binh },
    ],
    maBiThuHoi: new Set(),
    thoiHan: 3600,
    diaChi: [],
  }
}

function tra(trangThai: number, than?: unknown, tieuDe: Record<string, string> = {}): Response {
  return new Response(than === undefined ? null : JSON.stringify(than), {
    status: trangThai,
    headers: { 'content-type': 'application/json', ...tieuDe },
  })
}

function traLoi(trangThai: number, code: string, message: string): Response {
  return tra(trangThai, { code, message, details: null, hint: null })
}

/** Lọc dòng theo các bộ lọc `cot=eq.giaTri` của PostgREST; bỏ qua phần còn lại. */
function loc(dong: readonly Dong[], thamSo: URLSearchParams): Dong[] {
  return dong.filter((d) => {
    for (const [khoa, giaTri] of thamSo) {
      if (giaTri.startsWith('eq.') && String(d[khoa]) !== giaTri.slice(3)) return false
    }
    return true
  })
}

function taoFetchGia(du: DuLieuGia): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    du.diaChi.push(url.href)
    if (url.origin !== URL_GIA) throw new Error(`Test không được gọi ra ngoài: ${url.href}`)
    const phuongThuc = (init?.method ?? 'GET').toUpperCase()
    const than = typeof init?.body === 'string' && init.body !== '' ? (JSON.parse(init.body) as Dong) : {}
    const tieuDe = new Headers(init?.headers)

    if (url.pathname === '/auth/v1/token') {
      // Làm mới phiên (grant_type=refresh_token) không có email: luôn bị từ chối, phiên bị bỏ.
      const nguoi = du.hoSo.find((h) => h.email === than.email)
      if (!nguoi) return tra(400, { code: 'invalid_grant', error_code: 'invalid_grant', msg: 'sai' })
      return tra(200, {
        access_token: `token-${String(nguoi.id)}`,
        token_type: 'bearer',
        expires_in: du.thoiHan,
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
    if (maTruyCap && du.maBiThuHoi.has(maTruyCap)) return traLoi(401, 'PGRST301', 'JWT expired')
    const nguoiGoi = du.hoSo.find((h) => `token-${String(h.id)}` === maTruyCap)
    const laPM = nguoiGoi?.vai === 'PM'
    const laThanhVien = (duAnId: unknown, nguoiId: unknown) =>
      du.thanhVien.some((t) => t.du_an_id === duAnId && t.nguoi_dung_id === nguoiId)
    const duAnThay = (duAnId: unknown) => laPM || laThanhVien(duAnId, nguoiGoi?.id)
    const duAnQuanLy = (duAnId: unknown) => laPM || (nguoiGoi?.vai === 'SUPPORT' && laThanhVien(duAnId, nguoiGoi.id))
    const motDoiTuong = (tieuDe.get('accept') ?? '').includes('vnd.pgrst.object')
    const traDong = (dong: Dong[]) => tra(200, motDoiTuong ? (dong[0] ?? null) : dong)

    if (url.pathname === '/rest/v1/rpc/ten_nguoi_dau_vet') {
      const ids = (than.p_ids as string[]) ?? []
      return tra(200, du.hoSo.filter((h) => ids.includes(String(h.id))).map((h) => ({ id: h.id, ten_hien_thi: h.ten_hien_thi })))
    }

    const bang = url.pathname.slice('/rest/v1/'.length)
    if (bang === 'ho_so' && phuongThuc === 'HEAD') {
      const so = loc(du.hoSo, url.searchParams).length
      return new Response(null, { status: 200, headers: { 'content-range': `0-${Math.max(so - 1, 0)}/${so}` } })
    }
    if (phuongThuc === 'GET') {
      // ho_so_doc chỉ cho người đã đăng nhập (`to authenticated`): yêu cầu bằng khoá công khai không thấy dòng nào.
      if (bang === 'ho_so') return traDong(nguoiGoi ? loc(du.hoSo, url.searchParams) : [])
      if (bang === 'du_an') {
        const dong = loc(du.duAn.filter((d) => duAnThay(d.id)), url.searchParams)
        // Nhúng id Người trong dự án (lượt kiểm quản lý Dự án, ticket toi-uu-hieu-nang 05).
        if (!(url.searchParams.get('select') ?? '').includes('nguoi_trong_du_an!nguoi_trong_du_an_du_an_id_fkey(nguoi_dung_id)')) {
          return traDong(dong)
        }
        return traDong(
          dong.map((d) => ({
            ...d,
            nguoi_trong_du_an: du.thanhVien.filter((t) => t.du_an_id === d.id).map((t) => ({ nguoi_dung_id: t.nguoi_dung_id })),
          })),
        )
      }
      if (bang === 'nguoi_trong_du_an') {
        const dong = loc(du.thanhVien.filter((t) => duAnThay(t.du_an_id)), url.searchParams)
        // Nhúng Dự án (danhSachDuAnCuaToi): `select=du_an(id,ma,ten,trang_thai)`.
        const nhung = /^du_an\(([^)]*)\)$/.exec(url.searchParams.get('select') ?? '')
        if (!nhung) return traDong(dong)
        const cot = nhung[1].split(',')
        return traDong(
          dong.map((t) => {
            const duAn = du.duAn.find((d) => d.id === t.du_an_id)
            return { du_an: duAn ? Object.fromEntries(cot.map((c) => [c, duAn[c]])) : null }
          }),
        )
      }
    }
    if (phuongThuc === 'PATCH' && bang === 'ho_so') {
      // Trigger ho_so_truoc_khi_sua: chỉ PM đổi vai; chỉ chủ hồ sơ sửa các cột còn lại.
      const dich = loc(du.hoSo, url.searchParams)
      for (const cu of dich) {
        if ('vai' in than && !laPM) return traLoi(400, 'P0001', 'KHONG_CO_QUYEN')
        if (!('vai' in than) && cu.id !== nguoiGoi?.id) return traLoi(400, 'P0001', 'KHONG_CO_QUYEN')
        Object.assign(cu, than)
      }
      return traDong(dich)
    }
    if (phuongThuc === 'PATCH' && bang === 'du_an') {
      // Phân quyền từng dòng du_an_sua: dòng người gọi không quản lý được thì không bị sửa (không lỗi).
      const dich = loc(du.duAn.filter((d) => duAnQuanLy(d.id)), url.searchParams)
      for (const cu of dich) Object.assign(cu, than, { sua_boi: nguoiGoi?.id, sua_luc: '2026-06-02T05:00:00+00:00' })
      return traDong(dich)
    }
    return traLoi(404, 'PGRST000', `Yêu cầu không mong đợi: ${phuongThuc} ${url.pathname}`)
  }
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

interface BoiCanh {
  du: DuLieuGia
  kho: KhoDuLieu
  dangNhap(ten: string): Promise<Phien>
  /** Các địa chỉ PostgREST (lượt gọi tính vào trần) mà `lam` gọi tới. */
  luotGoi<T>(lam: () => Promise<T>): Promise<{ ketQua: T; diaChi: string[] }>
}

function dungBoiCanh(): BoiCanh {
  const du = dungDuLieu()
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

/** Lượt đọc hồ sơ của chính người gọi (`ho_so?...id=eq.<id>`). */
function docHoSoCua(diaChi: readonly string[], nguoiDungId: string): string[] {
  return diaChi.filter((d) => {
    const url = new URL(d)
    return url.pathname === '/rest/v1/ho_so' && url.searchParams.get('id') === `eq.${nguoiDungId}`
  })
}

function doiVaiTrenMayChu(du: DuLieuGia, nguoiDungId: string, vai: string): void {
  const hoSo = du.hoSo.find((h) => h.id === nguoiDungId)
  if (!hoSo) throw new Error('Không có hồ sơ')
  hoSo.vai = vai
}

describe('bản Supabase: xác định người gọi một chỗ, nhớ hồ sơ theo phiên', () => {
  describe('lệnh đọc đơn sau khi đăng nhập không đọc lại hồ sơ', () => {
    it.each([
      { lenh: 'danhSachNguoiDung' as const, ten: 'pm', id: ID.pm, sau: 1 },
      { lenh: 'danhSachDuAnCuaToi' as const, ten: 'an', id: ID.an, sau: 1 },
      { lenh: 'danhSachDuAn' as const, ten: 'an', id: ID.an, sau: 2 },
      { lenh: 'danhSachDuAn' as const, ten: 'pm', id: ID.pm, sau: 2 },
    ])('$lenh của $ten: $sau lượt gọi, không lượt nào đọc hồ sơ người gọi', async ({ lenh, ten, id: nguoiDungId, sau }) => {
      const { kho, dangNhap, luotGoi } = dungBoiCanh()
      const phien = await dangNhap(ten)
      const { ketQua, diaChi } = await luotGoi((): Promise<KetQua<unknown>> => kho[lenh](phien))
      expect(maLoi(ketQua)).toBe('THANH_CONG')
      expect(docHoSoCua(diaChi, nguoiDungId)).toEqual([])
      expect(diaChi).toHaveLength(sau)
      expect(diaChi.length).toBeLessThanOrEqual(2)
      expect(diaChi.length).toBeLessThanOrEqual(TRUOC[lenh] - 1)
    })

    it('kết quả vẫn đúng như trước: danh sách người dùng, Dự án của tôi, danh sách Dự án theo quyền xem', async () => {
      const { kho, dangNhap } = dungBoiCanh()
      const pm = await dangNhap('pm')
      const an = await dangNhap('an')
      expect(giaTri(await kho.danhSachNguoiDung(pm)).map((n) => n.id)).toEqual([ID.pm, ID.an, ID.binh, ID.chi])
      expect(giaTri(await kho.danhSachDuAnCuaToi(an)).map((d) => d.ma)).toEqual(['CH-01'])
      expect(giaTri(await kho.danhSachDuAn(an)).map((d) => d.ma)).toEqual(['CH-01'])
      expect(giaTri(await kho.danhSachDuAn(pm)).map((d) => d.ma)).toEqual(['CH-01', 'KHO-02'])
      expect(maLoi(await kho.danhSachNguoiDung(an))).toBe('KHONG_CO_QUYEN')
    })

    it('gọi liên tiếp hai lệnh đọc thì lệnh thứ hai không đọc hồ sơ', async () => {
      const { kho, dangNhap, luotGoi } = dungBoiCanh()
      const an = await dangNhap('an')
      giaTri(await kho.danhSachDuAnCuaToi(an))
      const { ketQua, diaChi } = await luotGoi(() => kho.danhSachDuAn(an))
      expect(maLoi(ketQua)).toBe('THANH_CONG')
      expect(docHoSoCua(diaChi, ID.an)).toEqual([])
      expect(diaChi.every((d) => new URL(d).pathname !== '/rest/v1/ho_so')).toBe(true)
    })

    it('các lệnh gọi cùng lúc ngay sau đăng nhập không lệnh nào đọc hồ sơ', async () => {
      const { kho, dangNhap, luotGoi } = dungBoiCanh()
      const an = await dangNhap('an')
      const { ketQua, diaChi } = await luotGoi(() =>
        Promise.all([kho.danhSachDuAnCuaToi(an), kho.danhSachDuAn(an), kho.layDuAn(an, ID.duAn)]),
      )
      expect(ketQua.map((kq) => maLoi<unknown>(kq))).toEqual(['THANH_CONG', 'THANH_CONG', 'THANH_CONG'])
      expect(docHoSoCua(diaChi, ID.an)).toEqual([])
    })
  })

  describe('hồ sơ của tôi', () => {
    it('lệnh đọc hồ sơ của tôi luôn gọi mạng và trả hồ sơ mới nhất', async () => {
      const { du, kho, dangNhap, luotGoi } = dungBoiCanh()
      const an = await dangNhap('an')
      const lan1 = await luotGoi(() => kho.layHoSoCuaToi(an))
      expect(giaTri(lan1.ketQua).tenHienThi).toBe('An')
      expect(docHoSoCua(lan1.diaChi, ID.an)).toHaveLength(1)

      // Đổi ở máy chủ (vd. ở một trình duyệt khác): lần đọc sau thấy ngay, kể cả vai.
      Object.assign(du.hoSo[1], { ten_hien_thi: 'An Khác', vai: 'SUPPORT' })
      const lan2 = await luotGoi(() => kho.layHoSoCuaToi(an))
      expect(giaTri(lan2.ketQua)).toEqual(expect.objectContaining({ tenHienThi: 'An Khác', vai: 'SUPPORT' }))
      expect(docHoSoCua(lan2.diaChi, ID.an)).toHaveLength(1)
    })

    it('sau khi sửa hồ sơ, lệnh kế tiếp thấy tên mới', async () => {
      const { kho, dangNhap } = dungBoiCanh()
      const an = await dangNhap('an')
      const pm = await dangNhap('pm')
      expect(giaTri(await kho.suaHoSo(an, ID.an, { tenHienThi: 'An Mới' })).tenHienThi).toBe('An Mới')
      // Sửa mà không gửi ô nào trả hồ sơ hiện tại: đã là tên mới.
      expect(giaTri(await kho.suaHoSo(an, ID.an, {})).tenHienThi).toBe('An Mới')
      expect(giaTri(await kho.layHoSoCuaToi(an)).tenHienThi).toBe('An Mới')
      // Người khác cũng thấy tên mới ngay.
      expect(giaTri(await kho.danhSachNguoiDung(pm)).find((n) => n.id === ID.an)?.tenHienThi).toBe('An Mới')
    })
  })

  describe('vai đổi giữa hai lệnh vẫn có hiệu lực ngay', () => {
    it('Thành viên vừa được nâng lên Support quản lý được ngay Dự án mình ở trong', async () => {
      const { du, kho, dangNhap } = dungBoiCanh()
      const an = await dangNhap('an')
      expect(maLoi(await kho.suaDuAn(an, ID.duAn, { ten: 'Trước' }, LUC))).toBe('KHONG_CO_QUYEN')

      doiVaiTrenMayChu(du, ID.an, 'SUPPORT')
      expect(giaTri(await kho.suaDuAn(an, ID.duAn, { ten: 'Sau khi nâng' }, LUC)).ten).toBe('Sau khi nâng')
      // Lệnh sau đó dùng vai mới, không phải đọc lại hồ sơ nữa.
      expect(giaTri(await kho.suaDuAn(an, ID.duAn, { ten: 'Lần nữa' }, LUC)).ten).toBe('Lần nữa')
    })

    it('Thành viên vừa được nâng lên PM xem được ngay danh sách người dùng', async () => {
      const { du, kho, dangNhap } = dungBoiCanh()
      const an = await dangNhap('an')
      expect(maLoi(await kho.danhSachNguoiDung(an))).toBe('KHONG_CO_QUYEN')
      doiVaiTrenMayChu(du, ID.an, 'PM')
      expect(giaTri(await kho.danhSachNguoiDung(an))).toHaveLength(4)
    })

    it('PM vừa bị hạ xuống Thành viên gọi lệnh chỉ PM được làm thì nhận KHONG_CO_QUYEN như trước', async () => {
      const { du, kho, dangNhap } = dungBoiCanh()
      const pm = await dangNhap('pm')
      giaTri(await kho.danhSachNguoiDung(pm))

      doiVaiTrenMayChu(du, ID.pm, 'THANH_VIEN')
      expect(maLoi(await kho.danhSachNguoiDung(pm))).toBe('KHONG_CO_QUYEN')
      expect(maLoi(await kho.doiVai(pm, ID.an, { vai: 'SUPPORT' }))).toBe('KHONG_CO_QUYEN')
      expect(du.hoSo[1].vai).toBe('THANH_VIEN')
    })

    it('PM vừa bị hạ đổi vai với dữ liệu sai vẫn nhận KHONG_CO_QUYEN trước KHONG_HOP_LE, như thứ tự cũ', async () => {
      const { du, kho, dangNhap } = dungBoiCanh()
      const pm = await dangNhap('pm')
      giaTri(await kho.danhSachDuAn(pm))

      doiVaiTrenMayChu(du, ID.pm, 'THANH_VIEN')
      expect(maLoi(await kho.doiVai(pm, ID.an, { vai: 'ADMIN' }))).toBe('KHONG_CO_QUYEN')
      expect(maLoi(await kho.doiVai(pm, 'khong-ton-tai', { vai: 'PM' }))).toBe('KHONG_CO_QUYEN')
    })

    it('Support vừa bị hạ xuống Thành viên sửa Dự án thì nhận KHONG_CO_QUYEN như luật thuần, Dự án không đổi', async () => {
      const { du, kho, dangNhap } = dungBoiCanh()
      const chi = await dangNhap('chi')
      giaTri(await kho.danhSachDuAnCuaToi(chi))

      doiVaiTrenMayChu(du, ID.chi, 'THANH_VIEN')
      expect(maLoi(await kho.suaDuAn(chi, ID.duAn, { ten: 'Không được' }, LUC))).toBe('KHONG_CO_QUYEN')
      expect(du.duAn[0].ten).toBe('Cửa hàng')
    })

    it('vai không đổi thì lệnh bị từ chối trả đúng mã cũ', async () => {
      const { kho, dangNhap } = dungBoiCanh()
      const an = await dangNhap('an')
      expect(maLoi(await kho.suaDuAn(an, ID.duAn, { ten: 'X' }, LUC))).toBe('KHONG_CO_QUYEN')
      expect(maLoi(await kho.layDuAn(an, ID.duAnKhac))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.taoDuAn(an, { ma: 'MOI-01', ten: 'Mới' }, LUC))).toBe('KHONG_CO_QUYEN')
    })
  })

  describe('phiên hết, hồ sơ không còn, đăng xuất', () => {
    it('máy chủ không còn nhận phiên thì lệnh kế tiếp trả CHUA_DANG_NHAP', async () => {
      const { du, kho, dangNhap } = dungBoiCanh()
      const an = await dangNhap('an')
      giaTri(await kho.danhSachDuAnCuaToi(an))

      du.maBiThuHoi.add(`token-${ID.an}`)
      expect(maLoi(await kho.danhSachDuAnCuaToi(an))).toBe('CHUA_DANG_NHAP')
      expect(maLoi(await kho.danhSachDuAn(an))).toBe('CHUA_DANG_NHAP')
    })

    it('phiên hết hạn mà không làm mới được thì lệnh kế tiếp trả CHUA_DANG_NHAP', async () => {
      const { du, kho, dangNhap } = dungBoiCanh()
      // Mã truy cập cấp ra đã quá hạn (thời hạn âm, không phụ thuộc giờ chạy test); lần làm mới bị máy chủ từ chối
      // nên client bỏ phiên và gửi yêu cầu bằng khoá công khai.
      du.thoiHan = -60
      const an = await dangNhap('an')
      expect(maLoi(await kho.danhSachDuAnCuaToi(an))).toBe('CHUA_DANG_NHAP')
      expect(maLoi(await kho.layHoSoCuaToi(an))).toBe('CHUA_DANG_NHAP')
    })

    it('hồ sơ không còn thì lệnh kế tiếp trả CHUA_DANG_NHAP', async () => {
      const { du, kho, dangNhap } = dungBoiCanh()
      const an = await dangNhap('an')
      const pm = await dangNhap('pm')
      giaTri(await kho.danhSachDuAnCuaToi(an))
      giaTri(await kho.danhSachNguoiDung(pm))

      du.hoSo = du.hoSo.filter((h) => h.id !== ID.an && h.id !== ID.pm)
      du.thanhVien = du.thanhVien.filter((t) => t.nguoi_dung_id !== ID.an)
      expect(maLoi(await kho.layDuAn(an, ID.duAn))).toBe('CHUA_DANG_NHAP')
      expect(maLoi(await kho.suaDuAn(an, ID.duAn, { ten: 'X' }, LUC))).toBe('CHUA_DANG_NHAP')
      expect(maLoi(await kho.layHoSoCuaToi(an))).toBe('CHUA_DANG_NHAP')
      expect(maLoi(await kho.danhSachNguoiDung(pm))).toBe('CHUA_DANG_NHAP')
    })

    it('sau khi đăng xuất, phiên cũ không dùng lại được bản nhớ; đăng nhập lại thì đọc hồ sơ mới', async () => {
      const { du, kho, dangNhap, luotGoi } = dungBoiCanh()
      const pm = await dangNhap('pm')
      giaTri(await kho.danhSachNguoiDung(pm))
      giaTri(await kho.dangXuat(pm))

      const sauDangXuat = await luotGoi(() => kho.danhSachNguoiDung(pm))
      expect(maLoi(sauDangXuat.ketQua)).toBe('CHUA_DANG_NHAP')
      expect(sauDangXuat.diaChi).toEqual([])
      // Phiên giả mạo cùng mã phiên nhưng người khác cũng không dùng được.
      expect(maLoi(await kho.danhSachNguoiDung({ ...pm, nguoiDungId: ID.an }))).toBe('CHUA_DANG_NHAP')

      doiVaiTrenMayChu(du, ID.pm, 'SUPPORT')
      const pmLai = await dangNhap('pm')
      expect(pmLai.maPhien).not.toBe(pm.maPhien)
      expect(giaTri(await kho.danhSachDuAn(pmLai)).map((d) => d.ma)).toEqual([])
      expect(maLoi(await kho.danhSachNguoiDung(pmLai))).toBe('KHONG_CO_QUYEN')
    })
  })

  it('mọi lượt gọi đều tới Supabase giả, không ra mạng', async () => {
    const { du, kho, dangNhap } = dungBoiCanh()
    const pm = await dangNhap('pm')
    giaTri(await kho.danhSachNguoiDung(pm))
    expect(du.diaChi.length).toBeGreaterThan(0)
    for (const diaChi of du.diaChi) expect(new URL(diaChi).origin).toBe(URL_GIA)
  })
})
