# 04: Mức ưu tiên của Task

**What to build:** Task có **Mức ưu tiên** (mặc định Trung bình). PM hoặc Support của Dự án chọn khi tạo Task và đổi sau, theo đúng quyền sửa Task hiện có (Task chưa Hoàn thành, chưa Huỷ; Dự án chưa Lưu trữ); Người thực hiện và Người kiểm tra có vai Thành viên không đổi được. Mỗi lần đổi ghi một dòng vào lịch sử Task (người đổi, thời điểm, từ mức nào sang mức nào), cùng dòng thời gian với lịch sử trạng thái; đổi sang đúng mức đang có thì không ghi. Mức ưu tiên hiện trên thẻ Kanban, trong Ngăn trượt của Task và thành cột ở Việc của tôi, Chờ tôi duyệt. Trong mỗi cột Kanban: Cao, rồi Trung bình, rồi Thấp; cùng mức thì hạn gần nhất trước, Task không hạn đứng sau. Kanban lọc được theo Mức ưu tiên, kết hợp với các bộ lọc đang có. Chỉ luật, bản bộ nhớ, bộ test hợp đồng, bảng ca quyền, giao diện. Spec: `.scratch/bo-cuc-va-truong-moi/spec.md` (story 56–63).

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Task tạo không chọn Mức ưu tiên có mức Trung bình; tạo với mức Cao lưu đúng.
- [ ] PM và Support của Dự án đổi được Mức ưu tiên; Thành viên (kể cả Người thực hiện), Task đã Hoàn thành hoặc Huỷ, Dự án đã Lưu trữ bị từ chối (bảng ca quyền và bộ test hợp đồng).
- [ ] Đổi Mức ưu tiên ghi một dòng lịch sử có người đổi, mức cũ, mức mới; đổi sang đúng mức đang có không ghi dòng nào.
- [ ] Luật thứ tự trong cột: Cao trước Trung bình trước Thấp; cùng mức thì hạn gần hơn trước; không hạn đứng sau.
- [ ] Thẻ Kanban hiện Mức ưu tiên bằng chữ; lọc Kanban theo mức Cao chỉ còn Task mức Cao, kết hợp được với bộ lọc hiện có.
- [ ] Ngăn trượt của Task hiện Mức ưu tiên và dòng lịch sử đổi mức; Việc của tôi và Chờ tôi duyệt có cột Mức ưu tiên.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; test giao diện khai `// @vitest-environment jsdom` ở dòng đầu file; không đổi danh sách phụ thuộc, không sửa hook của repo.
