# Spec: Sắp lại Tổng quan, tìm và lọc việc cá nhân, Hồ sơ nhiều cột

**Status:** ready-for-agent

> Bản nháp chờ duyệt. Sinh từ buổi grill với chủ dự án ngày 27/11/2026 (ba vòng, 15 câu, đều chấp nhận đáp án đề xuất). Spec này chỉ đổi giao diện trên nền `.scratch/bo-cuc-va-truong-moi/spec.md`: không đổi mô hình dữ liệu, không thêm lệnh vào Kho dữ liệu, không migration. Quyền xem, ma trận chuyển trạng thái, Tiến độ, Trễ hạn và Dấu vết giữ nguyên.

## Problem Statement

- **Tổng quan khó đọc.** Các vùng đang xếp lưới hai cột: bảng Dự án đang hoạt động bên trái, Task Trễ hạn và Task tới hạn bên phải, Phân bố ở dưới. Hai cột làm bảng bị hẹp, hiện thanh cuộn ngang, và cột trái để lại khoảng trống lớn. Vùng không có Task vẫn hiện bảng rỗng có đầu cột.
- **Việc của tôi không tìm, không lọc được.** Người thực hiện có hàng chục Task (Dự án AMS có 23 Task đang mở giao cho Huy) mà chỉ có một bảng dài. Muốn tìm một Task hay xem riêng các Task Trả lại thì phải cuộn và đọc từng dòng. Chờ tôi duyệt cũng vậy.
- **Hồ sơ dài không cần thiết.** Bảy ô xếp một cột, mỗi ô chiếm hết chiều ngang, nên phải cuộn mới thấy nút Lưu hồ sơ.

## Solution

- **Tổng quan xếp dọc một cột**, mọi vùng chiếm hết chiều ngang, theo thứ tự: hàng ô số, Task Trễ hạn, Task tới hạn trong 7 ngày, Dự án đang hoạt động, Phân bố Task theo trạng thái. Vùng không có Task thì giữ tiêu đề và mô tả, bên dưới chỉ một dòng chữ báo trống. Mỗi vùng Task hiện tối đa 5 dòng, nhiều hơn thì có nút "Xem tất cả (N)" để mở hết ngay tại chỗ, nên bảng Dự án không bị đẩy xuống xa.
- **Việc của tôi và Chờ tôi duyệt có thanh tìm và lọc**: một ô tìm và các nhóm chip lọc, mỗi chip kèm số Task khớp. Khi đang lọc có dòng "Hiện X trên Y Task". Lọc ra không còn Task nào thì báo trống kèm nút Xoá bộ lọc.
- **Hồ sơ xếp hai đến ba ô trên một hàng**, màn hẹp thì về một cột.

## User Stories

### Tổng quan

1. Là người dùng, tôi thấy các vùng của Tổng quan xếp dọc thành một cột, để đọc từ trên xuống mà không phải dò hai cột.
2. Là người dùng, tôi thấy hàng ô số ở trên cùng, để nắm số liệu chính ngay khi vào trang.
3. Là người dùng, ngay dưới hàng ô số tôi thấy vùng Task Trễ hạn, để việc gấp nhất nằm ở chỗ dễ thấy nhất.
4. Là người dùng, dưới vùng Trễ hạn tôi thấy vùng Task tới hạn trong 7 ngày, để biết việc sắp đến hạn.
5. Là người dùng, dưới hai vùng Task tôi thấy bảng Dự án đang hoạt động kèm Tiến độ.
6. Là người dùng, cuối trang tôi thấy Phân bố Task theo trạng thái.
7. Là người dùng, mỗi bảng ở Tổng quan chiếm hết chiều ngang của vùng nội dung, để đọc đủ các cột mà không phải cuộn ngang trên màn rộng.
8. Là người dùng, khi không có Task Trễ hạn tôi thấy tiêu đề "Task Trễ hạn", mô tả, và một dòng "Không có Task Trễ hạn.", không thấy bảng rỗng có đầu cột.
9. Là người dùng, khi không có Task tới hạn trong 7 ngày tôi thấy tiêu đề, mô tả, và một dòng báo trống tương ứng, không thấy bảng rỗng.
10. Là người dùng, bấm ô số, bấm dòng Dự án hay bấm Task trong hai danh sách vẫn làm đúng như trước: mở trang, mở Dự án, mở Task trong Ngăn trượt.
11. Là người dùng, trạng thái đang tải, lỗi kèm Thử lại, và trạng thái trống khi chưa ở Dự án nào của Tổng quan vẫn như trước.
12. Là PM, nút Tạo Dự án và thông báo đã tạo Dự án ở Tổng quan vẫn như trước.
12a. Là người dùng, khi vùng Task Trễ hạn hoặc Task tới hạn trong 7 ngày có nhiều hơn 5 Task, tôi chỉ thấy 5 Task đầu (theo thứ tự hiện nay) và nút "Xem tất cả (N)" với N là tổng số Task của vùng đó.
12b. Là người dùng, tôi bấm "Xem tất cả (N)" thì vùng đó hiện đủ N Task ngay tại chỗ và nút biến mất; vùng kia không đổi.
12c. Là người dùng, khi vùng có từ 5 Task trở xuống thì hiện đủ và không có nút "Xem tất cả".
12d. Là người dùng, khi tôi rời Tổng quan rồi quay lại, các vùng về lại 5 dòng.

