import { describe, expect, it } from 'vitest'
import { napDuLieuMau, MAT_KHAU_MAU, NGUOI_MAU } from './duLieuMau'
import { PM_CHAY_THU, taoKhoBoNho } from './khoBoNho'

const BAY_GIO = new Date('2026-11-25T03:00:00.000Z')

async function dungKhoMau() {
  const kho = taoKhoBoNho({ pmBanDau: PM_CHAY_THU })
  await napDuLieuMau(kho, BAY_GIO)
  return kho
}

describe('dữ liệu mẫu cho bản chạy thử', () => {
  it('PM thấy 3 Dự án, mỗi Dự án có Task', async () => {
    const kho = await dungKhoMau()
    const pm = await kho.dangNhap({ email: PM_CHAY_THU.email, matKhau: PM_CHAY_THU.matKhau })
    if (!pm.ok) throw new Error('PM không đăng nhập được')
    const duAn = await kho.danhSachDuAn(pm.giaTri)
    if (!duAn.ok) throw new Error('không đọc được Dự án')
    expect(duAn.giaTri).toHaveLength(3)
    for (const d of duAn.giaTri) {
      const tasks = await kho.danhSachTask(pm.giaTri, d.id)
      expect(tasks.ok && tasks.giaTri.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('có Task ở đủ bảy trạng thái, có Task Trễ hạn và có Task đã bị Trả lại', async () => {
    const kho = await dungKhoMau()
    const pm = await kho.dangNhap({ email: PM_CHAY_THU.email, matKhau: PM_CHAY_THU.matKhau })
    if (!pm.ok) throw new Error('PM không đăng nhập được')
    const duAn = await kho.danhSachDuAn(pm.giaTri)
    if (!duAn.ok) throw new Error('không đọc được Dự án')
    const moi = await Promise.all(duAn.giaTri.map((d) => kho.danhSachTask(pm.giaTri, d.id)))
    const tatCa = moi.flatMap((kq) => (kq.ok ? kq.giaTri : []))
    expect(new Set(tatCa.map((t) => t.trangThai))).toEqual(
      new Set(['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI', 'HOAN_THANH', 'HUY']),
    )
    expect(tatCa.some((t) => t.soLanTraLai > 0)).toBe(true)
    expect(tatCa.some((t) => t.han !== null && t.han < '2026-11-25' && t.trangThai !== 'HOAN_THANH')).toBe(true)
  })

  it('mọi tài khoản mẫu đăng nhập được bằng mật khẩu chung và Lan là Support', async () => {
    const kho = await dungKhoMau()
    for (const nguoi of NGUOI_MAU) {
      const phien = await kho.dangNhap({ email: nguoi.email, matKhau: MAT_KHAU_MAU })
      expect(phien.ok).toBe(true)
      if (!phien.ok) continue
      const hoSo = await kho.layHoSoCuaToi(phien.giaTri)
      expect(hoSo.ok && hoSo.giaTri.vai).toBe(nguoi.vai)
    }
  })

  it('"Việc của tôi" và "Chờ tôi duyệt" của một người mẫu có dữ liệu', async () => {
    const kho = await dungKhoMau()
    const an = await kho.dangNhap({ email: 'an@vi-du.vn', matKhau: MAT_KHAU_MAU })
    if (!an.ok) throw new Error('An không đăng nhập được')
    const viec = await kho.viecCuaToi(an.giaTri)
    const cho = await kho.choToiDuyet(an.giaTri)
    expect(viec.ok && viec.giaTri.length).toBeGreaterThan(0)
    expect(cho.ok && cho.giaTri.length).toBeGreaterThan(0)
  })
})
