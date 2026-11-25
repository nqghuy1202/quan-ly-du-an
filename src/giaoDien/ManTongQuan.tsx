import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua } from '../kho/ketQua'
import type { Phien } from '../kho/khoDuLieu'
import { docTongQuan, type DongTongQuan, type TongQuan } from '../kho/tongQuan'
import { CAC_TRANG_THAI_TASK, TEN_TRANG_THAI_TASK } from '../luat/task'
import type { VaiHeThong } from '../luat/taiKhoan'
import { nhanTienDo } from '../luat/tienDo'
import { useKho } from './khoContext'
import { ManChiTietDuAn } from './ManChiTietDuAn'
import { MAU_TRANG_THAI_TASK } from './mauTrangThaiTask'

interface Props {
  phien: Phien
  vai: VaiHeThong
  /** Đồng hồ: ngày hôm nay (giờ Việt Nam) cho Trễ hạn, và dấu vết khi sửa Dự án ở màn chi tiết. */
  dongHo: () => Date
  onHetPhien: () => void
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = { id: string; ten: string; dong: DongTongQuan }

function BangDuAn({ ten, dong, onMo }: { ten: string; dong: DongTongQuan[]; onMo: (duAnId: string) => void }) {
  const cot: TableColumn<Dong>[] = [
    {
      key: 'ten',
      header: 'Dự án',
      width: proportional(2),
      renderCell: (d) => <Button label={d.ten} variant="ghost" onClick={() => onMo(d.id)} />,
    },
    {
      key: 'tienDo',
      header: 'Tiến độ',
      width: proportional(1),
      renderCell: (d) => <Text weight="semibold">{nhanTienDo(d.dong.tomTat.tienDo)}</Text>,
    },
    {
      key: 'soTask',
      header: 'Task theo trạng thái',
      width: proportional(3),
      renderCell: (d) => {
        const co = CAC_TRANG_THAI_TASK.filter((t) => d.dong.tomTat.soTaskTheoTrangThai[t] > 0)
        if (co.length === 0) return <Text>Chưa có Task</Text>
        return (
          <HStack gap={1} wrap="wrap">
            {co.map((t) => (
              <Token
                key={t}
                label={`${TEN_TRANG_THAI_TASK[t]} ${d.dong.tomTat.soTaskTheoTrangThai[t]}`}
                color={MAU_TRANG_THAI_TASK[t]}
              />
            ))}
          </HStack>
        )
      },
    },
    {
      key: 'cuaToi',
      header: 'Task chưa chốt của tôi',
      width: proportional(1),
      renderCell: (d) => <Text>{d.dong.tomTat.soTaskChuaChotCuaToi}</Text>,
    },
    {
      key: 'treHan',
      header: 'Cảnh báo',
      width: proportional(1),
      renderCell: (d) =>
        d.dong.tomTat.treHan ? <Token label={`Trễ hạn (${d.dong.tomTat.soTaskTreHan})`} color="red" /> : <Text>Không</Text>,
    },
  ]
  const du: Dong[] = dong.map((d) => ({ id: d.duAn.id, ten: d.duAn.ten, dong: d }))
  return (
    <VStack gap={2} role="group" aria-label={ten}>
      <Heading level={3}>{ten}</Heading>
      <Table aria-label={`Bảng ${ten}`} data={du} columns={cot} idKey="id" />
    </VStack>
  )
}

/**
 * Trang tổng quan: các Dự án người dùng được thấy, mỗi Dự án kèm Tiến độ, số Task theo trạng thái,
 * số Task chưa chốt của riêng mình và cờ Trễ hạn; Dự án Lưu trữ ở nhóm riêng. Có trạng thái trống,
 * đang tải và lỗi. Mở được chi tiết Dự án (nơi liệt kê các Task Trễ hạn).
 */
export function ManTongQuan({ phien, vai, dongHo, onHetPhien }: Props) {
  const kho = useKho()
  const [tai, setTai] = useState<KetQua<TongQuan> | null>(null)
  const [lanTai, setLanTai] = useState(0)
  const [duAnDangMo, setDuAnDangMo] = useState<string | null>(null)

  useEffect(() => {
    if (duAnDangMo !== null) return
    let huy = false
    docTongQuan(kho, phien, dongHo()).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      else setTai(kq)
    })
    return () => {
      huy = true
    }
  }, [kho, phien, dongHo, lanTai, duAnDangMo, onHetPhien])

  function taiLai() {
    setTai(null)
    setLanTai((n) => n + 1)
  }

  if (duAnDangMo !== null) {
    return (
      <ManChiTietDuAn
        key={duAnDangMo}
        phien={phien}
        vai={vai}
        duAnId={duAnDangMo}
        thongBaoBanDau={null}
        dongHo={dongHo}
        onQuayLai={() => {
          // Quay lại thì đọc lại tổng quan: Task có thể đã đổi trạng thái hay hạn.
          setTai(null)
          setDuAnDangMo(null)
        }}
        onHetPhien={onHetPhien}
      />
    )
  }

  let noiDung: ReactNode
  if (tai === null) {
    noiDung = <Spinner label="Đang tải tổng quan…" />
  } else if (!tai.ok) {
    noiDung = (
      <Banner
        status="error"
        title="Không tải được tổng quan."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={taiLai} />}
      />
    )
  } else if (tai.giaTri.hoatDong.length === 0 && tai.giaTri.luuTru.length === 0) {
    noiDung = (
      <EmptyState
        headingLevel={3}
        title="Bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn."
        description="Khi được thêm vào một Dự án, Dự án đó sẽ hiện ở đây cùng Tiến độ."
      />
    )
  } else {
    noiDung = (
      <VStack gap={5}>
        {tai.giaTri.hoatDong.length > 0 && (
          <BangDuAn ten="Dự án đang hoạt động" dong={tai.giaTri.hoatDong} onMo={setDuAnDangMo} />
        )}
        {tai.giaTri.luuTru.length > 0 && <BangDuAn ten="Dự án đã Lưu trữ" dong={tai.giaTri.luuTru} onMo={setDuAnDangMo} />}
      </VStack>
    )
  }

  return (
    <VStack gap={4}>
      <Heading level={2}>Tổng quan</Heading>
      <Text>
        {vai === 'PM'
          ? 'Mọi Dự án: Tiến độ, số Task theo trạng thái và cảnh báo Trễ hạn.'
          : 'Các Dự án bạn đang ở trong: Tiến độ, số Task theo trạng thái, Task chưa chốt của bạn và cảnh báo Trễ hạn.'}
      </Text>
      {noiDung}
    </VStack>
  )
}
