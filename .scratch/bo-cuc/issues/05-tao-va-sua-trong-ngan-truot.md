# 05: Tạo và sửa trong Ngăn trượt

**What to build:** Tạo Task, tạo Dự án và sửa thông tin Dự án đều làm trong cùng kiểu Ngăn trượt như xem Task, không chuyển trang. Nút tạo Task nằm ở tab Task của chi tiết Dự án; nút tạo Dự án ở trang Dự án của tôi, Tất cả Dự án và ở trạng thái trống của Tổng quan (chỉ PM, đúng quyền tạo Dự án hiện có); nút sửa Dự án ở tab Thông tin. Biểu mẫu có lỗi thì lỗi hiện cạnh ô tương ứng và ngăn không tự đóng. Lưu thành công thì ngăn đóng và trang phía sau đọc lại: Task mới xuất hiện trên Kanban, Dự án mới xuất hiện trong danh sách, thông tin sửa hiện ngay ở dải tóm tắt và tab Thông tin. Huỷ hoặc Esc đóng ngăn không lưu gì. Luật kiểm dữ liệu và quyền giữ nguyên. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 34–36).

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] PM hoặc Support của Dự án bấm tạo Task thấy biểu mẫu trong Ngăn trượt; lưu hợp lệ thì ngăn đóng và Task mới hiện ở cột Mới của Kanban.
- [ ] Tạo Task thiếu tiêu đề, hoặc Người kiểm tra trùng Người thực hiện, thì lỗi hiện cạnh ô và ngăn vẫn mở.
- [ ] PM tạo Dự án trong Ngăn trượt; lưu xong Dự án mới hiện trong danh sách Dự án.
- [ ] Sửa Dự án trong Ngăn trượt; lưu xong tên mới hiện ở dải tóm tắt và mô tả mới hiện ở tab Thông tin.
- [ ] Đóng ngăn bằng Huỷ hoặc Esc không tạo hay sửa gì.
- [ ] Thành viên không thấy nút tạo Task, tạo Dự án hay sửa Dự án; Support không thấy nút tạo Dự án. Quyền tạo và sửa giữ đúng luật hiện có.
- [ ] Các test giao diện hiện có của tạo Task, tạo Dự án, sửa Dự án được sửa theo Ngăn trượt mà không mất hành vi chúng kiểm.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
