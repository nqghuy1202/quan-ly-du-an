// Phần cổng kiểm được của trường mới của Dự án trên bản Supabase (ticket truong-moi 09), không cần mạng hay DB.
//
// Cổng KHÔNG chạy được SQL, nên không kiểm được cột, ràng buộc, chỉ mục duy nhất, khoá ngoại, trigger hay
// quyền cột thật: những thứ đó chủ dự án áp và kiểm tay (supabase/README.md, mục "Trường mới của Dự án"),
// cùng bộ test hợp đồng chạy trên Supabase thật. Ở đây chỉ có:
//   1. Hành vi của bản cài Supabase nhìn từ giao diện Kho khi máy chủ là một `fetch` giả trong bộ nhớ (không
//      có mạng): tạo, sửa, đọc Dự án gửi và nhận đủ sáu trường mới; lỗi mà cơ sở dữ liệu trả (Mã trùng, sai
//      thứ tự ngày, Người phụ trách ngoài Dự án, ...) được đổi về đúng lỗi có mã như bản bộ nhớ. `fetch` giả
//      chỉ bắt chước thô những gì migration hứa (chỉ mục duy nhất, ràng buộc ngày, trigger Người phụ trách,
//      phân quyền từng dòng) hoặc trả đúng lỗi test dặn; KHÔNG thay cho việc chạy SQL thật.
//   2. Cấu trúc file migration trường mới và bản xuống (đọc chữ, không chạy SQL).
//   3. Bộ test hợp đồng chạy tay trên Supabase thật có các ca cho trường mới.
import { describe, expect, it } from 'vitest'
import { THONG_BAO_MAC_DINH, type KetQua, type LoiKho, type MaLoi } from './ketQua'
import { taoKhoSupabase } from './khoSupabase'
import type { KhoDuLieu, Phien } from './khoDuLieu'
import {
  DO_DAI_KHACH_HANG_TOI_DA,
  DO_DAI_MA_DU_AN_TOI_DA,
  DO_DAI_MA_DU_AN_TOI_THIEU,
  THONG_BAO_DU_AN,
  kiemTraDuAn,
} from '../luat/duAn'
import { CAC_MUC_UU_TIEN, THONG_BAO_MUC_UU_TIEN } from '../luat/mucUuTien'
import migrationLen from '../../supabase/migrations/20261126000500_truong_du_an.sql?raw'
import migrationXuong from '../../supabase/down/20261126000500_truong_du_an.down.sql?raw'
import migrationLat1 from '../../supabase/migrations/20261125000100_lat_1_ho_so_du_an.sql?raw'
import boTestSupabaseThat from './khoSupabase.test.ts?raw'

