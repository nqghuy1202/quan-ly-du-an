import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { thanhCong, type KetQua, type LoiKho, type MaLoi } from '../kho/ketQua'
import type { Phien, RepoDuAn } from '../kho/khoDuLieu'
import { xepRepo } from '../luat/github'
import { useBoGiuDuLieu, useGiuKetQua } from './boGiuDuLieu'
import { useKho } from './khoContext'
import { trangThaiO } from './trangThaiO'

interface Props {
  phien: Phien
  duAnId: string
  /** Lý do không gắn, gỡ được (cùng luật với Kho); null nếu được. */
  lyDoKhongGhi: string | null
  /** Kho từ chối vì Dự án hay quyền đã đổi ở nơi khác: đọc lại để nút và lý do khớp với Kho. */
  onCanDocLai: () => void
  onHetPhien: () => void
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = { tenRepo: string }

type ThongBao = { loai: 'thanhCong'; noiDung: string } | { loai: 'loi'; tieuDe: string; loi: LoiKho }

/** Lỗi cho thấy Dự án hay quyền của người dùng đã đổi ở nơi khác. */
const LOI_CAN_DOC_LAI: readonly MaLoi[] = ['DU_AN_DA_LUU_TRU', 'KHONG_CO_QUYEN', 'KHONG_TIM_THAY']

/** Phần "Repo GitHub" của màn chi tiết Dự án: xem, gắn và gỡ repo (chỉ ghi tên, không gọi GitHub). */
export function PhanRepoGitHub({ phien, duAnId, lyDoKhongGhi, onCanDocLai, onHetPhien }: Props) {
  const kho = useKho()
  const boGiu = useBoGiuDuLieu()
  const khoaGiu = `repoCuaDuAn:${duAnId}`
  const [lanTai, setLanTai] = useState(0)
  // Tab chỉ được vẽ khi đang chọn: quay lại tab đã xem thì hiện ngay danh sách lần trước, rồi đọc lại ngầm.
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<RepoDuAn[]> } | null>(() => {
    const daGiu = boGiu.lay<RepoDuAn[]>(khoaGiu)
    return daGiu ? { lan: 0, kq: thanhCong(daGiu) } : null
  })
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  useGiuKetQua(khoaGiu, tai)
  const [repo, setRepo] = useState('')
  const [dangGan, setDangGan] = useState(false)
  const [dangGoRepo, setDangGoRepo] = useState<string | null>(null)
  // Chặn lệnh trùng (bấm hai lần trước khi kịp vẽ lại) bằng ref chứ không bằng state.
  const dangGuiRef = useRef(false)
  const [thongBao, setThongBao] = useState<ThongBao | null>(null)
  const duocGhi = lyDoKhongGhi === null

