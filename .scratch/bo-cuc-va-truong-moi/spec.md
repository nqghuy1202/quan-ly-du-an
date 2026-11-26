# Spec: Bố cục mới, trang Tổng quan và trường quản lý cho Dự án, Task, nhân sự

**Status:** ready-for-agent

> Bản nháp chờ duyệt. Sinh từ buổi grill với chủ dự án (hai vòng, 17 câu, đều chấp nhận đáp án đề xuất). Chỗ nào chủ dự án chưa nói rõ thì nằm ở mục **Assumptions**. Spec này mở rộng `.scratch/quan-ly-du-an/spec.md`: ba vai hệ thống, quyền xem, ma trận chuyển trạng thái, Tiến độ, Trễ hạn và Dấu vết giữ nguyên. Riêng dòng "mức ưu tiên" ở mục Ngoài phạm vi của spec gốc được spec này thay thế.

## Từ vựng (bổ sung vào `GLOSSARY.md`)

| Từ | Nghĩa | Đừng viết |
|---|---|---|
| **Mã Dự án** | Mã ngắn, duy nhất của một Dự án, do PM hoặc Support đặt (vd `SDV-012`) | mã số, ID |
| **Khách hàng** | Khách hàng hoặc đơn vị mà Dự án phục vụ, chữ tự do | đối tác |
| **Người phụ trách** | Một Người trong dự án được ghi là đầu mối của Dự án. Chỉ để hiển thị và lọc, không thêm quyền | chủ dự án, owner |
| **Mức ưu tiên** | Thấp, Trung bình hoặc Cao. Có ở Dự án và ở Task | độ ưu tiên, priority |
| **Quá hạn dự kiến** | Dự án đang hoạt động đã qua Ngày kết thúc dự kiến mà Tiến độ chưa đủ 100%. Khác với **Trễ hạn** (của Task) | trễ hạn dự án |
| **Vai trò trong Dự án** | Chữ tự do mô tả việc một Người trong dự án đảm nhận ở Dự án đó (vd "Trưởng nhóm"). Không đổi quyền; khác với vai hệ thống | chức vụ dự án |
| **Thông tin nhân sự** | Số điện thoại, Chức danh, Phòng ban trong hồ sơ của một tài khoản | |
| **Tổng quan** | Trang đầu tiên sau khi đăng nhập, tóm tắt mọi Dự án và Task người đó được xem | dashboard |
| **Thanh bên** | Điều hướng chính nằm dọc bên trái | menu |
| **Ngăn trượt** | Khung mở từ bên phải, đè lên trang hiện tại, để xem hoặc nhập rồi đóng lại | popup |

## Vấn đề

Người dùng thấy hệ thống khó dùng vì ba lý do:

1. **Mọi thứ xếp theo một cột dọc.** Điều hướng là một hàng nút ở đầu trang. Trang chi tiết Dự án dồn thông tin, Người trong dự án, repo GitHub và toàn bộ Task vào một cột; trang chi tiết Task cũng vậy. Trang rất dài, phải cuộn nhiều, và mở một Task là rời khỏi bảng Kanban.
2. **Không có chỗ nắm tổng thể.** Trang Tổng quan hiện chỉ là hai bảng Dự án xếp chồng, không cho biết ngay hôm nay có bao nhiêu việc trễ, bao nhiêu việc đang chờ mình.
3. **Quá ít trường để quản lý.** Dự án chỉ có tên và mô tả; không biết của khách hàng nào, ai phụ trách, bao giờ xong, ưu tiên ra sao. Người trong dự án chỉ có tên và email; không biết họ làm vai trò gì, liên lạc bằng cách nào.

## Giải pháp

Làm hai đợt, đợt A trước.

**Đợt A, bố cục (không đổi dữ liệu).** Điều hướng chuyển sang **Thanh bên** chia nhóm rõ ràng. Đăng nhập xong vào trang **Tổng quan** mới: một hàng ô số, bảng Dự án kèm Tiến độ, danh sách Task Trễ hạn và sắp tới hạn, phân bố Task theo trạng thái. Trang chi tiết Dự án có dải tóm tắt ở đầu và chia **tab**. Xem Task, tạo Task, tạo Dự án, sửa Dự án đều làm trong **Ngăn trượt**, đóng lại là về đúng chỗ cũ.

