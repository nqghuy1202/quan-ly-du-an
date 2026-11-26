# 04: Xem Task trong Ngăn trượt

**What to build:** Mở một Task không còn chuyển sang trang dọc riêng mà mở **Ngăn trượt** bên phải (component ngăn bên của Astryx), trang phía sau vẫn ở nguyên. Áp cho mọi chỗ mở Task: thẻ Kanban ở tab Task, trang Việc của tôi, Chờ tôi duyệt, hai danh sách Task ở Tổng quan. Trong ngăn: thông tin Task và các nút chuyển trạng thái người dùng được phép ở phía trên; bên dưới là tab **Lịch sử** · **Link GitHub** · **Sửa** (tab Sửa chỉ hiện khi người dùng có quyền sửa Task). Đóng bằng nút đóng hoặc phím Esc, trở lại đúng trang, đúng tab, đúng bộ lọc đang xem; focus trở lại chỗ đã bấm. Sau khi chuyển trạng thái hoặc sửa Task trong ngăn, trang phía sau đọc lại dữ liệu. Màn hẹp: ngăn chiếm cả màn. Quyền hiện nút lấy từ luật thuần như hiện nay. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 14, 29–33, 37–39). Thêm từ Ngăn trượt vào `GLOSSARY.md`.

**Blocked by:** 02, 03

**Status:** ready-for-agent

- [ ] Bấm thẻ Task trên Kanban mở Ngăn trượt có tiêu đề Task, trong khi bảng Kanban vẫn còn trong trang.
- [ ] Mở Task từ Việc của tôi, Chờ tôi duyệt và từ danh sách Task ở Tổng quan cũng mở Ngăn trượt mà không rời trang đó.
- [ ] Ngăn hiện đúng các nút chuyển trạng thái người dùng được phép theo luật hiện có, và các tab Lịch sử, Link GitHub; tab Sửa chỉ hiện với người có quyền sửa.
- [ ] Đóng ngăn bằng nút đóng và bằng phím Esc đều trở lại trang cũ với bộ lọc Kanban đang đặt vẫn giữ nguyên.
- [ ] Chuyển trạng thái một Task trong ngăn (vd Đang làm sang Chờ duyệt) làm thẻ trên Kanban phía sau chuyển sang cột mới.
- [ ] Các test giao diện hiện có của chi tiết Task, chuyển trạng thái, sửa Task, link GitHub, lịch sử được sửa theo Ngăn trượt mà không mất hành vi chúng kiểm.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
