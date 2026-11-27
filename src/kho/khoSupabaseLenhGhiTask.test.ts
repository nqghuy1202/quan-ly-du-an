// Lệnh ghi Task của bản Supabase trong 3 lượt gọi (ticket toi-uu-hieu-nang 06), không cần mạng hay DB: máy chủ là một
// `fetch` giả trong bộ nhớ đóng vai PostgREST, ghi lại mọi địa chỉ được gọi để đếm lượt.
//
// Một lượt gọi là một yêu cầu tới PostgREST (`/rest/v1/`: đọc bảng hoặc gọi hàm); không tính Auth (`/auth/v1/`:
// đăng nhập, làm mới phiên), đúng cách đếm của spec `.scratch/toi-uu-hieu-nang/spec.md`. Lệnh: tạo Task, sửa Task,
// đổi người của Task, đổi trạng thái Task (kể cả kéo thả trên Kanban: cùng lệnh), thêm link, gỡ link.
//
// `fetch` giả bắt chước thô những gì migration hứa (supabase/migrations/): phân quyền từng dòng (PM thấy và quản lý
// mọi Dự án; Support quản lý Dự án mình ở trong; người khác chỉ thấy Dự án mình ở trong; Task, link theo Dự án),
// nhúng bảng theo khoá ngoại (kể cả nhúng lồng, phải gọi đúng tên khoá giữa du_an và nguoi_trong_du_an), trigger
// task_truoc_khi_tao và task_truoc_khi_sua (quyền, Lưu trữ, Task đã chốt, người), hàm doi_trang_thai_task theo đúng
// bảy bước kiểm của nó, them_lien_ket_vao_task, go_lien_ket_khoi_task, lich_su_task và các hàm tên người. KHÔNG thay
// cho việc chạy SQL thật (bộ test hợp đồng và bảng ca trên Supabase thật, chủ dự án chạy tay).
import { describe, expect, it } from 'vitest'
import { thatBai, type KetQua, type LoiKho, type MaLoi } from './ketQua'
import type { Phien } from './khoDuLieu'
import { taoKhoSupabase, type KhoSupabase } from './khoSupabase'
import { MA_TRAN_CHUYEN_TRANG_THAI, kiemChuyenTrangThai } from '../luat/chuyenTrangThai'
import { kiemTraLienKet, laTenRepoHopLe } from '../luat/github'
import { CAC_TRANG_THAI_TASK, kiemDoiNguoiTask, kiemNguoiTask, kiemTraSuaTask, kiemTraTask, type TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'

/** JWT giả (chữ ký không hợp lệ), như cauHinh.test.ts. */
function jwtGia(than: Record<string, unknown>): string {
  const ma = (doiTuong: Record<string, unknown>) =>
    btoa(JSON.stringify(doiTuong)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${ma({ alg: 'HS256', typ: 'JWT' })}.${ma(than)}.chu-ky-gia`
}

const URL_GIA = 'https://lenh-ghi-task-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'lenh-ghi-task-gia', role: 'anon' })
const MAT_KHAU = 'matkhau-dung-1'
const LUC = new Date('2026-06-02T08:30:00+07:00')
/** Giờ "máy chủ" đặt cho dấu vết và lịch sử (bản Supabase bỏ qua giờ truyền vào). */
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
  ngoai: id(7),
  /** Người đã rời Dự án chính (vẫn là Người thực hiện của Task "rời"). */
  cu: id(8),
  duAn: id(100),
  duAnLuuTru: id(102),
  taskMoi: id(1000),
  taskChoDuyet: id(1001),
  taskXong: id(1002),
  taskRoi: id(1003),
  taskLuuTru: id(1004),
  khongCo: id(1999),
}

type TenNguoi = 'pm' | 'an' | 'binh' | 'chi' | 'dung' | 'em' | 'ngoai'
const CAC_NGUOI: readonly TenNguoi[] = ['pm', 'an', 'binh', 'chi', 'dung', 'em', 'ngoai']

interface DuLieuGia {
  hoSo: Dong[]
  duAn: Dong[]
  thanhVien: Dong[]
  task: Dong[]
  lienKet: Dong[]
  repo: Dong[]
  lichSu: Dong[]
  /** Mọi địa chỉ đã gọi. */
  diaChi: string[]
  /** Các yêu cầu có thể ghi (`PHƯƠNG_THỨC bảng` hoặc `RPC hàm`), kể cả yêu cầu bị từ chối. */
  ghi: string[]
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
    nguoi_phu_trach_id: ID.chi,
    trang_thai: 'HOAT_DONG',
    tao_boi: ID.pm,
    tao_luc: '2026-05-01T02:00:00+00:00',
    sua_boi: null,
    sua_luc: null,
    ...dong,
  }
}

function taskGia(maTask: string, duAnId: string, dong: Dong = {}): Dong {
  return {
    id: maTask,
    du_an_id: duAnId,
    tieu_de: `Task ${maTask.slice(-4)}`,
    mo_ta: 'Mô tả',
    han: '2026-06-15',
    muc_uu_tien: 'TRUNG_BINH',
    nguoi_thuc_hien_id: ID.an,
    nguoi_kiem_tra_id: ID.binh,
    trang_thai: 'MOI',
    so_lan_tra_lai: 0,
    tao_boi: ID.pm,
    tao_luc: '2026-05-02T02:00:00+00:00',
    sua_boi: null,
    sua_luc: null,
    ...dong,
  }
}

/**
 * Dữ liệu giả. Dự án chính: Chi (Support), An, Bình, Em (Thành viên) ở trong; PM không ở trong Dự án nào; Dũng là
 * Support không ở Dự án chính; Ngoại không ở đâu; Cũ đã rời Dự án chính. Task Mới và Task Chờ duyệt: An làm, Bình
 * kiểm, mỗi Task một dòng lịch sử, Task Mới có một link. Dự án Lưu trữ có Chi, An, Bình và một Task Mới. Repo đã gắn
 * vào Dự án chính: `cong-ty/web`, `cong-ty/api`. Cỡ "nhiều" thêm 40 Task, năm người, 12 link và 30 dòng lịch sử.
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
      hoSoGia(7, 'ngoai', 'Ngoại', 'THANH_VIEN'),
      hoSoGia(8, 'cu', 'Cũ', 'THANH_VIEN'),
    ],
    duAn: [
      duAnGia(100, { ma: 'CH-01', ten: 'Cửa hàng' }),
      duAnGia(102, { ma: 'CU-03', ten: 'Cũ', trang_thai: 'LUU_TRU', sua_boi: ID.pm, sua_luc: '2026-05-21T02:00:00+00:00' }),
    ],
    thanhVien: [
      { du_an_id: ID.duAn, nguoi_dung_id: ID.chi, vai_tro: 'Trưởng nhóm' },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.an, vai_tro: null },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.binh, vai_tro: null },
      { du_an_id: ID.duAn, nguoi_dung_id: ID.em, vai_tro: null },
      { du_an_id: ID.duAnLuuTru, nguoi_dung_id: ID.chi, vai_tro: null },
      { du_an_id: ID.duAnLuuTru, nguoi_dung_id: ID.an, vai_tro: null },
      { du_an_id: ID.duAnLuuTru, nguoi_dung_id: ID.binh, vai_tro: null },
    ],
    task: [
      taskGia(ID.taskMoi, ID.duAn),
      taskGia(ID.taskChoDuyet, ID.duAn, { trang_thai: 'CHO_DUYET', so_lan_tra_lai: 1, sua_boi: ID.an, sua_luc: '2026-05-20T02:00:00+00:00' }),
      taskGia(ID.taskXong, ID.duAn, { trang_thai: 'HOAN_THANH' }),
      taskGia(ID.taskRoi, ID.duAn, { nguoi_thuc_hien_id: ID.cu, trang_thai: 'DANG_LAM' }),
      taskGia(ID.taskLuuTru, ID.duAnLuuTru),
    ],
    lienKet: [{ task_id: ID.taskMoi, repo: 'cong-ty/web', repo_khoa: 'cong-ty/web', loai: 'ISSUE', so: 7, thu_tu: 1 }],
    repo: [
      { du_an_id: ID.duAn, ten_repo: 'cong-ty/web', ten_repo_khoa: 'cong-ty/web', thu_tu: 1 },
      { du_an_id: ID.duAn, ten_repo: 'Cong-Ty/Api', ten_repo_khoa: 'cong-ty/api', thu_tu: 2 },
      { du_an_id: ID.duAnLuuTru, ten_repo: 'cong-ty/cu', ten_repo_khoa: 'cong-ty/cu', thu_tu: 3 },
    ],
    lichSu: [
      { task_id: ID.taskMoi, nguoi_doi_id: ID.chi, luc: '2026-05-03T02:00:00+00:00', tu: 'MOI', sang: 'MOI', ly_do: null, loai: 'MUC_UU_TIEN' },
      { task_id: ID.taskChoDuyet, nguoi_doi_id: ID.an, luc: '2026-05-20T02:00:00+00:00', tu: 'DANG_LAM', sang: 'CHO_DUYET', ly_do: null, loai: 'TRANG_THAI' },
    ],
    diaChi: [],
    ghi: [],
  }
  if (nhieu) {
    for (let k = 20; k < 25; k++) {
      du.hoSo.push(hoSoGia(k, `nguoi-${k}`, `Người ${k}`, 'THANH_VIEN'))
      du.thanhVien.push({ du_an_id: ID.duAn, nguoi_dung_id: id(k), vai_tro: `Vai ${k}` })
    }
    for (let k = 0; k < 40; k++) {
      du.task.push(taskGia(id(1100 + k), ID.duAn, { nguoi_thuc_hien_id: id(20 + (k % 5)), nguoi_kiem_tra_id: ID.chi, trang_thai: CAC_TRANG_THAI_TASK[k % 7] }))
    }
    for (let k = 0; k < 12; k++) {
      const repo = k % 2 === 0 ? 'cong-ty/web' : 'cong-ty/api'
      du.lienKet.push({ task_id: ID.taskMoi, repo, repo_khoa: repo, loai: k % 3 === 0 ? 'ISSUE' : 'PR', so: 100 + k, thu_tu: 50 - k })
    }
    for (let k = 0; k < 30; k++) {
      du.lichSu.push({ task_id: ID.taskChoDuyet, nguoi_doi_id: ID.chi, luc: `2026-05-${String(1 + (k % 19)).padStart(2, '0')}T01:00:00+00:00`, tu: 'THAP', sang: 'CAO', ly_do: null, loai: 'MUC_UU_TIEN' })
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

/** Tham số không phải bộ lọc của bảng chính (kể cả `bảng_nhúng.order`, `bảng_nhúng.limit`). */
function laThamSoKhongLoc(khoa: string): boolean {
  return ['select', 'order', 'offset', 'limit', 'columns', 'or'].includes(khoa) || khoa.includes('.')
}

/** Lọc dòng theo `cot=eq.x`, `cot=in.(x,y)` và `or=(a.eq.x,b.eq.y)` của PostgREST. */
function loc(dong: readonly Dong[], thamSo: URLSearchParams): Dong[] {
  return dong.filter((d) => {
    for (const [khoa, giaTri] of thamSo) {
      if (khoa === 'or') {
        const cacDieuKien = giaTri.slice(1, -1).split(',').map((p) => /^(\w+)\.eq\.(.+)$/.exec(p))
        if (!cacDieuKien.some((m) => m && String(d[m[1]]) === m[2])) return false
        continue
      }
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

/** Một mục của `select`: cột thường, hoặc bảng nhúng (`bang!khoa(...)`) kèm tên khoá và các mục con. */
interface MucChon {
  ten: string
  khoa: string | null
  con: MucChon[] | null
}

/** Phân tích `select` của PostgREST, kể cả nhúng lồng. */
function phanTichChon(chuoi: string): MucChon[] {
  let i = 0
  const tao = (ten: string, con: MucChon[] | null): MucChon => {
    const [goc, khoa] = ten.trim().split('!')
    return { ten: goc, khoa: khoa ?? null, con }
  }
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

/** Quan hệ nhúng: bảng đích, một dòng hay nhiều dòng, cách nối, và tên khoá bắt buộc (khi hai bảng nối bằng hai khoá). */
interface QuanHe {
  bang: string
  motDong: boolean
  noi(cha: Dong, con: Dong): boolean
  khoaBatBuoc?: string
}

const QUAN_HE: Record<string, Record<string, QuanHe>> = {
  task: {
    du_an: { bang: 'du_an', motDong: true, noi: (t, d) => d.id === t.du_an_id },
    lien_ket_task: { bang: 'lien_ket_task', motDong: false, noi: (t, l) => l.task_id === t.id },
  },
  du_an: {
    nguoi_trong_du_an: {
      bang: 'nguoi_trong_du_an',
      motDong: false,
      noi: (d, n) => n.du_an_id === d.id,
      khoaBatBuoc: 'nguoi_trong_du_an_du_an_id_fkey',
    },
  },
  nguoi_trong_du_an: {
    ho_so: { bang: 'ho_so', motDong: true, noi: (n, h) => h.id === n.nguoi_dung_id },
  },
}

/** PostgREST thật báo nhập nhằng khi nhúng hai bảng nối bằng hai khoá mà không gọi tên khoá. */
class LoiNhapNhang extends Error {}

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
    // rieng.duoc_xem_du_an, rieng.duoc_quan_ly_du_an.
    const duAnThay = (duAnId: unknown) => laPM || laThanhVien(duAnId, nguoiGoi.id)
    const duAnQuanLy = (duAnId: unknown) => laPM || (nguoiGoi.vai === 'SUPPORT' && laThanhVien(duAnId, nguoiGoi.id))
    const duAnCua = (duAnId: unknown) => du.duAn.find((d) => d.id === duAnId)
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
      if (bang === 'repo_du_an') return du.repo.filter((r) => duAnThay(r.du_an_id))
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
        if (qh.khoaBatBuoc && muc.khoa !== qh.khoaBatBuoc) throw new LoiNhapNhang()
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
    const traDong = (dong: Dong[], trangThai = 200) => tra(trangThai, motDoiTuong ? (dong[0] ?? null) : dong)
    const chon = phanTichChon(url.searchParams.get('select') ?? '*')
    const ten = (nguoiId: unknown) => String(du.hoSo.find((h) => h.id === nguoiId)?.ten_hien_thi ?? '')
    /** rieng.ghi_dau_vet_task và phần dấu vết của trigger task_truoc_khi_sua. */
    const ghiDauVet = (task: Dong) => Object.assign(task, { sua_boi: nguoiGoi.id, sua_luc: GIO_MAY_CHU })

    if (phuongThuc === 'POST' && url.pathname.startsWith('/rest/v1/rpc/')) {
      const ham = url.pathname.slice('/rest/v1/rpc/'.length)
      if (ham === 'ten_nguoi_dau_vet' || ham === 'ten_nguoi_cua_task') {
        const ids = (than.p_ids as string[]) ?? []
        return tra(200, du.hoSo.filter((h) => ids.includes(String(h.id))).map((h) => ({ id: h.id, ten_hien_thi: h.ten_hien_thi })))
      }
      if (ham === 'lich_su_task') {
        if (!taskThay(than.p_task_id)) return loiP0001('KHONG_TIM_THAY')
        return tra(
          200,
          du.lichSu
            .filter((l) => l.task_id === than.p_task_id)
            .map((l, i) => ({ stt: i + 1, loai: l.loai, nguoi_doi_id: l.nguoi_doi_id, ten_hien_thi: ten(l.nguoi_doi_id), luc: l.luc, tu: l.tu, sang: l.sang, ly_do: l.ly_do })),
        )
      }
      du.ghi.push(`RPC ${ham}`)
      const task = du.task.find((t) => t.id === than.p_task_id)
      if (ham === 'doi_trang_thai_task') {
        // Bảy bước kiểm của hàm (migration 20261125000300_lat_3_vong_duyet.sql), đúng thứ tự.
        if (!task) return loiP0001(laPM ? 'KHONG_TIM_THAY' : 'KHONG_CO_QUYEN')
        if (!duAnThay(task.du_an_id)) return loiP0001('KHONG_CO_QUYEN')
        const trong = laThanhVien(task.du_an_id, nguoiGoi.id)
        const vai: string[] = []
        if (trong && nguoiGoi.id === task.nguoi_thuc_hien_id) vai.push('NGUOI_THUC_HIEN')
        if (trong && nguoiGoi.id === task.nguoi_kiem_tra_id) vai.push('NGUOI_KIEM_TRA')
        if (trong && nguoiGoi.vai === 'SUPPORT') vai.push('SUPPORT')
        if (laPM) vai.push('PM')
        if (vai.length === 0) return loiP0001('KHONG_CO_QUYEN')
        if (duAnCua(task.du_an_id)?.trang_thai === 'LUU_TRU') return loiP0001('DU_AN_DA_LUU_TRU')
        if (task.trang_thai === 'HOAN_THANH' || task.trang_thai === 'HUY') return loiP0001('TASK_DA_CHOT')
        if (!(CAC_TRANG_THAI_TASK as readonly unknown[]).includes(than.p_sang)) return loiP0001('KHONG_HOP_LE')
        const lyDo = typeof than.p_ly_do === 'string' && than.p_ly_do.normalize('NFC').trim() !== '' ? than.p_ly_do.normalize('NFC').trim() : null
        if (lyDo !== null && lyDo.length > 1000) return loiP0001('KHONG_HOP_LE')
        const buoc = MA_TRAN_CHUYEN_TRANG_THAI.find((b) => b.tu === task.trang_thai && b.sang === than.p_sang)
        if (!buoc) return loiP0001('BUOC_KHONG_HOP_LE')
        if (!vai.some((v) => (buoc.nguoiLam as readonly string[]).includes(v))) return loiP0001('KHONG_CO_QUYEN')
        if (buoc.canLyDo && lyDo === null) return loiP0001('LY_DO_BAT_BUOC')
        du.lichSu.push({ task_id: task.id, nguoi_doi_id: nguoiGoi.id, luc: GIO_MAY_CHU, tu: task.trang_thai, sang: than.p_sang, ly_do: lyDo, loai: 'TRANG_THAI' })
        Object.assign(task, { trang_thai: than.p_sang, so_lan_tra_lai: Number(task.so_lan_tra_lai) + (than.p_sang === 'TRA_LAI' ? 1 : 0) })
        ghiDauVet(task)
        return tra(204)
      }
      if (ham === 'them_lien_ket_vao_task' || ham === 'go_lien_ket_khoi_task') {
        // Thứ tự kiểm của hai hàm (migration 20261125000400_lat_4_github.sql).
        if (!task || !duAnThay(task.du_an_id)) return loiP0001('KHONG_TIM_THAY')
        if (duAnCua(task.du_an_id)?.trang_thai === 'LUU_TRU') return loiP0001('DU_AN_DA_LUU_TRU')
        const repo = String(than.p_repo ?? '').trim()
        const khoa = repo.toLowerCase()
        const trung = (l: Dong) => l.task_id === task.id && l.repo_khoa === khoa && l.loai === than.p_loai && l.so === than.p_so
        if (ham === 'go_lien_ket_khoi_task') {
          if (!du.lienKet.some(trung)) return loiP0001('KHONG_TIM_THAY')
          du.lienKet = du.lienKet.filter((l) => !trung(l))
          ghiDauVet(task)
          return tra(204)
        }
        if (!laTenRepoHopLe(repo) || !['ISSUE', 'PR'].includes(String(than.p_loai)) || !(Number(than.p_so) > 0)) return loiP0001('LINK_KHONG_HOP_LE')
        if (!du.repo.some((r) => r.du_an_id === task.du_an_id && r.ten_repo_khoa === khoa)) return loiP0001('LINK_REPO_CHUA_GAN')
        if (du.lienKet.some(trung)) return loiP0001('LINK_TRUNG')
        du.lienKet.push({ task_id: task.id, repo, repo_khoa: khoa, loai: than.p_loai, so: than.p_so, thu_tu: 100 + du.lienKet.length })
        ghiDauVet(task)
        return tra(200, { repo, loai: than.p_loai, so: than.p_so })
      }
      return traLoi(404, 'PGRST202', `Không có hàm ${ham}`)
    }

    const bang = url.pathname.slice('/rest/v1/'.length)
    if (phuongThuc === 'GET') {
      const goc = bangThay(bang)
      if (!goc) return traLoi(404, 'PGRST205', `Không có bảng ${bang}`)
      const tham = url.searchParams
      const dong = xepVaCat(loc(goc, tham), tham.get('order'), tham.get('offset'), tham.get('limit'))
      try {
        return traDong(dong.map((d) => chieu(bang, d, chon)))
      } catch (loi) {
        if (loi instanceof LoiNhapNhang) return traLoi(300, 'PGRST201', 'Could not embed because more than one relationship was found')
        throw loi
      }
    }

    du.ghi.push(`${phuongThuc} ${bang}`)
    if (bang === 'task' && phuongThuc === 'POST') {
      // Trigger task_truoc_khi_tao: quyền, Dự án tồn tại, Lưu trữ, thiếu người, người ngoài Dự án, trùng người.
      if (!duAnQuanLy(than.du_an_id)) return loiP0001('KHONG_CO_QUYEN')
      const duAn = duAnCua(than.du_an_id)
      if (!duAn) return loiP0001('KHONG_TIM_THAY')
      if (duAn.trang_thai === 'LUU_TRU') return loiP0001('DU_AN_DA_LUU_TRU')
      if (!than.nguoi_thuc_hien_id || !than.nguoi_kiem_tra_id) return loiP0001('THIEU_NGUOI')
      if (!laThanhVien(duAn.id, than.nguoi_thuc_hien_id) || !laThanhVien(duAn.id, than.nguoi_kiem_tra_id)) return loiP0001('NGUOI_NGOAI_DU_AN')
      if (than.nguoi_thuc_hien_id === than.nguoi_kiem_tra_id) return loiP0001('TRUNG_NGUOI')
      const moi = taskGia(id(5000 + du.task.length), String(duAn.id), {
        ...than,
        trang_thai: 'MOI',
        so_lan_tra_lai: 0,
        tao_boi: nguoiGoi.id,
        tao_luc: GIO_MAY_CHU,
        sua_boi: null,
        sua_luc: null,
      })
      du.task.push(moi)
      return traDong([chieu('task', moi, chon)], 201)
    }
    if (bang === 'task' && phuongThuc === 'PATCH') {
      // Policy task_sua (dòng không quản lý được thì không bị sửa) và trigger task_truoc_khi_sua.
      const dich = loc(du.task.filter((t) => duAnQuanLy(t.du_an_id)), url.searchParams)
      for (const cu of dich) {
        if ('trang_thai' in than || 'so_lan_tra_lai' in than) return loiP0001('KHONG_CO_QUYEN')
        if (duAnCua(cu.du_an_id)?.trang_thai === 'LUU_TRU') return loiP0001('DU_AN_DA_LUU_TRU')
        if (cu.trang_thai === 'HOAN_THANH' || cu.trang_thai === 'HUY') return loiP0001('TASK_DA_CHOT')
        const moi: Dong = { ...cu, ...than }
        if (moi.nguoi_thuc_hien_id !== cu.nguoi_thuc_hien_id || moi.nguoi_kiem_tra_id !== cu.nguoi_kiem_tra_id) {
          if (!moi.nguoi_thuc_hien_id || !moi.nguoi_kiem_tra_id) return loiP0001('THIEU_NGUOI')
          const ngoai = (cot: string) => moi[cot] !== cu[cot] && !laThanhVien(cu.du_an_id, moi[cot])
          if (ngoai('nguoi_thuc_hien_id') || ngoai('nguoi_kiem_tra_id')) return loiP0001('NGUOI_NGOAI_DU_AN')
          if (moi.nguoi_thuc_hien_id === moi.nguoi_kiem_tra_id) return loiP0001('TRUNG_NGUOI')
        }
        Object.assign(cu, moi)
        ghiDauVet(cu)
      }
      return traDong(dich.map((t) => chieu('task', t, chon)))
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

/** Ảnh chụp dữ liệu có thể bị ghi (Task, link, lịch sử), để thấy một lệnh bị từ chối không ghi gì. */
function anhChup(du: DuLieuGia): string {
  return JSON.stringify([du.task, du.lienKet, du.lichSu])
}

interface BoiCanh {
  du: DuLieuGia
  kho: KhoSupabase
  dangNhap(ten: TenNguoi): Promise<Phien>
  /** Các địa chỉ PostgREST (lượt gọi tính vào trần) và các yêu cầu có thể ghi mà `lam` gọi tới. */
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

/** Một lệnh ghi trên đường thành công: ai gọi, gọi gì, và đọc lại bằng lệnh đọc (đường đã có trước ticket). */
interface CaThanhCong {
  ten: string
  nguoi: TenNguoi
  /** Số lượt gọi sau ticket này. */
  luot: number
  ghi: (kho: KhoSupabase, phien: Phien) => Promise<KetQua<unknown>>
  docLai: (kho: KhoSupabase, phien: Phien, ketQua: unknown) => Promise<unknown>
}

const docTask = async (kho: KhoSupabase, phien: Phien, ketQua: unknown) =>
  giaTri(await kho.layTask(phien, (ketQua as { id: string }).id))
const docLienKet = (taskId: string) => async (kho: KhoSupabase, phien: Phien, ketQua: unknown) =>
  giaTri(await kho.danhSachLienKetCuaTask(phien, taskId)).find((l) => l.duongDan === (ketQua as { duongDan: string }).duongDan)
const khongConLienKet = (taskId: string) => async (kho: KhoSupabase, phien: Phien) =>
  giaTri(await kho.danhSachLienKetCuaTask(phien, taskId)).some((l) => l.repo === 'cong-ty/web' && l.loai === 'ISSUE' && l.so === 7)
    ? 'còn link'
    : null

const CA_THANH_CONG: CaThanhCong[] = [
  {
    ten: 'tạo Task (Support của Dự án)',
    nguoi: 'chi',
    luot: 3,
    ghi: (kho, p) =>
      kho.taoTask(p, ID.duAn, { tieuDe: ' Trang giỏ hàng ', moTa: 'Làm giỏ', han: '2026-07-01', mucUuTien: 'CAO', nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh }, LUC),
    docLai: docTask,
  },
  {
    ten: 'tạo Task (PM không ở trong Dự án)',
    nguoi: 'pm',
    luot: 3,
    ghi: (kho, p) => kho.taoTask(p, ID.duAn, { tieuDe: 'Trang thanh toán', nguoiThucHienId: ID.em, nguoiKiemTraId: ID.chi }, LUC),
    docLai: docTask,
  },
  {
    ten: 'sửa Task (Support của Dự án)',
    nguoi: 'chi',
    luot: 3,
    ghi: (kho, p) => kho.suaTask(p, ID.taskMoi, { tieuDe: 'Tiêu đề mới', moTa: 'Mô tả mới', han: null, mucUuTien: 'CAO' }, LUC),
    docLai: docTask,
  },
  {
    ten: 'sửa Task có người đã rời Dự án (PM)',
    nguoi: 'pm',
    luot: 3,
    ghi: (kho, p) => kho.suaTask(p, ID.taskRoi, { tieuDe: 'Giữ người cũ' }, LUC),
    docLai: docTask,
  },
  {
    ten: 'đổi người của Task (Support của Dự án)',
    nguoi: 'chi',
    luot: 3,
    ghi: (kho, p) => kho.doiNguoiTask(p, ID.taskMoi, { nguoiThucHienId: ID.em, nguoiKiemTraId: ID.an }, LUC),
    docLai: docTask,
  },
  {
    ten: 'đổi Người kiểm tra, giữ Người thực hiện đã rời Dự án (PM)',
    nguoi: 'pm',
    luot: 3,
    ghi: (kho, p) => kho.doiNguoiTask(p, ID.taskRoi, { nguoiKiemTraId: ID.chi }, LUC),
    docLai: docTask,
  },
  {
    ten: 'đổi trạng thái: Người thực hiện bắt đầu làm (kéo thả trên Kanban)',
    nguoi: 'an',
    luot: 3,
    ghi: (kho, p) => kho.doiTrangThaiTask(p, ID.taskMoi, { sang: 'DANG_LAM' }, LUC),
    docLai: docTask,
  },
  {
    ten: 'đổi trạng thái: Người kiểm tra Trả lại có lý do',
    nguoi: 'binh',
    luot: 3,
    ghi: (kho, p) => kho.doiTrangThaiTask(p, ID.taskChoDuyet, { sang: 'TRA_LAI', lyDo: '  Thiếu ảnh  ' }, LUC),
    docLai: docTask,
  },
  {
    ten: 'đổi trạng thái: Support duyệt đạt',
    nguoi: 'chi',
    luot: 3,
    ghi: (kho, p) => kho.doiTrangThaiTask(p, ID.taskChoDuyet, { sang: 'HOAN_THANH' }, LUC),
    docLai: docTask,
  },
  {
    ten: 'đổi trạng thái: PM ngoài Dự án Huỷ Task có người đã rời',
    nguoi: 'pm',
    luot: 3,
    ghi: (kho, p) => kho.doiTrangThaiTask(p, ID.taskRoi, { sang: 'HUY', lyDo: 'Không làm nữa' }, LUC),
    docLai: docTask,
  },
  {
    ten: 'thêm link (Thành viên trong Dự án)',
    nguoi: 'an',
    luot: 2,
    ghi: (kho, p) => kho.themLienKetVaoTask(p, ID.taskMoi, { duongDan: 'https://github.com/cong-ty/api/pull/12' }, LUC),
    docLai: docLienKet(ID.taskMoi),
  },
  {
    ten: 'thêm link (PM không ở trong Dự án)',
    nguoi: 'pm',
    luot: 2,
    ghi: (kho, p) => kho.themLienKetVaoTask(p, ID.taskChoDuyet, { duongDan: 'https://github.com/Cong-Ty/Web/issues/3' }, LUC),
    docLai: docLienKet(ID.taskChoDuyet),
  },
  {
    ten: 'gỡ link (Thành viên trong Dự án)',
    nguoi: 'em',
    luot: 2,
    ghi: (kho, p) => kho.goLienKetKhoiTask(p, ID.taskMoi, { repo: 'Cong-Ty/Web', loai: 'ISSUE', so: 7 }, LUC),
    docLai: khongConLienKet(ID.taskMoi),
  },
  {
    ten: 'gỡ link (PM không ở trong Dự án)',
    nguoi: 'pm',
    luot: 2,
    ghi: (kho, p) => kho.goLienKetKhoiTask(p, ID.taskMoi, { repo: 'cong-ty/web', loai: 'ISSUE', so: 7 }, LUC),
    docLai: khongConLienKet(ID.taskMoi),
  },
]

const CO_DU_LIEU = [
  { ten: 'Dự án nhỏ (5 Task, 4 người, 1 link)', nhieu: false },
  { ten: 'Dự án lớn (45 Task, 9 người, 13 link, 32 dòng lịch sử)', nhieu: true },
] as const

describe('bản Supabase: mỗi lệnh ghi Task tốn nhiều nhất 3 lượt gọi', () => {
  describe.each(CO_DU_LIEU)('cỡ dữ liệu: $ten', ({ nhieu }) => {
    it.each(CA_THANH_CONG)('$ten: nhiều nhất 3 lượt kể cả đọc lại kết quả; kết quả bằng lần đọc kế tiếp', async (ca) => {
      const { kho, dangNhap, luotGoi } = dungBoiCanh(nhieu)
      const phien = await dangNhap(ca.nguoi)
      const { ketQua, diaChi, ghi } = await luotGoi(() => ca.ghi(kho, phien))
      const giaTriGhi = giaTri(ketQua)
      expect(diaChi.length).toBeLessThanOrEqual(TRAN)
      expect(diaChi).toHaveLength(ca.luot)
      expect(ghi).toHaveLength(1)
      expect(giaTriGhi ?? null).toEqual(await ca.docLai(kho, phien, giaTriGhi))
    })
  })

  it('số lượt gọi không tăng theo số Task, số người, số link hay số dòng lịch sử', async () => {
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

  it('kết quả sau khi ghi đủ như trước: tên người, dấu "đã rời dự án", dấu vết do máy chủ đặt, bộ đếm Trả lại', async () => {
    const { kho, dangNhap } = dungBoiCanh()
    const chi = await dangNhap('chi')
    const pm = await dangNhap('pm')
    const binh = await dangNhap('binh')

    const tao = giaTri(await kho.taoTask(chi, ID.duAn, { tieuDe: ' Trang giỏ hàng ', nguoiThucHienId: ID.an.toUpperCase(), nguoiKiemTraId: ID.binh }, LUC))
    expect(tao).toMatchObject({
      duAnId: ID.duAn,
      tieuDe: 'Trang giỏ hàng',
      mucUuTien: 'TRUNG_BINH',
      nguoiThucHien: { id: ID.an, tenHienThi: 'An' },
      nguoiKiemTra: { id: ID.binh, tenHienThi: 'Bình' },
      trangThai: 'MOI',
      soLanTraLai: 0,
      dauVet: { taoBoi: { id: ID.chi, tenHienThi: 'Chi' }, taoLuc: new Date(GIO_MAY_CHU), suaBoi: null, suaLuc: null },
    })
    expect(tao.nguoiThucHien).not.toHaveProperty('daRoiDuAn')

    const sua = giaTri(await kho.suaTask(pm, ID.taskRoi, { mucUuTien: 'THAP' }, LUC))
    expect(sua).toMatchObject({
      tieuDe: `Task ${ID.taskRoi.slice(-4)}`,
      mucUuTien: 'THAP',
      nguoiThucHien: { id: ID.cu, tenHienThi: 'Cũ', daRoiDuAn: true },
      nguoiKiemTra: { id: ID.binh, tenHienThi: 'Bình' },
      dauVet: { taoBoi: { id: ID.pm, tenHienThi: 'Pm' }, suaBoi: { id: ID.pm, tenHienThi: 'Pm' }, suaLuc: new Date(GIO_MAY_CHU) },
    })

    const doiNguoi = giaTri(await kho.doiNguoiTask(chi, ID.taskRoi, { nguoiThucHienId: ID.em }, LUC))
    expect(doiNguoi.nguoiThucHien).toEqual({ id: ID.em, tenHienThi: 'Em' })
    expect(doiNguoi.nguoiKiemTra).toEqual({ id: ID.binh, tenHienThi: 'Bình' })
    expect(doiNguoi.dauVet.suaBoi).toEqual({ id: ID.chi, tenHienThi: 'Chi' })

    const traLai = giaTri(await kho.doiTrangThaiTask(binh, ID.taskChoDuyet, { sang: 'TRA_LAI', lyDo: '  Thiếu ảnh  ' }, LUC))
    expect(traLai).toMatchObject({ trangThai: 'TRA_LAI', soLanTraLai: 2, dauVet: { suaBoi: { id: ID.binh, tenHienThi: 'Bình' }, suaLuc: new Date(GIO_MAY_CHU) } })

    expect(giaTri(await kho.themLienKetVaoTask(chi, ID.taskMoi, { duongDan: 'https://github.com/cong-ty/api/pull/12' }, LUC))).toEqual({
      repo: 'cong-ty/api',
      loai: 'PR',
      so: 12,
      duongDan: 'https://github.com/cong-ty/api/pull/12',
    })
    expect(giaTri(await kho.layTask(chi, ID.taskMoi)).dauVet.suaBoi).toEqual({ id: ID.chi, tenHienThi: 'Chi' })
    expect(giaTri(await kho.goLienKetKhoiTask(chi, ID.taskMoi, { repo: 'cong-ty/api', loai: 'PR', so: 12 }, LUC))).toBeNull()
  })

  it('mỗi lần đổi trạng thái thành công thêm đúng một dòng lịch sử (người đổi, từ, sang, lý do đã cắt khoảng trắng)', async () => {
    const { kho, dangNhap } = dungBoiCanh(true)
    const an = await dangNhap('an')
    const binh = await dangNhap('binh')
    const buoc: [Phien, { sang: string; lyDo?: string }, string | null][] = [
      [an, { sang: 'DANG_LAM' }, null],
      [an, { sang: 'CHO_DUYET', lyDo: '   ' }, null],
      [binh, { sang: 'BI_LOI', lyDo: ' Lỗi hiển thị ' }, 'Lỗi hiển thị'],
    ]
    let truoc = giaTri(await kho.lichSuTask(an, ID.taskMoi))
    let tu: TrangThaiTask = 'MOI'
    for (const [phien, dauVao, lyDo] of buoc) {
      expect(giaTri(await kho.doiTrangThaiTask(phien, ID.taskMoi, dauVao, LUC)).trangThai).toBe(dauVao.sang)
      const sau = giaTri(await kho.lichSuTask(an, ID.taskMoi))
      expect(sau).toHaveLength(truoc.length + 1)
      expect(sau.slice(0, truoc.length)).toEqual(truoc)
      expect(sau[sau.length - 1]).toEqual({
        loai: 'TRANG_THAI',
        nguoiDoi: phien === an ? { id: ID.an, tenHienThi: 'An' } : { id: ID.binh, tenHienThi: 'Bình' },
        luc: new Date(GIO_MAY_CHU),
        tu,
        sang: dauVao.sang,
        lyDo,
      })
      truoc = sau
      tu = dauVao.sang as TrangThaiTask
    }
  })
})

describe('đổi trạng thái: mọi người gọi, mọi trạng thái, mọi bước nhận đúng kết quả của luật thuần', () => {
  it('lỗi (mã, thông báo, lỗi theo ô) đúng như luật thuần; bị từ chối thì không ghi gì; dữ liệu biểu mẫu sai thì không gửi lệnh ghi nào', async () => {
    const { du, kho, dangNhap, luotGoi } = dungBoiCanh()
    const phien = {} as Record<TenNguoi, Phien>
    for (const ten of CAC_NGUOI) phien[ten] = await dangNhap(ten)
    const hoSo = (ten: TenNguoi) => du.hoSo.find((h) => h.email === `${ten}@vi-du.vn`) as Dong
    const cacDauVao: { sang: string; lyDo?: string | null }[] = [
      ...CAC_TRANG_THAI_TASK.flatMap((sang) => [{ sang }, { sang, lyDo: ' Có lý do ' }]),
      { sang: 'DANG_LAMM' },
      { sang: 'TRA_LAI', lyDo: 'a'.repeat(1001) },
    ]
    let soCa = 0
    for (const maTask of [ID.taskMoi, ID.taskLuuTru]) {
      const task = du.task.find((t) => t.id === maTask) as Dong
      const duAn = du.duAn.find((d) => d.id === task.du_an_id) as Dong
      for (const tu of CAC_TRANG_THAI_TASK) {
        for (const ten of CAC_NGUOI) {
          for (const dauVao of cacDauVao) {
            Object.assign(task, { trang_thai: tu, so_lan_tra_lai: 0 })
            const nguoi = hoSo(ten)
            const laTrong = du.thanhVien.some((t) => t.du_an_id === duAn.id && t.nguoi_dung_id === nguoi.id)
            const vai = nguoi.vai as VaiHeThong
            const luat = kiemChuyenTrangThai(
              {
                vaiNguoiGoi: vai,
                laNguoiTrongDuAn: laTrong,
                nguoiGoiId: String(nguoi.id),
                nguoiThucHienId: String(task.nguoi_thuc_hien_id),
                nguoiKiemTraId: String(task.nguoi_kiem_tra_id),
                trangThaiDuAn: duAn.trang_thai === 'LUU_TRU' ? 'LUU_TRU' : 'HOAT_DONG',
                trangThaiTask: tu,
              },
              dauVao,
            )
            // Người không thấy Dự án: Task như không tồn tại với họ (không lộ gì).
            const thay = vai === 'PM' || laTrong
            const mongDoi: LoiKho | 'THANH_CONG' = !thay
              ? loiCua(thatBai('KHONG_CO_QUYEN'))
              : luat.ok
                ? 'THANH_CONG'
                : loiCua(thatBai(luat.ma, luat.thongBao, luat.loiTheoO))
            const truoc = anhChup(du)
            const { ketQua, ghi } = await luotGoi(() => kho.doiTrangThaiTask(phien[ten], maTask, dauVao, LUC))
            const nhan = `${ten} ${tu} → ${JSON.stringify(dauVao)} (${maTask === ID.taskLuuTru ? 'Lưu trữ' : 'hoạt động'})`
            soCa += 1
            if (mongDoi === 'THANH_CONG') {
              expect(giaTri(ketQua).trangThai, nhan).toBe(dauVao.sang)
              du.lichSu = du.lichSu.filter((l) => l.luc !== GIO_MAY_CHU)
              Object.assign(task, { sua_boi: null, sua_luc: null })
              continue
            }
            expect(loiCua(ketQua), nhan).toEqual(mongDoi)
            expect(anhChup(du), nhan).toBe(truoc)
            if (mongDoi.ma === 'KHONG_HOP_LE' || mongDoi.ma === 'LY_DO_BAT_BUOC') expect(ghi, nhan).toEqual([])
          }
        }
      }
    }
    expect(soCa).toBe(2 * 7 * 7 * 16)
  })

  it('Task không tồn tại hay id sai dạng: PM nhận KHONG_TIM_THAY, người khác KHONG_CO_QUYEN; không ghi gì', async () => {
    const { du, kho, dangNhap } = dungBoiCanh()
    const truoc = anhChup(du)
    for (const ten of CAC_NGUOI) {
      const p = await dangNhap(ten)
      for (const maTask of [ID.khongCo, 'khong-phai-uuid', '']) {
        expect(maLoi(await kho.doiTrangThaiTask(p, maTask, { sang: 'DANG_LAM' }, LUC)), `${ten} ${maTask}`).toBe(ten === 'pm' ? 'KHONG_TIM_THAY' : 'KHONG_CO_QUYEN')
      }
    }
    expect(anhChup(du)).toBe(truoc)
  })
})

describe('tạo, sửa Task và đổi người: đúng mã lỗi và đúng thứ tự như trước, không ghi gì', () => {
  const dauVaoTaoSai = { tieuDe: '', nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh }
  const dauVaoSuaSai = { tieuDe: '' }
  const dauVaoDoiNguoiSai = { nguoiThucHienId: 42 }

  it('không có quyền trước không tìm thấy và trước lỗi dữ liệu; PM nhận không tìm thấy', async () => {
    const { du, kho, dangNhap, luotGoi } = dungBoiCanh()
    const truoc = anhChup(du)
    for (const ten of ['an', 'em', 'dung', 'ngoai'] as const) {
      const p = await dangNhap(ten)
      for (const duAnId of [ID.duAn, ID.duAnLuuTru, ID.khongCo, 'khong-phai-uuid']) {
        for (const dauVao of [dauVaoTaoSai, { tieuDe: 'Hợp lệ', nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh }]) {
          const { ketQua, ghi } = await luotGoi(() => kho.taoTask(p, duAnId, dauVao, LUC))
          expect(maLoi(ketQua), `${ten} tạo ${duAnId}`).toBe('KHONG_CO_QUYEN')
          expect(ghi).toEqual([])
        }
      }
      for (const maTask of [ID.taskMoi, ID.taskXong, ID.taskLuuTru, ID.khongCo, 'khong-phai-uuid']) {
        const ca: (() => Promise<KetQua<unknown>>)[] = [
          () => kho.suaTask(p, maTask, dauVaoSuaSai, LUC),
          () => kho.suaTask(p, maTask, { tieuDe: 'Hợp lệ' }, LUC),
          () => kho.doiNguoiTask(p, maTask, dauVaoDoiNguoiSai as never, LUC),
          () => kho.doiNguoiTask(p, maTask, { nguoiThucHienId: ID.em }, LUC),
        ]
        for (const goi of ca) {
          const { ketQua, ghi } = await luotGoi(goi)
          expect(maLoi(ketQua), `${ten} ${maTask}`).toBe('KHONG_CO_QUYEN')
          expect(ghi).toEqual([])
        }
      }
    }
    const pm = await dangNhap('pm')
    for (const khongCo of [ID.khongCo, 'khong-phai-uuid']) {
      expect(maLoi(await kho.taoTask(pm, khongCo, dauVaoTaoSai, LUC))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.suaTask(pm, khongCo, dauVaoSuaSai, LUC))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.doiNguoiTask(pm, khongCo, { nguoiThucHienId: ID.em }, LUC))).toBe('KHONG_TIM_THAY')
    }
    expect(anhChup(du)).toBe(truoc)
  })

  it('Dự án đã Lưu trữ trước Task đã chốt và trước lỗi dữ liệu; Task đã chốt trước lỗi dữ liệu', async () => {
    const { du, kho, dangNhap } = dungBoiCanh()
    const truoc = anhChup(du)
    du.task.find((t) => t.id === ID.taskLuuTru)!.trang_thai = 'HUY'
    const chup = anhChup(du)
    for (const ten of ['pm', 'chi'] as const) {
      const p = await dangNhap(ten)
      for (const dauVao of [dauVaoTaoSai, { tieuDe: 'Hợp lệ', nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh }]) {
        expect(maLoi(await kho.taoTask(p, ID.duAnLuuTru, dauVao, LUC)), ten).toBe('DU_AN_DA_LUU_TRU')
      }
      for (const goi of [
        () => kho.suaTask(p, ID.taskLuuTru, dauVaoSuaSai, LUC),
        () => kho.suaTask(p, ID.taskLuuTru, { tieuDe: 'Hợp lệ' }, LUC),
        () => kho.doiNguoiTask(p, ID.taskLuuTru, dauVaoDoiNguoiSai as never, LUC),
        () => kho.doiNguoiTask(p, ID.taskLuuTru, { nguoiThucHienId: ID.chi }, LUC),
      ]) {
        expect(maLoi(await goi()), ten).toBe('DU_AN_DA_LUU_TRU')
      }
      for (const goi of [
        () => kho.suaTask(p, ID.taskXong, dauVaoSuaSai, LUC),
        () => kho.suaTask(p, ID.taskXong, { tieuDe: 'Hợp lệ' }, LUC),
        () => kho.doiNguoiTask(p, ID.taskXong, dauVaoDoiNguoiSai as never, LUC),
        () => kho.doiNguoiTask(p, ID.taskXong, { nguoiThucHienId: ID.em }, LUC),
      ]) {
        expect(maLoi(await goi()), ten).toBe('TASK_DA_CHOT')
      }
    }
    expect(anhChup(du)).toBe(chup)
    expect(truoc).not.toBe(chup)
  })

  it('thiếu người, người ngoài Dự án (kể cả người đã rời), trùng người: lỗi theo ô như luật thuần, không gửi lệnh ghi', async () => {
    const { du, kho, dangNhap, luotGoi } = dungBoiCanh()
    const truoc = anhChup(du)
    const trong = (nguoiDungId: string) => du.thanhVien.some((t) => t.du_an_id === ID.duAn && t.nguoi_dung_id === nguoiDungId)
    for (const ten of ['pm', 'chi'] as const) {
      const p = await dangNhap(ten)
      const caTao: [string | null, string | null][] = [
        [null, ID.binh],
        [ID.an, null],
        [ID.ngoai, ID.binh],
        [ID.an, ID.cu],
        [ID.pm, ID.an],
        [ID.an, ID.an],
        [ID.an, ID.an.toUpperCase()],
      ]
      for (const [lam, kiem] of caTao) {
        const dauVao = { tieuDe: 'Task', nguoiThucHienId: lam, nguoiKiemTraId: kiem }
        const loiNguoi = kiemNguoiTask({
          nguoiThucHienId: lam?.toLowerCase() ?? null,
          nguoiKiemTraId: kiem?.toLowerCase() ?? null,
          laNguoiTrongDuAn: trong,
        })
        const kt = kiemTraTask.tao(dauVao)
        const mongDoi = !kt.ok ? loiCua(thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO)) : loiNguoi ? loiCua(thatBai(loiNguoi.ma, undefined, loiNguoi.loiTheoO)) : 'THANH_CONG'
        expect(mongDoi).not.toBe('THANH_CONG')
        const { ketQua, ghi } = await luotGoi(() => kho.taoTask(p, ID.duAn, dauVao as never, LUC))
        expect(loiCua(ketQua), `${ten} tạo ${lam} ${kiem}`).toEqual(mongDoi)
        expect(ghi).toEqual([])
      }
      const caDoi: { nguoiThucHienId?: string | null; nguoiKiemTraId?: string | null }[] = [
        { nguoiThucHienId: null },
        { nguoiKiemTraId: null },
        { nguoiThucHienId: ID.ngoai },
        { nguoiKiemTraId: ID.cu },
        { nguoiThucHienId: ID.binh },
        { nguoiKiemTraId: ID.an.toUpperCase() },
        { nguoiThucHienId: ID.em, nguoiKiemTraId: ID.em },
      ]
      for (const dauVao of caDoi) {
        const kt = kiemTraSuaTask.doiNguoi(dauVao)
        const moi = kt.ok
          ? kiemDoiNguoiTask({
              hienTai: { nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh },
              moi: {
                ...(kt.giaTri.nguoiThucHienId !== undefined && { nguoiThucHienId: kt.giaTri.nguoiThucHienId?.toLowerCase() ?? null }),
                ...(kt.giaTri.nguoiKiemTraId !== undefined && { nguoiKiemTraId: kt.giaTri.nguoiKiemTraId?.toLowerCase() ?? null }),
              },
              laNguoiTrongDuAn: trong,
            })
          : null
        const mongDoi = !kt.ok
          ? loiCua(thatBai('KHONG_HOP_LE', undefined, kt.loiTheoO))
          : moi && !moi.ok
            ? loiCua(thatBai(moi.loi.ma, undefined, moi.loi.loiTheoO))
            : 'THANH_CONG'
        expect(mongDoi).not.toBe('THANH_CONG')
        const { ketQua, ghi } = await luotGoi(() => kho.doiNguoiTask(p, ID.taskMoi, dauVao, LUC))
        expect(loiCua(ketQua), `${ten} đổi ${JSON.stringify(dauVao)}`).toEqual(mongDoi)
        expect(ghi).toEqual([])
      }
    }
    expect(anhChup(du)).toBe(truoc)
  })

  it('dữ liệu biểu mẫu sai: lỗi theo từng ô như luật thuần, không có lượt gọi nào ghi lên Supabase', async () => {
    const { du, kho, dangNhap, luotGoi } = dungBoiCanh()
    const truoc = anhChup(du)
    const tuLuat = (kt: { ok: true } | { ok: false; loiTheoO: Record<string, string> }, ma: MaLoi = 'KHONG_HOP_LE') => {
      if (kt.ok) throw new Error('Dữ liệu mẫu phải sai')
      return loiCua(thatBai(ma, undefined, kt.loiTheoO))
    }
    const taoSai = [dauVaoTaoSai, { tieuDe: 'x'.repeat(500), han: '2026-02-30', nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh }, { tieuDe: 'A', mucUuTien: 'GAP', nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh }]
    const suaSai = [dauVaoSuaSai, { han: 'ngày mai' }, { mucUuTien: 'GAP' }]
    const lienKetSai = [{ duongDan: 'https://gitlab.com/a/b/issues/1' }, { duongDan: '' }, {}]
    for (const ten of ['pm', 'chi'] as const) {
      const p = await dangNhap(ten)
      const ca: [() => Promise<KetQua<unknown>>, LoiKho | 'THANH_CONG'][] = [
        ...taoSai.map((d): [() => Promise<KetQua<unknown>>, LoiKho | 'THANH_CONG'] => [() => kho.taoTask(p, ID.duAn, d as never, LUC), tuLuat(kiemTraTask.tao(d))]),
        ...suaSai.map((d): [() => Promise<KetQua<unknown>>, LoiKho | 'THANH_CONG'] => [() => kho.suaTask(p, ID.taskMoi, d as never, LUC), tuLuat(kiemTraSuaTask.sua(d))]),
        [() => kho.doiNguoiTask(p, ID.taskMoi, dauVaoDoiNguoiSai as never, LUC), tuLuat(kiemTraSuaTask.doiNguoi(dauVaoDoiNguoiSai))],
        ...lienKetSai.map((d): [() => Promise<KetQua<unknown>>, LoiKho | 'THANH_CONG'] => [
          () => kho.themLienKetVaoTask(p, ID.taskMoi, d as never, LUC),
          tuLuat(kiemTraLienKet.them(d), 'LINK_KHONG_HOP_LE'),
        ]),
      ]
      for (const [lenh, mongDoi] of ca) {
        const { ketQua, ghi } = await luotGoi(lenh)
        expect(loiCua(ketQua)).toEqual(mongDoi)
        expect(ghi).toEqual([])
      }
    }
    expect(anhChup(du)).toBe(truoc)
  })
})

describe('thêm và gỡ link: đúng mã lỗi và đúng thứ tự như trước', () => {
  it('Task không thấy được (người ngoài Dự án, không tồn tại, id sai dạng) trước Lưu trữ, Lưu trữ trước lỗi dữ liệu', async () => {
    const { du, kho, dangNhap } = dungBoiCanh()
    const truoc = anhChup(du)
    for (const ten of ['dung', 'ngoai'] as const) {
      const p = await dangNhap(ten)
      for (const maTask of [ID.taskMoi, ID.taskLuuTru]) {
        expect(maLoi(await kho.themLienKetVaoTask(p, maTask, { duongDan: 'sai' }, LUC))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.goLienKetKhoiTask(p, maTask, { repo: 'cong-ty/web', loai: 'ISSUE', so: 7 }, LUC))).toBe('KHONG_TIM_THAY')
      }
    }
    for (const ten of ['pm', 'an'] as const) {
      const p = await dangNhap(ten)
      for (const maTask of [ID.khongCo, 'khong-phai-uuid']) {
        expect(maLoi(await kho.themLienKetVaoTask(p, maTask, { duongDan: 'sai' }, LUC))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.goLienKetKhoiTask(p, maTask, { repo: 'cong-ty/web', loai: 'ISSUE', so: 7 }, LUC))).toBe('KHONG_TIM_THAY')
      }
      expect(maLoi(await kho.themLienKetVaoTask(p, ID.taskLuuTru, { duongDan: 'sai' }, LUC))).toBe('DU_AN_DA_LUU_TRU')
      expect(maLoi(await kho.themLienKetVaoTask(p, ID.taskLuuTru, { duongDan: 'https://github.com/cong-ty/cu/issues/1' }, LUC))).toBe('DU_AN_DA_LUU_TRU')
      expect(maLoi(await kho.goLienKetKhoiTask(p, ID.taskLuuTru, { repo: 'cong-ty/cu', loai: 'ISSUE', so: 1 }, LUC))).toBe('DU_AN_DA_LUU_TRU')
    }
    expect(anhChup(du)).toBe(truoc)
  })

  it('repo chưa gắn, link trùng (khác hoa thường), gỡ link không có: lỗi theo ô như trước', async () => {
    const { du, kho, dangNhap } = dungBoiCanh()
    const truoc = anhChup(du)
    const an = await dangNhap('an')
    const chuaGan = await kho.themLienKetVaoTask(an, ID.taskMoi, { duongDan: 'https://github.com/cong-ty/khac/issues/1' }, LUC)
    expect(maLoi(chuaGan)).toBe('LINK_REPO_CHUA_GAN')
    expect(chuaGan.ok ? null : chuaGan.loi.loiTheoO).toHaveProperty('duongDan')
    const trung = await kho.themLienKetVaoTask(an, ID.taskMoi, { duongDan: 'https://github.com/Cong-Ty/Web/issues/7' }, LUC)
    expect(maLoi(trung)).toBe('LINK_TRUNG')
    expect(trung.ok ? null : trung.loi.loiTheoO).toHaveProperty('duongDan')
    expect(maLoi(await kho.goLienKetKhoiTask(an, ID.taskMoi, { repo: 'cong-ty/web', loai: 'PR', so: 7 }, LUC))).toBe('KHONG_TIM_THAY')
    expect(maLoi(await kho.goLienKetKhoiTask(an, ID.taskMoi, { repo: 'cong-ty/web', loai: 'ISSUE', so: -1 }, LUC))).toBe('KHONG_TIM_THAY')
    expect(anhChup(du)).toBe(truoc)
  })
})

describe('vai đổi giữa chừng và phiên', () => {
  it('vừa được nâng lên Support thì sửa Task và làm bước của Support được ngay; vừa bị hạ thì bị từ chối đúng như luật thuần', async () => {
    const { du, kho, dangNhap } = dungBoiCanh()
    const an = await dangNhap('an')
    const chi = await dangNhap('chi')
    const hoSo = (nguoiId: string) => du.hoSo.find((h) => h.id === nguoiId) as Dong
    hoSo(ID.an).vai = 'SUPPORT'
    hoSo(ID.chi).vai = 'THANH_VIEN'
    du.task.find((t) => t.id === ID.taskRoi)!.trang_thai = 'BI_LOI'

    expect(maLoi(await kho.suaTask(chi, ID.taskMoi, { tieuDe: 'Chi sửa' }, LUC))).toBe('KHONG_CO_QUYEN')
    expect(maLoi(await kho.taoTask(chi, ID.duAn, { tieuDe: 'Chi tạo', nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh }, LUC))).toBe('KHONG_CO_QUYEN')
    expect(maLoi(await kho.doiNguoiTask(chi, ID.taskMoi, { nguoiThucHienId: ID.em }, LUC))).toBe('KHONG_CO_QUYEN')
    // Bị lỗi sang Đang làm chỉ Support của Dự án hoặc PM làm được; Chi giờ là Thành viên, không giữ vai nào trên Task.
    const luat = kiemChuyenTrangThai(
      { vaiNguoiGoi: 'THANH_VIEN', laNguoiTrongDuAn: true, nguoiGoiId: ID.chi, nguoiThucHienId: ID.cu, nguoiKiemTraId: ID.binh, trangThaiDuAn: 'HOAT_DONG', trangThaiTask: 'BI_LOI' },
      { sang: 'DANG_LAM' },
    )
    if (luat.ok) throw new Error('Luật phải từ chối')
    expect(loiCua(await kho.doiTrangThaiTask(chi, ID.taskRoi, { sang: 'DANG_LAM' }, LUC))).toEqual(loiCua(thatBai(luat.ma, luat.thongBao, luat.loiTheoO)))
    expect(du.task.find((t) => t.id === ID.taskRoi)?.trang_thai).toBe('BI_LOI')

    expect(giaTri(await kho.suaTask(an, ID.taskMoi, { tieuDe: 'An sửa' }, LUC)).tieuDe).toBe('An sửa')
    expect(giaTri(await kho.doiTrangThaiTask(an, ID.taskRoi, { sang: 'DANG_LAM' }, LUC)).trangThai).toBe('DANG_LAM')
  })

  it('chưa đăng nhập: CHUA_DANG_NHAP, không gọi mạng', async () => {
    const { kho, luotGoi } = dungBoiCanh()
    const { ketQua, diaChi } = await luotGoi(() =>
      Promise.all([
        kho.taoTask(null, ID.duAn, { tieuDe: 'A', nguoiThucHienId: ID.an, nguoiKiemTraId: ID.binh }, LUC),
        kho.suaTask(null, ID.taskMoi, { tieuDe: 'A' }, LUC),
        kho.doiNguoiTask(null, ID.taskMoi, { nguoiThucHienId: ID.em }, LUC),
        kho.doiTrangThaiTask(null, ID.taskMoi, { sang: 'DANG_LAM' }, LUC),
        kho.themLienKetVaoTask(null, ID.taskMoi, { duongDan: 'https://github.com/cong-ty/web/issues/1' }, LUC),
        kho.goLienKetKhoiTask(null, ID.taskMoi, { repo: 'cong-ty/web', loai: 'ISSUE', so: 7 }, LUC),
      ]),
    )
    expect(ketQua.map((kq) => maLoi<unknown>(kq))).toEqual(Array(6).fill('CHUA_DANG_NHAP'))
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
