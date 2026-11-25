# Spec: Quản lý dự án cho PM và Support

> Bản nháp chờ duyệt. Sinh từ buổi grill ba vòng với chủ dự án. Chỗ nào chưa được nói thì nằm ở mục **Assumptions**, không bịa thêm ở chỗ khác.

## Từ vựng (sẽ thành `GLOSSARY.md` ở lát 0)

| Từ | Nghĩa |
|---|---|
| **Dự án** | Một đầu việc lớn có nhiều Task, nhiều người cùng làm, gắn 0 đến nhiều repo GitHub |
| **Task** | Một việc cụ thể trong một Dự án. Luôn viết "Task" |
| **Người thực hiện** | Người được giao làm Task. Mỗi Task có đúng một |
| **Người kiểm tra** | Người đánh giá kết quả Task. Mỗi Task có đúng một, khác Người thực hiện |
| **Người trong dự án** | Tài khoản đã được thêm vào một Dự án. (Khác với vai hệ thống **Thành viên**, xem dưới) |
| **PM / Support / Thành viên** | Ba vai hệ thống của một tài khoản |
| **Chờ duyệt** | Người thực hiện báo đã làm xong, đang đợi Người kiểm tra |
| **Hoàn thành** | Người kiểm tra chấp nhận kết quả. Trạng thái cuối |
| **Trả lại** | Kết quả chưa đạt, phải làm tiếp, giữ nguyên Task, có lý do |
| **Bị lỗi** | Kết quả hỏng hẳn, cần PM hoặc Support quyết định tiếp, có lý do |
| **Huỷ** | Task không làm nữa. Trạng thái cuối, có lý do |
| **Lưu trữ** | Dự án ngừng hoạt động, chỉ xem |
| **Dấu vết** | Người tạo, ngày tạo, người chỉnh sửa gần nhất, ngày chỉnh sửa gần nhất |
| **Tiến độ** | Phần trăm Task Hoàn thành của một Dự án |
| **Trễ hạn** | Task có hạn đã qua mà chưa Hoàn thành và chưa Huỷ |

## Vấn đề

PM và Support đang nắm nhiều dự án cùng lúc. Họ không có một chỗ duy nhất để thấy dự án nào tiến tới đâu, việc nào đang kẹt, ai đang giữ việc nào. Việc chia task, xem người thực hiện đã xong chưa, và quyết định kết quả là đạt, phải làm lại hay hỏng đều rải rác trong tin nhắn và bảng tính. Không ai biết ai sửa gì lúc nào. Task cũng không gắn với issue hay PR trên GitHub, nên PM phải mở từng repo để xem.

## Giải pháp

Một web nhiều người dùng bằng tiếng Việt. Ai cũng có tài khoản. PM tạo Dự án và thêm người vào. PM hoặc Support chia Task cho một Người thực hiện và một Người kiểm tra. Task đi qua một vòng trạng thái rõ ràng: Người thực hiện làm và báo Chờ duyệt, Người kiểm tra quyết định Hoàn thành, Trả lại hoặc Bị lỗi. Mọi thay đổi trạng thái đều lưu lại ai, lúc nào, vì sao. Trang tổng quan cho PM thấy tiến độ từng Dự án và cờ Trễ hạn. Mỗi Dự án gắn được repo GitHub, mỗi Task dán được link issue hoặc PR để hiện trạng thái hiện tại, chỉ đọc.

## User stories

### Tài khoản và hồ sơ
1. Là người mới, tôi muốn tự đăng ký bằng email, mật khẩu và tên hiển thị, để vào dùng mà không phải chờ ai tạo hộ.
2. Là người mới, tôi muốn xác nhận email sau khi đăng ký, để không ai dùng email của tôi mạo danh.
3. Là người dùng, tôi muốn đăng nhập và đăng xuất, để tài khoản của tôi không bị người khác dùng trên máy chung.
4. Là người dùng quên mật khẩu, tôi muốn đặt lại qua email, để không bị khoá tài khoản.
5. Là người dùng, tôi muốn sửa tên hiển thị và điền GitHub username của mình, để mọi người nhận ra tôi và đối chiếu được với GitHub.
6. Là Thành viên mới đăng ký, tôi muốn thấy một màn trống nói rõ "bạn chưa ở trong dự án nào, hãy nhờ PM hoặc Support thêm bạn", để biết phải làm gì tiếp.
7. Là người dùng đang dùng, tôi muốn thấy tên và vai của mình ở một chỗ cố định, để biết mình đang đăng nhập đúng tài khoản.

