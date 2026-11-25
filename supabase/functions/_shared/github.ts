// Phần THUẦN dùng chung giữa ứng dụng (trình duyệt) và Edge Function đọc GitHub (Deno): mã lỗi và
// thông báo của Cổng GitHub, kiểm tên repo, phân tích link issue hoặc PR, và hàm chuyển phản hồi thô
// của GitHub thành trạng thái hiển thị. CHỈ MỘT BẢN: `src/luat/github.ts` import rồi export lại file
// này (giao diện, Kho, Cổng GitHub vẫn import từ `src/luat/github.ts`); Edge Function import thẳng.
//
// Ràng buộc để chạy được ở cả hai nơi (đừng phá):
// - không import gì (không zod, không file khác): Deno không tự thêm đuôi `.ts` và không có zod;
// - chỉ dùng API chuẩn của web (`URL`, `Object.hasOwn`), không I/O, không đọc đồng hồ;
// - nằm trong `supabase/functions/_shared/`: thư mục dành cho mã dùng chung mà `supabase functions
//   deploy` luôn đóng gói cùng hàm.
// Không ném lỗi trần: dữ liệu lạ trả lỗi có mã.

// ---------------------------------------------------------------------------------------------
// Kết quả và mã lỗi của phía GitHub (tách khỏi `KetQua` của Kho dữ liệu: đây là seam thứ hai).
// ---------------------------------------------------------------------------------------------

/** Mã lỗi của Cổng GitHub và của các hàm thuần ở file này. */
export type MaLoiGitHub =
  /** Không có issue, PR hay repo đó trên GitHub (hoặc repo chưa gắn vào Dự án nào người gọi thấy). */
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
  /**
   * Cổng đọc GitHub chưa dùng được: chưa cấu hình, hàm chưa triển khai hay thiếu token, hoặc người
   * gọi chưa đăng nhập. Khác `MAT_MANG` (thử lại sau có thể được) ở chỗ cần người cấu hình hoặc đăng nhập.
   */
  | 'GITHUB_KHONG_KHA_DUNG'

export interface LoiGitHub {
  ma: MaLoiGitHub
  /** Thông báo tiếng Việt, hiện được thẳng cho người dùng. */
  thongBao: string
}

export type KetQuaGitHub<T> = { ok: true; giaTri: T } | { ok: false; loi: LoiGitHub }

export const CAC_MA_LOI_GITHUB: readonly MaLoiGitHub[] = [
  'KHONG_TIM_THAY',
  'RIENG_TU',
  'HET_LUOT_GOI',
  'MAT_MANG',
  'DU_LIEU_LA',
  'LINK_KHONG_HOP_LE',
  'GITHUB_KHONG_KHA_DUNG',
]

export const THONG_BAO_GITHUB_MAC_DINH: Record<MaLoiGitHub, string> = {
  KHONG_TIM_THAY: 'Không tìm thấy issue hoặc PR này trên GitHub. Hãy kiểm tra lại đường dẫn.',
  RIENG_TU: 'Không đọc được vì repo này riêng tư và token của hệ thống không có quyền thấy.',
  HET_LUOT_GOI: 'GitHub báo đã hết lượt gọi. Hãy thử làm mới sau ít phút.',
  MAT_MANG: 'Không kết nối được GitHub. Hãy kiểm tra mạng rồi làm mới.',
  DU_LIEU_LA: 'GitHub trả về dữ liệu hệ thống không hiểu được.',
  LINK_KHONG_HOP_LE:
    'Đường dẫn phải là link issue hoặc PR của github.com, ví dụ https://github.com/chu-so-huu/ten-repo/issues/12.',
  GITHUB_KHONG_KHA_DUNG:
    'Chưa đọc được trạng thái GitHub vì chức năng này chưa được cấu hình hoặc bạn chưa đăng nhập. Hãy đăng nhập lại, hoặc nhờ chủ dự án kiểm tra cấu hình.',
}

export function thanhCongGitHub<T>(giaTri: T): KetQuaGitHub<T> {
  return { ok: true, giaTri }
}

export function thatBaiGitHub<T = never>(ma: MaLoiGitHub, thongBao?: string): KetQuaGitHub<T> {
  return { ok: false, loi: { ma, thongBao: thongBao ?? THONG_BAO_GITHUB_MAC_DINH[ma] } }
}

// ---------------------------------------------------------------------------------------------
// Tên repo: chủ-sở-hữu/tên-repo.
// ---------------------------------------------------------------------------------------------

/** Chủ sở hữu: tên người dùng hoặc tổ chức GitHub, 1–39 ký tự chữ, số, gạch ngang, không ở đầu hay cuối. */
const CHU_SO_HUU = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i
/** Tên repo: 1–100 ký tự chữ, số, gạch ngang, gạch dưới, dấu chấm; không phải "." hay "..". */
const TEN_REPO = /^[\w.-]{1,100}$/

/** Tên repo hợp lệ dạng `chu-so-huu/ten-repo` (không bỏ khoảng trắng: người gọi tự `trim` trước). */
export function laTenRepoHopLe(repo: string): boolean {
  const phan = repo.split('/')
  if (phan.length !== 2) return false
  const [chu, ten] = phan
  return CHU_SO_HUU.test(chu) && TEN_REPO.test(ten) && ten !== '.' && ten !== '..'
}

/** Khoá so sánh tên repo không phân biệt hoa thường (GitHub không phân biệt hoa thường ở tên repo). */
export function khoaRepo(repo: string): string {
  return repo.trim().toLowerCase()
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

// ---------------------------------------------------------------------------------------------
// Dạng dữ liệu trên đường truyền giữa ứng dụng và Edge Function `doc-github` (hai bên dùng chung).
// ---------------------------------------------------------------------------------------------

/** Tên Edge Function: gọi tại `{địa chỉ Supabase}/functions/v1/doc-github`. */
export const TEN_HAM_DOC_GITHUB = 'doc-github'

/** Số liên kết tối đa mỗi lần gọi (giới hạn lượt gọi GitHub và thời gian chạy của hàm). */
export const GIOI_HAN_LIEN_KET_MOI_LAN = 25

/** Thân yêu cầu POST: `{ cacLienKet: [{ repo, loai, so }, ...] }`. */
export interface ThanYeuCau {
  cacLienKet: unknown[]
}

/** Thân phản hồi 200: một kết quả cho mỗi liên kết, theo đúng thứ tự. */
export interface ThanPhanHoi {
  ketQua: KetQuaGitHub<TrangThaiLienKet>[]
}

/** Thân phản hồi lỗi chung (401, 400, 503...): không có kết quả riêng cho từng liên kết. */
export interface ThanLoi {
  loi: LoiGitHub
}
