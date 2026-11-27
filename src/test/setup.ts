import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll } from 'vitest'

declare global {
  /** File test đặt `true` (trong `vi.hoisted`) để tự giữ lúc nạp phần mã của các màn tải lười. */
  var khongNapTruocManTaiLuoi: boolean | undefined
}

// Các màn sau đăng nhập tải lười (`giaoDien/cacManTaiLuoi.ts`). Test giao diện nạp trước phần mã của
// chúng một lần mỗi file, trong hook (hạn 10 giây), như khi các màn còn import tĩnh; không thì ca đầu
// tiên của file phải chờ Vitest nạp cả cây module của màn và dễ quá hạn 5 giây khi máy tải nặng.
beforeAll(async () => {
  if (typeof document === 'undefined' || globalThis.khongNapTruocManTaiLuoi) return
  await Promise.all([
    import('../giaoDien/ManTongQuan'),
    import('../giaoDien/ManDuAn'),
    import('../giaoDien/ManChiTietDuAn'),
    import('../giaoDien/TrangDuAnCuaToi'),
    import('../giaoDien/TrangViecCaNhan'),
    import('../giaoDien/ManNguoiDung'),
    import('../giaoDien/ManHoSo'),
  ])
})

// jsdom chưa có `showModal`/`close` của <dialog> (Dialog của Astryx gọi chúng): bù tối thiểu, chỉ
// khi chạy trong môi trường có DOM và chưa có sẵn.
if (typeof HTMLDialogElement !== 'undefined' && typeof HTMLDialogElement.prototype.showModal !== 'function') {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.show = function show(this: HTMLDialogElement) {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
}

afterEach(() => {
  cleanup()
})
