// Phần cổng kiểm được của Task trên bản Supabase (ticket 10), không cần mạng hay DB.
//
// Cổng KHÔNG chạy được SQL, nên không kiểm được phân quyền từng dòng, trigger hay ràng buộc thật:
// những thứ đó chỉ kiểm tay (supabase/README.md). Ở đây chỉ có:
//   1. Mọi lệnh Task của bản Supabase từ chối ngay ở ranh giới khi chưa đăng nhập, không gọi mạng.
//   2. Bộ test hợp đồng và bảng ca (phần Task) KHÔNG còn bị tắt cho bản Supabase: `coTask` bật, và
//      chúng chỉ chạy trên Supabase thật (lệnh riêng; trong `npm test` vẫn "CHƯA KIỂM").
//   3. Kiểm tra cấu trúc file migration (không phải chạy SQL): chặn những sai sót dễ thấy mà cổng
//      không thể bắt bằng cách khác (quên bật RLS, mở quyền cột trạng thái cho client, bản xuống
//      thiếu đối tượng).
import { describe, expect, it } from 'vitest'
import { chonKho } from './chonKho'
import { BIEN_KHOA_SUPABASE, BIEN_URL_SUPABASE } from './cauHinh'
import { taoBoBanCaiSupabase } from './hopDongSupabase'
import type { Phien } from './khoDuLieu'
import migrationLen from '../../supabase/migrations/20261125000200_lat_2_task.sql?raw'
import migrationXuong from '../../supabase/down/20261125000200_lat_2_task.down.sql?raw'

