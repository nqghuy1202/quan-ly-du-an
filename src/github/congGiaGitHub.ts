// Bản giả của Cổng GitHub chạy theo kịch bản, cho test và chạy thử. Không mạng, không đồng hồ.
// Kịch bản gán cho từng liên kết một phản ứng: phản hồi thô như GitHub trả (đi qua hàm chuyển đổi
// thuần, nên phản hồi lạ ra `DU_LIEU_LA`) hoặc một lỗi có mã.
import {
  chuyenPhanHoiGitHub,
  khoaLienKet,
  thatBaiGitHub,
  type KetQuaGitHub,
  type LienKetGitHub,
  type MaLoiGitHub,
  type TrangThaiLienKet,
} from '../luat/github'
import type { CongGitHub } from './congGitHub'

/** Các lỗi mà phía GitHub gây ra (không gồm `DU_LIEU_LA` và `LINK_KHONG_HOP_LE`, do hàm thuần sinh). */
export type LoiTuGitHub = Extract<MaLoiGitHub, 'KHONG_TIM_THAY' | 'RIENG_TU' | 'HET_LUOT_GOI' | 'MAT_MANG'>

export type PhanUngGia =
  /** GitHub trả phản hồi thô này (như JSON của `GET /repos/.../issues/{so}` hay `.../pulls/{so}`). */
  | { loai: 'PHAN_HOI'; phanHoi: unknown }
  /** GitHub (hoặc mạng) trả lỗi này. */
  | { loai: 'LOI'; ma: LoiTuGitHub }

export const phanHoiGia = (phanHoi: unknown): PhanUngGia => ({ loai: 'PHAN_HOI', phanHoi })
export const loiGia = (ma: LoiTuGitHub): PhanUngGia => ({ loai: 'LOI', ma })

export interface KichBanCongGia {
  /** Phản ứng theo liên kết; khoá là `khoaLienKet(...)` (repo không phân biệt hoa thường). */
  theoLienKet?: Record<string, PhanUngGia>
  /** Phản ứng khi liên kết không có trong kịch bản. Mặc định: không tìm thấy. */
  macDinh?: PhanUngGia
}

export interface CongGiaGitHub {
  cong: CongGitHub
  /** Các liên kết đã được hỏi, theo thứ tự (dành cho test). */
  cacLanGoi(): LienKetGitHub[]
}

export function taoCongGiaGitHub(kichBan: KichBanCongGia = {}): CongGiaGitHub {
  const macDinh = kichBan.macDinh ?? loiGia('KHONG_TIM_THAY')
  const lanGoi: LienKetGitHub[] = []

  function phanUng(lienKet: LienKetGitHub): PhanUngGia {
    const theo = kichBan.theoLienKet ?? {}
    const khoa = khoaLienKet(lienKet)
    return Object.hasOwn(theo, khoa) ? theo[khoa] : macDinh
  }

  async function docTrangThai(lienKet: LienKetGitHub): Promise<KetQuaGitHub<TrangThaiLienKet>> {
    lanGoi.push({ ...lienKet })
    const p = phanUng(lienKet)
    if (p.loai === 'LOI') return thatBaiGitHub(p.ma)
    return chuyenPhanHoiGitHub(lienKet.loai, p.phanHoi)
  }

  const cong: CongGitHub = {
    docTrangThai,
    async docNhieuTrangThai(cacLienKet) {
      const kq: KetQuaGitHub<TrangThaiLienKet>[] = []
      for (const lienKet of cacLienKet) kq.push(await docTrangThai(lienKet))
      return kq
    },
  }

  return { cong, cacLanGoi: () => lanGoi.map((l) => ({ ...l })) }
}
