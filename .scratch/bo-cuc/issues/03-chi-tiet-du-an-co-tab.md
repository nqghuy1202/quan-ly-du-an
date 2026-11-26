# 03: Chi tiết Dự án có dải tóm tắt và tab

**What to build:** Trang chi tiết Dự án không còn là một cột dài. Đầu trang là dải tóm tắt cố định: tên Dự án, trạng thái (hoạt động hay Lưu trữ), Tiến độ, số Task Trễ hạn. Bên dưới là dải tab của Astryx với bốn tab: **Task** (mở sẵn; Kanban và bộ lọc hiện có, chiếm trọn chiều rộng) · **Người trong dự án** (thêm, gỡ người như hiện nay) · **Thông tin** (mô tả, Dấu vết, nút sửa, Lưu trữ, mở lại như hiện nay) · **GitHub** (gắn, gỡ repo như hiện nay). Hành vi và quyền của từng phần giữ nguyên, chỉ đổi chỗ đứng. Đổi tab vẫn ở cùng Dự án, dải tóm tắt không đổi. Mỗi tab có trạng thái trống, đang tải, lỗi. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 21–27).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Mở một Dự án thấy dải tóm tắt với tên, trạng thái, Tiến độ và số Task Trễ hạn đúng với dữ liệu dựng sẵn.
- [ ] Có bốn tab Task, Người trong dự án, Thông tin, GitHub; tab Task được chọn sẵn và hiện bảng Kanban.
- [ ] Chọn từng tab hiện đúng nội dung của nó và ẩn nội dung các tab khác; dải tóm tắt vẫn hiện.
- [ ] Thêm và gỡ Người trong dự án, sửa và Lưu trữ Dự án, gắn và gỡ repo vẫn làm được từ tab tương ứng với đúng quyền như trước (Thành viên không thấy nút quản lý).
- [ ] Lưu trữ Dự án từ tab Thông tin làm dải tóm tắt đổi trạng thái thành Lưu trữ.
- [ ] Các test giao diện hiện có của chi tiết Dự án, Người trong dự án, repo GitHub, Kanban được sửa theo tab mà không mất hành vi chúng kiểm.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
