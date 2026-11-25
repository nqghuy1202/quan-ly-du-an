// Logic của Edge Function `doc-github` (ticket 17): đọc trạng thái issue hoặc PR trên GitHub cho
// người đã đăng nhập, CHỈ ĐỌC. Không chứa gì riêng của Deno: mọi thứ bên ngoài (xác thực người gọi,
// kiểm repo đã gắn, gọi GitHub, token) được truyền vào qua `PhuThuocHam`, nên cổng test được logic
// này bằng đầu vào giả, không mạng. `index.ts` nối các phụ thuộc đó với Deno và Supabase thật.
//
// Luật của hàm:
// - Người chưa đăng nhập: 401, chưa đọc gì, chưa gọi GitHub.
// - Chưa có token trong secret: 503 `GITHUB_KHONG_KHA_DUNG`, chưa gọi GitHub.
// - Mỗi liên kết chỉ được đọc khi repo của nó đã gắn vào một Dự án mà người gọi thấy được; ngược
//   lại trả `KHONG_TIM_THAY` (giống hệt repo không tồn tại: không lộ gì) và KHÔNG gọi GitHub.
// - Chỉ gửi yêu cầu `GET` tới `https://api.github.com/repos/{chu}/{repo}/(issues|pulls)/{so}`, URL
//   dựng từ (repo, loại, số) đã kiểm, không bao giờ từ chuỗi người gọi gửi. Không có đường nào ghi.
// - Phản hồi của GitHub đi qua đúng `chuyenPhanHoiGitHub` (cùng bản với ứng dụng và bản giả); lỗi
//   dùng đúng mã và thông báo mặc định của `thatBaiGitHub`.
// - Token chỉ nằm trong tiêu đề `Authorization` gửi GitHub. Không có đường nào đưa token (hay nội
//   dung phản hồi, thông báo lỗi của GitHub hoặc của mạng) vào phản hồi của hàm: mọi thông báo lỗi
//   đều là chữ cố định. Thêm một lớp phòng thủ: chuỗi phản hồi cuối được quét bỏ token.
import {
  GIOI_HAN_LIEN_KET_MOI_LAN,
  chuyenPhanHoiGitHub,
  khoaRepo,
  laTenRepoHopLe,
  thatBaiGitHub,
  type KetQuaGitHub,
  type LienKetGitHub,
  type MaLoiGitHub,
  type ThanLoi,
  type ThanPhanHoi,
  type TrangThaiLienKet,
} from '../_shared/github.ts'

/** Thời gian chờ mỗi yêu cầu tới GitHub, mili giây. */
export const THOI_GIAN_CHO_GITHUB_MS = 10_000

export const MAY_CHU_API_GITHUB = 'https://api.github.com'

/** Tiêu đề CORS: trình duyệt gọi hàm từ địa chỉ của ứng dụng. Không dùng cookie, chỉ `Authorization`. */
export const TIEU_DE_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
} as const

export const THONG_BAO_HAM = {
  chuaDangNhap: 'Bạn chưa đăng nhập hoặc phiên đã hết, nên chưa đọc được GitHub. Hãy đăng nhập lại.',
  thieuToken: 'Hệ thống chưa được cấu hình token GitHub chỉ đọc. Hãy nhờ chủ dự án đặt secret cho hàm.',
  yeuCauSai: 'Yêu cầu đọc GitHub không hợp lệ.',
  phuongThuc: 'Hàm chỉ nhận yêu cầu POST.',
  repoChuaGan:
    'Repo này chưa được gắn vào Dự án nào mà bạn thấy được, nên hệ thống không đọc GitHub cho link này.',
  loiHam: 'Hàm đọc GitHub gặp lỗi. Hãy thử lại sau.',
} as const

/** Một lời hỏi: repo, loại và số, như `LienKetGitHub`. */
export type LoiHoi = LienKetGitHub

/** Người gọi đã xác thực, kèm câu hỏi "repo này đã gắn vào Dự án nào người đó thấy được chưa". */
export interface NguoiGoiHam {
  /**
   * `khoa` là `khoaRepo(repo)` (chữ thường). True nếu repo đã gắn vào ít nhất một Dự án mà người
   * gọi thấy được (theo phân quyền từng dòng của cơ sở dữ liệu). Ném lỗi nếu không hỏi được.
   */
  repoDaGan(khoa: string): Promise<boolean>
}

/** Phản hồi của GitHub, chỉ phần hàm cần: mã trạng thái, một tiêu đề và thân (chữ). */
export interface PhanHoiGitHubTho {
  status: number
  /** Giá trị một tiêu đề (tên chữ thường), hoặc null. */
  tieuDe(ten: string): string | null
  /** Thân phản hồi dạng chữ; có thể ném lỗi. */
  chu(): Promise<string>
}

