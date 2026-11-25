// Cổng GitHub khi chưa có gì để đọc GitHub (chưa cấu hình): mọi liên kết trả `GITHUB_KHONG_KHA_DUNG`
// thay vì chết. Chỉ thao tác đọc, không mạng, không đồng hồ. Task vẫn dùng bình thường, chỉ không có
// trạng thái GitHub cạnh link.
import { thatBaiGitHub, type KetQuaGitHub, type LienKetGitHub, type TrangThaiLienKet } from '../luat/github'
import type { CongGitHub } from './congGitHub'

export function taoCongKhongKhaDung(thongBao?: string): CongGitHub {
  const loi = (): KetQuaGitHub<TrangThaiLienKet> => thatBaiGitHub('GITHUB_KHONG_KHA_DUNG', thongBao)
  return {
    async docTrangThai(lienKet: LienKetGitHub) {
      void lienKet
      return loi()
    },
    async docNhieuTrangThai(cacLienKet: readonly LienKetGitHub[]) {
      return cacLienKet.map(loi)
    },
  }
}
