// Bản cài Cổng GitHub gọi Edge Function `doc-github` của Supabase (ticket 17). CHỈ ĐỌC: mọi thứ gửi
// đi là một lời hỏi "trạng thái của các link này" (repo, loại, số); hàm tự kiểm đăng nhập, repo đã gắn
// và dùng token chỉ-đọc nằm trong secret của nó. Trình duyệt không bao giờ thấy token GitHub; nó chỉ
// gửi mã truy cập của chính người dùng (JWT của Supabase Auth) và khoá công khai.
//
// Lỗi nào cũng thành kết quả có mã, không ném: mạng đứt là `MAT_MANG`, hàm chưa triển khai, thiếu
// token, chưa đăng nhập hay phản hồi của hàm sai hình là `GITHUB_KHONG_KHA_DUNG` hoặc `DU_LIEU_LA`.
// Phản hồi của hàm KHÔNG được tin: mỗi phần tử được kiểm lại hình dạng trước khi đưa lên giao diện.
import {
  CAC_MA_LOI_GITHUB,
  GIOI_HAN_LIEN_KET_MOI_LAN,
  TEN_HAM_DOC_GITHUB,
  thatBaiGitHub,
  thanhCongGitHub,
  type KetQuaGitHub,
  type LienKetGitHub,
  type MaLoiGitHub,
  type TrangThaiGitHub,
  type TrangThaiLienKet,
} from '../luat/github'
import type { CongGitHub } from './congGitHub'

export interface TuyChonCongGitHubEdge {
  /** Địa chỉ project Supabase (như `VITE_SUPABASE_URL`). */
  url: string
  /** Khoá công khai (anon hoặc publishable); không bao giờ khoá service. */
  khoaCongKhai: string
  /** Mã truy cập (JWT) của người đang đăng nhập, hoặc null nếu chưa có. */
  layMaTruyCap(): Promise<string | null>
  /** `fetch` của trình duyệt; test truyền bản giả (không mạng). */
  fetch?: typeof fetch
}

const TRANG_THAI_HOP_LE: readonly TrangThaiGitHub[] = ['MO', 'DONG', 'DA_MERGE']

function laDoiTuong(giaTri: unknown): giaTri is Record<string, unknown> {
  return typeof giaTri === 'object' && giaTri !== null && !Array.isArray(giaTri)
}

function laMaLoi(giaTri: unknown): giaTri is MaLoiGitHub {
  return typeof giaTri === 'string' && (CAC_MA_LOI_GITHUB as readonly string[]).includes(giaTri)
}

/** Lỗi ở dạng `{ ma, thongBao }` của hàm; sai hình thì dùng `macDinh`. */
function docLoi(giaTri: unknown, macDinh: MaLoiGitHub): { ma: MaLoiGitHub; thongBao?: string } {
  if (!laDoiTuong(giaTri) || !laMaLoi(giaTri.ma)) return { ma: macDinh }
  const thongBao = typeof giaTri.thongBao === 'string' && giaTri.thongBao.trim() !== '' ? giaTri.thongBao : undefined
  return { ma: giaTri.ma, thongBao }
}

/** Một phần tử `ketQua` của hàm → kết quả đã kiểm hình dạng, đúng với liên kết đã hỏi. */
function docKetQua(giaTri: unknown, lienKet: LienKetGitHub): KetQuaGitHub<TrangThaiLienKet> {
  if (!laDoiTuong(giaTri)) return thatBaiGitHub('DU_LIEU_LA')
  if (giaTri.ok === true) {
    const g = giaTri.giaTri
    if (!laDoiTuong(g) || g.loai !== lienKet.loai) return thatBaiGitHub('DU_LIEU_LA')
    const trangThai = g.trangThai
    if (!TRANG_THAI_HOP_LE.includes(trangThai as TrangThaiGitHub)) return thatBaiGitHub('DU_LIEU_LA')
    // Issue chỉ mở hoặc đóng.
    if (lienKet.loai === 'ISSUE' && trangThai === 'DA_MERGE') return thatBaiGitHub('DU_LIEU_LA')
    return thanhCongGitHub({ loai: lienKet.loai, trangThai: trangThai as TrangThaiGitHub })
  }
  if (giaTri.ok === false) {
    const { ma, thongBao } = docLoi(giaTri.loi, 'DU_LIEU_LA')
    return thatBaiGitHub(ma, thongBao)
  }
  return thatBaiGitHub('DU_LIEU_LA')
}

