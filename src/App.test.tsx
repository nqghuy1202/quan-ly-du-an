// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { App } from './App'

describe('khung ứng dụng', () => {
  it('hiện tiêu đề tiếng Việt trong theme Astryx', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'Quản lý dự án' })).toBeInTheDocument()
  })
})
