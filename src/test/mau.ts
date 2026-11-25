/**
 * Hàm thuần về màu cho test theme: đọc mã hex, đổi sang HSL, tính độ sáng và tỉ lệ tương phản
 * theo WCAG 2.x. Không I/O, không phụ thuộc gói ngoài.
 */

export type Rgb = readonly [number, number, number]

/** Đọc `#rgb` hoặc `#rrggbb` (bỏ qua kênh trong suốt nếu có `#rrggbbaa`). */
export function docHex(hex: string): Rgb {
  const goc = hex.trim().replace(/^#/, '')
  const day =
    goc.length === 3
      ? goc
          .split('')
          .map((k) => k + k)
          .join('')
      : goc.slice(0, 6)
  if (!/^[0-9a-fA-F]{6}$/.test(day)) throw new Error(`Không đọc được màu "${hex}"`)
  return [parseInt(day.slice(0, 2), 16), parseInt(day.slice(2, 4), 16), parseInt(day.slice(4, 6), 16)]
}

function kenhTuyenTinh(kenh: number): number {
  const c = kenh / 255
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function doSang([r, g, b]: Rgb): number {
  return 0.2126 * kenhTuyenTinh(r) + 0.7152 * kenhTuyenTinh(g) + 0.0722 * kenhTuyenTinh(b)
}

/** Tỉ lệ tương phản WCAG giữa hai màu, từ 1 đến 21 (không phụ thuộc thứ tự). */
export function tuongPhan(a: Rgb, b: Rgb): number {
  const [sang, toi] = [doSang(a), doSang(b)].sort((x, y) => y - x)
  return (sang + 0.05) / (toi + 0.05)
}

/** Chuyển sang HSL: sắc độ 0–360, bão hoà và độ sáng 0–100. */
export function sangHsl([r, g, b]: Rgb): { h: number; s: number; l: number } {
  const [rr, gg, bb] = [r / 255, g / 255, b / 255]
  const max = Math.max(rr, gg, bb)
  const min = Math.min(rr, gg, bb)
  const l = (max + min) / 2
  const d = max - min
  if (d === 0) return { h: 0, s: 0, l: l * 100 }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (max === rr) h = ((gg - bb) / d) % 6
  else if (max === gg) h = (bb - rr) / d + 2
  else h = (rr - gg) / d + 4
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 }
}

/** Khoảng cách Euclid giữa hai màu trong không gian RGB (0 đến khoảng 441). */
export function khoangCachMau(a: Rgb, b: Rgb): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

/** Lệch lớn nhất trên một kênh đỏ, lục, lam. */
export function lechKenhLonNhat(a: Rgb, b: Rgb): number {
  return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]))
}

/** Đổi HSL (h 0–360, s và l 0–100) sang RGB làm tròn. */
export function tuHsl(h: number, s: number, l: number): Rgb {
  const ss = s / 100
  const ll = l / 100
  const c = (1 - Math.abs(2 * ll - 1)) * ss
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = ll - c / 2
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)]
}
