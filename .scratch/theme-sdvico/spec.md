# Spec: Theme màu SDVICO cho hệ thống quản lý dự án

> Bản nháp chờ duyệt. Sinh từ buổi grill với chủ dự án (một vòng). Chỗ nào chưa được nói thì nằm ở mục **Assumptions**, không bịa thêm ở chỗ khác. Spec này là phần mở rộng của `.scratch/quan-ly-du-an/spec.md`: mọi hành vi nghiệp vụ giữ nguyên, chỉ đổi diện mạo.

## Từ vựng

| Từ | Nghĩa |
|---|---|
| **Theme SDVICO** | Bộ màu và kiểu của ứng dụng theo nhận diện của công ty SDVICO (website sdvico.vn) |
| **Màu chính** | Màu của nút chính, tiêu đề nhấn và thanh điều hướng đang chọn: xanh navy |
| **Màu nhấn** | Màu phụ dùng cho viền nhấn, liên kết, điểm nhấn trang trí: xanh ngọc |
| **Màu trạng thái** | Các màu báo thành công, cảnh báo, lỗi, thông tin; tách khỏi màu thương hiệu |
| **Chế độ sáng / tối** | Hai bảng màu của cùng một theme |

## Vấn đề

Hệ thống quản lý dự án (PM, Support, Thành viên cùng quản lý Dự án và Task) sẽ được công ty SDVICO dùng nội bộ. Giao diện hiện đang mang theme trung tính mặc định ở chế độ tối, không có dấu hiệu nào của SDVICO, nên nhân viên thấy đây là một công cụ chung chung chứ không phải công cụ của công ty.

## Giải pháp

Tạo **Theme SDVICO** theo màu thật của https://sdvico.vn/ và đặt làm theme mặc định của ứng dụng, giao diện mở ra ở **chế độ sáng**, có sẵn **chế độ tối** theo bảng màu tối của website. Tên "SDVICO" xuất hiện ở tiêu đề trang và màn đăng nhập, và logo SDVICO nằm ở đầu trang và màn đăng nhập khi chủ dự án cung cấp file logo. Không đổi bố cục, chữ, luồng hay luật nghiệp vụ nào.

## User stories

### Màu
1. Là nhân viên SDVICO, tôi mở ứng dụng thấy nền sáng, nút chính màu navy, điểm nhấn xanh ngọc giống website của công ty, để nhận ra đây là công cụ của công ty.
2. Là nhân viên, tôi đọc rõ chữ ở mọi màn (đăng nhập, khung ứng dụng, Dự án, Kanban, Tổng quan, chi tiết Task), vì chữ và nền đủ độ tương phản.
3. Là nhân viên dùng bàn phím, tôi thấy rõ viền focus ở mọi điều khiển, trên cả nền sáng lẫn nền tối.
4. Là nhân viên, tôi phân biệt được màu cảnh báo (ví dụ cờ Trễ hạn, trạng thái Bị lỗi) với màu thương hiệu, vì màu trạng thái giữ riêng và không trùng màu nút chính.
5. Là nhân viên thích nền tối, tôi chuyển sang chế độ tối và vẫn thấy đúng bảng màu SDVICO (nền navy rất đậm, nhấn xanh ngọc).

### Tên và logo
6. Là nhân viên, tôi thấy tên SDVICO ở thanh tiêu đề của tab trình duyệt và ở màn đăng nhập.
7. Là nhân viên, tôi thấy logo SDVICO ở đầu màn đăng nhập và ở khung ứng dụng sau khi đăng nhập (chỉ khi có file logo, xem Assumptions).

## Quyết định triển khai

### Bảng màu (đọc từ website, chủ dự án có thể sửa khi duyệt)
- Màu chính: xanh navy, xấp xỉ `#0B3865`.
- Màu nhấn: xanh ngọc, xấp xỉ `#0FAEBD`.
- Màu công nghệ phụ (nếu cần cho thông tin): xanh dương sáng, xấp xỉ hsl 207 82% 55%.
- Nền sáng: xám rất nhạt xấp xỉ `#F5F7F9`; chữ chính xấp xỉ `#0D1A26`.
- Chế độ tối: nền navy rất đậm (hsl 210 50% 6%), chữ xám nhạt, màu chính chuyển sang xanh ngọc như website.
- Màu cam `#F98C10` của nút kêu gọi trên website **không** dùng làm màu nút chính của ứng dụng (chủ dự án đã chọn navy); cam chỉ được dùng nếu trình soạn theme sinh ra nó cho màu cảnh báo.

### Cách làm
- Dựng bằng trình soạn theme của Astryx (một theme mới tên `sdvico` kế thừa theme trung tính), rồi nối vào ứng dụng bằng lệnh nạp theme của Astryx. Không sửa tay file sinh tự động, không ghi đè biến màu rải rác, không `className`, không `style`, không màu hex hay `px` rời trong mã giao diện (đã có ESLint chặn).
- Theme mặc định của ứng dụng đổi từ trung tính sang SDVICO; chế độ mặc định là sáng.
- Không thêm gói phụ thuộc nào, không đổi `package.json` hay lockfile.
- Xấp xỉ màu nghĩa là: khi trình soạn theme sinh ra các sắc sáng, tối từ một màu gốc, sai khác nhỏ so với giá trị trên là chấp nhận được, miễn là vẫn đúng họ màu và đạt các ngưỡng tương phản bên dưới.

