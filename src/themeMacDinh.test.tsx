// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { Theme } from '@astryxdesign/core/theme'
import { App } from './App'
import { defaultThemeSlug, themes } from './astryx-themes'
import { ManLoiCauHinh } from './giaoDien/ManLoiCauHinh'

function goiTheme(container: HTMLElement) {
  const goc = container.querySelector('[data-astryx-theme]')
  if (!goc) throw new Error('Không thấy vùng theme trong màn đã dựng')
  return { theme: goc.getAttribute('data-astryx-theme'), cheDo: goc.getAttribute('data-theme') }
}

describe('theme mặc định của ứng dụng', () => {
  it('theme mặc định đã nạp là sdvico', () => {
    expect(defaultThemeSlug).toBe('sdvico')
    expect(Object.keys(themes)).toContain('sdvico')
  })

  it('hiển thị ứng dụng không truyền tuỳ chọn nào thì dùng theme sdvico ở chế độ sáng', () => {
    const { container } = render(<App />)
    expect(goiTheme(container)).toEqual({ theme: 'sdvico', cheDo: 'light' })
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
  })

  it('màn lỗi cấu hình cũng dùng sdvico ở chế độ sáng', () => {
    const { container } = render(<ManLoiCauHinh thongBao="Cấu hình sai" />)
    expect(goiTheme(container)).toEqual({ theme: 'sdvico', cheDo: 'light' })
  })
})

describe('chế độ tối của theme sdvico', () => {
  it('chuyển sang chế độ tối vẫn là theme sdvico, không rơi về theme trung tính', () => {
    const { container } = render(
      <Theme theme={themes.sdvico} mode="dark">
        <p>nội dung</p>
      </Theme>,
    )
    expect(goiTheme(container)).toEqual({ theme: 'sdvico', cheDo: 'dark' })
  })

  it('bảng màu tối nằm trong theme đã dựng của sdvico (nền navy rất đậm, nhấn xanh ngọc)', () => {
    // Mỗi token màu là `light-dark(sáng, tối)`: màu tối của sdvico có mặt cùng màu sáng.
    const tokens = (themes.sdvico as unknown as { tokens: Record<string, string> }).tokens
    expect(tokens['--color-accent']).toMatch(/^light-dark\(#0b3865,\s*#13DAEC\)$/i)
    expect(tokens['--color-background-body']).toMatch(/^light-dark\(#F5F7F9,\s*#080F17\)$/i)
  })
})