**Đợt B, trường mới.** Dự án thêm Mã Dự án, Khách hàng, Người phụ trách, Ngày bắt đầu, Ngày kết thúc dự kiến, Mức ưu tiên, kèm cảnh báo Quá hạn dự kiến. Task thêm Mức ưu tiên. Hồ sơ thêm Thông tin nhân sự. Mỗi Người trong dự án có Vai trò trong Dự án. Trang Dự án tìm và lọc được theo các trường mới.

## User stories

### Thanh bên và khung ứng dụng
1. Là người dùng, tôi thấy Thanh bên bên trái với các nhóm Tổng quan, Công việc (Việc của tôi, Chờ tôi duyệt), Dự án (Dự án của tôi, Tất cả Dự án), để biết ngay hệ thống có những gì.
2. Là PM, tôi thấy thêm nhóm Quản trị với mục Người dùng; Support và Thành viên không thấy mục này.
3. Là Thành viên, tôi không thấy mục Tất cả Dự án (giữ đúng quyền hiện tại).
4. Là người dùng, tôi thấy mục đang mở được đánh dấu trên Thanh bên, để biết mình đang ở đâu.
5. Là người dùng, tôi thấy tên, vai hệ thống của mình cùng lối vào Hồ sơ và Đăng xuất gom ở một chỗ cố định.
6. Là người dùng, vừa đăng nhập xong tôi vào thẳng trang Tổng quan.
7. Là người dùng trên màn hẹp, Thanh bên thu lại thành một nút mở trình đơn, để nội dung có đủ chỗ.
8. Là người dùng bàn phím, tôi đi qua mọi mục của Thanh bên bằng phím Tab và thấy rõ viền focus.

### Trang Tổng quan
9. Là người dùng, tôi thấy hàng ô số: Dự án đang hoạt động, Task đang mở, Task Trễ hạn, Chờ tôi duyệt, Việc của tôi; mọi số chỉ tính trong các Dự án tôi được xem.
10. Là người dùng, tôi bấm ô "Chờ tôi duyệt" hoặc "Việc của tôi" để tới đúng trang đó.
11. Là người dùng, tôi thấy bảng Dự án đang hoạt động kèm Tiến độ và số Task Trễ hạn của từng Dự án, bấm một dòng để mở Dự án.
12. Là người dùng, tôi thấy danh sách Task Trễ hạn, Task trễ lâu nhất đứng đầu, kèm tên Dự án, Người thực hiện và hạn.
13. Là người dùng, tôi thấy danh sách Task tới hạn trong 7 ngày tới (chưa Hoàn thành, chưa Huỷ), để chuẩn bị trước.
14. Là người dùng, tôi bấm một Task trong hai danh sách trên để mở nó trong Ngăn trượt mà không rời trang Tổng quan.
15. Là người dùng, tôi thấy phân bố Task theo từng trạng thái (số lượng và thanh tỉ lệ), để biết việc đang dồn ở đâu.
16. Là người dùng chưa thuộc Dự án nào, tôi thấy trạng thái trống có lời giải thích; PM và Support thấy thêm nút tạo Dự án.
17. Là người dùng, khi Tổng quan đang tải tôi thấy chỉ báo tải; khi lỗi tôi thấy thông báo và nút Thử lại.
18. Là người dùng, tôi không còn thấy bảng Dự án đã Lưu trữ ở Tổng quan; PM và Support xem chúng ở trang Tất cả Dự án.
19. (Đợt B) Là người dùng, tôi thấy thêm ô số "Dự án Quá hạn dự kiến" và nhãn Quá hạn dự kiến trên dòng Dự án tương ứng.
20. (Đợt B) Là PM hoặc Support, tôi thấy dấu "chưa có Người phụ trách" trên Dự án đang hoạt động chưa có Người phụ trách.

