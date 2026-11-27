import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { ToggleButton, ToggleButtonGroup } from '@astryxdesign/core/ToggleButton'
import { VStack } from '@astryxdesign/core/VStack'
import { CAC_MUC_UU_TIEN, TEN_MUC_UU_TIEN } from '../luat/mucUuTien'
import { TEN_TRANG_THAI_TASK } from '../luat/task'
import {
  CAC_TRANG_THAI_LOC_VIEC_CA_NHAN,
  kiemTraLocViecCaNhan,
  type LocViecCaNhan,
  type SoChipViecCaNhan,
} from '../luat/timViecCaNhan'

interface Props {
  loc: LocViecCaNhan
  onDoiLoc: (loc: LocViecCaNhan) => void
  /** Số Task khớp từng chip, đếm trên toàn danh sách đã đọc. */
  soChip: SoChipViecCaNhan
  /** Có nhóm chip Trạng thái không ("Việc của tôi" có, "Chờ tôi duyệt" không). */
  coNhomTrangThai: boolean
}

const nhanChip = (ten: string, so: number) => `${ten} (${so})`

/**
 * Thanh tìm và lọc dùng chung cho "Việc của tôi" và "Chờ tôi duyệt": ô tìm, nhóm chip Trạng thái (tuỳ
 * trang), nhóm chip Mức ưu tiên và chip Trễ hạn. Mỗi chip kèm số Task khớp; chip số 0 hiện và bấm được
 * như mọi chip khác. Chip báo trạng thái bật tắt qua `aria-pressed`.
 */
export function ThanhTimLocViecCaNhan({ loc, onDoiLoc, soChip, coNhomTrangThai }: Props) {
  /** Dữ liệu từ ô tìm và chip đi qua kiểm ở ranh giới trước khi thành bộ lọc. */
  function doi(them: Partial<Record<keyof LocViecCaNhan, unknown>>) {
    const kt = kiemTraLocViecCaNhan.loc({ ...loc, ...them })
    if (kt.ok) onDoiLoc(kt.giaTri)
  }

  return (
    <VStack gap={3} role="group" aria-label="Tìm và lọc Task">
      <TextInput
        type="search"
        label="Tìm Task"
        placeholder="Tiêu đề Task, Mã Dự án hoặc tên Dự án"
        width={360}
        value={loc.tuKhoa}
        onChange={(giaTri) => doi({ tuKhoa: giaTri })}
      />
      <HStack gap={5} vAlign="end" wrap="wrap">
        {coNhomTrangThai && (
          <VStack gap={1}>
            <Text type="label" color="secondary">
              Trạng thái
            </Text>
            <ToggleButtonGroup
              type="multiple"
              label="Lọc theo Trạng thái"
              size="sm"
              value={[...loc.trangThai]}
              onChange={(giaTri) => doi({ trangThai: giaTri })}
            >
              {CAC_TRANG_THAI_LOC_VIEC_CA_NHAN.map((trangThai) => (
                <ToggleButton
                  key={trangThai}
                  value={trangThai}
                  label={nhanChip(TEN_TRANG_THAI_TASK[trangThai], soChip.trangThai[trangThai])}
                />
              ))}
            </ToggleButtonGroup>
          </VStack>
        )}
        <VStack gap={1}>
          <Text type="label" color="secondary">
            Mức ưu tiên
          </Text>
          <ToggleButtonGroup
            type="multiple"
            label="Lọc theo Mức ưu tiên"
            size="sm"
            value={[...loc.mucUuTien]}
            onChange={(giaTri) => doi({ mucUuTien: giaTri })}
          >
            {CAC_MUC_UU_TIEN.map((muc) => (
              <ToggleButton key={muc} value={muc} label={nhanChip(TEN_MUC_UU_TIEN[muc], soChip.mucUuTien[muc])} />
            ))}
          </ToggleButtonGroup>
        </VStack>
        <VStack gap={1}>
          <Text type="label" color="secondary">
            Hạn
          </Text>
          <ToggleButton
            size="sm"
            label={nhanChip('Trễ hạn', soChip.treHan)}
            isPressed={loc.treHan}
            onPressedChange={(bat) => doi({ treHan: bat })}
          />
        </VStack>
      </HStack>
    </VStack>
  )
}
