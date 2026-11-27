# 08: Giữ dữ liệu lần trước khi quay lại màn

**What to build:** Quay lại Tổng quan sau khi mở một Dự án, hay đổi qua lại giữa các tab của Chi tiết Dự án, hiện phải chờ tải lại từ đầu. Giữ dữ liệu lần trước ở phía giao diện theo phiên đăng nhập: màn hiện ngay dữ liệu đã có, đọc lại ngầm, rồi thay bằng kết quả mới mà không qua trạng thái đang tải. Lần mở đầu tiên và nút Thử lại vẫn hiện đang tải như trước. Đọc lại ngầm bị lỗi thì giữ dữ liệu đang hiện; hết phiên thì vẫn về màn đăng nhập. Đăng xuất hoặc hết phiên thì xoá dữ liệu giữ. Không thêm thư viện, không đặt hạn theo thời gian, không đọc đồng hồ thật. Chỉ đổi giao diện: không đổi Kho dữ liệu. Spec: `.scratch/toi-uu-hieu-nang/spec.md` (story 27–32).

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Từ Tổng quan mở một Dự án rồi quay lại: thấy ngay số liệu lần trước, không thấy trạng thái đang tải.
- [ ] Dữ liệu đổi trong lúc đó (ví dụ một Task vừa Hoàn thành): sau khi quay lại, Tổng quan tự cập nhật sang số mới mà không qua trạng thái đang tải.
- [ ] Ở Chi tiết Dự án, đổi sang tab khác rồi về tab đã xem: thấy ngay nội dung, không thấy trạng thái đang tải.
- [ ] Đọc lại ngầm trả lỗi: dữ liệu lần trước vẫn hiện; trả lỗi chưa đăng nhập: về màn đăng nhập.
- [ ] Mở Tổng quan lần đầu sau đăng nhập, và bấm Thử lại sau lỗi, vẫn thấy trạng thái đang tải.
- [ ] Đăng xuất rồi đăng nhập bằng tài khoản khác trên cùng tab: không có lúc nào thấy dữ liệu của người trước.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng `npm test`, không cần mạng (kể cả localhost), DB, đồng hồ thật hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file. Mọi test hiện có vẫn xanh. Không đổi `package.json` hay lockfile, không sửa hook của repo. `npm run typecheck` và `npm run lint` sạch.