### Vai và quyền
8. Là PM, tôi muốn nâng một tài khoản lên Support hoặc PM, hoặc hạ về Thành viên, để phân việc đúng người.
9. Là PM, tôi muốn hệ thống luôn giữ ít nhất một PM, để không ai làm mất quyền quản trị của cả hệ thống.
10. Là Support, tôi muốn chỉ thấy và quản lý các Dự án tôi được thêm vào, để không đụng việc của người khác.
11. Là Thành viên, tôi muốn chỉ thấy các Dự án tôi được thêm vào, để không lộ việc của người khác.
12. Là người lạ vừa đăng ký, tôi không thấy được gì của ai, để dữ liệu của PM an toàn dù đăng ký đang mở.

### Dự án
13. Là PM, tôi muốn tạo Dự án với tên và mô tả, để bắt đầu quản lý một đầu việc mới.
14. Là PM hoặc Support của Dự án, tôi muốn sửa tên và mô tả Dự án, để nội dung luôn đúng.
15. Là PM hoặc Support của Dự án, tôi muốn thêm người vào Dự án bằng email, để họ nhận được Task.
16. Là PM hoặc Support, tôi muốn được báo "chưa đăng ký" khi nhập email chưa có tài khoản, để biết phải bảo người đó đăng ký trước.
17. Là PM hoặc Support, tôi muốn gỡ một người khỏi Dự án, để người đã nghỉ không còn thấy việc.
18. Là PM hoặc Support, tôi muốn thấy danh sách Task mà người sắp bị gỡ đang giữ, để giao lại trước khi gỡ.
19. Là PM, tôi muốn gán một Support vào Dự án, để người đó quản lý Dự án thay tôi.
20. Là PM hoặc Support, tôi muốn Lưu trữ một Dự án đã xong, để nó không còn chiếm chỗ nhưng vẫn xem lại được.
21. Là PM, tôi muốn mở lại một Dự án đã Lưu trữ, để làm tiếp khi cần.
22. Là người trong dự án, tôi muốn xem Dự án đã Lưu trữ ở chế độ chỉ xem, để tra cứu việc cũ.
23. Là PM, tôi muốn xem người tạo, ngày tạo, người sửa gần nhất và ngày sửa gần nhất của từng Dự án, để biết ai chịu trách nhiệm.

### Task: tạo và giao việc
24. Là PM hoặc Support, tôi muốn tạo Task với tiêu đề, mô tả và hạn tuỳ chọn, để ghi lại việc cần làm.
25. Là PM hoặc Support, tôi muốn chọn một Người thực hiện và một Người kiểm tra từ những người trong Dự án khi tạo Task, để ai cũng biết mình chịu trách nhiệm phần nào.
26. Là PM hoặc Support, tôi muốn bị chặn khi chọn cùng một người làm cả Người thực hiện lẫn Người kiểm tra, để không tự duyệt việc của mình.
27. Là PM hoặc Support, tôi muốn sửa tiêu đề, mô tả và hạn của Task chưa ở trạng thái cuối, để cập nhật khi yêu cầu đổi.
28. Là PM hoặc Support, tôi muốn đổi Người thực hiện hoặc Người kiểm tra của Task chưa ở trạng thái cuối, để giao lại khi người cũ không làm được.
29. Là PM hoặc Support, tôi muốn chỉ chọn được người đang ở trong Dự án làm Người thực hiện hay Người kiểm tra, để không giao nhầm người ngoài.
30. Là người trong dự án, tôi muốn xem người tạo, ngày tạo, người sửa gần nhất và ngày sửa gần nhất của Task, để biết ai đã động vào.
31. Là người trong dự án, tôi muốn xem Task của Dự án trên bảng Kanban theo cột trạng thái, để nắm việc nhanh.
32. Là người trong dự án, tôi muốn lọc Task theo Người thực hiện, Người kiểm tra và trạng thái, để tìm đúng việc.
33. Là Người thực hiện, tôi muốn có một chỗ liệt kê mọi Task của tôi qua các Dự án, để biết hôm nay phải làm gì.
34. Là Người kiểm tra, tôi muốn có một chỗ liệt kê mọi Task đang Chờ duyệt giao cho tôi, để duyệt không sót.

