// Tổng quan và danh sách Dự án kèm số liệu của bản Supabase trong một số lượt gọi cố định (ticket toi-uu-hieu-nang
// 02), không cần mạng hay DB: máy chủ là một `fetch` giả trong bộ nhớ đóng vai PostgREST, ghi lại mọi địa chỉ được
// gọi để đếm lượt.
//
// Một lượt gọi là một yêu cầu tới PostgREST (`/rest/v1/`: đọc bảng hoặc gọi hàm). Không tính Auth (`/auth/v1/`:
// đăng nhập, làm mới phiên), đúng cách đếm của spec `.scratch/toi-uu-hieu-nang/spec.md`. `fetch` giả bắt chước thô
// phân quyền từng dòng (du_an_doc, nguoi_trong_du_an_doc, task_doc: PM thấy mọi Dự án; người khác Dự án mình ở
// trong), lọc `eq.`/`in.(...)`, xếp `order`, trang `offset`/`limit`, và nhúng bảng như PostgREST (nhúng
// nguoi_trong_du_an vào du_an mà không gọi tên khoá ngoại thì báo lỗi nhập nhằng PGRST201 như máy chủ thật, vì hai
// bảng nối nhau bằng hai khoá ngoại).
//
// "Kết quả như trước" được chứng minh bằng cách chạy cách ghép cũ (một lượt `danhSachTask` mỗi Dự án:
// `docDuAnKemSoLieu`, và `docTongQuan` khi Kho không có lối đọc theo lô) trên CÙNG bản Supabase và cùng dữ liệu
// giả, rồi so bằng toàn bộ kết quả.
import { describe, expect, it } from 'vitest'
import { docDuAnKemSoLieu } from './duAnKemSoLieu'
import type { KetQua } from './ketQua'
import type { PhamViDanhSachDuAn, Phien } from './khoDuLieu'
import { taoKhoSupabase, type KhoSupabase } from './khoSupabase'
import { docTongQuan } from './tongQuan'

