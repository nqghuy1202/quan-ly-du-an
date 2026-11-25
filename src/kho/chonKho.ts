// Chọn bản cài Kho dữ liệu theo cấu hình môi trường (xem cauHinh.ts):
// - không có cấu hình Supabase: bản bộ nhớ, có sẵn một PM chạy thử; chỉ để chạy thử trên máy;
// - có cấu hình Supabase hợp lệ (địa chỉ và khoá công khai): bản Supabase;
// - cấu hình sai, hoặc có khoá service trong biến VITE_*: lỗi, ứng dụng không chạy.
// Cổng GitHub (chỉ đọc) đi cùng bản cài: bản Supabase gọi Edge Function `doc-github` bằng chính phiên
// đăng nhập của người dùng; bản bộ nhớ dùng bản giả (chỉ để chạy thử, không gọi mạng).
// Dựng Kho và Cổng không gọi mạng; chỉ các lệnh của Kho và Cổng mới gọi.
import { docCauHinhKho, type MoiTruong } from './cauHinh'
import { PM_CHAY_THU, taoKhoBoNho, type MoPhongThu } from './khoBoNho'
import type { KhoDuLieu } from './khoDuLieu'
import { napDuLieuMau } from './duLieuMau'
import { taoKhoSupabase } from './khoSupabase'
import type { CongGitHub } from '../github/congGitHub'
import { loiGia, taoCongGiaGitHub } from '../github/congGiaGitHub'
import { taoCongGitHubEdge } from '../github/congGitHubEdge'

export type KhoDaChon =
  | { loai: 'BO_NHO'; kho: KhoDuLieu; moPhong: MoPhongThu; congGitHub: CongGitHub }
  | { loai: 'SUPABASE'; kho: KhoDuLieu; moPhong: null; congGitHub: CongGitHub }
  | { loai: 'LOI'; thongBao: string }

export interface TuyChonChonKho {
  /** Trang mà đường dẫn trong thư của Supabase đưa người dùng về (thường là địa chỉ của ứng dụng). */
  duongDanQuayLai?: string
  /** `fetch` cho bản Supabase và Cổng GitHub gọi hàm (test truyền bản cấm gọi mạng). */
  fetch?: typeof fetch
  /** Bản bộ nhớ: nạp dữ liệu mẫu (3 Dự án) sau khi dựng. Chỉ để chạy thử (`npm run dev`). */
  duLieuMau?: boolean
}

export function chonKho(env: MoiTruong, tuyChon: TuyChonChonKho = {}): KhoDaChon {
  const cauHinh = docCauHinhKho(env)
  switch (cauHinh.loai) {
    case 'LOI':
      return cauHinh
    case 'BO_NHO': {
      const boNho = taoKhoBoNho({ pmBanDau: PM_CHAY_THU })
      if (tuyChon.duLieuMau) {
        napDuLieuMau(boNho).catch((loi: unknown) => console.warn('Không nạp được dữ liệu mẫu:', loi))
      }
      // Bản giả: mọi link báo không kết nối được GitHub; Task vẫn dùng được.
      return {
        loai: 'BO_NHO',
        kho: boNho,
        moPhong: boNho.moPhong,
        congGitHub: taoCongGiaGitHub({ macDinh: loiGia('MAT_MANG') }).cong,
      }
    }
    case 'SUPABASE': {
      const kho = taoKhoSupabase({
        url: cauHinh.url,
        khoaCongKhai: cauHinh.khoaCongKhai,
        ...(tuyChon.duongDanQuayLai ? { duongDanQuayLai: tuyChon.duongDanQuayLai } : {}),
        ...(tuyChon.fetch ? { fetch: tuyChon.fetch } : {}),
      })
      return {
        loai: 'SUPABASE',
        kho,
        moPhong: null,
        congGitHub: taoCongGitHubEdge({
          url: cauHinh.url,
          khoaCongKhai: cauHinh.khoaCongKhai,
          layMaTruyCap: () => kho.maTruyCapHienTai(),
          ...(tuyChon.fetch ? { fetch: tuyChon.fetch } : {}),
        }),
      }
    }
  }
}
