// Bộ test hợp đồng cho Mã Dự án và Khách hàng (ticket truong-moi 01): tạo, sửa, trùng Mã, quyền,
// Dấu vết và Mã đi kèm các danh sách. Tách khỏi `hopDong.ts` cho gọn; mọi bản cài gọi
// `chayHopDongMaDuAn` trong file `*.test.ts` của mình, với cùng `BanCaiHopDong`. Chỉ kiểm hành vi
// nhìn thấy qua giao diện `KhoDuLieu`. Mã dùng trong các ca đều sinh từ `maDuAnMoi`, để bản cài dùng
// DB thật chạy lại nhiều lần không vấp Mã của lần trước.
import { describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import { taoBoDemMaDuAn, type BanCaiHopDong, type TuyChonHopDong } from './hopDong'
import type { DuAn, KhoDuLieu, Phien } from './khoDuLieu'
import { DO_DAI_KHACH_HANG_TOI_DA, THONG_BAO_DU_AN } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-dung-1'
/** Đồng hồ truyền vào, không đọc giờ thật. */
const LUC_TAO = new Date('2026-04-10T09:30:00+07:00')
const LUC_SUA = new Date('2026-04-11T14:15:00+07:00')
const LUC_LUU_TRU = new Date('2026-04-12T08:00:00+07:00')

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

export function chayHopDongMaDuAn(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const maDuAnMoi = tuyChon.maDuAnMoi ?? taoBoDemMaDuAn('MA')
  const dongHoCuaKho = tuyChon.dongHoCuaKho ?? false
  const coTask = tuyChon.coTask ?? true
  /** Ngày mong đợi trong dấu vết: đúng giờ truyền vào, hoặc chỉ là một ngày nếu kho tự lấy giờ. */
  const luc = (moc: Date): Date => (dongHoCuaKho ? expect.any(Date) : moc)

  describe(`Mã Dự án và Khách hàng (hợp đồng) — ${tenBanCai}`, () => {
    let banCai: BanCaiHopDong
    let kho: KhoDuLieu

    async function khoiTao() {
      banCai = await taoBanCai()
      kho = banCai.kho
    }

    async function dangKyVaDangNhap(ten: string, tenHienThi = ten): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
      giaTri(await banCai.xacNhanEmail(email))
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    async function taoPM(ten: string, tenHienThi = ten): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi }))
      giaTri(await banCai.xacNhanEmail(email))
      await banCai.datVaiPM(email)
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    /** Người có vai `vai`, được `pm` thêm vào Dự án `duAn` nếu có. */
    async function taoNguoi(pm: Phien, ten: string, vai: VaiHeThong, duAn: DuAn | null, tenHienThi = ten): Promise<Phien> {
      const phien = await dangKyVaDangNhap(ten, tenHienThi)
      if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, phien.nguoiDungId, { vai }))
      if (duAn) giaTri(await kho.themNguoiVaoDuAn(pm, duAn.id, { email: emailMoi(ten) }))
      return phien
    }

    async function idCacDuAn(pm: Phien): Promise<string[]> {
      return giaTri(await kho.danhSachDuAn(pm))
        .map((d) => d.id)
        .sort()
    }

    describe('tạo Dự án', () => {
      it('Mã được cắt khoảng trắng và lưu dạng in hoa; Khách hàng tuỳ chọn, bỏ khoảng trắng hai đầu; đọc lại thấy đúng', async () => {
        await khoiTao()
        const pm = await taoPM('pm-tao-ma')
        const ma = maDuAnMoi()
        const duAn = giaTri(
          await kho.taoDuAn(pm, { ma: `  ${ma.toLowerCase()} `, ten: 'Cửa hàng', khachHang: '  Công ty An Phát  ' }, LUC_TAO),
        )
        expect(duAn.ma).toBe(ma.toUpperCase())
        expect(duAn.khachHang).toBe('Công ty An Phát')
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)
        expect(giaTri(await kho.danhSachDuAn(pm)).find((d) => d.id === duAn.id)).toEqual(duAn)

        const khongKhach = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Kho hàng' }, LUC_TAO))
        expect(khongKhach.khachHang).toBe('')
      })

      it.each([
        { ca: 'thiếu Mã', dauVao: { ten: 'Dự án' }, thongBao: THONG_BAO_DU_AN.maTrong },
        { ca: 'Mã rỗng', dauVao: { ma: '', ten: 'Dự án' }, thongBao: THONG_BAO_DU_AN.maTrong },
        { ca: 'Mã chỉ khoảng trắng', dauVao: { ma: '   ', ten: 'Dự án' }, thongBao: THONG_BAO_DU_AN.maTrong },
        { ca: 'Mã 1 ký tự', dauVao: { ma: 'A', ten: 'Dự án' }, thongBao: THONG_BAO_DU_AN.maSai },
        { ca: 'Mã 13 ký tự', dauVao: { ma: 'ABCDEFGHIJKLM', ten: 'Dự án' }, thongBao: THONG_BAO_DU_AN.maSai },
        { ca: 'Mã có dấu cách ở giữa', dauVao: { ma: 'SDV 012', ten: 'Dự án' }, thongBao: THONG_BAO_DU_AN.maSai },
        { ca: 'Mã có chữ có dấu', dauVao: { ma: 'ĐỨC-01', ten: 'Dự án' }, thongBao: THONG_BAO_DU_AN.maSai },
      ])('$ca: KHONG_HOP_LE kèm lỗi ở ô Mã, không tạo gì', async ({ dauVao, thongBao }) => {
        await khoiTao()
        const pm = await taoPM('pm-ma-sai')
        const truoc = await idCacDuAn(pm)
        // Ép kiểu: dữ liệu từ biểu mẫu có thể thiếu ô, Kho phải tự kiểm.
        const kq = await kho.taoDuAn(pm, dauVao as { ma: string; ten: string }, LUC_TAO)
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.ma).toBe(thongBao)
        expect(await idCacDuAn(pm)).toEqual(truoc)
      })

      it('Mã trùng Mã của Dự án khác (khác hoa thường, kể cả do PM khác tạo hay đã Lưu trữ): MA_DU_AN_DA_DUNG, khác lỗi sai dạng, không tạo gì', async () => {
        await khoiTao()
        const pmA = await taoPM('pm-trung-a')
        const pmB = await taoNguoi(pmA, 'pm-trung-b', 'PM', null)
        const ma = maDuAnMoi()
        const goc = giaTri(await kho.taoDuAn(pmA, { ma, ten: 'Gốc' }, LUC_TAO))
        const truoc = await idCacDuAn(pmA)

        for (const [phien, maThu] of [
          [pmA, ma],
          [pmB, ma.toLowerCase()],
          [pmB, `  ${ma.toLowerCase()}  `],
        ] as const) {
          const kq = await kho.taoDuAn(phien, { ma: maThu, ten: 'Bản sao' }, LUC_TAO)
          expect(maLoi(kq)).toBe('MA_DU_AN_DA_DUNG')
          expect(maLoi(kq)).not.toBe('KHONG_HOP_LE')
          if (!kq.ok) expect(kq.loi.loiTheoO?.ma).toBe(THONG_BAO_DU_AN.maTrung)
        }
        expect(await idCacDuAn(pmA)).toEqual(truoc)

        // Dự án đã Lưu trữ vẫn giữ Mã của nó.
        giaTri(await kho.luuTruDuAn(pmA, goc.id, LUC_LUU_TRU))
        expect(maLoi(await kho.taoDuAn(pmB, { ma: ma.toLowerCase(), ten: 'Bản sao' }, LUC_TAO))).toBe('MA_DU_AN_DA_DUNG')
        expect(await idCacDuAn(pmA)).toEqual(truoc)
      })

      it('Khách hàng đúng 120 ký tự được; 121 ký tự: KHONG_HOP_LE kèm lỗi ở ô Khách hàng, không tạo gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-khach-dai')
        const vua = 'k'.repeat(DO_DAI_KHACH_HANG_TOI_DA)
        expect(giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Vừa', khachHang: vua }, LUC_TAO)).khachHang).toBe(vua)
        const truoc = await idCacDuAn(pm)
        const kq = await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Quá dài', khachHang: `${vua}k` }, LUC_TAO)
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.khachHang).toBe(THONG_BAO_DU_AN.khachHangQuaDai)
        expect(await idCacDuAn(pm)).toEqual(truoc)
      })
    })

    describe('sửa Mã và Khách hàng', () => {
      it.each<{ vai: VaiHeThong; ten: string }>([
        { vai: 'PM', ten: 'PM' },
        { vai: 'SUPPORT', ten: 'Support của Dự án' },
      ])('$ten sửa Mã và Khách hàng: lưu Mã in hoa; Dấu vết ghi người sửa và thời điểm, giữ người và ngày tạo', async ({ vai }) => {
        await khoiTao()
        const pm = await taoPM('pm-sua-ma', 'An PM')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng', khachHang: 'Cũ' }, LUC_TAO))
        const nguoiSua = vai === 'PM' ? await taoNguoi(pm, 'pm-sua-khac', 'PM', null, 'Bình') : await taoNguoi(pm, 'support-sua', 'SUPPORT', duAn, 'Bình')
        const maMoi = maDuAnMoi()

        const sua = giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { ma: maMoi.toLowerCase(), khachHang: ' Mới ' }, LUC_SUA))
        expect(sua).toEqual({
          ...duAn,
          ma: maMoi.toUpperCase(),
          khachHang: 'Mới',
          dauVet: {
            taoBoi: duAn.dauVet.taoBoi,
            taoLuc: luc(LUC_TAO),
            suaBoi: { id: nguoiSua.nguoiDungId, tenHienThi: 'Bình' },
            suaLuc: luc(LUC_SUA),
          },
        })
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(sua)

        // Mã cũ được giải phóng: Dự án mới dùng lại được.
        expect(giaTri(await kho.taoDuAn(pm, { ma: duAn.ma, ten: 'Dùng lại mã cũ' }, LUC_TAO)).ma).toBe(duAn.ma)

        // Để trống Khách hàng là xoá.
        expect(giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { khachHang: '   ' }, LUC_SUA)).khachHang).toBe('')
      })

      it('sửa sang Mã của chính Dự án đó (kể cả khác hoa thường) không bị coi là trùng', async () => {
        await khoiTao()
        const pm = await taoPM('pm-ma-minh')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const sua = giaTri(await kho.suaDuAn(pm, duAn.id, { ma: duAn.ma.toLowerCase(), ten: 'Cửa hàng 2' }, LUC_SUA))
        expect(sua.ma).toBe(duAn.ma)
        expect(sua.ten).toBe('Cửa hàng 2')
      })

      it('sửa sang Mã của Dự án khác (khác hoa thường): MA_DU_AN_DA_DUNG kèm lỗi ở ô Mã, không đổi gì kể cả Dấu vết', async () => {
        await khoiTao()
        const pm = await taoPM('pm-sua-trung')
        const khac = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Khác' }, LUC_TAO))
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const kq = await kho.suaDuAn(pm, duAn.id, { ma: khac.ma.toLowerCase(), khachHang: 'Không được lưu' }, LUC_SUA)
        expect(maLoi(kq)).toBe('MA_DU_AN_DA_DUNG')
        if (!kq.ok) expect(kq.loi.loiTheoO?.ma).toBe(THONG_BAO_DU_AN.maTrung)
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)
      })

      it('sửa với Mã sai dạng hay Khách hàng quá 120 ký tự: KHONG_HOP_LE kèm lỗi cạnh ô, không đổi gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-sua-sai')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        for (const [dauVao, o, thongBao] of [
          [{ ma: '' }, 'ma', THONG_BAO_DU_AN.maTrong],
          [{ ma: 'A' }, 'ma', THONG_BAO_DU_AN.maSai],
          [{ ma: 'SDV 012' }, 'ma', THONG_BAO_DU_AN.maSai],
          [{ khachHang: 'k'.repeat(DO_DAI_KHACH_HANG_TOI_DA + 1) }, 'khachHang', THONG_BAO_DU_AN.khachHangQuaDai],
        ] as const) {
          const kq = await kho.suaDuAn(pm, duAn.id, dauVao, LUC_SUA)
          expect(maLoi(kq)).toBe('KHONG_HOP_LE')
          if (!kq.ok) expect(kq.loi.loiTheoO?.[o]).toBe(thongBao)
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)
      })

      it('Thành viên (kể cả trong Dự án) và Support ngoài Dự án: KHONG_CO_QUYEN, không đổi gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-quyen-ma')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const thanhVien = await taoNguoi(pm, 'tv-trong', 'THANH_VIEN', duAn)
        const supportNgoai = await taoNguoi(pm, 'support-ngoai', 'SUPPORT', null)
        for (const phien of [thanhVien, supportNgoai]) {
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { ma: maDuAnMoi() }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { khachHang: 'Lén' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)
      })

      it('Dự án đã Lưu trữ: sửa Mã hay Khách hàng trả DU_AN_DA_LUU_TRU, không đổi gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-luu-ma')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const support = await taoNguoi(pm, 'support-luu', 'SUPPORT', duAn)
        const daLuu = giaTri(await kho.luuTruDuAn(pm, duAn.id, LUC_LUU_TRU))
        for (const phien of [pm, support]) {
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { ma: maDuAnMoi() }, LUC_SUA))).toBe('DU_AN_DA_LUU_TRU')
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { khachHang: 'Lén' }, LUC_SUA))).toBe('DU_AN_DA_LUU_TRU')
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(daLuu)
      })
    })

    describe('Mã đi kèm các danh sách', () => {
      it('"Dự án của tôi" trả Mã cạnh tên', async () => {
        await khoiTao()
        const pm = await taoPM('pm-ds-ma')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const an = await taoNguoi(pm, 'an-ds-ma', 'THANH_VIEN', duAn)
        expect(giaTri(await kho.danhSachDuAnCuaToi(an))).toEqual([
          { id: duAn.id, ma: duAn.ma, ten: 'Cửa hàng', trangThai: 'HOAT_DONG' },
        ])
      })

      const itTask = coTask ? it : it.skip
      itTask('"Việc của tôi" và "Chờ tôi duyệt" trả tên và Mã Dự án của từng Task; đổi Mã thì danh sách đổi theo', async () => {
        await khoiTao()
        const pm = await taoPM('pm-viec-ma')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const an = await taoNguoi(pm, 'an-viec-ma', 'THANH_VIEN', duAn)
        const binh = await taoNguoi(pm, 'binh-viec-ma', 'THANH_VIEN', duAn)
        const task = giaTri(
          await kho.taoTask(pm, duAn.id, { tieuDe: 'Làm giỏ hàng', nguoiThucHienId: an.nguoiDungId, nguoiKiemTraId: binh.nguoiDungId }, LUC_TAO),
        )
        giaTri(await kho.doiTrangThaiTask(an, task.id, { sang: 'DANG_LAM' }, LUC_SUA))
        giaTri(await kho.doiTrangThaiTask(an, task.id, { sang: 'CHO_DUYET' }, LUC_SUA))

        const viec = giaTri(await kho.viecCuaToi(an))
        expect(viec.map((t) => [t.id, t.tenDuAn, t.maDuAn])).toEqual([[task.id, 'Cửa hàng', duAn.ma]])
        const cho = giaTri(await kho.choToiDuyet(binh))
        expect(cho.map((t) => [t.id, t.tenDuAn, t.maDuAn])).toEqual([[task.id, 'Cửa hàng', duAn.ma]])

        const maMoi = maDuAnMoi()
        giaTri(await kho.suaDuAn(pm, duAn.id, { ma: maMoi }, LUC_SUA))
        expect(giaTri(await kho.viecCuaToi(an)).map((t) => t.maDuAn)).toEqual([maMoi.toUpperCase()])
      })
    })
  })
}
