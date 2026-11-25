import { useState } from 'react'
import { Badge } from '@astryxdesign/core/Badge'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
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
import { TEN_TRANG_THAI_TASK, THONG_BAO_SUA_TASK, dinhDangNgay, type TrangThaiTask } from '../luat/task'

interface Props {
  tasks: readonly Task[]
  onMo: (taskId: string) => void
}

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
}

/** Một thẻ Task: tiêu đề (mở chi tiết), Người thực hiện, Người kiểm tra, hạn. Chỉ để xem. */
function TheTask({ task, onMo }: TheTaskProps) {
  return (
    <VStack role="listitem">
      <Card padding={3}>
        <VStack gap={1}>
          <Button label={task.tieuDe} variant="ghost" onClick={() => onMo(task.id)} />
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
 * hiện, Người kiểm tra và trạng thái (kết hợp được). Chỉ để xem: kéo thả làm ở ticket khác.
 */
export function BangKanbanTask({ tasks, onMo }: Props) {
  const [loc, setLoc] = useState<LocTask>(LOC_TASK_TRONG)
  const daLoc = locTask(tasks, loc)
  const cot = nhomTheoCot(daLoc)
  const dangLocLuc = dangLoc(loc)

  /** Đổi một ô lọc; mọi giá trị đi qua `kiemTraLocTask` ở ranh giới, giá trị sai thì bỏ qua. */
  function doiLoc(o: keyof LocTask, giaTri: string | null) {
    const kt = kiemTraLocTask.loc({ ...loc, [o]: giaTri === TAT_CA ? null : giaTri })
    if (kt.ok) setLoc(kt.giaTri)
  }

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

      <HStack gap={3} vAlign="start" isScrollable role="group" aria-label="Bảng Kanban">
        {CAC_COT_KANBAN.map((trangThai) => {
          const cacThe = cot[trangThai]
          const ten = TEN_TRANG_THAI_TASK[trangThai]
          return (
            <VStack key={trangThai} role="group" aria-label={`Cột ${ten}`}>
              <Card variant="muted" padding={3} width={300}>
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
                        <TheTask key={task.id} task={task} onMo={onMo} />
                      ))}
                    </VStack>
                  )}
                </VStack>
              </Card>
            </VStack>
          )
        })}
      </HStack>
    </VStack>
  )
}
