// Cấu hình chọn bản cài Kho dữ liệu theo biến môi trường. Thuần: không I/O, không đọc đồng hồ;
// biến môi trường được truyền vào (ứng dụng truyền `import.meta.env`, test truyền đối tượng giả).
//
// Mã chạy trong trình duyệt chỉ được nhận địa chỉ Supabase và khoá công khai (anon hoặc
// publishable). Khoá có vai service (bỏ qua mọi phân quyền từng dòng) không bao giờ được xuống
// trình duyệt: Vite đưa mọi biến `VITE_*` vào bản dựng, nên một khoá service nằm trong bất kỳ biến
// `VITE_*` nào đều bị từ chối, kể cả khi nó không phải khoá ứng dụng dùng.

/** Biến môi trường như `import.meta.env`: chuỗi, hoặc cờ của Vite như `PROD`, `DEV`. */
export type MoiTruong = Readonly<Record<string, string | boolean | undefined>>

/** Địa chỉ project Supabase (vd. https://abcd.supabase.co). */
export const BIEN_URL_SUPABASE = 'VITE_SUPABASE_URL'
/** Khoá công khai của project: khoá `anon` (JWT) hoặc khoá `sb_publishable_...`. */
export const BIEN_KHOA_SUPABASE = 'VITE_SUPABASE_ANON_KEY'

export type CauHinhKho =
  /** Không có cấu hình Supabase: bản bộ nhớ, chỉ dùng khi chạy thử trên máy. */
  | { loai: 'BO_NHO' }
  | { loai: 'SUPABASE'; url: string; khoaCongKhai: string }
  /** Cấu hình sai: ứng dụng không chạy, hiện thông báo này. */
  | { loai: 'LOI'; thongBao: string }

export type LoaiKhoa = 'CONG_KHAI' | 'SERVICE' | 'KHONG_RO'

function giaiMaBase64Url(phan: string): string {
  const base64 = phan.replace(/-/g, '+').replace(/_/g, '/')
  const du = base64.length % 4
  const nhiPhan = atob(du === 0 ? base64 : base64 + '='.repeat(4 - du))
  return new TextDecoder().decode(Uint8Array.from(nhiPhan, (kyTu) => kyTu.charCodeAt(0)))
}

/** Vai (`role`) ghi trong phần thân của một JWT, hoặc null nếu không phải JWT đọc được. */
function vaiTrongJwt(khoa: string): string | null {
  const phan = khoa.split('.')
  if (phan.length !== 3 || phan[1] === '') return null
  try {
    const than: unknown = JSON.parse(giaiMaBase64Url(phan[1]))
    if (typeof than !== 'object' || than === null) return null
    const vai = (than as { role?: unknown }).role
    return typeof vai === 'string' ? vai : null
  } catch {
    return null
  }
}

/**
 * Phân loại một khoá Supabase mà không gọi mạng: `SERVICE` cho khoá bỏ qua phân quyền (JWT vai
 * `service_role`, hoặc `sb_secret_...`), `CONG_KHAI` cho khoá anon/publishable, còn lại `KHONG_RO`.
 */
export function phanLoaiKhoa(khoa: string): LoaiKhoa {
  const k = khoa.trim()
  if (k.startsWith('sb_secret_')) return 'SERVICE'
  if (k.startsWith('sb_publishable_')) return 'CONG_KHAI'
  const vai = vaiTrongJwt(k)
  if (vai === 'service_role') return 'SERVICE'
  if (vai === 'anon') return 'CONG_KHAI'
  return 'KHONG_RO'
}

function chuoi(giaTri: string | boolean | undefined): string {
  return typeof giaTri === 'string' ? giaTri.trim() : ''
}

const THONG_BAO_KHOA_SERVICE =
  'chứa khoá có vai service (bỏ qua mọi phân quyền). Khoá này không bao giờ được đưa xuống trình duyệt: ' +
  'xoá nó khỏi mọi biến VITE_*, chỉ dùng khoá công khai (anon hoặc publishable).'

/**
 * Đọc cấu hình Kho dữ liệu từ biến môi trường.
 * - Không có `VITE_SUPABASE_URL` lẫn `VITE_SUPABASE_ANON_KEY`: bản bộ nhớ (chỉ khi chạy thử; bản
 *   dựng production thiếu cấu hình là lỗi).
 * - Có đủ cả hai, địa chỉ http(s) hợp lệ và khoá công khai: bản Supabase.
 * - Mọi trường hợp khác, và mọi biến `VITE_*` chứa khoá service: lỗi, kèm thông báo tiếng Việt.
 */
export function docCauHinhKho(env: MoiTruong): CauHinhKho {
  for (const [ten, giaTri] of Object.entries(env)) {
    const khoa = chuoi(giaTri)
    if (ten.startsWith('VITE_') && khoa !== '' && phanLoaiKhoa(khoa) === 'SERVICE') {
      return { loai: 'LOI', thongBao: `Cấu hình bị từ chối: biến ${ten} ${THONG_BAO_KHOA_SERVICE}` }
    }
  }

  const url = chuoi(env[BIEN_URL_SUPABASE])
  const khoa = chuoi(env[BIEN_KHOA_SUPABASE])

  if (url === '' && khoa === '') {
    if (env.PROD === true) {
      return {
        loai: 'LOI',
        thongBao: `Thiếu cấu hình Supabase (${BIEN_URL_SUPABASE}, ${BIEN_KHOA_SUPABASE}). Bản bộ nhớ chỉ dùng khi chạy thử trên máy.`,
      }
    }
    return { loai: 'BO_NHO' }
  }
  if (url === '') return { loai: 'LOI', thongBao: `Thiếu ${BIEN_URL_SUPABASE}: đã có khoá nhưng chưa có địa chỉ Supabase.` }
  if (khoa === '') return { loai: 'LOI', thongBao: `Thiếu ${BIEN_KHOA_SUPABASE}: đã có địa chỉ nhưng chưa có khoá công khai.` }

  let diaChi: URL
  try {
    diaChi = new URL(url)
  } catch {
    return { loai: 'LOI', thongBao: `${BIEN_URL_SUPABASE} không phải địa chỉ hợp lệ.` }
  }
  if (diaChi.protocol !== 'https:' && diaChi.protocol !== 'http:') {
    return { loai: 'LOI', thongBao: `${BIEN_URL_SUPABASE} phải là địa chỉ http hoặc https.` }
  }

  const loaiKhoa = phanLoaiKhoa(khoa)
  if (loaiKhoa === 'SERVICE') {
    return { loai: 'LOI', thongBao: `Cấu hình bị từ chối: biến ${BIEN_KHOA_SUPABASE} ${THONG_BAO_KHOA_SERVICE}` }
  }
  if (loaiKhoa !== 'CONG_KHAI') {
    return {
      loai: 'LOI',
      thongBao: `${BIEN_KHOA_SUPABASE} không phải khoá công khai của Supabase (khoá anon dạng JWT, hoặc sb_publishable_...).`,
    }
  }
  return { loai: 'SUPABASE', url, khoaCongKhai: khoa }
}
