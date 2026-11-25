import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Badge } from '@astryxdesign/core/Badge'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { MoreMenu } from '@astryxdesign/core/MoreMenu'
import { Selector } from '@astryxdesign/core/Selector'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { Task } from '../kho/khoDuLieu'
import {
  CAC_COT_KANBAN,
  LOC_TASK_TRONG,
  dangLoc,
  kiemTraLocTask,
  locTask,
  nhomTheoCot,
  type LocTask,
} from '../luat/kanban'
import { cacBuocLamDuoc, type BuocChuyen } from '../luat/chuyenTrangThai'
import { cacCotThaDuoc, moTaDangKeo, theKeoDuoc } from '../luat/keoThaKanban'
import { TEN_TRANG_THAI_TASK, THONG_BAO_SUA_TASK, dinhDangNgay, type TrangThaiTask } from '../luat/task'
import { HopNhapLyDo } from './HopNhapLyDo'
import { tinhHuongCua, type QuyenChuyenKanban } from './chuyenTheKanban'
import { useChuyenTheKanban } from './useChuyenTheKanban'

interface Props {
  tasks: readonly Task[]
  onMo: (taskId: string) => void
  /** Người gọi và Dự án để kiểm quyền đổi cột; null là chỉ xem (chưa biết quyền, hoặc không đổi được). */
  quyen?: QuyenChuyenKanban | null
  /** Một Task vừa đổi trạng thái (hoặc vừa đọc lại cho khớp Kho): thay thẻ tại chỗ. */
  onDaDoi?: (task: Task) => void
  onHetPhien?: () => void
}

/** Phải kéo quá ngần này (đơn vị của sự kiện con trỏ) thì một lần nhấn mới thành kéo, để bấm vẫn là bấm. */
const NGUONG_KEO = 5

const kieu = stylex.create({
  keoDuoc: { cursor: 'grab', userSelect: 'none' },
})

/** Giá trị của lựa chọn "Tất cả" trong các ô lọc (không phải id người hay trạng thái nào). */
const TAT_CA = '__tat_ca__'

/** Màu chấm trạng thái của từng cột (đi qua theme, không đặt màu). */
const MAU_CHAM_COT: Record<TrangThaiTask, 'neutral' | 'accent' | 'warning' | 'error' | 'success'> = {
  MOI: 'neutral',
  DANG_LAM: 'accent',
  CHO_DUYET: 'warning',
  TRA_LAI: 'warning',
  BI_LOI: 'error',
  HOAN_THANH: 'success',
  HUY: 'neutral',
}

/** Các người xuất hiện ở một vai trên Task, không trùng, xếp theo tên (thứ tự tiếng Việt). */
function cacNguoi(tasks: readonly Task[], vai: 'nguoiThucHien' | 'nguoiKiemTra') {
  const theoId = new Map<string, string>()
  for (const task of tasks) theoId.set(task[vai].id, task[vai].tenHienThi)
  return [...theoId.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], 'vi'))
    .map(([value, label]) => ({ value, label }))
}

interface TheTaskProps {
  task: Task
  onMo: (taskId: string) => void
  /** Thẻ kéo được (đã biết quyền và Task chưa chốt). */
  keoDuoc: boolean
  onBatDauKeo: (e: ReactPointerEvent, task: Task) => void
  /** Các bước người gọi làm được trên Task này, để chọn bằng menu (đường bàn phím tương đương kéo thả). */
  cacBuoc: readonly BuocChuyen[]
  onChon: (task: Task, sang: TrangThaiTask) => void
  dangKeo: boolean
}

/**
 * Một thẻ Task: tiêu đề (mở chi tiết), Người thực hiện, Người kiểm tra, hạn. Kéo được sang cột khác
 * (đường tắt) hoặc dùng menu "Chuyển Task sang cột khác" bằng bàn phím.
 */
