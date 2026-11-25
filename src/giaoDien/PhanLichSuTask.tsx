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
import { xepLichSuTask } from '../luat/chuyenTrangThai'
import { dinhDangNgayGio } from '../luat/duAn'
import { TEN_TRANG_THAI_TASK } from '../luat/task'
import { useKho } from './khoContext'

interface Props {
  phien: Phien
  taskId: string
  /** Đổi giá trị này để đọc lại lịch sử (vd. sau khi vừa đổi trạng thái). */
  lanDoc: number
  onHetPhien: () => void
}

/** Lịch sử trạng thái của Task theo thứ tự thời gian tăng dần: ai đổi, lúc nào, từ đâu sang đâu, lý do. */
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
        title="Không tải được lịch sử trạng thái."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanThuLai((n) => n + 1)} />}
      />
    )
  } else if (tai.giaTri.length === 0) {
    noiDung = <Text>Chưa có lần đổi trạng thái nào.</Text>
  } else {
    noiDung = (
      <List hasDividers>
        {xepLichSuTask(tai.giaTri).map((dong, i) => (
          <ListItem
            key={`${dong.luc.getTime()}-${i}`}
            label={`${TEN_TRANG_THAI_TASK[dong.tu]} sang ${TEN_TRANG_THAI_TASK[dong.sang]}`}
            description={
              <VStack gap={0.5}>
                <Text type="supporting">{`${dong.nguoiDoi.tenHienThi}, ${dinhDangNgayGio(dong.luc)}`}</Text>
                {dong.lyDo !== null && <Text type="supporting">{`Lý do: ${dong.lyDo}`}</Text>}
              </VStack>
            }
          />
        ))}
      </List>
    )
  }

  return (
    <VStack gap={2} role="group" aria-label="Lịch sử trạng thái">
      <Heading level={3}>Lịch sử trạng thái</Heading>
      {noiDung}
    </VStack>
  )
}
