/**
 * Quét mã giao diện của ứng dụng (bổ sung cho ESLint): không mã màu hex rời, không giá trị `px` rời,
 * không `outline: none`. Màu đi qua theme; cỡ đi qua prop của component hoặc `rem`.
 * Không quét: file test, theme sinh tự động (`src/astryx-themes.ts`, `src/themes/`), file mô tả kiểu.
 */
const NGUON = import.meta.glob(['/src/**/*.{ts,tsx,css}', '/index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

const BO_QUA = [
  /\.test\.(ts|tsx)$/,
  /^\/src\/test\//,
  /^\/src\/themes\//,
  /^\/src\/astryx-themes\.ts$/,
  /\.d\.ts$/,
]

/** Bỏ chú thích để lời giải thích trong mã không bị tính nhầm là giá trị. */
function boChuThich(ma: string): string {
  return ma.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
}

const CAC_FILE = Object.entries(NGUON)
  .filter(([duongDan]) => !BO_QUA.some((m) => m.test(duongDan)))
  .map(([duongDan, ma]) => ({ duongDan, ma: boChuThich(ma) }))

function timTrong(mau: RegExp) {
  return CAC_FILE.flatMap(({ duongDan, ma }) => (ma.match(mau) ?? []).map((m) => `${duongDan}: ${m}`))
}

describe('mã giao diện không chứa giá trị rời', () => {
  it('quét được mã của ứng dụng (không quét rỗng)', () => {
    expect(CAC_FILE.length).toBeGreaterThan(20)
    expect(CAC_FILE.some((f) => f.duongDan === '/src/App.tsx')).toBe(true)
  })

  it('không có mã màu hex rời', () => {
    // `#` theo sau bởi 3, 4, 6 hoặc 8 chữ số hex và kết thúc ở ranh giới từ, không đứng sau chữ (tránh `&#...;`, anchor).
    expect(timTrong(/(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![\w-])/g)).toEqual([])
  })

  it('không có giá trị px rời', () => {
    expect(timTrong(/(?<![\w.-])\d+(?:\.\d+)?px\b/g)).toEqual([])
  })

  it('không có outline: none (focus ring luôn nhìn thấy)', () => {
    expect(timTrong(/outline\s*:\s*(?:none|0)\b/g)).toEqual([])
    expect(timTrong(/outline(?:Style)?['"]?\s*[:=]\s*['"]none['"]/g)).toEqual([])
  })

  it('không đè biến màu của theme ở :root hay trong mã', () => {
    expect(timTrong(/:root\s*\{/g)).toEqual([])
    expect(timTrong(/['"]--color-[a-z-]+['"]\s*:/g)).toEqual([])
  })
})
