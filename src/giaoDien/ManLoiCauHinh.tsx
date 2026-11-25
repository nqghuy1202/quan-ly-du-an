import { Banner } from '@astryxdesign/core/Banner'
import { Card } from '@astryxdesign/core/Card'
import { Center } from '@astryxdesign/core/Center'
import { Heading } from '@astryxdesign/core/Heading'
import { Text } from '@astryxdesign/core/Text'
import { Theme } from '@astryxdesign/core/theme'
import { VStack } from '@astryxdesign/core/VStack'
import { themes, defaultThemeSlug } from '../astryx-themes'

/** Bề rộng tối đa của thẻ thông báo, theo cỡ chữ gốc (`rem`), như màn đăng nhập. */
const DO_RONG_THE = '36rem'

/** Màn hiện khi cấu hình môi trường sai (vd. có khoá service): ứng dụng không chạy. */
export function ManLoiCauHinh({ thongBao }: { thongBao: string }) {
  return (
    <Theme theme={themes[defaultThemeSlug]} mode="light">
      <Center padding={6}>
        <Card width="100%" maxWidth={DO_RONG_THE}>
          <VStack gap={4}>
            <Heading level={1}>Cấu hình chưa đúng</Heading>
            <Banner status="error" title={thongBao} role="alert" />
            <Text color="secondary">
              Sửa các biến VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY (xem .env.example và supabase/README.md),
              rồi chạy lại ứng dụng. Bỏ trống cả hai để chạy thử bằng bản bộ nhớ.
            </Text>
          </VStack>
        </Card>
      </Center>
    </Theme>
  )
}
