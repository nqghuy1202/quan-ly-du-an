import { useState } from 'react'
import type { Phien } from '../kho/khoDuLieu'
import type { TrangThaiDuAn } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { ManChiTietDuAn } from './ManChiTietDuAn'
import { ManDanhSachDuAn } from './ManDanhSachDuAn'

interface Props {
  phien: Phien
  /** Vai hệ thống của người đang đăng nhập, để ẩn nút ghi theo cùng luật với Kho. */
  vai: VaiHeThong
  /** Đồng hồ cho dấu vết (ngày tạo, ngày chỉnh sửa). */
  dongHo: () => Date
  onHetPhien: () => void
}

type ManCon = { loai: 'danhSach' } | { loai: 'chiTiet'; duAnId: string }

/** Mục "Tất cả Dự án": danh sách (tạo Dự án trong Ngăn trượt) và chi tiết. */
export function ManDuAn({ phien, vai, dongHo, onHetPhien }: Props) {
  const [man, setMan] = useState<ManCon>({ loai: 'danhSach' })
  // Giữ bộ lọc khi đi vào chi tiết rồi quay lại.
  const [boLoc, setBoLoc] = useState<TrangThaiDuAn>('HOAT_DONG')

  if (man.loai === 'chiTiet') {
    return (
      <ManChiTietDuAn
        key={man.duAnId}
        phien={phien}
        vai={vai}
        duAnId={man.duAnId}
        dongHo={dongHo}
        onQuayLai={() => setMan({ loai: 'danhSach' })}
        onHetPhien={onHetPhien}
      />
    )
  }

  return (
    <ManDanhSachDuAn
      phien={phien}
      vai={vai}
      dongHo={dongHo}
      boLoc={boLoc}
      onDoiBoLoc={setBoLoc}
      onMo={(duAnId) => setMan({ loai: 'chiTiet', duAnId })}
      onHetPhien={onHetPhien}
    />
  )
}