export function taoCongGitHubEdge(tuyChon: TuyChonCongGitHubEdge): CongGitHub {
  const goi = tuyChon.fetch ?? ((...doiSo: Parameters<typeof fetch>) => fetch(...doiSo))
  const diaChi = `${tuyChon.url.replace(/\/+$/, '')}/functions/v1/${TEN_HAM_DOC_GITHUB}`

  function tatCa(soLuong: number, loi: KetQuaGitHub<TrangThaiLienKet>): KetQuaGitHub<TrangThaiLienKet>[] {
    return Array.from({ length: soLuong }, () => loi)
  }

  /** Một lần gọi hàm cho tối đa `GIOI_HAN_LIEN_KET_MOI_LAN` liên kết. */
  async function docMotLan(
    maTruyCap: string,
    cacLienKet: readonly LienKetGitHub[],
  ): Promise<KetQuaGitHub<TrangThaiLienKet>[]> {
    let phanHoi: Response
    try {
      phanHoi = await goi(diaChi, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${maTruyCap}`,
          apikey: tuyChon.khoaCongKhai,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cacLienKet: cacLienKet.map(({ repo, loai, so }) => ({ repo, loai, so })) }),
      })
    } catch {
      return tatCa(cacLienKet.length, thatBaiGitHub('MAT_MANG'))
    }
    let than: unknown
    try {
      than = await phanHoi.json()
    } catch {
      than = undefined
    }
    if (phanHoi.status !== 200) {
      // Hàng rào của Supabase hay của hàm: chưa đăng nhập (401), hàm chưa triển khai (404), thiếu
      // token (503)... Dùng thông báo của hàm nếu nó gửi đúng hình, ngược lại thông báo mặc định.
      const macDinh: MaLoiGitHub = phanHoi.status >= 500 && phanHoi.status !== 503 ? 'MAT_MANG' : 'GITHUB_KHONG_KHA_DUNG'
      const { ma, thongBao } = laDoiTuong(than) ? docLoi(than.loi, macDinh) : { ma: macDinh, thongBao: undefined }
      return tatCa(cacLienKet.length, thatBaiGitHub(ma, thongBao))
    }
    const ketQua = laDoiTuong(than) ? than.ketQua : undefined
    if (!Array.isArray(ketQua) || ketQua.length !== cacLienKet.length) {
      return tatCa(cacLienKet.length, thatBaiGitHub('DU_LIEU_LA'))
    }
    return cacLienKet.map((lienKet, i) => docKetQua(ketQua[i], lienKet))
  }

  async function docNhieuTrangThai(cacLienKet: readonly LienKetGitHub[]): Promise<KetQuaGitHub<TrangThaiLienKet>[]> {
    if (cacLienKet.length === 0) return []
    let maTruyCap: string | null
    try {
      maTruyCap = await tuyChon.layMaTruyCap()
    } catch {
      maTruyCap = null
    }
    // Chưa đăng nhập: không gọi mạng.
    if (!maTruyCap) return tatCa(cacLienKet.length, thatBaiGitHub('GITHUB_KHONG_KHA_DUNG'))

    const ketQua: KetQuaGitHub<TrangThaiLienKet>[] = []
    for (let tu = 0; tu < cacLienKet.length; tu += GIOI_HAN_LIEN_KET_MOI_LAN) {
      ketQua.push(...(await docMotLan(maTruyCap, cacLienKet.slice(tu, tu + GIOI_HAN_LIEN_KET_MOI_LAN))))
    }
    return ketQua
  }

  return {
    async docTrangThai(lienKet) {
      const [ketQua] = await docNhieuTrangThai([lienKet])
      return ketQua
    },
    docNhieuTrangThai,
  }
}
