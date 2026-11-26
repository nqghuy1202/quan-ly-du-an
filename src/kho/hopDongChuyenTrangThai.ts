// Bộ test hợp đồng của ticket 11: ma trận chuyển trạng thái, lịch sử và bộ đếm Trả lại.
// Chạy lại cho mọi bản cài của Kho dữ liệu qua `chayHopDongChuyenTrangThai` (cạnh `chayBoTestHopDong`).
// Chỉ kiểm hành vi nhìn thấy qua giao diện `KhoDuLieu`. Task ở trạng thái bất kỳ được dựng sẵn bằng
// `BanCaiHopDong.datTrangThaiTask`; riêng các ca đi cả vòng thì đổi trạng thái bằng chính lệnh của Kho.
// Bảng ca dùng chung (`BANG_CA_CHUYEN_TRANG_THAI`) chạy ở đây, mỗi dòng một ca trên một kho mới.
import { beforeEach, describe, expect, it } from 'vitest'
import type { KetQua, MaLoi } from './ketQua'
import type { KhoDuLieu, Phien, Task } from './khoDuLieu'
import { taoBoDemMaDuAn, type BanCaiHopDong, type TuyChonHopDong } from './hopDong'
import {
  BANG_CA_CHUYEN_TRANG_THAI,
  type CaChuyenTrangThai,
  type CachDienLyDo,
  type LoaiNguoiGoi,
} from './bangCaChuyenTrangThai'
import { DO_DAI_LY_DO_TOI_DA, THONG_BAO_CHUYEN_TRANG_THAI } from '../luat/chuyenTrangThai'
import type { TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-dung-1'
const LUC_TAO_DU_AN = new Date('2026-06-01T09:00:00+07:00')
const LUC_TAO_TASK = new Date('2026-06-01T10:00:00+07:00')
const LUC_DOI = new Date('2026-06-02T08:30:00+07:00')

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

function maLoi<T>(kq: KetQua<T>): MaLoi | 'THANH_CONG' {
  return kq.ok ? 'THANH_CONG' : kq.loi.ma
}

const LY_DO_CO = '  Chưa đạt yêu cầu  '
const LY_DO_CO_DA_CAT = 'Chưa đạt yêu cầu'

/** Dữ liệu vào của một ca: `KHONG` thì không gửi `lyDo`. */
function dauVaoCua(sang: TrangThaiTask, lyDo: CachDienLyDo): { sang: TrangThaiTask; lyDo?: string } {
  if (lyDo === 'KHONG') return { sang }
  return { sang, lyDo: lyDo === 'CO' ? LY_DO_CO : '   ' }
}

export function chayHopDongChuyenTrangThai(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const maDuAnMoi = tuyChon.maDuAnMoi ?? taoBoDemMaDuAn()
  const dongHoCuaKho = tuyChon.dongHoCuaKho ?? false
  const coTask = tuyChon.coTask ?? true
  const coDatTrangThaiTask = tuyChon.coDatTrangThaiTask ?? true
  /** Giờ mong đợi: đúng giờ truyền vào, hoặc chỉ là một ngày giờ nếu kho tự lấy giờ. */
  const luc = (moc: Date): Date => (dongHoCuaKho ? expect.any(Date) : moc)

  describe(`Task: ma trận chuyển trạng thái, lịch sử, bộ đếm Trả lại (hợp đồng) — ${tenBanCai}`, () => {
    if (!coTask) {
      it.skip('CHƯA KIỂM: vòng duyệt của Task, vì bản cài chưa có các lệnh Task (coTask: false)', () => {})
    }
    if (coTask && !coDatTrangThaiTask) {
      it.skip('CHƯA KIỂM: bảng ca chuyển trạng thái, vì bản cài chưa dựng sẵn được Task ở trạng thái bất kỳ (coDatTrangThaiTask: false)', () => {})
    }

    describe.skipIf(!coTask)('các ca đi qua giao diện Kho', () => {
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

      async function taoNguoiCoVai(pm: Phien, ten: string, vai: VaiHeThong, tenHienThi = ten): Promise<Phien> {
        const phien = await dangKyVaDangNhap(ten, tenHienThi)
        if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, phien.nguoiDungId, { vai }))
        return phien
      }

      async function them(pm: Phien, duAnId: string, phien: Phien): Promise<void> {
        const email = giaTri(await kho.layHoSoCuaToi(phien)).email
        giaTri(await kho.themNguoiVaoDuAn(pm, duAnId, { email }))
      }

      interface BoiCanh {
        pm: Phien
        duAnId: string
        nguoi: Record<LoaiNguoiGoi, Phien>
        task: Task
      }

      /**
       * Một PM chủ, một Dự án đang hoạt động, một Task Mới (An làm, Bình duyệt) và đủ mọi loại người
       * gọi của bảng ca (xem `CAC_LOAI_NGUOI_GOI`).
       */
      async function dungBoiCanh(): Promise<BoiCanh> {
        const pm = await taoPM('pm-chu', 'PM chủ')
        const duAn = giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten: 'Cửa hàng' }, LUC_TAO_DU_AN))
        const an = await dangKyVaDangNhap('an', 'An')
        const binh = await dangKyVaDangNhap('binh', 'Bình')
        const chi = await taoNguoiCoVai(pm, 'chi', 'SUPPORT', 'Chi')
        const dung = await taoNguoiCoVai(pm, 'dung', 'SUPPORT', 'Dũng')
        const em = await dangKyVaDangNhap('em', 'Em')
        const phuong = await dangKyVaDangNhap('phuong', 'Phương')
        const pmKhac = await taoPM('pm-khac', 'PM khác')
        for (const nguoi of [an, binh, chi, em]) await them(pm, duAn.id, nguoi)
        const task = giaTri(
          await kho.taoTask(
            pm,
            duAn.id,
            { tieuDe: 'Làm trang chủ', nguoiThucHienId: an.nguoiDungId, nguoiKiemTraId: binh.nguoiDungId },
            LUC_TAO_TASK,
          ),
        )
        return {
          pm,
          duAnId: duAn.id,
          nguoi: {
            NGUOI_THUC_HIEN: an,
            NGUOI_KIEM_TRA: binh,
            SUPPORT_CUA_DU_AN: chi,
            SUPPORT_NGOAI_DU_AN: dung,
            PM: pmKhac,
            THANH_VIEN_KHAC: em,
            THANH_VIEN_NGOAI: phuong,
          },
          task,
        }
      }

      async function doi(phien: Phien, taskId: string, sang: TrangThaiTask, lyDo?: string, luc2 = LUC_DOI) {
        return kho.doiTrangThaiTask(phien, taskId, lyDo === undefined ? { sang } : { sang, lyDo }, luc2)
      }

      describe('bảng ca dùng chung', () => {
        const cacCa = coDatTrangThaiTask ? [...BANG_CA_CHUYEN_TRANG_THAI] : []
        it.each(cacCa)(
          '$nguoiGoi: $tu → $sang, lý do $lyDo, Dự án $trangThaiDuAn → $ketQua',
          async (ca: CaChuyenTrangThai) => {
            const bc = await dungBoiCanh()
            if (ca.tu !== 'MOI') {
              if (!banCai.datTrangThaiTask) throw new Error('Bản cài thiếu datTrangThaiTask')
              await banCai.datTrangThaiTask(bc.task.id, ca.tu)
            }
            if (ca.trangThaiDuAn === 'LUU_TRU') giaTri(await kho.luuTruDuAn(bc.pm, bc.duAnId, LUC_TAO_DU_AN))

            const nguoiGoi = bc.nguoi[ca.nguoiGoi]
            const truoc = {
              task: giaTri(await kho.layTask(bc.pm, bc.task.id)),
              lichSu: giaTri(await kho.lichSuTask(bc.pm, bc.task.id)),
            }
            expect(truoc.task.trangThai).toBe(ca.tu)

            const kq = await kho.doiTrangThaiTask(nguoiGoi, bc.task.id, dauVaoCua(ca.sang, ca.lyDo), LUC_DOI)
            expect(kq.ok ? 'DUOC' : kq.loi.ma).toBe(ca.ketQua)

            const sau = {
              task: giaTri(await kho.layTask(bc.pm, bc.task.id)),
              lichSu: giaTri(await kho.lichSuTask(bc.pm, bc.task.id)),
            }
            if (ca.ketQua !== 'DUOC') {
              // Bị từ chối: không đổi gì (trạng thái, bộ đếm, dấu vết, lịch sử).
              expect(sau).toEqual(truoc)
              return
            }
            expect(sau.task.trangThai).toBe(ca.sang)
            expect(sau.task.soLanTraLai).toBe(truoc.task.soLanTraLai + (ca.sang === 'TRA_LAI' ? 1 : 0))
            expect(sau.task.dauVet.suaBoi?.id).toBe(nguoiGoi.nguoiDungId)
            expect(sau.task.dauVet.suaLuc).toEqual(luc(LUC_DOI))
            expect(sau.task.dauVet.taoLuc).toEqual(truoc.task.dauVet.taoLuc)
            expect(sau.lichSu).toHaveLength(truoc.lichSu.length + 1)
            expect(sau.lichSu[sau.lichSu.length - 1]).toEqual({
              loai: 'TRANG_THAI',
              nguoiDoi: expect.objectContaining({ id: nguoiGoi.nguoiDungId }),
              luc: luc(LUC_DOI),
              tu: ca.tu,
              sang: ca.sang,
              lyDo: ca.lyDo === 'CO' ? LY_DO_CO_DA_CAT : null,
            })
          },
        )
      })

      describe('lỗi chung', () => {
        it('người chưa đăng nhập nhận CHUA_DANG_NHAP, cả khi đổi trạng thái lẫn xem lịch sử', async () => {
          const bc = await dungBoiCanh()
          expect(maLoi(await kho.doiTrangThaiTask(null, bc.task.id, { sang: 'DANG_LAM' }, LUC_DOI))).toBe('CHUA_DANG_NHAP')
          expect(maLoi(await kho.lichSuTask(null, bc.task.id))).toBe('CHUA_DANG_NHAP')
        })

        it('Task không tồn tại: PM nhận KHONG_TIM_THAY, người khác nhận KHONG_CO_QUYEN (không lộ gì)', async () => {
          const bc = await dungBoiCanh()
          const khongCo = `${bc.task.id}-khong-ton-tai`
          expect(maLoi(await doi(bc.pm, khongCo, 'DANG_LAM'))).toBe('KHONG_TIM_THAY')
          expect(maLoi(await doi(bc.nguoi.NGUOI_THUC_HIEN, khongCo, 'DANG_LAM'))).toBe('KHONG_CO_QUYEN')
          expect(maLoi(await doi(bc.nguoi.THANH_VIEN_NGOAI, khongCo, 'DANG_LAM'))).toBe('KHONG_CO_QUYEN')
        })

        it('trạng thái đích không có thật hoặc thiếu: KHONG_HOP_LE, báo ở ô sang, Task không đổi', async () => {
          const bc = await dungBoiCanh()
          const batDau = bc.nguoi.NGUOI_THUC_HIEN
          for (const sang of ['', 'DANG_LAMM', 'Đang làm', 42, null, undefined]) {
            const kq = await kho.doiTrangThaiTask(batDau, bc.task.id, { sang: sang as unknown as string }, LUC_DOI)
            expect(maLoi(kq)).toBe('KHONG_HOP_LE')
            if (!kq.ok) expect(kq.loi.loiTheoO).toHaveProperty('sang')
          }
          expect(giaTri(await kho.layTask(bc.pm, bc.task.id)).trangThai).toBe('MOI')
          expect(giaTri(await kho.lichSuTask(bc.pm, bc.task.id))).toEqual([])
        })

        it('lý do quá dài: KHONG_HOP_LE; đúng giới hạn thì được lưu', async () => {
          const bc = await dungBoiCanh()
          await banCai.datTrangThaiTask?.(bc.task.id, 'CHO_DUYET')
          const binh = bc.nguoi.NGUOI_KIEM_TRA
          const quaDai = await doi(binh, bc.task.id, 'TRA_LAI', 'a'.repeat(DO_DAI_LY_DO_TOI_DA + 1))
          expect(maLoi(quaDai)).toBe('KHONG_HOP_LE')
          if (!quaDai.ok) expect(quaDai.loi.loiTheoO).toHaveProperty('lyDo', THONG_BAO_CHUYEN_TRANG_THAI.lyDoQuaDai)
          expect(giaTri(await kho.layTask(bc.pm, bc.task.id)).soLanTraLai).toBe(0)
          giaTri(await doi(binh, bc.task.id, 'TRA_LAI', 'a'.repeat(DO_DAI_LY_DO_TOI_DA)))
          const ls = giaTri(await kho.lichSuTask(bc.pm, bc.task.id))
          expect(ls[0]).toMatchObject({ loai: 'TRANG_THAI', lyDo: 'a'.repeat(DO_DAI_LY_DO_TOI_DA) })
        })

        it('thiếu lý do báo ở ô lyDo bằng thông báo tiếng Việt', async () => {
          const bc = await dungBoiCanh()
          await banCai.datTrangThaiTask?.(bc.task.id, 'CHO_DUYET')
          const kq = await doi(bc.nguoi.NGUOI_KIEM_TRA, bc.task.id, 'BI_LOI', '  ')
          expect(maLoi(kq)).toBe('LY_DO_BAT_BUOC')
          if (!kq.ok) {
            expect(kq.loi.loiTheoO).toHaveProperty('lyDo')
            expect(kq.loi.thongBao).not.toBe('')
          }
        })
      })

      describe('đi cả vòng duyệt, lịch sử và bộ đếm', () => {
        it('đi qua hai lần Trả lại, một lần Bị lỗi rồi Hoàn thành: lịch sử đủ, đúng thứ tự, bộ đếm chỉ tăng ở Trả lại', async () => {
          const bc = await dungBoiCanh()
          const an = bc.nguoi.NGUOI_THUC_HIEN
          const binh = bc.nguoi.NGUOI_KIEM_TRA
          const chi = bc.nguoi.SUPPORT_CUA_DU_AN
          const gio = (phut: number) => new Date(LUC_DOI.getTime() + phut * 60_000)
          const buoc: [Phien, TrangThaiTask, string | undefined, number, number][] = [
            // người đổi, sang, lý do, phút, bộ đếm mong đợi sau bước
            [an, 'DANG_LAM', undefined, 1, 0],
            [an, 'CHO_DUYET', undefined, 2, 0],
            [binh, 'TRA_LAI', 'Thiếu ảnh', 3, 1],
            [an, 'DANG_LAM', undefined, 4, 1],
            [an, 'CHO_DUYET', undefined, 5, 1],
            [binh, 'TRA_LAI', 'Vẫn thiếu ảnh', 6, 2],
            [an, 'DANG_LAM', undefined, 7, 2],
            [an, 'CHO_DUYET', undefined, 8, 2],
            [binh, 'BI_LOI', 'Hỏng hẳn', 9, 2],
            [chi, 'DANG_LAM', undefined, 10, 2],
            [an, 'CHO_DUYET', undefined, 11, 2],
            [binh, 'HOAN_THANH', undefined, 12, 2],
          ]
          let tu: TrangThaiTask = 'MOI'
          for (const [nguoi, sang, lyDo, phut, demMongDoi] of buoc) {
            const moi = giaTri(await doi(nguoi, bc.task.id, sang, lyDo, gio(phut)))
            expect(moi.trangThai).toBe(sang)
            expect(moi.soLanTraLai).toBe(demMongDoi)
            tu = sang
          }
          expect(tu).toBe('HOAN_THANH')

          const ls = giaTri(await kho.lichSuTask(bc.pm, bc.task.id))
          expect(ls).toHaveLength(buoc.length)
          let truocDo: TrangThaiTask = 'MOI'
          buoc.forEach(([nguoi, sang, lyDo, phut], i) => {
            expect(ls[i]).toEqual({
              loai: 'TRANG_THAI',
              nguoiDoi: expect.objectContaining({ id: nguoi.nguoiDungId }),
              luc: luc(gio(phut)),
              tu: truocDo,
              sang,
              lyDo: lyDo ?? null,
            })
            truocDo = sang
          })
          // Thứ tự thời gian tăng dần.
          if (!dongHoCuaKho) {
            const moc = ls.map((d) => d.luc.getTime())
            expect(moc).toEqual([...moc].sort((a, b) => a - b))
          }
          // Đã chốt: không đi tiếp.
          expect(maLoi(await doi(binh, bc.task.id, 'DANG_LAM'))).toBe('TASK_DA_CHOT')
          expect(maLoi(await doi(bc.pm, bc.task.id, 'HUY', 'Không cần nữa'))).toBe('TASK_DA_CHOT')
        })

        it('người đổi hiện bằng tên hiển thị hiện tại; Task chưa đổi lần nào có lịch sử rỗng; lịch sử của Task này không lẫn sang Task khác', async () => {
          const bc = await dungBoiCanh()
          expect(giaTri(await kho.lichSuTask(bc.pm, bc.task.id))).toEqual([])
          const task2 = giaTri(
            await kho.taoTask(
              bc.pm,
              bc.duAnId,
              {
                tieuDe: 'Việc thứ hai',
                nguoiThucHienId: bc.nguoi.NGUOI_THUC_HIEN.nguoiDungId,
                nguoiKiemTraId: bc.nguoi.NGUOI_KIEM_TRA.nguoiDungId,
              },
              LUC_TAO_TASK,
            ),
          )
          giaTri(await doi(bc.nguoi.NGUOI_THUC_HIEN, bc.task.id, 'DANG_LAM'))
          const ls = giaTri(await kho.lichSuTask(bc.nguoi.THANH_VIEN_KHAC, bc.task.id))
          expect(ls).toHaveLength(1)
          expect(ls[0]?.nguoiDoi.tenHienThi).toBe('An')
          expect(giaTri(await kho.lichSuTask(bc.pm, task2.id))).toEqual([])
          expect(giaTri(await kho.layTask(bc.pm, task2.id)).trangThai).toBe('MOI')
        })

        it('người ngoài Dự án không xem được lịch sử (KHONG_TIM_THAY, như Task không tồn tại); PM xem được mọi Dự án', async () => {
          const bc = await dungBoiCanh()
          giaTri(await doi(bc.nguoi.NGUOI_THUC_HIEN, bc.task.id, 'DANG_LAM'))
          expect(maLoi(await kho.lichSuTask(bc.nguoi.THANH_VIEN_NGOAI, bc.task.id))).toBe('KHONG_TIM_THAY')
          expect(maLoi(await kho.lichSuTask(bc.nguoi.SUPPORT_NGOAI_DU_AN, bc.task.id))).toBe('KHONG_TIM_THAY')
          expect(maLoi(await kho.lichSuTask(bc.nguoi.THANH_VIEN_NGOAI, `${bc.task.id}-khong-ton-tai`))).toBe('KHONG_TIM_THAY')
          expect(giaTri(await kho.lichSuTask(bc.nguoi.PM, bc.task.id))).toHaveLength(1)
        })

        it.skipIf(dongHoCuaKho)('lịch sử xếp theo thời điểm, không theo thứ tự gọi: đồng hồ truyền vào lùi lại thì dòng đó đứng trước', async () => {
          const bc = await dungBoiCanh()
          const an = bc.nguoi.NGUOI_THUC_HIEN
          giaTri(await doi(an, bc.task.id, 'DANG_LAM', undefined, new Date('2026-06-05T10:00:00+07:00')))
          giaTri(await doi(an, bc.task.id, 'CHO_DUYET', undefined, new Date('2026-06-04T10:00:00+07:00')))
          const ls = giaTri(await kho.lichSuTask(bc.pm, bc.task.id))
          expect(ls.map((d) => d.sang)).toEqual(['CHO_DUYET', 'DANG_LAM'])
        })

        it('đổi trạng thái được tính là một lần chỉnh sửa: người và ngày chỉnh sửa gần nhất đổi, người tạo và ngày tạo giữ nguyên', async () => {
          const bc = await dungBoiCanh()
          expect(bc.task.dauVet.suaBoi).toBeNull()
          const moi = giaTri(await doi(bc.nguoi.NGUOI_THUC_HIEN, bc.task.id, 'DANG_LAM'))
          expect(moi.dauVet.suaBoi).toEqual(expect.objectContaining({ id: bc.nguoi.NGUOI_THUC_HIEN.nguoiDungId, tenHienThi: 'An' }))
          expect(moi.dauVet.suaLuc).toEqual(luc(LUC_DOI))
          expect(moi.dauVet.taoBoi).toEqual(bc.task.dauVet.taoBoi)
          expect(moi.dauVet.taoLuc).toEqual(bc.task.dauVet.taoLuc)
        })

        it('trạng thái mới hiện ở danh sách Task, "Việc của tôi" và "Chờ tôi duyệt"', async () => {
          const bc = await dungBoiCanh()
          const an = bc.nguoi.NGUOI_THUC_HIEN
          const binh = bc.nguoi.NGUOI_KIEM_TRA
          giaTri(await doi(an, bc.task.id, 'DANG_LAM'))
          giaTri(await doi(an, bc.task.id, 'CHO_DUYET'))
          const danhSach = giaTri(await kho.danhSachTask(an, bc.duAnId))
          expect(danhSach.find((t) => t.id === bc.task.id)?.trangThai).toBe('CHO_DUYET')
          expect(giaTri(await kho.choToiDuyet(binh)).map((t) => t.id)).toEqual([bc.task.id])
          expect(giaTri(await kho.viecCuaToi(an)).map((t) => t.id)).toEqual([bc.task.id])
          giaTri(await doi(binh, bc.task.id, 'HOAN_THANH'))
          expect(giaTri(await kho.choToiDuyet(binh))).toEqual([])
          expect(giaTri(await kho.viecCuaToi(an))).toEqual([])
        })

        it('Huỷ từ trạng thái chưa cuối, có lý do lưu trong lịch sử; sau đó Task không sửa được nữa', async () => {
          const bc = await dungBoiCanh()
          giaTri(await doi(bc.nguoi.SUPPORT_CUA_DU_AN, bc.task.id, 'HUY', '  Khách đổi ý  '))
          const task = giaTri(await kho.layTask(bc.pm, bc.task.id))
          expect(task.trangThai).toBe('HUY')
          expect(task.soLanTraLai).toBe(0)
          const ls = giaTri(await kho.lichSuTask(bc.pm, bc.task.id))
          expect(ls).toEqual([
            {
              loai: 'TRANG_THAI',
              nguoiDoi: expect.objectContaining({ id: bc.nguoi.SUPPORT_CUA_DU_AN.nguoiDungId }),
              luc: luc(LUC_DOI),
              tu: 'MOI',
              sang: 'HUY',
              lyDo: 'Khách đổi ý',
            },
          ])
          expect(maLoi(await kho.suaTask(bc.pm, bc.task.id, { tieuDe: 'Đổi tên' }, LUC_DOI))).toBe('TASK_DA_CHOT')
        })
      })
    })
  })
}