export interface YeuCauGitHub {
  /** Luôn là `GET`: kiểu chỉ cho phép đúng giá trị này. */
  method: 'GET'
  headers: Record<string, string>
}

export interface PhuThuocHam {
  /** Token GitHub chỉ đọc, đọc từ secret của môi trường hàm. Trống hoặc thiếu: chưa cấu hình. */
  token: string | undefined
  /**
   * Xác thực người gọi từ tiêu đề `Authorization` của yêu cầu. null nếu thiếu, sai hay hết hạn.
   * Ném lỗi nếu không xác thực được (coi như chưa đăng nhập).
   */
  xacThuc(tieuDeAuthorization: string | null): Promise<NguoiGoiHam | null>
  /** Gửi một yêu cầu tới GitHub. Ném lỗi khi mất mạng hoặc quá thời gian chờ. */
  goiGitHub(url: string, yeuCau: YeuCauGitHub): Promise<PhanHoiGitHubTho>
}

// ---------------------------------------------------------------------------------------------

function laDoiTuong(giaTri: unknown): giaTri is Record<string, unknown> {
  return typeof giaTri === 'object' && giaTri !== null && !Array.isArray(giaTri)
}

/** Một phần tử của yêu cầu có đúng dạng (repo hợp lệ, loại ISSUE hoặc PR, số nguyên dương an toàn) không. */
export function docLoiHoi(giaTri: unknown): LoiHoi | null {
  if (!laDoiTuong(giaTri)) return null
  const { repo, loai, so } = giaTri
  if (typeof repo !== 'string' || !laTenRepoHopLe(repo)) return null
  if (loai !== 'ISSUE' && loai !== 'PR') return null
  if (typeof so !== 'number' || !Number.isSafeInteger(so) || so <= 0) return null
  return { repo, loai, so }
}

/** URL đọc GitHub dựng từ (repo, loại, số) đã kiểm. Chỉ có hai dạng, đều dưới `/repos/`. */
export function urlDocGitHub(lienKet: LienKetGitHub): string {
  const [chu, ten] = lienKet.repo.split('/')
  const doan = lienKet.loai === 'PR' ? 'pulls' : 'issues'
  return `${MAY_CHU_API_GITHUB}/repos/${encodeURIComponent(chu)}/${encodeURIComponent(ten)}/${doan}/${lienKet.so}`
}

/** Gói một thân JSON thành `Response`, quét bỏ token khỏi chuỗi cuối cùng (phòng thủ). */
function traJson(than: ThanPhanHoi | ThanLoi, status: number, token: string | undefined): Response {
  let chu = JSON.stringify(than)
  if (token) chu = chu.split(token).join('***')
  return new Response(chu, {
    status,
    headers: { ...TIEU_DE_CORS, 'Content-Type': 'application/json; charset=utf-8' },
  })
}

function traLoi(ma: MaLoiGitHub, thongBao: string, status: number, token: string | undefined): Response {
  return traJson({ loi: { ma, thongBao } }, status, token)
}

/** Lỗi 403 của GitHub: hết lượt gọi (giới hạn chính hoặc phụ) hay repo riêng tư mà token không thấy. */
async function laHetLuotGoi(phanHoi: PhanHoiGitHubTho): Promise<boolean> {
  if (phanHoi.status === 429) return true
  if (phanHoi.tieuDe('x-ratelimit-remaining') === '0') return true
  if (phanHoi.tieuDe('retry-after') !== null) return true
  try {
    const than: unknown = JSON.parse(await phanHoi.chu())
    const thongDiep = laDoiTuong(than) && typeof than.message === 'string' ? than.message : ''
    // Chỉ để quyết định mã lỗi; nội dung này không bao giờ được chép ra phản hồi.
    return /rate limit/i.test(thongDiep)
  } catch {
    return false
  }
}

/** Đổi phản hồi của GitHub thành kết quả đã chuẩn hoá. Không ném lỗi, không chép nội dung của GitHub. */
export async function chuyenPhanHoiTho(
  lienKet: LienKetGitHub,
  phanHoi: PhanHoiGitHubTho,
): Promise<KetQuaGitHub<TrangThaiLienKet>> {
  const { status } = phanHoi
  if (status === 200) {
    let json: unknown
    try {
      json = JSON.parse(await phanHoi.chu())
    } catch {
      return thatBaiGitHub('DU_LIEU_LA')
    }
    return chuyenPhanHoiGitHub(lienKet.loai, json)
  }
  if (status === 404 || status === 410) return thatBaiGitHub('KHONG_TIM_THAY')
  // Token sai hoặc hết hạn: lỗi cấu hình, không phải lỗi của link.
  if (status === 401) return thatBaiGitHub('GITHUB_KHONG_KHA_DUNG')
  if (status === 403 || status === 429) {
    return (await laHetLuotGoi(phanHoi)) ? thatBaiGitHub('HET_LUOT_GOI') : thatBaiGitHub('RIENG_TU')
  }
  if (status >= 500) return thatBaiGitHub('MAT_MANG')
  return thatBaiGitHub('DU_LIEU_LA')
}

