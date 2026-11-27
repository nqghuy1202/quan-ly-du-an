import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { HStack } from '@astryxdesign/core/HStack'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Selector } from '@astryxdesign/core/Selector'
import { Table, proportional, type TableColumn } from '@astryxdesign/core/Table'
import { Text } from '@astryxdesign/core/Text'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'
import type { DuAnKemSoLieu } from '../kho/khoDuLieu'
import { TEN_TRANG_THAI_DU_AN, xepDuAn } from '../luat/duAn'
import type { MucUuTien } from '../luat/mucUuTien'
import { dinhDangNgay } from '../luat/ngay'
import { NHAN_QUA_HAN_DU_KIEN, nhanTienDo } from '../luat/tienDo'
import {
  CAC_TINH_TRANG_DU_AN,
  LOC_DU_AN_TRONG,
  TEN_TINH_TRANG_DU_AN,
  cacNguoiPhuTrach,
  dangLocDuAn,
  kiemTraLocDuAn,
  locDuAn,
  type LocDuAn,
  type TinhTrangDuAn,
} from '../luat/timDuAn'
import { LUA_CHON_MUC_UU_TIEN } from './mauMucUuTien'
import { NhanMucUuTien } from './NhanMucUuTien'

/** Giá trị của lựa chọn "Tất cả" trong các ô lọc (không phải id người, mức hay tình trạng nào). */
const TAT_CA = '__tat_ca__'

/** Tiêu đề trạng thái trống khi chưa có Dự án nào ở một tình trạng. */
const CHUA_CO_THEO_TINH_TRANG: Record<TinhTrangDuAn, string> = {
  HOAT_DONG: 'Chưa có Dự án nào đang hoạt động.',
  LUU_TRU: 'Chưa có Dự án nào được Lưu trữ.',
  QUA_HAN_DU_KIEN: 'Chưa có Dự án nào Quá hạn dự kiến.',
}

/** Một dòng của bảng (kiểu đối tượng thuần, như Table đòi). */
type Dong = {
  id: string
  ma: string
  ten: string
  luuTru: boolean
  quaHanDuKien: boolean
  khachHang: string
  nguoiPhuTrach: string
  mucUuTien: MucUuTien
  ngayKetThucDuKien: string
  tienDo: string
  soTaskTreHan: number
}

function thanhDong(duAn: DuAnKemSoLieu): Dong {
  return {
    id: duAn.id,
    ma: duAn.ma,
    ten: duAn.ten,
    luuTru: duAn.trangThai === 'LUU_TRU',
    quaHanDuKien: duAn.quaHanDuKien,
    khachHang: duAn.khachHang,
    nguoiPhuTrach: duAn.nguoiPhuTrach?.tenHienThi ?? 'Chưa có',
    mucUuTien: duAn.mucUuTien,
    ngayKetThucDuKien: duAn.ngayKetThucDuKien === null ? 'Chưa có' : dinhDangNgay(duAn.ngayKetThucDuKien),
    tienDo: nhanTienDo(duAn.tienDo),
    soTaskTreHan: duAn.soTaskTreHan,
  }
}

interface Props {
  /** Tên truy cập được của bảng. */
  tenBang: string
  /** Toàn bộ Dự án đã đọc từ Kho (kèm số liệu); tìm và lọc chạy trên danh sách này. */
  duAn: readonly DuAnKemSoLieu[]
  /** Bộ tìm và lọc đang dùng; trang giữ nó để quay lại từ chi tiết không mất. */
  loc: LocDuAn
  onDoiLoc: (loc: LocDuAn) => void
  onMo: (duAnId: string) => void
  /** Trạng thái trống khi chưa có Dự án nào (không lọc tình trạng). */
  manTrong: { tieuDe: string; moTa: string }
}

/**
 * Bảng Dự án dùng chung cho "Dự án của tôi" và "Tất cả Dự án": ô tìm theo tên hoặc Mã (bỏ qua hoa thường
 * và dấu), lọc theo Mức ưu tiên, Người phụ trách, tình trạng; các bộ lọc kết hợp được. Tìm và lọc là luật
 * thuần `luat/timDuAn.ts`. Không Dự án nào khớp thì hiện trạng thái trống có nút bỏ lọc.
 */