### Trang chi tiết Dự án
21. Là người dùng, tôi thấy dải tóm tắt ở đầu: tên Dự án, trạng thái, Tiến độ, số Task Trễ hạn.
22. Là người dùng, tôi thấy các tab Task, Người trong dự án, Thông tin, GitHub; tab Task mở sẵn.
23. Là người dùng, ở tab Task tôi thấy bảng Kanban và bộ lọc như hiện nay, chiếm trọn chiều rộng.
24. Là người dùng, ở tab Người trong dự án tôi thấy danh sách người; PM và Support của Dự án thêm và gỡ người như hiện nay.
25. Là người dùng, ở tab Thông tin tôi thấy mô tả và Dấu vết; PM và Support của Dự án thấy nút sửa, Lưu trữ hoặc mở lại.
26. Là người dùng, ở tab GitHub tôi thấy repo đã gắn; PM và Support của Dự án gắn và gỡ repo như hiện nay.
27. Là người dùng, khi đổi tab tôi vẫn ở trong cùng Dự án và dải tóm tắt không đổi.
28. (Đợt B) Là người dùng, dải tóm tắt hiện thêm Mã Dự án, Khách hàng, Người phụ trách, Mức ưu tiên, Ngày bắt đầu, Ngày kết thúc dự kiến và nhãn Quá hạn dự kiến nếu có.

### Ngăn trượt
29. Là người dùng, tôi bấm một thẻ Task trên Kanban thì Task mở trong Ngăn trượt bên phải, bảng Kanban vẫn ở phía sau.
30. Là người dùng, trong Ngăn trượt của Task tôi thấy thông tin Task và các nút chuyển trạng thái tôi được phép ở phía trên, bên dưới là tab Lịch sử, Link GitHub, Sửa.
31. Là người dùng không có quyền sửa Task, tôi không thấy tab Sửa.
32. Là người dùng, tôi đóng Ngăn trượt bằng nút đóng hoặc phím Esc và trở lại đúng trang, đúng tab, đúng bộ lọc đang xem.
33. Là người dùng, sau khi chuyển trạng thái hoặc sửa Task trong Ngăn trượt, bảng Kanban và các số phía sau cập nhật theo.
34. Là PM hoặc Support, tôi tạo Task trong Ngăn trượt; lưu xong Ngăn trượt đóng và Task mới xuất hiện trên Kanban.
35. Là PM hoặc Support, tôi tạo Dự án và sửa thông tin Dự án trong Ngăn trượt.
36. Là người dùng, khi biểu mẫu trong Ngăn trượt có lỗi, lỗi hiện cạnh ô tương ứng và Ngăn trượt không tự đóng.
37. Là người dùng trên màn hẹp, Ngăn trượt chiếm cả màn hình.
38. Là người dùng bàn phím, khi Ngăn trượt mở thì focus vào trong ngăn; khi đóng thì focus trở lại chỗ đã bấm.
39. Là người dùng, tôi mở Task từ trang Việc của tôi và Chờ tôi duyệt cũng bằng Ngăn trượt.

### Trường mới của Dự án (đợt B)
40. Là PM hoặc Support, khi tạo Dự án tôi bắt buộc nhập Mã Dự án; các trường Khách hàng, Ngày bắt đầu, Ngày kết thúc dự kiến, Mức ưu tiên là tuỳ chọn.
41. Là PM hoặc Support, tôi nhập Mã Dự án sai dạng thì thấy lỗi giải thích dạng đúng (2 đến 12 ký tự gồm chữ in hoa, số, gạch nối).
42. Là PM hoặc Support, tôi nhập Mã Dự án đã có (kể cả khác hoa thường) thì bị từ chối với lời giải thích.
43. Là PM hoặc Support của Dự án, tôi sửa được Mã Dự án sau khi tạo.
44. Là người dùng, tôi thấy Mã Dự án đứng cạnh tên Dự án ở mọi nơi tên xuất hiện.
45. Là PM hoặc Support của Dự án, tôi chọn Người phụ trách từ danh sách Người trong dự án, hoặc để trống.
46. Là PM hoặc Support, tôi không chọn được người ngoài Dự án làm Người phụ trách.
47. Là người dùng, khi Người phụ trách bị gỡ khỏi Dự án thì ô Người phụ trách về trống.
48. Là Thành viên được ghi là Người phụ trách, tôi không có thêm quyền nào so với trước.
49. Là PM hoặc Support, tôi nhập Ngày kết thúc dự kiến trước Ngày bắt đầu thì bị từ chối với lời giải thích.
50. Là người dùng, tôi thấy nhãn Quá hạn dự kiến trên Dự án đang hoạt động đã qua Ngày kết thúc dự kiến mà Tiến độ chưa đủ 100%.
51. Là người dùng, tôi không thấy nhãn Quá hạn dự kiến trên Dự án đã Lưu trữ, Dự án chưa có Ngày kết thúc dự kiến, hoặc Dự án có Tiến độ 100%.
52. Là PM hoặc Support, Dự án mới có Mức ưu tiên Trung bình nếu tôi không chọn.
53. Là người dùng, sau mỗi lần sửa một trường mới của Dự án, Dấu vết ghi người sửa và thời điểm sửa.
54. Là người dùng, tôi không sửa được trường nào của Dự án đã Lưu trữ.
55. Là người dùng, Dự án có từ trước khi có trường mới mang mã tạm dạng `DA-001`, Mức ưu tiên Trung bình, các trường còn lại trống.

