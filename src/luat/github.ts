// Luật thuần về GitHub (chỉ đọc): tên repo gắn vào Dự án, phân tích đường dẫn issue hoặc PR, và
// chuyển phản hồi thô của GitHub thành trạng thái hiển thị. Không I/O, không đọc đồng hồ, không
// ném lỗi trần: dữ liệu lạ trả lỗi có mã. Kho dữ liệu, Cổng GitHub và giao diện cùng dùng file này.
import { z } from 'zod'
import { THONG_BAO_DU_AN, kiemGhiDuAn, type NguoiGoiDuAn, type TrangThaiDuAn } from './duAn'
import { kiemTra } from './taiKhoan'

// ---------------------------------------------------------------------------------------------
// Kết quả và mã lỗi của phía GitHub (tách khỏi `KetQua` của Kho dữ liệu: đây là seam thứ hai).
// ---------------------------------------------------------------------------------------------

/** Mã lỗi của Cổng GitHub và của hai hàm thuần ở file này. */
export type MaLoiGitHub =
  /** Không có issue, PR hay repo đó trên GitHub. */
  | 'KHONG_TIM_THAY'
  /** Repo riêng tư mà token chỉ-đọc của hệ thống không thấy. */
  | 'RIENG_TU'
  /** GitHub báo hết lượt gọi. */
  | 'HET_LUOT_GOI'
  /** Không gọi được GitHub (mất mạng, GitHub lỗi). */
  | 'MAT_MANG'
  /** Phản hồi của GitHub có dạng lạ hoặc thiếu trường cần thiết. */
  | 'DU_LIEU_LA'
  /** Đường dẫn không phải link issue hoặc PR của github.com. */
  | 'LINK_KHONG_HOP_LE'

export interface LoiGitHub {
  ma: MaLoiGitHub
  /** Thông báo tiếng Việt, hiện được thẳng cho người dùng. */
  thongBao: string
}

export type KetQuaGitHub<T> = { ok: true; giaTri: T } | { ok: false; loi: LoiGitHub }

export const THONG_BAO_GITHUB_MAC_DINH: Record<MaLoiGitHub, string> = {
  KHONG_TIM_THAY: 'Không tìm thấy issue hoặc PR này trên GitHub. Hãy kiểm tra lại đường dẫn.',
  RIENG_TU: 'Không đọc được vì repo này riêng tư và token của hệ thống không có quyền thấy.',
  HET_LUOT_GOI: 'GitHub báo đã hết lượt gọi. Hãy thử làm mới sau ít phút.',
  MAT_MANG: 'Không kết nối được GitHub. Hãy kiểm tra mạng rồi làm mới.',
  DU_LIEU_LA: 'GitHub trả về dữ liệu hệ thống không hiểu được.',
  LINK_KHONG_HOP_LE:
    'Đường dẫn phải là link issue hoặc PR của github.com, ví dụ https://github.com/chu-so-huu/ten-repo/issues/12.',
}

export function thanhCongGitHub<T>(giaTri: T): KetQuaGitHub<T> {
  return { ok: true, giaTri }
}

export function thatBaiGitHub<T = never>(ma: MaLoiGitHub, thongBao?: string): KetQuaGitHub<T> {
  return { ok: false, loi: { ma, thongBao: thongBao ?? THONG_BAO_GITHUB_MAC_DINH[ma] } }
}

// ---------------------------------------------------------------------------------------------
// Tên repo gắn vào Dự án: chủ-sở-hữu/tên-repo.
// ---------------------------------------------------------------------------------------------

export const THONG_BAO_REPO = {
  sai: 'Tên repo phải có dạng chu-so-huu/ten-repo, ví dụ vercel/next.js.',
  /** Lý do hiện trên giao diện khi người dùng không gắn hay gỡ được repo. */
  khongQuanLy: 'Chỉ PM hoặc Support của Dự án gắn và gỡ được repo GitHub. Bạn chỉ xem được danh sách repo.',
} as const

/**
 * Lý do (tiếng Việt) để hiện cạnh nút gắn và gỡ repo bị ẩn hay vô hiệu; null nếu được. Cùng luật với
 * Kho: người quản lý được Dự án (PM, Support của Dự án), và Dự án chưa Lưu trữ.
 */
export function lyDoKhongGanRepo(tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn }): string | null {
  const lyDo = kiemGhiDuAn(tinhHuong)
  if (lyDo === 'KHONG_CO_QUYEN') return THONG_BAO_REPO.khongQuanLy
  if (lyDo === 'DU_AN_DA_LUU_TRU') return THONG_BAO_DU_AN.daLuuTru
  return null
}

