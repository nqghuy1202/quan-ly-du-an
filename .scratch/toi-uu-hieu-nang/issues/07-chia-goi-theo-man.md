# 07: Chia gói theo màn

**What to build:** Toàn bộ ứng dụng đang nằm trong một gói tải ngay lần đầu. Tách để gói đầu chỉ chứa phần trước đăng nhập (đăng nhập, đăng ký, xác nhận email, đặt lại mật khẩu); mỗi màn sau đăng nhập tải khi mở tới, bằng cách tải lười sẵn có của React, không thêm gói. Trong lúc phần của một màn đang tải thì hiện trạng thái đang tải; tải lỗi thì hiện thông báo tiếng Việt kèm nút Thử lại. Dựng từ component Astryx (đọc `astryx component <Tên>` trước khi dùng), không thẻ thô, không `className` hay `style`. Nội dung và hành vi của từng màn không đổi. Spec: `.scratch/toi-uu-hieu-nang/spec.md` (story 24–26).

Cỡ gói thật không có tiêu chí tự động; chủ dự án xem bằng `npm run build` sau khi đáp.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Các màn sau đăng nhập (Tổng quan, Tất cả Dự án, Dự án của tôi, Chi tiết Dự án, Việc của tôi, Chờ tôi duyệt, Người dùng, Hồ sơ) được nạp bằng tải lười; màn trước đăng nhập thì không.
- [ ] Mở một màn tải lười lần đầu: thấy trạng thái đang tải rồi tới nội dung của màn, không có lúc nào vùng nội dung trống.
- [ ] Phần của một màn tải lỗi: thấy thông báo lỗi tiếng Việt và nút Thử lại; bấm Thử lại mà tải được thì thấy nội dung màn.
- [ ] Thanh bên và điều hướng giữa các màn vẫn làm đúng như trước; focus ring của nút Thử lại nhìn thấy được.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test`, không cần mạng (kể cả localhost), DB, đồng hồ thật hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file. Mọi test hiện có vẫn xanh. Không đổi `package.json` hay lockfile, không sửa hook của repo. `npm run typecheck` và `npm run lint` sạch.
