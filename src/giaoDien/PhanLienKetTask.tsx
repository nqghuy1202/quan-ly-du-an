import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Link } from '@astryxdesign/core/Link'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { KetQua, LoiKho } from '../kho/ketQua'
import type { LienKetTask, Phien } from '../kho/khoDuLieu'
import {
  khoaLienKet,
  tenLienKet,
  tenTrangThaiGitHub,
  thatBaiGitHub,
  type KetQuaGitHub,
  type TrangThaiLienKet,
} from '../luat/github'
import { useCongGitHub } from './congGitHubContext'
import { useKho } from './khoContext'
import { trangThaiO } from './trangThaiO'

interface Props {
  phien: Phien
  taskId: string
  /** Lý do không thêm, gỡ được (cùng luật với Kho); null nếu được. */
  lyDoKhongGhi: string | null
  dongHo: () => Date
  /** Đã thêm hoặc gỡ link: Task có dấu vết chỉnh sửa mới, màn Task đọc lại. */
  onDaDoi: () => void
  onHetPhien: () => void
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = { [K in keyof LienKetTask]: LienKetTask[K] }

/** Trạng thái đọc GitHub của một link: đang đọc, hoặc kết quả của Cổng GitHub (kể cả lỗi có mã). */
type DocGitHub = { loai: 'dangTai' } | { loai: 'xong'; kq: KetQuaGitHub<TrangThaiLienKet> }

type ThongBao = { loai: 'thanhCong'; noiDung: string } | { loai: 'loi'; tieuDe: string; loi: LoiKho }

/** Màu Token (Astryx) của trạng thái GitHub; màu đi qua theme, không đặt hex. */
function mauTrangThaiGitHub({ loai, trangThai }: TrangThaiLienKet): 'green' | 'purple' | 'gray' | 'red' {
  if (trangThai === 'MO') return 'green'
  if (trangThai === 'DA_MERGE') return 'purple'
  return loai === 'PR' ? 'red' : 'gray'
}

function TrangThaiMotLink({ doc }: { doc: DocGitHub | undefined }) {
  if (doc === undefined || doc.loai === 'dangTai') {
    return (
      <HStack gap={2} vAlign="center">
        <Spinner size="sm" aria-label="Đang đọc GitHub" />
        <Text>Đang đọc GitHub…</Text>
      </HStack>
    )
  }
  if (doc.kq.ok) {
    return <Token label={tenTrangThaiGitHub(doc.kq.giaTri)} color={mauTrangThaiGitHub(doc.kq.giaTri)} />
  }
  return (
    <VStack gap={1}>
      <Token label="Không đọc được trạng thái" color="orange" />
      <Text role="status">{doc.kq.loi.thongBao}</Text>
    </VStack>
  )
}

/**
 * Phần "Link GitHub" của chi tiết Task: dán và gỡ link issue hoặc PR, và hiện trạng thái hiện tại
 * của từng link đọc qua Cổng GitHub (chỉ đọc). Trạng thái được đọc mỗi lần mở Task và khi bấm làm
 * mới; Task không có link thì không đọc GitHub. Lỗi GitHub chỉ hiện cạnh link đó.
 */
export function PhanLienKetTask({ phien, taskId, lyDoKhongGhi, dongHo, onDaDoi, onHetPhien }: Props) {
  const kho = useKho()
  const cong = useCongGitHub()
  const [lanTai, setLanTai] = useState(0)
  const [daTai, setDaTai] = useState<{ lan: number; kq: KetQua<LienKetTask[]> } | null>(null)
  const tai = daTai && daTai.lan === lanTai ? daTai.kq : null
  const [docTheoKhoa, setDocTheoKhoa] = useState<Record<string, DocGitHub>>({})
  const [duongDan, setDuongDan] = useState('')
  const [dangThem, setDangThem] = useState(false)
  const [dangGoKhoa, setDangGoKhoa] = useState<string | null>(null)
  // Chặn lệnh trùng (bấm hai lần trước khi kịp vẽ lại) bằng ref chứ không bằng state.
  const dangGuiRef = useRef(false)
  const conMoRef = useRef(true)
  /** Lượt đọc mới nhất của từng link: kết quả của lượt cũ bị bỏ khi đã có lượt mới hơn. */
  const luotDocRef = useRef<Record<string, number>>({})
  const [thongBao, setThongBao] = useState<ThongBao | null>(null)
  const duocGhi = lyDoKhongGhi === null

  useEffect(() => {
    conMoRef.current = true
    return () => {
      conMoRef.current = false
    }
  }, [])

  /** Đọc trạng thái các link qua Cổng GitHub (chỉ thao tác đọc); mỗi link có kết quả riêng. */
  const docGitHub = useCallback(
    (cacLienKet: LienKetTask[]) => {
      if (cacLienKet.length === 0) return
      const luot = cacLienKet.map((l) => {
        const khoa = khoaLienKet(l)
        luotDocRef.current[khoa] = (luotDocRef.current[khoa] ?? 0) + 1
        return luotDocRef.current[khoa]
      })
      setDocTheoKhoa((cu) => {
        const moi = { ...cu }
        for (const l of cacLienKet) moi[khoaLienKet(l)] = { loai: 'dangTai' }
        return moi
      })
      cong
        .docNhieuTrangThai(cacLienKet.map(({ repo, loai, so }) => ({ repo, loai, so })))
        .catch((): KetQuaGitHub<TrangThaiLienKet>[] => cacLienKet.map(() => thatBaiGitHub('MAT_MANG')))
        .then((ketQua) => {
          if (!conMoRef.current) return
          setDocTheoKhoa((cu) => {
            const moi = { ...cu }
            cacLienKet.forEach((l, i) => {
              const khoa = khoaLienKet(l)
              if (luotDocRef.current[khoa] !== luot[i]) return
              moi[khoa] = { loai: 'xong', kq: ketQua[i] ?? thatBaiGitHub('DU_LIEU_LA') }
            })
            return moi
          })
        })
    },
    [cong],
  )

  useEffect(() => {
    let huy = false
    kho.danhSachLienKetCuaTask(phien, taskId).then((kq) => {
      if (huy) return
      if (!kq.ok && kq.loi.ma === 'CHUA_DANG_NHAP') {
        onHetPhien()
        return
      }
      setDaTai({ lan: lanTai, kq })
      // Mỗi lần mở Task (và mỗi lần thử lại) đọc lại trạng thái, chưa có bộ nhớ đệm.
      if (kq.ok) docGitHub(kq.giaTri)
    })
    return () => {
      huy = true
    }
  }, [kho, phien, taskId, lanTai, onHetPhien, docGitHub])

  function doiDanhSach(capNhat: (cu: LienKetTask[]) => LienKetTask[]) {
    setDaTai((cu) => (cu && cu.kq.ok ? { lan: cu.lan, kq: { ok: true, giaTri: capNhat(cu.kq.giaTri) } } : cu))
  }

  function xuLyLoi(tieuDe: string, loi: LoiKho) {
    if (loi.ma === 'CHUA_DANG_NHAP') {
      onHetPhien()
      return
    }
    setThongBao({ loai: 'loi', tieuDe, loi })
  }

  async function them() {
    if (dangGuiRef.current || !duocGhi) return
    dangGuiRef.current = true
    setDangThem(true)
    setThongBao(null)
    const kq = await kho.themLienKetVaoTask(phien, taskId, { duongDan }, dongHo())
    dangGuiRef.current = false
    setDangThem(false)
    if (kq.ok) {
      const moi = kq.giaTri
      doiDanhSach((cu) => [...cu, moi])
      setDuongDan('')
      setThongBao({ loai: 'thanhCong', noiDung: `Đã thêm link ${tenLienKet(moi)} vào Task.` })
      docGitHub([moi])
      onDaDoi()
    } else {
      xuLyLoi('Chưa thêm được link vào Task.', kq.loi)
    }
  }

  async function go(lienKet: LienKetTask) {
    if (dangGuiRef.current || !duocGhi) return
    dangGuiRef.current = true
    const khoa = khoaLienKet(lienKet)
    setDangGoKhoa(khoa)
    setThongBao(null)
    const kq = await kho.goLienKetKhoiTask(
      phien,
      taskId,
      { repo: lienKet.repo, loai: lienKet.loai, so: lienKet.so },
      dongHo(),
    )
    dangGuiRef.current = false
    setDangGoKhoa(null)
    if (kq.ok) {
      doiDanhSach((cu) => cu.filter((l) => khoaLienKet(l) !== khoa))
      setThongBao({ loai: 'thanhCong', noiDung: `Đã gỡ link ${tenLienKet(lienKet)} khỏi Task.` })
      onDaDoi()
    } else {
      xuLyLoi(`Không gỡ được link ${tenLienKet(lienKet)} khỏi Task.`, kq.loi)
    }
  }

  const cot: TableColumn<Dong>[] = [
    {
      key: 'lienKet',
      header: 'Link',
      width: proportional(2),
      renderCell: (lienKet) => (
        <Link href={lienKet.duongDan} isExternalLink label={tenLienKet(lienKet)}>
          {tenLienKet(lienKet)}
        </Link>
      ),
    },
    {
      key: 'trangThai',
      header: 'Trạng thái trên GitHub',
      width: proportional(3),
      renderCell: (lienKet) => <TrangThaiMotLink doc={docTheoKhoa[khoaLienKet(lienKet)]} />,
    },
  ]
  if (duocGhi) {
    cot.push({
      key: 'thaoTac',
      header: 'Thao tác',
      width: proportional(1),
      renderCell: (lienKet) => (
        <Button
          label={`Gỡ ${tenLienKet(lienKet)}`}
          variant="secondary"
          size="sm"
          isLoading={dangGoKhoa === khoaLienKet(lienKet)}
          onClick={() => go(lienKet)}
        />
      ),
    })
  }

  let danhSach: ReactNode
  let nutLamMoi: ReactNode = null
  if (tai === null) {
    danhSach = <Spinner label="Đang tải link GitHub…" />
  } else if (!tai.ok) {
    danhSach = (
      <Banner
        status="error"
        title="Không tải được link GitHub của Task."
        description={tai.loi.thongBao}
        role="alert"
        endContent={<Button label="Thử lại" variant="secondary" onClick={() => setLanTai((n) => n + 1)} />}
      />
    )
  } else if (tai.giaTri.length === 0) {
    danhSach = (
      <EmptyState
        headingLevel={4}
        title="Task chưa có link issue hoặc PR nào."
        description={
          duocGhi
            ? 'Dán link issue hoặc PR của repo đã gắn vào Dự án để thấy trạng thái ngay trên Task.'
            : 'Khi có người dán link issue hoặc PR, link và trạng thái sẽ hiện ở đây.'
        }
      />
    )
  } else {
    const dangDoc = tai.giaTri.some((l) => {
      const doc = docTheoKhoa[khoaLienKet(l)]
      return doc === undefined || doc.loai === 'dangTai'
    })
    nutLamMoi = (
      <HStack gap={2}>
        <Button
          label="Làm mới trạng thái GitHub"
          variant="secondary"
          isLoading={dangDoc}
          onClick={() => tai.ok && docGitHub(tai.giaTri)}
        />
      </HStack>
    )
    danhSach = <Table aria-label="Link GitHub của Task" data={tai.giaTri} columns={cot} idKey="duongDan" />
  }

  const loiO = thongBao?.loai === 'loi' ? thongBao.loi : null

  return (
    <VStack gap={3} role="group" aria-label="Link GitHub">
      <Heading level={3}>Link GitHub</Heading>
      <Text>Chỉ đọc: hệ thống không bao giờ ghi gì lên GitHub.</Text>
      {thongBao?.loai === 'thanhCong' && <Banner status="success" title={thongBao.noiDung} role="status" />}
      {thongBao?.loai === 'loi' && (
        <Banner status="error" title={thongBao.tieuDe} description={thongBao.loi.thongBao} role="alert" />
      )}
      <FormLayout>
        <TextInput
          label="Link issue hoặc PR"
          description="Ví dụ https://github.com/chu-so-huu/ten-repo/issues/12 hoặc .../pull/34. Repo phải đã gắn vào Dự án."
          autoComplete="off"
          value={duongDan}
          onChange={setDuongDan}
          onEnter={duocGhi ? them : undefined}
          isDisabled={!duocGhi}
          disabledMessage={lyDoKhongGhi ?? undefined}
          status={trangThaiO(loiO, 'duongDan')}
        />
      </FormLayout>
      {duocGhi ? (
        <HStack gap={2}>
          <Button label="Thêm link" variant="primary" isLoading={dangThem} onClick={them} />
        </HStack>
      ) : (
        <Text>{lyDoKhongGhi}</Text>
      )}
      {nutLamMoi}
      {danhSach}
    </VStack>
  )
}