### Mức ưu tiên của Task (đợt B)
56. Là PM hoặc Support của Dự án, tôi chọn Mức ưu tiên khi tạo Task; không chọn thì là Trung bình.
57. Là PM hoặc Support của Dự án, tôi đổi Mức ưu tiên của Task chưa Hoàn thành và chưa Huỷ.
58. Là Người thực hiện hoặc Người kiểm tra có vai Thành viên, tôi không đổi được Mức ưu tiên.
59. Là người dùng, tôi thấy trong lịch sử Task một dòng ghi ai đổi Mức ưu tiên, lúc nào, từ mức nào sang mức nào.
60. Là người dùng, tôi thấy Mức ưu tiên trên thẻ Kanban và trong Ngăn trượt của Task.
61. Là người dùng, trong mỗi cột Kanban tôi thấy Task ưu tiên Cao đứng trước, rồi Trung bình, rồi Thấp; cùng mức thì hạn gần nhất đứng trước, Task không có hạn đứng sau.
62. Là người dùng, tôi lọc Kanban theo Mức ưu tiên, kết hợp được với các bộ lọc đang có.
63. Là người dùng, tôi thấy cột Mức ưu tiên ở trang Việc của tôi và Chờ tôi duyệt.

### Thông tin nhân sự và Vai trò trong Dự án (đợt B)
64. Là người dùng, tôi tự nhập và sửa Số điện thoại, Chức danh, Phòng ban ở trang Hồ sơ; cả ba đều tuỳ chọn.
65. Là người dùng, tôi nhập Số điện thoại sai dạng thì thấy lỗi giải thích dạng đúng.
66. Là người dùng, tôi thấy Thông tin nhân sự của người cùng ít nhất một Dự án với tôi.
67. Là Thành viên, tôi không thấy Thông tin nhân sự của người không cùng Dự án nào với tôi.
68. Là PM hoặc Support, tôi thấy Thông tin nhân sự của mọi tài khoản tôi xem được, nhưng không sửa hộ được.
69. Là PM hoặc Support của Dự án, tôi nhập Vai trò trong Dự án khi thêm người (tuỳ chọn) và sửa được sau.
70. Là Thành viên, tôi không sửa được Vai trò trong Dự án của bất kỳ ai.
71. Là người dùng, tôi không sửa được Vai trò trong Dự án ở Dự án đã Lưu trữ.
72. Là người dùng, ở tab Người trong dự án tôi thấy bảng: tên, Vai trò trong Dự án, Chức danh, Số điện thoại, số Task đang giữ (Task chưa Hoàn thành, chưa Huỷ mà người đó là Người thực hiện).
73. Là PM, ở trang Người dùng tôi thấy thêm cột Chức danh và Phòng ban.