### Task: vòng trạng thái
35. Là Người thực hiện, tôi muốn chuyển Task từ Mới sang Đang làm, để mọi người biết tôi đã bắt đầu.
36. Là Người thực hiện, tôi muốn chuyển Task từ Đang làm sang Chờ duyệt, để Người kiểm tra biết đến lượt họ.
37. Là Người kiểm tra, tôi muốn chuyển Task Chờ duyệt sang Hoàn thành, để đóng việc đã đạt.
38. Là Người kiểm tra, tôi muốn chuyển Task Chờ duyệt sang Trả lại kèm lý do bắt buộc, để Người thực hiện biết cần sửa gì.
39. Là Người kiểm tra, tôi muốn chuyển Task Chờ duyệt sang Bị lỗi kèm lý do bắt buộc, để báo kết quả hỏng cho PM hoặc Support quyết định.
40. Là Người thực hiện, tôi muốn chuyển Task đã bị Trả lại về Đang làm, để làm lại.
41. Là PM hoặc Support, tôi muốn đưa Task Bị lỗi về Đang làm (giao lại), để việc được làm tiếp.
42. Là PM hoặc Support, tôi muốn Huỷ Task chưa ở trạng thái cuối kèm lý do bắt buộc, để việc không còn cần thì khỏi tính vào tiến độ.
43. Là PM hoặc Support, tôi muốn thực hiện được mọi bước chuyển hợp lệ thay người khác, để không bị kẹt khi họ vắng.
44. Là người dùng, tôi muốn bị từ chối rõ ràng, kèm lý do, khi tôi làm một bước mình không có quyền hoặc không hợp lệ, để hiểu vì sao.
45. Là người dùng, tôi muốn thấy Task Hoàn thành và Huỷ không đổi được nữa, để kết quả đã chốt không bị lật lại.
46. Là người trong dự án, tôi muốn xem lịch sử trạng thái của Task gồm ai đổi, lúc nào, từ đâu sang đâu và lý do, để lần lại được diễn biến.
47. Là người trong dự án, tôi muốn thấy Task đã bị Trả lại bao nhiêu lần, để biết việc nào hay phải làm lại.
48. Là người dùng, tôi muốn kéo thẻ Task sang cột khác trên Kanban để đổi trạng thái, và bị từ chối rõ ràng nếu bước đó không được phép, để thao tác nhanh mà không phá luật.

### Tiến độ và cảnh báo
49. Là PM, tôi muốn một trang tổng quan liệt kê mọi Dự án với Tiến độ và số Task theo từng trạng thái, để nắm tình hình ngay khi mở.
50. Là PM, tôi muốn thấy cờ Trễ hạn ở Dự án có Task quá hạn chưa Hoàn thành, để ưu tiên xử lý.
51. Là PM hoặc Support, tôi muốn thấy Task nào đang Trễ hạn ở chính Dự án đó, để nhắc đúng người.
52. Là Support, tôi muốn trang tổng quan chỉ có các Dự án tôi quản lý, để không bị rối.
53. Là Thành viên, tôi muốn trang tổng quan chỉ có các Dự án tôi ở trong, cùng Task của tôi, để biết phần mình.
54. Là PM, tôi muốn Task Huỷ không bị tính vào mẫu số của Tiến độ, để phần trăm phản ánh đúng việc còn phải làm.
55. Là PM, tôi muốn Dự án chưa có Task nào hiện "chưa có task" thay vì 0%, để không hiểu nhầm là dự án đứng yên.

