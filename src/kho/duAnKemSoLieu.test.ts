// Hàm ghép `docDuAnKemSoLieu` (cách ghép tham chiếu mà bản Supabase đọc theo lô phải khớp) chạy qua cùng bộ test
// hợp đồng, trên các lệnh đọc của bản bộ nhớ: phần ghép và tính phía client được kiểm trong cổng.
import { chayHopDongDuAnKemSoLieu } from './hopDongDuAnKemSoLieu'
import type { BanCaiHopDong } from './hopDong'
import { docDuAnKemSoLieu } from './duAnKemSoLieu'
import type { KhoDuLieu } from './khoDuLieu'
import { taoKhoBoNho } from './khoBoNho'

function taoBanCai(): BanCaiHopDong {
  const goc = taoKhoBoNho()
  const kho: KhoDuLieu = {
    ...goc,
    danhSachDuAnKemSoLieu: (phien, phamVi, bayGio) => docDuAnKemSoLieu(goc, phien, phamVi, bayGio),
  }
  return {
    kho,
    xacNhanEmail: (email: string) => goc.moPhong.xacNhanEmail(email),
    maDatLaiMoiNhat: async () => null,
    thoiHanMaDatLaiMs: 60 * 60 * 1000,
    datVaiPM: async (email: string) => {
      const kq = await goc.chuDuAn.datVaiPM(email)
      if (!kq.ok) throw new Error(kq.loi.thongBao)
    },
  }
}

chayHopDongDuAnKemSoLieu('hàm ghép từ các lệnh đọc (tham chiếu của bản Supabase), trên bản bộ nhớ', taoBanCai)
