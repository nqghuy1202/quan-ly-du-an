# Spec: Tối ưu hiệu năng tải trang của bản Supabase

**Status:** ready-for-agent

> Bản nháp chờ duyệt. Sinh từ buổi grill với chủ dự án ngày 27/11/2026 (hai vòng, 13 câu, đều chấp nhận đáp án đề xuất). Spec này không đổi mô hình dữ liệu, không migration, không đổi danh sách phụ thuộc, không thêm lệnh vào Kho dữ liệu. Quyền xem, ma trận chuyển trạng thái, Tiến độ, Trễ hạn, Dấu vết và mọi mã lỗi giữ nguyên như `.scratch/quan-ly-du-an/spec.md` và các spec sau nó.

## Problem Statement

Người dùng thấy các trang và chức năng tải chậm khi dùng bản Supabase trên mây. Chậm ở hầu hết các màn, không riêng một màn.

Nguyên nhân đọc được từ mã (đếm theo mã, chưa đo trên mây):

- **Mỗi lệnh của Kho dữ liệu đọc lại hồ sơ người gọi trước khi làm việc chính.** Lệnh trên một Dự án còn đọc thêm "người gọi có ở trong Dự án không" và đọc Dự án. Một lệnh ghi vì vậy tốn 4 đến 6 lượt gọi mạng.
- **Tổng quan, Tất cả Dự án và Dự án của tôi đọc Task riêng cho từng Dự án**, và mỗi lần đọc đó lặp lại các bước kiểm ở trên. Với N Dự án là khoảng 4N + 5 lượt gọi; 10 Dự án tốn khoảng 45 lượt.
- **Một màn gọi nhiều lệnh rời cùng lúc, lệnh nào cũng tự kiểm lại người gọi.** Mở Chi tiết Dự án tốn khoảng 12 lượt, mở Ngăn trượt Task khoảng 15 đến 20 lượt.
- **Toàn bộ ứng dụng nằm trong một gói khoảng 1,7 MB chưa nén**, tải hết ngay lần đầu kể cả màn chưa mở.
- **Quay lại Tổng quan hay đổi tab trong Chi tiết Dự án là hiện "đang tải" từ đầu**, dù vừa xem dữ liệu đó vài giây trước.

## Solution

- **Mỗi màn chỉ tốn một số lượt gọi mạng cố định**, không tăng theo số Dự án hay số Task. Trần cho bản Supabase, tính trên đường đi thành công của người dùng đã đăng nhập:

  | Việc | Hiện tại (ước) | Trần |
  |---|---|---|
  | Mở Tổng quan | 4N + 5 | 4 |
  | Mở Tất cả Dự án, mở Dự án của tôi | 4N + 5 | 4 |
  | Mở Chi tiết Dự án | khoảng 12 | 5 |
  | Mở Ngăn trượt Task (không tính lượt gọi Cổng GitHub) | 15 đến 20 | 6 |
  | Một lệnh ghi (tạo, sửa, đổi trạng thái, đổi người...) kể cả đọc lại kết quả | 4 đến 6 | 3 |

- **Lần đầu chỉ tải phần đăng nhập**; các màn sau đăng nhập tải khi mở tới.
- **Quay lại màn vừa xem thì thấy ngay dữ liệu lần trước**, rồi màn tự đọc lại ngầm và cập nhật.
- Người dùng không thấy khác gì ngoài nhanh hơn: cùng nội dung, cùng nút, cùng thông báo, cùng lý do từ chối.

## User Stories

### Tổng quan và danh sách Dự án

1. Là người dùng, tôi mở Tổng quan và thấy đủ số liệu sau nhiều nhất 4 lượt gọi mạng, dù tôi thấy 1 hay 50 Dự án.
2. Là PM, tôi mở Tất cả Dự án và thấy danh sách kèm Tiến độ, số Task, Quá hạn dự kiến sau nhiều nhất 4 lượt gọi mạng, dù có bao nhiêu Dự án.
3. Là Support hoặc Thành viên, tôi mở Dự án của tôi với cùng trần 4 lượt gọi.
4. Là người dùng, số liệu ở Tổng quan và ở hai danh sách Dự án (Tiến độ, Trễ hạn, tới hạn trong 7 ngày, phân bố theo trạng thái, số Task) đúng y như trước khi tối ưu.
5. Là người dùng chưa ở Dự án nào, tôi vẫn thấy trạng thái trống như trước, và màn không gọi thêm lượt nào để đọc Task.
6. Là người dùng, Dự án đã Lưu trữ vẫn hiện hay ẩn ở từng màn đúng như trước.
7. Là Support hoặc Thành viên, tôi vẫn chỉ thấy Dự án mình ở trong và Task của các Dự án đó.