/** Chủ sở hữu: tên người dùng hoặc tổ chức GitHub, 1–39 ký tự chữ, số, gạch ngang, không ở đầu hay cuối. */
const CHU_SO_HUU = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i
/** Tên repo: 1–100 ký tự chữ, số, gạch ngang, gạch dưới, dấu chấm; không phải "." hay "..". */
const TEN_REPO = /^[\w.-]{1,100}$/

/** Tên repo hợp lệ dạng `chu-so-huu/ten-repo` (đã bỏ khoảng trắng hai đầu). */
export function laTenRepoHopLe(repo: string): boolean {
  const phan = repo.split('/')
  if (phan.length !== 2) return false
  const [chu, ten] = phan
  return CHU_SO_HUU.test(chu) && TEN_REPO.test(ten) && ten !== '.' && ten !== '..'
}

const tenRepoSchema = z
  .string({ error: THONG_BAO_REPO.sai })
  .trim()
  .normalize('NFC')
  .refine(laTenRepoHopLe, { error: THONG_BAO_REPO.sai })

/** Gắn repo vào Dự án: tên repo dạng chủ-sở-hữu/tên-repo. */
export const ganRepoSchema = z.object({ repo: tenRepoSchema }, { error: THONG_BAO_REPO.sai })

/** Kiểm dữ liệu gắn repo ở ranh giới (biểu mẫu, Kho); trả lỗi theo từng ô bằng tiếng Việt. */
export const kiemTraRepo = {
  gan: (dauVao: unknown) => kiemTra(ganRepoSchema, dauVao),
}

export type GanRepoDauVao = z.input<typeof ganRepoSchema>

/** Khoá so sánh tên repo không phân biệt hoa thường (GitHub không phân biệt hoa thường ở tên repo). */
export function khoaRepo(repo: string): string {
  return repo.trim().toLowerCase()
}

/** Xếp repo theo tên, không phân biệt hoa thường. */
export function xepRepo<T extends string>(danhSach: readonly T[]): T[] {
  return [...danhSach].sort((a, b) => khoaRepo(a).localeCompare(khoaRepo(b), 'en'))
}

// ---------------------------------------------------------------------------------------------
// Link issue hoặc PR.
// ---------------------------------------------------------------------------------------------

export type LoaiLienKetGitHub = 'ISSUE' | 'PR'

/** Một issue hay PR được chỉ ra bằng (repo, loại, số). */
export interface LienKetGitHub {
  repo: string
  loai: LoaiLienKetGitHub
  so: number
}

const MAY_CHU_GITHUB = ['github.com', 'www.github.com']
const DOAN_THEO_LOAI: Record<string, LoaiLienKetGitHub> = { issues: 'ISSUE', pull: 'PR' }
const SO_NGUYEN_DUONG = /^[1-9]\d*$/

/**
 * Phân tích đường dẫn issue (`https://github.com/chu/repo/issues/12`) hoặc PR
 * (`https://github.com/chu/repo/pull/12`) của github.com ra (repo, loại, số). Bỏ qua dấu `/` ở
 * cuối, phần `?...` và `#...`. Host khác, đường dẫn khác dạng, số không phải số nguyên dương hoặc
 * repo sai định dạng đều trả `LINK_KHONG_HOP_LE`. Tên repo giữ nguyên chữ hoa chữ thường như trong link.
 */
