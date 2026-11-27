// Phần cổng kiểm được của Mức ưu tiên của Task, Thông tin nhân sự và Vai trò trong Dự án trên bản Supabase
// (ticket truong-moi 10), không cần mạng hay DB.
//
// Cổng KHÔNG chạy được SQL, nên không kiểm được cột, ràng buộc, trigger ghi lịch sử, phân quyền từng dòng hay quyền
// cột thật: những thứ đó chủ dự án áp và kiểm tay (supabase/README.md, mục "Task, hồ sơ và Người trong dự án trên
// Supabase"), cùng bộ test hợp đồng chạy trên Supabase thật. Ở đây chỉ có:
//   1. Hành vi của bản cài Supabase nhìn từ giao diện Kho khi máy chủ là một `fetch` giả trong bộ nhớ (không có
//      mạng): tạo Task, đổi Mức ưu tiên, sửa hồ sơ, thêm người kèm vai trò, sửa vai trò, đọc Người trong dự án gửi
//      và nhận đủ trường mới; lỗi mà cơ sở dữ liệu trả được đổi về đúng lỗi có mã như bản bộ nhớ; ba trường Thông
//      tin nhân sự mà cơ sở dữ liệu trả trống thì Kho trả trống. `fetch` giả chỉ bắt chước thô những gì migration
//      hứa (phân quyền từng dòng, trigger ghi lịch sử đổi mức) hoặc trả đúng lỗi test dặn; KHÔNG thay cho SQL thật.
//   2. Cấu trúc file migration và bản xuống (đọc chữ, không chạy SQL), kể cả lập luận quyền xem Thông tin nhân sự.
//   3. Bộ test hợp đồng và bảng ca chạy tay trên Supabase thật có ca cho các trường và quyền mới.
import { describe, expect, it } from 'vitest'
import { THONG_BAO_MAC_DINH, type KetQua, type LoiKho, type MaLoi } from './ketQua'
import { taoKhoSupabase } from './khoSupabase'
import type { KhoDuLieu, Phien } from './khoDuLieu'
import { BANG_CA_QUYEN } from './bangCaQuyen'
import { DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA, THONG_BAO_DU_AN } from '../luat/duAn'
import { CAC_MUC_UU_TIEN, THONG_BAO_MUC_UU_TIEN } from '../luat/mucUuTien'
import {
  DO_DAI_CHUC_DANH_TOI_DA,
  DO_DAI_PHONG_BAN_TOI_DA,
  THONG_BAO_NHAN_SU,
  apQuyenXemNhanSu,
  chuanHoaSoDienThoai,
  duocXemThongTinNhanSu,
} from '../luat/thongTinNhanSu'
import type { VaiHeThong } from '../luat/taiKhoan'
import migrationLen from '../../supabase/migrations/20261126000600_truong_task_ho_so_nguoi.sql?raw'
import migrationXuong from '../../supabase/down/20261126000600_truong_task_ho_so_nguoi.down.sql?raw'
import migrationLat1 from '../../supabase/migrations/20261125000100_lat_1_ho_so_du_an.sql?raw'
import migrationLat3 from '../../supabase/migrations/20261125000300_lat_3_vong_duyet.sql?raw'
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
/** Giờ "máy chủ" (bản Supabase bỏ qua giờ truyền vào). */
const GIO_MAY_CHU = '2026-06-02T05:00:00+00:00'

type Dong = Record<string, unknown>

const id = (so: number) => `00000000-0000-4000-8000-${String(so).padStart(12, '0')}`
const ID = {
  pm: id(1),
  an: id(2),
  binh: id(3),
  chi: id(4),
  ngoai: id(6),
  moi: id(7),
  duAn: id(10),
  duAnLuuTru: id(11),
  task: id(20),
  taskXong: id(21),
  taskLuuTru: id(22),
  taskBinh: id(23),
}

interface LoiCsdlGia {
  code: string
  message: string
}

type BangGhi = 'task' | 'ho_so' | 'nguoi_trong_du_an'

interface LanGhi {
  bang: BangGhi
  phuongThuc: 'POST' | 'PATCH'
  loc: string
  than: Dong
}

interface DuLieuGia {
  hoSo: Dong[]
  duAn: Dong[]
  thanhVien: Dong[]
  task: Dong[]
  lichSuTrangThai: Dong[]
  /** Dòng lịch sử đổi Mức ưu tiên mà trigger của cơ sở dữ liệu ghi (fetch giả bắt chước). */
  lichSuMucUuTien: Dong[]
  /** Các lần ghi bảng (tạo, sửa) mà "máy chủ" nhận. */
  lanGhi: LanGhi[]
  /** Các lần gọi hàm them_nguoi_vao_du_an. */
  lanThemNguoi: Dong[]
  /** Lỗi mà lần ghi tiếp theo vào bảng (hoặc hàm them_nguoi_vao_du_an) trả về thay cho việc ghi. */
  loiGhi: Partial<Record<BangGhi | 'them_nguoi_vao_du_an', LoiCsdlGia>>
  /** Hàm them_nguoi_vao_du_an trả ba trường Thông tin nhân sự là null (người gọi không đủ quyền xem). */
  themNguoiAnNhanSu: boolean
  diaChi: string[]
}

function hoSoGia(so: number, ten: string, vai: string, nhanSu: Dong = {}): Dong {
  return {
    id: id(so),
    email: `${ten.toLowerCase()}@vi-du.vn`,
    ten_hien_thi: ten,
    github_username: null,
    vai,
    so_dien_thoai: null,
    chuc_danh: null,
    phong_ban: null,
    ...nhanSu,
  }
}

const NHAN_SU_BINH = { so_dien_thoai: '+84912345678', chuc_danh: 'Lập trình viên', phong_ban: 'Phòng Phần mềm' }
const NHAN_SU_MOI = { so_dien_thoai: '0901234567', chuc_danh: 'Kiểm thử', phong_ban: 'Phòng Chất lượng' }

function taskGia(maTask: string, duAnId: string, dong: Dong = {}): Dong {
  return {
    id: maTask,
    du_an_id: duAnId,
    tieu_de: 'Làm trang chủ',
    mo_ta: '',
    han: null,
    muc_uu_tien: 'TRUNG_BINH',
    nguoi_thuc_hien_id: ID.an,
    nguoi_kiem_tra_id: ID.binh,
    trang_thai: 'MOI',
    so_lan_tra_lai: 0,
    tao_boi: ID.pm,
    tao_luc: '2026-06-01T03:00:00+00:00',
    sua_boi: null,
    sua_luc: null,
    ...dong,
  }
}

function duAnGia(dong: Dong): Dong {
  return {
    ma: 'CH-01',
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
      hoSoGia(3, 'Binh', 'THANH_VIEN', NHAN_SU_BINH),
      hoSoGia(4, 'Chi', 'SUPPORT'),
      hoSoGia(6, 'Ngoai', 'THANH_VIEN'),
      hoSoGia(7, 'Moi', 'THANH_VIEN', NHAN_SU_MOI),
    ],
    duAn: [
      duAnGia({ id: ID.duAn, ma: 'CH-01', ten: 'Cửa hàng' }),
      duAnGia({ id: ID.duAnLuuTru, ma: 'CU-02', ten: 'Cũ', trang_thai: 'LUU_TRU' }),
    ],
    thanhVien: [
      { du_an_id: ID.duAn, nguoi_dung_id: ID.an, vai_tro: 'Trưởng nhóm' },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.binh, vai_tro: null },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.chi, vai_tro: null },
      { du_an_id: ID.duAnLuuTru, nguoi_dung_id: ID.an, vai_tro: 'Lập trình' },
      { du_an_id: ID.duAnLuuTru, nguoi_dung_id: ID.chi, vai_tro: null },
    ],
    task: [
      taskGia(ID.task, ID.duAn),
      taskGia(ID.taskXong, ID.duAn, { trang_thai: 'HOAN_THANH', muc_uu_tien: 'CAO' }),
      taskGia(ID.taskLuuTru, ID.duAnLuuTru),
      taskGia(ID.taskBinh, ID.duAn, { nguoi_thuc_hien_id: ID.binh, nguoi_kiem_tra_id: ID.an, trang_thai: 'DANG_LAM' }),
    ],
    lichSuTrangThai: [],
    lichSuMucUuTien: [],
    lanGhi: [],
    lanThemNguoi: [],
    loiGhi: {},
    themNguoiAnNhanSu: false,
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

const CAC_THAM_SO_KHONG_LOC = ['select', 'order', 'limit', 'offset', 'or']

/** Lọc dòng theo các bộ lọc `cot=eq.giaTri` và `cot=in.(a,b)` của PostgREST, rồi theo `offset`, `limit`. */
function loc(dong: readonly Dong[], thamSo: URLSearchParams): Dong[] {
  const ketQua = dong.filter((d) => {
    for (const [khoa, giaTri] of thamSo) {
      if (CAC_THAM_SO_KHONG_LOC.includes(khoa)) continue
      if (giaTri.startsWith('eq.') && String(d[khoa]) !== giaTri.slice(3)) return false
      if (giaTri.startsWith('in.(')) {
        const ds = giaTri.slice(4, -1).split(',').map((x) => x.replace(/^"|"$/g, ''))
        if (!ds.includes(String(d[khoa]))) return false
      }
    }
    return true
  })
  const batDau = Number(thamSo.get('offset') ?? 0)
  const gioiHan = thamSo.get('limit')
  return ketQua.slice(batDau, gioiHan === null ? undefined : batDau + Number(gioiHan))
}

