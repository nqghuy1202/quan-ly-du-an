// Luật thuần về ngày (chỉ ngày, không giờ) dạng `YYYY-MM-DD`: kiểm ngày có thật và hiện ngày/tháng/năm.
// Dùng chung cho hạn của Task và ngày của Dự án. Không I/O, không đọc đồng hồ.

const NGAY_ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Chuỗi `YYYY-MM-DD` có phải một ngày có thật trên lịch không (vd. 2026-02-30 thì không). */
export function laNgayHopLe(chuoi: string): boolean {
  const khop = NGAY_ISO.exec(chuoi)
  if (!khop) return false
  const nam = Number(khop[1])
  const thang = Number(khop[2])
  const ngay = Number(khop[3])
  if (thang < 1 || thang > 12 || ngay < 1) return false
  // Ngày cuối tháng: ngày 0 của tháng sau. Tính trên UTC nên không phụ thuộc múi giờ của máy.
  const moc = new Date(0)
  moc.setUTCFullYear(nam, thang, 0)
  return ngay <= moc.getUTCDate()
}

/** Ngày dạng `YYYY-MM-DD` hiện ra thành `dd/MM/yyyy`. Chỉ là một ngày, không có giờ. */
export function dinhDangNgay(ngay: string): string {
  const khop = NGAY_ISO.exec(ngay)
  if (!khop) return ngay
  return `${khop[3]}/${khop[2]}/${khop[1]}`
}
