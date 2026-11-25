# 08: Sửa Task, đổi người và báo khi gỡ người khỏi dự án

**What to build:** PM hoặc Support của Dự án sửa tiêu đề, mô tả và hạn của Task, và đổi Người thực hiện hoặc Người kiểm tra, miễn là Task chưa ở trạng thái cuối (Hoàn thành hoặc Huỷ). Mỗi lần sửa cập nhật người chỉnh sửa gần nhất và ngày chỉnh sửa gần nhất. Khi PM hoặc Support gỡ một người khỏi Dự án, họ thấy danh sách các Task chưa chốt mà người đó đang giữ (thực hiện hoặc kiểm tra) để giao lại. Việc gỡ vẫn được thực hiện: Task giữ nguyên người cũ cho đến khi được giao lại, và Task hiện rõ người đó "đã rời dự án". Lát này chưa có cách đi tới trạng thái cuối bằng giao diện; test của bản cài bộ nhớ dựng sẵn Task ở trạng thái bất kỳ để kiểm các luật về trạng thái cuối.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] PM hoặc Support của Dự án sửa tiêu đề, mô tả, hạn của Task chưa ở trạng thái cuối thì dữ liệu đổi, người chỉnh sửa gần nhất và ngày chỉnh sửa gần nhất được cập nhật, người tạo và ngày tạo không đổi; tiêu đề vẫn phải thoả luật của ticket 07.
- [ ] Sửa Task đã Hoàn thành hoặc Huỷ trả lỗi `TASK_DA_CHOT` và dữ liệu không đổi.
- [ ] Người thực hiện, Người kiểm tra và Thành viên sửa Task hoặc đổi người trả lỗi `KHONG_CO_QUYEN`.
- [ ] Đổi Người thực hiện hoặc Người kiểm tra áp đúng các luật của ticket 07: người mới phải ở trong Dự án và hai vai không được trùng người.
- [ ] Trước khi gỡ một người khỏi Dự án, PM hoặc Support xem được danh sách Task chưa chốt mà người đó đang giữ; gỡ xong, các Task đó vẫn ghi người cũ và hiện "đã rời dự án".
- [ ] Giao lại một Task đang ghi người "đã rời dự án" cho người trong Dự án thì dấu hiệu "đã rời dự án" biến mất.
- [ ] Giao diện sửa và đổi người dựng từ Astryx, đủ trạng thái trống, đang tải và lỗi; Task ở trạng thái cuối hiện chỉ xem, kèm lý do.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
