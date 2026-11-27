// Bộ test hợp đồng của trang Tổng quan (ticket 13, mở rộng ở bố cục 02): Tiến độ, số Task theo trạng
// thái, cờ Trễ hạn, ô số, Task Trễ hạn và tới hạn, phân bố, quyền xem theo vai. Chạy lại cho mọi bản
// cài của Kho dữ liệu qua `chayHopDongTongQuan`.
// Chỉ đi qua giao diện `KhoDuLieu`; "bây giờ" truyền vào. Task ở trạng thái Hoàn thành, Huỷ... được
// dựng sẵn bằng `BanCaiHopDong.datTrangThaiTask`.
import { beforeEach, describe, expect, it } from 'vitest'
import type { KetQua } from './ketQua'
import type { KhoDuLieu, Phien, Task } from './khoDuLieu'
import { taoBoDemMaDuAn, type BanCaiHopDong, type TuyChonHopDong } from './hopDong'
import { docTongQuan, type DongTongQuan } from './tongQuan'
import type { TrangThaiTask } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'

const MAT_KHAU = 'matkhau-dung-1'
const LUC_TAO = new Date('2026-04-10T09:30:00+07:00')
/** Task hạn 2026-11-25; 23:59 ngày 25/11 giờ Việt Nam chưa trễ, 00:00 ngày 26/11 đã trễ. */
const CUOI_NGAY_HAN = new Date('2026-11-25T23:59:00+07:00')
const DAU_NGAY_SAU_HAN = new Date('2026-11-26T00:00:00+07:00')

function giaTri<T>(kq: KetQua<T>): T {
  if (!kq.ok) throw new Error(`Mong đợi thành công, nhận lỗi ${kq.loi.ma}: ${kq.loi.thongBao}`)
  return kq.giaTri
}

