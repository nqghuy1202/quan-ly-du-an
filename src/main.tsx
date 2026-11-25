import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './globals.css'
import { App } from './App'
import { chonKho } from './kho/chonKho'
import { ManLoiCauHinh } from './giaoDien/ManLoiCauHinh'

const root = document.getElementById('root')
if (!root) throw new Error('Không thấy phần tử #root trong index.html')

// Chọn bản cài Kho theo biến môi trường: có VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY thì dùng
// Supabase, không có thì dùng bản bộ nhớ (chỉ để chạy thử). Chỉ biến VITE_* xuống trình duyệt.
const khoDaChon = chonKho(import.meta.env, { duongDanQuayLai: window.location.origin })

createRoot(root).render(
  <StrictMode>
    {khoDaChon.loai === 'LOI' ? (
      <ManLoiCauHinh thongBao={khoDaChon.thongBao} />
    ) : (
      <App kho={khoDaChon.kho} moPhong={khoDaChon.moPhong} />
    )}
  </StrictMode>,
)