### GitHub (chỉ đọc)
56. Là PM hoặc Support, tôi muốn gắn một hay nhiều repo GitHub vào Dự án bằng tên dạng chủ-sở-hữu/tên-repo, để Task của Dự án trỏ được tới đó.
57. Là PM hoặc Support, tôi muốn gỡ một repo khỏi Dự án, để không còn liên kết thừa.
58. Là người trong dự án, tôi muốn dán link issue hoặc PR vào Task, để thấy việc này ứng với đâu trên GitHub.
59. Là người trong dự án, tôi muốn bị từ chối khi dán link thuộc repo chưa gắn vào Dự án, để không trỏ lung tung.
60. Là người trong dự án, tôi muốn thấy trạng thái hiện tại của issue (mở hoặc đóng) và của PR (mở, đã merge hoặc đóng) ngay trên Task, để khỏi mở GitHub.
61. Là người trong dự án, tôi muốn thấy thông báo rõ khi không đọc được GitHub (repo riêng tư mà token không thấy, hết lượt gọi, sai link, mất mạng), và phần còn lại của trang vẫn dùng bình thường, để một lỗi GitHub không làm hỏng cả Task.
62. Là người trong dự án, tôi muốn có nút làm mới trạng thái GitHub, để thấy thay đổi mới nhất.
63. Là PM, tôi muốn hệ thống không bao giờ ghi gì lên GitHub, để không có rủi ro đụng vào repo thật.

## Quyết định triển khai

### Khung và nơi chạy
- Web một trang chạy bằng Vite và React, dùng Astryx làm giao diện với trình biên dịch StyleX, theme `neutral`. Dữ liệu và đăng nhập bằng Supabase (Postgres, Auth, phân quyền từng dòng). Phần đọc GitHub chạy bằng một Edge Function của Supabase.
- Phát triển trên máy của chủ dự án. Đưa lên mạng là việc riêng của chủ dự án, nằm ngoài spec này, không có ticket nào cho AI làm.
- Giao diện hoàn toàn tiếng Việt, ngày giờ theo múi giờ Việt Nam.

### Chuẩn Astryx
- Cài đủ gói Astryx, theme `neutral`, chạy `astryx init`. Trình biên dịch StyleX được bật để dùng được template.
- Mọi màn dựng từ template hoặc component của Astryx (bảng Kanban dùng template Kanban). Không dùng thẻ `div` thô, không đặt màu hex hay đơn vị `px` rời, màu và khoảng cách đi qua token.
- Trước khi dùng một component, đọc tài liệu của nó qua CLI của Astryx.

### Mô-đun và luật
- **Luật nghiệp vụ nằm ở một chỗ thuần, không I/O**: chuyển trạng thái theo vai và theo người, điều kiện lý do bắt buộc, Người kiểm tra khác Người thực hiện, người được giao phải ở trong Dự án, tính Tiến độ và Trễ hạn, dấu vết, quyền xem và quyền sửa theo vai. Giao diện dùng chính chỗ này để ẩn nút và giải thích từ chối.
- **Kho dữ liệu** là giao diện lưu trữ duy nhất mà phần còn lại của app dùng. Mọi lệnh đều nhận danh tính người gọi và trả kết quả đã áp luật và quyền, hoặc một lỗi có mã (không tìm thấy, không có quyền, không hợp lệ, cần lý do, ...). Có hai bản cài: bản bộ nhớ (dùng cho test và cho giao diện khi test) và bản Supabase.
- **Cổng GitHub** là giao diện thứ hai, chỉ ở lát 4. Nhận danh sách repo và link, trả trạng thái đã chuẩn hoá hoặc một lỗi có mã. Có bản giả để test và bản gọi Edge Function. Hàm chuyển dữ liệu GitHub thô thành trạng thái hiển thị là hàm thuần.
- Dữ liệu vào từ biểu mẫu được kiểm ở ranh giới (zod).

### Phân quyền ở hai chỗ
- Vì trình duyệt không đáng tin, bản Supabase phải ép **cùng bộ luật** ở phía cơ sở dữ liệu: chuyển trạng thái đi qua một hàm của cơ sở dữ liệu chứ không ghi thẳng cột trạng thái; phân quyền từng dòng chặn người ngoài Dự án. Đây là bản sao của luật thuần, nên phải **khớp** với nó.
- Để giữ hai chỗ khớp: một **bảng ca dùng chung** (vai, trạng thái, người gọi, bước muốn làm, kết quả mong đợi). Bản bộ nhớ chạy bảng này trong cổng. Bản Supabase được chủ dự án chạy tay cùng bảng đó trên Supabase thật.

