# Từ vựng

Dùng đúng các từ này trong mã, test, giao diện và ticket. Nguồn: `.scratch/quan-ly-du-an/spec.md`.

| Từ | Nghĩa | Đừng viết |
|---|---|---|
| **Dự án** | Một đầu việc lớn có nhiều Task, nhiều người cùng làm, gắn 0 đến nhiều repo GitHub | project |
| **Task** | Một việc cụ thể trong một Dự án. Luôn viết "Task" | công việc, ticket, issue |
| **Người thực hiện** | Người được giao làm Task. Mỗi Task có đúng một | assignee |
| **Người kiểm tra** | Người đánh giá kết quả Task. Mỗi Task có đúng một, khác Người thực hiện | reviewer |
| **Người trong dự án** | Tài khoản đã được thêm vào một Dự án (khác với vai hệ thống **Thành viên**) | thành viên dự án |
| **PM / Support / Thành viên** | Ba vai hệ thống của một tài khoản | admin, user |
| **Chờ duyệt** | Người thực hiện báo đã làm xong, đang đợi Người kiểm tra | |
| **Hoàn thành** | Người kiểm tra chấp nhận kết quả. Trạng thái cuối | |
| **Trả lại** | Kết quả chưa đạt, phải làm tiếp, giữ nguyên Task, có lý do | |
| **Bị lỗi** | Kết quả hỏng hẳn, cần PM hoặc Support quyết định tiếp, có lý do | |
| **Huỷ** | Task không làm nữa. Trạng thái cuối, có lý do | xoá |
| **Lưu trữ** | Dự án ngừng hoạt động, chỉ xem | |
| **Dấu vết** | Người tạo, ngày tạo, người chỉnh sửa gần nhất, ngày chỉnh sửa gần nhất | audit log |
| **Tiến độ** | Phần trăm Task Hoàn thành của một Dự án (Huỷ không tính vào mẫu số) | |
| **Trễ hạn** | Task có hạn đã qua mà chưa Hoàn thành và chưa Huỷ | |

## Từ kỹ thuật

| Từ | Nghĩa |
|---|---|
| **Kho dữ liệu** | Giao diện lưu trữ duy nhất mà phần còn lại của ứng dụng dùng. Mọi lệnh nhận danh tính người gọi và trả kết quả đã áp luật và quyền, hoặc một lỗi có mã. Có bản bộ nhớ (test, dev) và bản Supabase. |
| **Bộ test hợp đồng** | Một bộ test chạy lại cho mọi bản cài của Kho dữ liệu. |
| **Bảng ca dùng chung** | Bảng (vai, trạng thái, người gọi, bước muốn làm, kết quả mong đợi) là nguồn sự thật của ma trận chuyển trạng thái và quyền xem. Bản bộ nhớ chạy trong cổng; bản Supabase chạy tay trên Supabase thật. |
| **Cổng GitHub** | Giao diện thứ hai (lát 4): nhận danh sách repo và link, trả trạng thái đã chuẩn hoá hoặc lỗi có mã. Chỉ đọc. |
| **Lát 0** | Dựng khung do người làm (cài phụ thuộc, cấu hình), không giao AI. |
| **Cổng** | Bước kiểm của Bảng ticket AI (test + review) trước khi đáp một ticket lên nhánh đích. |
