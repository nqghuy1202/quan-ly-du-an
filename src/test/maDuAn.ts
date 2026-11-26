// Sinh Mã Dự án cho test dựng Dự án (chỉ test dùng). Mã Dự án là bắt buộc và duy nhất, nên mỗi lần
// gọi trả một mã mới đúng dạng (`T-1`, `T-2`, ...). Không đồng hồ, không số ngẫu nhiên.
let dem = 0

/** Một Mã Dự án chưa dùng trong tiến trình test này. */
export function maDuAnMoi(): string {
  dem += 1
  return `T-${dem}`
}
