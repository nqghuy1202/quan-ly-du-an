// Hàm ghép `docDuAnKemSoLieu` (bản Supabase dùng) chạy qua cùng bộ test hợp đồng, trên các lệnh đọc của bản
// bộ nhớ: phần ghép và tính phía client được kiểm trong cổng dù bản Supabase thì chỉ chạy tay.
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

chayHopDongDuAnKemSoLieu('hàm ghép từ các lệnh đọc (bản Supabase dùng), trên bản bộ nhớ', taoBanCai)
