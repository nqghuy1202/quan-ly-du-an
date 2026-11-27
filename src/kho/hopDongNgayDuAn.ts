// Bộ test hợp đồng cho Ngày bắt đầu và Ngày kết thúc dự kiến của Dự án (ticket truong-moi 02): tạo, sửa,
// luật ngày (kết thúc không trước bắt đầu), quyền và Dấu vết. Tách khỏi `hopDong.ts` cho gọn; mọi bản
// cài gọi `chayHopDongNgayDuAn` trong file `*.test.ts` của mình, với cùng `BanCaiHopDong`. Chỉ kiểm hành
// vi nhìn thấy qua giao diện `KhoDuLieu`. Mã dùng trong các ca đều sinh từ `maDuAnMoi`.
import { describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import { taoBoDemMaDuAn, type BanCaiHopDong, type TuyChonHopDong } from './hopDong'
import type { DuAn, KhoDuLieu, Phien } from './khoDuLieu'
import { THONG_BAO_DU_AN } from '../luat/duAn'
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

export function chayHopDongNgayDuAn(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const maDuAnMoi = tuyChon.maDuAnMoi ?? taoBoDemMaDuAn('NG')
  const dongHoCuaKho = tuyChon.dongHoCuaKho ?? false
  /** Ngày mong đợi trong dấu vết: đúng giờ truyền vào, hoặc chỉ là một ngày nếu kho tự lấy giờ. */
  const luc = (moc: Date): Date => (dongHoCuaKho ? expect.any(Date) : moc)

  describe(`Ngày của Dự án (hợp đồng) — ${tenBanCai}`, () => {
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
      it('lưu được hai ngày (chỉ ngày, không giờ); đọc lại và danh sách thấy đúng; không nhập thì là null', async () => {
        await khoiTao()
        const pm = await taoPM('pm-tao-ngay')
        const duAn = giaTri(
          await kho.taoDuAn(
            pm,
            { ma: maDuAnMoi(), ten: 'Cửa hàng', ngayBatDau: '2026-05-01', ngayKetThucDuKien: '2026-11-25' },
            LUC_TAO,
          ),
        )
        expect(duAn.ngayBatDau).toBe('2026-05-01')
        expect(duAn.ngayKetThucDuKien).toBe('2026-11-25')
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)
        expect(giaTri(await kho.danhSachDuAn(pm)).find((d) => d.id === duAn.id)).toEqual(duAn)

        const khongNgay = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Kho hàng' }, LUC_TAO))
        expect(khongNgay.ngayBatDau).toBeNull()
        expect(khongNgay.ngayKetThucDuKien).toBeNull()
      })

      it('hai ngày bằng nhau hợp lệ; chỉ có một trong hai ngày hợp lệ', async () => {
        await khoiTao()
        const pm = await taoPM('pm-ngay-hop-le')
        const bang = giaTri(
          await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Bằng', ngayBatDau: '2026-06-01', ngayKetThucDuKien: '2026-06-01' }, LUC_TAO),
        )
        expect([bang.ngayBatDau, bang.ngayKetThucDuKien]).toEqual(['2026-06-01', '2026-06-01'])
        const chiBatDau = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Bắt đầu', ngayBatDau: '2026-06-01' }, LUC_TAO))
        expect([chiBatDau.ngayBatDau, chiBatDau.ngayKetThucDuKien]).toEqual(['2026-06-01', null])
        const chiKetThuc = giaTri(
          await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Kết thúc', ngayBatDau: null, ngayKetThucDuKien: '2026-01-01' }, LUC_TAO),
        )
        expect([chiKetThuc.ngayBatDau, chiKetThuc.ngayKetThucDuKien]).toEqual([null, '2026-01-01'])
      })

      it('Ngày kết thúc dự kiến trước Ngày bắt đầu: KHONG_HOP_LE kèm lỗi tiếng Việt ở ô Ngày kết thúc dự kiến, không tạo gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-ngay-nguoc')
        const truoc = await idCacDuAn(pm)
        const kq = await kho.taoDuAn(
          pm,
          { ma: maDuAnMoi(), ten: 'Ngược', ngayBatDau: '2026-06-02', ngayKetThucDuKien: '2026-06-01' },
          LUC_TAO,
        )
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.ngayKetThucDuKien).toBe(THONG_BAO_DU_AN.ngayKetThucTruocBatDau)
        expect(await idCacDuAn(pm)).toEqual(truoc)
      })

      it('ngày không có thật hay sai dạng: KHONG_HOP_LE kèm lỗi ở đúng ô, không tạo gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-ngay-sai')
        const truoc = await idCacDuAn(pm)
        const batDau = await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Sai', ngayBatDau: '2026-02-30' }, LUC_TAO)
        expect(maLoi(batDau)).toBe('KHONG_HOP_LE')
        if (!batDau.ok) expect(batDau.loi.loiTheoO?.ngayBatDau).toBe(THONG_BAO_DU_AN.ngayBatDauSai)
        const ketThuc = await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Sai', ngayKetThucDuKien: '25/11/2026' }, LUC_TAO)
        expect(maLoi(ketThuc)).toBe('KHONG_HOP_LE')
        if (!ketThuc.ok) expect(ketThuc.loi.loiTheoO?.ngayKetThucDuKien).toBe(THONG_BAO_DU_AN.ngayKetThucSai)
        expect(await idCacDuAn(pm)).toEqual(truoc)
      })
    })

    describe('sửa hai ngày', () => {
      it.each<{ vai: VaiHeThong; ten: string }>([
        { vai: 'PM', ten: 'PM' },
        { vai: 'SUPPORT', ten: 'Support của Dự án' },
      ])('$ten sửa hai ngày: lưu được; Dấu vết ghi người sửa và thời điểm, giữ người và ngày tạo', async ({ vai }) => {
        await khoiTao()
        const pm = await taoPM('pm-sua-ngay', 'An PM')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const nguoiSua =
          vai === 'PM' ? await taoNguoi(pm, 'pm-sua-ngay-khac', 'PM', null, 'Bình') : await taoNguoi(pm, 'support-sua-ngay', 'SUPPORT', duAn, 'Bình')

        const sua = giaTri(
          await kho.suaDuAn(nguoiSua, duAn.id, { ngayBatDau: '2026-05-01', ngayKetThucDuKien: '2026-12-31' }, LUC_SUA),
        )
        expect(sua).toEqual({
          ...duAn,
          ngayBatDau: '2026-05-01',
          ngayKetThucDuKien: '2026-12-31',
          dauVet: {
            taoBoi: duAn.dauVet.taoBoi,
            taoLuc: luc(LUC_TAO),
            suaBoi: { id: nguoiSua.nguoiDungId, tenHienThi: 'Bình' },
            suaLuc: luc(LUC_SUA),
          },
        })
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(sua)

        // Chỉ gửi một ngày: ngày kia giữ nguyên. Gửi trống hay null là xoá ngày đó.
        const chiKetThuc = giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { ngayKetThucDuKien: '2026-06-30' }, LUC_SUA))
        expect([chiKetThuc.ngayBatDau, chiKetThuc.ngayKetThucDuKien]).toEqual(['2026-05-01', '2026-06-30'])
        const xoa = giaTri(await kho.suaDuAn(nguoiSua, duAn.id, { ngayBatDau: '', ngayKetThucDuKien: null }, LUC_SUA))
        expect([xoa.ngayBatDau, xoa.ngayKetThucDuKien]).toEqual([null, null])
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(xoa)
      })

      it('ngày gửi lên làm Ngày kết thúc dự kiến trước Ngày bắt đầu đang lưu (hay ngược lại): KHONG_HOP_LE ở ô vừa gửi, không đổi gì kể cả Dấu vết', async () => {
        await khoiTao()
        const pm = await taoPM('pm-sua-nguoc')
        const duAn = giaTri(
          await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng', ngayBatDau: '2026-05-01', ngayKetThucDuKien: '2026-06-01' }, LUC_TAO),
        )
        const ketThuc = await kho.suaDuAn(pm, duAn.id, { ngayKetThucDuKien: '2026-04-30', ten: 'Không được lưu' }, LUC_SUA)
        expect(maLoi(ketThuc)).toBe('KHONG_HOP_LE')
        if (!ketThuc.ok) expect(ketThuc.loi.loiTheoO?.ngayKetThucDuKien).toBe(THONG_BAO_DU_AN.ngayKetThucTruocBatDau)
        const batDau = await kho.suaDuAn(pm, duAn.id, { ngayBatDau: '2026-06-02' }, LUC_SUA)
        expect(maLoi(batDau)).toBe('KHONG_HOP_LE')
        if (!batDau.ok) expect(batDau.loi.loiTheoO?.ngayBatDau).toBe(THONG_BAO_DU_AN.ngayKetThucTruocBatDau)
        const caHai = await kho.suaDuAn(pm, duAn.id, { ngayBatDau: '2026-07-02', ngayKetThucDuKien: '2026-07-01' }, LUC_SUA)
        expect(maLoi(caHai)).toBe('KHONG_HOP_LE')
        if (!caHai.ok) expect(caHai.loi.loiTheoO?.ngayKetThucDuKien).toBe(THONG_BAO_DU_AN.ngayKetThucTruocBatDau)
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)

        // Đổi cùng lúc cả hai sang khoảng mới hợp lệ thì được, kể cả khi bắt đầu mới sau kết thúc cũ.
        const moi = giaTri(await kho.suaDuAn(pm, duAn.id, { ngayBatDau: '2026-07-01', ngayKetThucDuKien: '2026-07-01' }, LUC_SUA))
        expect([moi.ngayBatDau, moi.ngayKetThucDuKien]).toEqual(['2026-07-01', '2026-07-01'])
      })

      it('Thành viên (kể cả trong Dự án) và Support ngoài Dự án: KHONG_CO_QUYEN; Dự án đã Lưu trữ: DU_AN_DA_LUU_TRU; không đổi gì', async () => {
        await khoiTao()
        const pm = await taoPM('pm-quyen-ngay')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO))
        const thanhVien = await taoNguoi(pm, 'tv-ngay', 'THANH_VIEN', duAn)
        const supportNgoai = await taoNguoi(pm, 'support-ngoai-ngay', 'SUPPORT', null)
        const support = await taoNguoi(pm, 'support-trong-ngay', 'SUPPORT', duAn)
        for (const phien of [thanhVien, supportNgoai]) {
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { ngayKetThucDuKien: '2026-12-31' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(duAn)

        const daLuu = giaTri(await kho.luuTruDuAn(pm, duAn.id, LUC_LUU_TRU))
        for (const phien of [pm, support]) {
          expect(maLoi(await kho.suaDuAn(phien, duAn.id, { ngayBatDau: '2026-05-01' }, LUC_SUA))).toBe('DU_AN_DA_LUU_TRU')
        }
        expect(giaTri(await kho.layDuAn(pm, duAn.id))).toEqual(daLuu)
      })
    })
  })
}
