// Bộ test hợp đồng của ticket 13: trang tổng quan (Tiến độ, số Task theo trạng thái, cờ Trễ hạn,
// quyền xem theo vai). Chạy lại cho mọi bản cài của Kho dữ liệu qua `chayHopDongTongQuan`.
// Chỉ đi qua giao diện `KhoDuLieu`; "bây giờ" truyền vào. Task ở trạng thái Hoàn thành, Huỷ... được
// dựng sẵn bằng `BanCaiHopDong.datTrangThaiTask`.
import { beforeEach, describe, expect, it } from 'vitest'
import type { KetQua } from './ketQua'
import type { KhoDuLieu, Phien, Task } from './khoDuLieu'
import type { BanCaiHopDong, TuyChonHopDong } from './hopDong'
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
      return giaTri(await kho.taoDuAn(pm, { ten }, LUC_TAO)).id
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

    it('PM thấy mọi Dự án (kể cả Dự án mình không ở trong); Dự án Lưu trữ ở nhóm riêng', async () => {
      const { pm, duAnId } = await dungBoiCanh()
      await taoDuAn(pm, 'Kho hàng')
      const luuTru = await taoDuAn(pm, 'Cũ')
      giaTri(await kho.luuTruDuAn(pm, luuTru, LUC_TAO))
      expect(duAnId).not.toBe(luuTru)
      const tq = await doc(pm)
      expect(tq.hoatDong.map((d) => d.duAn.ten)).toEqual(['Cửa hàng', 'Kho hàng'])
      expect(tq.luuTru.map((d) => d.duAn.ten)).toEqual(['Cũ'])
    })

    it('Support và Thành viên chỉ thấy Dự án mình ở trong; người chưa ở Dự án nào nhận hai nhóm rỗng', async () => {
      const { pm, an, duAnId } = await dungBoiCanh()
      await taoDuAn(pm, 'Dự án khác')
      const support = await taoNguoiCoVai(pm, 'support-tq', 'SUPPORT')
      await them(pm, duAnId, support)
      const khach = await dangKyVaDangNhap('khach-tq', 'Khách')
      for (const phien of [an, support]) {
        const tq = await doc(phien)
        expect(tq.hoatDong.map((d) => d.duAn.ten)).toEqual(['Cửa hàng'])
        expect(tq.luuTru).toEqual([])
      }
      expect(await doc(khach)).toEqual({ hoatDong: [], luuTru: [] })
      // Support không ở Dự án nào cũng chỉ thấy rỗng (không phải PM).
      const supportNgoai = await taoNguoiCoVai(pm, 'support-ngoai-tq', 'SUPPORT')
      expect(await doc(supportNgoai)).toEqual({ hoatDong: [], luuTru: [] })
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