### Tìm và lọc Dự án (đợt B)
74. Là người dùng, ở trang Dự án của tôi và Tất cả Dự án tôi thấy các cột: Mã, Tên, Khách hàng, Người phụ trách, Mức ưu tiên, Ngày kết thúc dự kiến, Tiến độ, Trễ hạn.
75. Là người dùng, tôi gõ vào ô tìm để lọc Dự án theo tên hoặc Mã Dự án, không phân biệt hoa thường và dấu.
76. Là người dùng, tôi lọc Dự án theo Mức ưu tiên, theo Người phụ trách và theo tình trạng (đang hoạt động, Lưu trữ, Quá hạn dự kiến); các bộ lọc kết hợp được với nhau.
77. Là người dùng, khi không Dự án nào khớp tôi thấy trạng thái trống và nút bỏ lọc.

## Quyết định triển khai

### Hai đợt, thứ tự cố định
- **Đợt A** chỉ đổi giao diện và thêm một lệnh đọc tổng hợp cho Tổng quan nếu các lệnh đọc hiện có chưa đủ. Không đổi mô hình dữ liệu, không cần migration. Làm và đáp xong đợt A rồi mới sang đợt B.
- **Đợt B** đổi mô hình dữ liệu. Mỗi lát gồm luật thuần, bản bộ nhớ của Kho dữ liệu, bộ test hợp đồng và giao diện (cổng kiểm được); bản Supabase và migration đi trong ticket riêng mà chủ dự án áp và kiểm tay.

### Khung ứng dụng và điều hướng
- Khung ứng dụng dựng bằng khung trang ứng dụng của Astryx có thanh bên và bản thu gọn cho màn hẹp; đọc tài liệu component và `astryx docs layout` trước khi đổi khung.
- Danh sách mục điều hướng và mục nào hiện với vai nào là dữ liệu do luật quyền quyết định (cùng chỗ luật đang dùng), không viết điều kiện rải trong giao diện.
- Trang mở đầu sau đăng nhập đổi từ Dự án của tôi sang Tổng quan.
- Giữ nguyên thương hiệu SDVICO (tên, logo, theme) ở khung mới.

### Trang Tổng quan
- Mọi số liệu tính bởi một hàm thuần nhận danh sách Dự án và Task người gọi được xem cùng ngày hôm nay (truyền vào), trả: các ô số, bảng Dự án đang hoạt động, Task Trễ hạn, Task tới hạn trong 7 ngày, số Task theo từng trạng thái. Giao diện chỉ hiển thị kết quả.
- "Task đang mở" là Task chưa Hoàn thành và chưa Huỷ, thuộc Dự án đang hoạt động. Task của Dự án đã Lưu trữ không vào ô số, danh sách hay phân bố.
- "Tới hạn trong 7 ngày" là Task đang mở có hạn từ hôm nay đến hết ngày thứ bảy kể từ hôm nay theo giờ Việt Nam; Task đã Trễ hạn không nằm trong danh sách này.
- Phân bố theo trạng thái hiển thị bằng thanh tiến độ có sẵn của Astryx, mỗi trạng thái một dòng kèm số. Không thêm thư viện biểu đồ.
- Kho dữ liệu cung cấp dữ liệu Tổng quan qua một lệnh đọc nhận danh tính người gọi và ngày hôm nay, đã áp quyền xem. Mở rộng lệnh tổng quan hiện có thay vì thêm lệnh song song.

### Trang chi tiết Dự án và Ngăn trượt
- Chi tiết Dự án: dải tóm tắt cố định ở trên, bên dưới là dải tab của Astryx với bốn tab. Các phần Người trong dự án, repo GitHub, Task giữ nguyên hành vi, chỉ đổi chỗ đứng.
- Ngăn trượt dùng component ngăn bên của Astryx. Xem Task, tạo Task, tạo Dự án, sửa Dự án dùng chung một kiểu ngăn. Nội dung chi tiết Task trong ngăn chia tab Lịch sử, Link GitHub, Sửa.
- Đóng Ngăn trượt không làm mất tab và bộ lọc của trang phía sau. Thay đổi trong ngăn làm trang phía sau đọc lại dữ liệu.
- Quyền hiện nút và tab trong ngăn vẫn lấy từ luật thuần như hiện nay.

