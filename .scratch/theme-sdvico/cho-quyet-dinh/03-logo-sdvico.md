# 03: Logo SDVICO ở màn đăng nhập và khung ứng dụng

**What to build:** Logo SDVICO hiện ở đầu màn đăng nhập và ở đầu khung ứng dụng sau khi đăng nhập, kèm văn bản thay thế "SDVICO" cho người dùng đọc màn hình. Logo dùng đúng file chủ dự án cung cấp, không tải từ website.

**Blocked by:** 01

**Status:** needs-info

> Chưa đặt `ready-for-agent`: chủ dự án chưa đưa file logo. Khi file đã nằm trong repo (và chủ dự án nói chỗ để file, định dạng, bản cho nền sáng và nền tối nếu có hai bản), bổ sung vào mô tả bên trên, đổi Status thành `ready-for-agent` và chuyển file này vào thư mục `issues/`.

- [ ] Màn đăng nhập hiện logo SDVICO với văn bản thay thế "SDVICO".
- [ ] Đầu khung ứng dụng sau khi đăng nhập hiện logo SDVICO với văn bản thay thế "SDVICO".
- [ ] Logo nhìn rõ ở cả chế độ sáng và chế độ tối (có bản cho từng chế độ nếu chủ dự án cung cấp hai bản, hoặc một bản dùng được trên cả hai nền).
- [ ] Logo không làm vỡ bố cục: màn đăng nhập và khung ứng dụng vẫn đủ trạng thái trống, đang tải, lỗi như trước, và điều hướng bằng bàn phím không đổi thứ tự Tab.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc (`package.json`, lockfile), không sửa hook của repo.
