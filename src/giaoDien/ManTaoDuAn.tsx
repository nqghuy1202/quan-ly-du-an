import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { TextArea } from '@astryxdesign/core/TextArea'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import type { LoiKho } from '../kho/ketQua'
import type { DuAn, Phien } from '../kho/khoDuLieu'
import { DO_DAI_TEN_DU_AN_TOI_DA, THONG_BAO_DU_AN, duocTaoDuAn } from '../luat/duAn'
import type { VaiHeThong } from '../luat/taiKhoan'
import { useKho } from './khoContext'
import { trangThaiO } from './trangThaiO'

interface Props {
  phien: Phien
  vai: VaiHeThong
  dongHo: () => Date
  onDaTao: (duAn: DuAn) => void
  onQuayLai: () => void
  onHetPhien: () => void
}

/** Biểu mẫu tạo Dự án: tên bắt buộc, mô tả tuỳ chọn. Chỉ PM. */
export function ManTaoDuAn({ phien, vai, dongHo, onDaTao, onQuayLai, onHetPhien }: Props) {
  const kho = useKho()
  const [ten, setTen] = useState('')
  const [moTa, setMoTa] = useState('')
  const [loi, setLoi] = useState<LoiKho | null>(null)
  const [dangGui, setDangGui] = useState(false)
  const duocTao = duocTaoDuAn(vai)

  async function tao() {
    if (dangGui || !duocTao) return
    setDangGui(true)
    setLoi(null)
    const kq = await kho.taoDuAn(phien, { ten, moTa }, dongHo())
    setDangGui(false)
    if (kq.ok) onDaTao(kq.giaTri)
    else if (kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
    else setLoi(kq.loi)
  }

  return (
    <VStack gap={4}>
      <HStack gap={2}>
        <Button label="Về danh sách Dự án" variant="ghost" onClick={onQuayLai} />
      </HStack>
      <Heading level={2}>Tạo Dự án</Heading>
      {!duocTao ? (
        <Banner status="info" title={THONG_BAO_DU_AN.chiPMSua} role="status" />
      ) : (
        <>
          {loi && <Banner status="error" title="Chưa tạo được Dự án." description={loi.thongBao} role="alert" />}
          <FormLayout>
            <TextInput
              label="Tên Dự án"
              description={`Bắt buộc, tối đa ${DO_DAI_TEN_DU_AN_TOI_DA} ký tự.`}
              autoComplete="off"
              value={ten}
              onChange={setTen}
              onEnter={tao}
              status={trangThaiO(loi, 'ten')}
            />
            <TextArea
              label="Mô tả"
              description="Tuỳ chọn."
              value={moTa}
              onChange={setMoTa}
              status={trangThaiO(loi, 'moTa')}
            />
          </FormLayout>
          <HStack gap={2}>
            <Button label="Tạo Dự án" variant="primary" isLoading={dangGui} onClick={tao} />
          </HStack>
        </>
      )}
    </VStack>
  )
}
