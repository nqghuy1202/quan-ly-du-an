// Phần cổng kiểm được của bản Supabase, không cần mạng hay DB: chọn bản cài theo cấu hình môi
// trường, từ chối khoá service (bằng khoá giả), và bộ test trên Supabase thật tự bỏ qua đúng.
import { describe, expect, it } from 'vitest'
import { BIEN_KHOA_SUPABASE, BIEN_URL_SUPABASE, docCauHinhKho, phanLoaiKhoa } from './cauHinh'
import { chonKho } from './chonKho'
import {
  BIEN_TEST_KHOA_CONG_KHAI,
  BIEN_TEST_KHOA_SERVICE,
  BIEN_TEST_TEN_MIEN,
  BIEN_TEST_THOI_HAN_MA,
  BIEN_TEST_URL,
  CO_CHAY_TEST_SUPABASE,
  cauHinhTestSupabase,
} from './hopDongSupabase'
import { PM_CHAY_THU } from './khoBoNho'
import type { Phien } from './khoDuLieu'
import { THONG_BAO } from '../luat/taiKhoan'

/** JWT giả (chữ ký không hợp lệ): chỉ phần thân được đọc để biết vai của khoá. */
function jwtGia(than: Record<string, unknown>): string {
  const ma = (doiTuong: Record<string, unknown>) =>
    btoa(JSON.stringify(doiTuong)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${ma({ alg: 'HS256', typ: 'JWT' })}.${ma(than)}.chu-ky-gia`
}

const URL_GIA = 'https://du-an-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'du-an-gia', role: 'anon' })
const KHOA_SERVICE = jwtGia({ iss: 'supabase', ref: 'du-an-gia', role: 'service_role' })
const KHOA_PUBLISHABLE = 'sb_publishable_khoa-gia-123'
const KHOA_SECRET = 'sb_secret_khoa-gia-456'

/** `fetch` cấm gọi mạng: đếm số lần bị gọi và luôn ném lỗi. */
function fetchCam(): { fetch: typeof fetch; soLanGoi: () => number } {
  let soLan = 0
  const fetchGia: typeof fetch = async () => {
    soLan += 1
    throw new Error('Test không được gọi mạng')
  }
  return { fetch: fetchGia, soLanGoi: () => soLan }
}

describe('phân loại khoá Supabase (không gọi mạng)', () => {
  it.each([
    { ten: 'JWT vai anon', khoa: KHOA_ANON, loai: 'CONG_KHAI' },
    { ten: 'khoá sb_publishable_', khoa: KHOA_PUBLISHABLE, loai: 'CONG_KHAI' },
    { ten: 'JWT vai service_role', khoa: KHOA_SERVICE, loai: 'SERVICE' },
    { ten: 'khoá sb_secret_', khoa: KHOA_SECRET, loai: 'SERVICE' },
    { ten: 'khoá service có khoảng trắng hai đầu', khoa: `  ${KHOA_SERVICE}\n`, loai: 'SERVICE' },
    { ten: 'JWT vai authenticated', khoa: jwtGia({ role: 'authenticated' }), loai: 'KHONG_RO' },
    { ten: 'JWT không có vai', khoa: jwtGia({ iss: 'supabase' }), loai: 'KHONG_RO' },
    { ten: 'chuỗi bất kỳ', khoa: 'khong-phai-khoa', loai: 'KHONG_RO' },
    { ten: 'ba phần nhưng không phải JWT', khoa: 'a.b.c', loai: 'KHONG_RO' },
  ])('$ten → $loai', ({ khoa, loai }) => {
    expect(phanLoaiKhoa(khoa)).toBe(loai)
  })
})

describe('chọn bản cài Kho theo cấu hình môi trường', () => {
  it('chạy thử không có cấu hình Supabase: bản bộ nhớ có hộp thư mô phỏng và PM chạy thử', async () => {
    const chon = chonKho({ DEV: true, PROD: false, MODE: 'development' })
    expect(chon.loai).toBe('BO_NHO')
    if (chon.loai !== 'BO_NHO') return
    expect(chon.moPhong).not.toBeNull()
    const phien = await chon.kho.dangNhap({ email: PM_CHAY_THU.email, matKhau: PM_CHAY_THU.matKhau })
    expect(phien.ok).toBe(true)
  })

  it('biến cấu hình để trống (chỉ khoảng trắng) coi như không có: bản bộ nhớ khi chạy thử', () => {
    expect(docCauHinhKho({ [BIEN_URL_SUPABASE]: '  ', [BIEN_KHOA_SUPABASE]: '' }).loai).toBe('BO_NHO')
  })

  it('bản dựng production thiếu cấu hình Supabase: lỗi, không lặng lẽ dùng bản bộ nhớ', () => {
    const chon = chonKho({ PROD: true })
    expect(chon.loai).toBe('LOI')
    if (chon.loai === 'LOI') expect(chon.thongBao).toMatch(/Thiếu cấu hình Supabase/)
  })

  it.each([
    { ten: 'khoá anon', khoa: KHOA_ANON },
    { ten: 'khoá publishable', khoa: KHOA_PUBLISHABLE },
  ])('địa chỉ và $ten: bản Supabase, không có hộp thư mô phỏng, dựng xong chưa gọi mạng', ({ khoa }) => {
    const mang = fetchCam()
    const chon = chonKho({ PROD: true, [BIEN_URL_SUPABASE]: URL_GIA, [BIEN_KHOA_SUPABASE]: khoa }, { fetch: mang.fetch })
    expect(chon.loai).toBe('SUPABASE')
    if (chon.loai !== 'SUPABASE') return
    expect(chon.moPhong).toBeNull()
    expect(mang.soLanGoi()).toBe(0)
  })

  it('bản Supabase từ chối ngay ở ranh giới, không gọi mạng: chưa đăng nhập, dữ liệu sai', async () => {
    const mang = fetchCam()
    const chon = chonKho({ [BIEN_URL_SUPABASE]: URL_GIA, [BIEN_KHOA_SUPABASE]: KHOA_ANON }, { fetch: mang.fetch })
    if (chon.loai !== 'SUPABASE') throw new Error(`Mong đợi bản Supabase, nhận ${chon.loai}`)
    const kho = chon.kho
    const phienGia: Phien = { maPhien: 'khong-ton-tai', nguoiDungId: 'khong-ton-tai' }
    const LUC = new Date('2026-04-10T09:30:00+07:00')

    for (const phien of [null, phienGia]) {
      expect(await kho.layHoSoCuaToi(phien)).toEqual(expect.objectContaining({ ok: false, loi: expect.objectContaining({ ma: 'CHUA_DANG_NHAP' }) }))
      for (const kq of [
        await kho.danhSachDuAn(phien),
        await kho.danhSachNguoiDung(phien),
        await kho.taoDuAn(phien, { ten: 'X' }, LUC),
        await kho.themNguoiVaoDuAn(phien, 'du-an', { email: 'ai@vi-du.vn' }),
        await kho.taoTask(phien, 'du-an', { tieuDe: 'X', nguoiThucHienId: 'a', nguoiKiemTraId: 'b' }, LUC),
        await kho.danhSachTask(phien, 'du-an'),
        await kho.layTask(phien, 'task'),
        await kho.ganRepoVaoDuAn(phien, 'du-an', { repo: 'a/b' }),
        await kho.goRepoKhoiDuAn(phien, 'du-an', 'a/b'),
        await kho.danhSachRepoCuaDuAn(phien, 'du-an'),
        await kho.themLienKetVaoTask(phien, 'task', { duongDan: 'https://github.com/a/b/issues/1' }, LUC),
        await kho.goLienKetKhoiTask(phien, 'task', { repo: 'a/b', loai: 'ISSUE', so: 1 }, LUC),
        await kho.danhSachLienKetCuaTask(phien, 'task'),
        await kho.dangXuat(phien),
      ]) {
        expect(kq.ok || kq.loi.ma).toBe('CHUA_DANG_NHAP')
      }
    }

    const dangKy = await kho.dangKy({ email: 'khong-phai-email', matKhau: '1234567', tenHienThi: '  ' })
    expect(dangKy.ok).toBe(false)
    if (!dangKy.ok) {
      expect(dangKy.loi.ma).toBe('KHONG_HOP_LE')
      expect(dangKy.loi.loiTheoO).toEqual({
        email: THONG_BAO.emailSai,
        matKhau: THONG_BAO.matKhauNgan,
        tenHienThi: THONG_BAO.tenTrong,
      })
    }
    const dangNhap = await kho.dangNhap({ email: '', matKhau: '' })
    expect(dangNhap.ok || dangNhap.loi.ma).toBe('SAI_THONG_TIN_DANG_NHAP')
    const guiLai = await kho.guiLaiThuXacNhan({ email: 'khong-phai-email' })
    expect(guiLai.ok || guiLai.loi.ma).toBe('KHONG_HOP_LE')
    const yeuCau = await kho.yeuCauDatLaiMatKhau({ email: 'khong-phai-email' }, LUC)
    expect(yeuCau.ok || yeuCau.loi.ma).toBe('KHONG_HOP_LE')
    // Mật khẩu mới sai bị từ chối trước khi gửi mã đi, nên không tiêu mã.
    const datLai = await kho.datLaiMatKhau({ email: 'an@vi-du.vn', ma: '123456', matKhauMoi: '1234567' }, LUC)
    expect(datLai.ok || datLai.loi.loiTheoO).toEqual({ matKhauMoi: THONG_BAO.matKhauNgan })

    expect(mang.soLanGoi()).toBe(0)
  })

  it.each([
    { ten: 'JWT vai service_role', khoa: KHOA_SERVICE },
    { ten: 'khoá sb_secret_', khoa: KHOA_SECRET },
  ])('khoá $ten trong biến khoá công khai bị từ chối, không dựng Kho nào', ({ khoa }) => {
    const chon = chonKho({ [BIEN_URL_SUPABASE]: URL_GIA, [BIEN_KHOA_SUPABASE]: khoa })
    expect(chon.loai).toBe('LOI')
    if (chon.loai === 'LOI') {
      expect(chon.thongBao).toMatch(/service/)
      expect(chon.thongBao).toContain(BIEN_KHOA_SUPABASE)
    }
  })

  it('khoá service trong bất kỳ biến VITE_* nào cũng bị từ chối, dù khoá ứng dụng dùng là khoá công khai', () => {
    for (const khoaService of [KHOA_SERVICE, KHOA_SECRET]) {
      const cauHinh = docCauHinhKho({
        [BIEN_URL_SUPABASE]: URL_GIA,
        [BIEN_KHOA_SUPABASE]: KHOA_ANON,
        VITE_SUPABASE_SERVICE_ROLE_KEY: khoaService,
      })
      expect(cauHinh.loai).toBe('LOI')
      if (cauHinh.loai === 'LOI') expect(cauHinh.thongBao).toContain('VITE_SUPABASE_SERVICE_ROLE_KEY')
    }
    // Kể cả khi chưa có cấu hình Supabase (đáng lẽ chạy bản bộ nhớ).
    expect(docCauHinhKho({ VITE_KHOA_LAC: KHOA_SERVICE }).loai).toBe('LOI')
  })

  it('biến không có tiền tố VITE_ (không bao giờ xuống trình duyệt) không ảnh hưởng việc chọn', () => {
    const cauHinh = docCauHinhKho({
      [BIEN_URL_SUPABASE]: URL_GIA,
      [BIEN_KHOA_SUPABASE]: KHOA_ANON,
      SUPABASE_TEST_SERVICE_ROLE_KEY: KHOA_SERVICE,
    })
    expect(cauHinh).toEqual({ loai: 'SUPABASE', url: URL_GIA, khoaCongKhai: KHOA_ANON })
  })

  it.each([
    { ten: 'chỉ có địa chỉ', env: { [BIEN_URL_SUPABASE]: URL_GIA }, bien: BIEN_KHOA_SUPABASE },
    { ten: 'chỉ có khoá', env: { [BIEN_KHOA_SUPABASE]: KHOA_ANON }, bien: BIEN_URL_SUPABASE },
    { ten: 'địa chỉ sai', env: { [BIEN_URL_SUPABASE]: 'khong phai dia chi', [BIEN_KHOA_SUPABASE]: KHOA_ANON }, bien: BIEN_URL_SUPABASE },
    { ten: 'địa chỉ không phải http', env: { [BIEN_URL_SUPABASE]: 'ftp://du-an-gia', [BIEN_KHOA_SUPABASE]: KHOA_ANON }, bien: BIEN_URL_SUPABASE },
    { ten: 'khoá không nhận ra', env: { [BIEN_URL_SUPABASE]: URL_GIA, [BIEN_KHOA_SUPABASE]: 'khong-phai-khoa' }, bien: BIEN_KHOA_SUPABASE },
    { ten: 'JWT vai authenticated', env: { [BIEN_URL_SUPABASE]: URL_GIA, [BIEN_KHOA_SUPABASE]: jwtGia({ role: 'authenticated' }) }, bien: BIEN_KHOA_SUPABASE },
  ])('$ten: lỗi cấu hình nói rõ biến nào sai', ({ env, bien }) => {
    const cauHinh = docCauHinhKho(env)
    expect(cauHinh.loai).toBe('LOI')
    if (cauHinh.loai === 'LOI') expect(cauHinh.thongBao).toContain(bien)
  })
})

describe('bộ test trên Supabase thật tự bỏ qua đúng', () => {
  const DU_CAU_HINH = {
    [BIEN_TEST_URL]: URL_GIA,
    [BIEN_TEST_KHOA_CONG_KHAI]: KHOA_ANON,
    [BIEN_TEST_KHOA_SERVICE]: KHOA_SERVICE,
  }

  it('lệnh test mặc định: bỏ qua và báo "chưa kiểm", kể cả khi máy có sẵn cấu hình test', () => {
    for (const env of [{}, DU_CAU_HINH, { ...DU_CAU_HINH, [CO_CHAY_TEST_SUPABASE]: '0' }]) {
      const kq = cauHinhTestSupabase(env)
      expect(kq.trangThai).toBe('BO_QUA')
      if (kq.trangThai === 'BO_QUA') {
        expect(kq.lyDo).toMatch(/^CHƯA KIỂM/)
        expect(kq.lyDo).toContain('vitest.supabase.config.ts')
      }
    }
  })

  it('lệnh riêng mà thiếu cấu hình: không chạy, báo "chưa kiểm" kèm tên biến thiếu (không báo đạt)', () => {
    const kq = cauHinhTestSupabase({ [CO_CHAY_TEST_SUPABASE]: '1', [BIEN_TEST_URL]: URL_GIA })
    expect(kq.trangThai).toBe('THIEU_CAU_HINH')
    if (kq.trangThai === 'THIEU_CAU_HINH') {
      expect(kq.lyDo).toMatch(/^CHƯA KIỂM/)
      expect(kq.lyDo).toContain(BIEN_TEST_KHOA_CONG_KHAI)
      expect(kq.lyDo).toContain(BIEN_TEST_KHOA_SERVICE)
      expect(kq.lyDo).not.toContain(BIEN_TEST_URL)
    }
  })

  it.each([
    { ten: 'khoá service đặt vào chỗ khoá công khai', sua: { [BIEN_TEST_KHOA_CONG_KHAI]: KHOA_SERVICE } },
    { ten: 'khoá công khai đặt vào chỗ khoá service', sua: { [BIEN_TEST_KHOA_SERVICE]: KHOA_ANON } },
    { ten: 'địa chỉ không phải http', sua: { [BIEN_TEST_URL]: 'du-an-gia.supabase.co' } },
    { ten: 'thời hạn mã không phải số dương', sua: { [BIEN_TEST_THOI_HAN_MA]: '-5' } },
  ])('lệnh riêng với $ten: không chạy, báo "chưa kiểm"', ({ sua }) => {
    const kq = cauHinhTestSupabase({ ...DU_CAU_HINH, ...sua, [CO_CHAY_TEST_SUPABASE]: '1' })
    expect(kq.trangThai).toBe('THIEU_CAU_HINH')
    if (kq.trangThai === 'THIEU_CAU_HINH') expect(kq.lyDo).toMatch(/^CHƯA KIỂM/)
  })

  it('lệnh riêng với đủ cấu hình: chạy, với tên miền email và thời hạn mã mặc định', () => {
    expect(cauHinhTestSupabase({ ...DU_CAU_HINH, [CO_CHAY_TEST_SUPABASE]: '1' })).toEqual({
      trangThai: 'CHAY',
      cauHinh: {
        url: URL_GIA,
        khoaCongKhai: KHOA_ANON,
        khoaService: KHOA_SERVICE,
        tenMien: 'example.com',
        thoiHanMaDatLaiMs: 3600 * 1000,
      },
    })
    const kq = cauHinhTestSupabase({
      ...DU_CAU_HINH,
      [CO_CHAY_TEST_SUPABASE]: '1',
      [BIEN_TEST_TEN_MIEN]: 'test.vi-du.vn',
      [BIEN_TEST_THOI_HAN_MA]: '900',
    })
    expect(kq.trangThai === 'CHAY' && kq.cauHinh).toEqual(
      expect.objectContaining({ tenMien: 'test.vi-du.vn', thoiHanMaDatLaiMs: 900 * 1000 }),
    )
  })
})