function TheTask({ task, onMo, keoDuoc, onBatDauKeo, cacBuoc, onChon, dangKeo }: TheTaskProps) {
  return (
    <VStack role="listitem">
      <Card
        padding={3}
        variant={dangKeo ? 'blue' : 'default'}
        xstyle={keoDuoc ? kieu.keoDuoc : undefined}
        onPointerDown={keoDuoc ? (e) => onBatDauKeo(e, task) : undefined}
      >
        <VStack gap={1}>
          <HStack hAlign="between" vAlign="center" gap={1}>
            <Button label={task.tieuDe} variant="ghost" onClick={() => onMo(task.id)} />
            {cacBuoc.length > 0 && (
              <MoreMenu
                label={`Chuyển Task "${task.tieuDe}" sang cột khác`}
                size="sm"
                items={cacBuoc.map((buoc) => ({
                  label: `Chuyển sang ${TEN_TRANG_THAI_TASK[buoc.sang]}`,
                  onClick: () => onChon(task, buoc.sang),
                }))}
              />
            )}
          </HStack>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="supporting">{`Người thực hiện: ${task.nguoiThucHien.tenHienThi}`}</Text>
            {task.nguoiThucHien.daRoiDuAn && <Token label={THONG_BAO_SUA_TASK.daRoiDuAn} color="orange" />}
          </HStack>
          <HStack gap={2} vAlign="center" wrap="wrap">
            <Text type="supporting">{`Người kiểm tra: ${task.nguoiKiemTra.tenHienThi}`}</Text>
            {task.nguoiKiemTra.daRoiDuAn && <Token label={THONG_BAO_SUA_TASK.daRoiDuAn} color="orange" />}
          </HStack>
          <Text type="supporting">{`Hạn: ${task.han === null ? 'Không có hạn' : dinhDangNgay(task.han)}`}</Text>
        </VStack>
      </Card>
    </VStack>
  )
}

/**
 * Bảng Kanban của một Dự án: bảy cột trạng thái, mỗi Task đúng một cột; bộ lọc theo Người thực
 * hiện, Người kiểm tra và trạng thái (kết hợp được). Khi biết quyền của người gọi (`quyen`), kéo một
 * thẻ sang cột khác hoặc dùng menu trên thẻ để đổi trạng thái, qua đúng lệnh Kho như nút ở chi tiết
 * Task; không có `quyen` thì chỉ để xem.
 */