export function BangDuAn({ tenBang, duAn, loc, onDoiLoc, onMo, manTrong }: Props) {
  const daLoc = xepDuAn(locDuAn(duAn, loc))
  const dangLoc = dangLocDuAn(loc)

  /** Đổi một ô; mọi giá trị đi qua `kiemTraLocDuAn` ở ranh giới, giá trị sai thì bỏ qua. */
  function doi(o: keyof LocDuAn, giaTri: string | null) {
    const kt = kiemTraLocDuAn.loc({ ...loc, [o]: giaTri === TAT_CA ? null : giaTri })
    if (kt.ok) onDoiLoc(kt.giaTri)
  }

  const nutBoLoc = <Button label="Bỏ lọc" variant="secondary" onClick={() => onDoiLoc(LOC_DU_AN_TRONG)} />

  const cot: TableColumn<Dong>[] = [
    { key: 'ma', header: 'Mã', width: proportional(1), renderCell: (dong) => <Text weight="semibold">{dong.ma}</Text> },
    {
      key: 'ten',
      header: 'Tên',
      width: proportional(2),
      renderCell: (dong) => (
        <HStack gap={2} vAlign="center" wrap="wrap">
          <Button label={dong.ten} variant="ghost" onClick={() => onMo(dong.id)} />
          {dong.luuTru && <Token label={TEN_TRANG_THAI_DU_AN.LUU_TRU} color="gray" size="sm" />}
          {dong.quaHanDuKien && <Token label={NHAN_QUA_HAN_DU_KIEN} color="red" size="sm" />}
        </HStack>
      ),
    },
    { key: 'khachHang', header: 'Khách hàng', width: proportional(1), renderCell: (dong) => <Text>{dong.khachHang}</Text> },
    {
      key: 'nguoiPhuTrach',
      header: 'Người phụ trách',
      width: proportional(1),
      renderCell: (dong) => <Text>{dong.nguoiPhuTrach}</Text>,
    },
    {
      key: 'mucUuTien',
      header: 'Mức ưu tiên',
      width: proportional(1),
      renderCell: (dong) => <NhanMucUuTien mucUuTien={dong.mucUuTien} size="sm" />,
    },
    {
      key: 'ngayKetThucDuKien',
      header: 'Ngày kết thúc dự kiến',
      width: proportional(1),
      renderCell: (dong) => <Text>{dong.ngayKetThucDuKien}</Text>,
    },
    { key: 'tienDo', header: 'Tiến độ', width: proportional(1), renderCell: (dong) => <Text>{dong.tienDo}</Text> },
    {
      key: 'soTaskTreHan',
      header: 'Trễ hạn',
      width: proportional(1),
      renderCell: (dong) => <Text>{String(dong.soTaskTreHan)}</Text>,
    },
  ]

  let ketQua
  if (daLoc.length > 0) {
    ketQua = <Table aria-label={tenBang} data={daLoc.map(thanhDong)} columns={cot} idKey="id" />
  } else if (duAn.length === 0) {
    // Chưa có Dự án nào: không có gì để bỏ lọc.
    ketQua = (
      <EmptyState
        headingLevel={3}
        title={loc.tinhTrang === null ? manTrong.tieuDe : CHUA_CO_THEO_TINH_TRANG[loc.tinhTrang]}
        description={manTrong.moTa}
      />
    )
  } else {
    ketQua = (
      <EmptyState
        headingLevel={3}
        title="Không có Dự án nào khớp."
        description="Thử từ khoá khác, hoặc bỏ lọc để xem lại toàn bộ Dự án."
        actions={nutBoLoc}
      />
    )
  }

  return (
    <VStack gap={3}>
      <HStack gap={3} vAlign="end" wrap="wrap" role="group" aria-label="Tìm và lọc Dự án">
        <TextInput
          type="search"
          label="Tìm Dự án"
          placeholder="Tên hoặc Mã Dự án"
          width={260}
          value={loc.tuKhoa}
          onChange={(giaTri) => doi('tuKhoa', giaTri)}
        />
        <Selector
          label="Mức ưu tiên"
          width={200}
          value={loc.mucUuTien ?? TAT_CA}
          onChange={(giaTri) => doi('mucUuTien', giaTri)}
          options={[{ value: TAT_CA, label: 'Tất cả Mức ưu tiên' }, ...LUA_CHON_MUC_UU_TIEN]}
        />
        <Selector
          label="Người phụ trách"
          width={220}
          value={loc.nguoiPhuTrachId ?? TAT_CA}
          onChange={(giaTri) => doi('nguoiPhuTrachId', giaTri)}
          options={[
            { value: TAT_CA, label: 'Tất cả Người phụ trách' },
            ...cacNguoiPhuTrach(duAn).map(({ id, tenHienThi }) => ({ value: id, label: tenHienThi })),
          ]}
        />
        {dangLoc && daLoc.length > 0 && nutBoLoc}
      </HStack>
      <SegmentedControl
        label="Lọc Dự án theo tình trạng"
        size="sm"
        value={loc.tinhTrang ?? TAT_CA}
        onChange={(giaTri) => doi('tinhTrang', giaTri)}
      >
        <SegmentedControlItem value={TAT_CA} label="Tất cả" />
        {CAC_TINH_TRANG_DU_AN.map((tinhTrang) => (
          <SegmentedControlItem key={tinhTrang} value={tinhTrang} label={TEN_TINH_TRANG_DU_AN[tinhTrang]} />
        ))}
      </SegmentedControl>
      <Text type="supporting" role="status" aria-label="Số Dự án đang hiện">
        {dangLoc ? `Đang lọc: ${daLoc.length} trên ${duAn.length} Dự án.` : `${duAn.length} Dự án.`}
      </Text>
      {ketQua}
    </VStack>
  )
}