### Chi tiết Dự án

8. Là người dùng, tôi mở Chi tiết Dự án và thấy thông tin Dự án, Người trong dự án và Task sau nhiều nhất 5 lượt gọi mạng.
9. Là người dùng, mở một Dự án tôi không được xem hoặc không tồn tại vẫn nhận đúng lý do từ chối như trước.
10. Là người dùng, bộ đếm số Task đang giữ của từng Người trong dự án vẫn đúng như trước.
11. Là PM hoặc Support, sau khi thêm người, gỡ người, Lưu trữ hay mở lại Dự án, màn cập nhật đúng như trước.

### Ngăn trượt Task

12. Là người dùng, tôi mở một Task trong Ngăn trượt và thấy nội dung, lịch sử, link, các bước chuyển trạng thái sau nhiều nhất 6 lượt gọi mạng, không tính lượt gọi Cổng GitHub.
13. Là người dùng, lỗi của Cổng GitHub vẫn chỉ hiện cạnh link và không chặn phần còn lại của Task.
14. Là người dùng, các nút chuyển trạng thái hiện hay ẩn và lời giải thích từ chối vẫn đúng theo luật như trước.
15. Là người dùng, mở Ngăn trượt Task từ Tổng quan, từ Kanban, từ Việc của tôi hay Chờ tôi duyệt đều theo cùng trần.

### Lệnh ghi

16. Là PM hoặc Support, tôi tạo Dự án, sửa Dự án, tạo Task, sửa Task, đổi người của Task, và mỗi lệnh tốn nhiều nhất 3 lượt gọi mạng kể cả đọc lại kết quả.
17. Là Người thực hiện hoặc Người kiểm tra, tôi đổi trạng thái Task (kể cả kéo thả trên Kanban) với nhiều nhất 3 lượt gọi mạng.
18. Là người dùng, lệnh bị từ chối vẫn trả đúng mã lỗi và đúng thứ tự từ chối như trước (ví dụ kiểm quyền trước khi báo không tìm thấy); trần lượt gọi không áp cho đường từ chối.
19. Là người dùng, dữ liệu biểu mẫu sai vẫn bị báo lỗi theo từng ô như trước, và không tốn lượt gọi mạng nào để ghi.

### Vai và phiên

20. Là người vừa được PM đổi vai, lệnh kế tiếp của tôi theo vai mới ngay: được nâng thì làm được ngay, bị hạ thì bị từ chối ngay, đúng như hợp đồng hiện có.
21. Là người vừa bị đổi vai, Thanh bên và các nút trên giao diện của tôi hiện đúng theo vai mới sau lần đọc hồ sơ kế tiếp (tải lại trang hoặc đăng nhập lại), như hiện nay.
22. Là người dùng có phiên đã hết hoặc tài khoản không còn, lệnh kế tiếp vẫn đưa tôi về màn đăng nhập như trước.
23. Là người dùng, tôi sửa hồ sơ của mình và thấy tên mới ngay ở mọi chỗ như trước.

### Tải lần đầu

24. Là người chưa đăng nhập, trình duyệt của tôi chỉ tải phần cần cho màn đăng nhập, đăng ký và đặt lại mật khẩu.
25. Là người dùng, lần đầu mở một màn sau đăng nhập tôi thấy trạng thái đang tải của ứng dụng rồi tới nội dung; không thấy màn trắng.
26. Là người dùng, phần tải của một màn bị lỗi mạng thì tôi thấy thông báo lỗi tiếng Việt kèm nút Thử lại.

### Quay lại màn vừa xem

27. Là người dùng, tôi mở một Dự án từ Tổng quan rồi quay lại, và thấy ngay Tổng quan với số liệu lần trước, không qua trạng thái đang tải.
28. Là người dùng, ngay sau đó Tổng quan tự đọc lại ngầm và cập nhật số liệu mới, không nháy màn.
29. Là người dùng, tôi đổi qua lại giữa các tab của Chi tiết Dự án mà không phải chờ tải lại tab đã xem.
30. Là người dùng, lần đọc lại ngầm bị lỗi thì tôi vẫn thấy dữ liệu lần trước; hết phiên thì vẫn về màn đăng nhập.
31. Là người dùng, bấm Thử lại hoặc mở màn lần đầu vẫn hiện trạng thái đang tải như trước.
32. Là người dùng, sau khi đăng xuất rồi người khác đăng nhập trên cùng tab, người sau không thấy dữ liệu của người trước.

