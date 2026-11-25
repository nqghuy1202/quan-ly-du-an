import { chayHopDongTongQuan } from './hopDongTongQuan'
import { taoKhoBoNho } from './khoBoNho'
import type { BanCaiHopDong } from './hopDong'

function taoBanCai(): BanCaiHopDong {
  const kho = taoKhoBoNho()
  return {
    kho,
    xacNhanEmail: (email: string) => kho.moPhong.xacNhanEmail(email),
    maDatLaiMoiNhat: async () => null,
    thoiHanMaDatLaiMs: 15 * 60 * 1000,
    datVaiPM: async (email: string) => {
      const kq = await kho.chuDuAn.datVaiPM(email)
      if (!kq.ok) throw new Error(kq.loi.thongBao)
    },
    datTrangThaiTask: async (taskId, trangThai) => {
      const kq = await kho.chuDuAn.datTrangThaiTask(taskId, trangThai)
      if (!kq.ok) throw new Error(kq.loi.thongBao)
    },
  }
}

chayHopDongTongQuan('bản bộ nhớ', taoBanCai)