### Tìm và lọc ở Việc của tôi

13. Là Người thực hiện, ở trang Việc của tôi tôi thấy một ô tìm phía trên bảng, để tìm nhanh một Task.
14. Là Người thực hiện, tôi gõ vào ô tìm thì bảng chỉ còn các Task có tiêu đề, Mã Dự án hoặc tên Dự án chứa chữ đã gõ.
15. Là Người thực hiện, tôi tìm không cần đúng hoa thường hay dấu tiếng Việt (gõ "khop ma" vẫn ra "[Khớp mã trạng thái DVC]"), giống ô tìm Dự án.
16. Là Người thực hiện, tôi thấy nhóm chip Trạng thái gồm Mới, Đang làm, Chờ duyệt, Trả lại, Bị lỗi, để xem riêng Task ở một số trạng thái.
17. Là Người thực hiện, tôi thấy nhóm chip Mức ưu tiên gồm các mức Thấp, Trung bình, Cao.
18. Là Người thực hiện, tôi thấy chip Trễ hạn, để xem riêng các Task đã qua hạn.
19. Là Người thực hiện, mỗi chip có số Task khớp, ví dụ "Mới (23)", để biết trước bấm vào sẽ ra bao nhiêu.
20. Là Người thực hiện, chip có số 0 vẫn hiện (ví dụ "Bị lỗi (0)") và vẫn bấm được như chip khác, không có kiểu hiển thị riêng.
21. Là Người thực hiện, tôi bấm một chip để bật nó, bấm lần nữa để tắt; chip đang bật nhìn khác chip đang tắt.
22. Là Người thực hiện, khi bật nhiều chip trong cùng một nhóm, bảng hiện Task khớp một trong các chip đó (Mới hoặc Trả lại).
23. Là Người thực hiện, khi bật chip ở nhiều nhóm và gõ vào ô tìm, bảng chỉ hiện Task khớp đủ mọi nhóm và ô tìm (Mới, Mức ưu tiên Cao, có chữ "DVC").
24. Là Người thực hiện, khi không bật chip nào và ô tìm trống, bảng hiện mọi Task như trước.
25. Là Người thực hiện, khi đang lọc tôi thấy dòng "Hiện X trên Y Task", để biết mình đang xem một phần danh sách.
26. Là Người thực hiện, khi không lọc gì thì không có dòng đếm đó.
27. Là Người thực hiện, khi bộ lọc không còn Task nào khớp, tôi thấy "Không có Task khớp bộ lọc" và nút Xoá bộ lọc.
28. Là Người thực hiện, tôi bấm Xoá bộ lọc thì ô tìm trống, mọi chip tắt, và bảng hiện lại đủ Task.
29. Là Người thực hiện, thứ tự các Task sau khi lọc giữ như hiện nay.
30. Là Người thực hiện, tôi mở một Task trong Ngăn trượt rồi đóng lại thì ô tìm và các chip vẫn giữ nguyên.
31. Là Người thực hiện, khi tôi chuyển trạng thái một Task trong Ngăn trượt, danh sách đọc lại và số trên chip cập nhật theo, bộ lọc vẫn giữ.
32. Là Người thực hiện, khi tôi chuyển sang trang khác rồi quay lại Việc của tôi, ô tìm và các chip về trống.
33. Là Người thực hiện, khi tôi chưa có Task nào, trang vẫn báo trống như trước và không hiện thanh tìm và lọc.
34. Là Người thực hiện, khi trang đang tải hay lỗi, thanh tìm và lọc chưa hiện.
35. Là người dùng bàn phím, tôi đi tới ô tìm và từng chip bằng phím Tab, bật tắt chip bằng phím cách hoặc Enter, và thấy focus ring rõ ràng.
36. Là người dùng trình đọc màn hình, mỗi chip cho biết đang bật hay tắt, và ô tìm có nhãn tiếng Việt.

