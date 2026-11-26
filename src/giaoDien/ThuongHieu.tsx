import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { TEN_UNG_DUNG } from '../tenUngDung'

interface Props {
  /**
   * `true` ở đầu khung ứng dụng: tên là tiêu đề cấp 1 của trang. `false` ở màn đăng nhập: tên là
   * dòng chữ đầu màn, tiêu đề cấp 1 vẫn là tên của màn (Đăng nhập, Đăng ký...).
   */
  laTieuDeTrang: boolean
}

/**
 * Phần đầu mang tên ứng dụng. Đặt trong một hàng ngang để sau này thêm logo SDVICO cạnh tên
 * mà không đổi bố cục của màn đăng nhập hay khung ứng dụng.
 */
export function ThuongHieu({ laTieuDeTrang }: Props) {
  return (
    <HStack gap={3} vAlign="center">
      {laTieuDeTrang ? (
        <Heading level={1}>{TEN_UNG_DUNG}</Heading>
      ) : (
        <Text as="p" type="large" weight="semibold" color="accent">
          {TEN_UNG_DUNG}
        </Text>
      )}
    </HStack>
  )
}
