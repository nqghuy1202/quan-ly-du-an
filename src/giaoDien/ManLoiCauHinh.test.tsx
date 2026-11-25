// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { ManLoiCauHinh } from './ManLoiCauHinh'
import { docCauHinhKho } from '../kho/cauHinh'

describe('màn lỗi cấu hình', () => {
  it('cấu hình có khoá service thì hiện lý do từ chối bằng tiếng Việt, không vào ứng dụng', () => {
    const cauHinh = docCauHinhKho({ VITE_SUPABASE_URL: 'https://du-an-gia.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_secret_khoa-gia' })
    if (cauHinh.loai !== 'LOI') throw new Error(`Mong đợi lỗi cấu hình, nhận ${cauHinh.loai}`)

    const { container } = render(<ManLoiCauHinh thongBao={cauHinh.thongBao} />)
    expect(screen.getByRole('heading', { level: 1, name: 'Cấu hình chưa đúng' })).toBeInTheDocument()
    expect(within(container).getByRole('alert')).toHaveTextContent(/khoá có vai service/)
    expect(screen.queryByRole('button', { name: 'Đăng nhập' })).not.toBeInTheDocument()
  })
})
