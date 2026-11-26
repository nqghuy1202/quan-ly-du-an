# Từ vựng

Dùng đúng các từ này trong mã, test, giao diện và ticket. Nguồn: `.scratch/quan-ly-du-an/spec.md`.

| Từ | Nghĩa | Đừng viết |
|---|---|---|
| **Dự án** | Một đầu việc lớn có nhiều Task, nhiều người cùng làm, gắn 0 đến nhiều repo GitHub | project |
| **Mã Dự án** | Mã ngắn, duy nhất của một Dự án, do PM hoặc Support đặt (vd `SDV-012`) | mã số, ID |
| **Khách hàng** | Khách hàng hoặc đơn vị mà Dự án phục vụ, chữ tự do | đối tác |
| **Người phụ trách** | Một Người trong dự án được ghi là đầu mối của Dự án. Chỉ để hiển thị và lọc, không thêm quyền | chủ dự án, owner |
| **Mức ưu tiên** | Thấp, Trung bình hoặc Cao. Có ở Dự án và ở Task | độ ưu tiên, priority |
| **Task** | Một việc cụ thể trong một Dự án. Luôn viết "Task" | công việc, ticket, issue |
| **Người thực hiện** | Người được giao làm Task. Mỗi Task có đúng một | assignee |
| **Người kiểm tra** | Người đánh giá kết quả Task. Mỗi Task có đúng một, khác Người thực hiện | reviewer |
| **Người trong dự án** | Tài khoản đã được thêm vào một Dự án (khác với vai hệ thống **Thành viên**) | thành viên dự án |
| **Vai trò trong Dự án** | Chữ tự do mô tả việc một Người trong dự án đảm nhận ở Dự án đó (vd "Trưởng nhóm"). Không đổi quyền; khác với vai hệ thống | chức vụ dự án |
| **PM / Support / Thành viên** | Ba vai hệ thống của một tài khoản | admin, user |
| **Thông tin nhân sự** | Số điện thoại, Chức danh, Phòng ban trong hồ sơ của một tài khoản. Mỗi người tự sửa của mình; chính chủ, PM, Support và người cùng ít nhất một Dự án (kể cả đã Lưu trữ) xem được | |
| **Chờ duyệt** | Người thực hiện báo đã làm xong, đang đợi Người kiểm tra | |
| **Hoàn thành** | Người kiểm tra chấp nhận kết quả. Trạng thái cuối | |
| **Trả lại** | Kết quả chưa đạt, phải làm tiếp, giữ nguyên Task, có lý do | |
| **Bị lỗi** | Kết quả hỏng hẳn, cần PM hoặc Support quyết định tiếp, có lý do | |
| **Huỷ** | Task không làm nữa. Trạng thái cuối, có lý do | xoá |
| **Lưu trữ** | Dự án ngừng hoạt động, chỉ xem | |
| **Dấu vết** | Người tạo, ngày tạo, người chỉnh sửa gần nhất, ngày chỉnh sửa gần nhất | audit log |
| **Tiến độ** | Phần trăm Task Hoàn thành của một Dự án (Huỷ không tính vào mẫu số) | |
| **Trễ hạn** | Task có hạn đã qua mà chưa Hoàn thành và chưa Huỷ | |
| **Quá hạn dự kiến** | Dự án đang hoạt động đã qua Ngày kết thúc dự kiến mà Tiến độ chưa đủ 100%. Khác với **Trễ hạn** (của Task) | trễ hạn dự án |
| **Tổng quan** | Trang đầu tiên sau khi đăng nhập, tóm tắt mọi Dự án và Task người đó được xem | dashboard |
| **Thanh bên** | Điều hướng chính nằm dọc bên trái | menu |
| **Ngăn trượt** | Khung mở từ bên phải, đè lên trang hiện tại, để xem hoặc nhập rồi đóng lại | popup |

## Từ kỹ thuật

| Từ | Nghĩa |
|---|---|
| **Kho dữ liệu** | Giao diện lưu trữ duy nhất mà phần còn lại của ứng dụng dùng. Mọi lệnh nhận danh tính người gọi và trả kết quả đã áp luật và quyền, hoặc một lỗi có mã. Có bản bộ nhớ (test, dev) và bản Supabase. |
| **Bộ test hợp đồng** | Một bộ test chạy lại cho mọi bản cài của Kho dữ liệu. |
| **Bảng ca dùng chung** | Bảng (vai, trạng thái, người gọi, bước muốn làm, kết quả mong đợi) là nguồn sự thật của ma trận chuyển trạng thái và quyền xem. Bản bộ nhớ chạy trong cổng; bản Supabase chạy tay trên Supabase thật. |
| **Cổng GitHub** | Giao diện thứ hai (lát 4): nhận danh sách repo và link, trả trạng thái đã chuẩn hoá hoặc lỗi có mã. Chỉ đọc. |
| **Edge Function** | Hàm chạy phía Supabase. Dự án có một: `doc-github`, đọc trạng thái issue hoặc PR trên GitHub cho người đã đăng nhập, chỉ đọc, giữ token GitHub chỉ đọc trong secret. |
| **Danh sách kiểm tay** | Bảy mục bắt buộc chủ dự án chạy trên Supabase thật trước khi đưa ứng dụng lên mạng (`supabase/README.md`, Phần B), vì phân quyền từng dòng là hàng rào duy nhất. Chưa kiểm xong thì chưa đưa lên mạng. |
| **Cổng không kiểm được** | Phần `npm test` không kiểm được vì không có mạng và DB: bản Supabase, migration, phân quyền từng dòng, hàm cơ sở dữ liệu, Edge Function với GitHub thật, luồng email. Chỉ kiểm tay. |
| **Lát 0** | Dựng khung do người làm (cài phụ thuộc, cấu hình), không giao AI. |
| **Cổng** | Bước kiểm của Bảng ticket AI (test + review) trước khi đáp một ticket lên nhánh đích. |