/** Chỉ giữ các cột được hỏi (`select=a,b`). */
function chonCot(dong: Dong, cot: readonly string[]): Dong {
  return Object.fromEntries(cot.map((c) => [c, dong[c]]))
}

const CAC_MUC = new Set<unknown>(CAC_MUC_UU_TIEN)

/**
 * `fetch` giả đóng vai Supabase: Auth (đăng nhập), PostgREST (bảng ho_so, du_an, nguoi_trong_du_an, task; hàm
 * ten_nguoi_dau_vet, ten_nguoi_cua_task, them_nguoi_vao_du_an, lich_su_task). Bắt chước thô phân quyền từng dòng
 * (PM thấy mọi Dự án; người khác Dự án mình ở trong; hồ sơ theo ho_so_doc của lát 1) và những gì migration
 * 20261126000600 hứa: Task sửa được chỉ khi PM hay Support của Dự án, Dự án chưa Lưu trữ, Task chưa chốt; đổi sang
 * Mức ưu tiên khác thì ghi một dòng lịch sử (người gọi, giờ máy chủ, từ, sang); lich_su_task trả chung dòng thời
 * gian kèm `loai`; them_nguoi_vao_du_an thêm người kèm vai trò trong một lệnh.
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
    const laPM = nguoiGoi?.vai === 'PM'
    const laThanhVien = (duAnId: unknown, nguoiId: unknown) =>
      du.thanhVien.some((t) => t.du_an_id === duAnId && t.nguoi_dung_id === nguoiId)
    const duAnThay = (duAnId: unknown) => laPM || laThanhVien(duAnId, nguoiGoi?.id)
    const duAnQuanLy = (duAnId: unknown) => laPM || (nguoiGoi?.vai === 'SUPPORT' && laThanhVien(duAnId, nguoiGoi.id))
    const dangHoatDong = (duAnId: unknown) => du.duAn.find((d) => d.id === duAnId)?.trang_thai === 'HOAT_DONG'
    // ho_so_doc của lát 1: của mình, PM, hoặc người kia ở trong một Dự án người gọi thấy được.
    const thayHoSo = (hoSoId: unknown) =>
      hoSoId === nguoiGoi?.id || laPM || du.thanhVien.some((t) => t.nguoi_dung_id === hoSoId && duAnThay(t.du_an_id))
    const motDoiTuong = (tieuDe.get('accept') ?? '').includes('vnd.pgrst.object')
    const chon = url.searchParams.get('select') ?? ''

    /** Dòng nguoi_trong_du_an như PostgREST trả, kể cả khi nhúng hồ sơ (`ho_so!...(cột)`). */
    const dongNguoiTrongDuAn = (dong: readonly Dong[]): Dong[] => {
      const nhung = /ho_so!nguoi_trong_du_an_nguoi_dung_id_fkey\(([^)]*)\)/.exec(chon)
      if (!nhung) return dong.map((t) => chonCot(t, chon.split(',')))
      const cotHoSo = nhung[1].split(',')
      // Các cột thường được hỏi cạnh phần nhúng (vd. `nguoi_dung_id`) trả về như PostgREST.
      const cotThuong = chon
        .replace(nhung[0], '')
        .split(',')
        .filter((c) => c !== '')
      return dong.map((t) => {
        const hoSo = du.hoSo.find((h) => h.id === t.nguoi_dung_id)
        return { ...chonCot(t, cotThuong), ho_so: hoSo && thayHoSo(hoSo.id) ? chonCot(hoSo, cotHoSo) : null }
      })
    }

    if (url.pathname.startsWith('/rest/v1/rpc/')) {
      const ham = url.pathname.slice('/rest/v1/rpc/'.length)
      if (ham === 'ten_nguoi_dau_vet' || ham === 'ten_nguoi_cua_task') {
        const ids = (than.p_ids as string[]) ?? []
        return tra(200, du.hoSo.filter((h) => ids.includes(String(h.id))).map((h) => ({ id: h.id, ten_hien_thi: h.ten_hien_thi })))
      }
      if (ham === 'them_nguoi_vao_du_an') {
        du.lanThemNguoi.push(than)
        const loi = du.loiGhi.them_nguoi_vao_du_an
        if (loi) return traLoi(loi)
        const dich = du.hoSo.find((h) => h.email === String(than.p_email).trim().toLowerCase())
        if (!dich) return traLoi({ code: 'P0001', message: 'CHUA_DANG_KY' })
        if (laThanhVien(than.p_du_an_id, dich.id)) return traLoi({ code: 'P0001', message: 'DA_TRONG_DU_AN' })
        const vaiTro = typeof than.p_vai_tro === 'string' && than.p_vai_tro.trim() !== '' ? than.p_vai_tro.trim() : null
        du.thanhVien.push({ du_an_id: than.p_du_an_id, nguoi_dung_id: dich.id, vai_tro: vaiTro })
        const an = du.themNguoiAnNhanSu
        return tra(200, {
          id: dich.id,
          email: dich.email,
          ten_hien_thi: dich.ten_hien_thi,
          vai: dich.vai,
          so_dien_thoai: an ? null : dich.so_dien_thoai,
          chuc_danh: an ? null : dich.chuc_danh,
          phong_ban: an ? null : dich.phong_ban,
          vai_tro: vaiTro,
        })
      }
      if (ham === 'lich_su_task') {
        const task = du.task.find((t) => t.id === than.p_task_id)
        if (!task || !duAnThay(task.du_an_id)) return traLoi({ code: 'P0001', message: 'KHONG_TIM_THAY' })
        const ten = (maNguoi: unknown) => String(du.hoSo.find((h) => h.id === maNguoi)?.ten_hien_thi)
        const trangThai: Dong[] = du.lichSuTrangThai
          .filter((l) => l.task_id === than.p_task_id)
          .map((l) => ({ ...l, loai: 'TRANG_THAI', thuTu: 0 }))
        const mucUuTien: Dong[] = du.lichSuMucUuTien
          .filter((l) => l.task_id === than.p_task_id)
          .map((l) => ({ ...l, loai: 'MUC_UU_TIEN', ly_do: null, thuTu: 1 }))
        // Như hàm SQL: theo thời điểm, cùng thời điểm thì dòng trạng thái trước, rồi theo thứ tự ghi.
        const dong = [...trangThai, ...mucUuTien].sort(
          (a, b) => String(a.luc).localeCompare(String(b.luc)) || Number(a.thuTu) - Number(b.thuTu),
        )
        return tra(
          200,
          dong.map((l, i) => ({ stt: i + 1, loai: l.loai, nguoi_doi_id: l.nguoi_doi_id, ten_hien_thi: ten(l.nguoi_doi_id), luc: l.luc, tu: l.tu, sang: l.sang, ly_do: l.ly_do })),
        )
      }
      return tra(404, { code: 'PGRST202', message: `Không có hàm ${ham}` })
    }

    const bang = url.pathname.slice('/rest/v1/'.length)
    if (phuongThuc === 'GET') {
      if (bang === 'ho_so') return tra(200, loc(du.hoSo.filter((h) => thayHoSo(h.id)), url.searchParams).map((h) => chonCot(h, chon.split(','))))
      if (bang === 'du_an') {
        const dong = loc(du.duAn.filter((d) => duAnThay(d.id)), url.searchParams)
        // Nhúng id Người trong dự án (lượt kiểm quản lý Dự án, ticket toi-uu-hieu-nang 05).
        if (!chon.includes('nguoi_trong_du_an!nguoi_trong_du_an_du_an_id_fkey(nguoi_dung_id)')) return tra(200, dong)
        return tra(
          200,
          dong.map((d) => ({
            ...d,
            nguoi_trong_du_an: du.thanhVien.filter((t) => t.du_an_id === d.id).map((t) => ({ nguoi_dung_id: t.nguoi_dung_id })),
          })),
        )
      }
      if (bang === 'nguoi_trong_du_an') return tra(200, dongNguoiTrongDuAn(loc(du.thanhVien.filter((t) => duAnThay(t.du_an_id)), url.searchParams)))
      if (bang === 'task' && chon.includes('du_an!task_du_an_id_fkey(')) {
        // Lượt đọc Task theo id nhúng link và Dự án kèm Người trong dự án (ticket toi-uu-hieu-nang 04); nhúng theo
        // cùng phân quyền từng dòng. Bản giả không có link.
        return tra(
          200,
          loc(du.task.filter((t) => duAnThay(t.du_an_id)), url.searchParams).map((t) => {
            const duAn = du.duAn.find((d) => d.id === t.du_an_id && duAnThay(d.id))
            const nguoiTrong = du.thanhVien.filter((n) => n.du_an_id === t.du_an_id)
            return { ...t, lien_ket_task: [], du_an: duAn ? { ...duAn, nguoi_trong_du_an: nguoiTrong } : null }
          }),
        )
      }
      if (bang === 'task') return tra(200, loc(du.task.filter((t) => duAnThay(t.du_an_id)), url.searchParams))
      return tra(404, { code: 'PGRST205', message: `Không có bảng ${bang}` })
    }

    if ((bang === 'task' || bang === 'ho_so' || bang === 'nguoi_trong_du_an') && (phuongThuc === 'POST' || phuongThuc === 'PATCH')) {
      const thamSoLoc = [...url.searchParams].filter(([k]) => !['select', 'columns'].includes(k)).map(([k, v]) => `${k}=${v}`).join('&')
      du.lanGhi.push({ bang, phuongThuc, loc: thamSoLoc, than })
      const loi = du.loiGhi[bang]
      if (loi) return traLoi(loi)

      if (bang === 'task' && phuongThuc === 'POST') {
        if (!duAnQuanLy(than.du_an_id)) return traLoi({ code: 'P0001', message: 'KHONG_CO_QUYEN' })
        if (!CAC_MUC.has(than.muc_uu_tien ?? 'TRUNG_BINH')) {
          return traLoi({ code: '23514', message: 'new row for relation "task" violates check constraint "task_muc_uu_tien_hop_le"' })
        }
        const moi = taskGia(id(100 + du.task.length), String(than.du_an_id), { ...than, tao_boi: nguoiGoi?.id, tao_luc: GIO_MAY_CHU })
        du.task.push(moi)
        return tra(201, motDoiTuong ? moi : [moi])
      }
      if (bang === 'task') {
        const dich = loc(du.task.filter((t) => duAnQuanLy(t.du_an_id)), url.searchParams)
        for (const cu of dich) {
          if (!dangHoatDong(cu.du_an_id)) return traLoi({ code: 'P0001', message: 'DU_AN_DA_LUU_TRU' })
          if (cu.trang_thai === 'HOAN_THANH' || cu.trang_thai === 'HUY') return traLoi({ code: 'P0001', message: 'TASK_DA_CHOT' })
          if ('muc_uu_tien' in than && !CAC_MUC.has(than.muc_uu_tien)) {
            return traLoi({ code: '23514', message: 'new row for relation "task" violates check constraint "task_muc_uu_tien_hop_le"' })
          }
          // Trigger task_sau_khi_doi_muc_uu_tien: chỉ khi đổi sang mức khác.
          if ('muc_uu_tien' in than && than.muc_uu_tien !== cu.muc_uu_tien) {
            du.lichSuMucUuTien.push({ task_id: cu.id, nguoi_doi_id: nguoiGoi?.id, luc: GIO_MAY_CHU, tu: cu.muc_uu_tien, sang: than.muc_uu_tien })
          }
          Object.assign(cu, than, { sua_boi: nguoiGoi?.id, sua_luc: GIO_MAY_CHU })
        }
        return tra(200, dich)
      }
      if (bang === 'ho_so') {
        // ho_so_sua của lát 1: của mình hoặc PM; trigger chỉ cho chủ hồ sơ đổi Thông tin nhân sự.
        const dich = loc(du.hoSo.filter((h) => h.id === nguoiGoi?.id || laPM), url.searchParams)
        for (const cu of dich) {
          if (cu.id !== nguoiGoi?.id) return traLoi({ code: 'P0001', message: 'KHONG_CO_QUYEN' })
          Object.assign(cu, than)
        }
        return tra(200, dich.map((h) => chonCot(h, chon.split(','))))
      }
      // nguoi_trong_du_an: policy nguoi_trong_du_an_sua (PM, Support của Dự án), trigger chặn Dự án Lưu trữ.
      const dich = loc(du.thanhVien.filter((t) => duAnQuanLy(t.du_an_id)), url.searchParams)
      for (const cu of dich) {
        if (!dangHoatDong(cu.du_an_id)) return traLoi({ code: 'P0001', message: 'DU_AN_DA_LUU_TRU' })
        Object.assign(cu, than)
      }
      return tra(200, dongNguoiTrongDuAn(dich))
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

type TenNguoi = 'pm' | 'an' | 'binh' | 'chi' | 'ngoai'

interface BoiCanh {
  du: DuLieuGia
  kho: KhoDuLieu
  phien: Record<TenNguoi, Phien>
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

const loiHopLe = (loiTheoO: Record<string, string>): LoiKho => ({
  ma: 'KHONG_HOP_LE',
  thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE,
  loiTheoO,
})
const loiMa = (ma: MaLoi): LoiKho => ({ ma, thongBao: THONG_BAO_MAC_DINH[ma] })
const rangBuoc = (bang: string, ten: string): LoiCsdlGia => ({
  code: '23514',
  message: `new row for relation "${bang}" violates check constraint "${ten}"`,
})
const loiTrigger = (ma: string): LoiCsdlGia => ({ code: 'P0001', message: ma })
const LOI_QUYEN_COT: LoiCsdlGia = { code: '42501', message: 'permission denied for table x' }
const LOI_LA: LoiCsdlGia = { code: '57014', message: 'canceling statement due to statement timeout' }

// --- 1. Hành vi qua giao diện Kho, máy chủ là fetch giả ---

describe('Mức ưu tiên của Task trên bản Supabase, máy chủ là fetch giả', () => {
  it('tạo Task gửi Mức ưu tiên (không chọn thì Trung bình) và đọc lại đúng mức', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const dauVao = { tieuDe: 'Viết test', nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh }
    const cao = giaTri(await kho.taoTask(phien.chi, ID.duAn, { ...dauVao, mucUuTien: 'CAO' }, LUC))
    const macDinh = giaTri(await kho.taoTask(phien.pm, ID.duAn, dauVao, LUC))
    expect(du.lanGhi.map((l) => [l.bang, l.phuongThuc, l.than.muc_uu_tien])).toEqual([
      ['task', 'POST', 'CAO'],
      ['task', 'POST', 'TRUNG_BINH'],
    ])
    expect(cao.mucUuTien).toBe('CAO')
    expect(macDinh.mucUuTien).toBe('TRUNG_BINH')
    expect(giaTri(await kho.layTask(phien.an, cao.id)).mucUuTien).toBe('CAO')
    // Task có sẵn (Trung bình sau migration) đọc ra đúng mức.
    expect(giaTri(await kho.danhSachTask(phien.an, ID.duAn)).find((t) => t.id === ID.taskXong)?.mucUuTien).toBe('CAO')
  })

  it('đổi Mức ưu tiên: PM và Support của Dự án gửi đúng cột; client không tự ghi lịch sử; dòng lịch sử do cơ sở dữ liệu ghi đọc ra đúng', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const task = giaTri(await kho.suaTask(phien.chi, ID.task, { mucUuTien: 'CAO' }, LUC))
    expect(task.mucUuTien).toBe('CAO')
    expect(du.lanGhi).toEqual([{ bang: 'task', phuongThuc: 'PATCH', loc: `id=eq.${ID.task}`, than: { tieu_de: 'Làm trang chủ', muc_uu_tien: 'CAO' } }])
    giaTri(await kho.suaTask(phien.pm, ID.task, { mucUuTien: 'THAP' }, LUC))
    // Chỉ ghi bảng task; không gọi hàm hay ghi bảng lịch sử nào từ trình duyệt.
    expect(du.lanGhi.every((l) => l.bang === 'task')).toBe(true)
    expect(du.diaChi.filter((d) => /lich_su/.test(d) && !/rpc\/lich_su_task/.test(d))).toEqual([])

    expect(giaTri(await kho.lichSuTask(phien.an, ID.task))).toEqual([
      { loai: 'MUC_UU_TIEN', nguoiDoi: { id: ID.chi, tenHienThi: 'Chi' }, luc: new Date(GIO_MAY_CHU), tu: 'TRUNG_BINH', sang: 'CAO' },
      { loai: 'MUC_UU_TIEN', nguoiDoi: { id: ID.pm, tenHienThi: 'Pm' }, luc: new Date(GIO_MAY_CHU), tu: 'CAO', sang: 'THAP' },
    ])
  })

  it('sửa Task không gửi Mức ưu tiên thì không gửi cột đó (mức giữ nguyên); gửi đúng mức đang có thì cơ sở dữ liệu không ghi lịch sử', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    expect(giaTri(await kho.suaTask(phien.pm, ID.task, { tieuDe: 'Tiêu đề mới' }, LUC)).mucUuTien).toBe('TRUNG_BINH')
    expect(du.lanGhi[0]?.than).toEqual({ tieu_de: 'Tiêu đề mới' })
    giaTri(await kho.suaTask(phien.pm, ID.task, { mucUuTien: 'TRUNG_BINH' }, LUC))
    expect(giaTri(await kho.lichSuTask(phien.pm, ID.task))).toEqual([])
  })

  it('lịch sử Task: dòng trạng thái và dòng đổi mức cùng một dòng thời gian theo thời điểm; dòng trạng thái giữ lý do', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    du.lichSuTrangThai.push(
      { task_id: ID.task, nguoi_doi_id: ID.an, luc: '2026-06-01T04:00:00+00:00', tu: 'MOI', sang: 'DANG_LAM', ly_do: null },
      { task_id: ID.task, nguoi_doi_id: ID.chi, luc: '2026-06-03T04:00:00+00:00', tu: 'DANG_LAM', sang: 'HUY', ly_do: 'Không làm nữa' },
    )
    du.lichSuMucUuTien.push({ task_id: ID.task, nguoi_doi_id: ID.pm, luc: '2026-06-02T04:00:00+00:00', tu: 'TRUNG_BINH', sang: 'CAO' })
    expect(giaTri(await kho.lichSuTask(phien.an, ID.task))).toEqual([
      { loai: 'TRANG_THAI', nguoiDoi: { id: ID.an, tenHienThi: 'An' }, luc: new Date('2026-06-01T04:00:00+00:00'), tu: 'MOI', sang: 'DANG_LAM', lyDo: null },
      { loai: 'MUC_UU_TIEN', nguoiDoi: { id: ID.pm, tenHienThi: 'Pm' }, luc: new Date('2026-06-02T04:00:00+00:00'), tu: 'TRUNG_BINH', sang: 'CAO' },
      { loai: 'TRANG_THAI', nguoiDoi: { id: ID.chi, tenHienThi: 'Chi' }, luc: new Date('2026-06-03T04:00:00+00:00'), tu: 'DANG_LAM', sang: 'HUY', lyDo: 'Không làm nữa' },
    ])
  })

  it('quyền như bản bộ nhớ, kiểm trước khi gửi: Thành viên và Support ngoài Dự án KHONG_CO_QUYEN, Dự án Lưu trữ DU_AN_DA_LUU_TRU, Task đã chốt TASK_DA_CHOT, mức sai KHONG_HOP_LE ở ô Mức ưu tiên', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    expect(maLoi(await kho.suaTask(phien.an, ID.task, { mucUuTien: 'CAO' }, LUC))).toBe('KHONG_CO_QUYEN')
    expect(maLoi(await kho.suaTask(phien.binh, ID.task, { mucUuTien: 'CAO' }, LUC))).toBe('KHONG_CO_QUYEN')
    expect(maLoi(await kho.suaTask(phien.pm, ID.taskLuuTru, { mucUuTien: 'CAO' }, LUC))).toBe('DU_AN_DA_LUU_TRU')
    expect(maLoi(await kho.suaTask(phien.chi, ID.taskXong, { mucUuTien: 'THAP' }, LUC))).toBe('TASK_DA_CHOT')
    expect(loiCua(await kho.suaTask(phien.pm, ID.task, { mucUuTien: 'GAP' as never }, LUC))).toEqual(
      loiHopLe({ mucUuTien: THONG_BAO_MUC_UU_TIEN.sai }),
    )
    expect(du.lanGhi).toEqual([])
    expect(du.lichSuMucUuTien).toEqual([])
  })

  const CA_LOI_TASK: { ten: string; loi: LoiCsdlGia; mongDoi: LoiKho }[] = [
    { ten: 'ràng buộc Mức ưu tiên', loi: rangBuoc('task', 'task_muc_uu_tien_hop_le'), mongDoi: loiHopLe({ mucUuTien: THONG_BAO_MUC_UU_TIEN.sai }) },
    { ten: 'Task vừa bị chốt', loi: loiTrigger('TASK_DA_CHOT'), mongDoi: loiMa('TASK_DA_CHOT') },
    { ten: 'Dự án vừa bị Lưu trữ', loi: loiTrigger('DU_AN_DA_LUU_TRU'), mongDoi: loiMa('DU_AN_DA_LUU_TRU') },
    { ten: 'trigger từ chối quyền', loi: loiTrigger('KHONG_CO_QUYEN'), mongDoi: loiMa('KHONG_CO_QUYEN') },
    { ten: 'quyền cột hay phân quyền từng dòng', loi: LOI_QUYEN_COT, mongDoi: loiMa('KHONG_CO_QUYEN') },
    { ten: 'lỗi lạ của máy chủ', loi: LOI_LA, mongDoi: loiMa('LOI_HE_THONG') },
  ]

  it.each(CA_LOI_TASK)('đổi Mức ưu tiên, cơ sở dữ liệu từ chối ($ten): đổi về đúng lỗi có mã', async ({ loi, mongDoi }) => {
    const { du, kho, phien } = await dungBoiCanh()
    du.loiGhi.task = loi
    expect(loiCua(await kho.suaTask(phien.pm, ID.task, { mucUuTien: 'CAO' }, LUC))).toEqual(mongDoi)
    expect(du.lanGhi).toHaveLength(1)
  })

  it.each(CA_LOI_TASK.filter((ca) => ca.mongDoi.ma !== 'TASK_DA_CHOT'))('tạo Task, cơ sở dữ liệu từ chối ($ten): đổi về đúng lỗi có mã', async ({ loi, mongDoi }) => {
    const { du, kho, phien } = await dungBoiCanh()
    du.loiGhi.task = loi
    const kq = await kho.taoTask(phien.pm, ID.duAn, { tieuDe: 'X', nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh, mucUuTien: 'THAP' }, LUC)
    expect(loiCua(kq)).toEqual(mongDoi)
  })
})