async function docMotLienKet(
  lienKet: LienKetGitHub,
  token: string,
  phuThuoc: PhuThuocHam,
): Promise<KetQuaGitHub<TrangThaiLienKet>> {
  let phanHoi: PhanHoiGitHubTho
  try {
    phanHoi = await phuThuoc.goiGitHub(urlDocGitHub(lienKet), {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'quan-ly-du-an-doc-github',
        Authorization: `Bearer ${token}`,
      },
    })
  } catch {
    // Mất mạng, quá thời gian chờ: chữ cố định, không chép thông báo của lỗi (có thể chứa tiêu đề gửi đi).
    return thatBaiGitHub('MAT_MANG')
  }
  try {
    return await chuyenPhanHoiTho(lienKet, phanHoi)
  } catch {
    return thatBaiGitHub('DU_LIEU_LA')
  }
}

/** Xử lý một yêu cầu gửi tới hàm. Không bao giờ ném lỗi. */
export async function xuLyYeuCau(yeuCau: Request, phuThuoc: PhuThuocHam): Promise<Response> {
  const token = phuThuoc.token?.trim() ? phuThuoc.token.trim() : undefined
  try {
    if (yeuCau.method === 'OPTIONS') return new Response(null, { status: 204, headers: TIEU_DE_CORS })
    if (yeuCau.method !== 'POST') return traLoi('GITHUB_KHONG_KHA_DUNG', THONG_BAO_HAM.phuongThuc, 405, token)

    // 1. Đăng nhập trước mọi thứ khác: người chưa đăng nhập không biết gì về cấu hình hay dữ liệu.
    let nguoiGoi: NguoiGoiHam | null = null
    try {
      nguoiGoi = await phuThuoc.xacThuc(yeuCau.headers.get('Authorization'))
    } catch {
      nguoiGoi = null
    }
    if (!nguoiGoi) return traLoi('GITHUB_KHONG_KHA_DUNG', THONG_BAO_HAM.chuaDangNhap, 401, token)

    // 2. Token chỉ-đọc phải có trong secret của hàm.
    if (!token) return traLoi('GITHUB_KHONG_KHA_DUNG', THONG_BAO_HAM.thieuToken, 503, token)

    // 3. Thân yêu cầu.
    let than: unknown
    try {
      than = await yeuCau.json()
    } catch {
      return traLoi('LINK_KHONG_HOP_LE', THONG_BAO_HAM.yeuCauSai, 400, token)
    }
    const danhSach = laDoiTuong(than) ? than.cacLienKet : undefined
    if (!Array.isArray(danhSach) || danhSach.length > GIOI_HAN_LIEN_KET_MOI_LAN) {
      return traLoi('LINK_KHONG_HOP_LE', THONG_BAO_HAM.yeuCauSai, 400, token)
    }

    // 4. Mỗi liên kết một kết quả riêng. Hỏi "repo đã gắn chưa" một lần cho mỗi repo.
    const daGan = new Map<string, Promise<boolean>>()
    const hoiDaGan = (khoa: string): Promise<boolean> => {
      let kq = daGan.get(khoa)
      if (!kq) {
        kq = nguoiGoi.repoDaGan(khoa)
        daGan.set(khoa, kq)
      }
      return kq
    }

    const ketQua = await Promise.all(
      danhSach.map(async (phanTu): Promise<KetQuaGitHub<TrangThaiLienKet>> => {
        const lienKet = docLoiHoi(phanTu)
        if (!lienKet) return thatBaiGitHub('LINK_KHONG_HOP_LE')
        let duocDoc: boolean
        try {
          duocDoc = await hoiDaGan(khoaRepo(lienKet.repo))
        } catch {
          return thatBaiGitHub('GITHUB_KHONG_KHA_DUNG')
        }
        if (!duocDoc) return thatBaiGitHub('KHONG_TIM_THAY', THONG_BAO_HAM.repoChuaGan)
        return docMotLienKet(lienKet, token, phuThuoc)
      }),
    )
    return traJson({ ketQua }, 200, token)
  } catch {
    return traLoi('GITHUB_KHONG_KHA_DUNG', THONG_BAO_HAM.loiHam, 500, token)
  }
}