### Tìm và lọc ở Chờ tôi duyệt

37. Là Người kiểm tra, ở trang Chờ tôi duyệt tôi có cùng ô tìm như Việc của tôi.
38. Là Người kiểm tra, ở Chờ tôi duyệt tôi có nhóm chip Mức ưu tiên và chip Trễ hạn, không có nhóm chip Trạng thái vì mọi Task ở đây đều Chờ duyệt.
39. Là Người kiểm tra, cách kết hợp, số trên chip, dòng đếm, báo trống khi lọc, Xoá bộ lọc, giữ bộ lọc khi mở Ngăn trượt và về trống khi đổi trang đều như ở Việc của tôi.
40. Là Người kiểm tra, khi tôi duyệt xong một Task trong Ngăn trượt (Hoàn thành, Trả lại hoặc Bị lỗi), Task đó rời danh sách và số trên chip giảm theo.

### Hồ sơ

41. Là người dùng, ở trang Hồ sơ tôi thấy Email và Vai trên cùng một hàng.
42. Là người dùng, tôi thấy Tên hiển thị và GitHub username trên cùng một hàng.
43. Là người dùng, tôi thấy Số điện thoại, Chức danh và Phòng ban trên cùng một hàng.
44. Là người dùng, nút Lưu hồ sơ nằm ngay dưới ba hàng đó, thường thấy được mà không phải cuộn trên màn máy tính.
45. Là người dùng trên màn hẹp, các ô của Hồ sơ về một cột, mỗi ô chiếm hết chiều ngang.
46. Là người dùng, nhãn, mô tả, kiểm lỗi cạnh ô, thông báo đã lưu và thứ tự Tab giữa các ô của Hồ sơ vẫn như trước.

## Implementation Decisions

- **Chỉ đổi giao diện.** Không đổi mô hình dữ liệu, không thêm hay đổi lệnh của Kho dữ liệu, không migration, không đổi bản Supabase. Việc của tôi và Chờ tôi duyệt vẫn đọc qua hai lệnh hiện có; tìm và lọc chạy trên danh sách đã đọc.
- **Luật tìm và lọc việc cá nhân là một hàm thuần** trong tầng luật nghiệp vụ, không I/O, cạnh luật lọc Task của Kanban và luật tìm Dự án. Gồm:
  - Kiểu **bộ lọc việc cá nhân**: từ khoá, tập trạng thái được chọn, tập Mức ưu tiên được chọn, cờ Trễ hạn; một hằng bộ lọc trống.
  - Hàm **lọc**: nhận danh sách Task kèm Dự án, bộ lọc và thời điểm hiện tại; trả các Task khớp, giữ nguyên thứ tự đầu vào. Trong một nhóm là "hoặc", giữa các nhóm và với từ khoá là "và". Nhóm không chọn gì thì không lọc theo nhóm đó.
  - Hàm **đếm cho chip**: với mỗi chip, số Task khớp chip đó trên toàn danh sách đã đọc (không phụ thuộc chip khác hay ô tìm). Số trên chip vì vậy không đổi khi người dùng bật tắt chip khác.
  - Hàm **đang lọc**: đúng khi từ khoá khác trống (sau khi bỏ khoảng trắng hai đầu) hoặc có chip được chọn.
  - Từ khoá khớp tiêu đề Task, Mã Dự án hoặc tên Dự án, dùng lại cách chuẩn hoá bỏ dấu và hoa thường của luật tìm Dự án.
  - Trễ hạn dùng đúng luật Trễ hạn hiện có (theo ngày giờ Việt Nam, thời điểm truyền vào), không viết lại.
  - Thứ tự hiển thị vẫn do luật xếp việc cá nhân hiện có quyết định; lọc chạy sau khi xếp hoặc giữ thứ tự, kết quả như nhau.