## Implementation Decisions

- **Chỉ bản Supabase của Kho dữ liệu và phần giao diện đổi.** Bản bộ nhớ, luật thuần, migration, Edge Function và giao diện của Kho dữ liệu (danh sách lệnh, kiểu trả về, mã lỗi) giữ nguyên.
- **Một chỗ duy nhất xác định người gọi.** Các bước lặp lại ở đầu mỗi lệnh (đọc hồ sơ, kiểm ở trong Dự án, đọc Dự án) gom về một mô-đun bên trong bản Supabase; từng lệnh không tự viết lại chuỗi kiểm. Đây là phần làm gọn mã duy nhất của spec này.
- **Kho nhớ hồ sơ của phiên đang mở.** Hồ sơ đọc một lần khi đăng nhập và được nhớ theo phiên; lệnh đọc hồ sơ của tôi và lệnh sửa hồ sơ luôn làm mới bản nhớ; đăng xuất xoá bản nhớ.
- **Vai mới vẫn có hiệu lực ngay, đúng hợp đồng hiện có**, theo hai quy tắc:
  - Trước khi từ chối một lệnh vì vai (theo bản nhớ), Kho đọc lại hồ sơ một lần rồi mới quyết. Người vừa được nâng vai vì vậy làm được ngay.
  - Khi bản nhớ cho phép mà cơ sở dữ liệu từ chối (người vừa bị hạ vai), Kho trả đúng mã lỗi mà luật thuần sẽ trả. Cơ sở dữ liệu vẫn là nơi ép quyền.
- **Đọc theo lô thay vì theo từng Dự án.** Task của mọi Dự án người gọi thấy được đọc trong một lượt (phân quyền từng dòng đã lọc sẵn); tên người cho Dấu vết và cho Task gom vào một lượt. Tổng quan và danh sách Dự án kèm số liệu ghép từ các lượt đọc lô này.
- **Số liệu vẫn tính bằng luật thuần** trên dữ liệu đọc về; không tính trong SQL. Chấp nhận tải mọi Task của các Dự án đang thấy; ổn ở cỡ vài nghìn Task.
- **Các lệnh gọi cùng lúc của một màn dùng chung kết quả kiểm người gọi và kiểm Dự án**, không mỗi lệnh tự đọc lại.
- **Lệnh ghi dựa vào cơ sở dữ liệu để ép luật**, chỉ giữ lượt đọc trước khi ghi ở chỗ cần để trả đúng mã lỗi và đúng thứ tự từ chối. Chỗ nào bỏ lượt đọc mà làm đổi mã lỗi thì giữ lượt đọc đó, và trần của lệnh đó ghi lại trong ticket để chủ dự án quyết.
- **Trần lượt gọi tính mọi yêu cầu mạng tới Supabase** (đọc bảng, gọi hàm) trong một lần mở màn hoặc một lệnh, trên đường đi thành công, sau khi đã đăng nhập. Không tính đăng nhập, làm mới phiên và Cổng GitHub.
- **Chia gói theo màn** bằng cách tải lười sẵn có của React. Phần trước đăng nhập nằm trong gói đầu; mỗi màn sau đăng nhập là một phần tải riêng, có trạng thái đang tải và trạng thái lỗi kèm Thử lại dựng từ component Astryx.
- **Giữ dữ liệu lần trước ở phía giao diện**, theo phiên đăng nhập, cho Tổng quan và các tab của Chi tiết Dự án: hiện dữ liệu cũ ngay, đọc lại ngầm, thay khi có kết quả. Không thêm thư viện. Bản giữ bị xoá khi đăng xuất hoặc hết phiên.
- **Ngày hôm nay vẫn truyền vào**; không chỗ nào mới đọc đồng hồ thật, và việc giữ dữ liệu cũ không có hạn theo thời gian.

## Testing Decisions

