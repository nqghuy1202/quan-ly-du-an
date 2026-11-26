# 01: Thanh bên và trang mở đầu

**What to build:** Điều hướng chính chuyển từ hàng nút ở đầu trang sang **Thanh bên** bên trái, chia nhóm: Tổng quan · Công việc (Việc của tôi, Chờ tôi duyệt) · Dự án (Dự án của tôi, Tất cả Dự án) · Quản trị (Người dùng). Mục hiện theo vai đúng như quyền hiện có: Tất cả Dự án và nhóm Quản trị chỉ PM. Mục đang mở được đánh dấu. Tên người dùng, vai hệ thống, lối vào Hồ sơ và Đăng xuất gom ở một chỗ cố định của khung. Đăng nhập xong vào thẳng **Tổng quan** (trang Tổng quan hiện có, nội dung đổi ở ticket sau). Màn hẹp: Thanh bên thu thành một nút mở trình đơn chứa đủ các mục. Thương hiệu SDVICO (tên, logo, theme) giữ nguyên. Danh sách mục và điều kiện hiện theo vai nằm ở luật thuần, không rải trong giao diện. Khung dựng bằng khung trang ứng dụng của Astryx có thanh bên (đọc tài liệu component và `astryx docs layout` trước). Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 1–8). Thêm từ Thanh bên, Tổng quan vào `GLOSSARY.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Luật thuần trả danh sách mục điều hướng theo vai: PM thấy đủ bảy mục gồm Người dùng; Support và Thành viên không thấy Tất cả Dự án và Người dùng (giữ đúng quyền hiện có).
- [ ] Sau khi đăng nhập, trang đầu tiên hiện ra là Tổng quan.
- [ ] Bấm từng mục trên Thanh bên mở đúng trang, và mục đó được đánh dấu là đang mở (thuộc tính trợ năng như `aria-current`).
- [ ] Tên người dùng, vai, Hồ sơ và Đăng xuất vẫn dùng được từ khung mới; Đăng xuất vẫn đưa về màn đăng nhập.
- [ ] Có nút mở trình đơn cho màn hẹp, mở ra thấy đủ các mục đúng theo vai.
- [ ] Logo và tên SDVICO vẫn hiện ở khung ứng dụng; các test thương hiệu hiện có vẫn xanh.
- [ ] Các test giao diện hiện có dựa vào hàng nút cũ được sửa theo Thanh bên mà không mất hành vi chúng kiểm.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
