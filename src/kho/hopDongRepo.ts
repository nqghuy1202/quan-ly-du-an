// Bộ test hợp đồng của phần repo GitHub trong Kho dữ liệu (ticket 15): gắn, gỡ, xem repo của Dự án.
// Tách khỏi `hopDong.ts` cho gọn; mọi bản cài gọi `chayHopDongRepo` trong file `*.test.ts` của mình,
// với cùng `BanCaiHopDong`. Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`.
import { describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import type { BanCaiHopDong, TuyChonHopDong } from './hopDong'
import type { DuAn, KhoDuLieu, Phien } from './khoDuLieu'
import { THONG_BAO_REPO } from '../luat/github'
import { THONG_BAO_DU_AN } from '../luat/duAn'
import { CAC_VAI, type VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-dung-1'
const LUC = new Date('2026-04-10T09:30:00+07:00')

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

export function chayHopDongRepo(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)

  describe(`Repo GitHub của Dự án (hợp đồng) — ${tenBanCai}`, () => {
    let banCai: BanCaiHopDong
    let kho: KhoDuLieu

    async function khoiTao() {
      banCai = await taoBanCai()
      kho = banCai.kho
    }

    async function dangKyVaDangNhap(ten: string): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten }))
      giaTri(await banCai.xacNhanEmail(email))
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    async function taoPM(ten: string): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: ten }))
      giaTri(await banCai.xacNhanEmail(email))
      await banCai.datVaiPM(email)
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    /** Người có vai `vai`, được `pm` thêm vào Dự án nếu `trongDuAn`. */
    async function taoNguoi(pm: Phien, duAn: DuAn, ten: string, vai: VaiHeThong, trongDuAn: boolean): Promise<Phien> {
      const phien = await dangKyVaDangNhap(ten)
      if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, phien.nguoiDungId, { vai }))
      if (trongDuAn) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi(ten) }))
      return phien
    }

    async function tenCacRepo(phien: Phien, duAnId: string): Promise<string[]> {
      return giaTri(await kho.danhSachRepoCuaDuAn(phien, duAnId))
        .map((repo) => repo.tenRepo)
        .sort()
    }

    it('PM gắn repo đúng dạng chủ-sở-hữu/tên-repo: repo vào danh sách, nhiều repo, mỗi Dự án một danh sách riêng', async () => {
      await khoiTao()
      const pm = await taoPM('pm-gan')
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Cửa hàng' }, LUC))
      const khac = giaTri(await kho.taoDuAn(pm, { ten: 'Dự án khác' }, LUC))
      expect(await tenCacRepo(pm, duAn.id)).toEqual([])

      expect(giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'vercel/next.js' }))).toEqual({ tenRepo: 'vercel/next.js' })
      // Bỏ khoảng trắng hai đầu; chấp nhận chữ hoa, số, gạch ngang, gạch dưới, dấu chấm.
      giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: '  Acme-Co/web_app.v2  ' }))
      expect(await tenCacRepo(pm, duAn.id)).toEqual(['Acme-Co/web_app.v2', 'vercel/next.js'])
      expect(await tenCacRepo(pm, khac.id)).toEqual([])
    })

    it('định dạng sai trả REPO_KHONG_HOP_LE kèm lỗi ở ô repo, không gắn gì', async () => {
      await khoiTao()
      const pm = await taoPM('pm-sai')
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC))
      const sai = [
        '',
        '   ',
        'khong-co-gach-cheo',
        'a/b/c',
        '/repo',
        'chu/',
        'chu so huu/repo',
        'chu/ten repo',
        '-chu/repo',
        'chu-/repo',
        'chu_so/repo',
        'chu/..',
        'chu/.',
        'https://github.com/chu/repo',
        'chu/repo/issues/1',
        `${'a'.repeat(40)}/repo`,
        `chu/${'r'.repeat(101)}`,
      ]
      for (const repo of sai) {
        const kq = await kho.ganRepoVaoDuAn(pm, duAn.id, { repo })
        expect(maLoi(kq), `"${repo}"`).toBe('REPO_KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.repo).toBe(THONG_BAO_REPO.sai)
      }
      expect(maLoi(await kho.ganRepoVaoDuAn(pm, duAn.id, {} as { repo: string }))).toBe('REPO_KHONG_HOP_LE')
      expect(await tenCacRepo(pm, duAn.id)).toEqual([])
    })

    it('gắn trùng (không phân biệt hoa thường) trả REPO_DA_GAN và danh sách không đổi; Dự án khác gắn lại được', async () => {
      await khoiTao()
      const pm = await taoPM('pm-trung')
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC))
      const khac = giaTri(await kho.taoDuAn(pm, { ten: 'B' }, LUC))
      giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'Vercel/Next.js' }))
      for (const repo of ['Vercel/Next.js', 'vercel/next.js', 'VERCEL/NEXT.JS', ' vercel/next.js ']) {
        expect(maLoi(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo })), repo).toBe('REPO_DA_GAN')
      }
      expect(await tenCacRepo(pm, duAn.id)).toEqual(['Vercel/Next.js'])
      expect(maLoi(await kho.ganRepoVaoDuAn(pm, khac.id, { repo: 'vercel/next.js' }))).toBe('THANH_CONG')
    })

    it('gỡ repo (không phân biệt hoa thường) thì repo ra khỏi danh sách và gắn lại được; gỡ repo chưa gắn trả KHONG_TIM_THAY', async () => {
      await khoiTao()
      const pm = await taoPM('pm-go')
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC))
      giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/api' }))
      giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/web' }))

      expect(giaTri(await kho.goRepoKhoiDuAn(pm, duAn.id, 'ACME/Api'))).toBeNull()
      expect(await tenCacRepo(pm, duAn.id)).toEqual(['acme/web'])
      expect(maLoi(await kho.goRepoKhoiDuAn(pm, duAn.id, 'acme/api'))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.goRepoKhoiDuAn(pm, duAn.id, 'chua/gan'))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.goRepoKhoiDuAn(pm, duAn.id, 'khong-hop-le'))).toBe('KHONG_TIM_THAY')
      expect(await tenCacRepo(pm, duAn.id)).toEqual(['acme/web'])

      expect(maLoi(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/api' }))).toBe('THANH_CONG')
    })

    it('Dự án không tồn tại: PM nhận KHONG_TIM_THAY với cả ba lệnh', async () => {
      await khoiTao()
      const pm = await taoPM('pm-khong-co')
      expect(maLoi(await kho.ganRepoVaoDuAn(pm, 'khong-ton-tai', { repo: 'a/b' }))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.goRepoKhoiDuAn(pm, 'khong-ton-tai', 'a/b'))).toBe('KHONG_TIM_THAY')
      expect(maLoi(await kho.danhSachRepoCuaDuAn(pm, 'khong-ton-tai'))).toBe('KHONG_TIM_THAY')
    })

    it('Support của Dự án gắn và gỡ được repo như PM', async () => {
      await khoiTao()
      const pm = await taoPM('pm-sp')
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC))
      const support = await taoNguoi(pm, duAn, 'support-sp', 'SUPPORT', true)
      expect(maLoi(await kho.ganRepoVaoDuAn(support, duAn.id, { repo: 'acme/api' }))).toBe('THANH_CONG')
      expect(await tenCacRepo(pm, duAn.id)).toEqual(['acme/api'])
      expect(maLoi(await kho.goRepoKhoiDuAn(support, duAn.id, 'acme/api'))).toBe('THANH_CONG')
      expect(await tenCacRepo(pm, duAn.id)).toEqual([])
    })

    it('Thành viên (kể cả trong Dự án) và Support ngoài Dự án gắn hoặc gỡ repo nhận KHONG_CO_QUYEN, không đổi gì', async () => {
      await khoiTao()
      const pm = await taoPM('pm-quyen')
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC))
      giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/api' }))
      const tvTrong = await taoNguoi(pm, duAn, 'tv-trong', 'THANH_VIEN', true)
      const tvNgoai = await taoNguoi(pm, duAn, 'tv-ngoai', 'THANH_VIEN', false)
      const spNgoai = await taoNguoi(pm, duAn, 'sp-ngoai', 'SUPPORT', false)

      for (const phien of [tvTrong, tvNgoai, spNgoai]) {
        expect(maLoi(await kho.ganRepoVaoDuAn(phien, duAn.id, { repo: 'acme/web' }))).toBe('KHONG_CO_QUYEN')
        // Quyền được kiểm trước dữ liệu: người không có quyền không biết được repo sai định dạng hay trùng.
        expect(maLoi(await kho.ganRepoVaoDuAn(phien, duAn.id, { repo: 'sai' }))).toBe('KHONG_CO_QUYEN')
        expect(maLoi(await kho.ganRepoVaoDuAn(phien, duAn.id, { repo: 'acme/api' }))).toBe('KHONG_CO_QUYEN')
        expect(maLoi(await kho.goRepoKhoiDuAn(phien, duAn.id, 'acme/api'))).toBe('KHONG_CO_QUYEN')
        expect(maLoi(await kho.goRepoKhoiDuAn(phien, duAn.id, 'chua/gan'))).toBe('KHONG_CO_QUYEN')
      }
      expect(await tenCacRepo(pm, duAn.id)).toEqual(['acme/api'])
    })

    it('Dự án đã Lưu trữ: gắn và gỡ trả DU_AN_DA_LUU_TRU (với người quản lý được), danh sách vẫn xem được', async () => {
      await khoiTao()
      const pm = await taoPM('pm-lt')
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC))
      const support = await taoNguoi(pm, duAn, 'support-lt', 'SUPPORT', true)
      const tv = await taoNguoi(pm, duAn, 'tv-lt', 'THANH_VIEN', true)
      giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/api' }))
      giaTri(await kho.luuTruDuAn(pm, duAn.id, LUC))

      for (const phien of [pm, support]) {
        const kq = await kho.ganRepoVaoDuAn(phien, duAn.id, { repo: 'acme/web' })
        expect(maLoi(kq)).toBe('DU_AN_DA_LUU_TRU')
        if (!kq.ok) expect(kq.loi.thongBao).toBe(THONG_BAO_DU_AN.daLuuTru)
        expect(maLoi(await kho.goRepoKhoiDuAn(phien, duAn.id, 'acme/api'))).toBe('DU_AN_DA_LUU_TRU')
      }
      // Người không quản lý được vẫn chỉ nhận KHONG_CO_QUYEN (quyền kiểm trước trạng thái).
      expect(maLoi(await kho.ganRepoVaoDuAn(tv, duAn.id, { repo: 'acme/web' }))).toBe('KHONG_CO_QUYEN')
      for (const phien of [pm, support, tv]) expect(await tenCacRepo(phien, duAn.id)).toEqual(['acme/api'])

      // Mở lại thì gắn được trở lại.
      giaTri(await kho.moLaiDuAn(pm, duAn.id, LUC))
      expect(maLoi(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/web' }))).toBe('THANH_CONG')
    })

    it('mọi người trong dự án xem được danh sách repo, mọi vai; người ngoài nhận KHONG_TIM_THAY (PM thấy mọi Dự án)', async () => {
      await khoiTao()
      const pm = await taoPM('pm-xem')
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC))
      giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/api' }))
      giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/web' }))

      for (const vai of CAC_VAI) {
        const trong = await taoNguoi(pm, duAn, `trong-${vai}`.toLowerCase().replace('_', '-'), vai, true)
        expect(await tenCacRepo(trong, duAn.id), vai).toEqual(['acme/api', 'acme/web'])
      }
      const tvNgoai = await taoNguoi(pm, duAn, 'ngoai-tv', 'THANH_VIEN', false)
      const spNgoai = await taoNguoi(pm, duAn, 'ngoai-sp', 'SUPPORT', false)
      const khongTonTai = await kho.danhSachRepoCuaDuAn(tvNgoai, 'khong-ton-tai')
      for (const phien of [tvNgoai, spNgoai]) {
        expect(maLoi(await kho.danhSachRepoCuaDuAn(phien, duAn.id))).toBe('KHONG_TIM_THAY')
        // Giống hệt Dự án không tồn tại: không lộ rằng Dự án có thật.
        expect(await kho.danhSachRepoCuaDuAn(phien, duAn.id)).toEqual(khongTonTai)
      }
      expect(await tenCacRepo(pm, duAn.id)).toEqual(['acme/api', 'acme/web'])
    })

    it('người bị gỡ khỏi Dự án không còn thấy repo của Dự án đó', async () => {
      await khoiTao()
      const pm = await taoPM('pm-roi')
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'A' }, LUC))
      giaTri(await kho.ganRepoVaoDuAn(pm, duAn.id, { repo: 'acme/api' }))
      const chi = await taoNguoi(pm, duAn, 'chi-roi', 'THANH_VIEN', true)
      expect(await tenCacRepo(chi, duAn.id)).toEqual(['acme/api'])
      giaTri(await kho.goNguoiKhoiDuAn(pm, duAn.id, chi.nguoiDungId))
      expect(maLoi(await kho.danhSachRepoCuaDuAn(chi, duAn.id))).toBe('KHONG_TIM_THAY')
    })

    it('chưa đăng nhập: cả ba lệnh trả CHUA_DANG_NHAP', async () => {
      await khoiTao()
      expect(maLoi(await kho.ganRepoVaoDuAn(null, 'du-an', { repo: 'a/b' }))).toBe('CHUA_DANG_NHAP')
      expect(maLoi(await kho.goRepoKhoiDuAn(null, 'du-an', 'a/b'))).toBe('CHUA_DANG_NHAP')
      expect(maLoi(await kho.danhSachRepoCuaDuAn(null, 'du-an'))).toBe('CHUA_DANG_NHAP')
    })
  })
}