/** JWT giả (chữ ký không hợp lệ), như cauHinh.test.ts. */
function jwtGia(than: Record<string, unknown>): string {
  const ma = (doiTuong: Record<string, unknown>) =>
    btoa(JSON.stringify(doiTuong)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${ma({ alg: 'HS256', typ: 'JWT' })}.${ma(than)}.chu-ky-gia`
}

const URL_GIA = 'https://doc-lo-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'doc-lo-gia', role: 'anon' })
const MAT_KHAU = 'matkhau-dung-1'
/** "Bây giờ" truyền vào: 2/6/2026 giờ Việt Nam. */
const LUC = new Date('2026-06-02T08:30:00+07:00')

type Dong = Record<string, unknown>

const id = (so: number) => `00000000-0000-4000-8000-${String(so).padStart(12, '0')}`
const ID = { pm: id(1), an: id(2), binh: id(3), chi: id(4), dung: id(5), em: id(6) }
const idDuAn = (so: number) => id(100 + so)
const idTask = (so: number) => id(1000 + so)

/** Trần lượt gọi của ticket. */
const TRAN = 4

interface DuLieuGia {
  hoSo: Dong[]
  duAn: Dong[]
  thanhVien: Dong[]
  task: Dong[]
  /** Mọi địa chỉ đã gọi. */
  diaChi: string[]
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

const HAN = ['2026-05-28', '2026-06-01', '2026-06-02', '2026-06-05', '2026-06-09', '2026-06-10', '2026-07-01', null]

/**
 * Dữ liệu giả có `soHoatDong` Dự án đang hoạt động. Mọi Dự án có Task đủ các trạng thái và hạn (Trễ hạn, đúng hôm
 * nay, tới hạn trong 7 ngày, xa, không hạn). An (Thành viên) và Chi (Support) ở trong các Dự án chẵn; Bình
 * (Thành viên) ở các Dự án lẻ; Dũng đã bị gỡ khỏi mọi Dự án nhưng còn ghi trên Task (dấu "đã rời dự án"); Em chưa ở
 * Dự án nào. `coLuuTru`: thêm một Dự án Lưu trữ có Task, An ở trong.
 */
function dungDuLieu(soHoatDong: number, coLuuTru: boolean): DuLieuGia {
  const du: DuLieuGia = {
    hoSo: [
      hoSoGia(1, 'pm', 'Pm', 'PM'),
      hoSoGia(2, 'an', 'An', 'THANH_VIEN'),
      hoSoGia(3, 'binh', 'Bình', 'THANH_VIEN'),
      hoSoGia(4, 'chi', 'Chi', 'SUPPORT'),
      hoSoGia(5, 'dung', 'Dũng', 'THANH_VIEN'),
      hoSoGia(6, 'em', 'Em', 'THANH_VIEN'),
    ],
    duAn: [],
    thanhVien: [],
    task: [],
    diaChi: [],
  }
  let soTask = 0
  const tongDuAn = soHoatDong + (coLuuTru ? 1 : 0)
  for (let i = 0; i < tongDuAn; i++) {
    const luuTru = i === soHoatDong
    const chan = i % 2 === 0
    const thanhVien = luuTru || chan ? [ID.an, ID.chi] : [ID.binh]
    du.duAn.push({
      id: idDuAn(i),
      ma: `DA-${String(i).padStart(2, '0')}`,
      // Tên không theo thứ tự id, để thứ tự xếp theo tên của Tổng quan có ý nghĩa.
      ten: `Dự án ${String.fromCharCode(90 - i)}`,
      mo_ta: '',
      khach_hang: i % 3 === 0 ? 'Khách A' : '',
      ngay_bat_dau: '2026-01-01',
      // Một số Dự án đã qua Ngày kết thúc dự kiến (Quá hạn dự kiến nếu Tiến độ chưa đủ 100%).
      ngay_ket_thuc_du_kien: i % 3 === 1 ? '2026-05-31' : i % 3 === 2 ? '2026-12-31' : null,
      muc_uu_tien: ['THAP', 'TRUNG_BINH', 'CAO'][i % 3],
      nguoi_phu_trach_id: i % 4 === 0 ? thanhVien[0] : null,
      trang_thai: luuTru ? 'LUU_TRU' : 'HOAT_DONG',
      tao_boi: ID.pm,
      tao_luc: `2026-05-${String(1 + i).padStart(2, '0')}T02:00:00+00:00`,
      sua_boi: i % 2 === 1 ? ID.pm : null,
      sua_luc: i % 2 === 1 ? '2026-05-20T02:00:00+00:00' : null,
    })
    for (const nguoi of thanhVien) du.thanhVien.push({ du_an_id: idDuAn(i), nguoi_dung_id: nguoi })
    // Dự án cuối (không Lưu trữ) có nhiều hơn một trang? Không cần: đủ các trường hợp trên vài Task mỗi Dự án.
    const soTaskCuaDuAn = 3 + (i % 4)
    for (let k = 0; k < soTaskCuaDuAn; k++) {
      soTask += 1
      const trangThai = ['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI', 'HOAN_THANH', 'HUY'][(i + k) % 7]
      const lam = thanhVien[k % thanhVien.length]
      const kiem = thanhVien[(k + 1) % thanhVien.length]
      du.task.push({
        id: idTask(soTask),
        du_an_id: idDuAn(i),
        tieu_de: `Task ${soTask}`,
        mo_ta: '',
        han: HAN[(i * 3 + k) % HAN.length],
        muc_uu_tien: 'TRUNG_BINH',
        // Task thứ ba của mỗi Dự án do Dũng (đã rời dự án) làm.
        nguoi_thuc_hien_id: k === 2 ? ID.dung : lam,
        nguoi_kiem_tra_id: kiem,
        trang_thai: trangThai,
        so_lan_tra_lai: 0,
        tao_boi: ID.pm,
        tao_luc: `2026-05-${String(1 + (soTask % 28)).padStart(2, '0')}T0${soTask % 10}:00:00+00:00`,
        sua_boi: k === 1 ? ID.chi : null,
        sua_luc: k === 1 ? '2026-05-21T02:00:00+00:00' : null,
      })
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

/** Lọc dòng theo `cot=eq.x` và `cot=in.(x,y)` của PostgREST; bỏ qua tham số không phải bộ lọc. */
function loc(dong: readonly Dong[], thamSo: URLSearchParams): Dong[] {
  return dong.filter((d) => {
    for (const [khoa, giaTri] of thamSo) {
      if (['select', 'order', 'offset', 'limit'].includes(khoa)) continue
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

function taoFetchGia(du: DuLieuGia): typeof fetch {
  return async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
    du.diaChi.push(url.href)
    if (url.origin !== URL_GIA) throw new Error(`Test không được gọi ra ngoài: ${url.href}`)
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
    const laThanhVien = (duAnId: unknown, nguoiId: unknown) =>
      du.thanhVien.some((t) => t.du_an_id === duAnId && t.nguoi_dung_id === nguoiId)
    // rieng.duoc_xem_du_an: PM thấy mọi Dự án; người khác Dự án mình ở trong.
    const duAnThay = (duAnId: unknown) => nguoiGoi.vai === 'PM' || laThanhVien(duAnId, nguoiGoi.id)
    const motDoiTuong = (tieuDe.get('accept') ?? '').includes('vnd.pgrst.object')
    const traDong = (dong: Dong[]) => tra(200, motDoiTuong ? (dong[0] ?? null) : dong)

    if (phuongThuc === 'POST' && url.pathname.startsWith('/rest/v1/rpc/ten_nguoi_')) {
      const ids = (than.p_ids as string[]) ?? []
      return tra(200, du.hoSo.filter((h) => ids.includes(String(h.id))).map((h) => ({ id: h.id, ten_hien_thi: h.ten_hien_thi })))
    }
    if (phuongThuc !== 'GET') return traLoi(404, 'PGRST000', `Yêu cầu không mong đợi: ${phuongThuc} ${url.pathname}`)

    const bang = url.pathname.slice('/rest/v1/'.length)
    const chon = url.searchParams.get('select') ?? '*'
    if (bang === 'ho_so') return traDong(loc(du.hoSo, url.searchParams))
    if (bang === 'task') return traDong(xepVaCat(loc(du.task.filter((t) => duAnThay(t.du_an_id)), url.searchParams), url.searchParams))
    if (bang === 'du_an') {
      const dong = xepVaCat(loc(du.duAn.filter((d) => duAnThay(d.id)), url.searchParams), url.searchParams)
      if (!chon.includes('nguoi_trong_du_an')) return traDong(dong)
      // Hai khoá ngoại nối du_an với nguoi_trong_du_an: không gọi tên khoá thì máy chủ thật báo nhập nhằng.
      if (!chon.includes('nguoi_trong_du_an!nguoi_trong_du_an_du_an_id_fkey(nguoi_dung_id)')) {
        return traLoi(300, 'PGRST201', 'Could not embed because more than one relationship was found')
      }
      return traDong(
        dong.map((d) => ({
          ...d,
          nguoi_trong_du_an: du.thanhVien.filter((t) => t.du_an_id === d.id).map((t) => ({ nguoi_dung_id: t.nguoi_dung_id })),
        })),
      )
    }
    if (bang === 'nguoi_trong_du_an') {
      const dong = xepVaCat(loc(du.thanhVien.filter((t) => duAnThay(t.du_an_id)), url.searchParams), url.searchParams)
      // Nhúng Dự án (danhSachDuAnCuaToi): `select=du_an(id,ma,ten,trang_thai)`.
      const nhung = /^du_an\(([^)]*)\)$/.exec(chon)
      if (!nhung) return traDong(dong)
      const cot = nhung[1].split(',')
      return traDong(
        dong.map((t) => {
          const duAn = du.duAn.find((d) => d.id === t.du_an_id)
          return { du_an: duAn ? Object.fromEntries(cot.map((c) => [c, duAn[c]])) : null }
        }),
      )
    }
    return traLoi(404, 'PGRST000', `Yêu cầu không mong đợi: ${phuongThuc} ${url.pathname}`)
  }
}

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

interface BoiCanh {
  du: DuLieuGia
  kho: KhoSupabase
  dangNhap(ten: string): Promise<Phien>
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

/** Lượt đọc bảng Task. */
function docTask(diaChi: readonly string[]): string[] {
  return diaChi.filter((d) => new URL(d).pathname === '/rest/v1/task')
}

/** Cách ghép cũ (trước ticket): Tổng quan đọc `danhSachTask` cho từng Dự án. */
function tongQuanCachCu(kho: KhoSupabase, phien: Phien) {
  return docTongQuan({ ...kho, docDuLieuTongQuan: undefined }, phien, LUC)
}

/** Hai cỡ dữ liệu: 1 Dự án; 9 Dự án đang hoạt động cùng 1 Dự án Lưu trữ, mọi Dự án đều có Task. */
const CO_DU_LIEU = [
  { ten: '1 Dự án', soHoatDong: 1, coLuuTru: false },
  { ten: '10 Dự án (9 đang hoạt động, 1 Lưu trữ)', soHoatDong: 9, coLuuTru: true },
] as const

describe('bản Supabase: Tổng quan và danh sách Dự án kèm số liệu đọc theo lô', () => {
  describe.each(CO_DU_LIEU)('cỡ dữ liệu: $ten', ({ soHoatDong, coLuuTru }) => {
    it.each(['pm', 'chi', 'an'])('Tổng quan của %s: nhiều nhất 4 lượt gọi, kết quả bằng đúng cách ghép cũ', async (ten) => {
      const { kho, dangNhap, luotGoi } = dungBoiCanh(dungDuLieu(soHoatDong, coLuuTru))
      const phien = await dangNhap(ten)
      const moi = await luotGoi(() => docTongQuan(kho, phien, LUC))
      expect(moi.diaChi.length).toBeLessThanOrEqual(TRAN)
      expect(docTask(moi.diaChi)).toHaveLength(1)
      const cu = await luotGoi(() => tongQuanCachCu(kho, phien))
      expect(giaTri(moi.ketQua)).toEqual(giaTri(cu.ketQua))
      // Có số liệu thật để so (không phải hai kết quả rỗng giống nhau).
      expect(giaTri(moi.ketQua).hoatDong.length).toBeGreaterThan(0)
    })

    it.each([
      { ten: 'pm', phamVi: 'TAT_CA' as const },
      { ten: 'chi', phamVi: 'CUA_TOI' as const },
      { ten: 'an', phamVi: 'CUA_TOI' as const },
      { ten: 'pm', phamVi: 'CUA_TOI' as const },
      { ten: 'an', phamVi: 'TAT_CA' as const },
    ])(
      'Dự án kèm số liệu của $ten, phạm vi $phamVi: nhiều nhất 4 lượt gọi, kết quả bằng đúng cách ghép cũ',
      async ({ ten, phamVi }) => {
        const { kho, dangNhap, luotGoi } = dungBoiCanh(dungDuLieu(soHoatDong, coLuuTru))
        const phien = await dangNhap(ten)
        const moi = await luotGoi(() => kho.danhSachDuAnKemSoLieu(phien, phamVi, LUC))
        expect(moi.diaChi.length).toBeLessThanOrEqual(TRAN)
        const cu = await luotGoi(() => docDuAnKemSoLieu(kho, phien, phamVi, LUC))
        expect(giaTri(moi.ketQua)).toEqual(giaTri(cu.ketQua))
      },
    )
  })

  it('số lượt gọi không tăng theo số Dự án; cách ghép cũ thì tăng', async () => {
    const dem = async (soHoatDong: number, coLuuTru: boolean) => {
      const { kho, dangNhap, luotGoi } = dungBoiCanh(dungDuLieu(soHoatDong, coLuuTru))
      const pm = await dangNhap('pm')
      const an = await dangNhap('an')
      const so = async (lam: () => Promise<unknown>) => (await luotGoi(lam)).diaChi.length
      return {
        tongQuan: await so(() => docTongQuan(kho, pm, LUC)),
        tatCa: await so(() => kho.danhSachDuAnKemSoLieu(pm, 'TAT_CA', LUC)),
        cuaToi: await so(() => kho.danhSachDuAnKemSoLieu(an, 'CUA_TOI', LUC)),
        tongQuanCu: await so(() => tongQuanCachCu(kho, pm)),
        tatCaCu: await so(() => docDuAnKemSoLieu(kho, pm, 'TAT_CA', LUC)),
        cuaToiCu: await so(() => docDuAnKemSoLieu(kho, an, 'CUA_TOI', LUC)),
      }
    }
    const nho = await dem(1, false)
    const lon = await dem(9, true)
    expect({ tongQuan: lon.tongQuan, tatCa: lon.tatCa, cuaToi: lon.cuaToi }).toEqual({
      tongQuan: nho.tongQuan,
      tatCa: nho.tatCa,
      cuaToi: nho.cuaToi,
    })
    // Cách ghép cũ gọi `danhSachTask` cho từng Dự án; từ ticket toi-uu-hieu-nang 03 mỗi lượt đó rẻ hơn 1 (kiểm xem
    // Dự án đọc luôn Người trong dự án), nên số "cũ" ở đây thấp hơn con số ghi ở ticket 02 (8, 7, 8 và 48, 52, 33).
    expect(nho).toEqual({ tongQuan: 4, tatCa: 3, cuaToi: 3, tongQuanCu: 7, tatCaCu: 6, cuaToiCu: 7 })
    expect(lon).toEqual({ tongQuan: 4, tatCa: 3, cuaToi: 3, tongQuanCu: 39, tatCaCu: 42, cuaToiCu: 27 })
  })

  describe('người chưa ở Dự án nào', () => {
    it.each(CO_DU_LIEU)('$ten: Tổng quan mọi số 0, danh sách rỗng, không lượt nào đọc Task', async ({ soHoatDong, coLuuTru }) => {
      const { kho, dangNhap, luotGoi } = dungBoiCanh(dungDuLieu(soHoatDong, coLuuTru))
      const em = await dangNhap('em')

      const tongQuan = await luotGoi(() => docTongQuan(kho, em, LUC))
      expect(giaTri(tongQuan.ketQua)).toEqual(giaTri(await tongQuanCachCu(kho, em)))
      expect(giaTri(tongQuan.ketQua).hoatDong).toEqual([])
      expect(giaTri(tongQuan.ketQua).oSo).toEqual({
        duAnDangHoatDong: 0,
        duAnQuaHanDuKien: 0,
        taskDangMo: 0,
        taskTreHan: 0,
        choToiDuyet: 0,
        viecCuaToi: 0,
      })
      expect(docTask(tongQuan.diaChi)).toEqual([])
      expect(tongQuan.diaChi).toHaveLength(1)

      for (const phamVi of ['CUA_TOI', 'TAT_CA'] satisfies PhamViDanhSachDuAn[]) {
        const ds = await luotGoi(() => kho.danhSachDuAnKemSoLieu(em, phamVi, LUC))
        expect(giaTri(ds.ketQua)).toEqual([])
        expect(docTask(ds.diaChi)).toEqual([])
        expect(ds.diaChi).toHaveLength(1)
      }
    })
  })

  describe('quyền xem và Dự án Lưu trữ', () => {
    it('Support và Thành viên chỉ nhận Dự án mình ở trong và Task của các Dự án đó', async () => {
      const { du, kho, dangNhap } = dungBoiCanh(dungDuLieu(9, true))
      for (const [ten, nguoiId] of [
        ['chi', ID.chi],
        ['an', ID.an],
        ['binh', ID.binh],
      ] as const) {
        const phien = await dangNhap(ten)
        const cuaMinh = new Set(du.thanhVien.filter((t) => t.nguoi_dung_id === nguoiId).map((t) => String(t.du_an_id)))
        const hoatDongCuaMinh = du.duAn.filter((d) => cuaMinh.has(String(d.id)) && d.trang_thai === 'HOAT_DONG').map((d) => d.id)

        const tongQuan = giaTri(await docTongQuan(kho, phien, LUC))
        expect(tongQuan.hoatDong.map((d) => d.duAn.id).sort()).toEqual([...hoatDongCuaMinh].sort())
        for (const task of [...tongQuan.taskTreHan, ...tongQuan.taskToiHan]) expect(cuaMinh.has(task.duAnId)).toBe(true)
        const soTask = Object.values(tongQuan.phanBo).reduce((a, b) => a + b, 0)
        expect(soTask).toBe(du.task.filter((t) => hoatDongCuaMinh.includes(t.du_an_id)).length)

        for (const phamVi of ['CUA_TOI', 'TAT_CA'] satisfies PhamViDanhSachDuAn[]) {
          const ds = giaTri(await kho.danhSachDuAnKemSoLieu(phien, phamVi, LUC))
          expect(ds.map((d) => d.id).sort()).toEqual([...cuaMinh].sort())
        }
      }
    })

    it('Dự án Lưu trữ: không có trên Tổng quan; có trong Tất cả Dự án của PM và Dự án của tôi của người ở trong', async () => {
      const { du, kho, dangNhap } = dungBoiCanh(dungDuLieu(9, true))
      const luuTru = String(du.duAn.find((d) => d.trang_thai === 'LUU_TRU')?.id)
      const pm = await dangNhap('pm')
      const an = await dangNhap('an')

      const tongQuanPm = giaTri(await docTongQuan(kho, pm, LUC))
      expect(tongQuanPm.hoatDong.map((d) => d.duAn.id)).not.toContain(luuTru)
      expect(tongQuanPm.hoatDong).toHaveLength(9)
      const soTask = Object.values(tongQuanPm.phanBo).reduce((a, b) => a + b, 0)
      expect(soTask).toBe(du.task.filter((t) => t.du_an_id !== luuTru).length)

      const tatCa = giaTri(await kho.danhSachDuAnKemSoLieu(pm, 'TAT_CA', LUC))
      expect(tatCa).toHaveLength(10)
      expect(tatCa.find((d) => d.id === luuTru)).toEqual(expect.objectContaining({ trangThai: 'LUU_TRU', quaHanDuKien: false }))
      expect(giaTri(await kho.danhSachDuAnKemSoLieu(pm, 'CUA_TOI', LUC))).toEqual([])
      expect(giaTri(await kho.danhSachDuAnKemSoLieu(an, 'CUA_TOI', LUC)).map((d) => d.id)).toContain(luuTru)
      expect(giaTri(await docTongQuan(kho, an, LUC)).hoatDong.map((d) => d.duAn.id)).not.toContain(luuTru)
    })

    it('Task do người đã rời dự án giữ vẫn mang dấu "đã rời dự án", tên người đọc đủ', async () => {
      const { kho, dangNhap } = dungBoiCanh(dungDuLieu(9, true))
      const pm = await dangNhap('pm')
      const tongQuan = giaTri(await docTongQuan(kho, pm, LUC))
      const task = [...tongQuan.taskTreHan, ...tongQuan.taskToiHan]
      expect(task.some((t) => t.nguoiThucHien.id === ID.dung && t.nguoiThucHien.daRoiDuAn === true)).toBe(true)
      for (const t of task) {
        expect(t.nguoiThucHien.tenHienThi).not.toBe('')
        expect(t.nguoiKiemTra.tenHienThi).not.toBe('')
        expect(t.nguoiKiemTra.daRoiDuAn).toBeUndefined()
      }
    })
  })

  it('chưa đăng nhập: CHUA_DANG_NHAP, không gọi mạng; phạm vi không có thật: KHONG_HOP_LE', async () => {
    const { kho, dangNhap, luotGoi } = dungBoiCanh(dungDuLieu(1, false))
    const chuaDangNhap = await luotGoi(() => Promise.all([docTongQuan(kho, null, LUC), kho.danhSachDuAnKemSoLieu(null, 'TAT_CA', LUC)]))
    expect(chuaDangNhap.ketQua.map((kq) => (kq.ok ? 'THANH_CONG' : kq.loi.ma))).toEqual(['CHUA_DANG_NHAP', 'CHUA_DANG_NHAP'])
    expect(chuaDangNhap.diaChi).toEqual([])
    const an = await dangNhap('an')
    const sai = await kho.danhSachDuAnKemSoLieu(an, 'KHAC' as PhamViDanhSachDuAn, LUC)
    expect(sai.ok ? 'THANH_CONG' : sai.loi.ma).toBe('KHONG_HOP_LE')
  })

  it('mọi lượt gọi đều tới Supabase giả, không ra mạng', async () => {
    const { du, kho, dangNhap } = dungBoiCanh(dungDuLieu(9, true))
    const pm = await dangNhap('pm')
    giaTri(await docTongQuan(kho, pm, LUC))
    giaTri(await kho.danhSachDuAnKemSoLieu(pm, 'TAT_CA', LUC))
    expect(du.diaChi.length).toBeGreaterThan(0)
    for (const diaChi of du.diaChi) expect(new URL(diaChi).origin).toBe(URL_GIA)
  })
})