### Mô hình dữ liệu (mô tả, không schema cứng)
- **Hồ sơ**: email, tên hiển thị, GitHub username (tuỳ chọn), vai hệ thống (mặc định Thành viên).
- **Dự án**: tên, mô tả, trạng thái (hoạt động hoặc Lưu trữ), dấu vết.
- **Người trong dự án**: cặp (Dự án, tài khoản). Support nằm trong danh sách thì quản lý được Dự án đó.
- **Task**: thuộc một Dự án; tiêu đề, mô tả, hạn tuỳ chọn, Người thực hiện, Người kiểm tra, trạng thái, số lần bị Trả lại, dấu vết, danh sách link GitHub.
- **Lịch sử trạng thái**: mỗi lần đổi một dòng (Task, người đổi, thời điểm, từ, sang, lý do).
- **Repo của dự án**: cặp (Dự án, tên repo).
- Dấu vết chỉ lưu lần sửa gần nhất. Riêng trạng thái có lịch sử đầy đủ.

### Ma trận chuyển trạng thái

| Từ | Sang | Ai được làm | Lý do |
|---|---|---|---|
| Mới | Đang làm | Người thực hiện, Support, PM | không |
| Đang làm | Chờ duyệt | Người thực hiện, Support, PM | không |
| Chờ duyệt | Hoàn thành | Người kiểm tra, Support, PM | không |
| Chờ duyệt | Trả lại | Người kiểm tra, Support, PM | **bắt buộc** |
| Chờ duyệt | Bị lỗi | Người kiểm tra, Support, PM | **bắt buộc** |
| Trả lại | Đang làm | Người thực hiện, Support, PM | không |
| Bị lỗi | Đang làm | Support, PM | không |
| Mới, Đang làm, Chờ duyệt, Trả lại, Bị lỗi | Huỷ | Support, PM | **bắt buộc** |
| Hoàn thành, Huỷ | (không đi đâu nữa) | không ai | |

"Support" ở đây nghĩa là Support của chính Dự án đó. PM làm được ở mọi Dự án. Trong mỗi lần đổi, Trả lại làm tăng bộ đếm.

### Tiến độ và Trễ hạn
- Tiến độ = số Task Hoàn thành chia (tổng Task trừ Task Huỷ). Không có Task nào đáng tính thì hiện "chưa có task".
- Trễ hạn = Task có hạn, hạn đã qua so với ngày hôm nay theo giờ Việt Nam, trạng thái không phải Hoàn thành và không phải Huỷ. Task đang Chờ duyệt vẫn được coi là chưa hoàn thành.
- Dự án có cờ Trễ hạn khi có ít nhất một Task Trễ hạn.

### Tài khoản
- Tự đăng ký bằng email và mật khẩu, có xác nhận email. Người mới có vai Thành viên.
- PM đầu tiên do chủ dự án tự đặt vai trên Supabase một lần. Không có luật "người đầu tiên thành PM".
- Chỉ PM đổi được vai hệ thống. Luôn còn ít nhất một PM.
- Thêm người vào Dự án bằng email, người đó phải đã đăng ký. Không gửi thư mời.

### GitHub (lát 4)
- Token chỉ đọc nằm trong secret của Supabase, không lưu trong cơ sở dữ liệu, không bao giờ xuống trình duyệt.
- Edge Function chỉ phục vụ người đã đăng nhập, và chỉ với repo đã gắn vào một Dự án mà người đó thấy được.
- Chỉ đọc. Không có đường nào ghi lên GitHub.

## Quyết định kiểm thử

