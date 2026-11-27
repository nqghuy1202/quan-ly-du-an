import { useEffect, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Heading } from '@astryxdesign/core/Heading'
import { List, ListItem } from '@astryxdesign/core/List'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { DongLichSuTask, Phien } from '../kho/khoDuLieu'
import { tomTatDongLichSu, xepLichSuTask } from '../luat/chuyenTrangThai'
import { dinhDangNgayGio } from '../luat/duAn'
import { useKho } from './khoContext'

interface Props {
  phien: Phien
  taskId: string
  /** Đổi giá trị này để đọc lại lịch sử (vd. sau khi vừa đổi trạng thái). */
  lanDoc: number
  onHetPhien: () => void
}

/**
 * Lịch sử của Task theo thứ tự thời gian tăng dần, gồm các lần đổi trạng thái (kèm lý do nếu có) và đổi
 * Mức ưu tiên trên cùng một dòng thời gian: ai đổi, lúc nào, từ đâu sang đâu.
 */
export function PhanLichSuTask({ phien, taskId, lanDoc, onHetPhien }: Props) {
  const kho = useKho()
  const [lanThuLai, setLanThuLai] = useState(0)
  const lan = `${lanDoc}-${lanThuLai}`
  const [daTai, setDaTai] = useState<{ lan: string; kq: KetQua<DongLichSuTask[]> } | null>(null)
  const tai = daTai && daTai.lan === lan ? daTai.kq : null

  useEffect(() => {
    let huy = false
    kho.lichSuTask(phien, taskId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setDaTai({ lan, kq })
    })
    return () => {
      huy = true
    }
  }, [kho, phien, taskId, lan, onHetPhien])

  let noiDung
  if (tai === null) {
    noiDung = daTai === null ? <Spinner label="Đang tải lịch sử…" /> : <Spinner label="Đang cập nhật lịch sử…" />
  } else if (!tai.ok) {
    noiDung = (
      <Banner
        status="error"
        title="Không tải được lịch sử Task."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanThuLai((n) => n + 1)} />}
      />
    )
  } else if (tai.giaTri.length === 0) {
    noiDung = <Text>Chưa có lần đổi trạng thái hay Mức ưu tiên nào.</Text>
  } else {
    noiDung = (
      <List hasDividers>
        {xepLichSuTask(tai.giaTri).map((dong, i) => (
          <ListItem
            key={`${dong.luc.getTime()}-${i}`}
            label={tomTatDongLichSu(dong)}
            description={
              <VStack gap={0.5}>
                <Text type="supporting">{`${dong.nguoiDoi.tenHienThi}, ${dinhDangNgayGio(dong.luc)}`}</Text>
                {dong.loai === 'TRANG_THAI' && dong.lyDo !== null && (
                  <Text type="supporting">{`Lý do: ${dong.lyDo}`}</Text>
                )}
              </VStack>
            }
          />
        ))}
      </List>
    )
  }

  return (
    <VStack gap={2} role="group" aria-label="Lịch sử Task">
      <Heading level={3}>Lịch sử Task</Heading>
      {noiDung}
    </VStack>
  )
}
