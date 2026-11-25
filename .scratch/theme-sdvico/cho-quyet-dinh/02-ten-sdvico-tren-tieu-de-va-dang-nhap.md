# 02: Tên SDVICO ở tiêu đề trang và màn đăng nhập

**What to build:** Tên hiển thị của ứng dụng gắn với SDVICO. Tên xuất hiện ở tiêu đề tab của trình duyệt, ở màn đăng nhập và ở đầu khung ứng dụng sau khi đăng nhập. Tên đề xuất là "Quản lý dự án SDVICO" (xem spec của tính năng này). Không đổi chữ nào khác của giao diện.

**Blocked by:** 01

**Status:** needs-info

> Chưa đặt `ready-for-agent`: chủ dự án chưa duyệt tên hiển thị. Khi duyệt xong (giữ hoặc đổi tên), thay "Quản lý dự án SDVICO" bên dưới bằng tên đã chốt, đổi Status thành `ready-for-agent` và chuyển file này vào thư mục `issues/`.

- [ ] Tiêu đề tab của ứng dụng là "Quản lý dự án SDVICO".
- [ ] Màn đăng nhập hiện tên "Quản lý dự án SDVICO" ở phần đầu màn.
- [ ] Đầu khung ứng dụng sau khi đăng nhập hiện tên "Quản lý dự án SDVICO", và các màn khác không đổi chữ.
- [ ] Văn bản của giao diện vẫn dùng đúng các từ của bảng thuật ngữ (Dự án, Task, Người thực hiện...), không thay "dự án" bằng từ khác.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc (`package.json`, lockfile), không sửa hook của repo.
