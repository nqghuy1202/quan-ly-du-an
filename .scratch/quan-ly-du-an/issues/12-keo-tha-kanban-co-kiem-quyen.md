# 12: Kéo thả Kanban có kiểm quyền

**What to build:** Người dùng kéo một thẻ Task sang cột khác trên bảng Kanban để đổi trạng thái. Thả thẻ đi qua đúng lệnh chuyển trạng thái của ticket 11, nên kết quả y hệt bấm nút: được phép thì thẻ sang cột mới và có lịch sử, không được phép thì thẻ về cột cũ kèm thông báo lý do. Thả vào cột cần lý do (Trả lại, Bị lỗi, Huỷ) thì mở hộp nhập lý do trước khi áp dụng; đóng hộp thì không đổi gì. Thẻ ở Hoàn thành và Huỷ không kéo ra được. Kéo thả chỉ là đường tắt: mọi bước vẫn làm được bằng nút trên chi tiết Task và bằng bàn phím. Dùng thư viện kéo thả đã cài sẵn từ lát 0; nếu chưa có thì dừng và báo, không tự thêm phụ thuộc.

**Blocked by:** 09, 11

**Status:** ready-for-agent

- [x] Thả thẻ vào cột đích hợp lệ với người được phép thì Task đổi trạng thái đúng, sinh một dòng lịch sử và thẻ hiện ở cột mới.
- [x] Thả vào cột mà bước đó không có trong ma trận hoặc người dùng không có quyền thì thẻ trở về cột cũ, dữ liệu không đổi và hiện thông báo tiếng Việt nêu lý do.
- [x] Thả vào Trả lại, Bị lỗi hoặc Huỷ mở hộp nhập lý do; gửi lý do hợp lệ thì áp dụng, đóng hộp hoặc để lý do trống thì không đổi gì và thẻ trở về cột cũ.
- [x] Thẻ ở Hoàn thành và Huỷ không kéo ra khỏi cột được, kể cả với PM.
- [x] Kết quả của kéo thả giống hệt dùng nút ở ticket 11 cho cùng người gọi, cùng bước và cùng lý do (test so sánh hai đường với nhiều ca, dùng bảng ca dùng chung).
- [x] Đổi cột được bằng bàn phím hoặc bằng nút, không phụ thuộc chuột; điều khiển dùng focus ring mặc định của Astryx, không đặt `outline: none`, và có test điều hướng bằng phím.
- [x] Có test tự động cho từng tiêu chí trên; nếu thư viện kéo thả không mô phỏng được trong môi trường test thì test hàm xử lý khi thả và ghi rõ trong ticket cách đã kiểm. Chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.

## Cách đã kiểm

- Thư viện kéo thả không cần: bảng dùng pointer events (mẫu của template `kanban-board`), mô phỏng được trong jsdom bằng `fireEvent.pointerDown/Move/Up` nên test đi thẳng qua giao diện (`src/giaoDien/ManKeoThaKanban.test.tsx`).
- Luật thả (thẻ nào kéo được, cột nào thả được, từ chối) ở `src/luat/keoThaKanban.ts`, chỉ gọi lại luật của ticket 11; test ở `src/luat/keoThaKanban.test.ts`.
- So sánh kéo thả với nút trên mọi ca của bảng ca dùng chung: `src/giaoDien/chuyenTheKanban.test.ts` (qua Kho bộ nhớ) và phần cuối của `ManKeoThaKanban.test.tsx` (qua giao diện, bốn loại người gọi, mọi bước của ma trận).
- Chỉ chuột và bút kéo được; cảm ứng dùng menu "Chuyển Task … sang cột khác" trên thẻ (cũng là đường bàn phím).
