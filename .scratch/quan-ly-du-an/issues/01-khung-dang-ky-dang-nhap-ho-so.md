# 01: Khung ứng dụng, đăng ký, đăng nhập và hồ sơ

**What to build:** Người mới mở ứng dụng thấy màn đăng nhập và đăng ký bằng tiếng Việt. Đăng ký bằng email, mật khẩu và tên hiển thị thì có hồ sơ với vai Thành viên. Đăng nhập xong vào khung ứng dụng dựng từ Astryx (theme neutral), tên và vai của mình hiện ở một chỗ cố định, có nút đăng xuất. Người dùng sửa được tên hiển thị và điền GitHub username của mình. Người chưa ở dự án nào thấy màn trống hướng dẫn nhờ PM hoặc Support thêm vào. Ticket này cũng dựng **Kho dữ liệu**: giao diện lưu trữ duy nhất mà phần còn lại của ứng dụng dùng, mọi lệnh nhận danh tính người gọi và trả kết quả hoặc một lỗi có mã. Có bản cài bộ nhớ, và một bộ test hợp đồng dùng chung để mọi bản cài sau này chạy lại cùng bộ. Ở ticket này đăng ký xong đăng nhập được ngay; xác nhận email thêm ở ticket 02. Điều kiện: khung dự án (lát 0) đã có trên nhánh đích.

**Blocked by:** None

**Status:** ready-for-agent

- [ ] Đăng ký với email hợp lệ, mật khẩu ít nhất 8 ký tự và tên hiển thị không rỗng thì tạo hồ sơ vai Thành viên.
- [ ] Email đã dùng (không phân biệt hoa thường) trả lỗi có mã `EMAIL_DA_DUNG`. Email sai định dạng, mật khẩu ngắn hơn 8 ký tự hoặc tên rỗng (kể cả chỉ toàn khoảng trắng) bị từ chối ở ranh giới kèm thông báo tiếng Việt, không tạo gì.
- [ ] Đăng nhập đúng thì có phiên; sai mật khẩu hoặc email chưa đăng ký trả cùng một lỗi chung, không lộ email có tồn tại hay không. Đăng xuất thì hết phiên.
- [ ] Người gọi chưa đăng nhập gọi lệnh cần danh tính trả lỗi `CHUA_DANG_NHAP`.
- [ ] Sửa tên hiển thị và GitHub username (tuỳ chọn, phải đúng định dạng username của GitHub, cho phép để trống để xoá) chỉ áp dụng được cho hồ sơ của chính mình; sửa hồ sơ người khác trả lỗi `KHONG_CO_QUYEN` và dữ liệu không đổi.
- [ ] Sau khi đăng nhập thấy tên và vai ở khung ứng dụng; người chưa ở dự án nào thấy màn trống nói rõ "bạn chưa ở dự án nào, hãy nhờ PM hoặc Support thêm bạn".
- [ ] Mọi màn mới dựng từ component hoặc template Astryx, không thẻ `div` hay `span` thô, không `className` hay `style` nội tuyến, không màu hex hay `px` rời (ESLint của repo chặn các lỗi này, `npm run lint` phải sạch); có đủ trạng thái trống, đang tải và lỗi; mọi điều khiển đi tới và dùng được bằng phím Tab (có test điều hướng bằng phím), dùng focus ring mặc định của Astryx và không đặt `outline: none`.
- [ ] Bộ test hợp đồng của Kho dữ liệu tách riêng để bản cài khác chạy lại; test giao diện render với bản cài bộ nhớ.
- [ ] Có test tự động cho từng tiêu chí trên, chạy bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo; không đổi danh sách phụ thuộc, không sửa hook của repo.
