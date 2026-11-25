import { useState } from 'react'
import type { Phien } from '../kho/khoDuLieu'
import type { TrangThaiDuAn } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { ManChiTietDuAn } from './ManChiTietDuAn'
import { ManDanhSachDuAn } from './ManDanhSachDuAn'
import { ManTaoDuAn } from './ManTaoDuAn'

interface Props {
  phien: Phien
  /** Vai hệ thống của người đang đăng nhập, để ẩn nút ghi theo cùng luật với Kho. */
  vai: VaiHeThong
  /** Đồng hồ cho dấu vết (ngày tạo, ngày chỉnh sửa). */
  dongHo: () => Date
  onHetPhien: () => void
}

type ManCon = { loai: 'danhSach' } | { loai: 'tao' } | { loai: 'chiTiet'; duAnId: string; thongBao: string | null }

/** Mục "Tất cả Dự án": danh sách, tạo và chi tiết kèm sửa. */
export function ManDuAn({ phien, vai, dongHo, onHetPhien }: Props) {
  const [man, setMan] = useState<ManCon>({ loai: 'danhSach' })
  // Giữ bộ lọc khi đi vào chi tiết rồi quay lại.
  const [boLoc, setBoLoc] = useState<TrangThaiDuAn>('HOAT_DONG')
  const veDanhSach = () => setMan({ loai: 'danhSach' })

  if (man.loai === 'tao') {
    return (
      <ManTaoDuAn
        phien={phien}
        vai={vai}
        dongHo={dongHo}
        onDaTao={(duAn) => {
          setBoLoc('HOAT_DONG')
          setMan({ loai: 'chiTiet', duAnId: duAn.id, thongBao: `Đã tạo Dự án ${duAn.ten}.` })
        }}
        onQuayLai={veDanhSach}
        onHetPhien={onHetPhien}
      />
    )
  }

  if (man.loai === 'chiTiet') {
    return (
      <ManChiTietDuAn
        key={man.duAnId}
        phien={phien}
        vai={vai}
        duAnId={man.duAnId}
        thongBaoBanDau={man.thongBao}
        dongHo={dongHo}
        onQuayLai={veDanhSach}
        onHetPhien={onHetPhien}
      />
    )
  }

  return (
    <ManDanhSachDuAn
      phien={phien}
      vai={vai}
      boLoc={boLoc}
      onDoiBoLoc={setBoLoc}
      onTao={() => setMan({ loai: 'tao' })}
      onMo={(duAnId) => setMan({ loai: 'chiTiet', duAnId, thongBao: null })}
      onHetPhien={onHetPhien}
    />
  )
}
