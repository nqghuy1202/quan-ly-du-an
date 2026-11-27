// Bộ test hợp đồng cho danh sách Dự án kèm số liệu (ticket truong-moi 07): mỗi Dự án đủ trường, kèm Tiến
// độ, số Task Trễ hạn và cờ Quá hạn dự kiến đúng với ngày hôm nay truyền vào; phạm vi "Dự án của tôi" và
// "Tất cả Dự án" giữ quyền xem như `danhSachDuAnCuaToi` và `danhSachDuAn`. Tách khỏi `hopDong.ts` cho gọn;
// mọi bản cài gọi `chayHopDongDuAnKemSoLieu` trong file `*.test.ts` của mình, với cùng `BanCaiHopDong`. Chỉ
// kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`. Task đi tới trạng thái cuối bằng đúng các bước của vòng
// duyệt (PM làm), không cần `datTrangThaiTask`.
import { describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import { taoBoDemMaDuAn, type BanCaiHopDong, type TuyChonHopDong } from './hopDong'
import type { DuAn, DuAnKemSoLieu, KhoDuLieu, PhamViDanhSachDuAn, Phien } from './khoDuLieu'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-dung-1'
/** Đồng hồ truyền vào, không đọc giờ thật. */
const LUC_TAO = new Date('2026-04-10T09:30:00+07:00')
const LUC_SUA = new Date('2026-04-11T14:15:00+07:00')
/** Hôm nay là 26/11/2026 theo giờ Việt Nam (đã sang ngày dù UTC vẫn là 25/11). */
const HOM_NAY = new Date('2026-11-25T18:00:00Z')
/** Một tuần trước đó: 19/11/2026. */
const TUAN_TRUOC = new Date('2026-11-19T09:00:00+07:00')

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

export function chayHopDongDuAnKemSoLieu(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const maDuAnMoi = tuyChon.maDuAnMoi ?? taoBoDemMaDuAn('SL')
  const coTask = tuyChon.coTask ?? true

  describe(`Danh sách Dự án kèm số liệu (hợp đồng) — ${tenBanCai}`, () => {
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

    /** Người có vai `vai`, được `pm` thêm vào các Dự án `duAn`. */
    async function taoNguoi(pm: Phien, ten: string, vai: VaiHeThong, duAn: DuAn[]): Promise<Phien> {
      const phien = await dangKyVaDangNhap(ten)
      if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, phien.nguoiDungId, { vai }))
      for (const d of duAn) giaTri(await kho.themNguoiVaoDuAn(pm, d.id, { email: emailMoi(ten) }))
      return phien
    }

    async function danhSach(phien: Phien, phamVi: PhamViDanhSachDuAn, bayGio = HOM_NAY): Promise<DuAnKemSoLieu[]> {
      return giaTri(await kho.danhSachDuAnKemSoLieu(phien, phamVi, bayGio))
    }

    const ids = (ds: readonly { id: string }[]) => ds.map((d) => d.id).sort()

    describe('số liệu theo ngày hôm nay truyền vào', () => {
      if (!coTask) {
        it.skip('CHƯA KIỂM: Tiến độ và số Trễ hạn, vì bản cài chưa có các lệnh Task (coTask: false)', () => {})
        return
      }

      it('mỗi Dự án đủ trường như layDuAn, kèm Tiến độ, số Task Trễ hạn, cờ Quá hạn dự kiến đúng với ngày truyền vào', async () => {
        await khoiTao()
        const pm = await taoPM('sl-pm')
        const taoDuAn = async (ten: string, ngayKetThucDuKien: string | null) =>
          giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten, ngayKetThucDuKien }, LUC_TAO))
        const dangChay = await taoDuAn('Đang chạy', '2026-11-20')
        const trong = await taoDuAn('Chưa có task', null)
        const xong = await taoDuAn('Đã xong', '2026-11-01')
        const luuTru = await taoDuAn('Lưu trữ', '2026-11-01')
        const an = await taoNguoi(pm, 'sl-an', 'THANH_VIEN', [dangChay, xong])
        const binh = await taoNguoi(pm, 'sl-binh', 'THANH_VIEN', [dangChay, xong])
        const giao = { nguoiThucHienId: an.nguoiDungId, nguoiKiemTraId: binh.nguoiDungId }

        async function taoTask(duAn: DuAn, tieuDe: string, han: string | null, buoc: string[]) {
          const task = giaTri(await kho.taoTask(pm, duAn.id, { tieuDe, han, ...giao }, LUC_TAO))
          for (const sang of buoc) {
            giaTri(await kho.doiTrangThaiTask(pm, task.id, { sang, lyDo: sang === 'HUY' ? 'Không làm nữa' : undefined }, LUC_SUA))
          }
        }
        const DEN_HOAN_THANH = ['DANG_LAM', 'CHO_DUYET', 'HOAN_THANH']
        // Đang chạy: 1 Hoàn thành / 4 Task đáng tính (Huỷ không tính) = 25%.
        await taoTask(dangChay, 'Xong', '2026-11-01', DEN_HOAN_THANH)
        await taoTask(dangChay, 'Đang làm', '2026-11-25', ['DANG_LAM'])
        await taoTask(dangChay, 'Chờ duyệt', '2026-11-01', ['DANG_LAM', 'CHO_DUYET'])
        await taoTask(dangChay, 'Hạn hôm nay', '2026-11-26', [])
        await taoTask(dangChay, 'Huỷ', '2026-11-01', ['HUY'])
        await taoTask(xong, 'Xong hết', '2026-11-01', DEN_HOAN_THANH)
        giaTri(await kho.luuTruDuAn(pm, luuTru.id, LUC_SUA))

        const homNay = await danhSach(pm, 'TAT_CA')
        const dong = (duAn: DuAn) => homNay.find((d) => d.id === duAn.id)
        // Phần Dự án giống hệt layDuAn (đủ Mã, Khách hàng, ngày, Mức ưu tiên, Người phụ trách, Dấu vết).
        for (const duAn of [dangChay, trong, xong, luuTru]) {
          expect(dong(duAn)).toEqual(expect.objectContaining(giaTri(await kho.layDuAn(pm, duAn.id))))
        }
        // 26/11: "Đang làm" (hạn 25/11) và "Chờ duyệt" (hạn 1/11) Trễ hạn; hạn hôm nay chưa trễ; Hoàn thành, Huỷ không trễ.
        expect(dong(dangChay)).toEqual(
          expect.objectContaining({ tienDo: { chuaCoTask: false, phanTram: 25 }, soTaskTreHan: 2, quaHanDuKien: true }),
        )
        expect(dong(trong)).toEqual(
          expect.objectContaining({ tienDo: { chuaCoTask: true }, soTaskTreHan: 0, quaHanDuKien: false }),
        )
        // Tiến độ 100% thì không Quá hạn dự kiến; Lưu trữ thì không Quá hạn dự kiến dù chưa có task.
        expect(dong(xong)).toEqual(
          expect.objectContaining({ tienDo: { chuaCoTask: false, phanTram: 100 }, soTaskTreHan: 0, quaHanDuKien: false }),
        )
        expect(dong(luuTru)).toEqual(
          expect.objectContaining({ trangThai: 'LUU_TRU', tienDo: { chuaCoTask: true }, soTaskTreHan: 0, quaHanDuKien: false }),
        )

        // 19/11: chưa qua Ngày kết thúc dự kiến 20/11; chỉ "Chờ duyệt" (hạn 1/11) Trễ hạn.
        const tuanTruoc = (await danhSach(pm, 'TAT_CA', TUAN_TRUOC)).find((d) => d.id === dangChay.id)
        expect(tuanTruoc).toEqual(
          expect.objectContaining({ tienDo: { chuaCoTask: false, phanTram: 25 }, soTaskTreHan: 1, quaHanDuKien: false }),
        )
        // Người trong dự án đọc "Dự án của tôi" thấy cùng số liệu.
        expect((await danhSach(an, 'CUA_TOI')).find((d) => d.id === dangChay.id)).toEqual(dong(dangChay))
      })
    })

    describe('phạm vi và quyền xem', () => {
      it('Dự án của tôi: Dự án người gọi đang ở trong (kể cả Lưu trữ, kể cả PM); Tất cả Dự án: như danhSachDuAn', async () => {
        await khoiTao()
        const pm = await taoPM('sl-pm-pv')
        const mot = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Một' }, LUC_TAO))
        const hai = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Hai' }, LUC_TAO))
        const support = await taoNguoi(pm, 'sl-support', 'SUPPORT', [mot])
        const thanhVien = await taoNguoi(pm, 'sl-tv', 'THANH_VIEN', [hai])
        const pmTrong = await taoNguoi(pm, 'sl-pm-trong', 'PM', [mot])
        const ngoai = await dangKyVaDangNhap('sl-ngoai')
        giaTri(await kho.luuTruDuAn(pm, hai.id, LUC_SUA))

        expect(ids(await danhSach(support, 'CUA_TOI'))).toEqual([mot.id])
        expect(ids(await danhSach(support, 'TAT_CA'))).toEqual([mot.id])
        expect(ids(await danhSach(thanhVien, 'CUA_TOI'))).toEqual([hai.id])
        expect(ids(await danhSach(thanhVien, 'TAT_CA'))).toEqual([hai.id])
        expect(ids(await danhSach(pmTrong, 'CUA_TOI'))).toEqual([mot.id])
        // PM thấy mọi Dự án ở Tất cả Dự án, nhưng Dự án của tôi chỉ có Dự án mình ở trong.
        expect(ids(await danhSach(pmTrong, 'TAT_CA'))).toEqual(expect.arrayContaining([mot.id, hai.id]))
        expect(ids(await danhSach(pm, 'CUA_TOI'))).toEqual([])
        expect(await danhSach(ngoai, 'CUA_TOI')).toEqual([])
        expect(await danhSach(ngoai, 'TAT_CA')).toEqual([])
        // Cùng tập Dự án như danhSachDuAn của từng người.
        for (const phien of [support, thanhVien, pm]) {
          expect(ids(await danhSach(phien, 'TAT_CA'))).toEqual(ids(giaTri(await kho.danhSachDuAn(phien))))
        }
      })

      it('chưa đăng nhập: CHUA_DANG_NHAP; phạm vi không có thật: KHONG_HOP_LE', async () => {
        await khoiTao()
        const pm = await taoPM('sl-pm-loi')
        expect(maLoi(await kho.danhSachDuAnKemSoLieu(null, 'TAT_CA', HOM_NAY))).toBe('CHUA_DANG_NHAP')
        const phienGia: Phien = { maPhien: 'khong-co', nguoiDungId: pm.nguoiDungId }
        expect(maLoi(await kho.danhSachDuAnKemSoLieu(phienGia, 'CUA_TOI', HOM_NAY))).toBe('CHUA_DANG_NHAP')
        expect(maLoi(await kho.danhSachDuAnKemSoLieu(pm, 'MOI_THU' as PhamViDanhSachDuAn, HOM_NAY))).toBe('KHONG_HOP_LE')
      })
    })
  })
}