- **Thanh tìm và lọc là một phần giao diện dùng chung** cho Việc của tôi và Chờ tôi duyệt. Loại trang quyết định có nhóm chip Trạng thái hay không. Bộ lọc là trạng thái của trang, nên tự về trống khi trang bị bỏ và dựng lại lúc người dùng quay lại; mở và đóng Ngăn trượt không bỏ trang nên bộ lọc được giữ.
- **Chip** dựng từ component Astryx có trạng thái bật tắt và báo trạng thái đó cho công nghệ hỗ trợ. Đọc `astryx component` trước khi chọn. Chip số 0 trông và bấm như mọi chip khác; con số 0 đã đủ báo, không làm mờ và không vô hiệu.
- **Dòng đếm** có dạng "Hiện X trên Y Task", với Y là số Task đã đọc và X là số Task sau lọc. Dòng báo trống khi lọc: tiêu đề "Không có Task khớp bộ lọc" kèm nút "Xoá bộ lọc".
- **Tổng quan** bỏ lưới hai cột, các vùng xếp trong một cột theo thứ tự đã nêu, mỗi bảng chiếm hết chiều ngang vùng nội dung. Vùng Task Trễ hạn và tới hạn khi trống chỉ còn tiêu đề, mô tả và một dòng chữ báo trống (chữ báo trống giữ như hiện nay), không dựng bảng. Mỗi vùng Task hiện tối đa 5 dòng đầu theo thứ tự hiện có; nhiều hơn thì dưới bảng có nút "Xem tất cả (N)" (N là tổng số Task của vùng), bấm thì vùng đó hiện đủ và nút biến mất. Trạng thái mở hết là của từng vùng và của trang, nên về lại 5 dòng khi người dùng rời trang rồi quay lại; không có nút thu gọn. Lệnh đọc Tổng quan, hàng ô số và các hành vi bấm giữ nguyên.
- **Hồ sơ** dùng bố cục biểu mẫu nhiều cột của Astryx (đọc `astryx component FormLayout` và `astryx docs layout`; lồng FormLayout theo hàng nếu component hỗ trợ), ba hàng 2, 2 và 3 ô, về một cột khi màn hẹp. Không đổi zod, nhãn, mô tả hay lệnh lưu.
- Mọi phần mới tuân luật giao diện của repo: chỉ component Astryx, không thẻ thô, không `className` hay `style`, không màu hay `px` rời; mọi điều khiển có focus ring; chữ hoàn toàn tiếng Việt.

## Testing Decisions