describe('Thông tin nhân sự của hồ sơ trên bản Supabase, máy chủ là fetch giả', () => {
  it('sửa hồ sơ gửi ba trường đã chuẩn hoá (trống là null) và trả đúng ba trường cơ sở dữ liệu lưu; đọc lại thấy', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const hoSo = giaTri(
      await kho.suaHoSo(phien.an, ID.an, { soDienThoai: ' 0901.234-567 ', chucDanh: '  Trưởng nhóm ', phongBan: '   ' }),
    )
    expect(du.lanGhi).toEqual([
      {
        bang: 'ho_so',
        phuongThuc: 'PATCH',
        loc: `id=eq.${ID.an}`,
        than: { so_dien_thoai: '0901234567', chuc_danh: 'Trưởng nhóm', phong_ban: null },
      },
    ])
    expect(hoSo).toEqual({
      id: ID.an,
      email: 'an@vi-du.vn',
      tenHienThi: 'An',
      githubUsername: null,
      vai: 'THANH_VIEN',
      soDienThoai: '0901234567',
      chucDanh: 'Trưởng nhóm',
      phongBan: null,
    })
    expect(giaTri(await kho.layHoSoCuaToi(phien.an))).toEqual(hoSo)
    // Ô không gửi thì không gửi cột đó.
    du.lanGhi = []
    giaTri(await kho.suaHoSo(phien.an, ID.an, { phongBan: 'Phòng Dự án' }))
    expect(du.lanGhi[0]?.than).toEqual({ phong_ban: 'Phòng Dự án' })
  })

  it('chỉ chính chủ sửa: PM, Support, Thành viên sửa hộ người khác nhận KHONG_CO_QUYEN, không gửi gì lên; số sai dạng KHONG_HOP_LE ở ô, không gửi gì', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    for (const ai of [phien.pm, phien.chi, phien.an]) {
      expect(maLoi(await kho.suaHoSo(ai, ID.binh, { chucDanh: 'Sửa hộ' }))).toBe('KHONG_CO_QUYEN')
    }
    expect(loiCua(await kho.suaHoSo(phien.an, ID.an, { soDienThoai: '12345' }))).toEqual(
      loiHopLe({ soDienThoai: THONG_BAO_NHAN_SU.soDienThoaiSai }),
    )
    expect(du.lanGhi).toEqual([])
  })

  const CA_LOI_HO_SO: { ten: string; loi: LoiCsdlGia; mongDoi: LoiKho }[] = [
    { ten: 'ràng buộc dạng Số điện thoại', loi: rangBuoc('ho_so', 'ho_so_so_dien_thoai_hop_le'), mongDoi: loiHopLe({ soDienThoai: THONG_BAO_NHAN_SU.soDienThoaiSai }) },
    { ten: 'ràng buộc độ dài Chức danh', loi: rangBuoc('ho_so', 'ho_so_chuc_danh_hop_le'), mongDoi: loiHopLe({ chucDanh: THONG_BAO_NHAN_SU.chucDanhQuaDai }) },
    { ten: 'ràng buộc độ dài Phòng ban', loi: rangBuoc('ho_so', 'ho_so_phong_ban_hop_le'), mongDoi: loiHopLe({ phongBan: THONG_BAO_NHAN_SU.phongBanQuaDai }) },
    { ten: 'ràng buộc kiểm tra khác', loi: rangBuoc('ho_so', 'ho_so_khac'), mongDoi: { ma: 'KHONG_HOP_LE', thongBao: THONG_BAO_MAC_DINH.KHONG_HOP_LE } },
    { ten: 'trigger: không phải chủ hồ sơ', loi: loiTrigger('KHONG_CO_QUYEN'), mongDoi: loiMa('KHONG_CO_QUYEN') },
    { ten: 'quyền cột', loi: LOI_QUYEN_COT, mongDoi: loiMa('KHONG_CO_QUYEN') },
    { ten: 'lỗi lạ của máy chủ', loi: LOI_LA, mongDoi: loiMa('LOI_HE_THONG') },
  ]

  it.each(CA_LOI_HO_SO)('sửa hồ sơ, cơ sở dữ liệu từ chối ($ten): đổi về đúng lỗi có mã', async ({ loi, mongDoi }) => {
    const { du, kho, phien } = await dungBoiCanh()
    du.loiGhi.ho_so = loi
    expect(loiCua(await kho.suaHoSo(phien.an, ID.an, { soDienThoai: '0901234567', chucDanh: 'A', phongBan: 'B' }))).toEqual(mongDoi)
    expect(du.lanGhi).toHaveLength(1)
  })

  it('đọc: người cùng Dự án và PM thấy ba trường; danh sách Người dùng (PM) có ba trường; người không cùng Dự án nào không đọc ra được', async () => {
    const { kho, phien } = await dungBoiCanh()
    const binhTrong = (ds: readonly { id: string }[]) => ds.find((n) => n.id === ID.binh)
    const mongDoi = { soDienThoai: NHAN_SU_BINH.so_dien_thoai, chucDanh: NHAN_SU_BINH.chuc_danh, phongBan: NHAN_SU_BINH.phong_ban }
    expect(binhTrong(giaTri(await kho.danhSachNguoiTrongDuAn(phien.an, ID.duAn)))).toMatchObject(mongDoi)
    expect(binhTrong(giaTri(await kho.danhSachNguoiTrongDuAn(phien.pm, ID.duAn)))).toMatchObject(mongDoi)
    expect(binhTrong(giaTri(await kho.danhSachNguoiDung(phien.pm)))).toMatchObject(mongDoi)
    expect(maLoi(await kho.danhSachNguoiTrongDuAn(phien.ngoai, ID.duAn))).toBe('KHONG_TIM_THAY')
    expect(maLoi(await kho.danhSachNguoiDung(phien.ngoai))).toBe('KHONG_CO_QUYEN')
  })

  it('cơ sở dữ liệu trả ba trường trống (không đủ quyền xem): Kho trả trống đúng như bản bộ nhớ, các trường khác giữ nguyên', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    du.themNguoiAnNhanSu = true
    const nguoi = giaTri(await kho.themNguoiVaoDuAn(phien.pm, ID.duAn, { email: 'moi@vi-du.vn' }))
    const dayDu = {
      id: ID.moi,
      email: 'moi@vi-du.vn',
      tenHienThi: 'Moi',
      vai: 'THANH_VIEN' as const,
      soDienThoai: NHAN_SU_MOI.so_dien_thoai,
      chucDanh: NHAN_SU_MOI.chuc_danh,
      phongBan: NHAN_SU_MOI.phong_ban,
    }
    // Như bản bộ nhớ (`apQuyenXemNhanSu` với không đủ quyền): ba trường null, tên, email, vai không đổi.
    expect(nguoi).toEqual({ ...apQuyenXemNhanSu(dayDu, false), vaiTroTrongDuAn: null, soTaskDangGiu: 0 })
    // Đủ quyền thì cơ sở dữ liệu trả đủ ba trường và Kho trả nguyên.
    du.themNguoiAnNhanSu = false
    du.thanhVien = du.thanhVien.filter((t) => t.nguoi_dung_id !== ID.moi)
    expect(giaTri(await kho.themNguoiVaoDuAn(phien.pm, ID.duAn, { email: 'moi@vi-du.vn' }))).toEqual({
      ...apQuyenXemNhanSu(dayDu, true),
      vaiTroTrongDuAn: null,
      soTaskDangGiu: 0,
    })
  })

  it('cột Thông tin nhân sự thiếu hay null trong dòng trả về: Kho đọc thành trống', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const binh = du.hoSo.find((h) => h.id === ID.binh)
    if (binh) {
      delete binh.so_dien_thoai
      binh.chuc_danh = null
    }
    expect(giaTri(await kho.danhSachNguoiTrongDuAn(phien.an, ID.duAn)).find((n) => n.id === ID.binh)).toMatchObject({
      tenHienThi: 'Binh',
      soDienThoai: null,
      chucDanh: null,
      phongBan: NHAN_SU_BINH.phong_ban,
    })
  })
})