- **Test tốt ở đây kiểm hành vi nhìn thấy từ bên ngoài**: kết quả lệnh của Kho, nội dung màn, và số lượt gọi mạng ra khỏi Kho. Không kiểm tên hàm bên trong, không kiểm thứ tự truy vấn.
- **Seam chính là Kho dữ liệu, bản Supabase chạy trên `fetch` giả.** Bản Supabase đã nhận `fetch` qua tuỳ chọn và các test hiện có đã dùng một `fetch` giả đóng vai Supabase, ghi lại mọi địa chỉ được gọi. Trần lượt gọi kiểm bằng cách đếm số địa chỉ đó quanh một lệnh hoặc một lần mở màn. Không cần mạng, không cần DB.
- **Trần phải được kiểm ở hai cỡ dữ liệu** (ví dụ 1 Dự án và nhiều Dự án) để chứng minh số lượt gọi không tăng theo dữ liệu.
- **Bộ test hợp đồng và hai bảng ca (chuyển trạng thái, quyền) không sửa** và phải tiếp tục xanh với bản bộ nhớ trong `npm test`. Các ca "vai mới có hiệu lực ngay" là lưới an toàn cho quyết định nhớ hồ sơ.
- **Ca vai đổi giữa chừng cho bản Supabase trên `fetch` giả**: được nâng vai thì lệnh kế tiếp thành công; bị hạ vai thì lệnh kế tiếp trả đúng mã lỗi.
- **Seam thứ hai là giao diện qua Testing Library với bản bộ nhớ**, như các test màn hiện có: quay lại Tổng quan không qua trạng thái đang tải rồi cập nhật số mới; tab đã xem không tải lại; đăng xuất xoá dữ liệu giữ; màn tải lười hiện đang tải rồi nội dung, lỗi tải thì hiện Thử lại.
- **Mẫu sẵn có để theo**: các test của bản Supabase cho Dự án và Task (dùng `fetch` giả, khẳng định mọi địa chỉ đều thuộc Supabase giả), test của danh sách Dự án kèm số liệu, test màn Tổng quan và Chi tiết Dự án.
- **Không test nào dựa vào thời gian thực**; thời gian tải thật do chủ dự án kiểm tay trên mây.
- **Bộ test hợp đồng trên Supabase thật** (chủ dự án chạy tay, không thuộc cổng) cần chạy lại sau lô này; việc đó ghi vào danh sách kiểm tay trong tài liệu Supabase.

## Out of Scope

- **Migration và hàm cơ sở dữ liệu mới.** Chủ dự án đã cho phép về nguyên tắc, nhưng để lô sau, chỉ khi kiểm tay trên mây vẫn thấy chậm.
- **Tối ưu policy phân quyền từng dòng** (các policy gọi hàm kiểm quyền cho mỗi dòng). Cần chủ dự án đo trên mây trước khi quyết; sửa policy là sửa chỗ ép quyền.
- **Tính số liệu trong SQL**, phân trang danh sách Task.
- **Rà soát logic nghiệp vụ.** Làm thành một lượt riêng sau lô này; kết quả là danh sách phát hiện để chủ dự án duyệt.
- **Viết lại cấu trúc mã** ngoài việc gom bước xác định người gọi.
- **Tối ưu bản bộ nhớ**, lưu phiên đăng nhập, bộ đệm sống qua lần tải lại trang, cập nhật thời gian thực.
- **Đo và đặt ngưỡng thời gian thật** trong cổng kiểm.
- **Đổi danh sách phụ thuộc** (không thêm thư viện truy vấn hay bộ đệm).

## Further Notes

- **Một điểm khác với câu trả lời Q5 của buổi grill.** Ở đó chủ dự án chấp nhận vai mới chậm có hiệu lực. Khi viết spec mới thấy bộ test hợp đồng có ca "vai mới có hiệu lực ngay ở lần đọc sau", mà Q9 chốt không sửa hợp đồng. Spec chọn giữ hợp đồng: Kho vẫn nhớ hồ sơ để bỏ lượt đọc trên đường thành công, nhưng đọc lại trước khi từ chối vì vai. Kết quả tốt hơn điều đã chấp nhận: không có thay đổi hành vi nào ở Kho.
- **Thay đổi hành vi duy nhất người dùng thấy** là quay lại màn thì thấy số liệu lần trước trong chốc lát trước khi số mới về (chủ dự án đã chấp nhận ở Q11).
- **Các con số "hiện tại" là ước theo mã**, chưa đo. Trần mới là cam kết; con số nào không đạt được mà không đổi mã lỗi thì ticket đó dừng và quay lại chủ dự án.
- **Thứ tự làm đề xuất**: gom bước xác định người gọi và nhớ hồ sơ; Tổng quan và danh sách Dự án; Chi tiết Dự án; Ngăn trượt Task; lệnh ghi; chia gói theo màn; giữ dữ liệu lần trước.
- **Run của Bảng ticket AI bắt đầu từ nhánh `main`**, hiện đã có đủ mã của nhánh giao diện mới nhất.
- **Sau lô này chủ dự án kiểm tay**: mở từng màn trên mây và xem số yêu cầu ở tab mạng của trình duyệt; chạy bộ test hợp đồng trên Supabase thật; xem cỡ các gói sau `npm run build`.