/** JWT giả (chữ ký không hợp lệ), như cauHinh.test.ts. */
function jwtGia(than: Record<string, unknown>): string {
  const ma = (doiTuong: Record<string, unknown>) =>
    btoa(JSON.stringify(doiTuong)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${ma({ alg: 'HS256', typ: 'JWT' })}.${ma(than)}.chu-ky-gia`
}

const URL_GIA = 'https://du-an-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'du-an-gia', role: 'anon' })
const LUC = new Date('2026-06-02T08:30:00+07:00')
const MAT_KHAU = 'matkhau-dung-1'
/** Giờ "máy chủ" đặt cho dấu vết (bản Supabase bỏ qua giờ truyền vào). */
const GIO_MAY_CHU = '2026-06-02T05:00:00+00:00'

type Dong = Record<string, unknown>

const id = (so: number) => `00000000-0000-4000-8000-${String(so).padStart(12, '0')}`
const ID = {
  pm: id(1),
  an: id(2),
  binh: id(3),
  chi: id(4),
  ngoai: id(6),
  duAn: id(10),
  duAnKhac: id(11),
  duAnLuuTru: id(12),
}

interface LoiCsdlGia {
  code: string
  message: string
}

interface LanGhi {
  phuongThuc: 'POST' | 'PATCH'
  than: Dong
}

interface DuLieuGia {
  hoSo: Dong[]
  duAn: Dong[]
  thanhVien: Dong[]
  /** Các lần ghi bảng du_an (tạo, sửa) mà "máy chủ" nhận. */
  lanGhi: LanGhi[]
  /** Lỗi mà lần ghi bảng du_an tiếp theo trả về thay cho việc ghi (hàng rào cuối của cơ sở dữ liệu). */
  loiGhi: LoiCsdlGia | null
  /** Mọi địa chỉ đã gọi. */
  diaChi: string[]
}

function hoSoGia(so: number, ten: string, vai: string): Dong {
  return { id: id(so), email: `${ten.toLowerCase()}@vi-du.vn`, ten_hien_thi: ten, github_username: null, vai }
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
    hoSo: [
      hoSoGia(1, 'Pm', 'PM'),
      hoSoGia(2, 'An', 'THANH_VIEN'),
      hoSoGia(3, 'Binh', 'THANH_VIEN'),
      hoSoGia(4, 'Chi', 'SUPPORT'),
      hoSoGia(6, 'Ngoai', 'THANH_VIEN'),
    ],
    duAn: [
      duAnGia({
        id: ID.duAn,
        ma: 'CH-01',
        ten: 'Cửa hàng',
        khach_hang: 'Công ty A',
        ngay_bat_dau: '2026-06-01',
        ngay_ket_thuc_du_kien: '2026-06-30',
        muc_uu_tien: 'CAO',
        nguoi_phu_trach_id: ID.an,
      }),
      duAnGia({ id: ID.duAnKhac, ma: 'KHO-02', ten: 'Kho' }),
      duAnGia({ id: ID.duAnLuuTru, ma: 'CU-03', ten: 'Cũ', trang_thai: 'LUU_TRU' }),
    ],
    thanhVien: [
      { du_an_id: ID.duAn, nguoi_dung_id: ID.an },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.binh },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.chi },
      { du_an_id: ID.duAnKhac, nguoi_dung_id: ID.binh },
      { du_an_id: ID.duAnLuuTru, nguoi_dung_id: ID.an },
      { du_an_id: ID.duAnLuuTru, nguoi_dung_id: ID.chi },
    ],
    lanGhi: [],
    loiGhi: null,
    diaChi: [],
  }
}

function tra(trangThai: number, than?: unknown): Response {
  return new Response(than === undefined ? null : JSON.stringify(than), {
    status: trangThai,
    headers: { 'content-type': 'application/json' },
  })
}

function traLoi(loi: LoiCsdlGia): Response {
  return tra(loi.code === '23505' ? 409 : 400, { code: loi.code, message: loi.message, details: null, hint: null })
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

const loiMaTrung = { code: '23505', message: 'duplicate key value violates unique constraint "du_an_ma_key"' }
const loiNgay = { code: '23514', message: 'new row for relation "du_an" violates check constraint "du_an_ngay_hop_le"' }

/**
 * `fetch` giả đóng vai Supabase: Auth (đăng nhập), PostgREST (bảng ho_so, du_an, nguoi_trong_du_an; hàm
 * ten_nguoi_dau_vet). Bắt chước thô phân quyền từng dòng (PM thấy và sửa mọi Dự án; Support sửa Dự án mình
 * ở trong; người khác chỉ thấy Dự án mình ở trong) và những gì migration trường mới hứa khi ghi du_an: Mã
 * chuẩn hoá in hoa và duy nhất không phân biệt hoa thường (23505), Ngày kết thúc dự kiến không trước Ngày
 * bắt đầu (23514), Người phụ trách phải là Người trong dự án (NGUOI_NGOAI_DU_AN), Dự án đã Lưu trữ không
 * sửa được (DU_AN_DA_LUU_TRU), dấu vết do máy chủ đặt.
 */
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
      if (!nguoi) return tra(400, { code: 'invalid_credentials', error_code: 'invalid_credentials', msg: 'sai' })
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

    const dangNhapLa = /^Bearer token-(.+)$/.exec(tieuDe.get('authorization') ?? '')?.[1]
    const nguoiGoi = du.hoSo.find((h) => h.id === dangNhapLa)
    const laThanhVien = (duAnId: unknown, nguoiId: unknown) =>
      du.thanhVien.some((t) => t.du_an_id === duAnId && t.nguoi_dung_id === nguoiId)
    const duAnThay = (duAnId: unknown) => nguoiGoi?.vai === 'PM' || laThanhVien(duAnId, nguoiGoi?.id)
    const duAnQuanLy = (duAnId: unknown) =>
      nguoiGoi?.vai === 'PM' || (nguoiGoi?.vai === 'SUPPORT' && laThanhVien(duAnId, nguoiGoi.id))
    const motDoiTuong = (tieuDe.get('accept') ?? '').includes('vnd.pgrst.object')

    if (url.pathname === '/rest/v1/rpc/ten_nguoi_dau_vet') {
      const ids = (than.p_ids as string[]) ?? []
      return tra(200, du.hoSo.filter((h) => ids.includes(String(h.id))).map((h) => ({ id: h.id, ten_hien_thi: h.ten_hien_thi })))
    }

    const bang = url.pathname.slice('/rest/v1/'.length)
    if (phuongThuc === 'GET') {
      if (bang === 'ho_so') return tra(200, loc(du.hoSo, url.searchParams))
      if (bang === 'du_an') return tra(200, loc(du.duAn.filter((d) => duAnThay(d.id)), url.searchParams))
      if (bang === 'nguoi_trong_du_an') {
        const dong = loc(du.thanhVien.filter((t) => duAnThay(t.du_an_id)), url.searchParams)
        // Nhúng Dự án (danhSachDuAnCuaToi): `select=du_an(id,ma,ten,trang_thai)`.
        const nhung = /^du_an\(([^)]*)\)$/.exec(url.searchParams.get('select') ?? '')
        if (!nhung) return tra(200, dong)
        const cot = nhung[1].split(',')
        return tra(
          200,
          dong.map((t) => {
            const duAn = du.duAn.find((d) => d.id === t.du_an_id)
            return { du_an: duAn ? Object.fromEntries(cot.map((c) => [c, duAn[c]])) : null }
          }),
        )
      }
      return tra(404, { code: 'PGRST205', message: `Không có bảng ${bang}` })
    }

    if (bang === 'du_an' && (phuongThuc === 'POST' || phuongThuc === 'PATCH')) {
      du.lanGhi.push({ phuongThuc, than })
      if (du.loiGhi) return traLoi(du.loiGhi)
      const truocKhiGhi = (dong: Dong): Response | null => {
        if (du.duAn.some((d) => d.id !== dong.id && String(d.ma).toUpperCase() === String(dong.ma).toUpperCase())) {
          return traLoi(loiMaTrung)
        }
        if (dong.ngay_bat_dau && dong.ngay_ket_thuc_du_kien && String(dong.ngay_ket_thuc_du_kien) < String(dong.ngay_bat_dau)) {
          return traLoi(loiNgay)
        }
        return null
      }
      if (phuongThuc === 'POST') {
        if (nguoiGoi?.vai !== 'PM') return traLoi({ code: '42501', message: 'new row violates row-level security policy' })
        const moi = duAnGia({ ...than, id: id(100 + du.duAn.length), ma: String(than.ma).trim().toUpperCase(), tao_boi: nguoiGoi.id, tao_luc: GIO_MAY_CHU })
        const loi = truocKhiGhi(moi)
        if (loi) return loi
        du.duAn.push(moi)
        return tra(201, motDoiTuong ? moi : [moi])
      }
      const dich = loc(du.duAn.filter((d) => duAnQuanLy(d.id)), url.searchParams)
      for (const cu of dich) {
        const moi: Dong = { ...cu, ...than }
        if (typeof moi.ma === 'string') moi.ma = moi.ma.trim().toUpperCase()
        if (cu.trang_thai === 'LUU_TRU') return traLoi({ code: 'P0001', message: 'DU_AN_DA_LUU_TRU' })
        if (moi.nguoi_phu_trach_id && moi.nguoi_phu_trach_id !== cu.nguoi_phu_trach_id && !laThanhVien(cu.id, moi.nguoi_phu_trach_id)) {
          return traLoi({ code: 'P0001', message: 'NGUOI_NGOAI_DU_AN' })
        }
        const loi = truocKhiGhi(moi)
        if (loi) return loi
        Object.assign(cu, moi, { sua_boi: nguoiGoi?.id, sua_luc: GIO_MAY_CHU })
      }
      return tra(200, dich)
    }
    return tra(404, { code: 'PGRST000', message: `Yêu cầu không mong đợi: ${phuongThuc} ${url.pathname}` })
  }
}

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function loiCua<T>(kq: KetQua<T>): LoiKho | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

interface BoiCanh {
  du: DuLieuGia
  kho: KhoDuLieu
  phien: Record<'pm' | 'an' | 'binh' | 'chi' | 'ngoai', Phien>
}

async function dungBoiCanh(): Promise<BoiCanh> {
  const du = dungDuLieu()
  const kho = taoKhoSupabase({ url: URL_GIA, khoaCongKhai: KHOA_ANON, tuDongLamMoiPhien: false, fetch: taoFetchGia(du) })
  const dangNhap = async (ten: string): Promise<Phien> =>
    giaTri(await kho.dangNhap({ email: `${ten}@vi-du.vn`, matKhau: MAT_KHAU }))
  return {
    du,
    kho,
    phien: {
      pm: await dangNhap('pm'),
      an: await dangNhap('an'),
      binh: await dangNhap('binh'),
      chi: await dangNhap('chi'),
      ngoai: await dangNhap('ngoai'),
    },
  }
}

const duAnDangLuu = (du: DuLieuGia, duAnId: string) => ({ ...du.duAn.find((d) => d.id === duAnId) })

/** Lỗi Người phụ trách ngoài Dự án như bản bộ nhớ trả. */
const LOI_NGUOI_PHU_TRACH: LoiKho = {
  ma: 'NGUOI_NGOAI_DU_AN',
  thongBao: THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn,
  loiTheoO: { nguoiPhuTrachId: THONG_BAO_DU_AN.nguoiPhuTrachNgoaiDuAn },
}

/** Lỗi Mã trùng như bản bộ nhớ trả. */
const LOI_MA_TRUNG: LoiKho = {
  ma: 'MA_DU_AN_DA_DUNG',
  thongBao: THONG_BAO_MAC_DINH.MA_DU_AN_DA_DUNG,
  loiTheoO: { ma: THONG_BAO_DU_AN.maTrung },
}

/** Lỗi cơ sở dữ liệu trả khi ghi du_an và lỗi có mã mà Kho phải trả (như bản bộ nhớ). */
const CA_LOI_SUA: { ten: string; loi: LoiCsdlGia; mongDoi: LoiKho; dauVao?: Parameters<KhoDuLieu['suaDuAn']>[2] }[] = [
  { ten: 'chỉ mục duy nhất của Mã', loi: loiMaTrung, mongDoi: LOI_MA_TRUNG },
  {
    ten: 'ràng buộc ngày (ngày đang lưu vừa bị người khác đổi)',
    loi: loiNgay,
    mongDoi: { ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE, loiTheoO: { ngayKetThucDuKien: THONG_BAO_DU_AN.ngayKetThucTruocBatDau } },
  },
  {
    ten: 'ràng buộc ngày khi chỉ gửi Ngày bắt đầu',
    loi: loiNgay,
    dauVao: { ngayBatDau: '2026-06-10' },
    mongDoi: { ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE, loiTheoO: { ngayBatDau: THONG_BAO_DU_AN.ngayKetThucTruocBatDau } },
  },
  {
    ten: 'ràng buộc dạng Mã',
    loi: { code: '23514', message: 'new row for relation "du_an" violates check constraint "du_an_ma_hop_le"' },
    mongDoi: { ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE, loiTheoO: { ma: THONG_BAO_DU_AN.maSai } },
  },
  {
    ten: 'ràng buộc độ dài Khách hàng',
    loi: { code: '23514', message: 'new row for relation "du_an" violates check constraint "du_an_khach_hang_hop_le"' },
    mongDoi: { ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE, loiTheoO: { khachHang: THONG_BAO_DU_AN.khachHangQuaDai } },
  },
  {
    ten: 'ràng buộc Mức ưu tiên',
    loi: { code: '23514', message: 'new row for relation "du_an" violates check constraint "du_an_muc_uu_tien_hop_le"' },
    mongDoi: { ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE, loiTheoO: { mucUuTien: THONG_BAO_MUC_UU_TIEN.sai } },
  },
  {
    ten: 'ràng buộc kiểm tra khác',
    loi: { code: '23514', message: 'new row for relation "du_an" violates check constraint "du_an_khac"' },
    mongDoi: { ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE },
  },
  { ten: 'trigger ném NGUOI_NGOAI_DU_AN', loi: { code: 'P0001', message: 'NGUOI_NGOAI_DU_AN' }, mongDoi: LOI_NGUOI_PHU_TRACH },
  {
    ten: 'khoá ngoại Người phụ trách (người vừa bị gỡ cùng lúc)',
    loi: { code: '23503', message: 'insert or update on table "du_an" violates foreign key constraint "du_an_nguoi_phu_trach_fkey"' },
    mongDoi: LOI_NGUOI_PHU_TRACH,
  },
  {
    ten: 'Dự án vừa bị Lưu trữ',
    loi: { code: 'P0001', message: 'DU_AN_DA_LUU_TRU' },
    mongDoi: { ma: 'DU_AN_DA_LUU_TRU', thongBao: THONG_BAO_MAC_DINH.DU_AN_DA_LUU_TRU },
  },
  {
    ten: 'quyền cột hay phân quyền từng dòng',
    loi: { code: '42501', message: 'permission denied for table du_an' },
    mongDoi: { ma: 'KHONG_CO_QUYEN', thongBao: THONG_BAO_MAC_DINH.KHONG_CO_QUYEN },
  },
  {
    ten: 'lỗi lạ của máy chủ',
    loi: { code: '57014', message: 'canceling statement due to statement timeout' },
    mongDoi: { ma: 'LOI_HE_THONG', thongBao: THONG_BAO_MAC_DINH.LOI_HE_THONG },
  },
]

describe('trường mới của Dự án trên bản Supabase, máy chủ là fetch giả', () => {
  it('tạo Dự án gửi đủ năm trường mới (Mã đã cắt khoảng trắng và in hoa), không gửi Người phụ trách hay dấu vết; trả về đủ sáu trường', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const duAn = giaTri(
      await kho.taoDuAn(
        phien.pm,
        {
          ma: '  sdv-012 ',
          ten: 'Ứng dụng',
          moTa: 'Làm lại app',
          khachHang: '  Công ty B ',
          ngayBatDau: '2026-07-01',
          ngayKetThucDuKien: '2026-07-31',
          mucUuTien: 'CAO',
        },
        LUC,
      ),
    )
    expect(du.lanGhi).toEqual([
      {
        phuongThuc: 'POST',
        than: {
          ma: 'SDV-012',
          ten: 'Ứng dụng',
          mo_ta: 'Làm lại app',
          khach_hang: 'Công ty B',
          ngay_bat_dau: '2026-07-01',
          ngay_ket_thuc_du_kien: '2026-07-31',
          muc_uu_tien: 'CAO',
        },
      },
    ])
    expect(duAn).toMatchObject({
      ma: 'SDV-012',
      ten: 'Ứng dụng',
      khachHang: 'Công ty B',
      ngayBatDau: '2026-07-01',
      ngayKetThucDuKien: '2026-07-31',
      mucUuTien: 'CAO',
      nguoiPhuTrach: null,
      trangThai: 'HOAT_DONG',
      dauVet: { taoBoi: { id: ID.pm, tenHienThi: 'Pm' }, suaBoi: null, suaLuc: null },
    })
  })

  it('tạo Dự án không nhập trường tuỳ chọn: gửi Khách hàng trống, hai ngày null, Mức ưu tiên Trung bình', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const duAn = giaTri(await kho.taoDuAn(phien.pm, { ma: 'TT-1', ten: 'Tối thiểu' }, LUC))
    expect(du.lanGhi[0]?.than).toEqual({
      ma: 'TT-1',
      ten: 'Tối thiểu',
      mo_ta: '',
      khach_hang: '',
      ngay_bat_dau: null,
      ngay_ket_thuc_du_kien: null,
      muc_uu_tien: 'TRUNG_BINH',
    })
    expect(duAn).toMatchObject({ khachHang: '', ngayBatDau: null, ngayKetThucDuKien: null, mucUuTien: 'TRUNG_BINH', nguoiPhuTrach: null })
  })

  it('sửa Dự án gửi đúng các ô đã nhập (kèm tên để dấu vết được cập nhật); trả về đủ sáu trường, Người phụ trách kèm tên hiển thị', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    // Support của Dự án sửa được.
    const duAn = giaTri(
      await kho.suaDuAn(
        phien.chi,
        ID.duAn,
        {
          ma: ' ch-99 ',
          khachHang: ' Công ty C ',
          ngayBatDau: '2026-06-05',
          ngayKetThucDuKien: '',
          mucUuTien: 'THAP',
          nguoiPhuTrachId: ID.binh,
        },
        LUC,
      ),
    )
    expect(du.lanGhi).toEqual([
      {
        phuongThuc: 'PATCH',
        than: {
          ten: 'Cửa hàng',
          ma: 'CH-99',
          khach_hang: 'Công ty C',
          ngay_bat_dau: '2026-06-05',
          ngay_ket_thuc_du_kien: null,
          muc_uu_tien: 'THAP',
          nguoi_phu_trach_id: ID.binh,
        },
      },
    ])
    expect(duAn).toMatchObject({
      id: ID.duAn,
      ma: 'CH-99',
      khachHang: 'Công ty C',
      ngayBatDau: '2026-06-05',
      ngayKetThucDuKien: null,
      mucUuTien: 'THAP',
      nguoiPhuTrach: { id: ID.binh, tenHienThi: 'Binh' },
      dauVet: { suaBoi: { id: ID.chi, tenHienThi: 'Chi' }, suaLuc: new Date(GIO_MAY_CHU) },
    })

    // Chỉ một ô: chỉ gửi ô đó (và tên); bỏ Người phụ trách gửi null.
    du.lanGhi = []
    giaTri(await kho.suaDuAn(phien.pm, ID.duAn, { nguoiPhuTrachId: '' }, LUC))
    expect(du.lanGhi.map((l) => l.than)).toEqual([{ ten: 'Cửa hàng', nguoi_phu_trach_id: null }])
    expect(giaTri(await kho.layDuAn(phien.pm, ID.duAn)).nguoiPhuTrach).toBeNull()
  })

  it('layDuAn, danhSachDuAn và "Dự án của tôi" đọc đủ trường mới từ cơ sở dữ liệu', async () => {
    const { kho, phien } = await dungBoiCanh()
    const mongDoi = {
      id: ID.duAn,
      ma: 'CH-01',
      ten: 'Cửa hàng',
      khachHang: 'Công ty A',
      ngayBatDau: '2026-06-01',
      ngayKetThucDuKien: '2026-06-30',
      mucUuTien: 'CAO',
      nguoiPhuTrach: { id: ID.an, tenHienThi: 'An' },
    }
    // Thành viên trong Dự án (chính Người phụ trách) đọc được.
    expect(giaTri(await kho.layDuAn(phien.an, ID.duAn))).toMatchObject(mongDoi)
    expect(giaTri(await kho.danhSachDuAn(phien.pm)).find((d) => d.id === ID.duAn)).toMatchObject(mongDoi)
    expect(giaTri(await kho.danhSachDuAnCuaToi(phien.binh))).toEqual([
      { id: ID.duAn, ma: 'CH-01', ten: 'Cửa hàng', trangThai: 'HOAT_DONG' },
      { id: ID.duAnKhac, ma: 'KHO-02', ten: 'Kho', trangThai: 'HOAT_DONG' },
    ])
  })

  it('Mã trùng Mã của Dự án khác (khác hoa thường, kể cả Dự án đã Lưu trữ) khi tạo và khi sửa: MA_DU_AN_DA_DUNG ở ô Mã như bản bộ nhớ; sửa sang Mã của chính nó được', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const truoc = du.duAn.length
    expect(loiCua(await kho.taoDuAn(phien.pm, { ma: ' kho-02 ', ten: 'Bản sao' }, LUC))).toEqual(LOI_MA_TRUNG)
    expect(loiCua(await kho.taoDuAn(phien.pm, { ma: 'cu-03', ten: 'Bản sao' }, LUC))).toEqual(LOI_MA_TRUNG)
    expect(du.duAn).toHaveLength(truoc)

    const cu = duAnDangLuu(du, ID.duAn)
    expect(loiCua(await kho.suaDuAn(phien.pm, ID.duAn, { ma: 'kho-02', ten: 'Không lưu' }, LUC))).toEqual(LOI_MA_TRUNG)
    expect(duAnDangLuu(du, ID.duAn)).toEqual(cu)

    expect(giaTri(await kho.suaDuAn(phien.pm, ID.duAn, { ma: 'ch-01' }, LUC)).ma).toBe('CH-01')
  })

  it('Người phụ trách ngoài Dự án (đã đăng ký chưa thêm, PM không ở trong Dự án, id không tồn tại, id sai dạng): NGUOI_NGOAI_DU_AN ở ô Người phụ trách như bản bộ nhớ, không đổi gì', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const cu = duAnDangLuu(du, ID.duAn)
    for (const nguoi of [ID.ngoai, ID.pm, id(999)]) {
      const kq = await kho.suaDuAn(phien.pm, ID.duAn, { nguoiPhuTrachId: nguoi, ten: 'Không lưu', mucUuTien: 'THAP' }, LUC)
      expect(loiCua(kq), nguoi).toEqual(LOI_NGUOI_PHU_TRACH)
    }
    expect(duAnDangLuu(du, ID.duAn)).toEqual(cu)

    // Id sai dạng: chắc chắn không phải Người trong dự án; không gửi gì lên cơ sở dữ liệu.
    du.lanGhi = []
    expect(loiCua(await kho.suaDuAn(phien.pm, ID.duAn, { nguoiPhuTrachId: 'khong-phai-uuid' }, LUC))).toEqual(LOI_NGUOI_PHU_TRACH)
    expect(du.lanGhi).toEqual([])

    // Người ngoài Dự án mà Mã cũng trùng: báo Người phụ trách trước, như thứ tự của bản bộ nhớ.
    expect(loiCua(await kho.suaDuAn(phien.pm, ID.duAn, { nguoiPhuTrachId: ID.ngoai, ma: 'KHO-02' }, LUC))).toEqual(
      LOI_NGUOI_PHU_TRACH,
    )
  })

  it('ngày gửi lên làm Ngày kết thúc dự kiến trước Ngày bắt đầu (kể cả với ngày đang lưu): KHONG_HOP_LE ở ô vừa gửi, không gửi gì lên', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const sai = THONG_BAO_DU_AN.ngayKetThucTruocBatDau
    const ca: [Parameters<KhoDuLieu['suaDuAn']>[2], Record<string, string>][] = [
      [{ ngayKetThucDuKien: '2026-05-31' }, { ngayKetThucDuKien: sai }],
      [{ ngayBatDau: '2026-07-01' }, { ngayBatDau: sai }],
      [{ ngayBatDau: '2026-07-01', ngayKetThucDuKien: '2026-06-30' }, { ngayKetThucDuKien: sai }],
    ]
    for (const [dauVao, loiTheoO] of ca) {
      expect(loiCua(await kho.suaDuAn(phien.pm, ID.duAn, dauVao, LUC))).toEqual({
        ma: 'KHONG_HOP_LE',
        thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE,
        loiTheoO,
      })
    }
    expect(loiCua(await kho.taoDuAn(phien.pm, { ma: 'NG-1', ten: 'X', ngayBatDau: '2026-07-02', ngayKetThucDuKien: '2026-07-01' }, LUC))).toEqual({
      ma: 'KHONG_HOP_LE',
      thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE,
      loiTheoO: { ngayKetThucDuKien: sai },
    })
    expect(du.lanGhi).toEqual([])
  })

  it('quyền như bản bộ nhớ: Thành viên và Support ngoài Dự án KHONG_CO_QUYEN, Dự án đã Lưu trữ DU_AN_DA_LUU_TRU; không gửi gì lên', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const dauVao = { ma: 'MOI-1', khachHang: 'X', mucUuTien: 'THAP' as const, nguoiPhuTrachId: ID.binh }
    expect(maLoi(await kho.suaDuAn(phien.an, ID.duAn, dauVao, LUC))).toBe('KHONG_CO_QUYEN')
    expect(maLoi(await kho.suaDuAn(phien.chi, ID.duAnKhac, dauVao, LUC))).toBe('KHONG_CO_QUYEN')
    expect(maLoi(await kho.suaDuAn(phien.chi, ID.duAnLuuTru, dauVao, LUC))).toBe('DU_AN_DA_LUU_TRU')
    expect(maLoi(await kho.taoDuAn(phien.chi, { ma: 'MOI-2', ten: 'X' }, LUC))).toBe('KHONG_CO_QUYEN')
    expect(du.lanGhi).toEqual([])
  })

  it.each(CA_LOI_SUA)('sửa Dự án, cơ sở dữ liệu từ chối ($ten): đổi về đúng lỗi có mã', async ({ loi, mongDoi, dauVao }) => {
    const { du, kho, phien } = await dungBoiCanh()
    du.loiGhi = loi
    const kq = await kho.suaDuAn(
      phien.pm,
      ID.duAn,
      dauVao ?? { ma: 'CH-02', khachHang: 'Công ty D', ngayKetThucDuKien: '2026-07-15', mucUuTien: 'THAP', nguoiPhuTrachId: ID.binh },
      LUC,
    )
    expect(du.lanGhi).toHaveLength(1)
    expect(loiCua(kq)).toEqual(mongDoi)
  })

  it.each(CA_LOI_SUA.filter((ca) => !ca.dauVao && ca.mongDoi.ma !== 'NGUOI_NGOAI_DU_AN' && ca.mongDoi.ma !== 'DU_AN_DA_LUU_TRU'))(
    'tạo Dự án, cơ sở dữ liệu từ chối ($ten): đổi về đúng lỗi có mã',
    async ({ loi, mongDoi }) => {
      const { du, kho, phien } = await dungBoiCanh()
      du.loiGhi = loi
      const kq = await kho.taoDuAn(
        phien.pm,
        { ma: 'MOI-1', ten: 'Mới', khachHang: 'Công ty D', ngayBatDau: '2026-07-01', ngayKetThucDuKien: '2026-07-15', mucUuTien: 'THAP' },
        LUC,
      )
      expect(du.lanGhi).toHaveLength(1)
      expect(loiCua(kq)).toEqual(mongDoi)
    },
  )

  it('mọi yêu cầu chỉ tới máy chủ giả, không ra mạng', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    giaTri(await kho.layDuAn(phien.pm, ID.duAn))
    expect(du.diaChi.length).toBeGreaterThan(0)
    for (const diaChi of du.diaChi) expect(new URL(diaChi).origin).toBe(URL_GIA)
  })
})

// --- Cấu trúc file migration (không chạy SQL) ---

/** Bỏ chú thích `-- ...` để không khớp nhầm lời giải thích. */
function boChuThich(sql: string): string {
  return sql.replace(/--.*$/gm, '')
}

const SQL = boChuThich(migrationLen)
const SQL_XUONG = boChuThich(migrationXuong)
const SQL_LAT_1 = boChuThich(migrationLat1)

/** Thân một hàm (giữa hai dấu `$$`) theo tên, trong `create [or replace] function <ten>(`. */
function thanHam(sql: string, ten: string): string {
  const khop = new RegExp(`create (?:or replace )?function ${ten.replace('.', '\\.')}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`, 'i').exec(sql)
  if (!khop) throw new Error(`Không tìm thấy hàm ${ten}`)
  return khop[1].replace(/\s+/g, ' ').trim()
}

/** Cột trong `grant <quyen> (cột, ...) on table public.du_an to authenticated` (mọi câu như thế). */
function cotDuocCap(sql: string, quyen: 'insert' | 'update'): string[] {
  const mau = new RegExp(`grant\\s+${quyen}\\s*\\(([^)]*)\\)\\s+on\\s+table\\s+public\\.du_an\\s+to\\s+authenticated`, 'gi')
  return [...sql.matchAll(mau)].flatMap((m) => m[1].split(',').map((c) => c.trim()))
}

const CAC_COT_MOI = ['ma', 'khach_hang', 'ngay_bat_dau', 'ngay_ket_thuc_du_kien', 'muc_uu_tien', 'nguoi_phu_trach_id']

describe('migration trường mới của Dự án: cấu trúc file, không chạy SQL', () => {
  it('thêm đủ sáu cột với kiểu đúng; Mức ưu tiên mặc định TRUNG_BINH, Khách hàng mặc định trống', () => {
    const them = /alter table public\.du_an\s+((?:add column[^,;]+[,;]\s*)+)/i.exec(SQL)?.[1] ?? ''
    const cot = Object.fromEntries([...them.matchAll(/add column ([a-z_]+) ([^,;]+)/gi)].map((m) => [m[1], m[2].trim()]))
    expect(Object.keys(cot)).toEqual(CAC_COT_MOI)
    expect(cot).toEqual({
      ma: 'text',
      khach_hang: "text not null default ''",
      ngay_bat_dau: 'date',
      ngay_ket_thuc_du_kien: 'date',
      muc_uu_tien: "text not null default 'TRUNG_BINH'",
      nguoi_phu_trach_id: 'uuid',
    })
  })

  it('gán mã tạm DA-001, DA-002… theo ngày tạo và Mức ưu tiên Trung bình TRƯỚC khi Mã thành bắt buộc và duy nhất', () => {
    const viTriGan = SQL.search(/update public\.du_an d\s+set ma = 'DA-'/i)
    const viTriBatBuoc = SQL.search(/alter column ma set not null/i)
    const viTriDuyNhat = SQL.search(/create unique index du_an_ma_key/i)
    expect(viTriGan).toBeGreaterThan(0)
    expect(viTriGan).toBeLessThan(viTriBatBuoc)
    expect(viTriGan).toBeLessThan(viTriDuyNhat)
    expect(SQL).toMatch(/row_number\(\) over \(order by d\.tao_luc, d\.id\)/i)
    expect(SQL).toMatch(/lpad\(t\.so::text, 3, '0'\)/i)
    expect(SQL).toMatch(/muc_uu_tien = 'TRUNG_BINH'\s+from thu_tu/i)
    // Dự án đã Lưu trữ cũng nhận mã: trigger sửa tắt trong lúc gán và bật lại ngay sau.
    expect(SQL.search(/disable trigger du_an_truoc_khi_sua/i)).toBeLessThan(viTriGan)
    expect(SQL.search(/enable trigger du_an_truoc_khi_sua/i)).toBeGreaterThan(viTriGan)
    // Mã tạm là Mã hợp lệ theo luật thuần (kể cả khi có từ nghìn Dự án trở lên).
    for (const ma of ['DA-001', 'DA-999', 'DA-1000', 'DA-123456789']) {
      const kt = kiemTraDuAn.tao({ ma, ten: 'Dự án cũ' })
      expect(kt.ok, ma).toBe(true)
      if (kt.ok) expect(kt.giaTri.ma).toBe(ma)
    }
  })

  it('Mã duy nhất không phân biệt hoa thường, đúng dạng của luật thuần; các ràng buộc mà bản cài Supabase đổi lỗi đều có, cùng giới hạn với luật thuần', () => {
    expect(SQL).toMatch(/create unique index du_an_ma_key on public\.du_an \(upper\(ma\)\)/i)
    expect(SQL).toContain(`ma ~ '^[A-Z0-9-]{${DO_DAI_MA_DU_AN_TOI_THIEU},${DO_DAI_MA_DU_AN_TOI_DA}}$'`)
    expect(SQL).toContain(`char_length(khach_hang) <= ${DO_DAI_KHACH_HANG_TOI_DA}`)
    expect(SQL).toMatch(/ngay_bat_dau is null or ngay_ket_thuc_du_kien is null or ngay_ket_thuc_du_kien >= ngay_bat_dau/)
    expect(SQL).toContain(`muc_uu_tien in (${CAC_MUC_UU_TIEN.map((m) => `'${m}'`).join(', ')})`)
    // Mọi tên ràng buộc trong các ca đổi lỗi ở trên là ràng buộc thật của migration.
    for (const ca of CA_LOI_SUA) {
      const ten = /constraint "([^"]+)"/.exec(ca.loi.message)?.[1]
      if (ten && ten !== 'du_an_khac') expect(SQL, ten).toMatch(new RegExp(`(constraint|index) ${ten}\\b`))
    }
    // Trigger chuẩn hoá Mã ở cả tạo và sửa.
    expect(thanHam(SQL, 'rieng.du_an_truoc_khi_tao')).toContain('new.ma := upper(btrim(new.ma));')
    expect(thanHam(SQL, 'rieng.du_an_truoc_khi_sua')).toContain('new.ma := upper(btrim(new.ma));')
  })

  it('Người phụ trách: khoá ngoại tới Người trong dự án, về trống khi người đó bị gỡ; trigger ném NGUOI_NGOAI_DU_AN; Dự án mới chưa có Người phụ trách', () => {
    expect(SQL).toMatch(
      /add constraint du_an_nguoi_phu_trach_fkey foreign key \(id, nguoi_phu_trach_id\)\s+references public\.nguoi_trong_du_an \(du_an_id, nguoi_dung_id\)\s+on delete set null \(nguoi_phu_trach_id\)/i,
    )
    const sua = thanHam(SQL, 'rieng.du_an_truoc_khi_sua')
    expect(sua).toContain("raise exception 'NGUOI_NGOAI_DU_AN'")
    // Kiểm Lưu trữ trước Người phụ trách, như thứ tự của bản bộ nhớ.
    expect(sua.indexOf("'DU_AN_DA_LUU_TRU'")).toBeLessThan(sua.indexOf("'NGUOI_NGOAI_DU_AN'"))
    expect(thanHam(SQL, 'rieng.du_an_truoc_khi_tao')).toContain('new.nguoi_phu_trach_id := null;')
    // Mọi mã lỗi trigger ném là mã của Kho.
    for (const m of SQL.matchAll(/raise exception '([A-Z_]+)'/g)) expect(Object.keys(THONG_BAO_MAC_DINH)).toContain(m[1])
  })

  it('Dự án đã Lưu trữ: trigger sửa chặn đổi mọi cột mới (chỉ mở lại được)', () => {
    const sua = thanHam(SQL, 'rieng.du_an_truoc_khi_sua')
    const khoi = /if old\.trang_thai = 'LUU_TRU'([\s\S]*?)then raise exception 'DU_AN_DA_LUU_TRU'/.exec(sua)?.[1] ?? ''
    for (const cot of ['ten', 'mo_ta', ...CAC_COT_MOI]) expect(khoi, cot).toContain(`new.${cot}`)
  })

  it('chỉ mở quyền cột cho đúng các cột mới, Người phụ trách chỉ đặt khi sửa; không mở cột trạng thái, dấu vết; không thêm policy, quyền bảng hay quyền cho anon', () => {
    expect(cotDuocCap(SQL, 'insert').sort()).toEqual(['khach_hang', 'ma', 'muc_uu_tien', 'ngay_bat_dau', 'ngay_ket_thuc_du_kien'])
    expect(cotDuocCap(SQL, 'update').sort()).toEqual([...CAC_COT_MOI].sort())
    // Cộng với quyền cột của lát 1 (ten, mo_ta), client không ghi được gì khác của Dự án.
    for (const camCap of ['id', 'trang_thai', 'tao_boi', 'tao_luc', 'sua_boi', 'sua_luc']) {
      expect([...cotDuocCap(SQL, 'insert'), ...cotDuocCap(SQL, 'update'), ...cotDuocCap(SQL_LAT_1, 'update')]).not.toContain(camCap)
    }
    expect(SQL).not.toMatch(/create policy/i)
    expect(SQL).not.toMatch(/\banon\b/i)
    expect(SQL).not.toMatch(/to\s+public\b/i)
    expect(SQL).not.toMatch(/grant\s+(all|insert|update|delete)\s+on\s+table/i)
    // Hàng được ghi vẫn do policy của lát 1 quyết: tạo chỉ PM; sửa chỉ PM, Support của Dự án.
    expect(SQL_LAT_1).toMatch(/create policy du_an_tao on public\.du_an\s+for insert to authenticated\s+with check \(rieng\.la_pm\(\)\)/i)
    expect(SQL_LAT_1).toMatch(/create policy du_an_sua on public\.du_an\s+for update to authenticated\s+using \(rieng\.duoc_quan_ly_du_an\(id\)\)/i)
  })

  it('tên hiển thị của Người phụ trách đọc được qua ten_nguoi_dau_vet, vẫn chỉ cho Dự án người gọi thấy', () => {
    const ham = thanHam(SQL, 'public.ten_nguoi_dau_vet')
    expect(ham).toContain('d.nguoi_phu_trach_id = h.id')
    expect(ham).toContain('rieng.duoc_xem_du_an(d.id)')
  })

  it('bản xuống bỏ đủ cột, ràng buộc, chỉ mục và trả ba hàm về đúng bản của lát 1 trước khi bỏ cột', () => {
    for (const cot of CAC_COT_MOI) expect(SQL_XUONG).toMatch(new RegExp(`drop column if exists ${cot}\\b`))
    for (const m of SQL.matchAll(/add constraint ([a-z_]+)/g)) {
      expect(SQL_XUONG).toMatch(new RegExp(`drop constraint if exists ${m[1]}\\b`))
    }
    expect(SQL_XUONG).toMatch(/drop index if exists public\.du_an_ma_key/)
    for (const ham of ['rieng.du_an_truoc_khi_tao', 'rieng.du_an_truoc_khi_sua', 'public.ten_nguoi_dau_vet']) {
      expect(thanHam(SQL_XUONG, ham), ham).toBe(thanHam(SQL_LAT_1, ham))
      expect(SQL_XUONG.search(new RegExp(`function ${ham.replace('.', '\\.')}\\(`))).toBeLessThan(SQL_XUONG.search(/drop column/))
    }
  })
})

describe('bộ test hợp đồng chạy tay trên Supabase thật có ca cho trường mới', () => {
  it('chạy bộ hợp đồng Mã và Khách hàng, ngày của Dự án, Mức ưu tiên và Người phụ trách cho bản Supabase (cổng không chạy file đó)', () => {
    for (const bo of ['chayHopDongMaDuAn', 'chayHopDongNgayDuAn', 'chayHopDongUuTienPhuTrach']) {
      expect(boTestSupabaseThat).toMatch(new RegExp(`\\n\\s+${bo}\\('bản Supabase', taoBanCai, tuyChon\\)`))
    }
  })
})