export function chayHopDongTongQuan(
  tenBanCai: string,
  taoBanCai: () => BanCaiHopDong | Promise<BanCaiHopDong>,
  tuyChon: TuyChonHopDong = {},
): void {
  const emailMoi = tuyChon.emailMoi ?? ((ten: string) => `${ten}@vi-du.vn`)
  const maDuAnMoi = tuyChon.maDuAnMoi ?? taoBoDemMaDuAn()
  const coTask = tuyChon.coTask ?? true
  const coDatTrangThai = tuyChon.coDatTrangThaiTask ?? true

  describe.skipIf(!coTask || !coDatTrangThai)(`Tổng quan: Tiến độ, Trễ hạn, quyền xem (hợp đồng) — ${tenBanCai}`, () => {
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

    async function taoPM(ten: string): Promise<Phien> {
      const email = emailMoi(ten)
      giaTri(await kho.dangKy({ email, matKhau: MAT_KHAU, tenHienThi: 'An PM' }))
      giaTri(await banCai.xacNhanEmail(email))
      await banCai.datVaiPM(email)
      return giaTri(await kho.dangNhap({ email, matKhau: MAT_KHAU }))
    }

    async function taoNguoiCoVai(pm: Phien, ten: string, vai: VaiHeThong): Promise<Phien> {
      const phien = await dangKyVaDangNhap(ten, ten)
      if (vai !== 'THANH_VIEN') giaTri(await kho.doiVai(pm, phien.nguoiDungId, { vai }))
      return phien
    }

    async function them(pm: Phien, duAnId: string, phien: Phien): Promise<void> {
      const email = giaTri(await kho.layHoSoCuaToi(phien)).email
      giaTri(await kho.themNguoiVaoDuAn(pm, duAnId, { email }))
    }

    async function taoDuAn(pm: Phien, ten: string): Promise<string> {
      return giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten }, LUC_TAO)).id
    }

    /** Task giao `thucHien` làm và `kiemTra` duyệt, rồi đặt thẳng trạng thái. */
    async function taoTask(
      pm: Phien,
      duAnId: string,
      thucHien: Phien,
      kiemTra: Phien,
      tieuDe: string,
      trangThai: TrangThaiTask = 'MOI',
      han: string | null = null,
    ): Promise<Task> {
      const task = giaTri(
        await kho.taoTask(
          pm,
          duAnId,
          { tieuDe, han, nguoiThucHienId: thucHien.nguoiDungId, nguoiKiemTraId: kiemTra.nguoiDungId },
          LUC_TAO,
        ),
      )
      if (trangThai !== 'MOI') await banCai.datTrangThaiTask?.(task.id, trangThai)
      return task
    }

    async function doc(phien: Phien, bayGio: Date = CUOI_NGAY_HAN) {
      return giaTri(await docTongQuan(kho, phien, bayGio))
    }

    function dongCua(dong: DongTongQuan[], ten: string): DongTongQuan {
      const d = dong.find((x) => x.duAn.ten === ten)
      if (!d) throw new Error(`Không có dòng tổng quan cho Dự án ${ten}`)
      return d
    }

    /** PM, hai Thành viên An và Bình, một Dự án "Cửa hàng" có cả hai. */
    async function dungBoiCanh() {
      const pm = await taoPM('pm-tq')
      const an = await dangKyVaDangNhap('an-tq', 'An')
      const binh = await dangKyVaDangNhap('binh-tq', 'Bình')
      const duAnId = await taoDuAn(pm, 'Cửa hàng')
      await them(pm, duAnId, an)
      await them(pm, duAnId, binh)
      return { pm, an, binh, duAnId }
    }

    it('Tiến độ: Task Huỷ không vào mẫu số và làm tròn xuống (1 Hoàn thành, 1 Huỷ, 1 Mới, 1 Đang làm là 33%)', async () => {
      const { pm, an, binh, duAnId } = await dungBoiCanh()
      await taoTask(pm, duAnId, an, binh, 'Xong', 'HOAN_THANH')
      await taoTask(pm, duAnId, an, binh, 'Bỏ', 'HUY')
      await taoTask(pm, duAnId, an, binh, 'Mới')
      await taoTask(pm, duAnId, an, binh, 'Đang làm', 'DANG_LAM')
      const dong = dongCua((await doc(pm)).hoatDong, 'Cửa hàng')
      expect(dong.tomTat.tienDo).toEqual({ chuaCoTask: false, phanTram: 33 })
      expect(dong.tomTat.soTaskTheoTrangThai).toEqual({
        MOI: 1,
        DANG_LAM: 1,
        CHO_DUYET: 0,
        TRA_LAI: 0,
        BI_LOI: 0,
        HOAN_THANH: 1,
        HUY: 1,
      })
    })

    it('Tiến độ: còn một Task Chờ duyệt thì không bao giờ 100%; xong hết thì 100%', async () => {
      const { pm, an, binh, duAnId } = await dungBoiCanh()
      await taoTask(pm, duAnId, an, binh, 'Xong 1', 'HOAN_THANH')
      await taoTask(pm, duAnId, an, binh, 'Xong 2', 'HOAN_THANH')
      const choDuyet = await taoTask(pm, duAnId, an, binh, 'Chờ', 'CHO_DUYET')
      expect(dongCua((await doc(pm)).hoatDong, 'Cửa hàng').tomTat.tienDo).toEqual({ chuaCoTask: false, phanTram: 66 })
      await banCai.datTrangThaiTask?.(choDuyet.id, 'HOAN_THANH')
      expect(dongCua((await doc(pm)).hoatDong, 'Cửa hàng').tomTat.tienDo).toEqual({ chuaCoTask: false, phanTram: 100 })
    })

    it('Dự án chưa có Task, hoặc chỉ có Task Huỷ, là "chưa có task", không phải 0%', async () => {
      const { pm, an, binh, duAnId } = await dungBoiCanh()
      const trong = await taoDuAn(pm, 'Trống')
      expect(dongCua((await doc(pm)).hoatDong, 'Trống').tomTat.tienDo).toEqual({ chuaCoTask: true })
      await taoTask(pm, duAnId, an, binh, 'Bỏ', 'HUY')
      expect(trong).not.toBe(duAnId)
      expect(dongCua((await doc(pm)).hoatDong, 'Cửa hàng').tomTat.tienDo).toEqual({ chuaCoTask: true })
    })

    it('Trễ hạn: hạn đúng hôm nay chưa trễ, qua nửa đêm giờ Việt Nam thì trễ; cờ và danh sách Task Trễ hạn', async () => {
      const { pm, an, binh, duAnId } = await dungBoiCanh()
      const task = await taoTask(pm, duAnId, an, binh, 'Giao hàng', 'DANG_LAM', '2026-11-25')
      const truoc = dongCua((await doc(pm, CUOI_NGAY_HAN)).hoatDong, 'Cửa hàng')
      expect(truoc.tomTat.treHan).toBe(false)
      expect(truoc.taskTreHan).toEqual([])
      const sau = dongCua((await doc(pm, DAU_NGAY_SAU_HAN)).hoatDong, 'Cửa hàng')
      expect(sau.tomTat.treHan).toBe(true)
      expect(sau.taskTreHan.map((t) => t.id)).toEqual([task.id])
    })

    it('Trễ hạn: Task Chờ duyệt quá hạn vẫn trễ; Hoàn thành, Huỷ và Task không hạn không trễ', async () => {
      const { pm, an, binh, duAnId } = await dungBoiCanh()
      const choDuyet = await taoTask(pm, duAnId, an, binh, 'Chờ duyệt quá hạn', 'CHO_DUYET', '2026-11-01')
      await taoTask(pm, duAnId, an, binh, 'Đã xong', 'HOAN_THANH', '2026-11-01')
      await taoTask(pm, duAnId, an, binh, 'Đã huỷ', 'HUY', '2026-11-01')
      await taoTask(pm, duAnId, an, binh, 'Không hạn', 'MOI', null)
      const dong = dongCua((await doc(pm, DAU_NGAY_SAU_HAN)).hoatDong, 'Cửa hàng')
      expect(dong.tomTat.treHan).toBe(true)
      expect(dong.taskTreHan.map((t) => t.id)).toEqual([choDuyet.id])
    })

    it('PM thấy mọi Dự án đang hoạt động (kể cả Dự án mình không ở trong); Dự án Lưu trữ và Task của nó không có trong Tổng quan', async () => {
      const { pm, an, binh, duAnId } = await dungBoiCanh()
      const khoHang = await taoDuAn(pm, 'Kho hàng')
      const luuTru = await taoDuAn(pm, 'Cũ')
      await them(pm, luuTru, an)
      await them(pm, luuTru, binh)
      await taoTask(pm, duAnId, an, binh, 'Cửa hàng trễ', 'DANG_LAM', '2026-11-20')
      await taoTask(pm, luuTru, an, binh, 'Cũ trễ', 'DANG_LAM', '2026-11-01')
      await taoTask(pm, luuTru, an, binh, 'Cũ tới hạn', 'MOI', '2026-11-27')
      await taoTask(pm, luuTru, binh, an, 'Cũ chờ An duyệt', 'CHO_DUYET')
      giaTri(await kho.luuTruDuAn(pm, luuTru, LUC_TAO))
      expect(khoHang).not.toBe(luuTru)
      const tq = await doc(pm, DAU_NGAY_SAU_HAN)
      expect(tq.hoatDong.map((d) => d.duAn.ten)).toEqual(['Cửa hàng', 'Kho hàng'])
      expect(tq.oSo).toEqual({
        duAnDangHoatDong: 2,
        duAnQuaHanDuKien: 0,
        taskDangMo: 1,
        taskTreHan: 1,
        choToiDuyet: 0,
        viecCuaToi: 0,
      })
      expect(tq.taskTreHan.map((t) => [t.tieuDe, t.tenDuAn])).toEqual([['Cửa hàng trễ', 'Cửa hàng']])
      expect(tq.taskToiHan).toEqual([])
      expect(tq.phanBo.MOI + tq.phanBo.CHO_DUYET).toBe(0)
      // An vẫn ở trong Dự án Lưu trữ nhưng Task ở đó cũng không vào ô số của An.
      expect((await doc(an, DAU_NGAY_SAU_HAN)).oSo).toEqual({
        duAnDangHoatDong: 1,
        duAnQuaHanDuKien: 0,
        taskDangMo: 1,
        taskTreHan: 1,
        choToiDuyet: 0,
        viecCuaToi: 1,
      })
    })

    it('Support và Thành viên chỉ thấy Dự án mình ở trong (ô số, danh sách, phân bố); người chưa ở Dự án nào nhận mọi số 0', async () => {
      const { pm, an, binh, duAnId } = await dungBoiCanh()
      const khac = await taoDuAn(pm, 'Dự án khác')
      const cuong = await dangKyVaDangNhap('cuong-tq', 'Cường')
      await them(pm, khac, binh)
      await them(pm, khac, cuong)
      const support = await taoNguoiCoVai(pm, 'support-tq', 'SUPPORT')
      await them(pm, duAnId, support)
      await taoTask(pm, duAnId, an, binh, 'Cửa hàng mới', 'MOI', '2026-11-28')
      await taoTask(pm, khac, binh, cuong, 'Khác trễ', 'DANG_LAM', '2026-11-01')
      await taoTask(pm, khac, binh, cuong, 'Khác tới hạn', 'MOI', '2026-11-27')
      const khach = await dangKyVaDangNhap('khach-tq', 'Khách')
      for (const phien of [an, support]) {
        const tq = await doc(phien, DAU_NGAY_SAU_HAN)
        expect(tq.hoatDong.map((d) => d.duAn.ten)).toEqual(['Cửa hàng'])
        expect(tq.oSo.duAnDangHoatDong).toBe(1)
        expect(tq.oSo.taskDangMo).toBe(1)
        expect(tq.oSo.taskTreHan).toBe(0)
        expect(tq.taskTreHan).toEqual([])
        expect(tq.taskToiHan.map((t) => t.tieuDe)).toEqual(['Cửa hàng mới'])
        expect(tq.phanBo).toEqual({ MOI: 1, DANG_LAM: 0, CHO_DUYET: 0, TRA_LAI: 0, BI_LOI: 0, HOAN_THANH: 0, HUY: 0 })
      }
      // PM thấy cả hai Dự án.
      const cuaPM = await doc(pm, DAU_NGAY_SAU_HAN)
      expect(cuaPM.oSo.taskDangMo).toBe(3)
      expect(cuaPM.taskTreHan.map((t) => t.tieuDe)).toEqual(['Khác trễ'])
      expect(cuaPM.taskToiHan.map((t) => t.tieuDe)).toEqual(['Khác tới hạn', 'Cửa hàng mới'])
      const rong = {
        oSo: {
          duAnDangHoatDong: 0,
          duAnQuaHanDuKien: 0,
          taskDangMo: 0,
          taskTreHan: 0,
          choToiDuyet: 0,
          viecCuaToi: 0,
        },
        hoatDong: [],
        taskTreHan: [],
        taskToiHan: [],
        phanBo: { MOI: 0, DANG_LAM: 0, CHO_DUYET: 0, TRA_LAI: 0, BI_LOI: 0, HOAN_THANH: 0, HUY: 0 },
      }
      expect(await doc(khach)).toEqual(rong)
      // Support không ở Dự án nào cũng chỉ thấy rỗng (không phải PM).
      const supportNgoai = await taoNguoiCoVai(pm, 'support-ngoai-tq', 'SUPPORT')
      expect(await doc(supportNgoai)).toEqual(rong)
    })

    it('ô Chờ tôi duyệt và Việc của tôi tính theo người gọi', async () => {
      const { pm, an, binh, duAnId } = await dungBoiCanh()
      await taoTask(pm, duAnId, an, binh, 'An làm', 'DANG_LAM')
      await taoTask(pm, duAnId, an, binh, 'An làm, Bình duyệt', 'CHO_DUYET')
      await taoTask(pm, duAnId, binh, an, 'Bình làm, An duyệt', 'CHO_DUYET')
      await taoTask(pm, duAnId, binh, an, 'Bình làm, An kiểm tra', 'DANG_LAM')
      await taoTask(pm, duAnId, an, binh, 'An xong', 'HOAN_THANH')
      expect((await doc(an)).oSo).toMatchObject({ choToiDuyet: 1, viecCuaToi: 2 })
      expect((await doc(binh)).oSo).toMatchObject({ choToiDuyet: 1, viecCuaToi: 2 })
      expect((await doc(pm)).oSo).toMatchObject({ choToiDuyet: 0, viecCuaToi: 0, taskDangMo: 4 })
    })

    it('mỗi người thấy số Task chưa chốt của riêng mình (làm hoặc duyệt), không tính Hoàn thành và Huỷ', async () => {
      const { pm, an, binh, duAnId } = await dungBoiCanh()
      await taoTask(pm, duAnId, an, binh, 'An làm 1')
      await taoTask(pm, duAnId, an, binh, 'An làm 2', 'CHO_DUYET')
      await taoTask(pm, duAnId, binh, an, 'An duyệt', 'DANG_LAM')
      await taoTask(pm, duAnId, an, binh, 'An xong', 'HOAN_THANH')
      await taoTask(pm, duAnId, an, binh, 'An huỷ', 'HUY')
      expect(dongCua((await doc(an)).hoatDong, 'Cửa hàng').tomTat.soTaskChuaChotCuaToi).toBe(3)
      expect(dongCua((await doc(binh)).hoatDong, 'Cửa hàng').tomTat.soTaskChuaChotCuaToi).toBe(3)
      expect(dongCua((await doc(pm)).hoatDong, 'Cửa hàng').tomTat.soTaskChuaChotCuaToi).toBe(0)
    })

    it('Dự án Quá hạn dự kiến: ô số và cờ trên dòng chỉ tính Dự án đang hoạt động; Dự án Lưu trữ không được đếm', async () => {
      const { pm, an, binh } = await dungBoiCanh()
      const taoCoNgay = async (ten: string, ngayKetThucDuKien: string) =>
        giaTri(await kho.taoDuAn(pm, { ma: maDuAnMoi(), ten, ngayKetThucDuKien }, LUC_TAO)).id
      // Kết thúc 25/11, Tiến độ 0%: Quá hạn dự kiến lúc 00:00 ngày 26/11 giờ Việt Nam, chưa lúc 23:59 ngày 25/11.
      const quaHan = await taoCoNgay('Quá hạn', '2026-11-25')
      await them(pm, quaHan, an)
      await them(pm, quaHan, binh)
      await taoTask(pm, quaHan, an, binh, 'Chưa xong')
      // Đã xong hết: không Quá hạn dự kiến.
      const xong = await taoCoNgay('Xong hết', '2026-11-01')
      await them(pm, xong, an)
      await them(pm, xong, binh)
      await taoTask(pm, xong, an, binh, 'Xong', 'HOAN_THANH')
      // Lưu trữ: không đếm.
      const luuTru = await taoCoNgay('Lưu trữ quá hạn', '2026-11-01')
      giaTri(await kho.luuTruDuAn(pm, luuTru, LUC_TAO))

      expect((await doc(pm, CUOI_NGAY_HAN)).oSo.duAnQuaHanDuKien).toBe(0)
      const tq = await doc(pm, DAU_NGAY_SAU_HAN)
      expect(tq.oSo.duAnQuaHanDuKien).toBe(1)
      expect(tq.hoatDong.map((d) => [d.duAn.ten, d.quaHanDuKien])).toEqual([
        ['Cửa hàng', false],
        ['Quá hạn', true],
        ['Xong hết', false],
      ])
      // Thành viên chỉ đếm Dự án mình được xem.
      expect((await doc(an, DAU_NGAY_SAU_HAN)).oSo.duAnQuaHanDuKien).toBe(1)
    })

    it('dấu "chưa có Người phụ trách": PM và Support thấy trên Dự án chưa có Người phụ trách; Thành viên không thấy', async () => {
      const { pm, an, binh, duAnId } = await dungBoiCanh()
      const support = await taoNguoiCoVai(pm, 'support-pt-tq', 'SUPPORT')
      const coPhuTrach = await taoDuAn(pm, 'Có phụ trách')
      await them(pm, duAnId, support)
      for (const phien of [an, binh, support]) await them(pm, coPhuTrach, phien)
      giaTri(await kho.suaDuAn(pm, coPhuTrach, { nguoiPhuTrachId: binh.nguoiDungId }, LUC_TAO))
      for (const phien of [pm, support]) {
        expect((await doc(phien)).hoatDong.map((d) => [d.duAn.ten, d.chuaCoNguoiPhuTrach])).toEqual([
          ['Có phụ trách', false],
          ['Cửa hàng', true],
        ])
      }
      for (const phien of [an, binh]) {
        expect((await doc(phien)).hoatDong.map((d) => d.chuaCoNguoiPhuTrach)).toEqual([false, false])
      }
    })

    it('chưa đăng nhập thì trả CHUA_DANG_NHAP', async () => {
      const kq = await docTongQuan(kho, null, CUOI_NGAY_HAN)
      expect(kq.ok).toBe(false)
      if (!kq.ok) expect(kq.loi.ma).toBe('CHUA_DANG_NHAP')
    })
  })

  if (!coTask || !coDatTrangThai) {
    describe(`Tổng quan — ${tenBanCai}`, () => {
      it.skip('CHƯA KIỂM: bản cài chưa có lệnh Task hoặc datTrangThaiTask', () => {})
    })
  }
}
