import { docHex, khoangCachMau, sangHsl, tuHsl, tuongPhan } from './mau'

describe('hàm màu thuần của test theme', () => {
  it('tương phản đen trên trắng là 21 và không phụ thuộc thứ tự', () => {
    expect(tuongPhan(docHex('#000000'), docHex('#ffffff'))).toBeCloseTo(21, 5)
    expect(tuongPhan(docHex('#ffffff'), docHex('#000000'))).toBeCloseTo(21, 5)
    expect(tuongPhan(docHex('#777'), docHex('#777'))).toBeCloseTo(1, 5)
  })

  it('xanh ngọc gốc #0FAEBD trên nền trắng chỉ khoảng 2,7 trên 1 (lý do không dùng làm chữ)', () => {
    const t = tuongPhan(docHex('#0FAEBD'), docHex('#ffffff'))
    expect(t).toBeGreaterThan(2.5)
    expect(t).toBeLessThan(3)
  })

  it('đọc hex ngắn, hex có kênh trong suốt và đổi qua lại HSL', () => {
    expect(docHex('#fff')).toEqual([255, 255, 255])
    expect(docHex('#0000000F')).toEqual([0, 0, 0])
    const { h, s, l } = sangHsl(docHex('#0B3865'))
    expect(Math.round(h)).toBeGreaterThanOrEqual(209)
    expect(Math.round(h)).toBeLessThanOrEqual(211)
    expect(Math.round(s)).toBe(80)
    expect(Math.round(l)).toBe(22)
    expect(tuHsl(0, 100, 50)).toEqual([255, 0, 0])
    expect(khoangCachMau([0, 0, 0], [3, 4, 0])).toBe(5)
  })

  it('từ chối chuỗi không phải màu', () => {
    expect(() => docHex('xanh')).toThrow()
  })
})