export function phanTichLienKet(duongDan: unknown): KetQuaGitHub<LienKetGitHub> {
  const loi = () => thatBaiGitHub<LienKetGitHub>('LINK_KHONG_HOP_LE')
  if (typeof duongDan !== 'string') return loi()
  let url: URL
  try {
    url = new URL(duongDan.trim())
  } catch {
    return loi()
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return loi()
  if (!MAY_CHU_GITHUB.includes(url.hostname) || url.port !== '' || url.username !== '' || url.password !== '') {
    return loi()
  }
  const phan = url.pathname.replace(/\/+$/, '').split('/')
  // ['', chu, repo, 'issues' | 'pull', so]
  if (phan.length !== 5 || phan[0] !== '') return loi()
  const [, chu, ten, doan, so] = phan
  const loai = Object.hasOwn(DOAN_THEO_LOAI, doan) ? DOAN_THEO_LOAI[doan] : undefined
  if (loai === undefined || !SO_NGUYEN_DUONG.test(so)) return loi()
  const soNguyen = Number(so)
  if (!Number.isSafeInteger(soNguyen)) return loi()
  const repo = `${chu}/${ten}`
  if (!laTenRepoHopLe(repo)) return loi()
  return thanhCongGitHub({ repo, loai, so: soNguyen })
}

/** Khoá ổn định của một liên kết (repo không phân biệt hoa thường), dùng làm khoá tra cứu. */
export function khoaLienKet(lienKet: LienKetGitHub): string {
  return `${khoaRepo(lienKet.repo)}#${lienKet.loai}#${lienKet.so}`
}

// ---------------------------------------------------------------------------------------------
// Phản hồi thô của GitHub → trạng thái hiển thị.
// ---------------------------------------------------------------------------------------------

/** Trạng thái hiển thị: issue chỉ mở hoặc đóng; PR mở, đã merge hoặc đóng (PR nháp coi là mở). */
export type TrangThaiGitHub = 'MO' | 'DONG' | 'DA_MERGE'

export interface TrangThaiLienKet {
  loai: LoaiLienKetGitHub
  trangThai: TrangThaiGitHub
}

const TEN_TRANG_THAI_ISSUE: Record<'MO' | 'DONG', string> = { MO: 'Issue đang mở', DONG: 'Issue đã đóng' }
const TEN_TRANG_THAI_PR: Record<TrangThaiGitHub, string> = {
  MO: 'PR đang mở',
  DA_MERGE: 'PR đã merge',
  DONG: 'PR đã đóng',
}

/** Chữ hiện trên giao diện cho một trạng thái GitHub. */
export function tenTrangThaiGitHub(trangThai: TrangThaiLienKet): string {
  if (trangThai.loai === 'PR') return TEN_TRANG_THAI_PR[trangThai.trangThai]
  return trangThai.trangThai === 'MO' ? TEN_TRANG_THAI_ISSUE.MO : TEN_TRANG_THAI_ISSUE.DONG
}

function laDoiTuong(giaTri: unknown): giaTri is Record<string, unknown> {
  return typeof giaTri === 'object' && giaTri !== null && !Array.isArray(giaTri)
}

/**
 * Chuyển phản hồi thô của GitHub cho issue (`GET /repos/{chu}/{repo}/issues/{so}`) hoặc PR
 * (`GET /repos/{chu}/{repo}/pulls/{so}`) thành trạng thái hiển thị:
 * - issue: `state` "open" là mở, "closed" là đóng;
 * - PR: "open" là mở (kể cả `draft: true`), "closed" là đã merge nếu `merged` là true hoặc có
 *   `merged_at`, ngược lại là đóng chưa merge.
 * Không phải đối tượng, `state` lạ hoặc thiếu, `merged`, `merged_at` hay `draft` sai kiểu, PR đóng mà
 * thiếu cả `merged` lẫn `merged_at`, hoặc PR mở mà đã merge: trả `DU_LIEU_LA`, không ném lỗi.
 */
export function chuyenPhanHoiGitHub(loai: LoaiLienKetGitHub, phanHoi: unknown): KetQuaGitHub<TrangThaiLienKet> {
  const la = () => thatBaiGitHub<TrangThaiLienKet>('DU_LIEU_LA')
  try {
    if (!laDoiTuong(phanHoi)) return la()
    const { state } = phanHoi
    if (state !== 'open' && state !== 'closed') return la()
    if (loai === 'ISSUE') {
      return thanhCongGitHub({ loai, trangThai: state === 'open' ? 'MO' : 'DONG' })
    }
    if (loai !== 'PR') return la()

    const { merged, merged_at: mergedAt, draft } = phanHoi
    if (draft !== undefined && typeof draft !== 'boolean') return la()
    if (merged !== undefined && typeof merged !== 'boolean') return la()
    if (mergedAt !== undefined && mergedAt !== null && typeof mergedAt !== 'string') return la()
    const daMerge = merged === true || typeof mergedAt === 'string'
    if (merged === false && typeof mergedAt === 'string') return la()
    if (state === 'open') {
      return daMerge ? la() : thanhCongGitHub({ loai, trangThai: 'MO' })
    }
    // state "closed": phải biết đã merge hay chưa.
    if (merged === undefined && mergedAt === undefined) return la()
    return thanhCongGitHub({ loai, trangThai: daMerge ? 'DA_MERGE' : 'DONG' })
  } catch {
    return la()
  }
}