- **Một test tốt chỉ kiểm hành vi nhìn thấy từ bên ngoài**: gọi lệnh vào Kho dữ liệu với một người gọi cụ thể, rồi kiểm kết quả và những gì người khác thấy sau đó. Không kiểm cách cài bên trong.
- **Seam chính là Kho dữ liệu.** Một bộ test hợp đồng chạy cho mọi bản cài. Hôm nay bản bộ nhớ chạy trong cổng; bản Supabase dùng cùng bộ test khi chủ dự án chạy tay có Supabase thật.
- **Giao diện** được test bằng Testing Library, render với bản bộ nhớ của Kho dữ liệu. Vẫn là cùng seam, không thêm seam mới.
- **Seam thứ hai: Cổng GitHub**, chỉ ở lát 4, test bằng bản giả cùng hàm chuyển đổi thuần.
- **Bảng ca dùng chung** (xem mục phân quyền) là nguồn sự thật cho ma trận chuyển trạng thái và quyền xem. Bản bộ nhớ phải qua hết các dòng.
- Luật tiến độ và Trễ hạn có test với ngày được truyền vào, không đọc đồng hồ thật.
- Test không cần mạng (kể cả localhost), không cần DB, không đọc file ngoài repo.
- **Cổng chưa kiểm được và cần kiểm tay** (mỗi ticket liên quan phải ghi rõ): bản Supabase, file migration, phân quyền từng dòng, hàm cơ sở dữ liệu, Edge Function và việc gọi GitHub thật, luồng email (xác nhận, đặt lại mật khẩu).
- Ví dụ tương tự trong các repo của chủ dự án: bộ test hợp đồng cho Kho dữ liệu của Bảng ticket AI.

## Ngoài phạm vi

- Thông báo (email, Slack, Zalo), thư mời gửi đi.
- Xuất báo cáo, xuất Excel.
- Ước lượng giờ, điểm, mốc (milestone), mức ưu tiên, nhãn, bình luận.
- Đăng nhập bằng GitHub, đăng nhập một lần của tổ chức.
- Ghi lên GitHub (tạo issue, đổi trạng thái PR), webhook, đồng bộ hai chiều.
- Lịch sử sửa từng trường (chỉ lưu lần sửa gần nhất).
- Đưa ứng dụng lên mạng và cấu hình hạ tầng.
- Nhiều tổ chức khác nhau trong cùng một hệ thống.

## Further Notes

### Lát cắt
1. **Tài khoản và Dự án**: đăng ký, đăng nhập, hồ sơ, ba vai, tạo Dự án, người trong dự án, Lưu trữ, dấu vết Dự án, màn trống.
2. **Task**: tạo, sửa, giao việc, Kanban, bộ lọc, màn "việc của tôi", dấu vết Task.
3. **Vòng duyệt và tiến độ**: ma trận chuyển trạng thái, lịch sử, bộ đếm Trả lại, kéo thả có kiểm quyền, tiến độ và Trễ hạn, trang tổng quan.
4. **GitHub**: gắn repo, link issue hoặc PR, trạng thái, Cổng GitHub, Edge Function.

### Lát 0: dựng khung (người làm, không giao AI)
Run không được đổi danh sách phụ thuộc, nên phải cài sẵn trước `/begin`: bộ Astryx và trình biên dịch StyleX, nền (React, Vite, TypeScript, Supabase client, zod, thư viện định tuyến), kiểm thử (Vitest, jsdom, Testing Library, ESLint), thư viện kéo thả theo template Kanban của Astryx. Cùng với `git init`, commit đầu, `.gitignore` có `node_modules`, `GLOSSARY.md`, khai báo repo ở Bảng ticket AI và Lệnh test (`npm test`). Cần chủ dự án cho phép trước khi cài và tạo repo.

### Danh sách kiểm tay bắt buộc trước khi đưa lên mạng
Đăng ký đang mở nên phân quyền từng dòng là hàng rào duy nhất. Chủ dự án chạy trên Supabase thật và đạt hết mới được đưa lên:
- Người lạ vừa đăng ký không đọc được Dự án, Task, hồ sơ của ai ngoài hồ sơ của mình.
- Thành viên không sửa được Dự án hay Task của người khác, không tự nâng vai.
- Người ngoài Dự án không đọc được và không ghi được Task của Dự án đó.
- Không ghi thẳng được cột trạng thái, mọi lần đổi đi qua hàm kiểm luật.
- Người kiểm tra trùng Người thực hiện bị từ chối ở phía cơ sở dữ liệu.
- Chạy toàn bộ bảng ca dùng chung và đạt.
- Edge Function từ chối người chưa đăng nhập và repo chưa gắn.

