import { describe, expect, it } from 'vitest'
import { napDuLieuMau, MAT_KHAU_MAU, NGUOI_MAU } from './duLieuMau'
import { PM_CHAY_THU, taoKhoBoNho } from './khoBoNho'
import { kiemTraDuAn } from '../luat/duAn'
import { laDuAnQuaHanDuKien, tinhTienDo } from '../luat/tienDo'

const BAY_GIO = new Date('2026-11-25T03:00:00.000Z')

async function dungKhoMau() {
  const kho = taoKhoBoNho({ pmBanDau: PM_CHAY_THU })
  await napDuLieuMau(kho, BAY_GIO)
  return kho
}

describe('dữ liệu mẫu cho bản chạy thử', () => {
  it('người mẫu có Thông tin nhân sự (Số điện thoại đã chuẩn hoá); có người để trống', async () => {
    const kho = await dungKhoMau()
    const pm = await kho.dangNhap({ email: PM_CHAY_THU.email, matKhau: PM_CHAY_THU.matKhau })
    if (!pm.ok) throw new Error('PM không đăng nhập được')
    const nguoiDung = await kho.danhSachNguoiDung(pm.giaTri)
    if (!nguoiDung.ok) throw new Error('không đọc được người dùng')
    const mau = nguoiDung.giaTri.filter((nd) => NGUOI_MAU.some((n) => n.email === nd.email))
    const coNhanSu = mau.filter((nd) => nd.soDienThoai !== null)
    expect(coNhanSu.length).toBeGreaterThanOrEqual(3)
    for (const nd of coNhanSu) {
      expect(nd.soDienThoai).toMatch(/^(?:0\d{9}|\+84\d{9})$/)
      expect(nd.chucDanh).not.toBeNull()
      expect(nd.phongBan).not.toBeNull()
    }
    expect(mau.some((nd) => nd.soDienThoai === null && nd.chucDanh === null && nd.phongBan === null)).toBe(true)
  })

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

  it('mọi Dự án mẫu có Mã đúng dạng, không trùng nhau; có Dự án mẫu có Khách hàng', async () => {
    const kho = await dungKhoMau()
    const pm = await kho.dangNhap({ email: PM_CHAY_THU.email, matKhau: PM_CHAY_THU.matKhau })
    if (!pm.ok) throw new Error('PM không đăng nhập được')
    const duAn = await kho.danhSachDuAn(pm.giaTri)
    if (!duAn.ok) throw new Error('không đọc được Dự án')
    const cacMa = duAn.giaTri.map((d) => d.ma)
    for (const ma of cacMa) expect(kiemTraDuAn.sua({ ma }).ok, ma).toBe(true)
    expect(new Set(cacMa.map((ma) => ma.toUpperCase())).size).toBe(duAn.giaTri.length)
    expect(duAn.giaTri.some((d) => d.khachHang !== '')).toBe(true)
  })

  it('có Dự án mẫu có hai ngày (kết thúc không trước bắt đầu) và có Dự án mẫu Quá hạn dự kiến', async () => {
    const kho = await dungKhoMau()
    const pm = await kho.dangNhap({ email: PM_CHAY_THU.email, matKhau: PM_CHAY_THU.matKhau })
    if (!pm.ok) throw new Error('PM không đăng nhập được')
    const duAn = await kho.danhSachDuAn(pm.giaTri)
    if (!duAn.ok) throw new Error('không đọc được Dự án')
    const coHaiNgay = duAn.giaTri.filter((d) => d.ngayBatDau !== null && d.ngayKetThucDuKien !== null)
    expect(coHaiNgay.length).toBeGreaterThan(0)
    for (const d of coHaiNgay) expect(d.ngayKetThucDuKien! >= d.ngayBatDau!).toBe(true)
    const quaHan = []
    for (const d of duAn.giaTri) {
      const tasks = await kho.danhSachTask(pm.giaTri, d.id)
      if (tasks.ok && laDuAnQuaHanDuKien(d, tinhTienDo(tasks.giaTri), BAY_GIO)) quaHan.push(d.ma)
    }
    expect(quaHan).toEqual(['SDV-001'])
  })

  it('Dự án mẫu có đủ ba Mức ưu tiên; có Dự án mẫu có Người phụ trách (là Người trong dự án) và có Dự án chưa có', async () => {
    const kho = await dungKhoMau()
    const pm = await kho.dangNhap({ email: PM_CHAY_THU.email, matKhau: PM_CHAY_THU.matKhau })
    if (!pm.ok) throw new Error('PM không đăng nhập được')
    const duAn = await kho.danhSachDuAn(pm.giaTri)
    if (!duAn.ok) throw new Error('không đọc được Dự án')
    expect(new Set(duAn.giaTri.map((d) => d.mucUuTien))).toEqual(new Set(['THAP', 'TRUNG_BINH', 'CAO']))
    const coPhuTrach = duAn.giaTri.filter((d) => d.nguoiPhuTrach !== null)
    expect(coPhuTrach.length).toBeGreaterThan(0)
    expect(coPhuTrach.length).toBeLessThan(duAn.giaTri.length)
    for (const d of coPhuTrach) {
      const nguoi = await kho.danhSachNguoiTrongDuAn(pm.giaTri, d.id)
      expect(nguoi.ok && nguoi.giaTri.some((n) => n.id === d.nguoiPhuTrach?.id)).toBe(true)
      expect(d.nguoiPhuTrach?.tenHienThi).not.toBe('')
    }
  })

  it('có Người trong dự án có Vai trò trong Dự án và có người để trống; số Task đang giữ có người khác 0', async () => {
    const kho = await dungKhoMau()
    const pm = await kho.dangNhap({ email: PM_CHAY_THU.email, matKhau: PM_CHAY_THU.matKhau })
    if (!pm.ok) throw new Error('PM không đăng nhập được')
    const duAn = await kho.danhSachDuAn(pm.giaTri)
    if (!duAn.ok) throw new Error('không đọc được Dự án')
    const moi = await Promise.all(duAn.giaTri.map((d) => kho.danhSachNguoiTrongDuAn(pm.giaTri, d.id)))
    const tatCa = moi.flatMap((kq) => (kq.ok ? kq.giaTri : []))
    expect(tatCa.some((n) => n.vaiTroTrongDuAn !== null)).toBe(true)
    expect(tatCa.some((n) => n.vaiTroTrongDuAn === null)).toBe(true)
    expect(tatCa.some((n) => n.soTaskDangGiu > 0)).toBe(true)
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

  it('Task mẫu có đủ ba Mức ưu tiên và có Task có dòng lịch sử đổi Mức ưu tiên', async () => {
    const kho = await dungKhoMau()
    const pm = await kho.dangNhap({ email: PM_CHAY_THU.email, matKhau: PM_CHAY_THU.matKhau })
    if (!pm.ok) throw new Error('PM không đăng nhập được')
    const duAn = await kho.danhSachDuAn(pm.giaTri)
    if (!duAn.ok) throw new Error('không đọc được Dự án')
    const moi = await Promise.all(duAn.giaTri.map((d) => kho.danhSachTask(pm.giaTri, d.id)))
    const tatCa = moi.flatMap((kq) => (kq.ok ? kq.giaTri : []))
    expect(new Set(tatCa.map((t) => t.mucUuTien))).toEqual(new Set(['THAP', 'TRUNG_BINH', 'CAO']))
    const lichSu = await Promise.all(tatCa.map((t) => kho.lichSuTask(pm.giaTri, t.id)))
    expect(lichSu.some((kq) => kq.ok && kq.giaTri.some((d) => d.loai === 'MUC_UU_TIEN'))).toBe(true)
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
