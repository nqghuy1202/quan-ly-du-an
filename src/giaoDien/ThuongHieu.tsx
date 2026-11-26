import { Avatar } from '@astryxdesign/core/Avatar'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { TEN_UNG_DUNG } from '../tenUngDung'
// File logo SDVICO trong repo (chủ dự án đã duyệt), PNG vuông nền trong suốt; không sửa ảnh.
import logoSdvico from '../assets/sdvico-logo.png'

/** Văn bản thay thế của logo cho người dùng đọc màn hình. */
const VAN_BAN_THAY_THE_LOGO = 'SDVICO'

interface Props {
  /**
   * `true` ở đầu khung ứng dụng: tên là tiêu đề cấp 1 của trang. `false` ở màn đăng nhập: tên là
   * dòng chữ đầu màn, tiêu đề cấp 1 vẫn là tên của màn (Đăng nhập, Đăng ký...).
   */
  laTieuDeTrang: boolean
}

/**
 * Phần đầu mang logo và tên ứng dụng, dùng chung cho màn trước đăng nhập và đầu khung ứng dụng.
 * Logo là hình tĩnh: không link, không nút, không tooltip, nên không nhận focus và không đổi thứ
 * tự phím Tab. Hình vuông (không cắt tròn) để giữ nguyên chữ "SDVICO" ở đáy logo.
 */
export function ThuongHieu({ laTieuDeTrang }: Props) {
  return (
    <HStack gap={3} vAlign="center">
      <Avatar src={logoSdvico} alt={VAN_BAN_THAY_THE_LOGO} size="lg" shape="square" tooltip={false} />
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
