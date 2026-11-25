# 05: Người trong dự án và quyền xem theo vai

**What to build:** PM hoặc Support của một Dự án thêm người vào Dự án bằng email, và gỡ người ra. Người được thêm phải đã đăng ký; email chưa có tài khoản thì báo "chưa đăng ký", hệ thống không gửi thư mời. "Support của dự án" nghĩa là Support nằm trong danh sách người trong dự án. Từ ticket này, Support của dự án cũng sửa tên, mô tả, Lưu trữ và mở lại được Dự án của mình, và quyền xem được chốt: PM thấy mọi Dự án, Support và Thành viên chỉ thấy Dự án mình ở trong, người lạ không thấy gì và mở thẳng một Dự án không thuộc về mình thì nhận "không tìm thấy" (không lộ rằng Dự án tồn tại). Ticket này cũng dựng **bảng ca dùng chung** cho quyền: mỗi dòng gồm vai hệ thống, có ở trong Dự án hay không, hành động và kết quả mong đợi. Bản cài bộ nhớ chạy hết các dòng; bản Supabase sẽ dùng lại đúng bảng này.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] PM hoặc Support của Dự án thêm người bằng email đã đăng ký thì người đó vào danh sách; email chưa đăng ký trả lỗi `CHUA_DANG_KY` kèm thông báo "chưa đăng ký"; người đã trong Dự án trả lỗi `DA_TRONG_DU_AN`.
- [ ] PM hoặc Support của Dự án gỡ một người ra khỏi Dự án; gỡ người không ở trong Dự án trả lỗi không tìm thấy.
- [ ] Support không nằm trong danh sách của Dự án, và Thành viên, thêm hoặc gỡ người, sửa hay Lưu trữ Dự án đó đều trả lỗi `KHONG_CO_QUYEN`; PM làm được ở mọi Dự án.
- [ ] Thêm hoặc gỡ người trên Dự án đã Lưu trữ trả lỗi `DU_AN_DA_LUU_TRU`.
- [ ] Danh sách Dự án và chi tiết Dự án: PM thấy tất cả; Support và Thành viên chỉ thấy Dự án mình ở trong; người chưa ở Dự án nào nhận danh sách rỗng; mở thẳng Dự án không thuộc về mình trả lỗi không tìm thấy.
- [ ] Danh sách người trong dự án hiện tên, email và vai hệ thống của từng người; gỡ một người không ảnh hưởng tài khoản hay hồ sơ của họ.
- [ ] Bảng ca dùng chung cho quyền (vai, có trong Dự án hay không, hành động, kết quả mong đợi) tồn tại dưới dạng dữ liệu và bản cài bộ nhớ chạy qua mọi dòng của nó, bao phủ cả các quyền của ticket 03 và 04.
- [ ] Màn thêm và gỡ người dựng từ Astryx, đủ trạng thái trống, đang tải và lỗi; nút bị ẩn hoặc vô hiệu kèm lý do khi người dùng không có quyền.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