### Mô hình dữ liệu (mô tả, không schema cứng)
- **Dự án** thêm: Mã Dự án (bắt buộc, duy nhất không phân biệt hoa thường, lưu dạng in hoa), Khách hàng (tuỳ chọn, tối đa 120 ký tự), Người phụ trách (tuỳ chọn, một tài khoản đang là Người trong dự án), Ngày bắt đầu và Ngày kết thúc dự kiến (tuỳ chọn, chỉ ngày, không giờ), Mức ưu tiên (Thấp, Trung bình, Cao; mặc định Trung bình).
- **Task** thêm: Mức ưu tiên (mặc định Trung bình).
- **Hồ sơ** thêm: Số điện thoại, Chức danh (tối đa 60 ký tự), Phòng ban (tối đa 60 ký tự); đều tuỳ chọn.
- **Người trong dự án** thêm: Vai trò trong Dự án (tuỳ chọn, tối đa 60 ký tự).
- **Lịch sử Task** nhận thêm loại dòng "đổi Mức ưu tiên" (người đổi, thời điểm, từ, sang), nằm cùng dòng thời gian với lịch sử trạng thái.

### Luật mới (thuần, không I/O)
- **Mã Dự án**: 2 đến 12 ký tự, chỉ chữ cái Latin in hoa không dấu, chữ số và gạch nối; đầu vào được cắt khoảng trắng và đổi sang in hoa trước khi kiểm. Trùng mã là lỗi có mã riêng, phân biệt với lỗi sai dạng.
- **Ngày của Dự án**: Ngày kết thúc dự kiến không trước Ngày bắt đầu khi cả hai cùng có.
- **Quá hạn dự kiến**: Dự án đang hoạt động, có Ngày kết thúc dự kiến, ngày đó trước ngày hôm nay theo giờ Việt Nam (ngày hôm nay truyền vào), và Tiến độ chưa đủ 100% (Dự án "chưa có task" vẫn tính là chưa đủ).
- **Người phụ trách**: phải là Người trong dự án tại thời điểm đặt; chỉ PM và Support của Dự án đặt hoặc bỏ; gỡ người đó khỏi Dự án thì Người phụ trách về trống trong cùng một lệnh. Không cấp thêm quyền.
- **Mức ưu tiên của Task**: đổi theo đúng quyền sửa Task hiện có (PM, Support của Dự án; Task chưa chốt; Dự án chưa Lưu trữ). Đổi sang đúng mức đang có thì không ghi lịch sử.
- **Thứ tự trong cột Kanban**: Mức ưu tiên Cao, Trung bình, Thấp; rồi hạn gần nhất trước, không hạn sau; rồi thứ tự hiện có.
- **Số điện thoại**: bỏ khoảng trắng, dấu chấm, gạch nối trước khi kiểm; hợp lệ khi là 10 chữ số bắt đầu bằng 0, hoặc `+84` theo sau 9 chữ số. Lưu dạng đã chuẩn hoá.
- **Quyền xem Thông tin nhân sự**: người gọi là chính chủ, là PM, là Support, hoặc cùng ít nhất một Dự án (kể cả Dự án đã Lưu trữ) với người kia. Không đủ quyền thì ba trường trả về trống, các trường khác của người đó không đổi.
- **Vai trò trong Dự án**: PM và Support của Dự án nhập và sửa; Dự án đã Lưu trữ thì từ chối.
- **Tìm Dự án**: khớp theo tên hoặc Mã Dự án, bỏ qua hoa thường và dấu tiếng Việt. Lọc theo Mức ưu tiên, Người phụ trách, tình trạng. Là hàm thuần chạy trên danh sách đã đọc.

### Kho dữ liệu
- Các lệnh tạo và sửa Dự án, tạo và sửa Task, sửa hồ sơ, thêm người vào Dự án nhận thêm trường mới; thêm lệnh sửa Vai trò trong Dự án. Mọi lệnh vẫn nhận danh tính người gọi và trả kết quả hoặc lỗi có mã.
- Danh sách Dự án trả đủ trường mới cùng Tiến độ, số Trễ hạn và cờ Quá hạn dự kiến để bảng không phải gọi thêm từng Dự án.
- Danh sách Người trong dự án trả thêm Vai trò trong Dự án, Thông tin nhân sự (đã áp quyền xem) và số Task đang giữ.
- Bảng ca dùng chung thêm các ca: quyền xem Thông tin nhân sự, quyền đặt Người phụ trách, quyền đổi Mức ưu tiên của Task, quyền sửa Vai trò trong Dự án.
- Dữ liệu mẫu của bản chạy thử được bổ sung trường mới để các màn có nội dung thật.

