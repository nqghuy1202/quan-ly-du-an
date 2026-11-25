# 11: Ma trận chuyển trạng thái, lịch sử và bộ đếm Trả lại

**What to build:** Task đi qua vòng trạng thái đúng ma trận của spec. Người thực hiện: Mới sang Đang làm, Đang làm sang Chờ duyệt, Trả lại sang Đang làm. Người kiểm tra: Chờ duyệt sang Hoàn thành, Trả lại hoặc Bị lỗi. PM và Support (Support là Support của chính Dự án) làm được mọi bước trên, cộng đưa Bị lỗi về Đang làm và Huỷ Task ở bất kỳ trạng thái chưa cuối nào. Trả lại, Bị lỗi và Huỷ bắt buộc có lý do. Hoàn thành và Huỷ là trạng thái cuối, không đi tiếp. Mỗi lần đổi lưu một dòng lịch sử (ai, lúc nào, từ đâu sang đâu, lý do) và hiện theo thứ tự thời gian trên chi tiết Task; Trả lại tăng bộ đếm. Một lần đổi trạng thái cũng được tính là một lần chỉnh sửa nên cập nhật người chỉnh sửa gần nhất và ngày chỉnh sửa gần nhất. Luật nằm ở một chỗ thuần dùng chung cho Kho dữ liệu và giao diện; bảng ca dùng chung của ticket 05 được mở rộng với mọi dòng của ma trận.

**Blocked by:** 08

**Status:** ready-for-agent

- [ ] Mọi bước trong ma trận chạy đúng với người được phép: Người thực hiện, Người kiểm tra, Support của Dự án và PM, theo bảng của spec; Dự án Lưu trữ trả lỗi `DU_AN_DA_LUU_TRU`.
- [ ] Bước không có trong ma trận trả lỗi `BUOC_KHONG_HOP_LE`; bước có trong ma trận nhưng người gọi không được làm (ví dụ Người thực hiện tự duyệt, Người kiểm tra bắt đầu việc, Support ngoài Dự án, Thành viên khác) trả lỗi `KHONG_CO_QUYEN`; trạng thái không đổi trong mọi trường hợp lỗi.
- [ ] Trả lại, Bị lỗi và Huỷ thiếu lý do (rỗng hoặc chỉ khoảng trắng) trả lỗi `LY_DO_BAT_BUOC`; có lý do thì lý do được lưu trong lịch sử.
- [ ] Hoàn thành và Huỷ không đổi tiếp được: mọi bước từ hai trạng thái này trả lỗi `TASK_DA_CHOT`.
- [ ] Bị lỗi chỉ được PM hoặc Support đưa về Đang làm hoặc Huỷ; Người thực hiện và Người kiểm tra không làm được.
- [ ] Mỗi lần đổi ghi đúng một dòng lịch sử gồm người đổi, thời điểm (đồng hồ truyền vào), trạng thái cũ, trạng thái mới và lý do; chi tiết Task hiện lịch sử theo thứ tự thời gian tăng dần.
- [ ] Mỗi lần Trả lại tăng bộ đếm đúng 1 và các bước khác không đổi bộ đếm; chi tiết Task hiện số lần bị Trả lại.
- [ ] Mỗi lần đổi trạng thái cập nhật người chỉnh sửa gần nhất và ngày chỉnh sửa gần nhất; lần đổi bị từ chối không cập nhật gì.
- [ ] Bảng ca dùng chung có đủ các dòng của ma trận (từng bước, từng loại người gọi, kết quả mong đợi) và bản cài bộ nhớ qua hết các dòng.
- [ ] Trên chi tiết Task chỉ hiện các nút bước mà người dùng làm được; bước cần lý do mở hộp nhập lý do trước khi áp dụng, hộp không cho gửi khi lý do trống; khi bị từ chối thì hiện lý do bằng tiếng Việt. Màn dựng từ Astryx, đủ trạng thái trống, đang tải và lỗi.
- [ ] Có test tự động cho từng tiêu chí trên (Task ở trạng thái bất kỳ được dựng sẵn trong bản cài bộ nhớ), chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