describe('Vai trò trong Dự án và Người trong dự án trên bản Supabase, máy chủ là fetch giả', () => {
  it('thêm người kèm vai trò là MỘT lệnh: đúng một lần gọi hàm them_nguoi_vao_du_an kèm vai trò đã cắt khoảng trắng, không ghi bảng riêng', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const nguoi = giaTri(await kho.themNguoiVaoDuAn(phien.chi, ID.duAn, { email: ' MOI@vi-du.vn ', vaiTroTrongDuAn: '  Kiểm thử chính ' }))
    expect(du.lanThemNguoi).toEqual([{ p_du_an_id: ID.duAn, p_email: 'moi@vi-du.vn', p_vai_tro: 'Kiểm thử chính' }])
    expect(du.lanGhi).toEqual([])
    expect(nguoi).toEqual({
      id: ID.moi,
      email: 'moi@vi-du.vn',
      tenHienThi: 'Moi',
      vai: 'THANH_VIEN',
      soDienThoai: NHAN_SU_MOI.so_dien_thoai,
      chucDanh: NHAN_SU_MOI.chuc_danh,
      phongBan: NHAN_SU_MOI.phong_ban,
      vaiTroTrongDuAn: 'Kiểm thử chính',
      soTaskDangGiu: 0,
    })
    // Không kèm vai trò (hay gửi trống): gửi null.
    du.lanThemNguoi = []
    du.thanhVien = du.thanhVien.filter((t) => t.nguoi_dung_id !== ID.moi)
    expect(giaTri(await kho.themNguoiVaoDuAn(phien.pm, ID.duAn, { email: 'moi@vi-du.vn', vaiTroTrongDuAn: '   ' })).vaiTroTrongDuAn).toBeNull()
    expect(du.lanThemNguoi).toEqual([{ p_du_an_id: ID.duAn, p_email: 'moi@vi-du.vn', p_vai_tro: null }])
  })

  it('thêm người: quyền, Lưu trữ và vai trò quá dài bị chặn trước khi gọi hàm, như bản bộ nhớ', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    expect(maLoi(await kho.themNguoiVaoDuAn(phien.an, ID.duAn, { email: 'moi@vi-du.vn' }))).toBe('KHONG_CO_QUYEN')
    expect(maLoi(await kho.themNguoiVaoDuAn(phien.pm, ID.duAnLuuTru, { email: 'moi@vi-du.vn' }))).toBe('DU_AN_DA_LUU_TRU')
    expect(
      loiCua(await kho.themNguoiVaoDuAn(phien.pm, ID.duAn, { email: 'moi@vi-du.vn', vaiTroTrongDuAn: 'x'.repeat(DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA + 1) })),
    ).toEqual(loiHopLe({ vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroQuaDai }))
    expect(du.lanThemNguoi).toEqual([])
  })

  const CA_LOI_THEM: { ten: string; loi: LoiCsdlGia; mongDoi: LoiKho }[] = [
    { ten: 'hàm ném KHONG_HOP_LE (vai trò quá dài)', loi: loiTrigger('KHONG_HOP_LE'), mongDoi: loiHopLe({ vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroQuaDai }) },
    { ten: 'ràng buộc vai trò', loi: rangBuoc('nguoi_trong_du_an', 'nguoi_trong_du_an_vai_tro_hop_le'), mongDoi: loiHopLe({ vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroQuaDai }) },
    { ten: 'email chưa đăng ký', loi: loiTrigger('CHUA_DANG_KY'), mongDoi: { ...loiMa('CHUA_DANG_KY'), loiTheoO: { email: THONG_BAO_MAC_DINH.CHUA_DANG_KY } } },
    { ten: 'đã ở trong Dự án', loi: loiTrigger('DA_TRONG_DU_AN'), mongDoi: { ...loiMa('DA_TRONG_DU_AN'), loiTheoO: { email: THONG_BAO_MAC_DINH.DA_TRONG_DU_AN } } },
    { ten: 'Dự án vừa bị Lưu trữ', loi: loiTrigger('DU_AN_DA_LUU_TRU'), mongDoi: loiMa('DU_AN_DA_LUU_TRU') },
    { ten: 'không có quyền', loi: loiTrigger('KHONG_CO_QUYEN'), mongDoi: loiMa('KHONG_CO_QUYEN') },
    { ten: 'lỗi lạ của máy chủ', loi: LOI_LA, mongDoi: loiMa('LOI_HE_THONG') },
  ]

  it.each(CA_LOI_THEM)('thêm người, cơ sở dữ liệu từ chối ($ten): đổi về đúng lỗi có mã', async ({ loi, mongDoi }) => {
    const { du, kho, phien } = await dungBoiCanh()
    du.loiGhi.them_nguoi_vao_du_an = loi
    expect(loiCua(await kho.themNguoiVaoDuAn(phien.pm, ID.duAn, { email: 'moi@vi-du.vn', vaiTroTrongDuAn: 'Kiểm thử' }))).toEqual(mongDoi)
    expect(du.lanThemNguoi).toHaveLength(1)
  })

  it('email chưa đăng ký và người đã ở trong Dự án: đúng lỗi có mã ở ô email như bản bộ nhớ', async () => {
    const { kho, phien } = await dungBoiCanh()
    expect(loiCua(await kho.themNguoiVaoDuAn(phien.pm, ID.duAn, { email: 'chua-co@vi-du.vn' }))).toEqual({
      ...loiMa('CHUA_DANG_KY'),
      loiTheoO: { email: THONG_BAO_MAC_DINH.CHUA_DANG_KY },
    })
    expect(loiCua(await kho.themNguoiVaoDuAn(phien.pm, ID.duAn, { email: 'binh@vi-du.vn' }))).toEqual({
      ...loiMa('DA_TRONG_DU_AN'),
      loiTheoO: { email: THONG_BAO_MAC_DINH.DA_TRONG_DU_AN },
    })
  })

  it('sửa vai trò: PM và Support của Dự án gửi đúng một cột cho đúng cặp (Dự án, tài khoản); trống là xoá; trả Người trong dự án đầy đủ', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    const binh = giaTri(await kho.suaVaiTroTrongDuAn(phien.chi, ID.duAn, ID.binh, { vaiTroTrongDuAn: '  Phân tích ' }))
    expect(du.lanGhi).toEqual([
      { bang: 'nguoi_trong_du_an', phuongThuc: 'PATCH', loc: `du_an_id=eq.${ID.duAn}&nguoi_dung_id=eq.${ID.binh}`, than: { vai_tro: 'Phân tích' } },
    ])
    expect(binh).toEqual({
      id: ID.binh,
      email: 'binh@vi-du.vn',
      tenHienThi: 'Binh',
      vai: 'THANH_VIEN',
      soDienThoai: NHAN_SU_BINH.so_dien_thoai,
      chucDanh: NHAN_SU_BINH.chuc_danh,
      phongBan: NHAN_SU_BINH.phong_ban,
      vaiTroTrongDuAn: 'Phân tích',
      soTaskDangGiu: 1,
    })
    expect(giaTri(await kho.suaVaiTroTrongDuAn(phien.pm, ID.duAn, ID.an, { vaiTroTrongDuAn: '' })).vaiTroTrongDuAn).toBeNull()
    expect(du.lanGhi[1]?.than).toEqual({ vai_tro: null })
  })

  it('sửa vai trò: quyền và Lưu trữ chặn trước khi gửi; người không ở trong Dự án KHONG_TIM_THAY như bản bộ nhớ', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    expect(maLoi(await kho.suaVaiTroTrongDuAn(phien.an, ID.duAn, ID.an, { vaiTroTrongDuAn: 'Tự đặt' }))).toBe('KHONG_CO_QUYEN')
    expect(maLoi(await kho.suaVaiTroTrongDuAn(phien.pm, ID.duAnLuuTru, ID.an, { vaiTroTrongDuAn: 'X' }))).toBe('DU_AN_DA_LUU_TRU')
    expect(du.lanGhi).toEqual([])
    const khongTrong: LoiKho = { ma: 'KHONG_TIM_THAY', thongBao: THONG_BAO_DU_AN.khongTrongDuAn }
    expect(loiCua(await kho.suaVaiTroTrongDuAn(phien.pm, ID.duAn, ID.ngoai, { vaiTroTrongDuAn: 'X' }))).toEqual(khongTrong)
    expect(loiCua(await kho.suaVaiTroTrongDuAn(phien.pm, ID.duAn, 'khong-phai-uuid', { vaiTroTrongDuAn: 'X' }))).toEqual(khongTrong)
  })

  const CA_LOI_SUA_VAI_TRO: { ten: string; loi: LoiCsdlGia; mongDoi: LoiKho }[] = [
    { ten: 'ràng buộc vai trò', loi: rangBuoc('nguoi_trong_du_an', 'nguoi_trong_du_an_vai_tro_hop_le'), mongDoi: loiHopLe({ vaiTroTrongDuAn: THONG_BAO_DU_AN.vaiTroQuaDai }) },
    { ten: 'Dự án vừa bị Lưu trữ', loi: loiTrigger('DU_AN_DA_LUU_TRU'), mongDoi: loiMa('DU_AN_DA_LUU_TRU') },
    { ten: 'trigger từ chối quyền', loi: loiTrigger('KHONG_CO_QUYEN'), mongDoi: loiMa('KHONG_CO_QUYEN') },
    { ten: 'quyền cột', loi: LOI_QUYEN_COT, mongDoi: loiMa('KHONG_CO_QUYEN') },
    { ten: 'lỗi lạ của máy chủ', loi: LOI_LA, mongDoi: loiMa('LOI_HE_THONG') },
  ]

  it.each(CA_LOI_SUA_VAI_TRO)('sửa vai trò, cơ sở dữ liệu từ chối ($ten): đổi về đúng lỗi có mã', async ({ loi, mongDoi }) => {
    const { du, kho, phien } = await dungBoiCanh()
    du.loiGhi.nguoi_trong_du_an = loi
    expect(loiCua(await kho.suaVaiTroTrongDuAn(phien.pm, ID.duAn, ID.binh, { vaiTroTrongDuAn: 'Phân tích' }))).toEqual(mongDoi)
    expect(du.lanGhi).toHaveLength(1)
  })

  it('danh sách Người trong dự án: đủ tên, email, vai, Thông tin nhân sự, Vai trò trong Dự án và số Task đang giữ (chỉ Task chưa chốt mà người đó là Người thực hiện)', async () => {
    const { kho, phien } = await dungBoiCanh()
    const ds = giaTri(await kho.danhSachNguoiTrongDuAn(phien.binh, ID.duAn))
    expect(ds.map((n) => [n.tenHienThi, n.vaiTroTrongDuAn, n.soTaskDangGiu])).toEqual([
      ['An', 'Trưởng nhóm', 1],
      ['Binh', null, 1],
      ['Chi', null, 0],
    ])
    expect(ds[1]).toEqual({
      id: ID.binh,
      email: 'binh@vi-du.vn',
      tenHienThi: 'Binh',
      vai: 'THANH_VIEN',
      soDienThoai: NHAN_SU_BINH.so_dien_thoai,
      chucDanh: NHAN_SU_BINH.chuc_danh,
      phongBan: NHAN_SU_BINH.phong_ban,
      vaiTroTrongDuAn: null,
      soTaskDangGiu: 1,
    })
    // Vai trò thuộc từng Dự án: An có vai trò khác ở Dự án đã Lưu trữ (vẫn đọc được).
    expect(giaTri(await kho.danhSachNguoiTrongDuAn(phien.an, ID.duAnLuuTru)).find((n) => n.id === ID.an)?.vaiTroTrongDuAn).toBe('Lập trình')
  })

  it('mọi yêu cầu chỉ tới máy chủ giả, không ra mạng', async () => {
    const { du, kho, phien } = await dungBoiCanh()
    giaTri(await kho.danhSachNguoiTrongDuAn(phien.pm, ID.duAn))
    expect(du.diaChi.length).toBeGreaterThan(0)
    for (const diaChi of du.diaChi) expect(new URL(diaChi).origin).toBe(URL_GIA)
  })
})

