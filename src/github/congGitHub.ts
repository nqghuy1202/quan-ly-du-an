// Cổng GitHub: giao diện thứ hai của hệ thống (bên cạnh Kho dữ liệu). CHỈ CÓ THAO TÁC ĐỌC: không
// có thao tác nào tạo issue, đổi trạng thái PR hay ghi bất cứ thứ gì lên GitHub, và không được thêm.
// Nhận liên kết (repo, loại, số) đã phân tích bằng `phanTichLienKet`, trả trạng thái đã chuẩn hoá
// hoặc một lỗi có mã (`MaLoiGitHub`). Bản giả để test: `congGiaGitHub.ts`; bản gọi Edge Function
// thuộc ticket 17.
import type { KetQuaGitHub, LienKetGitHub, TrangThaiLienKet } from '../luat/github'

export interface CongGitHub {
  /**
   * Trạng thái hiện tại của một issue hoặc PR (issue: mở hoặc đóng; PR: mở, đã merge hoặc đóng;
   * PR nháp coi là mở). Lỗi: `KHONG_TIM_THAY`, `RIENG_TU`, `HET_LUOT_GOI`, `MAT_MANG`, `DU_LIEU_LA`.
   */
  docTrangThai(lienKet: LienKetGitHub): Promise<KetQuaGitHub<TrangThaiLienKet>>
  /**
   * Trạng thái của nhiều liên kết, theo đúng thứ tự đầu vào; mỗi liên kết có kết quả riêng, nên một
   * liên kết lỗi không làm hỏng các liên kết còn lại.
   */
  docNhieuTrangThai(cacLienKet: readonly LienKetGitHub[]): Promise<KetQuaGitHub<TrangThaiLienKet>[]>
}

/** Mọi thao tác của Cổng GitHub, và tất cả đều là thao tác đọc (tên bắt đầu bằng "doc"). */
export const CAC_THAO_TAC_CONG_GITHUB = ['docTrangThai', 'docNhieuTrangThai'] as const

// Nếu giao diện `CongGitHub` có thêm thao tác mà chưa vào danh sách trên thì dòng này không biên dịch được.
export const _MOI_THAO_TAC_DEU_CO_TRONG_DANH_SACH: Exclude<
  keyof CongGitHub,
  (typeof CAC_THAO_TAC_CONG_GITHUB)[number]
> extends never
  ? true
  : never = true
