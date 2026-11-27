import { Component, lazy, Suspense, useState, type ComponentType, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Center } from '@astryxdesign/core/Center'
import { Spinner } from '@astryxdesign/core/Spinner'

/** Lỗi khi nạp phần mã của một màn (vd mất mạng giữa chừng); chỉ lỗi này hiện nút Thử lại. */
class LoiNapMan extends Error {
  constructor(cause: unknown) {
    super('Không nạp được phần mã của màn.', { cause })
    this.name = 'LoiNapMan'
  }
}

interface PropsBienLoi {
  ten: string
  onThuLai: () => void
  children: ReactNode
}

/**
 * Bắt lỗi nạp phần mã của màn và hiện thông báo kèm Thử lại. Lỗi khác (lỗi khi vẽ chính màn) ném
 * tiếp lên trên như trước khi chia gói.
 */
class BienLoiNapMan extends Component<PropsBienLoi, { loi: unknown }> {
  state: { loi: unknown } = { loi: null }

  static getDerivedStateFromError(loi: unknown) {
    return { loi }
  }

  render() {
    const { loi } = this.state
    if (loi === null) return this.props.children
    if (!(loi instanceof LoiNapMan)) throw loi
    return (
      <Center padding={6}>
        <Banner
          status="error"
          title={`Không tải được màn ${this.props.ten}.`}
          description="Kiểm tra kết nối mạng rồi bấm Thử lại."
          role="alert"
          endContent={
            <Button
              label="Thử lại"
              variant="secondary"
              onClick={() => {
                this.props.onThuLai()
                this.setState({ loi: null })
              }}
            />
          }
        />
      </Center>
    )
  }
}

/**
 * Dựng một màn tải lười (React.lazy + Suspense): khi phần mã đang tải thì hiện "Đang tải màn …",
 * tải lỗi thì hiện thông báo và nút Thử lại. `React.lazy` nhớ cả promise bị lỗi, nên Thử lại tạo
 * lazy mới để gọi `nap` lần nữa. Mọi chỗ dùng chung một lazy: đã tải xong thì mở lại không chờ.
 *
 * `nap` trả component của màn (vd `() => import('./ManHoSo').then((m) => m.ManHoSo)`); test truyền
 * hàm nạp giả.
 */
export function taoManTaiLuoi<P extends object>(nap: () => Promise<ComponentType<P>>, ten: string): ComponentType<P> {
  const taoLazy = () =>
    lazy(() =>
      nap().then(
        (man) => ({ default: man }),
        (loi: unknown) => {
          throw new LoiNapMan(loi)
        },
      ),
    )
  let lazyHienTai = taoLazy()

  function ManTaiLuoi(props: P) {
    const [Man, setMan] = useState(() => lazyHienTai)
    const thuLai = () => {
      lazyHienTai = taoLazy()
      setMan(() => lazyHienTai)
    }
    return (
      <BienLoiNapMan ten={ten} onThuLai={thuLai}>
        <Suspense
          fallback={
            <Center padding={6}>
              <Spinner size="lg" label={`Đang tải màn ${ten}…`} />
            </Center>
          }>
          <Man {...props} />
        </Suspense>
      </BienLoiNapMan>
    )
  }
  ManTaiLuoi.displayName = `TaiLuoi(${ten})`
  return ManTaiLuoi
}
