import { Theme } from '@astryxdesign/core/theme'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { themes, defaultThemeSlug } from './astryx-themes'

// Khung lát 0: chỉ chứng minh Astryx, theme neutral và StyleX chạy được.
// Ticket 01 thay phần này bằng màn đăng nhập, đăng ký và khung ứng dụng.
export function App() {
  return (
    <Theme theme={themes[defaultThemeSlug]}>
      <VStack gap={2}>
        <Heading level={1}>Quản lý dự án</Heading>
        <Text>Khung ứng dụng đã sẵn sàng.</Text>
      </VStack>
    </Theme>
  )
}
