// Bộ test hợp đồng của ticket 08: sửa Task, đổi người và báo khi gỡ người khỏi Dự án.
// Chạy lại cho mọi bản cài của Kho dữ liệu qua `chayHopDongSuaTask` (cạnh `chayBoTestHopDong`).
// Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`. Task ở trạng thái cuối được dựng sẵn bằng
// `BanCaiHopDong.datTrangThaiTask` vì lát này chưa có cách đi tới trạng thái cuối bằng giao diện.
import { beforeEach, describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import type { KhoDuLieu, Phien, Task } from './khoDuLieu'
import type { BanCaiHopDong, TuyChonHopDong } from './hopDong'
import { THONG_BAO_DU_AN } from '../luat/duAn'
import {
  CAC_TRANG_THAI_TASK,
  DO_DAI_TIEU_DE_TASK_TOI_DA,
  THONG_BAO_TASK,
  type TrangThaiTask,
} from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-dung-1'
const LUC_TAO_DU_AN = new Date('2026-04-10T09:30:00+07:00')
const LUC_TAO_TASK = new Date('2026-04-10T12:30:00+07:00')
const LUC_SUA = new Date('2026-04-12T08:15:00+07:00')
const LUC_SUA_LAN_HAI = new Date('2026-04-13T10:45:00+07:00')

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

const TRANG_THAI_CUOI: readonly TrangThaiTask[] = ['HOAN_THANH', 'HUY']
const TRANG_THAI_CHUA_CHOT = CAC_TRANG_THAI_TASK.filter((t) => !TRANG_THAI_CUOI.includes(t))

export function chayHopDongSuaTask(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const dongHoCuaKho = tuyChon.dongHoCuaKho ?? false
  const coTask = tuyChon.coTask ?? true
  /** Ngày mong đợi trong dấu vết: đúng giờ truyền vào, hoặc chỉ là một ngày nếu kho tự lấy giờ. */
  const luc = (moc: Date): Date => (dongHoCuaKho ? expect.any(Date) : moc)

  describe.skipIf(!coTask)(`Task: sửa, đổi người, gỡ người khỏi Dự án (hợp đồng) — ${tenBanCai}`, () => {
    let banCai: BanCaiHopDong
    let kho: KhoDuLieu

    beforeEach(async () => {
      banCai = await taoBanCai()
      kho = banCai.kho
    })

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

    async function taoNguoiCoVai(phienPM: Phien, ten: string, vai: VaiHeThong, tenHienThi = ten): Promise<Phien> {
      const phien = await dangKyVaDangNhap(ten, tenHienThi)
      if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(phienPM, phien.nguoiDungId, { vai }))
      return phien
    }

    async function them(pm: Phien, duAnId: string, phien: Phien): Promise<void> {
      const email = giaTri(await kho.layHoSoCuaToi(phien)).email
      giaTri(await kho.themNguoiVaoDuAn(pm, duAnId, { email }))
    }

    async function datTrangThai(taskId: string, trangThai: TrangThaiTask): Promise<void> {
      if (!banCai.datTrangThaiTask) throw new Error('Bản cài thiếu datTrangThaiTask nên không dựng được Task ở trạng thái cuối.')
      await banCai.datTrangThaiTask(taskId, trangThai)
    }

    interface BoiCanh {
      pm: Phien
      duAnId: string
      an: Phien
      binh: Phien
      chi: Phien
      /** Task có sẵn: An làm, Bình duyệt, hạn 2026-12-31, có mô tả. */
      task: Task
    }

    /** Một PM, một Dự án đang hoạt động với An, Bình và Chi trong đó, và một Task giao An (làm) và Bình (duyệt). */
    async function dungBoiCanh(ten = 'st'): Promise<BoiCanh> {
      const pm = await taoPM(`pm-${ten}`, 'An PM')
      const duAn = giaTri(await kho.taoDuAn(pm, { ten: 'Cửa hàng' }, LUC_TAO_DU_AN))
      const an = await dangKyVaDangNhap(`an-${ten}`, 'An')
      const binh = await dangKyVaDangNhap(`binh-${ten}`, 'Bình')
      const chi = await dangKyVaDangNhap(`chi-${ten}`, 'Chi')
      await them(pm, duAn.id, an)
      await them(pm, duAn.id, binh)
      await them(pm, duAn.id, chi)
      const task = giaTri(
        await kho.taoTask(
          pm,
          duAn.id,
          {
            tieuDe: 'Làm trang chủ',
            moTa: 'Theo bản thiết kế',
            han: '2026-12-31',
            nguoiThucHienId: an.nguoiDungId,
            nguoiKiemTraId: binh.nguoiDungId,
          },
          LUC_TAO_TASK,
        ),
      )
      return { pm, duAnId: duAn.id, an, binh, chi, task }
    }

    async function docTask(phien: Phien, taskId: string): Promise<Task> {
      return giaTri(await kho.layTask(phien, taskId))
    }

    describe('sửa tiêu đề, mô tả, hạn', () => {
      it('PM sửa cả ba: dữ liệu đổi, người và ngày chỉnh sửa gần nhất theo người gọi và đồng hồ truyền vào, người tạo và ngày tạo không đổi', async () => {
        const bc = await dungBoiCanh()
        const sua = giaTri(
          await kho.suaTask(
            bc.pm,
            bc.task.id,
            { tieuDe: '  Làm trang chủ mới  ', moTa: '  Bản thiết kế v2  ', han: '2027-01-15' },
            LUC_SUA,
          ),
        )
        expect(sua).toEqual({
          ...bc.task,
          tieuDe: 'Làm trang chủ mới',
          moTa: 'Bản thiết kế v2',
          han: '2027-01-15',
          dauVet: {
            taoBoi: { id: bc.pm.nguoiDungId, tenHienThi: 'An PM' },
            taoLuc: luc(LUC_TAO_TASK),
            suaBoi: { id: bc.pm.nguoiDungId, tenHienThi: 'An PM' },
            suaLuc: luc(LUC_SUA),
          },
        })
        // Người, trạng thái và số lần Trả lại không đổi; đọc lại thấy đúng như vậy.
        expect(sua.nguoiThucHien).toEqual(bc.task.nguoiThucHien)
        expect(sua.nguoiKiemTra).toEqual(bc.task.nguoiKiemTra)
        expect(sua.trangThai).toBe('MOI')
        expect(sua.soLanTraLai).toBe(0)
        expect(await docTask(bc.an, bc.task.id)).toEqual(sua)
        expect(giaTri(await kho.danhSachTask(bc.pm, bc.duAnId))).toEqual([sua])
      })

      it('Support của Dự án sửa được; lần sửa sau ghi đè người và ngày chỉnh sửa gần nhất, người tạo giữ nguyên', async () => {
        const bc = await dungBoiCanh()
        const support = await taoNguoiCoVai(bc.pm, 'support-st', 'SUPPORT', 'Sơn Support')
        await them(bc.pm, bc.duAnId, support)
        giaTri(await kho.suaTask(bc.pm, bc.task.id, { tieuDe: 'Lần một' }, LUC_SUA))
        const lanHai = giaTri(await kho.suaTask(support, bc.task.id, { tieuDe: 'Lần hai' }, LUC_SUA_LAN_HAI))
        expect(lanHai.tieuDe).toBe('Lần hai')
        expect(lanHai.dauVet).toEqual({
          taoBoi: { id: bc.pm.nguoiDungId, tenHienThi: 'An PM' },
          taoLuc: luc(LUC_TAO_TASK),
          suaBoi: { id: support.nguoiDungId, tenHienThi: 'Sơn Support' },
          suaLuc: luc(LUC_SUA_LAN_HAI),
        })
      })

      it('ô không gửi thì giữ nguyên; mô tả trống xoá mô tả; hạn trống hay null xoá hạn', async () => {
        const bc = await dungBoiCanh()
        const chiTieuDe = giaTri(await kho.suaTask(bc.pm, bc.task.id, { tieuDe: 'Chỉ đổi tiêu đề' }, LUC_SUA))
        expect(chiTieuDe.moTa).toBe('Theo bản thiết kế')
        expect(chiTieuDe.han).toBe('2026-12-31')

        const xoaMoTa = giaTri(await kho.suaTask(bc.pm, bc.task.id, { moTa: '   ' }, LUC_SUA))
        expect(xoaMoTa.moTa).toBe('')
        expect(xoaMoTa.tieuDe).toBe('Chỉ đổi tiêu đề')
        expect(xoaMoTa.han).toBe('2026-12-31')

        expect(giaTri(await kho.suaTask(bc.pm, bc.task.id, { han: null }, LUC_SUA)).han).toBeNull()
        expect(giaTri(await kho.suaTask(bc.pm, bc.task.id, { han: '2026-05-05' }, LUC_SUA)).han).toBe('2026-05-05')
        expect(giaTri(await kho.suaTask(bc.pm, bc.task.id, { han: '  ' }, LUC_SUA)).han).toBeNull()
      })

      it('hạn đã qua vẫn nhận, kể cả 29/02 của năm nhuận; tiêu đề đúng 200 ký tự được nhận', async () => {
        const bc = await dungBoiCanh()
        expect(giaTri(await kho.suaTask(bc.pm, bc.task.id, { han: '2020-01-15' }, LUC_SUA)).han).toBe('2020-01-15')
        expect(giaTri(await kho.suaTask(bc.pm, bc.task.id, { han: '2024-02-29' }, LUC_SUA)).han).toBe('2024-02-29')
        const tieuDe = 'a'.repeat(DO_DAI_TIEU_DE_TASK_TOI_DA)
        expect(giaTri(await kho.suaTask(bc.pm, bc.task.id, { tieuDe }, LUC_SUA)).tieuDe).toBe(tieuDe)
      })

      it.each([
        { ca: 'tiêu đề rỗng', sua: { tieuDe: '' }, o: 'tieuDe', thongBao: THONG_BAO_TASK.tieuDeTrong },
        { ca: 'tiêu đề chỉ khoảng trắng', sua: { tieuDe: ' \t  ' }, o: 'tieuDe', thongBao: THONG_BAO_TASK.tieuDeTrong },
        {
          ca: 'tiêu đề quá 200 ký tự',
          sua: { tieuDe: 'a'.repeat(DO_DAI_TIEU_DE_TASK_TOI_DA + 1) },
          o: 'tieuDe',
          thongBao: THONG_BAO_TASK.tieuDeQuaDai,
        },
        { ca: 'hạn 30/02', sua: { han: '2026-02-30' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
        { ca: 'hạn 29/02 năm không nhuận', sua: { han: '2026-02-29' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
        { ca: 'hạn dạng ngày/tháng/năm', sua: { han: '31/12/2026' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
        { ca: 'hạn kèm giờ', sua: { han: '2026-12-31T10:00' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
        { ca: 'hạn là chữ', sua: { han: 'mai' }, o: 'han', thongBao: THONG_BAO_TASK.hanSai },
      ])('$ca bị từ chối với KHONG_HOP_LE kèm thông báo tiếng Việt và dữ liệu không đổi', async ({ sua, o, thongBao }) => {
        const bc = await dungBoiCanh()
        const kq = await kho.suaTask(bc.pm, bc.task.id, sua as never, LUC_SUA)
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        if (!kq.ok) expect(kq.loi.loiTheoO?.[o]).toBe(thongBao)
        expect(await docTask(bc.pm, bc.task.id)).toEqual(bc.task)
      })

      it('một ô sai thì không ô nào được lưu, dấu vết không đổi', async () => {
        const bc = await dungBoiCanh()
        const kq = await kho.suaTask(bc.pm, bc.task.id, { tieuDe: 'Tiêu đề tốt', han: 'mai' }, LUC_SUA)
        expect(maLoi(kq)).toBe('KHONG_HOP_LE')
        expect(await docTask(bc.pm, bc.task.id)).toEqual(bc.task)
      })

      it.each(TRANG_THAI_CHUA_CHOT)('Task đang ở trạng thái %s vẫn sửa được', async (trangThai) => {
        const bc = await dungBoiCanh()
        await datTrangThai(bc.task.id, trangThai)
        const sua = giaTri(await kho.suaTask(bc.pm, bc.task.id, { tieuDe: 'Sửa giữa chừng' }, LUC_SUA))
        expect(sua.tieuDe).toBe('Sửa giữa chừng')
        expect(sua.trangThai).toBe(trangThai)
      })
    })

    describe('Task đã chốt (Hoàn thành hoặc Huỷ)', () => {
      it.each(TRANG_THAI_CUOI)('Task %s: sửa và đổi người trả TASK_DA_CHOT, dữ liệu không đổi (kể cả dữ liệu sai)', async (trangThai) => {
        const bc = await dungBoiCanh()
        await datTrangThai(bc.task.id, trangThai)
        const truoc = await docTask(bc.pm, bc.task.id)
        expect(truoc.trangThai).toBe(trangThai)
        const support = await taoNguoiCoVai(bc.pm, 'support-chot', 'SUPPORT')
        await them(bc.pm, bc.duAnId, support)

        for (const phien of [bc.pm, support]) {
          const sua = await kho.suaTask(phien, bc.task.id, { tieuDe: 'Muộn rồi', han: null }, LUC_SUA)
          expect(maLoi(sua)).toBe('TASK_DA_CHOT')
          expect(maLoi(await kho.suaTask(phien, bc.task.id, { tieuDe: '' }, LUC_SUA))).toBe('TASK_DA_CHOT')
          const doi = await kho.doiNguoiTask(
            phien,
            bc.task.id,
            { nguoiThucHienId: bc.chi.nguoiDungId },
            LUC_SUA,
          )
          expect(maLoi(doi)).toBe('TASK_DA_CHOT')
          expect(
            maLoi(await kho.doiNguoiTask(phien, bc.task.id, { nguoiKiemTraId: 'khong-ton-tai' }, LUC_SUA)),
          ).toBe('TASK_DA_CHOT')
        }
        expect(await docTask(bc.pm, bc.task.id)).toEqual(truoc)
        expect(giaTri(await kho.danhSachTask(bc.pm, bc.duAnId))).toEqual([truoc])
      })

      it('người không có quyền vẫn nhận KHONG_CO_QUYEN (kiểm quyền trước), Dự án Lưu trữ nhận DU_AN_DA_LUU_TRU trước TASK_DA_CHOT', async () => {
        const bc = await dungBoiCanh()
        await datTrangThai(bc.task.id, 'HOAN_THANH')
        expect(maLoi(await kho.suaTask(bc.an, bc.task.id, { tieuDe: 'X' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
        expect(maLoi(await kho.doiNguoiTask(bc.binh, bc.task.id, { nguoiThucHienId: bc.chi.nguoiDungId }, LUC_SUA))).toBe(
          'KHONG_CO_QUYEN',
        )
        giaTri(await kho.luuTruDuAn(bc.pm, bc.duAnId, LUC_SUA))
        expect(maLoi(await kho.suaTask(bc.pm, bc.task.id, { tieuDe: 'X' }, LUC_SUA))).toBe('DU_AN_DA_LUU_TRU')
      })
    })

    describe('quyền sửa và đổi người', () => {
      it('Người thực hiện, Người kiểm tra và Thành viên khác trong Dự án: sửa và đổi người trả KHONG_CO_QUYEN, dữ liệu không đổi', async () => {
        const bc = await dungBoiCanh()
        for (const phien of [bc.an, bc.binh, bc.chi]) {
          const sua = await kho.suaTask(phien, bc.task.id, { tieuDe: 'Tự ý sửa' }, LUC_SUA)
          expect(maLoi(sua)).toBe('KHONG_CO_QUYEN')
          // Dữ liệu sai cũng chỉ là không có quyền: không lộ gì thêm.
          expect(maLoi(await kho.suaTask(phien, bc.task.id, { tieuDe: '' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
          const doi = await kho.doiNguoiTask(phien, bc.task.id, { nguoiThucHienId: bc.chi.nguoiDungId }, LUC_SUA)
          expect(maLoi(doi)).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await kho.doiNguoiTask(phien, bc.task.id, { nguoiThucHienId: 'khong-ton-tai' }, LUC_SUA))).toBe(
            'KHONG_CO_QUYEN',
          )
        }
        expect(await docTask(bc.pm, bc.task.id)).toEqual(bc.task)
      })

      it('Support không ở trong Dự án và người ngoài Dự án: KHONG_CO_QUYEN, không lộ Task có tồn tại', async () => {
        const bc = await dungBoiCanh()
        const supportNgoai = await taoNguoiCoVai(bc.pm, 'support-ngoai-st', 'SUPPORT')
        const tvNgoai = await dangKyVaDangNhap('tv-ngoai-st')
        for (const phien of [supportNgoai, tvNgoai]) {
          expect(maLoi(await kho.suaTask(phien, bc.task.id, { tieuDe: 'X' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await kho.suaTask(phien, 'khong-ton-tai', { tieuDe: 'X' }, LUC_SUA))).toBe('KHONG_CO_QUYEN')
          expect(
            maLoi(await kho.doiNguoiTask(phien, bc.task.id, { nguoiKiemTraId: bc.chi.nguoiDungId }, LUC_SUA)),
          ).toBe('KHONG_CO_QUYEN')
          expect(
            maLoi(await kho.doiNguoiTask(phien, 'khong-ton-tai', { nguoiKiemTraId: bc.chi.nguoiDungId }, LUC_SUA)),
          ).toBe('KHONG_CO_QUYEN')
        }
        expect(await docTask(bc.pm, bc.task.id)).toEqual(bc.task)
      })

      it('PM sửa được Task ở Dự án mình không ở trong; Task không tồn tại thì PM nhận KHONG_TIM_THAY', async () => {
        const bc = await dungBoiCanh()
        const pmKhac = await taoNguoiCoVai(bc.pm, 'pm-khac-st', 'PM')
        expect(giaTri(await kho.suaTask(pmKhac, bc.task.id, { tieuDe: 'PM khác sửa' }, LUC_SUA)).tieuDe).toBe(
          'PM khác sửa',
        )
        expect(
          maLoi(await kho.doiNguoiTask(pmKhac, bc.task.id, { nguoiKiemTraId: bc.chi.nguoiDungId }, LUC_SUA)),
        ).toBe('THANH_CONG')
        expect(maLoi(await kho.suaTask(pmKhac, 'khong-ton-tai', { tieuDe: 'X' }, LUC_SUA))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.doiNguoiTask(pmKhac, 'khong-ton-tai', {}, LUC_SUA))).toBe('KHONG_TIM_THAY')
      })

      it('chưa đăng nhập: CHUA_DANG_NHAP', async () => {
        const bc = await dungBoiCanh()
        expect(maLoi(await kho.suaTask(null, bc.task.id, { tieuDe: 'X' }, LUC_SUA))).toBe('CHUA_DANG_NHAP')
        expect(maLoi(await kho.doiNguoiTask(null, bc.task.id, {}, LUC_SUA))).toBe('CHUA_DANG_NHAP')
        expect(maLoi(await kho.danhSachTaskNguoiDangGiu(null, bc.duAnId, bc.an.nguoiDungId))).toBe('CHUA_DANG_NHAP')
      })

      it('Dự án đã Lưu trữ: sửa và đổi người trả DU_AN_DA_LUU_TRU, dữ liệu không đổi', async () => {
        const bc = await dungBoiCanh()
        const support = await taoNguoiCoVai(bc.pm, 'support-lt-st', 'SUPPORT')
        await them(bc.pm, bc.duAnId, support)
        giaTri(await kho.luuTruDuAn(bc.pm, bc.duAnId, LUC_SUA))
        const truoc = await docTask(bc.pm, bc.task.id)
        for (const phien of [bc.pm, support]) {
          const sua = await kho.suaTask(phien, bc.task.id, { tieuDe: 'X' }, LUC_SUA_LAN_HAI)
          expect(maLoi(sua)).toBe('DU_AN_DA_LUU_TRU')
          if (!sua.ok) expect(sua.loi.thongBao).toBe(THONG_BAO_DU_AN.daLuuTru)
          expect(maLoi(await kho.suaTask(phien, bc.task.id, { tieuDe: '' }, LUC_SUA_LAN_HAI))).toBe('DU_AN_DA_LUU_TRU')
          expect(
            maLoi(await kho.doiNguoiTask(phien, bc.task.id, { nguoiKiemTraId: bc.chi.nguoiDungId }, LUC_SUA_LAN_HAI)),
          ).toBe('DU_AN_DA_LUU_TRU')
        }
        expect(await docTask(bc.pm, bc.task.id)).toEqual(truoc)
      })
    })

    describe('đổi Người thực hiện và Người kiểm tra', () => {
      it('đổi cả hai sang người khác trong Dự án: tên mới, dấu vết cập nhật, phần còn lại giữ nguyên', async () => {
        const bc = await dungBoiCanh()
        const doi = giaTri(
          await kho.doiNguoiTask(
            bc.pm,
            bc.task.id,
            { nguoiThucHienId: bc.chi.nguoiDungId, nguoiKiemTraId: bc.an.nguoiDungId },
            LUC_SUA,
          ),
        )
        expect(doi).toEqual({
          ...bc.task,
          nguoiThucHien: { id: bc.chi.nguoiDungId, tenHienThi: 'Chi' },
          nguoiKiemTra: { id: bc.an.nguoiDungId, tenHienThi: 'An' },
          dauVet: {
            taoBoi: { id: bc.pm.nguoiDungId, tenHienThi: 'An PM' },
            taoLuc: luc(LUC_TAO_TASK),
            suaBoi: { id: bc.pm.nguoiDungId, tenHienThi: 'An PM' },
            suaLuc: luc(LUC_SUA),
          },
        })
        expect(await docTask(bc.chi, bc.task.id)).toEqual(doi)
      })

      it('đổi chỗ hai người cho nhau được; chỉ đổi một ô thì ô kia giữ nguyên', async () => {
        const bc = await dungBoiCanh()
        const doiCho = giaTri(
          await kho.doiNguoiTask(
            bc.pm,
            bc.task.id,
            { nguoiThucHienId: bc.binh.nguoiDungId, nguoiKiemTraId: bc.an.nguoiDungId },
            LUC_SUA,
          ),
        )
        expect(doiCho.nguoiThucHien.id).toBe(bc.binh.nguoiDungId)
        expect(doiCho.nguoiKiemTra.id).toBe(bc.an.nguoiDungId)

        const chiKiemTra = giaTri(
          await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiKiemTraId: bc.chi.nguoiDungId }, LUC_SUA_LAN_HAI),
        )
        expect(chiKiemTra.nguoiThucHien.id).toBe(bc.binh.nguoiDungId)
        expect(chiKiemTra.nguoiKiemTra).toEqual({ id: bc.chi.nguoiDungId, tenHienThi: 'Chi' })
      })

      it('Support của Dự án đổi người được; PM và Support trong Dự án nhận được việc', async () => {
        const bc = await dungBoiCanh()
        const support = await taoNguoiCoVai(bc.pm, 'support-doi', 'SUPPORT', 'Sơn Support')
        await them(bc.pm, bc.duAnId, support)
        await them(bc.pm, bc.duAnId, bc.pm)
        const doi = giaTri(
          await kho.doiNguoiTask(
            support,
            bc.task.id,
            { nguoiThucHienId: support.nguoiDungId, nguoiKiemTraId: bc.pm.nguoiDungId },
            LUC_SUA,
          ),
        )
        expect(doi.nguoiThucHien).toEqual({ id: support.nguoiDungId, tenHienThi: 'Sơn Support' })
        expect(doi.nguoiKiemTra).toEqual({ id: bc.pm.nguoiDungId, tenHienThi: 'An PM' })
        expect(doi.dauVet.suaBoi).toEqual({ id: support.nguoiDungId, tenHienThi: 'Sơn Support' })
      })

      it('người mới không ở trong Dự án (đã đăng ký, đã bị gỡ, PM chưa được thêm, id không tồn tại) trả NGUOI_NGOAI_DU_AN, dữ liệu không đổi', async () => {
        const bc = await dungBoiCanh()
        const ngoai = await dangKyVaDangNhap('ngoai-st', 'Người ngoài')
        const daGo = await dangKyVaDangNhap('da-go-st', 'Đã gỡ')
        await them(bc.pm, bc.duAnId, daGo)
        giaTri(await kho.goNguoiKhoiDuAn(bc.pm, bc.duAnId, daGo.nguoiDungId))
        for (const idNgoai of [ngoai.nguoiDungId, daGo.nguoiDungId, bc.pm.nguoiDungId, 'khong-ton-tai']) {
          const lamThucHien = await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiThucHienId: idNgoai }, LUC_SUA)
          expect(maLoi(lamThucHien)).toBe('NGUOI_NGOAI_DU_AN')
          if (!lamThucHien.ok) expect(lamThucHien.loi.loiTheoO?.nguoiThucHienId).toBe(THONG_BAO_TASK.nguoiNgoaiDuAn)
          const lamKiemTra = await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiKiemTraId: idNgoai }, LUC_SUA)
          expect(maLoi(lamKiemTra)).toBe('NGUOI_NGOAI_DU_AN')
          if (!lamKiemTra.ok) expect(lamKiemTra.loi.loiTheoO?.nguoiKiemTraId).toBe(THONG_BAO_TASK.nguoiNgoaiDuAn)
        }
        expect(await docTask(bc.pm, bc.task.id)).toEqual(bc.task)
      })

      it('hai vai trùng người trả TRUNG_NGUOI: trùng với người kia đang giữ hay chọn cùng một người cho cả hai ô', async () => {
        const bc = await dungBoiCanh()
        // Chỉ đổi một ô sang chính người đang ở ô kia.
        const trungKiemTra = await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiThucHienId: bc.binh.nguoiDungId }, LUC_SUA)
        expect(maLoi(trungKiemTra)).toBe('TRUNG_NGUOI')
        if (!trungKiemTra.ok) expect(trungKiemTra.loi.loiTheoO?.nguoiKiemTraId).toBe(THONG_BAO_TASK.trungNguoi)
        expect(maLoi(await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiKiemTraId: bc.an.nguoiDungId }, LUC_SUA))).toBe(
          'TRUNG_NGUOI',
        )
        // Gửi cả hai ô cùng một người (kể cả có khoảng trắng thừa).
        const cungMot = await kho.doiNguoiTask(
          bc.pm,
          bc.task.id,
          { nguoiThucHienId: bc.chi.nguoiDungId, nguoiKiemTraId: ` ${bc.chi.nguoiDungId} ` },
          LUC_SUA,
        )
        expect(maLoi(cungMot)).toBe('TRUNG_NGUOI')
        expect(await docTask(bc.pm, bc.task.id)).toEqual(bc.task)
      })

      it('gửi ô trống hay null (bỏ người) trả THIEU_NGUOI, dữ liệu không đổi', async () => {
        const bc = await dungBoiCanh()
        const cacCa: { dauVao: Record<string, unknown>; o: string[] }[] = [
          { dauVao: { nguoiThucHienId: null }, o: ['nguoiThucHienId'] },
          { dauVao: { nguoiKiemTraId: '  ' }, o: ['nguoiKiemTraId'] },
          { dauVao: { nguoiThucHienId: '', nguoiKiemTraId: null }, o: ['nguoiThucHienId', 'nguoiKiemTraId'] },
        ]
        for (const { dauVao, o } of cacCa) {
          const kq = await kho.doiNguoiTask(bc.pm, bc.task.id, dauVao as never, LUC_SUA)
          expect(maLoi(kq)).toBe('THIEU_NGUOI')
          if (!kq.ok) expect(Object.keys(kq.loi.loiTheoO ?? {}).sort()).toEqual([...o].sort())
        }
        expect(await docTask(bc.pm, bc.task.id)).toEqual(bc.task)
      })

      it.each(TRANG_THAI_CHUA_CHOT)('Task đang ở trạng thái %s vẫn đổi người được, trạng thái giữ nguyên', async (trangThai) => {
        const bc = await dungBoiCanh()
        await datTrangThai(bc.task.id, trangThai)
        const doi = giaTri(await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiThucHienId: bc.chi.nguoiDungId }, LUC_SUA))
        expect(doi.nguoiThucHien.id).toBe(bc.chi.nguoiDungId)
        expect(doi.trangThai).toBe(trangThai)
      })
    })

    describe('gỡ người khỏi Dự án: Task chưa chốt họ đang giữ', () => {
      /** Thêm các Task cho đủ tình huống; trả id theo tên. */
      async function dungNhieuTask(bc: BoiCanh): Promise<Record<string, string>> {
        const tao = async (tieuDe: string, nguoiThucHien: Phien, nguoiKiemTra: Phien): Promise<string> =>
          giaTri(
            await kho.taoTask(
              bc.pm,
              bc.duAnId,
              { tieuDe, nguoiThucHienId: nguoiThucHien.nguoiDungId, nguoiKiemTraId: nguoiKiemTra.nguoiDungId },
              LUC_TAO_TASK,
            ),
          ).id
        const id: Record<string, string> = {
          anLam: bc.task.id,
          anKiem: await tao('An kiểm tra', bc.binh, bc.an),
          anLamXong: await tao('An làm đã xong', bc.an, bc.binh),
          anKiemHuy: await tao('An kiểm tra đã huỷ', bc.binh, bc.an),
          cuaNguoiKhac: await tao('Của Bình và Chi', bc.binh, bc.chi),
        }
        await datTrangThai(id.anLamXong, 'HOAN_THANH')
        await datTrangThai(id.anKiemHuy, 'HUY')
        await datTrangThai(id.anKiem, 'CHO_DUYET')
        return id
      }

      it('PM xem được Task chưa chốt người đó đang giữ (thực hiện hoặc kiểm tra), không có Task đã chốt hay của người khác', async () => {
        const bc = await dungBoiCanh()
        const id = await dungNhieuTask(bc)
        const danhSach = giaTri(await kho.danhSachTaskNguoiDangGiu(bc.pm, bc.duAnId, bc.an.nguoiDungId))
        expect(danhSach.map((task) => task.id).sort()).toEqual([id.anLam, id.anKiem].sort())
        // Mỗi phần tử là Task đầy đủ như `layTask`.
        for (const task of danhSach) expect(task).toEqual(await docTask(bc.pm, task.id))
        // Người không giữ Task nào nhận danh sách rỗng; người chỉ giữ Task đã chốt cũng vậy.
        expect(giaTri(await kho.danhSachTaskNguoiDangGiu(bc.pm, bc.duAnId, bc.chi.nguoiDungId)).map((t) => t.id)).toEqual([
          id.cuaNguoiKhac,
        ])
      })

      it('người không giữ Task chưa chốt nào nhận danh sách rỗng', async () => {
        const bc = await dungBoiCanh()
        const nguoiTrong = await dangKyVaDangNhap('nguoi-trong-st', 'Người rảnh')
        await them(bc.pm, bc.duAnId, nguoiTrong)
        expect(giaTri(await kho.danhSachTaskNguoiDangGiu(bc.pm, bc.duAnId, nguoiTrong.nguoiDungId))).toEqual([])
        await datTrangThai(bc.task.id, 'HOAN_THANH')
        expect(giaTri(await kho.danhSachTaskNguoiDangGiu(bc.pm, bc.duAnId, bc.an.nguoiDungId))).toEqual([])
      })

      it('Support của Dự án xem được; Thành viên, Support ngoài Dự án và người ngoài nhận KHONG_CO_QUYEN', async () => {
        const bc = await dungBoiCanh()
        const support = await taoNguoiCoVai(bc.pm, 'support-giu', 'SUPPORT')
        await them(bc.pm, bc.duAnId, support)
        expect(giaTri(await kho.danhSachTaskNguoiDangGiu(support, bc.duAnId, bc.an.nguoiDungId))).toHaveLength(1)
        const supportNgoai = await taoNguoiCoVai(bc.pm, 'support-ngoai-giu', 'SUPPORT')
        const tvNgoai = await dangKyVaDangNhap('tv-ngoai-giu')
        for (const phien of [bc.an, bc.binh, bc.chi, supportNgoai, tvNgoai]) {
          expect(maLoi(await kho.danhSachTaskNguoiDangGiu(phien, bc.duAnId, bc.an.nguoiDungId))).toBe('KHONG_CO_QUYEN')
        }
      })

      it('Dự án không tồn tại: PM nhận KHONG_TIM_THAY; người đó không ở trong Dự án: KHONG_TIM_THAY', async () => {
        const bc = await dungBoiCanh()
        const ngoai = await dangKyVaDangNhap('ngoai-giu', 'Người ngoài')
        expect(maLoi(await kho.danhSachTaskNguoiDangGiu(bc.pm, 'khong-ton-tai', bc.an.nguoiDungId))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.danhSachTaskNguoiDangGiu(bc.pm, bc.duAnId, ngoai.nguoiDungId))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.danhSachTaskNguoiDangGiu(bc.pm, bc.duAnId, 'khong-ton-tai'))).toBe('KHONG_TIM_THAY')
      })

      it('Dự án đã Lưu trữ: vẫn xem được danh sách (chỉ đọc)', async () => {
        const bc = await dungBoiCanh()
        giaTri(await kho.luuTruDuAn(bc.pm, bc.duAnId, LUC_SUA))
        expect(giaTri(await kho.danhSachTaskNguoiDangGiu(bc.pm, bc.duAnId, bc.an.nguoiDungId))).toHaveLength(1)
      })

      it('gỡ người vẫn được thực hiện dù họ đang giữ Task: Task giữ nguyên người cũ và hiện "đã rời dự án"', async () => {
        const bc = await dungBoiCanh()
        const id = await dungNhieuTask(bc)
        const truoc = await docTask(bc.pm, id.anLam)
        expect(truoc.nguoiThucHien.daRoiDuAn).toBeUndefined()

        giaTri(await kho.goNguoiKhoiDuAn(bc.pm, bc.duAnId, bc.an.nguoiDungId))

        const sau = await docTask(bc.pm, id.anLam)
        expect(sau.nguoiThucHien).toEqual({ id: bc.an.nguoiDungId, tenHienThi: 'An', daRoiDuAn: true })
        // Người còn lại và phần còn lại của Task không đổi.
        expect(sau.nguoiKiemTra).toEqual(truoc.nguoiKiemTra)
        expect(sau.nguoiKiemTra.daRoiDuAn).toBeUndefined()
        expect({ ...sau, nguoiThucHien: truoc.nguoiThucHien }).toEqual(truoc)
        // Ở vai kiểm tra cũng vậy; Task đã chốt cũng ghi người cũ và đánh dấu.
        expect((await docTask(bc.pm, id.anKiem)).nguoiKiemTra).toEqual({
          id: bc.an.nguoiDungId,
          tenHienThi: 'An',
          daRoiDuAn: true,
        })
        expect((await docTask(bc.pm, id.anLamXong)).nguoiThucHien.daRoiDuAn).toBe(true)
        // Task của người khác không bị đánh dấu; danh sách Task thấy cùng như vậy.
        const cuaNguoiKhac = await docTask(bc.pm, id.cuaNguoiKhac)
        expect(cuaNguoiKhac.nguoiThucHien.daRoiDuAn).toBeUndefined()
        expect(cuaNguoiKhac.nguoiKiemTra.daRoiDuAn).toBeUndefined()
        const trongDanhSach = giaTri(await kho.danhSachTask(bc.binh, bc.duAnId)).find((t) => t.id === id.anLam)
        expect(trongDanhSach).toEqual(sau)
      })

      it('người đã bị gỡ không còn thấy Task, nhưng tài khoản vẫn đăng nhập được', async () => {
        const bc = await dungBoiCanh()
        giaTri(await kho.goNguoiKhoiDuAn(bc.pm, bc.duAnId, bc.an.nguoiDungId))
        expect(maLoi(await kho.layTask(bc.an, bc.task.id))).toBe('KHONG_TIM_THAY')
        expect(maLoi(await kho.layHoSoCuaToi(bc.an))).toBe('THANH_CONG')
      })

      it('sau khi gỡ, danh sách Task người đó giữ không còn gọi được (họ không ở trong Dự án)', async () => {
        const bc = await dungBoiCanh()
        giaTri(await kho.goNguoiKhoiDuAn(bc.pm, bc.duAnId, bc.an.nguoiDungId))
        expect(maLoi(await kho.danhSachTaskNguoiDangGiu(bc.pm, bc.duAnId, bc.an.nguoiDungId))).toBe('KHONG_TIM_THAY')
      })
    })

    describe('giao lại Task đang ghi người "đã rời dự án"', () => {
      /** An (đang làm Task) rời Dự án. */
      async function anRoiDuAn(): Promise<BoiCanh> {
        const bc = await dungBoiCanh()
        giaTri(await kho.goNguoiKhoiDuAn(bc.pm, bc.duAnId, bc.an.nguoiDungId))
        return bc
      }

      it('giao lại cho người trong Dự án thì dấu hiệu biến mất, người mới được ghi, dấu vết cập nhật', async () => {
        const bc = await anRoiDuAn()
        const giaoLai = giaTri(
          await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiThucHienId: bc.chi.nguoiDungId }, LUC_SUA),
        )
        expect(giaoLai.nguoiThucHien).toEqual({ id: bc.chi.nguoiDungId, tenHienThi: 'Chi' })
        expect(giaoLai.nguoiThucHien.daRoiDuAn).toBeUndefined()
        expect(giaoLai.dauVet.suaBoi).toEqual({ id: bc.pm.nguoiDungId, tenHienThi: 'An PM' })
        expect(await docTask(bc.pm, bc.task.id)).toEqual(giaoLai)
      })

      it('giao lại cho người đã rời trả NGUOI_NGOAI_DU_AN; người đó vẫn ghi trên Task', async () => {
        const bc = await anRoiDuAn()
        // Giao lại cho chính người đã rời (Task đang ghi người khác) cũng không được.
        const dung = await dangKyVaDangNhap('dung-roi-st', 'Dũng')
        await them(bc.pm, bc.duAnId, dung)
        giaTri(await kho.goNguoiKhoiDuAn(bc.pm, bc.duAnId, dung.nguoiDungId))
        const kq = await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiKiemTraId: dung.nguoiDungId }, LUC_SUA)
        expect(maLoi(kq)).toBe('NGUOI_NGOAI_DU_AN')
        expect((await docTask(bc.pm, bc.task.id)).nguoiThucHien.daRoiDuAn).toBe(true)
      })

      it('đổi người kia hay sửa tiêu đề khi người cũ chưa được giao lại thì được, dấu hiệu vẫn còn', async () => {
        const bc = await anRoiDuAn()
        const doiKiemTra = giaTri(
          await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiKiemTraId: bc.chi.nguoiDungId }, LUC_SUA),
        )
        expect(doiKiemTra.nguoiKiemTra).toEqual({ id: bc.chi.nguoiDungId, tenHienThi: 'Chi' })
        expect(doiKiemTra.nguoiThucHien).toEqual({ id: bc.an.nguoiDungId, tenHienThi: 'An', daRoiDuAn: true })
        const suaTieuDe = giaTri(await kho.suaTask(bc.pm, bc.task.id, { tieuDe: 'Vẫn sửa được' }, LUC_SUA_LAN_HAI))
        expect(suaTieuDe.nguoiThucHien.daRoiDuAn).toBe(true)
        // Gửi lại đúng người cũ cho ô của họ không bị coi là giao cho người ngoài Dự án.
        const giuNguyen = giaTri(
          await kho.doiNguoiTask(
            bc.pm,
            bc.task.id,
            { nguoiThucHienId: bc.an.nguoiDungId, nguoiKiemTraId: bc.binh.nguoiDungId },
            LUC_SUA_LAN_HAI,
          ),
        )
        expect(giuNguyen.nguoiThucHien.daRoiDuAn).toBe(true)
        expect(giuNguyen.nguoiKiemTra.id).toBe(bc.binh.nguoiDungId)
      })

      it('cả hai người cùng rời rồi giao lại từng người: dấu hiệu biến mất từng ô', async () => {
        const bc = await dungBoiCanh()
        const dung = await dangKyVaDangNhap('dung-st', 'Dũng')
        await them(bc.pm, bc.duAnId, dung)
        giaTri(await kho.goNguoiKhoiDuAn(bc.pm, bc.duAnId, bc.an.nguoiDungId))
        giaTri(await kho.goNguoiKhoiDuAn(bc.pm, bc.duAnId, bc.binh.nguoiDungId))
        const roi = await docTask(bc.pm, bc.task.id)
        expect(roi.nguoiThucHien.daRoiDuAn).toBe(true)
        expect(roi.nguoiKiemTra.daRoiDuAn).toBe(true)

        const motNua = giaTri(
          await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiThucHienId: bc.chi.nguoiDungId }, LUC_SUA),
        )
        expect(motNua.nguoiThucHien.daRoiDuAn).toBeUndefined()
        expect(motNua.nguoiKiemTra.daRoiDuAn).toBe(true)

        const hetRoi = giaTri(
          await kho.doiNguoiTask(bc.pm, bc.task.id, { nguoiKiemTraId: dung.nguoiDungId }, LUC_SUA),
        )
        expect(hetRoi.nguoiKiemTra.daRoiDuAn).toBeUndefined()
      })
    })
  })
}