/** JWT giả (chữ ký không hợp lệ), như cauHinh.test.ts. */
function jwtGia(than: Record<string, unknown>): string {
  const ma = (doiTuong: Record<string, unknown>) =>
    btoa(JSON.stringify(doiTuong)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  return `${ma({ alg: 'HS256', typ: 'JWT' })}.${ma(than)}.chu-ky-gia`
}

const URL_GIA = 'https://du-an-gia.supabase.co'
const KHOA_ANON = jwtGia({ iss: 'supabase', ref: 'du-an-gia', role: 'anon' })
const KHOA_SERVICE = jwtGia({ iss: 'supabase', ref: 'du-an-gia', role: 'service_role' })
const LUC = new Date('2026-04-10T09:30:00+07:00')

describe('lệnh Task của bản Supabase, không gọi mạng', () => {
  it('chưa đăng nhập (hoặc phiên không có thật): mọi lệnh Task trả CHUA_DANG_NHAP ngay, không gọi mạng', async () => {
    let soLanGoi = 0
    const fetchCam: typeof fetch = async () => {
      soLanGoi += 1
      throw new Error('Test không được gọi mạng')
    }
    const chon = chonKho({ [BIEN_URL_SUPABASE]: URL_GIA, [BIEN_KHOA_SUPABASE]: KHOA_ANON }, { fetch: fetchCam })
    if (chon.loai !== 'SUPABASE') throw new Error(`Mong đợi bản Supabase, nhận ${chon.loai}`)
    const kho = chon.kho
    const phienGia: Phien = { maPhien: 'khong-ton-tai', nguoiDungId: 'khong-ton-tai' }

    for (const phien of [null, phienGia]) {
      const ketQua = [
        await kho.taoTask(phien, 'du-an', { tieuDe: 'X', nguoiThucHienId: 'a', nguoiKiemTraId: 'b' }, LUC),
        await kho.danhSachTask(phien, 'du-an'),
        await kho.layTask(phien, 'task'),
        await kho.viecCuaToi(phien),
        await kho.choToiDuyet(phien),
        await kho.suaTask(phien, 'task', { tieuDe: 'Y' }, LUC),
        await kho.doiNguoiTask(phien, 'task', { nguoiThucHienId: 'a' }, LUC),
        await kho.danhSachTaskNguoiDangGiu(phien, 'du-an', 'nguoi'),
      ]
      expect(ketQua).toHaveLength(8)
      for (const kq of ketQua) expect(kq.ok || kq.loi.ma).toBe('CHUA_DANG_NHAP')
    }
    expect(soLanGoi).toBe(0)
  })
})

describe('bộ test hợp đồng cho bản Supabase có phần Task', () => {
  it('bật coTask và dựng sẵn Task ở trạng thái bất kỳ (chạy trên Supabase thật, lệnh riêng); cổng không gọi mạng', () => {
    const { tuyChon, taoBanCai } = taoBoBanCaiSupabase({
      url: URL_GIA,
      khoaCongKhai: KHOA_ANON,
      khoaService: KHOA_SERVICE,
      tenMien: 'example.com',
      thoiHanMaDatLaiMs: 3600 * 1000,
    })
    // Không bị tắt: mặc định của bộ hợp đồng là bật Task, nên chỉ cần không đặt `false`.
    expect(tuyChon.coTask).not.toBe(false)
    expect(tuyChon.coDatTrangThaiTask).not.toBe(false)
    // Việc dựng bản cài chưa gọi mạng: chỉ tạo client, không gửi gì.
    expect(typeof taoBanCai().datTrangThaiTask).toBe('function')
  })
})

// --- Cấu trúc file migration (không chạy SQL) ---

/** Bỏ chú thích `-- ...` để không khớp nhầm lời giải thích. */
function boChuThich(sql: string): string {
  return sql.replace(/--.*$/gm, '')
}

const SQL = boChuThich(migrationLen)
const SQL_XUONG = boChuThich(migrationXuong)

/** Cột có trong `create table public.task (...)`. */
function cotCuaBangTask(): string[] {
  const khop = /create table public\.task \(([\s\S]*?)\n\);/.exec(SQL)
  if (!khop) throw new Error('Không tìm thấy create table public.task')
  const cot: string[] = []
  for (const dong of khop[1].split('\n')) {
    const m = /^\s{2}([a-z_]+)\s+(uuid|text|date|integer|timestamptz)\b/.exec(dong)
    if (m) cot.push(m[1])
  }
  return cot
}

/** Cột trong `grant <quyen> (cột, ...) on table public.task to authenticated`. */
function cotDuocCap(quyen: 'insert' | 'update'): string[] {
  const khop = new RegExp(`grant\\s+${quyen}\\s*\\(([^)]*)\\)\\s+on\\s+table\\s+public\\.task\\s+to\\s+authenticated`, 'i').exec(SQL)
  if (!khop) throw new Error(`Không tìm thấy grant ${quyen} (cột) cho authenticated`)
  return khop[1].split(',').map((c) => c.trim())
}

describe('migration lát 2 (Task): cấu trúc file, không chạy SQL', () => {
  it('bật phân quyền từng dòng cho bảng task và không có policy nào cho anon', () => {
    expect(SQL).toMatch(/alter table public\.task enable row level security/i)
    expect(SQL).not.toMatch(/create policy[\s\S]*?to\s+anon/i)
    expect(SQL).not.toMatch(/to\s+public\b/i)
  })

  it('không có policy xoá và không cấp quyền xoá hay quyền cả bảng cho client', () => {
    expect(SQL).not.toMatch(/for\s+delete/i)
    expect(SQL).not.toMatch(/grant\s+[^;]*\bdelete\b[^;]*\bto\s+authenticated/i)
    // Chỉ service_role có quyền cả bảng; authenticated chỉ có select và các quyền theo cột.
    expect(SQL).not.toMatch(/grant\s+all\s+on\s+table\s+public\.task\s+to\s+[^;]*authenticated/i)
    expect(SQL).toMatch(/revoke all on table public\.task from public, anon, authenticated/i)
    expect(SQL).toMatch(/grant select on table public\.task to authenticated/i)
  })

  it('client chỉ được ghi các cột tiêu đề, mô tả, hạn, hai người (và Dự án khi tạo)', () => {
    const cot = cotCuaBangTask()
    expect(cot).toEqual(
      expect.arrayContaining([
        'id',
        'du_an_id',
        'trang_thai',
        'so_lan_tra_lai',
        'tao_boi',
        'tao_luc',
        'sua_boi',
        'sua_luc',
      ]),
    )
    const them = cotDuocCap('insert')
    const sua = cotDuocCap('update')
    for (const c of [...them, ...sua]) expect(cot).toContain(c)
    for (const camCap of ['id', 'trang_thai', 'so_lan_tra_lai', 'tao_boi', 'tao_luc', 'sua_boi', 'sua_luc']) {
      expect(them).not.toContain(camCap)
      expect(sua).not.toContain(camCap)
    }
    expect([...sua].sort()).toEqual(['han', 'mo_ta', 'nguoi_kiem_tra_id', 'nguoi_thuc_hien_id', 'tieu_de'])
    // Đổi Dự án của một Task không phải việc client làm được.
    expect(sua).not.toContain('du_an_id')
  })

  it('có ràng buộc: tiêu đề, trạng thái hợp lệ, số lần Trả lại không âm, hai người khác nhau', () => {
    for (const rangBuoc of [
      'task_tieu_de_hop_le',
      'task_trang_thai_hop_le',
      'task_so_lan_tra_lai_hop_le',
      'task_nguoi_khac_nhau',
      'task_dau_vet_sua_du_cap',
    ]) {
      expect(SQL).toContain(rangBuoc)
    }
    expect(SQL).toMatch(/char_length\(tieu_de\) <= 200/)
    expect(SQL).toMatch(/nguoi_thuc_hien_id <> nguoi_kiem_tra_id/)
    // Bảy trạng thái của spec, không hơn không kém.
    for (const trangThai of ['MOI', 'DANG_LAM', 'CHO_DUYET', 'TRA_LAI', 'BI_LOI', 'HOAN_THANH', 'HUY']) {
      expect(SQL).toContain(`'${trangThai}'`)
    }
  })

  it('có trigger tạo và sửa Task, và cả hai ném đúng các mã lỗi của Kho', () => {
    expect(SQL).toMatch(/create trigger task_truoc_khi_tao\s+before insert on public\.task/i)
    expect(SQL).toMatch(/create trigger task_truoc_khi_sua\s+before update on public\.task/i)
    for (const ma of [
      'KHONG_CO_QUYEN',
      'KHONG_TIM_THAY',
      'DU_AN_DA_LUU_TRU',
      'TASK_DA_CHOT',
      'THIEU_NGUOI',
      'NGUOI_NGOAI_DU_AN',
      'TRUNG_NGUOI',
    ]) {
      expect(SQL).toContain(`raise exception '${ma}'`)
    }
    // Task mới luôn bắt đầu ở Mới với 0 lần Trả lại.
    expect(SQL).toMatch(/new\.trang_thai := 'MOI'/)
    expect(SQL).toMatch(/new\.so_lan_tra_lai := 0/)
  })

  it('bản xuống bỏ mọi bảng và hàm mà bản lên tạo', () => {
    const bang = [...SQL.matchAll(/create table (public\.[a-z_]+)/gi)].map((m) => m[1])
    expect(bang).toEqual(['public.task'])
    for (const ten of bang) expect(SQL_XUONG).toMatch(new RegExp(`drop table if exists ${ten.replace('.', '\\.')}\\b`, 'i'))
    const ham = [...SQL.matchAll(/create function ([a-z_]+\.[a-z_]+)\(/gi)].map((m) => m[1])
    expect(ham.length).toBeGreaterThan(0)
    for (const ten of ham) expect(SQL_XUONG).toMatch(new RegExp(`drop function if exists ${ten.replace('.', '\\.')}\\(`, 'i'))
  })
})
