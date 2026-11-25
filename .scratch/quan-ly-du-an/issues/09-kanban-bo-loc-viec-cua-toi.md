# 09: Bảng Kanban, bộ lọc, "Việc của tôi" và "Chờ tôi duyệt"

**What to build:** Trang Dự án có bảng Kanban với bảy cột trạng thái (Mới, Đang làm, Chờ duyệt, Trả lại, Bị lỗi, Hoàn thành, Huỷ). Mỗi thẻ hiện tiêu đề, Người thực hiện, Người kiểm tra và hạn. Người dùng lọc theo Người thực hiện, Người kiểm tra và trạng thái. Có hai danh sách cá nhân qua mọi Dự án: "Việc của tôi" (Task chưa chốt mà tôi là Người thực hiện) và "Chờ tôi duyệt" (Task đang Chờ duyệt mà tôi là Người kiểm tra), mỗi dòng kèm tên Dự án. Ở ticket này bảng chỉ để xem, kéo thả làm ở ticket 12. Bảng dựng từ template Kanban của Astryx; nếu template báo thiếu trình biên dịch StyleX thì dừng và báo, không tự thêm phụ thuộc.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Bảng Kanban hiện đủ bảy cột; mỗi Task nằm đúng một cột theo trạng thái và thẻ hiện tiêu đề, Người thực hiện, Người kiểm tra, hạn.
- [ ] Lọc theo Người thực hiện, theo Người kiểm tra và theo trạng thái cho đúng tập Task, kết hợp được nhiều bộ lọc cùng lúc; bỏ lọc thì trả lại đầy đủ.
- [ ] "Việc của tôi" liệt kê đúng các Task chưa Hoàn thành và chưa Huỷ mà người gọi là Người thực hiện, chỉ trong những Dự án người đó ở trong, kèm tên Dự án; người khác không thấy Task của mình trong danh sách của người này.
- [ ] "Chờ tôi duyệt" liệt kê đúng các Task đang Chờ duyệt mà người gọi là Người kiểm tra, kèm tên Dự án.
- [ ] Dự án đã Lưu trữ vẫn hiện bảng nhưng chỉ xem; người ngoài Dự án nhận lỗi không tìm thấy.
- [ ] Cột trống, đang tải và lỗi đều có trạng thái hiển thị rõ; thẻ và bộ lọc dùng được bằng bàn phím (có test điều hướng bằng phím), dùng focus ring mặc định của Astryx và không đặt `outline: none`.
- [ ] Mọi màn mới dựng từ component hoặc template Astryx, không thẻ `div` hay `span` thô, không `className` hay `style` nội tuyến, không màu hex hay `px` rời (ESLint của repo chặn các lỗi này, `npm run lint` phải sạch).
- [ ] Có test tự động cho từng tiêu chí trên (Task ở trạng thái bất kỳ được dựng sẵn trong bản cài bộ nhớ), chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
