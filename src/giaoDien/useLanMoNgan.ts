import { useState } from 'react'

/**
 * Số lần một Ngăn trượt đã được mở (0 khi chưa mở lần nào). Ngăn chứa biểu mẫu dùng số này làm
 * `key` để mỗi lần mở là một biểu mẫu mới (ô trống, đọc lại dữ liệu cần chọn), còn lúc đóng thì vẫn
 * là biểu mẫu cũ để nội dung ở nguyên trong lúc ngăn trượt ra.
 */
export function useLanMoNgan(isOpen: boolean): number {
  const [daThay, setDaThay] = useState({ dangMo: isOpen, lan: isOpen ? 1 : 0 })
  if (daThay.dangMo !== isOpen) {
    // Trạng thái suy ra từ prop: React vẽ lại ngay, không qua một lần vẽ thừa.
    const lan = isOpen ? daThay.lan + 1 : daThay.lan
    setDaThay({ dangMo: isOpen, lan })
    return lan
  }
  return daThay.lan
}
