import { themes } from './astryx-themes'
import {
  docHex,
  khoangCachMau,
  lechKenhLonNhat,
  sangHsl,
  tuHsl,
  tuongPhan,
  type Rgb,
} from './test/mau'

/**
 * Theme `sdvico` đọc từ chính đối tượng theme đã dựng (`src/astryx-themes.ts` -> `src/themes/sdvico`),
 * không từ bản sao trong test. Mỗi token màu có dạng `light-dark(sáng, tối)` hoặc một màu chung.
 */
interface ThemeDaDung {
  tokens: Record<string, string>
  components: Record<string, { base?: Record<string, string> }>
}
const sdvico = themes.sdvico as unknown as ThemeDaDung
const trungTinh = themes.neutral as unknown as ThemeDaDung

type CheDo = 'sang' | 'toi'
const CAC_CHE_DO: CheDo[] = ['sang', 'toi']

function tachMau(giaTri: string, cheDo: CheDo): Rgb {
  const m = /^light-dark\(\s*(#[0-9a-fA-F]{3,8})\s*,\s*(#[0-9a-fA-F]{3,8})\s*\)$/.exec(giaTri.trim())
  if (m) return docHex(cheDo === 'sang' ? m[1] : m[2])
  return docHex(giaTri)
}

function mau(token: string, cheDo: CheDo, theme: ThemeDaDung = sdvico): Rgb {
  const giaTri = theme.tokens[token]
  if (!giaTri) throw new Error(`Theme không có token ${token}`)
  return tachMau(giaTri, cheDo)
}

function mauVienONhap(cheDo: CheDo): Rgb {
  const giaTri = sdvico.components['text-input']?.base?.borderColor
  if (!giaTri) throw new Error('Theme không đặt màu viền cho ô nhập')
  return tachMau(giaTri, cheDo)
}

/** Các nền mà chữ và điều khiển thường nằm trên: nền trang, mặt phẳng, thẻ, hộp nổi. */
const CAC_NEN = [
  '--color-background-body',
  '--color-background-surface',
  '--color-background-card',
  '--color-background-popover',
] as const

const SAI_SO_KENH = 12

describe('theme sdvico: giá trị màu quanh bảng màu của spec', () => {
  it('màu chính navy sáng đúng #0B3865 (hsl 210 80% 22%)', () => {
    const chinh = mau('--color-accent', 'sang')
    expect(lechKenhLonNhat(chinh, docHex('#0B3865'))).toBeLessThanOrEqual(SAI_SO_KENH)
    const { h, s, l } = sangHsl(chinh)
    expect(h).toBeGreaterThan(205)
    expect(h).toBeLessThan(215)
    expect(s).toBeGreaterThan(70)
    expect(l).toBeGreaterThan(18)
    expect(l).toBeLessThan(26)
  })

  it('chế độ tối: màu chính chuyển sang xanh ngọc hsl 185 85% 50%', () => {
    const chinh = mau('--color-accent', 'toi')
    expect(lechKenhLonNhat(chinh, tuHsl(185, 85, 50))).toBeLessThanOrEqual(SAI_SO_KENH)
  })

  it('màu nhấn xanh ngọc: họ màu #0FAEBD ở cả hai chế độ (tối: sắc gốc, sáng: sắc đậm hơn cho biểu tượng)', () => {
    const hueGoc = sangHsl(docHex('#0FAEBD')).h
    for (const cheDo of CAC_CHE_DO) {
      const nhan = mau('--color-icon-accent', cheDo)
      expect(Math.abs(sangHsl(nhan).h - hueGoc)).toBeLessThanOrEqual(10)
      expect(sangHsl(nhan).s).toBeGreaterThan(70)
    }
    expect(lechKenhLonNhat(mau('--color-icon-accent', 'toi'), docHex('#0FAEBD'))).toBeLessThanOrEqual(
      60,
    )
  })

  it('nền: sáng #F5F7F9, tối hsl 210 50% 6%', () => {
    expect(lechKenhLonNhat(mau('--color-background-body', 'sang'), docHex('#F5F7F9'))).toBeLessThanOrEqual(
      SAI_SO_KENH,
    )
    expect(lechKenhLonNhat(mau('--color-background-body', 'toi'), tuHsl(210, 50, 6))).toBeLessThanOrEqual(
      SAI_SO_KENH,
    )
  })

  it('chữ chính: sáng #0D1A26, tối là xám nhạt (sáng, ít màu)', () => {
    expect(lechKenhLonNhat(mau('--color-text-primary', 'sang'), docHex('#0D1A26'))).toBeLessThanOrEqual(
      SAI_SO_KENH,
    )
    const toi = sangHsl(mau('--color-text-primary', 'toi'))
    expect(toi.l).toBeGreaterThan(85)
    expect(toi.s).toBeLessThan(40)
  })

  it('chế độ tối là bảng màu riêng của sdvico, không rơi về theme trung tính', () => {
    for (const token of ['--color-accent', '--color-background-body', '--color-text-primary']) {
      expect(lechKenhLonNhat(mau(token, 'toi'), mau(token, 'toi', trungTinh))).toBeGreaterThan(SAI_SO_KENH)
    }
    // Chế độ sáng: màu chính và chữ cũng khác trung tính (nền sáng vốn gần nhau nên không so).
    for (const token of ['--color-accent', '--color-text-primary']) {
      expect(lechKenhLonNhat(mau(token, 'sang'), mau(token, 'sang', trungTinh))).toBeGreaterThan(
        SAI_SO_KENH,
      )
    }
    // Hai chế độ khác nhau ở các token nền chính.
    expect(khoangCachMau(mau('--color-background-body', 'sang'), mau('--color-background-body', 'toi'))).toBeGreaterThan(
      200,
    )
  })
})

describe('theme sdvico: tương phản ở cả hai chế độ', () => {
  for (const cheDo of CAC_CHE_DO) {
    describe(`chế độ ${cheDo === 'sang' ? 'sáng' : 'tối'}`, () => {
      for (const nen of CAC_NEN) {
        it(`chữ chính, chữ phụ và chữ nhấn đạt 4,5 trên 1 trên ${nen}`, () => {
          const nenMau = mau(nen, cheDo)
          expect(tuongPhan(mau('--color-text-primary', cheDo), nenMau)).toBeGreaterThanOrEqual(4.5)
          expect(tuongPhan(mau('--color-text-secondary', cheDo), nenMau)).toBeGreaterThanOrEqual(4.5)
          expect(tuongPhan(mau('--color-text-accent', cheDo), nenMau)).toBeGreaterThanOrEqual(4.5)
        })

        it(`viền focus, biểu tượng và viền ô nhập đạt 3 trên 1 trên ${nen}`, () => {
          const nenMau = mau(nen, cheDo)
          // Viền focus mặc định của Astryx là chính màu chính (`--focus-outline-color` = `--color-accent`);
          // theme không đặt riêng, nên viền focus bằng đúng màu chính.
          expect(sdvico.tokens['--focus-outline-color']).toBeUndefined()
          expect(tuongPhan(mau('--color-accent', cheDo), nenMau)).toBeGreaterThanOrEqual(3)
          expect(tuongPhan(mau('--color-icon-primary', cheDo), nenMau)).toBeGreaterThanOrEqual(3)
          expect(tuongPhan(mau('--color-icon-secondary', cheDo), nenMau)).toBeGreaterThanOrEqual(3)
          expect(tuongPhan(mau('--color-icon-accent', cheDo), nenMau)).toBeGreaterThanOrEqual(3)
          expect(tuongPhan(mauVienONhap(cheDo), nenMau)).toBeGreaterThanOrEqual(3)
        })
      }

      it('chữ trên nút chính đạt 4,5 trên 1 so với màu nút chính', () => {
        expect(tuongPhan(mau('--color-on-accent', cheDo), mau('--color-accent', cheDo))).toBeGreaterThanOrEqual(4.5)
      })

      it('màu trạng thái dùng làm chữ cũng đạt 4,5 trên 1 trên nền trang và mặt phẳng', () => {
        for (const nen of ['--color-background-body', '--color-background-surface'] as const) {
          for (const t of ['--color-text-error', '--color-text-warning', '--color-text-success', '--color-text-info']) {
            expect(tuongPhan(mau(t, cheDo), mau(nen, cheDo))).toBeGreaterThanOrEqual(4.5)
          }
        }
      })

      it('chữ trên các màu trạng thái đặc (lỗi, cảnh báo) đạt 4,5 trên 1', () => {
        expect(tuongPhan(mau('--color-on-error', cheDo), mau('--color-error', cheDo))).toBeGreaterThanOrEqual(4.5)
        expect(tuongPhan(mau('--color-on-warning', cheDo), mau('--color-warning', cheDo))).toBeGreaterThanOrEqual(4.5)
      })
    })
  }

  it('xanh ngọc gốc không được dùng làm chữ hay viền focus trên nền sáng (chỉ ~2,7 trên 1)', () => {
    const goc = docHex('#0FAEBD')
    expect(tuongPhan(goc, mau('--color-background-surface', 'sang'))).toBeLessThan(3)
    expect(lechKenhLonNhat(mau('--color-text-accent', 'sang'), goc)).toBeGreaterThan(SAI_SO_KENH)
    expect(lechKenhLonNhat(mau('--color-accent', 'sang'), goc)).toBeGreaterThan(SAI_SO_KENH)
    expect(lechKenhLonNhat(mau('--color-icon-accent', 'sang'), goc)).toBeGreaterThan(SAI_SO_KENH)
  })
})

describe('theme sdvico: màu chính khác rõ màu trạng thái', () => {
  /** Khoảng cách RGB tối thiểu để không lẫn: cùng mức với chênh lệch giữa hai họ màu khác nhau rõ ràng. */
  const TOI_THIEU = 120

  for (const cheDo of CAC_CHE_DO) {
    it(`chế độ ${cheDo === 'sang' ? 'sáng' : 'tối'}: nút chính khác màu cảnh báo và màu lỗi`, () => {
      const chinh = mau('--color-accent', cheDo)
      expect(khoangCachMau(chinh, mau('--color-warning', cheDo))).toBeGreaterThanOrEqual(TOI_THIEU)
      expect(khoangCachMau(chinh, mau('--color-error', cheDo))).toBeGreaterThanOrEqual(TOI_THIEU)
      // Họ màu cũng khác: sắc độ cách xa cảnh báo (vàng) và lỗi (đỏ) ít nhất 60 độ.
      const sac = sangHsl(chinh).h
      for (const t of ['--color-warning', '--color-error']) {
        const lech = Math.abs(sac - sangHsl(mau(t, cheDo)).h)
        expect(Math.min(lech, 360 - lech)).toBeGreaterThanOrEqual(60)
      }
    })

    it(`chế độ ${cheDo === 'sang' ? 'sáng' : 'tối'}: chữ nhấn khác chữ cảnh báo và chữ lỗi`, () => {
      const nhan = mau('--color-text-accent', cheDo)
      expect(khoangCachMau(nhan, mau('--color-text-warning', cheDo))).toBeGreaterThanOrEqual(TOI_THIEU)
      expect(khoangCachMau(nhan, mau('--color-text-error', cheDo))).toBeGreaterThanOrEqual(TOI_THIEU)
    })
  }
})