### Bản Supabase (chủ dự án áp và kiểm tay)
- Migration lên và xuống tương ứng cho từng nhóm trường. Migration gán cho Dự án có sẵn mã tạm `DA-001`, `DA-002`… theo thứ tự ngày tạo và Mức ưu tiên Trung bình; Task có sẵn nhận Mức ưu tiên Trung bình.
- Ràng buộc duy nhất của Mã Dự án (không phân biệt hoa thường) và quyền xem Thông tin nhân sự được ép ở phía cơ sở dữ liệu, khớp với luật thuần. Đổi Mức ưu tiên của Task ghi lịch sử ở phía cơ sở dữ liệu.
- Danh sách kiểm tay trong tài liệu Supabase thêm mục cho: quyền xem Thông tin nhân sự theo từng dòng, trùng Mã Dự án, Người phụ trách về trống khi bị gỡ.

### Chuẩn giao diện
- Giữ mọi luật Astryx của repo: dựng từ template hoặc component, không thẻ thô, không kiểu nội tuyến, màu và khoảng cách qua token, theme SDVICO.
- Mỗi màn và mỗi tab có đủ trạng thái trống, đang tải, lỗi. Mọi điều khiển có focus ring nhìn thấy được.
- Mức ưu tiên hiển thị bằng chữ kèm màu trạng thái; không dùng riêng màu để phân biệt.
- Ngày hiển thị theo múi giờ Việt Nam, dạng ngày/tháng/năm.

## Quyết định kiểm thử

- **Một test tốt chỉ kiểm hành vi nhìn thấy từ bên ngoài**: gọi lệnh vào Kho dữ liệu với một người gọi cụ thể rồi kiểm kết quả và những gì người khác thấy sau đó; hoặc render màn với bản bộ nhớ, thao tác như người dùng, kiểm những gì hiện ra. Không kiểm cách cài bên trong, không kiểm tên component.
- **Seam duy nhất vẫn là Kho dữ liệu.** Không thêm seam mới. Hành vi dữ liệu của đợt B vào bộ test hợp đồng dùng chung, chạy với bản bộ nhớ trong cổng; bản Supabase dùng cùng bộ test khi chủ dự án chạy tay.
- **Luật thuần** có test riêng theo bảng ca: Mã Dự án, ngày của Dự án, Quá hạn dự kiến, thứ tự Kanban, số điện thoại, quyền xem Thông tin nhân sự, tìm và lọc Dự án, số liệu Tổng quan. Ngày hôm nay luôn truyền vào.
- **Giao diện** test bằng Testing Library với bản bộ nhớ: Thanh bên hiện đúng mục theo vai; đăng nhập xong vào Tổng quan; ô số và danh sách Tổng quan đúng với dữ liệu đã dựng; đổi tab ở chi tiết Dự án; mở và đóng Ngăn trượt giữ nguyên tab và bộ lọc; biểu mẫu trong ngăn báo lỗi cạnh ô; trạng thái trống, đang tải, lỗi của từng màn mới.
- Test giao diện tìm phần tử theo vai trò và nhãn tiếng Việt mà người dùng thấy. Không kiểm bố cục theo điểm ảnh hay chiều rộng thật; bản thu gọn cho màn hẹp chỉ kiểm sự có mặt của nút mở trình đơn và các mục bên trong.
- Các test giao diện hiện có đang dựa vào hàng nút đầu trang hoặc trang chi tiết dọc được sửa theo bố cục mới trong cùng ticket đổi bố cục đó; hành vi chúng kiểm không được mất.
- **Ví dụ sẵn có để theo**: bộ test hợp đồng và bảng ca chuyển trạng thái, bảng ca quyền, test luật Tiến độ và Trễ hạn, test màn Tổng quan, test màn Kanban và kéo thả.
- Test không dùng mạng (kể cả localhost), DB, đồng hồ thật hay file ngoài repo. Không đổi danh sách phụ thuộc, không sửa hook.
- **Cổng không kiểm được, phải kiểm tay** (ticket liên quan ghi rõ): migration lên và xuống, bản Supabase với trường mới, quyền xem Thông tin nhân sự ở phía cơ sở dữ liệu, ràng buộc duy nhất của Mã Dự án, và cảm nhận thật về bố cục trên trình duyệt ở màn rộng và màn hẹp.