  useEffect(() => {
    let huy = false
    kho.danhSachRepoCuaDuAn(phien, duAnId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') onHetPhien()
      // Đọc lại ngầm (đang hiện danh sách của lần tải này) mà lỗi thì giữ danh sách đang hiện.
      else setDaTai((cu) => (!kq.ok && cu?.lan === lanTai && cu.kq.ok ? cu : { lan: lanTai, kq }))
    })
    return () => {
      huy = true
    }
  }, [kho, phien, duAnId, lanTai, onHetPhien])

  function doiDanhSach(capNhat: (cu: RepoDuAn[]) => RepoDuAn[]) {
    setDaTai((cu) => (cu && cu.kq.ok ? { lan: cu.lan, kq: { ok: true, giaTri: capNhat(cu.kq.giaTri) } } : cu))
  }

  function xuLyLoi(tieuDe: string, loi: LoiKho) {
    if (loi.ma === 'CHUA_DANG_NHAP') {
      onHetPhien()
      return
    }
    setThongBao({ loai: 'loi', tieuDe, loi })
    if (LOI_CAN_DOC_LAI.includes(loi.ma)) onCanDocLai()
  }

  async function gan() {
    if (dangGuiRef.current || !duocGhi) return
    dangGuiRef.current = true
    setDangGan(true)
    setThongBao(null)
    const kq = await kho.ganRepoVaoDuAn(phien, duAnId, { repo })
    dangGuiRef.current = false
    setDangGan(false)
    if (kq.ok) {
      const moi = kq.giaTri
      doiDanhSach((cu) => [...cu, moi])
      setRepo('')
      setThongBao({ loai: 'thanhCong', noiDung: `Đã gắn repo ${moi.tenRepo} vào Dự án.` })
    } else {
      xuLyLoi('Chưa gắn được repo vào Dự án.', kq.loi)
    }
  }

  async function go(dong: Dong) {
    if (dangGuiRef.current || !duocGhi) return
    dangGuiRef.current = true
    setDangGoRepo(dong.tenRepo)
    setThongBao(null)
    const kq = await kho.goRepoKhoiDuAn(phien, duAnId, dong.tenRepo)
    dangGuiRef.current = false
    setDangGoRepo(null)
    if (kq.ok) {
      doiDanhSach((cu) => cu.filter((r) => r.tenRepo !== dong.tenRepo))
      setThongBao({ loai: 'thanhCong', noiDung: `Đã gỡ repo ${dong.tenRepo} khỏi Dự án.` })
    } else {
      xuLyLoi(`Không gỡ được repo ${dong.tenRepo} khỏi Dự án.`, kq.loi)
    }
  }

  const cot: TableColumn<Dong>[] = [
    {
      key: 'tenRepo',
      header: 'Repo',
      width: proportional(3),
      renderCell: (dong) => <Text weight="semibold">{dong.tenRepo}</Text>,
    },
  ]
  if (duocGhi) {
    cot.push({
      key: 'thaoTac',
      header: 'Thao tác',
      width: proportional(1),
      renderCell: (dong) => (
        <Button
          label={`Gỡ ${dong.tenRepo}`}
          variant="secondary"
          size="sm"
          isLoading={dangGoRepo === dong.tenRepo}
          onClick={() => go(dong)}
        />
      ),
    })
  }

  let danhSach: ReactNode
  if (tai === null) {
    danhSach = <Spinner label="Đang tải repo GitHub…" />
  } else if (!tai.ok) {
    danhSach = (
      <Banner
        status="error"
        title="Không tải được repo GitHub của Dự án."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
      />
    )
  } else if (tai.giaTri.length === 0) {
    danhSach = (
      <EmptyState
        headingLevel={4}
        title="Dự án chưa gắn repo GitHub nào."
        description={
          duocGhi
            ? 'Gắn repo bằng tên dạng chu-so-huu/ten-repo để Task trỏ được tới issue và PR của repo đó.'
            : 'Khi PM hoặc Support của Dự án gắn repo, repo sẽ hiện ở đây.'
        }
      />
    )
  } else {
    const dong: Dong[] = xepRepo(tai.giaTri.map((r) => r.tenRepo)).map((tenRepo) => ({ tenRepo }))
    danhSach = <Table aria-label="Danh sách repo GitHub" data={dong} columns={cot} idKey="tenRepo" />
  }

  const loiO = thongBao?.loai === 'loi' ? thongBao.loi : null

  return (
    <VStack gap={3} role="group" aria-label="Repo GitHub">
      <Heading level={3}>Repo GitHub</Heading>
      <Text>Chỉ đọc: hệ thống không bao giờ ghi gì lên GitHub.</Text>
      {thongBao?.loai === 'thanhCong' && <Banner status="success" title={thongBao.noiDung} role="status" />}
      {thongBao?.loai === 'loi' && (
        <Banner status="error" title={thongBao.tieuDe} description={thongBao.loi.thongBao} role="alert" />
      )}
      <FormLayout>
        <TextInput
          label="Repo cần gắn"
          description="Tên dạng chu-so-huu/ten-repo, ví dụ vercel/next.js. Không phân biệt chữ hoa chữ thường."
          autoComplete="off"
          value={repo}
          onChange={setRepo}
          onEnter={duocGhi ? gan : undefined}
          isDisabled={!duocGhi}
          disabledMessage={lyDoKhongGhi ?? undefined}
          status={trangThaiO(loiO, 'repo')}
        />
      </FormLayout>
      {duocGhi ? (
        <HStack gap={2}>
          <Button label="Gắn repo" variant="primary" isLoading={dangGan} onClick={gan} />
        </HStack>
      ) : (
        <Text>{lyDoKhongGhi}</Text>
      )}
      {danhSach}
    </VStack>
  )
}