- **Test tốt** chỉ kiểm hành vi nhìn thấy từ bên ngoài. Luật thuần kiểm bằng bảng ca vào và ra. Giao diện kiểm bằng Testing Library với bản bộ nhớ của Kho dữ liệu, tìm phần tử theo vai trò và nhãn tiếng Việt. Không kiểm cách cài bên trong, không kiểm bố cục theo điểm ảnh hay chiều rộng thật. Thời điểm hiện tại luôn truyền vào, không đọc đồng hồ thật. Không mạng, không DB, không file ngoài repo.
- **Luật tìm và lọc việc cá nhân** có test riêng theo bảng ca: từ khoá khớp tiêu đề, Mã Dự án, tên Dự án; bỏ dấu và hoa thường; khoảng trắng hai đầu; "hoặc" trong nhóm, "và" giữa nhóm; Trễ hạn đúng biên nửa đêm giờ Việt Nam (Task hạn hôm nay chưa trễ); bộ lọc trống trả đủ danh sách và giữ thứ tự; số trên chip, kể cả chip số 0; hàm đang lọc.
- **Màn Việc của tôi và Chờ tôi duyệt**: gõ tìm thì bảng chỉ còn Task khớp; bật chip thì lọc đúng; chip có số; dòng "Hiện X trên Y Task" chỉ hiện khi đang lọc; lọc ra rỗng thì có "Không có Task khớp bộ lọc" và Xoá bộ lọc đưa về đủ danh sách; Chờ tôi duyệt không có nhóm chip Trạng thái; mở rồi đóng Ngăn trượt giữ bộ lọc; chip báo trạng thái bật cho công nghệ hỗ trợ; trang trống, đang tải, lỗi không hiện thanh lọc.
- **Màn Tổng quan**: các tiêu đề vùng xuất hiện đúng thứ tự trong tài liệu (ô số, Task Trễ hạn, Task tới hạn trong 7 ngày, Dự án đang hoạt động, Phân bố Task theo trạng thái); vùng trống báo bằng chữ và không có bảng trong vùng đó; vùng có hơn 5 Task chỉ hiện 5 dòng và nút "Xem tất cả (N)", bấm thì hiện đủ và nút biến mất, vùng có từ 5 Task trở xuống không có nút; các test Tổng quan hiện có vẫn xanh.
- **Màn Hồ sơ**: đủ bảy ô với đúng nhãn; sửa và lưu vẫn chạy như các test Hồ sơ hiện có. Việc xếp hai đến ba ô trên một hàng chỉ kiểm bằng mắt, không có tiêu chí tự động.
- **Ví dụ sẵn có để theo**: test luật lọc Task của Kanban và luật tìm Dự án (bảng ca), test luật Tiến độ và Trễ hạn (biên nửa đêm), test màn tìm và lọc Dự án, test màn Tổng quan, test màn Hồ sơ.
- Mọi test đi qua `npm test`. Test giao diện khai môi trường jsdom ở dòng đầu file.

## Out of Scope

- Tab cho Tổng quan (đã chọn xếp dọc).
- Nút thu gọn sau khi đã bấm Xem tất cả, phân trang, hay trang riêng liệt kê mọi Task Trễ hạn.
- Lọc theo Dự án hay theo Người kiểm tra, Người thực hiện bằng chip; ô tìm đã khớp tên và Mã Dự án.
- Giữ bộ lọc khi chuyển trang, khi tải lại trình duyệt, hoặc ghi bộ lọc lên đường dẫn.
- Đổi thứ tự sắp xếp của Việc của tôi và Chờ tôi duyệt, hay cho người dùng chọn cột sắp xếp.
- Tìm và lọc ở trang khác (Kanban của Dự án, Người dùng).
- Đổi nội dung, trường hay quy tắc kiểm của Hồ sơ.
- Mọi thay đổi ở bản Supabase, migration hay Edge Function.
- Đổi theme, độ dày khoảng cách toàn ứng dụng.

## Further Notes

- **Nhánh đích**: các Run đáp lên `bo-cuc-giao-dien` (chưa push, chưa gộp `main`), vì Tổng quan mới, cột Mức ưu tiên và Thông tin nhân sự chỉ có trên nhánh đó.
- **Bảng ticket AI**: repo này chưa được khai báo. Trước `/begin` cần khai báo với Lệnh test `npm test`. Bộ test của repo đã không dùng mạng hay DB, nên không cần danh sách bỏ qua. Repo không có hook ghép code với tài liệu, nên ticket không cần ghi chú doc-sync.
- Ba phần (Tổng quan, tìm và lọc việc cá nhân, Hồ sơ) không đụng nhau và có thể làm song song.
- Sau khi đáp, chủ dự án xem tận mắt Tổng quan và Hồ sơ trên màn rộng và màn hẹp, vì bố cục không có tiêu chí tự động.