## Ngoài phạm vi

- Ngân sách, giai đoạn, hợp đồng, mốc (milestone), ước lượng giờ, nhãn, bình luận.
- Biểu đồ và mọi thư viện mới; xuất báo cáo, xuất Excel.
- Thông báo (email, Slack, Zalo).
- Danh bạ toàn hệ thống cho Thành viên; PM sửa hộ Thông tin nhân sự.
- Vai trò trong Dự án kéo theo quyền; danh mục vai trò chọn sẵn.
- Đổi ba vai hệ thống, quyền xem Dự án, ma trận chuyển trạng thái, cách tính Tiến độ và Trễ hạn.
- Lịch sử sửa từng trường của Dự án (Dấu vết vẫn chỉ lưu lần sửa gần nhất).
- Đường dẫn riêng cho từng trang trên thanh địa chỉ, nút lùi của trình duyệt.
- Đổi theme, màu, logo.
- Đưa ứng dụng lên mạng và áp migration (việc của chủ dự án).

## Further Notes

### Gợi ý lát cắt
- Đợt A: (1) Thanh bên và trang mở đầu; (2) Tổng quan mới; (3) chi tiết Dự án chia tab; (4) Task trong Ngăn trượt; (5) tạo và sửa trong Ngăn trượt.
- Đợt B: (6) Mã Dự án và Khách hàng; (7) ngày của Dự án và Quá hạn dự kiến; (8) Mức ưu tiên của Dự án và Người phụ trách; (9) Mức ưu tiên của Task; (10) Thông tin nhân sự; (11) Vai trò trong Dự án và bảng Người trong dự án; (12) tìm và lọc Dự án; (13) Tổng quan thêm số liệu đợt B; (14) các ticket bản Supabase và tài liệu kiểm tay.
- Các lát cùng sửa khung ứng dụng hoặc cùng một màn nên chạy lần lượt (độ song song 1) để tránh xung đột khi đáp.

### Việc của chủ dự án
- Khai báo repo này trên Bảng ticket AI (nhánh đích `main`, Lệnh test `npm test`) trước khi giao.
- Sau đợt A: mở ứng dụng trên trình duyệt ở màn rộng và màn hẹp, xác nhận bố cục đúng ý trước khi cho chạy đợt B.
- Sau đợt B: áp migration, chạy bộ test hợp đồng trên Supabase thật, làm các mục kiểm tay mới, rồi sửa mã tạm `DA-…` của Dự án cũ thành mã thật.

## Assumptions

Những điều chủ dự án chưa nói rõ, tôi chọn mặc định; sửa ở đây nếu sai.

- Chủ dự án chưa trả lời Supabase thật đã có dữ liệu hay chưa; cách gán mã tạm `DA-…` an toàn cho cả hai trường hợp.
- Độ dài: Khách hàng 120 ký tự; Chức danh, Phòng ban, Vai trò trong Dự án 60 ký tự.
- "Cùng Dự án" trong quyền xem Thông tin nhân sự tính cả Dự án đã Lưu trữ.
- Support xem Thông tin nhân sự của mọi tài khoản mà họ đã xem được tên và email theo quyền hiện có.
- Task của Dự án đã Lưu trữ không tính vào Tổng quan.
- Dự án "chưa có task" mà đã qua Ngày kết thúc dự kiến vẫn bị coi là Quá hạn dự kiến.
- Người kiểm tra không được tính vào "số Task đang giữ"; chỉ tính Task mà người đó là Người thực hiện.
- Trang Người dùng của PM chỉ thêm cột Chức danh và Phòng ban, không thêm Số điện thoại.
- Ứng dụng vẫn không có đường dẫn riêng cho từng trang; tải lại trình duyệt thì về Tổng quan.