### Tương phản và focus
- Chữ thường so với nền của nó: tỉ lệ tương phản tối thiểu 4,5 trên 1; chữ lớn và các thành phần giao diện (viền ô nhập, biểu tượng): tối thiểu 3 trên 1.
- Viền focus: tối thiểu 3 trên 1 so với nền kề, ở cả hai chế độ. Xanh ngọc gốc trên nền trắng đạt khoảng 2,7 trên 1, **không đủ**, nên xanh ngọc chỉ được dùng cho trang trí, không dùng làm màu chữ trên nền sáng; viền focus ở chế độ sáng dùng sắc đậm hơn đạt ngưỡng.
- Mọi điều khiển giữ focus ring mặc định nhìn thấy được; không đặt `outline: none`.

### Tên và tiêu đề
- Tên hiển thị đề xuất: "Quản lý dự án SDVICO". Xuất hiện ở tiêu đề tab trình duyệt và màn đăng nhập. Tên cụ thể chờ chủ dự án duyệt.

### Logo
- Logo nằm ở đầu màn đăng nhập và đầu khung ứng dụng, có văn bản thay thế "SDVICO" cho người dùng đọc màn hình.
- Chỉ làm khi chủ dự án đã đưa file logo vào repo; không tải logo từ website.

## Quyết định kiểm thử

Tất cả kiểm được bằng lệnh test của repo, không cần mạng, DB hay file ngoài repo.

- **Giá trị theme:** test đọc theme SDVICO đã dựng và khẳng định màu chính, màu nhấn, nền, chữ của hai chế độ nằm trong sai số cho phép quanh bảng màu trên.
- **Tương phản:** test tính tỉ lệ tương phản bằng hàm thuần cho các cặp (chữ trên nền, chữ trên màu chính, viền focus trên nền) ở cả hai chế độ và khẳng định đạt ngưỡng.
- **Theme mặc định:** test hiển thị ứng dụng và khẳng định theme SDVICO đang được dùng, chế độ mặc định là sáng.
- **Không còn màu rời:** test quét mã giao diện và khẳng định không có mã màu hex hay giá trị `px` rời (bổ sung cho ESLint), và không có `outline: none`.
- **Tên:** test khẳng định tiêu đề trang và màn đăng nhập có tên SDVICO.
- **Logo (khi có file):** test khẳng định logo có mặt ở màn đăng nhập và khung ứng dụng, có văn bản thay thế "SDVICO".
- **Không vỡ chỗ cũ:** toàn bộ test hiện có vẫn xanh.
- **Kiểm bằng mắt (cổng không kiểm được):** chủ dự án mở ứng dụng ở cả hai chế độ, so với sdvico.vn và xác nhận màu "đúng chất SDVICO" ở các màn chính. Danh sách màn: đăng nhập, Dự án của tôi, Kanban, Tổng quan, chi tiết Task, hộp nhập lý do.

## Ngoài phạm vi

- Đổi phông chữ (chủ dự án chọn giữ phông hiện tại; website dùng Plus Jakarta Sans, để làm sau nếu muốn).
- Giới hạn đăng ký chỉ email `@sdvico.vn`, tắt tự đăng ký, tên miền và mọi việc khác của "dùng nội bộ": mỗi việc một spec riêng.
- Đổi bố cục, chữ trên giao diện, luồng, luật nghiệp vụ, mô hình dữ liệu.
- Một chế độ "theo máy người dùng": chủ dự án chọn mặc định sáng, có sẵn bản tối để chuyển tay.
- Trang kêu gọi, ảnh nền, hoạ tiết hay hiệu ứng riêng của website.

## Further Notes

### Lát cắt đề xuất (để chia ticket)
1. **Theme SDVICO sáng và tối, nối vào ứng dụng, mặc định sáng**: gồm kiểm giá trị màu, tương phản, focus và "không còn màu rời". Tự đứng được, không cần quyết định thêm.
2. **Tên SDVICO ở tiêu đề trang và màn đăng nhập**: cần chủ dự án duyệt tên hiển thị trước khi `ready-for-agent`.
3. **Logo SDVICO ở màn đăng nhập và khung ứng dụng**: chờ file logo, chưa `ready-for-agent` cho tới khi có.

### Assumptions (chưa được nói rõ, chờ duyệt)
- **Tên hiển thị** "Quản lý dự án SDVICO" là đề xuất của tôi, chủ dự án chưa nói.
- **File logo** chưa có. Ticket logo bị giữ lại cho tới khi chủ dự án đưa file (và nói chỗ để file).
- **Giá trị màu** lấy từ biến CSS của website vào thời điểm viết spec; nếu SDVICO có bộ nhận diện chính thức (mã màu in trên tài liệu thương hiệu) khác website thì chủ dự án nói để sửa.
- **Bản tối** đi theo bảng màu tối của website, chưa được chủ dự án nhìn thấy trên ứng dụng này.
- **Màu trạng thái** (thành công, cảnh báo, lỗi, thông tin) giữ như theme hiện tại, chưa thiết kế lại theo SDVICO.