// --- 2. Cấu trúc file migration (không chạy SQL) ---

/** Bỏ chú thích `-- ...` để không khớp nhầm lời giải thích. */
function boChuThich(sql: string): string {
  return sql.replace(/--.*$/gm, '')
}

const SQL = boChuThich(migrationLen)
const SQL_XUONG = boChuThich(migrationXuong)
const SQL_LAT_1 = boChuThich(migrationLat1)
const SQL_LAT_3 = boChuThich(migrationLat3)

/** Thân một hàm (giữa hai dấu `$$`) theo tên, trong `create [or replace] function <ten>(`. */
function thanHam(sql: string, ten: string): string {
  const khop = new RegExp(`create (?:or replace )?function ${ten.replace('.', '\\.')}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$`, 'i').exec(sql)
  if (!khop) throw new Error(`Không tìm thấy hàm ${ten}`)
  return khop[1].replace(/\s+/g, ' ').trim()
}

/** Phần khai báo hàm (tham số, kiểu trả về) từ `create function <ten>(` tới `as $$`. */
function khaiBaoHam(sql: string, ten: string): string {
  const khop = new RegExp(`create (?:or replace )?function ${ten.replace('.', '\\.')}(\\([\\s\\S]*?)as \\$\\$`, 'i').exec(sql)
  if (!khop) throw new Error(`Không tìm thấy hàm ${ten}`)
  return khop[1].replace(/\s+/g, ' ').trim()
}