### Việc của chủ dự án trên Supabase
Tạo project, bật đăng ký email kèm xác nhận, chạy migration, đặt vai PM cho tài khoản của mình, chạy danh sách kiểm ở trên, và ở lát 4 tạo token GitHub chỉ đọc (fine-grained) rồi đặt vào secret.

### Nợ đã biết
- Trạng thái GitHub đọc mỗi lần mở và khi bấm làm mới, chưa có bộ nhớ đệm. Nâng cấp khi lượt gọi GitHub thành điểm nghẽn.
- Phân quyền ở hai chỗ (luật thuần và cơ sở dữ liệu) phải sửa song song. Giảm bằng bảng ca dùng chung.

## Assumptions

Bạn chưa nói về các chỗ này. Đây là mặc định an toàn, sửa chỗ nào thì nói.

1. **Không xoá cứng**: Dự án và Task chỉ Huỷ hoặc Lưu trữ. Dự án đã Lưu trữ thì mọi Task chỉ xem.
2. **Task gồm** tiêu đề (bắt buộc), mô tả, hạn (tuỳ chọn). Không có mức ưu tiên, nhãn, bình luận ngoài lý do khi đổi trạng thái.
3. **Khi tạo Task, cả Người thực hiện lẫn Người kiểm tra đều bắt buộc.** Nếu cần danh sách việc chưa giao thì nới lỏng sau.
4. **Chỉ PM và Support** tạo, sửa Task và đổi người. Người thực hiện và Người kiểm tra chỉ đổi trạng thái theo ma trận và xem.
5. **Mọi người trong dự án đều xem được mọi Task của Dự án đó**, kể cả của người khác.
6. **Người được giao phải ở trong Dự án.** PM và Support cũng có thể được thêm vào Dự án và nhận việc.
7. **Gỡ người khỏi Dự án** không đổi Task họ đang giữ: Người thực hiện cũ vẫn ghi trên Task cho đến khi PM hoặc Support giao lại.
8. **Chỉ PM tạo Dự án** và nâng vai hệ thống. Support thêm hoặc gỡ người trong Dự án mình quản lý nhưng không đổi vai hệ thống của ai.
9. **Mật khẩu** ít nhất 8 ký tự. Xác nhận email và quên mật khẩu dùng luồng sẵn của Supabase, thư do Supabase gửi.
10. **Hạn** là một ngày, không có giờ. So với ngày hôm nay theo giờ Việt Nam.
11. **Link GitHub** gồm issue và PR. PR nháp (draft) hiện là "mở". Một Task có thể có nhiều link.
12. **Lỗi GitHub** (hết lượt gọi, repo riêng tư token không thấy, mất mạng) hiện thành thông báo cạnh link, không chặn lưu Task.
13. **Kanban**: Task Hoàn thành và Huỷ vẫn hiện trên bảng nhưng không kéo được ra khỏi cột.
14. **Trang tổng quan** của mỗi người chỉ gồm Dự án mình được thấy, đúng vai.

Thêm khi viết ticket (cũng chưa được bạn nói, mặc định an toàn):

15. **Giới hạn độ dài:** tên Dự án tối đa 120 ký tự, tiêu đề Task tối đa 200 ký tự, không được rỗng hoặc chỉ khoảng trắng.
16. **Hạn trong quá khứ** vẫn cho tạo Task, để nhập việc cũ.
17. **Đổi trạng thái cũng là một lần chỉnh sửa:** cập nhật người chỉnh sửa gần nhất và ngày chỉnh sửa gần nhất của Task.
18. **Link GitHub:** mọi người trong dự án thêm và gỡ được; thêm hoặc gỡ link cũng cập nhật dấu vết chỉnh sửa của Task; Task ở trạng thái cuối vẫn thêm được link (chỉ Dự án Lưu trữ thì không).
19. **Tiến độ làm tròn xuống** số nguyên phần trăm, để 100% chỉ xuất hiện khi thật sự xong hết.
20. **Người đã rời dự án:** Task vẫn ghi người cũ và hiện "đã rời dự án" cho đến khi được giao lại.
