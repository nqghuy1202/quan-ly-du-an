// Luật thuần về GitHub (chỉ đọc): tên repo gắn vào Dự án, phân tích đường dẫn issue hoặc PR, và
// chuyển phản hồi thô của GitHub thành trạng thái hiển thị. Không I/O, không đọc đồng hồ, không
// ném lỗi trần: dữ liệu lạ trả lỗi có mã. Kho dữ liệu, Cổng GitHub và giao diện cùng dùng file này.
//
// Phần không phụ thuộc gì (mã lỗi, kiểm tên repo, phân tích link, chuyển phản hồi GitHub) nằm ở
// `supabase/functions/_shared/github.ts` để Edge Function (Deno) dùng CHUNG đúng một bản; file này
// export lại, nên mọi nơi khác vẫn import từ đây như trước. Không sao chép sang chỗ khác.
import { z } from 'zod'
import {
  THONG_BAO_GITHUB_MAC_DINH,
  laTenRepoHopLe,
  khoaRepo,
  phanTichLienKet,
  type LienKetGitHub,
  type TrangThaiGitHub,
  type TrangThaiLienKet,
} from '../../supabase/functions/_shared/github.ts'
import { THONG_BAO_DU_AN, duocXemDuAn, kiemGhiDuAn, type NguoiGoiDuAn, type TrangThaiDuAn } from './duAn'
import { kiemTra } from './taiKhoan'

export {
  CAC_MA_LOI_GITHUB,
  GIOI_HAN_LIEN_KET_MOI_LAN,
  TEN_HAM_DOC_GITHUB,
  THONG_BAO_GITHUB_MAC_DINH,
  chuyenPhanHoiGitHub,
  khoaLienKet,
  khoaRepo,
  laTenRepoHopLe,
  phanTichLienKet,
  thanhCongGitHub,
  thatBaiGitHub,
} from '../../supabase/functions/_shared/github.ts'
export type {
  KetQuaGitHub,
  LienKetGitHub,
  LoaiLienKetGitHub,
  LoiGitHub,
  MaLoiGitHub,
  ThanLoi,
  ThanPhanHoi,
  ThanYeuCau,
  TrangThaiGitHub,
  TrangThaiLienKet,
} from '../../supabase/functions/_shared/github.ts'

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

/** Xếp repo theo tên, không phân biệt hoa thường. */
export function xepRepo<T extends string>(danhSach: readonly T[]): T[] {
  return [...danhSach].sort((a, b) => khoaRepo(a).localeCompare(khoaRepo(b), 'en'))
}

// ---------------------------------------------------------------------------------------------
// Chữ hiện trên giao diện cho trạng thái GitHub (phần chuyển phản hồi thô nằm ở file dùng chung).
// ---------------------------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------------------------
// Link issue hoặc PR trên Task (ticket 16).
// ---------------------------------------------------------------------------------------------

export const THONG_BAO_LIEN_KET = {
  /** Ô dán link để trống hoặc không phải link issue, PR của github.com. */
  sai: THONG_BAO_GITHUB_MAC_DINH.LINK_KHONG_HOP_LE,
  chuaGan: 'Link này thuộc repo chưa gắn vào Dự án. Hãy nhờ PM hoặc Support gắn repo trước, hoặc dán link của repo đã gắn.',
  trung: 'Link này đã có trên Task.',
  daLuuTru: 'Dự án đã Lưu trữ nên không thêm hay gỡ link được. Mở lại Dự án để sửa.',
} as const

/** Đường dẫn chuẩn của một issue hoặc PR trên github.com (dùng để hiện và mở link). */
export function duongDanLienKet(lienKet: LienKetGitHub): string {
  return `https://github.com/${lienKet.repo}/${lienKet.loai === 'PR' ? 'pull' : 'issues'}/${lienKet.so}`
}

/** Chữ hiện cho một link: `acme/web · Issue #12` hoặc `acme/web · PR #34`. */
export function tenLienKet(lienKet: LienKetGitHub): string {
  return `${lienKet.repo} · ${lienKet.loai === 'PR' ? 'PR' : 'Issue'} #${lienKet.so}`
}

const themLienKetSchema = z.object(
  {
    duongDan: z
      .string({ error: THONG_BAO_LIEN_KET.sai })
      .transform((duongDan, ctx): LienKetGitHub => {
        const kq = phanTichLienKet(duongDan)
        if (kq.ok) return kq.giaTri
        ctx.issues.push({ code: 'custom', message: THONG_BAO_LIEN_KET.sai, input: duongDan })
        return z.NEVER
      }),
  },
  { error: THONG_BAO_LIEN_KET.sai },
)

/** Dán link vào Task: một đường dẫn issue hoặc PR của github.com. */
export type ThemLienKetDauVao = z.input<typeof themLienKetSchema>

/** Kiểm dữ liệu dán link ở ranh giới (biểu mẫu, Kho); lỗi theo ô `duongDan` bằng tiếng Việt. */
export const kiemTraLienKet = {
  them: (dauVao: unknown) => {
    const kt = kiemTra(themLienKetSchema, dauVao)
    return kt.ok ? ({ ok: true, giaTri: kt.giaTri.duongDan } as const) : kt
  },
}

/** Link có thuộc một trong các repo đã gắn vào Dự án không (tên repo không phân biệt hoa thường). */
export function thuocRepoDaGan(lienKet: LienKetGitHub, cacRepoDaGan: readonly string[]): boolean {
  const khoa = khoaRepo(lienKet.repo)
  return cacRepoDaGan.some((repo) => khoaRepo(repo) === khoa)
}

export type LyDoKhongGhiLienKet = 'KHONG_TIM_THAY' | 'DU_AN_DA_LUU_TRU'

/**
 * Có thêm hay gỡ link trên Task của một Dự án được không; trả lý do từ chối, hoặc null nếu được.
 * Mọi người trong dự án (và PM, thấy mọi Dự án) thêm và gỡ được, kể cả Task đã ở trạng thái cuối;
 * chỉ Dự án đã Lưu trữ thì không. Người không thấy Dự án nhận `KHONG_TIM_THAY`, không lộ gì.
 */
export function kiemGhiLienKet(tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn }): LyDoKhongGhiLienKet | null {
  if (!duocXemDuAn(tinhHuong)) return 'KHONG_TIM_THAY'
  if (tinhHuong.trangThai === 'LUU_TRU') return 'DU_AN_DA_LUU_TRU'
  return null
}

/** Lý do (tiếng Việt) để hiện thay cho ô thêm link; null nếu được thêm và gỡ. */
export function lyDoKhongGhiLienKet(tinhHuong: NguoiGoiDuAn & { trangThai: TrangThaiDuAn }): string | null {
  const lyDo = kiemGhiLienKet(tinhHuong)
  if (lyDo === 'DU_AN_DA_LUU_TRU') return THONG_BAO_LIEN_KET.daLuuTru
  if (lyDo === 'KHONG_TIM_THAY') return 'Bạn không thấy Dự án này nên không thêm hay gỡ link được.'
  return null
}