/** Cột trong mọi câu `grant <quyen> (cột, ...) on table public.<bang> to authenticated`. */
function cotDuocCap(sql: string, quyen: 'insert' | 'update', bang: string): string[] {
  const mau = new RegExp(`grant\\s+${quyen}\\s*\\(([^)]*)\\)\\s+on\\s+table\\s+public\\.${bang}\\s+to\\s+authenticated`, 'gi')
  return [...sql.matchAll(mau)].flatMap((m) => m[1].split(',').map((c) => c.trim()))
}

const MUC_SQL = `(${CAC_MUC_UU_TIEN.map((m) => `'${m}'`).join(', ')})`

describe('migration Task, hồ sơ và Người trong dự án: cấu trúc file, không chạy SQL', () => {
  it('Task: cột muc_uu_tien mặc định TRUNG_BINH (Task có sẵn nhận Trung bình), ràng buộc đúng ba mức của luật thuần, quyền cột chỉ thêm muc_uu_tien', () => {
    expect(SQL).toMatch(/alter table public\.task\s+add column muc_uu_tien text not null default 'TRUNG_BINH';/i)
    expect(SQL).toContain(`add constraint task_muc_uu_tien_hop_le check (muc_uu_tien in ${MUC_SQL})`)
    expect(cotDuocCap(SQL, 'insert', 'task')).toEqual(['muc_uu_tien'])
    expect(cotDuocCap(SQL, 'update', 'task')).toEqual(['muc_uu_tien'])
    // Quyền sửa Task giữ nguyên: không thay trigger task_truoc_khi_sua hay policy của Task.
    expect(SQL).not.toMatch(/function rieng\.task_truoc_khi_sua/i)
    expect(SQL).not.toMatch(/create policy \w+ on public\.task\b/i)
  })

  it('đổi Mức ưu tiên ghi lịch sử ở phía cơ sở dữ liệu: trigger AFTER UPDATE OF muc_uu_tien chỉ khi mức khác, ghi người gọi, lúc, từ, sang', () => {
    expect(SQL).toMatch(
      /create trigger task_sau_khi_doi_muc_uu_tien\s+after update of muc_uu_tien on public\.task\s+for each row\s+when \(old\.muc_uu_tien is distinct from new\.muc_uu_tien\)\s+execute function rieng\.task_sau_khi_doi_muc_uu_tien\(\)/i,
    )
    const ham = thanHam(SQL, 'rieng.task_sau_khi_doi_muc_uu_tien')
    expect(ham).toContain(
      'insert into public.lich_su_muc_uu_tien_task (task_id, nguoi_doi_id, luc, tu, sang) values (new.id, auth.uid(), now(), old.muc_uu_tien, new.muc_uu_tien);',
    )
    expect(SQL).toContain(`tu in ${MUC_SQL} and sang in ${MUC_SQL} and tu <> sang`)
    // Bảng lịch sử: bật RLS, đọc theo quyền xem Task, client không ghi được.
    expect(SQL).toMatch(/alter table public\.lich_su_muc_uu_tien_task enable row level security/i)
    expect(SQL).toMatch(/create policy lich_su_muc_uu_tien_doc on public\.lich_su_muc_uu_tien_task\s+for select to authenticated\s+using \(rieng\.duoc_xem_task\(task_id\)\)/i)
    expect(SQL).toMatch(/revoke all on table public\.lich_su_muc_uu_tien_task from public, anon, authenticated/i)
    expect(SQL).not.toMatch(/grant\s+(insert|update|delete|all)[^;]*public\.lich_su_muc_uu_tien_task\s+to\s+[^;]*authenticated/i)
    expect(SQL).toMatch(/create trigger lich_su_muc_uu_tien_truoc_khi_sua\s+before update on public\.lich_su_muc_uu_tien_task/i)
  })

  it('lich_su_task trả cột loai và gộp lịch sử trạng thái với lịch sử Mức ưu tiên theo thời điểm; vẫn chỉ cho người thấy Task', () => {
    expect(khaiBaoHam(SQL, 'public.lich_su_task')).toContain(
      'returns table (stt bigint, loai text, nguoi_doi_id uuid, ten_hien_thi text, luc timestamptz, tu text, sang text, ly_do text)',
    )
    const ham = thanHam(SQL, 'public.lich_su_task')
    expect(ham).toContain("'TRANG_THAI'::text as loai")
    expect(ham).toContain("'MUC_UU_TIEN'::text")
    expect(ham).toContain('from public.lich_su_trang_thai_task l')
    expect(ham).toContain('from public.lich_su_muc_uu_tien_task m')
    expect(ham).toContain('order by x.luc, x.thu_tu_loai, x.stt_goc')
    expect(ham).toContain("if not rieng.duoc_xem_task(p_task_id) then raise exception 'KHONG_TIM_THAY';")
    expect(SQL.search(/drop function public\.lich_su_task\(uuid\)/i)).toBeLessThan(SQL.search(/create function public\.lich_su_task\(/i))
  })

  it('hồ sơ: ba cột, dạng Số điện thoại trong SQL nhận đúng những số luật thuần nhận; độ dài 60 như luật thuần', () => {
    expect(SQL).toMatch(/alter table public\.ho_so\s+add column so_dien_thoai text,\s+add column chuc_danh text,\s+add column phong_ban text;/i)
    const dang = /so_dien_thoai ~ '([^']+)'/.exec(SQL)?.[1]
    expect(dang).toBeDefined()
    const bieuThuc = new RegExp(dang ?? '$^')
    for (const so of ['0901234567', '+84901234567', '090123456', '09012345678', '+8490123456', '84901234567', '1901234567', '0901 234 567', 'abcdefghij']) {
      // Cơ sở dữ liệu lưu dạng đã chuẩn hoá: số hợp lệ sau chuẩn hoá phải qua ràng buộc, số sai dạng thì không.
      const chuan = chuanHoaSoDienThoai(so)
      expect(bieuThuc.test(so), so).toBe(chuan === so)
    }
    expect(SQL).toContain(`char_length(chuc_danh) between 1 and ${DO_DAI_CHUC_DANH_TOI_DA}`)
    expect(SQL).toContain(`char_length(phong_ban) between 1 and ${DO_DAI_PHONG_BAN_TOI_DA}`)
    // Tên ràng buộc mà bản cài đổi lỗi đều là ràng buộc thật của migration.
    for (const ten of ['ho_so_so_dien_thoai_hop_le', 'ho_so_chuc_danh_hop_le', 'ho_so_phong_ban_hop_le', 'nguoi_trong_du_an_vai_tro_hop_le', 'task_muc_uu_tien_hop_le']) {
      expect(SQL, ten).toMatch(new RegExp(`add constraint ${ten}\\b`))
    }
  })

  it('hồ sơ: chỉ chính chủ sửa ba trường (trigger thay bản lát 1, giữ mọi luật cũ); quyền cột chỉ thêm ba cột; không thêm policy hay quyền đọc', () => {
    const moi = thanHam(SQL, 'rieng.ho_so_truoc_khi_sua')
    const cu = thanHam(SQL_LAT_1, 'rieng.ho_so_truoc_khi_sua')
    const khoiChinhChu = /if \(([\s\S]*?)\) and old\.id <> v_nguoi_goi then raise exception 'KHONG_CO_QUYEN'/.exec(moi)?.[1] ?? ''
    for (const cot of ['ten_hien_thi', 'github_username', 'so_dien_thoai', 'chuc_danh', 'phong_ban']) {
      expect(khoiChinhChu, cot).toContain(`new.${cot} is distinct from old.${cot}`)
    }
    // Mọi câu lệnh của bản lát 1 (trừ điều kiện chính chủ vừa mở rộng) vẫn còn nguyên.
    for (const cau of ["raise exception 'PHAI_CON_PM'", 'not rieng.la_pm()', "pg_advisory_xact_lock(hashtext('public.ho_so.vai_pm'))", 'new.sua_luc := now();']) {
      expect(cu).toContain(cau)
      expect(moi).toContain(cau)
    }
    expect(cotDuocCap(SQL, 'update', 'ho_so')).toEqual(['so_dien_thoai', 'chuc_danh', 'phong_ban'])
    expect(SQL).not.toMatch(/on public\.ho_so\b[^;]*for select/i)
    expect(SQL).not.toMatch(/policy \w+ on public\.ho_so/i)
    expect(SQL).not.toMatch(/grant\s+select[^;]*public\.ho_so\b/i)
  })

  it('quyền xem Thông tin nhân sự: hàm SQL có đúng bốn điều kiện của luật thuần; them_nguoi_vao_du_an trả null khi không đủ quyền', () => {
    const ham = thanHam(SQL, 'rieng.duoc_xem_thong_tin_nhan_su')
    expect(ham).toContain('p_nguoi_dung_id = auth.uid()')
    expect(ham).toContain("rieng.vai_cua_toi() in ('PM', 'SUPPORT')")
    // Cùng ít nhất một Dự án, mọi trạng thái (không lọc trạng thái Dự án).
    expect(ham).toMatch(/join public\.nguoi_trong_du_an cua_nguoi_kia on cua_nguoi_kia\.du_an_id = cua_toi\.du_an_id/)
    expect(ham).not.toMatch(/trang_thai|du_an_dang_hoat_dong/)
    const them = thanHam(SQL, 'public.them_nguoi_vao_du_an')
    expect(them).toContain('v_xem_nhan_su := rieng.duoc_xem_thong_tin_nhan_su(v_dich.id);')
    for (const cot of ['so_dien_thoai', 'chuc_danh', 'phong_ban']) {
      expect(them).toContain(`'${cot}', case when v_xem_nhan_su then v_dich.${cot} end`)
    }
  })

  it('quyền xem Thông tin nhân sự: mọi hồ sơ mà phân quyền từng dòng ho_so_doc (lát 1) cho đọc đều là hồ sơ luật thuần cho xem ba trường', () => {
    // Lập luận của phần 3 trong migration dựa trên đúng policy và hàm này của lát 1.
    expect(SQL_LAT_1).toMatch(/create policy ho_so_doc on public\.ho_so\s+for select to authenticated\s+using \(id = auth\.uid\(\) or rieng\.la_pm\(\) or rieng\.thay_ho_so\(id\)\);/)
    expect(thanHam(SQL_LAT_1, 'rieng.thay_ho_so')).toBe(
      'select exists ( select 1 from public.nguoi_trong_du_an n where n.nguoi_dung_id = p_nguoi_dung_id and rieng.duoc_xem_du_an(n.du_an_id) )',
    )
    expect(thanHam(SQL_LAT_1, 'rieng.duoc_xem_du_an')).toBe('select rieng.la_pm() or rieng.o_trong_du_an(p_du_an_id)')
    // Mô hình của ho_so_doc, so với luật thuần trên mọi tổ hợp vai và Dự án (hai Dự án, mọi trạng thái).
    const tapCon = (ds: readonly string[]) => ds.reduce<string[][]>((acc, x) => [...acc, ...acc.map((t) => [...t, x])], [[]])
    for (const vai of ['PM', 'SUPPORT', 'THANH_VIEN'] as VaiHeThong[]) {
      for (const cuaToi of tapCon(['A', 'B'])) {
        for (const cuaNguoiKia of tapCon(['A', 'B'])) {
          for (const chinhChu of [true, false]) {
            // ho_so_doc: của mình, PM, hoặc rieng.thay_ho_so: người kia ở trong một Dự án người gọi thấy được
            // (duoc_xem_du_an = PM hoặc ở trong Dự án đó).
            const laPM = vai === 'PM'
            const thayDuAn = (d: string) => laPM || cuaToi.includes(d)
            const hoSoDoc = chinhChu || laPM || cuaNguoiKia.some(thayDuAn)
            const duocXem = duocXemThongTinNhanSu({
              nguoiGoiId: 'toi',
              vaiNguoiGoi: vai,
              chuHoSoId: chinhChu ? 'toi' : 'nguoi-kia',
              duAnCuaNguoiGoi: cuaToi,
              duAnCuaChuHoSo: chinhChu ? cuaToi : cuaNguoiKia,
            })
            if (hoSoDoc) expect(duocXem, JSON.stringify({ vai, cuaToi, cuaNguoiKia, chinhChu })).toBe(true)
          }
        }
      }
    }
  })

  it('Vai trò trong Dự án: cột, ràng buộc 60 ký tự như luật thuần; chỉ PM và Support của Dự án sửa (policy mới), Dự án chưa Lưu trữ (trigger); quyền cột chỉ vai_tro', () => {
    expect(SQL).toMatch(/alter table public\.nguoi_trong_du_an\s+add column vai_tro text;/i)
    expect(SQL).toContain(`char_length(vai_tro) between 1 and ${DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA}`)
    expect(SQL).toMatch(
      /create policy nguoi_trong_du_an_sua on public\.nguoi_trong_du_an\s+for update to authenticated\s+using \(rieng\.duoc_quan_ly_du_an\(du_an_id\)\)\s+with check \(rieng\.duoc_quan_ly_du_an\(du_an_id\)\);/i,
    )
    expect(cotDuocCap(SQL, 'update', 'nguoi_trong_du_an')).toEqual(['vai_tro'])
    expect(cotDuocCap(SQL, 'insert', 'nguoi_trong_du_an')).toEqual([])
    const trigger = thanHam(SQL, 'rieng.nguoi_trong_du_an_truoc_khi_sua')
    expect(trigger.indexOf("'KHONG_CO_QUYEN'")).toBeGreaterThan(0)
    expect(trigger.indexOf("'KHONG_CO_QUYEN'")).toBeLessThan(trigger.indexOf("'DU_AN_DA_LUU_TRU'"))
    expect(trigger).toContain("new.vai_tro := nullif(btrim(normalize(new.vai_tro, NFC)), '');")
    expect(SQL).toMatch(/create trigger nguoi_trong_du_an_truoc_khi_sua\s+before update on public\.nguoi_trong_du_an/i)
  })

  it('thêm người kèm vai trò là một lệnh: bỏ hàm hai tham số, hàm mới nhận p_vai_tro và ghi vai trò ngay trong câu insert; thứ tự lỗi như bản bộ nhớ', () => {
    expect(SQL.search(/drop function public\.them_nguoi_vao_du_an\(uuid, text\);/i)).toBeLessThan(SQL.search(/create function public\.them_nguoi_vao_du_an\(/i))
    expect(khaiBaoHam(SQL, 'public.them_nguoi_vao_du_an')).toMatch(/^\(p_du_an_id uuid, p_email text, p_vai_tro text default null\) returns jsonb/)
    const ham = thanHam(SQL, 'public.them_nguoi_vao_du_an')
    expect(ham).toContain('insert into public.nguoi_trong_du_an (du_an_id, nguoi_dung_id, vai_tro) values (p_du_an_id, v_dich.id, v_vai_tro)')
    expect(ham).toContain(`if char_length(v_vai_tro) > ${DO_DAI_VAI_TRO_TRONG_DU_AN_TOI_DA} then raise exception 'KHONG_HOP_LE'`)
    const thuTu = ['CHUA_DANG_NHAP', 'KHONG_CO_QUYEN', 'KHONG_TIM_THAY', 'DU_AN_DA_LUU_TRU', 'KHONG_HOP_LE', 'CHUA_DANG_KY', 'DA_TRONG_DU_AN'].map((ma) =>
      ham.indexOf(`raise exception '${ma}'`),
    )
    expect(thuTu.every((viTri) => viTri >= 0)).toBe(true)
    expect(thuTu).toEqual([...thuTu].sort((a, b) => a - b))
    expect(ham).toContain("'vai_tro', v_vai_tro")
    expect(SQL).toMatch(/grant execute on function\s+public\.lich_su_task\(uuid\),\s+public\.them_nguoi_vao_du_an\(uuid, text, text\)\s+to authenticated, service_role/i)
  })

  it('mọi mã lỗi migration ném là mã của Kho; không mở gì cho anon hay public; hàm hỗ trợ và trigger không mở cho client', () => {
    for (const m of SQL.matchAll(/raise exception '([A-Z_]+)'/g)) expect(Object.keys(THONG_BAO_MAC_DINH)).toContain(m[1])
    expect(SQL).not.toMatch(/\bto\s+(anon|public)\b/i)
    expect(SQL).not.toMatch(/grant\s+[^;]*\bto\s+[^;]*\banon\b/i)
    const hamRieng = [...SQL.matchAll(/create function (rieng\.[a-z_]+)\(/gi)].map((m) => m[1])
    expect(hamRieng.length).toBe(4)
    const thuHoi = /revoke all on function\s+([^;]*?)\s+from public, anon, authenticated;/i.exec(SQL)?.[1] ?? ''
    for (const ten of hamRieng) expect(thuHoi, ten).toContain(`${ten}(`)
    for (const bang of ['task', 'ho_so', 'nguoi_trong_du_an']) {
      expect(SQL).not.toMatch(new RegExp(`grant\\s+(all|insert|update|delete|select)\\s+on\\s+table\\s+public\\.${bang}\\b`, 'i'))
    }
  })

  it('bản xuống bỏ đủ cột, ràng buộc, bảng, trigger, hàm, policy; trả các hàm về đúng bản lát 1 và lát 3 trước khi bỏ cột', () => {
    for (const cot of ['muc_uu_tien', 'so_dien_thoai', 'chuc_danh', 'phong_ban', 'vai_tro']) {
      expect(SQL_XUONG).toMatch(new RegExp(`drop column if exists ${cot}\\b`))
    }
    for (const m of SQL.matchAll(/add constraint ([a-z_]+)/g)) expect(SQL_XUONG).toMatch(new RegExp(`drop constraint if exists ${m[1]}\\b`))
    expect(SQL_XUONG).toMatch(/drop table if exists public\.lich_su_muc_uu_tien_task/)
    for (const m of SQL.matchAll(/create trigger ([a-z_]+)\s/g)) {
      if (m[1] === 'lich_su_muc_uu_tien_truoc_khi_sua') continue // mất theo bảng
      expect(SQL_XUONG).toMatch(new RegExp(`drop trigger if exists ${m[1]}\\b`))
    }
    for (const m of SQL.matchAll(/create function (rieng\.[a-z_]+)\(/g)) {
      expect(SQL_XUONG).toMatch(new RegExp(`drop function if exists ${m[1].replace('.', '\\.')}\\(`))
    }
    expect(SQL_XUONG).toMatch(/drop policy if exists nguoi_trong_du_an_sua on public\.nguoi_trong_du_an/)
    expect(SQL_XUONG).toMatch(/drop function if exists public\.them_nguoi_vao_du_an\(uuid, text, text\)/)
    // Hàm trả về đúng bản cũ, cùng quyền gọi.
    for (const [ham, goc] of [
      ['rieng.ho_so_truoc_khi_sua', SQL_LAT_1],
      ['public.them_nguoi_vao_du_an', SQL_LAT_1],
      ['public.lich_su_task', SQL_LAT_3],
    ] as const) {
      expect(thanHam(SQL_XUONG, ham), ham).toBe(thanHam(goc, ham))
      expect(khaiBaoHam(SQL_XUONG, ham), ham).toBe(khaiBaoHam(goc, ham))
    }
    expect(SQL_XUONG).toMatch(/grant execute on function public\.them_nguoi_vao_du_an\(uuid, text\) to authenticated, service_role/)
    expect(SQL_XUONG).toMatch(/grant execute on function public\.lich_su_task\(uuid\) to authenticated, service_role/)
    // Hàm đọc cột sắp bỏ được trả về trước khi bỏ cột hay bảng.
    expect(SQL_XUONG.search(/function rieng\.ho_so_truoc_khi_sua\(/)).toBeLessThan(SQL_XUONG.search(/drop column if exists so_dien_thoai/))
    expect(SQL_XUONG.search(/create function public\.lich_su_task\(/)).toBeLessThan(SQL_XUONG.search(/drop table if exists public\.lich_su_muc_uu_tien_task/))
    expect(SQL_XUONG.search(/create function public\.them_nguoi_vao_du_an\(/)).toBeLessThan(SQL_XUONG.search(/drop column if exists vai_tro/))
  })
})

// --- 3. Bộ test chạy tay trên Supabase thật ---

describe('bộ test hợp đồng và bảng ca chạy tay trên Supabase thật có ca cho các trường và quyền mới', () => {
  it('chạy bộ hợp đồng Mức ưu tiên của Task, Thông tin nhân sự, Vai trò trong Dự án và bảng ca quyền cho bản Supabase (cổng không chạy file đó)', () => {
    for (const bo of ['chayHopDongMucUuTienTask', 'chayHopDongThongTinNhanSu', 'chayHopDongVaiTroTrongDuAn', 'chayBangCaQuyen']) {
      expect(boTestSupabaseThat).toMatch(new RegExp(`\\n\\s+${bo}\\('bản Supabase', taoBanCai, tuyChon\\)`))
    }
  })

  it('bảng ca quyền dùng chung có ca cho quyền xem Thông tin nhân sự, đổi Mức ưu tiên của Task và sửa Vai trò trong Dự án, đủ ba vai, trong và ngoài Dự án, hai trạng thái Dự án', () => {
    for (const hanhDong of ['XEM_THONG_TIN_NHAN_SU', 'DOI_MUC_UU_TIEN_TASK', 'SUA_VAI_TRO_TRONG_DU_AN']) {
      const ca = BANG_CA_QUYEN.filter((c) => c.hanhDong === hanhDong)
      expect(ca, hanhDong).toHaveLength(12)
      expect(new Set(ca.map((c) => `${c.vai}|${c.trongDuAn}|${c.trangThaiDuAn}`)).size).toBe(12)
    }
  })
})