export function BangKanbanTask({ tasks, onMo, quyen = null, onDaDoi, onHetPhien }: Props) {
  const [loc, setLoc] = useState<LocTask>(LOC_TASK_TRONG)
  const [keo, setKeo] = useState<{ task: Task; cotDich: TrangThaiTask | null } | null>(null)
  const chuyen = useChuyenTheKanban({ quyen, onDaDoi: onDaDoi ?? (() => {}), onHetPhien: onHetPhien ?? (() => {}) })
  // Các hàm xử lý gắn vào `window` lúc bắt đầu kéo luôn gọi bản mới nhất của `tha`.
  const thaRef = useRef(chuyen.tha)
  useEffect(() => {
    thaRef.current = chuyen.tha
  })
  const cotEls = useRef(new Map<TrangThaiTask, HTMLElement>())
  const huyKeoRef = useRef<(() => void) | null>(null)
  useEffect(() => () => huyKeoRef.current?.(), [])
  const daLoc = locTask(tasks, loc)
  const cot = nhomTheoCot(daLoc)
  const dangLocLuc = dangLoc(loc)

  /** Đổi một ô lọc; mọi giá trị đi qua `kiemTraLocTask` ở ranh giới, giá trị sai thì bỏ qua. */
  function doiLoc(o: keyof LocTask, giaTri: string | null) {
    const kt = kiemTraLocTask.loc({ ...loc, [o]: giaTri === TAT_CA ? null : giaTri })
    if (kt.ok) setLoc(kt.giaTri)
  }

  /**
   * Nhấn xuống một thẻ: nếu con trỏ đi đủ xa thì thành kéo; thả vào cột nào thì cột đó nhận. Chỉ
   * chuột và bút (cảm ứng để cuộn trang, đổi cột bằng menu trên thẻ). Esc huỷ kéo.
   */
  function batDauKeo(e: ReactPointerEvent, task: Task) {
    if (quyen === null || !theKeoDuoc(task.trangThai)) return
    if (e.button > 0 || e.pointerType === 'touch') return
    // Nút và menu trong thẻ tự xử lý lần nhấn của mình.
    if ((e.target as Element).closest('button, [role="menuitem"], [role="menu"]')) return
    huyKeoRef.current?.()

    const goc = { x: e.clientX, y: e.clientY }
    let daKeo = false
    const cotTai = (ev: PointerEvent): TrangThaiTask | null => {
      const diem = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(ev.clientX, ev.clientY) : null
      const phanTu = diem ?? (ev.target as Node | null)
      if (!phanTu) return null
      for (const [trangThai, el] of cotEls.current) if (el.contains(phanTu)) return trangThai
      return null
    }
    const ket = () => {
      window.removeEventListener('pointermove', diChuyen)
      window.removeEventListener('pointerup', tha)
      window.removeEventListener('pointercancel', ket)
      window.removeEventListener('keydown', phim)
      huyKeoRef.current = null
      setKeo(null)
    }
    const diChuyen = (ev: PointerEvent) => {
      if (!daKeo && Math.abs(ev.clientX - goc.x) + Math.abs(ev.clientY - goc.y) < NGUONG_KEO) return
      daKeo = true
      setKeo({ task, cotDich: cotTai(ev) })
    }
    const tha = (ev: PointerEvent) => {
      const cot = daKeo ? cotTai(ev) : null
      ket()
      if (cot !== null) thaRef.current(task, cot)
    }
    const phim = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') ket()
    }
    huyKeoRef.current = ket
    window.addEventListener('pointermove', diChuyen)
    window.addEventListener('pointerup', tha)
    window.addEventListener('pointercancel', ket)
    window.addEventListener('keydown', phim)
  }

  /** Khi đang kéo: cột đang rê tới hiện xanh nếu thả được, đỏ nếu không (cột cũ của thẻ thì giữ nguyên). */
  function bienTheCot(trangThai: TrangThaiTask): 'muted' | 'blue' | 'red' {
    if (keo === null || keo.cotDich !== trangThai || keo.task.trangThai === trangThai) return 'muted'
    return cotThaDuoc.includes(trangThai) ? 'blue' : 'red'
  }

  const cotThaDuoc = keo && quyen ? cacCotThaDuoc(tinhHuongCua(quyen, keo.task)) : []

  const luaChonTatCa = (nhan: string) => ({ value: TAT_CA, label: nhan })

  return (
    <VStack gap={3}>
      <HStack gap={3} vAlign="end" wrap="wrap" role="group" aria-label="Bộ lọc Task">
        <Selector
          label="Người thực hiện"
          width={220}
          value={loc.nguoiThucHienId ?? TAT_CA}
          onChange={(giaTri) => doiLoc('nguoiThucHienId', giaTri)}
          options={[luaChonTatCa('Tất cả Người thực hiện'), ...cacNguoi(tasks, 'nguoiThucHien')]}
        />
        <Selector
          label="Người kiểm tra"
          width={220}
          value={loc.nguoiKiemTraId ?? TAT_CA}
          onChange={(giaTri) => doiLoc('nguoiKiemTraId', giaTri)}
          options={[luaChonTatCa('Tất cả Người kiểm tra'), ...cacNguoi(tasks, 'nguoiKiemTra')]}
        />
        <Selector
          label="Trạng thái"
          width={220}
          value={loc.trangThai ?? TAT_CA}
          onChange={(giaTri) => doiLoc('trangThai', giaTri)}
          options={[
            luaChonTatCa('Tất cả trạng thái'),
            ...CAC_COT_KANBAN.map((trangThai) => ({ value: trangThai, label: TEN_TRANG_THAI_TASK[trangThai] })),
          ]}
        />
        {dangLocLuc && <Button label="Bỏ lọc" variant="secondary" onClick={() => setLoc(LOC_TASK_TRONG)} />}
      </HStack>

      <Text type="supporting" role="status" aria-label="Số Task đang hiện">
        {dangLocLuc ? `Đang lọc: ${daLoc.length} trên ${tasks.length} Task.` : `${tasks.length} Task.`}
      </Text>

      {keo && (
        <Text type="supporting" role="status" aria-label="Đang kéo Task">
          {moTaDangKeo(keo.task.tieuDe, cotThaDuoc)}
        </Text>
      )}
      {chuyen.thongBao && !chuyen.hop && (
        <Banner
          status={chuyen.thongBao.loai === 'loi' ? 'error' : 'success'}
          title={chuyen.thongBao.loai === 'loi' ? 'Chưa chuyển được Task.' : chuyen.thongBao.noiDung}
          description={chuyen.thongBao.loai === 'loi' ? chuyen.thongBao.noiDung : undefined}
          role={chuyen.thongBao.loai === 'loi' ? 'alert' : 'status'}
          isDismissable
          dismissLabel="Đóng thông báo"
          onDismiss={chuyen.xoaThongBao}
        />
      )}

      <HStack gap={3} vAlign="start" isScrollable role="group" aria-label="Bảng Kanban">
        {CAC_COT_KANBAN.map((trangThai) => {
          const cacThe = cot[trangThai]
          const ten = TEN_TRANG_THAI_TASK[trangThai]
          return (
            <VStack key={trangThai} role="group" aria-label={`Cột ${ten}`}>
              <Card
                ref={(el) => {
                  if (el) cotEls.current.set(trangThai, el)
                  else cotEls.current.delete(trangThai)
                }}
                variant={bienTheCot(trangThai)}
                padding={3}
                width={300}
              >
                <VStack gap={3}>
                  <HStack hAlign="between" vAlign="center">
                    <HStack gap={2} vAlign="center">
                      <StatusDot variant={MAU_CHAM_COT[trangThai]} label={`Màu của cột ${ten}`} />
                      <Heading level={4}>{ten}</Heading>
                    </HStack>
                    <Badge label={cacThe.length} variant="neutral" />
                  </HStack>
                  {cacThe.length === 0 ? (
                    <EmptyState
                      isCompact
                      headingLevel={5}
                      title={dangLocLuc ? 'Không có Task nào khớp bộ lọc.' : 'Chưa có Task nào.'}
                      description={
                        dangLocLuc
                          ? `Không có Task ${ten} nào khớp bộ lọc hiện tại.`
                          : `Chưa có Task nào ở trạng thái ${ten}.`
                      }
                    />
                  ) : (
                    <VStack gap={2} role="list" aria-label={`Task ${ten}`}>
                      {cacThe.map((task) => (
                        <TheTask
                          key={task.id}
                          task={task}
                          onMo={onMo}
                          keoDuoc={quyen !== null && theKeoDuoc(task.trangThai)}
                          onBatDauKeo={batDauKeo}
                          cacBuoc={quyen ? cacBuocLamDuoc(tinhHuongCua(quyen, task)) : []}
                          onChon={chuyen.tha}
                          dangKeo={keo?.task.id === task.id}
                        />
                      ))}
                    </VStack>
                  )}
                </VStack>
              </Card>
            </VStack>
          )
        })}
      </HStack>

      {chuyen.hop && (
        <HopNhapLyDo
          tieuDe={`${chuyen.hop.buoc.nhan}: nhập lý do`}
          nhanGui={chuyen.hop.buoc.nhan}
          dangGui={chuyen.dangGui}
          loi={chuyen.loiHop ? chuyen.loiHop.thongBao : null}
          onGui={chuyen.guiLyDo}
          onDong={chuyen.dongHop}
        />
      )}
    </VStack>
  )
}
