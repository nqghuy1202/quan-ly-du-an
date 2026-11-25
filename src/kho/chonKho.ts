// Chọn bản cài Kho dữ liệu theo cấu hình môi trường (xem cauHinh.ts):
// - không có cấu hình Supabase: bản bộ nhớ, có sẵn một PM chạy thử; chỉ để chạy thử trên máy;
// - có cấu hình Supabase hợp lệ (địa chỉ và khoá công khai): bản Supabase;
// - cấu hình sai, hoặc có khoá service trong biến VITE_*: lỗi, ứng dụng không chạy.
// Dựng Kho không gọi mạng; chỉ các lệnh của Kho mới gọi.
import { docCauHinhKho, type MoiTruong } from './cauHinh'
import { PM_CHAY_THU, taoKhoBoNho, type MoPhongThu } from './khoBoNho'
import type { KhoDuLieu } from './khoDuLieu'
import { taoKhoSupabase } from './khoSupabase'

export type KhoDaChon =
  | { loai: 'BO_NHO'; kho: KhoDuLieu; moPhong: MoPhongThu }
  | { loai: 'SUPABASE'; kho: KhoDuLieu; moPhong: null }
  | { loai: 'LOI'; thongBao: string }

export interface TuyChonChonKho {
  /** Trang mà đường dẫn trong thư của Supabase đưa người dùng về (thường là địa chỉ của ứng dụng). */
  duongDanQuayLai?: string
  /** `fetch` cho bản Supabase (test truyền bản cấm gọi mạng). */
  fetch?: typeof fetch
}

export function chonKho(env: MoiTruong, tuyChon: TuyChonChonKho = {}): KhoDaChon {
  const cauHinh = docCauHinhKho(env)
  switch (cauHinh.loai) {
    case 'LOI':
      return cauHinh
    case 'BO_NHO': {
      const boNho = taoKhoBoNho({ pmBanDau: PM_CHAY_THU })
      return { loai: 'BO_NHO', kho: boNho, moPhong: boNho.moPhong }
    }
    case 'SUPABASE':
      return {
        loai: 'SUPABASE',
        kho: taoKhoSupabase({
          url: cauHinh.url,
          khoaCongKhai: cauHinh.khoaCongKhai,
          ...(tuyChon.duongDanQuayLai ? { duongDanQuayLai: tuyChon.duongDanQuayLai } : {}),
          ...(tuyChon.fetch ? { fetch: tuyChon.fetch } : {}),
        }),
        moPhong: null,
      }
  }
}
