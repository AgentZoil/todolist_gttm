# Hệ thống theo dõi và đánh giá nhiệm vụ — v1.1

> **Tài liệu thiết kế hệ thống — bản chuyển đổi Markdown tối ưu cho Coding Agent**
> 
> Requirement · User & Role · Task Data · Business Rules · Dashboard · Technical Design

## Document Metadata

| Field | Value |
|---|---|
| Phiên bản | 1.1 — Bản rà soát & hiệu chỉnh |
| Cập nhật | 18/08/2026 |
| Trạng thái | Thay thế phiên bản 1.0 |
| Phạm vi | MVP |

## Coding-Agent Reading Rules

- Tài liệu này giữ nguyên nội dung và yêu cầu của bản DOCX v1.1; chỉ thay đổi cách trình bày để dễ đọc, tìm kiếm và triển khai.
- Các **Business Rule**, **Role/Permission**, **Data Model**, **API**, **Security**, **Lock/Finalize** và **Testing** là các phần cần được đọc như yêu cầu kỹ thuật/nghiệp vụ của MVP.
- Không suy diễn thêm chức năng ngoài phạm vi tài liệu.
- `status`/`Tình trạng` là giá trị hệ thống tính toán, không phải field cho user tùy ý sửa.

---


## Implementation Index

| Area | Source section(s) |
|---|---|
| Requirements / MVP | §1 |
| Roles & permissions | §2 |
| Task data | §3 |
| Business rules / status | §4 |
| Period lock / finalize / audit | §4.8–§4.11 |
| Dashboard | §5 |
| Architecture | §6.2 |
| Frontend | §6.3 |
| Backend | §6.4 |
| Database / schema | §6.5 |
| Authentication / authorization / RLS | §6.6 |
| REST API | §6.7 |
| Business logic / transaction | §6.8 |
| Status calculation | §6.9 |
| Dashboard architecture | §6.10–§6.11 |
| Cache / storage / security | §6.12–§6.14 |
| Indexing / scalability | §6.15–§6.16 |
| Deployment / monitoring / backup | §6.18–§6.20 |
| Testing | §6.21 |
| Final technology stack | §6.22 |
| Final design principles / architecture | §6.23–§6.24 |


Requirement · User & Role · Task Data · Business Rules · Dashboard · Technical Design

Phiên bản 1.1 — Bản rà soát & hiệu chỉnh

Cập nhật ngày 18/08/2026 · Thay thế phiên bản 1.0

Phạm vi: MVP

## Mục lục
## 0. GHI CHÚ CẬP NHẬT SO VỚI PHIÊN BẢN 1.0
## 1. YÊU CẦU HỆ THỐNG
### 1.1. Mục tiêu
### 1.2. Đối tượng sử dụng
### 1.3. Chức năng chính
### 1.4. Phạm vi MVP
## 2. USER & ROLE — NGƯỜI DÙNG VÀ PHÂN QUYỀN
### 2.1. Nguyên tắc phân quyền
### 2.2. Role 1 — Admin / Quyền tối cao
### 2.3. Role 2 — Thư ký / Người giao nhiệm vụ
### 2.4. Role 3 — Phòng ban (DEPARTMENT_EDITOR)
### 2.5. Quyền của đơn vị phối hợp
### 2.6. Role 4 — Viewer
### 2.7. Phân quyền theo phòng ban
## 3. TASK DATA — DỮ LIỆU NHIỆM VỤ
### 3.1. Thông tin nhiệm vụ
### 3.2. Bảng dữ liệu nghiệp vụ tối thiểu
## 4. BUSINESS RULE — QUY TẮC NGHIỆP VỤ
### 4.1. Quy tắc xác định tình trạng
### 4.2. Trạng thái "Đang thực hiện"
### 4.3. Trạng thái "Hoàn thành trước hạn"
### 4.4. Trạng thái "Hoàn thành đúng hạn"
### 4.5. Trạng thái "Hoàn thành quá hạn"
### 4.6. Nhiệm vụ không có ngày yêu cầu hoàn thành
### 4.7. Bảng logic trạng thái
### 4.8. Quy tắc khóa dữ liệu theo tháng
### 4.9. Dữ liệu nào bị khóa?
### 4.10. Quyền Admin đối với dữ liệu đã khóa
### 4.11. Audit Log
## 5. DASHBOARD — BẢNG TỔNG HỢP
### 5.1. Mục tiêu
### 5.2. Nguyên tắc xác định tháng
### 5.3. Dashboard tháng hiện tại
### 5.4. Các chỉ số tổng quan
### 5.5. Tỷ lệ hoàn thành
### 5.6. Dashboard theo 22 phòng ban
### 5.7. Dashboard trực quan
### 5.8. Dashboard phải phản ánh dữ liệu thực tế
### 5.9. Quy tắc khi dữ liệu đã khóa/đã chốt
## 6. TECHNICAL DESIGN
### 6.1. Mục tiêu
### 6.2. Kiến trúc tổng thể
### 6.3. Frontend
### 6.4. Backend
### 6.5. Database
### 6.6. Authentication & Authorization
### 6.7. API Design
### 6.8. Business Logic
### 6.9. Status Calculation
### 6.10. Dashboard Architecture
### 6.11. Dashboard theo phòng ban
### 6.12. Cache
### 6.13. Storage
### 6.14. Security
### 6.15. Database Indexing
### 6.16. Scalability
### 6.17. Khả năng mở rộng sau này
### 6.18. Deployment
### 6.19. Monitoring & Logging
### 6.20. Backup
### 6.21. Testing Strategy
### 6.22. Công nghệ chốt
### 6.23. Nguyên tắc thiết kế cuối cùng
### 6.24. Kiến trúc chốt
## 0. GHI CHÚ CẬP NHẬT SO VỚI PHIÊN BẢN 1.0
Bản 1.1 giữ nguyên toàn bộ phạm vi MVP đã thống nhất ở bản 1.0. Các thay đổi dưới đây là hiệu chỉnh về logic nghiệp vụ và thiết kế kỹ thuật nhằm loại bỏ mâu thuẫn nội tại, không mở rộng phạm vi chức năng.

| # | Vấn đề ở bản 1.0 | Rủi ro nếu giữ nguyên | Hiệu chỉnh áp dụng ở bản 1.1 |
| --- | --- | --- | --- |
| 1 | Khóa dữ liệu theo tháng áp dụng cho toàn bộ nhiệm vụ, kể cả nhiệm vụ chưa hoàn thành/quá hạn. | Nhiệm vụ quá hạn nhiều tháng — đối tượng cần theo dõi nhất — lại bị khóa sớm nhất, buộc phải xin Admin mở khóa liên tục. | Tách trường dữ liệu thành 2 nhóm; chỉ khóa nhóm khai báo, nhóm hoàn thành vẫn mở đến khi nhiệm vụ được "chốt" (xem mục 4.8). |
| 2 | Chưa định nghĩa quyền của "đơn vị phối hợp" trên nhiệm vụ. | Đơn vị phối hợp không biết mình được giao phối hợp việc gì, hoặc ngược lại có thể vô tình được cấp quyền sửa nhiệm vụ không sở hữu. | Bổ sung mục 2.5: đơn vị phối hợp có quyền xem (read-only) nhiệm vụ liên quan, không có quyền chỉnh sửa. |
| 3 | "Đơn vị phối hợp" thiết kế như một cột dữ liệu đơn trong bảng tasks. | Không đảm bảo toàn vẹn tham chiếu, khó áp Row Level Security, khó truy vấn theo phòng ban. | Tách thành bảng quan hệ task_coordinating_departments (mục 6.5.6). |
| 4 | RLS được mô tả là lớp bảo vệ bổ sung nhưng chưa nêu cách Prisma truyền context người dùng vào Postgres. | Nếu không cấu hình, RLS không thực sự được kích hoạt — gây hiểu nhầm về mức độ bảo mật thực tế. | Bổ sung yêu cầu kỹ thuật rõ ràng cho việc truyền JWT claims theo từng request (mục 6.6.4). |
| 5 | Luồng cập nhật nhiệm vụ + tính trạng thái + ghi audit log chưa yêu cầu transaction. | Có thể xảy ra dữ liệu nhiệm vụ và audit log không đồng bộ nếu một bước thất bại. | Quy định rõ toàn bộ luồng phải nằm trong một database transaction (mục 6.8). |
| 6 | Chưa có cơ chế xử lý nhiệm vụ bị giao nhầm/không còn hiệu lực; chưa có kiểm soát ghi đè khi 2 người sửa cùng lúc. | Không thể loại nhiệm vụ sai khỏi dashboard mà vẫn giữ dấu vết; rủi ro mất dữ liệu do ghi đè. | Bổ sung trạng thái "Đã hủy" (is_cancelled) và cơ chế optimistic locking bằng cột version (mục 3.1, 6.5.6, 6.14). |

| 🔧 Các điểm hiệu chỉnh nhỏ khác<br>• Tỷ lệ hoàn thành trên dashboard được tách thành hai chỉ số riêng biệt để không đánh đồng nhiệm vụ quá hạn với nhiệm vụ đúng hạn (mục 5.5).<br>• Bổ sung phân trang/lọc cho API danh sách nhiệm vụ (mục 6.7.1).<br>• Bổ sung nguyên tắc kiểm thử (unit test) cho logic tính trạng thái — đây là quy tắc nghiệp vụ lõi (mục 6.21).<br>• Thống nhất tên gọi vai trò "Phòng ban" = DEPARTMENT_EDITOR xuyên suốt tài liệu.<br>• Làm rõ phạm vi module reports/ là dự trữ cho giai đoạn sau, chưa triển khai trong MVP. |
| --- |

## 1. YÊU CẦU HỆ THỐNG
### 1.1. Mục tiêu
Xây dựng một web app dùng để quản lý, theo dõi và tổng hợp tình trạng thực hiện nhiệm vụ của các phòng ban thuộc Cục.

Hệ thống phục vụ việc:

Ghi nhận nhiệm vụ được giao.

Theo dõi đơn vị/phòng ban thực hiện.

Theo dõi thời hạn hoàn thành.

Ghi nhận ngày hoàn thành thực tế.

Tự động đánh giá tình trạng hoàn thành dựa trên ngày yêu cầu hoàn thành và ngày hoàn thành thực tế.

Lưu bằng chứng hoàn thành.

Theo dõi lịch sử thay đổi dữ liệu.

Tổng hợp tình hình thực hiện nhiệm vụ theo tháng.

Cung cấp dashboard trực quan cho việc theo dõi tổng thể 22 phòng ban.

### 1.2. Đối tượng sử dụng
Hệ thống dự kiến phục vụ: lãnh đạo/người có quyền quản trị cao nhất, thư ký và người giao nhiệm vụ, người dùng thuộc 22 phòng ban của Cục, và người dùng chỉ có quyền xem.

| Nhóm tài khoản | Số lượng dự kiến |
| --- | --- |
| Mỗi phòng ban — quyền chỉnh sửa | 2 tài khoản / phòng ban |
| Mỗi phòng ban — chỉ xem | 3 tài khoản / phòng ban |
| Thư ký | 5 tài khoản |
| Quyền cao nhất (Admin) | 1 hoặc một số tài khoản |
| Tổng quy mô ban đầu | ≈ 120 tài khoản |

### 1.3. Chức năng chính
#### 1.3.1. Quản lý nhiệm vụ
Người có quyền phù hợp có thể: tạo nhiệm vụ, nhập/chỉnh sửa thông tin nhiệm vụ, nhập ngày hoàn thành thực tế, nhập bằng chứng hoàn thành, và theo dõi tình trạng nhiệm vụ.

#### 1.3.2. Theo dõi tình trạng tự động
Hệ thống tự động xác định tình trạng nhiệm vụ dựa trên ngày yêu cầu hoàn thành và ngày hoàn thành thực tế. Người dùng không tự nhập trạng thái hoàn thành — hệ thống tự tính theo quy tắc tại mục 4.

#### 1.3.3. Dashboard
Dashboard tổng hợp tập trung vào tháng hiện tại và 22 phòng ban: tổng số nhiệm vụ, số nhiệm vụ theo từng trạng thái, tỷ lệ hoàn thành, và so sánh tình hình giữa các phòng ban. Các chỉ số được xác định theo tháng của Ngày yêu cầu hoàn thành.

#### 1.3.4. Audit Log
Hệ thống lưu lịch sử thay đổi dữ liệu, giúp xác định: ai thực hiện thay đổi, thay đổi vào thời điểm nào, thay đổi trường dữ liệu nào, giá trị trước và sau khi thay đổi. Audit log không phải là dữ liệu để người dùng thông thường chỉnh sửa.

### 1.4. Phạm vi MVP
MVP tập trung vào:

Quản lý người dùng và phân quyền.

Quản lý nhiệm vụ, bao gồm trạng thái "Đã hủy" cho nhiệm vụ không còn hiệu lực.

Tự động xác định tình trạng nhiệm vụ.

Khóa dữ liệu theo tháng đối với nhóm trường khai báo; cơ chế "chốt nhiệm vụ" thủ công đối với nhóm trường hoàn thành.

Audit log.

Dashboard tổng hợp theo tháng.

Quản lý dữ liệu theo 22 phòng ban, bao gồm quyền xem của đơn vị phối hợp.

Các chức năng mở rộng như thông báo, email, upload file, mobile app, tích hợp hệ thống khác, và module báo cáo xuất file (reports/) chưa thuộc phạm vi tài liệu này.

## 2. USER & ROLE — NGƯỜI DÙNG VÀ PHÂN QUYỀN
### 2.1. Nguyên tắc phân quyền
Mỗi tài khoản người dùng có tối thiểu hai thuộc tính quyết định phạm vi truy cập:

| Thuộc tính | Ý nghĩa |
| --- | --- |
| role | Xác định người dùng được phép làm gì (RBAC). |
| department_id | Xác định người dùng thuộc phòng ban nào. |

Quyền truy cập luôn được kiểm soát dựa trên cả role và phòng ban, không dựa riêng lẻ vào một trong hai.

### 2.2. Role 1 — Admin / Quyền tối cao
Đây là quyền cao nhất trong hệ thống. Có quyền:

Xem, tạo và chỉnh sửa tất cả nhiệm vụ của mọi phòng ban.

Xem dashboard tổng hợp và audit log.

Mở khóa dữ liệu đã khóa theo tháng và chỉnh sửa dữ liệu sau khi tháng đã kết thúc.

Chốt (finalize) hoặc mở lại (un-finalize) nhiệm vụ theo mục 4.8.

Quản lý người dùng và phân quyền.

Admin là role duy nhất có quyền vượt qua quy tắc khóa dữ liệu và quy tắc chốt nhiệm vụ thông thường.

### 2.3. Role 2 — Thư ký / Người giao nhiệm vụ
Có quyền: tạo nhiệm vụ; xem các nhiệm vụ được phép truy cập; chỉnh sửa thông tin nhiệm vụ; nhập ngày hoàn thành thực tế; nhập bằng chứng hoàn thành; theo dõi tình trạng nhiệm vụ; xem dashboard theo phạm vi được cấp; và chốt nhiệm vụ khi đã đủ điều kiện (mục 4.8).

Các trường nghiệp vụ chính có thể nhập/chỉnh sửa:

Nội dung nhiệm vụ, nguồn giao nhiệm vụ, ngày giao nhiệm vụ, lãnh đạo giao nhiệm vụ, số/ký hiệu văn bản.

Đơn vị thực hiện, đơn vị phối hợp, ngày yêu cầu hoàn thành.

Ngày hoàn thành thực tế, bằng chứng hoàn thành.

Thư ký/người giao nhiệm vụ không được tự sửa trường trạng thái tự động — trạng thái do hệ thống tính toán. Sau khi hết tháng, nhóm trường khai báo bị khóa theo quy định tại mục 4.8; thư ký không được tự ý sửa dữ liệu đã khóa hoặc nhiệm vụ đã được chốt.

### 2.4. Role 3 — Phòng ban (DEPARTMENT_EDITOR)
Người dùng thuộc phòng ban, với vai trò là đơn vị thực hiện (owner_department_id) của nhiệm vụ, được phép:

Xem nhiệm vụ của phòng ban mình.

Tạo/chỉnh sửa nhiệm vụ trong phạm vi được cấp.

Nhập ngày hoàn thành thực tế và bằng chứng hoàn thành.

Theo dõi tình trạng nhiệm vụ của phòng ban.

Người dùng phòng ban không được xem hoặc chỉnh sửa dữ liệu thuộc phòng ban khác, trừ trường hợp được Admin cấp quyền phù hợp, hoặc trường hợp là đơn vị phối hợp theo mục 2.5.

Ví dụ: User A có department_id = PHONG_01 → có quyền với nhiệm vụ mà PHONG_01 là đơn vị thực hiện → không có quyền chỉnh sửa nhiệm vụ do PHONG_02 thực hiện.

### 2.5. Quyền của đơn vị phối hợp

| 🔧 Mục bổ sung ở bản 1.1<br>• Bản 1.0 chưa định nghĩa quyền truy cập cho đơn vị phối hợp dù dữ liệu nhiệm vụ cho phép khai báo trường này. |
| --- |

Một nhiệm vụ có thể có một đơn vị thực hiện chính (owner_department_id) và một hoặc nhiều đơn vị phối hợp (coordinating_departments). Quyền của hai nhóm này khác nhau:

| Vai trò trên nhiệm vụ | Xem nhiệm vụ | Chỉnh sửa nhiệm vụ |
| --- | --- | --- |
| Đơn vị thực hiện (owner) | Có | Có, theo role và trạng thái khóa/chốt |
| Đơn vị phối hợp | Có (read-only) | Không, trừ khi Admin cấp quyền riêng |
| Phòng ban khác (không liên quan) | Không | Không |

Người dùng thuộc đơn vị phối hợp nhìn thấy đầy đủ nội dung nhiệm vụ (bao gồm trạng thái và bằng chứng) nhưng không có nút chỉnh sửa; nếu cần phối hợp cập nhật dữ liệu, đơn vị phối hợp trao đổi với đơn vị thực hiện hoặc thư ký. Việc mở rộng quyền chỉnh sửa cho đơn vị phối hợp cho một nhiệm vụ cụ thể, nếu phát sinh nhu cầu thực tế, do Admin cấp thủ công và không thuộc phạm vi tự động hóa của MVP.

### 2.6. Role 4 — Viewer
Viewer chỉ có quyền xem. Được phép xem nhiệm vụ được cấp quyền, xem trạng thái, xem dashboard và các thông tin được phép hiển thị.

Không được phép: tạo nhiệm vụ, chỉnh sửa nhiệm vụ, thay đổi ngày hoàn thành, thay đổi bằng chứng, thay đổi deadline, hoặc thay đổi trạng thái.

### 2.7. Phân quyền theo phòng ban
Hệ thống phải phân biệt rõ Role + Department, ví dụ:

| User | Role | Department | Phạm vi |
| --- | --- | --- | --- |
| A | Admin | Cục | Tất cả |
| B | Thư ký | Cục | Theo quyền được cấp |
| C | DEPARTMENT_EDITOR | Phòng 01 | Phòng 01 (owner); xem read-only các nhiệm vụ Phòng 01 là đơn vị phối hợp |
| D | DEPARTMENT_EDITOR | Phòng 02 | Phòng 02 (owner) |
| E | Viewer | Phòng 01 | Phòng 01 (chỉ xem) |

Việc một người dùng thuộc phòng ban nào phải được xác định trong tài khoản, không để người dùng tự lựa chọn để vượt quyền.

## 3. TASK DATA — DỮ LIỆU NHIỆM VỤ
Mỗi nhiệm vụ là một bản ghi độc lập trong hệ thống.

### 3.1. Thông tin nhiệm vụ
A. Nội dung nhiệm vụ

Mô tả công việc/nhiệm vụ được giao. Ví dụ: "Hoàn thiện báo cáo tổng hợp tình hình thực hiện..."

B. Nguồn giao nhiệm vụ

Nguồn phát sinh nhiệm vụ: lãnh đạo Cục, văn bản, cuộc họp, chỉ đạo trực tiếp, nguồn khác.

C. Ngày giao nhiệm vụ

Ngày nhiệm vụ được giao.

D. Lãnh đạo giao nhiệm vụ

Người/lãnh đạo giao nhiệm vụ.

E. Số/ký hiệu văn bản giao nhiệm vụ

Số và ký hiệu văn bản nếu nhiệm vụ phát sinh từ văn bản. Có thể để trống nếu nhiệm vụ không có văn bản.

F. Đơn vị/phòng ban thực hiện

Phòng ban chịu trách nhiệm chính (owner). Đây là dữ liệu quan trọng để áp dụng phân quyền.

G. Đơn vị phối hợp

Các đơn vị/phòng ban phối hợp thực hiện — quan hệ nhiều-nhiều, được lưu ở bảng riêng (mục 6.5.6). Có quyền xem read-only theo mục 2.5.

H. Ngày yêu cầu hoàn thành

Deadline của nhiệm vụ — trường quan trọng nhất để xác định tháng dashboard, đánh giá tình trạng và làm mốc khóa dữ liệu.

I. Ngày hoàn thành thực tế

Ngày nhiệm vụ thực tế được hoàn thành. Có thể chưa có giá trị nếu nhiệm vụ chưa hoàn thành, và vẫn có thể nhập sau khi tháng deadline đã khóa (mục 4.8).

J. Bằng chứng hoàn thành

Trong MVP, nhập dưới dạng text, ví dụ: "Đã hoàn thành báo cáo số 123/BC-CVC ngày 28/08/2026." Chưa yêu cầu upload file.

K. Tình trạng nhiệm vụ

Trường do hệ thống tự động tính toán. Người dùng không trực tiếp nhập. Các trạng thái quy định tại mục 4.

L. Trạng thái hủy nhiệm vụ (is_cancelled)

| 🔧 Trường bổ sung ở bản 1.1<br>• Bổ sung để xử lý nhiệm vụ bị giao nhầm hoặc không còn hiệu lực, tránh phải xóa cứng dữ liệu (mất dấu vết audit). |
| --- |

Cờ đánh dấu nhiệm vụ không còn hiệu lực, tách biệt hoàn toàn khỏi trạng thái tự động tính ở mục K. Chỉ Thư ký hoặc Admin có quyền đặt cờ này, và mọi thay đổi đều được ghi Audit Log. Khi is_cancelled = true, hệ thống hiển thị trạng thái "Đã hủy" thay cho các trạng thái Đang thực hiện/Trước hạn/Đúng hạn/Quá hạn, và nhiệm vụ được loại khỏi các chỉ số tiến độ mặc định trên dashboard (mục 5.5), dù vẫn có thể lọc xem riêng khi cần.

### 3.2. Bảng dữ liệu nghiệp vụ tối thiểu

| Trường | Bắt buộc | Người dùng nhập? | Hệ thống tự tính? |
| --- | --- | --- | --- |
| Nội dung nhiệm vụ | Có | Có | Không |
| Nguồn giao NV | Có | Có | Không |
| Ngày giao NV | Có | Có | Không |
| Lãnh đạo giao NV | Có | Có | Không |
| Số/ký hiệu VB | Tùy trường hợp | Có | Không |
| Đơn vị thực hiện | Có | Có | Không |
| Đơn vị phối hợp (bảng quan hệ) | Không | Có | Không |
| Ngày YC hoàn thành | Không* | Có | Không |
| Ngày hoàn thành thực tế | Không | Có | Không |
| Bằng chứng hoàn thành | Không | Có | Không |
| Tình trạng | Không | Không | Có |
| Đã hủy (is_cancelled) | Không | Có (Thư ký/Admin) | Không |

* Nếu không có ngày yêu cầu hoàn thành thì hệ thống không đánh giá tình trạng theo thời hạn.

## 4. BUSINESS RULE — QUY TẮC NGHIỆP VỤ
### 4.1. Quy tắc xác định tình trạng
Tình trạng được xác định dựa trên Ngày yêu cầu hoàn thành và Ngày hoàn thành thực tế. Quy tắc này chỉ áp dụng khi nhiệm vụ chưa bị đánh dấu "Đã hủy" (mục 3.1.L).

### 4.2. Trạng thái "Đang thực hiện"
Điều kiện: Ngày hoàn thành thực tế = NULL và nhiệm vụ có ngày yêu cầu hoàn thành. Trạng thái này phản ánh rằng người dùng chưa nhập ngày hoàn thành thực tế.

### 4.3. Trạng thái "Hoàn thành trước hạn"
Điều kiện: Ngày hoàn thành thực tế < Ngày yêu cầu hoàn thành.

Ví dụ: Ngày yêu cầu hoàn thành 20/08/2026, Ngày hoàn thành thực tế 18/08/2026 → Hoàn thành trước hạn.

### 4.4. Trạng thái "Hoàn thành đúng hạn"
Điều kiện: Ngày hoàn thành thực tế = Ngày yêu cầu hoàn thành.

Ví dụ: Ngày yêu cầu hoàn thành 20/08/2026, Ngày hoàn thành thực tế 20/08/2026 → Hoàn thành đúng hạn.

### 4.5. Trạng thái "Hoàn thành quá hạn"
Điều kiện: Ngày hoàn thành thực tế > Ngày yêu cầu hoàn thành.

Ví dụ: Ngày yêu cầu hoàn thành 20/08/2026, Ngày hoàn thành thực tế 23/08/2026 → Hoàn thành quá hạn.

### 4.6. Nhiệm vụ không có ngày yêu cầu hoàn thành
Nếu Ngày yêu cầu hoàn thành = NULL, hệ thống không đánh giá trước hạn/đúng hạn/quá hạn, không dùng deadline để xác định tình trạng, và hiển thị "Không đánh giá". Điều này tránh việc hệ thống tự suy đoán thời hạn của nhiệm vụ.

### 4.7. Bảng logic trạng thái

| Đã hủy? | Ngày YC hoàn thành | Ngày HT thực tế | Tình trạng hiển thị |
| --- | --- | --- | --- |
| Có | — | — | Đã hủy |
| Không | Có | Chưa có | Đang thực hiện |
| Không | Có | Trước deadline | Hoàn thành trước hạn |
| Không | Có | Đúng deadline | Hoàn thành đúng hạn |
| Không | Có | Sau deadline | Hoàn thành quá hạn |
| Không | Không có | Chưa có | Không đánh giá |
| Không | Không có | Có | Không đánh giá |

### 4.8. Quy tắc khóa dữ liệu theo tháng

| 🔧 Hiệu chỉnh quan trọng ở bản 1.1<br>• Bản 1.0 khóa toàn bộ nhiệm vụ theo tháng của Ngày YC hoàn thành, kể cả khi nhiệm vụ chưa hoàn thành — khiến nhiệm vụ quá hạn nhiều tháng liên tục cần Admin mở khóa để cập nhật.<br>• Bản 1.1 tách trường dữ liệu thành 2 nhóm và thêm khái niệm "chốt nhiệm vụ" để giải quyết mâu thuẫn này trong khi vẫn giữ nguyên tắc khóa theo tháng. |
| --- |

Trường dữ liệu của một nhiệm vụ được chia thành hai nhóm:

| Nhóm | Bao gồm | Cơ chế khóa |
| --- | --- | --- |
| Nhóm A — Thông tin khai báo | Nội dung, nguồn giao NV, ngày giao NV, lãnh đạo giao NV, số/ký hiệu VB, đơn vị thực hiện, đơn vị phối hợp, ngày YC hoàn thành | Tự động khóa khi tháng của Ngày YC hoàn thành kết thúc |
| Nhóm B — Thông tin hoàn thành | Ngày hoàn thành thực tế, bằng chứng hoàn thành | Không tự động khóa theo tháng; vẫn chỉnh sửa được cho đến khi nhiệm vụ được "chốt" thủ công |

Cơ chế "chốt nhiệm vụ" (is_finalized):

Thư ký hoặc người dùng phòng ban (owner) chốt nhiệm vụ khi đã nhập xong ngày hoàn thành thực tế và bằng chứng, không còn nhu cầu chỉnh sửa thêm.

Sau khi chốt, cả Nhóm A và Nhóm B đều không thể chỉnh sửa bởi người dùng thông thường, kể cả khi đang trong tháng hiện tại.

Nhiệm vụ chưa được chốt vẫn có thể cập nhật Nhóm B bất kể đã qua bao nhiêu tháng kể từ Ngày YC hoàn thành, không cần Admin can thiệp — giải quyết đúng bài toán nhiệm vụ quá hạn kéo dài.

Chỉ Admin có quyền mở lại (un-finalize) một nhiệm vụ đã chốt.

Ví dụ minh họa:

Nhiệm vụ có Ngày YC hoàn thành: 25/08/2026. Trong tháng 08/2026, Nhóm A và Nhóm B đều chỉnh sửa được theo quyền. Từ 01/09/2026: Nhóm A (nội dung, nguồn giao, đơn vị thực hiện...) bị khóa tự động. Nếu đến 15/10/2026 nhiệm vụ vẫn chưa hoàn thành, người dùng phòng ban vẫn nhập được Ngày hoàn thành thực tế và bằng chứng (Nhóm B) mà không cần Admin mở khóa, cho đến khi nhiệm vụ được chốt.

### 4.9. Dữ liệu nào bị khóa?
Khi tháng đã kết thúc, người dùng thông thường không được thay đổi các trường thuộc Nhóm A. Trường "Tình trạng" không bao giờ cho phép người dùng chỉnh sửa trực tiếp vì đây là trường hệ thống tự động tính. Khi nhiệm vụ đã được chốt (is_finalized = true), cả Nhóm A và Nhóm B đều bị khóa.

### 4.10. Quyền Admin đối với dữ liệu đã khóa
Admin có quyền: xem dữ liệu đã khóa/đã chốt; mở khóa Nhóm A của tháng đã kết thúc; mở lại (un-finalize) nhiệm vụ đã chốt; và chỉnh sửa dữ liệu khi cần thiết. Mọi thay đổi của Admin đối với dữ liệu đã khóa hoặc đã chốt phải được ghi vào Audit Log.

### 4.11. Audit Log
Mọi thay đổi quan trọng đối với dữ liệu nhiệm vụ phải được ghi nhận. Một log tối thiểu gồm: thời gian, người thực hiện, nhiệm vụ, trường dữ liệu thay đổi, giá trị cũ, giá trị mới.

| Thời gian | Người thực hiện | Nhiệm vụ | Trường thay đổi | Giá trị cũ | Giá trị mới |
| --- | --- | --- | --- | --- | --- |
| 18/08/2026 09:10 | Nguyễn Văn A | NV-000123 | Ngày yêu cầu hoàn thành | 20/08/2026 | 25/08/2026 |

Audit Log phải được lưu lại kể cả khi dữ liệu nhiệm vụ sau đó tiếp tục bị chỉnh sửa.

| 🔧 Ghi chú bổ sung<br>• MVP lưu audit log không giới hạn thời gian. Đề xuất xây dựng chính sách archive (ví dụ chuyển log cũ hơn 24 tháng sang lưu trữ lạnh) ở giai đoạn sau khi khối lượng dữ liệu thực tế tăng lên — không thuộc phạm vi MVP hiện tại. |
| --- |

## 5. DASHBOARD — BẢNG TỔNG HỢP
### 5.1. Mục tiêu
Dashboard giúp lãnh đạo và người có quyền nhanh chóng trả lời: trong tháng này có bao nhiêu nhiệm vụ; bao nhiêu đã hoàn thành; bao nhiêu đang thực hiện; bao nhiêu hoàn thành trước hạn/đúng hạn/quá hạn; và phòng ban nào đang có nhiều nhiệm vụ quá hạn.

### 5.2. Nguyên tắc xác định tháng
Dashboard phân loại nhiệm vụ theo Ngày yêu cầu hoàn thành. Không sử dụng ngày giao nhiệm vụ hoặc ngày hoàn thành thực tế để xác định tháng dashboard.

Ví dụ: Ngày giao 25/07/2026, Ngày YC hoàn thành 05/08/2026, Ngày HT thực tế 04/08/2026 → thuộc dashboard tháng 08/2026.

### 5.3. Dashboard tháng hiện tại
Khi người dùng mở dashboard, mặc định hiển thị tháng hiện tại (ví dụ: DASHBOARD NHIỆM VỤ — THÁNG 08/2026).

### 5.4. Các chỉ số tổng quan

| Chỉ số | Cách tính |
| --- | --- |
| Tổng số nhiệm vụ | Tổng số nhiệm vụ có Ngày YC hoàn thành thuộc tháng đang xem, chưa hủy |
| Đang thực hiện | Có Ngày YC hoàn thành + chưa có Ngày HT thực tế |
| Hoàn thành trước hạn | Ngày HT thực tế < Ngày YC hoàn thành |
| Hoàn thành đúng hạn | Ngày HT thực tế = Ngày YC hoàn thành |
| Hoàn thành quá hạn | Ngày HT thực tế > Ngày YC hoàn thành |
| Không đánh giá | Không có Ngày YC hoàn thành (tách riêng khỏi chỉ số tiến độ) |
| Đã hủy | is_cancelled = true (hiển thị riêng, không tính vào các chỉ số trên) |

### 5.5. Tỷ lệ hoàn thành

| 🔧 Hiệu chỉnh ở bản 1.1<br>• Bản 1.0 tính "tỷ lệ hoàn thành" chỉ dựa trên việc có Ngày HT thực tế hay chưa — điều này gộp chung nhiệm vụ hoàn thành quá hạn với nhiệm vụ hoàn thành đúng/trước hạn, dễ gây hiểu nhầm cho người xem dashboard.<br>• Bản 1.1 tách thành hai chỉ số độc lập. |
| --- |

Tỷ lệ xử lý: số nhiệm vụ đã có Ngày HT thực tế / tổng số nhiệm vụ có Ngày YC hoàn thành (không tính nhiệm vụ đã hủy) × 100%. Cho biết mức độ nhiệm vụ đã được đóng lại, bất kể đúng hay trễ hạn.

Tỷ lệ đúng hạn: số nhiệm vụ hoàn thành trước hạn hoặc đúng hạn / tổng số nhiệm vụ đã xử lý xong × 100%. Cho biết chất lượng thực hiện đúng tiến độ.

Nhiệm vụ không có ngày yêu cầu hoàn thành và nhiệm vụ đã hủy không được đưa vào mẫu số của cả hai chỉ số trên.

### 5.6. Dashboard theo 22 phòng ban
Dashboard cần có bảng tổng hợp theo từng phòng ban:

| Phòng ban | Tổng NV | Đang TH | Trước hạn | Đúng hạn | Quá hạn | Đã hủy |
| --- | --- | --- | --- | --- | --- | --- |
| Phòng 01 | 20 | 4 | 8 | 6 | 2 | 0 |
| Phòng 02 | 15 | 3 | 5 | 6 | 1 | 0 |
| Phòng 03 | 18 | 5 | 7 | 4 | 2 | 1 |
| ... | ... | ... | ... | ... | ... | ... |
| Phòng 22 | ... | ... | ... | ... | ... | ... |

Mục tiêu là để người xem có thể nhìn nhanh tình hình của toàn bộ 22 phòng ban.

### 5.7. Dashboard trực quan
Dashboard nên ưu tiên cách trình bày đơn giản, dễ hiểu, có thể gồm:

Khu vực 1 — Tổng quan

Tổng nhiệm vụ · Đang thực hiện · Hoàn thành · Quá hạn

Khu vực 2 — Phân loại tình trạng

Biểu đồ thể hiện: Trước hạn · Đúng hạn · Quá hạn · Đang thực hiện

Khu vực 3 — So sánh 22 phòng ban

Bảng hoặc biểu đồ cho phép nhìn nhanh theo phòng ban: tổng nhiệm vụ → đã hoàn thành → đang thực hiện → quá hạn.

### 5.8. Dashboard phải phản ánh dữ liệu thực tế
Dashboard không phải dữ liệu nhập riêng — tất cả số liệu phải được hệ thống tính từ dữ liệu nhiệm vụ, theo luồng: Dữ liệu nhiệm vụ → Ngày YC hoàn thành → Xác định tháng → Ngày HT thực tế → Tính trạng thái (có kiểm tra is_cancelled) → Tổng hợp → Dashboard. Nếu một nhiệm vụ thay đổi ngày hoàn thành thực tế, trạng thái và số liệu dashboard liên quan phải được cập nhật theo quy tắc nghiệp vụ.

### 5.9. Quy tắc khi dữ liệu đã khóa/đã chốt
Sau khi tháng kết thúc, Nhóm A của tháng đó bị khóa nhưng dashboard tháng đó tiếp tục được tính lại mỗi khi Nhóm B (Ngày HT thực tế) thay đổi, cho đến khi nhiệm vụ được chốt. Nếu Admin mở khóa/mở lại và thay đổi dữ liệu: thay đổi được ghi Audit Log → hệ thống tính lại trạng thái → dashboard được cập nhật theo dữ liệu mới. Việc Admin thay đổi dữ liệu sau khi khóa/chốt phải được truy vết thông qua Audit Log.

## 6. TECHNICAL DESIGN
### 6.1. Mục tiêu
Technical Design mô tả cách hệ thống được xây dựng về mặt kỹ thuật dựa trên các yêu cầu nghiệp vụ đã chốt tại các phần 1–5. Mục tiêu thiết kế:

Kiến trúc đơn giản để một developer có thể phát triển.

Sử dụng công nghệ hiện đại, phổ biến và dễ tích hợp.

Có khả năng mở rộng khi số lượng người dùng và dữ liệu tăng.

Phân tách rõ giao diện, business logic và dữ liệu.

Đảm bảo phân quyền và bảo mật dữ liệu.

Không over-engineer trong giai đoạn MVP, nhưng có khả năng mở rộng chức năng trong tương lai.

### 6.2. Kiến trúc tổng thể
Hệ thống sử dụng kiến trúc 3 lớp chính: Next.js (Frontend) → REST API → NestJS (Backend) → Supabase (PostgreSQL, Auth, Storage, RLS).

| Lớp | Trách nhiệm |
| --- | --- |
| Next.js | Hiển thị giao diện và tương tác với người dùng: Dashboard, Task Management, User Management, Login. |
| NestJS | Xử lý business logic, API và kiểm tra quyền: Authentication, Authorization, Task Business Logic, Status Calculation, Period Lock & Finalize, Audit Log, Dashboard. |
| Supabase | Cung cấp database PostgreSQL, authentication, storage và cơ chế bảo mật ở tầng dữ liệu (RLS). |

### 6.3. Frontend
#### 6.3.1. Công nghệ
Next.js · TypeScript · Tailwind CSS · shadcn/ui.

#### 6.3.2. Chức năng Frontend
Authentication — Login.

Dashboard — Tổng quan, theo trạng thái, theo phòng ban.

Tasks — Danh sách nhiệm vụ, chi tiết nhiệm vụ, tạo, chỉnh sửa, chốt nhiệm vụ.

Departments — Danh sách phòng ban.

Users — Quản lý người dùng.

Audit Logs — Lịch sử thay đổi.

#### 6.3.3. Nguyên tắc Frontend
Frontend chịu trách nhiệm hiển thị dữ liệu, form nhập liệu, validation cơ bản, hiển thị trạng thái/dashboard, điều hướng, và ẩn/hiện chức năng theo quyền. Tuy nhiên, frontend không được coi việc ẩn nút hoặc ẩn giao diện là cơ chế bảo mật.

Ví dụ: nếu user không có quyền sửa, frontend ẩn nút "Sửa"; nhưng nếu user cố tình gọi trực tiếp PATCH /tasks/123, NestJS vẫn phải kiểm tra quyền và từ chối request.

### 6.4. Backend
#### 6.4.1. Công nghệ
NestJS · TypeScript · REST API · Prisma ORM.

#### 6.4.2. Các module Backend
backend/ auth, users, roles, departments, tasks, task-status, period-lock, audit-log, dashboard, reports.

| 🔧 Làm rõ phạm vi module reports/<br>• Module reports/ được dự trữ cấu trúc cho chức năng xuất báo cáo (Excel/PDF theo kỳ) ở giai đoạn sau. Trong phạm vi MVP, module này chưa triển khai chức năng nghiệp vụ — chỉ dashboard (mục 6.10–6.11) thuộc MVP. |
| --- |

#### 6.4.3. Auth Module
Chịu trách nhiệm đăng nhập, xác thực người dùng, quản lý session/token, xác định user hiện tại, kết nối với Supabase Auth. Luồng: User → Login → Supabase Auth → Authenticated User → NestJS → Role + Department.

#### 6.4.4. User Module
Quản lý người dùng, tài khoản, role, department, trạng thái tài khoản. Thông tin tối thiểu: id, username/email, full_name, role, department_id, is_active, created_at, updated_at.

#### 6.4.5. Department Module
Quản lý 22 phòng ban. Không hard-code danh sách phòng ban trong source code — database lưu danh sách phòng ban (id, code, name, is_active, created_at, updated_at), cho phép thêm/đổi tên/vô hiệu hóa phòng ban và mở rộng số lượng.

#### 6.4.6. Task Module
Module nghiệp vụ chính. Chịu trách nhiệm tạo/xem/chỉnh sửa nhiệm vụ, kiểm tra quyền truy cập (bao gồm quyền của đơn vị phối hợp), kiểm tra trạng thái khóa theo Nhóm A/B và trạng thái chốt, cập nhật dữ liệu, và ghi Audit Log.

### 6.5. Database
#### 6.5.1. Công nghệ
Supabase PostgreSQL — phù hợp vì dữ liệu hệ thống có cấu trúc quan hệ rõ ràng: Department → Users, Department → Tasks → Audit Logs, Tasks ↔ Departments (phối hợp).

#### 6.5.2. Các bảng chính
users · roles · departments · tasks · task_coordinating_departments · audit_logs · period_locks.

#### 6.5.3. Users
id, auth_user_id, full_name, role_id, department_id, is_active, created_at, updated_at. auth_user_id liên kết user nghiệp vụ với tài khoản được quản lý bởi Supabase Auth.

#### 6.5.4. Roles
ADMIN · SECRETARY · DEPARTMENT_EDITOR · VIEWER. Có thể mở rộng thêm role sau này nếu nghiệp vụ phát sinh.

#### 6.5.5. Departments
id, code, name, is_active, created_at, updated_at.

#### 6.5.6. Tasks

| 🔧 Hiệu chỉnh cấu trúc bảng ở bản 1.1<br>• Bỏ cột coordinating_departments dạng mảng khỏi bảng tasks, chuyển sang bảng quan hệ riêng để đảm bảo toàn vẹn dữ liệu và tương thích RLS.<br>• Bổ sung is_cancelled, is_finalized/finalized_at/finalized_by, và version (optimistic locking).<br>• Tách is_locked hiện có thành cơ chế khóa theo tháng (Nhóm A, tính từ period_locks) và is_finalized (Nhóm A+B, đặt thủ công) — không dùng một cờ is_locked duy nhất như bản 1.0. |
| --- |

| Trường | Ghi chú |
| --- | --- |
| id, task_code | Định danh nhiệm vụ |
| content, source, assigned_date, assigned_by, document_number | Nhóm A — thông tin khai báo |
| owner_department_id | Nhóm A — đơn vị thực hiện chính |
| required_completion_date | Nhóm A — deadline |
| actual_completion_date, completion_evidence | Nhóm B — thông tin hoàn thành |
| is_cancelled, cancelled_at, cancelled_by | Trạng thái hủy — độc lập với tình trạng tự động tính |
| is_finalized, finalized_at, finalized_by | Trạng thái chốt nhiệm vụ — khóa cả Nhóm A và B khi = true |
| version | Số phiên bản bản ghi, dùng cho optimistic locking (mục 6.14) |
| created_by, updated_by, created_at, updated_at | Metadata chuẩn |

Lưu ý về trạng thái hiển thị: không lưu như một giá trị mà user có thể tùy ý sửa. Được xác định dựa trên is_cancelled, required_completion_date và actual_completion_date theo bảng logic tại mục 4.7, tính toán tại thời điểm truy vấn (không lưu cứng trong bảng) để tránh dữ liệu bị mâu thuẫn.

6.5.6b. Task_Coordinating_Departments (bảng mới)

| Trường | Ghi chú |
| --- | --- |
| task_id | Khóa ngoại → tasks.id |
| department_id | Khóa ngoại → departments.id |

Khóa chính kép (task_id, department_id). Cho phép JOIN trực tiếp khi kiểm tra quyền xem read-only của đơn vị phối hợp và khi áp dụng RLS, thay vì so khớp trên cột mảng/JSON.

#### 6.5.7. Audit Logs
id, user_id, action, entity_type, entity_id, field_name, old_value, new_value, created_at, ip_address.

| Trường | Giá trị ví dụ |
| --- | --- |
| User | Nguyễn Văn A |
| Action | UPDATE |
| Entity | TASK-000123 |
| Field | required_completion_date |
| Old | 20/08/2026 |
| New | 25/08/2026 |
| Time | 18/08/2026 09:10 |

Audit Log mang tính append-only. User thông thường không được sửa hoặc xóa Audit Log.

#### 6.5.8. Period Locks
Dùng để quản lý việc khóa Nhóm A theo tháng. Trường: id, year, month, locked_at, locked_by, created_at.

Ví dụ: year=2026, month=08, locked_at=01/09/2026, locked_by=ADMIN (hoặc job tự động). Backend sử dụng bảng này kết hợp với is_finalized của từng task để xác định trường nào được phép chỉnh sửa (mục 4.8).

### 6.6. Authentication & Authorization
#### 6.6.1. Authentication
Sử dụng Supabase Auth — chịu trách nhiệm xác thực tài khoản.

#### 6.6.2. Authorization
Phân quyền sử dụng: RBAC + Department-level authorization + Row Level Security (RLS). RBAC xác định user có role gì (ADMIN/SECRETARY/DEPARTMENT_EDITOR/VIEWER); Department-level authorization xác định user có quyền đối với phòng ban nào, bao gồm quyền xem read-only đối với vai trò đơn vị phối hợp.

#### 6.6.3. Backend Authorization
Mọi API thay đổi dữ liệu phải kiểm tra tuần tự: Role? → Department (owner hay phối hợp)? → Task thuộc Department nào? → Nhóm A đã lock theo period_locks? → Task đã is_finalized? → Có quyền? Chỉ khi tất cả điều kiện phù hợp mới cho phép thay đổi.

#### 6.6.4. Row Level Security
Supabase PostgreSQL sử dụng RLS làm lớp bảo vệ dữ liệu bổ sung, để user không thể truy cập dữ liệu ngoài phạm vi được phép ngay cả khi có lỗi ở tầng ứng dụng.

| 🔧 Yêu cầu kỹ thuật bổ sung ở bản 1.1<br>• RLS trong Postgres/Supabase chỉ có tác dụng khi ngữ cảnh người dùng hiện tại (auth.uid(), department_id, role) được truyền vào phiên kết nối. Kết nối của Prisma qua NestJS thường dùng một service connection chung, không tự động mang theo JWT của từng request.<br>• Yêu cầu triển khai: cấu hình middleware ở NestJS để thực hiện SET LOCAL request.jwt.claims (hoặc cơ chế tương đương) trong cùng transaction của mỗi request, trước khi Prisma thực thi câu lệnh, để RLS thực sự được áp dụng ở tầng database.<br>• Nếu vì lý do hiệu năng chưa thể áp dụng ngay trong MVP, phải ghi nhận rõ: NestJS/Prisma là lớp chịu trách nhiệm chính về phân quyền, RLS ở trạng thái dự phòng chưa kích hoạt đầy đủ — tránh mô tả sai mức độ bảo mật thực tế của hệ thống trong tài liệu vận hành. |
| --- |

### 6.7. API Design
Hệ thống sử dụng REST API. Các nhóm API chính: /auth, /users, /roles, /departments, /tasks, /dashboard, /audit-logs, /period-locks.

#### 6.7.1. Task API

| Method | Endpoint | Ghi chú |
| --- | --- | --- |
| GET | /tasks | Hỗ trợ phân trang (page, pageSize), lọc theo department, trạng thái, khoảng thời gian, và sắp xếp |
| POST | /tasks | Tạo nhiệm vụ mới |
| GET | /tasks/:id | Xem chi tiết nhiệm vụ |
| PATCH | /tasks/:id | Cập nhật nhiệm vụ — kiểm tra Nhóm A/B, period lock, finalize, version (optimistic lock) |
| PATCH | /tasks/:id/finalize | Chốt nhiệm vụ (Thư ký/Owner/Admin) |
| PATCH | /tasks/:id/unfinalize | Mở lại nhiệm vụ đã chốt (chỉ Admin) |
| PATCH | /tasks/:id/cancel | Đánh dấu Đã hủy (Thư ký/Admin) |

#### 6.7.2. Dashboard API
GET /dashboard/summary?month=2026-08 và GET /dashboard/departments?month=2026-08 — backend trả về các chỉ số tổng hợp theo mục 5.4–5.6, loại trừ nhiệm vụ đã hủy khỏi mẫu số tỷ lệ.

#### 6.7.3. Audit API
GET /audit-logs, GET /audit-logs/:id — chỉ user có quyền phù hợp được xem Audit Log.

### 6.8. Business Logic
Business logic phải nằm ở Backend. Luồng cập nhật ngày hoàn thành: User → Next.js → PATCH /tasks/:id → NestJS → Authentication → Authorization → Check Department (owner/phối hợp) → Check Period Lock & Finalize → Check version (optimistic lock) → Update Task → Calculate Status → Create Audit Log → Response.

| 🔧 Yêu cầu bổ sung ở bản 1.1<br>• Bước Update Task, Calculate Status và Create Audit Log phải nằm trong cùng một database transaction. Nếu bất kỳ bước nào thất bại, toàn bộ transaction phải rollback để tránh dữ liệu nhiệm vụ và audit log lệch nhau. |
| --- |

Frontend không được tự xử lý các quy tắc nghiệp vụ quan trọng.

### 6.9. Status Calculation
Status được tính tự động, tập trung tại Backend để tránh mỗi nơi tính một kiểu:

| IF is_cancelled = true<br> => Đã hủy<br> <br>ELSE IF required_completion_date IS NULL<br> => Không đánh giá<br> <br>ELSE IF actual_completion_date IS NULL<br> => Đang thực hiện<br> <br>ELSE IF actual_completion_date < required_completion_date<br> => Hoàn thành trước hạn<br> <br>ELSE IF actual_completion_date = required_completion_date<br> => Hoàn thành đúng hạn<br> <br>ELSE<br> => Hoàn thành quá hạn |
| --- |

### 6.10. Dashboard Architecture
Dashboard lấy dữ liệu từ Task theo luồng: Tasks → Required Completion Date → Xác định tháng → Actual Completion Date → Calculate Status (loại is_cancelled) → Aggregate → Dashboard. Mặc định hiển thị tháng hiện tại.

| Chỉ số | Giá trị ví dụ (08/2026) |
| --- | --- |
| Tổng nhiệm vụ | 156 |
| Đang thực hiện | 42 |
| Hoàn thành trước hạn | 55 |
| Hoàn thành đúng hạn | 47 |
| Hoàn thành quá hạn | 12 |
| Đã hủy | 3 |

### 6.11. Dashboard theo phòng ban
Backend thực hiện aggregation theo owner_department_id + required_completion_date, loại trừ nhiệm vụ đã hủy khỏi các chỉ số tiến độ. Không nên lưu riêng các con số dashboard trong database ở MVP — dashboard được tính từ dữ liệu nhiệm vụ thực tế.

### 6.12. Cache
MVP chưa bắt buộc Redis. Giai đoạn đầu: Next.js → NestJS → PostgreSQL. Khi dữ liệu và traffic tăng, có thể bổ sung Redis giữa NestJS và PostgreSQL để cache dashboard, các thống kê thường xuyên, và session/cache nếu cần. Không đưa Redis vào MVP nếu chưa có nhu cầu thực tế.

### 6.13. Storage
Hiện tại, completion_evidence được lưu dưới dạng text trong database — chưa cần upload file. Trong tương lai, evidence có thể mở rộng sang PDF/Word/Excel/Image, lưu bằng Supabase Storage với database chỉ lưu metadata/reference tới file.

### 6.14. Security
Các lớp security chính: HTTPS → Supabase Auth → NestJS Authorization → RBAC → Department Permission → RLS → PostgreSQL.

Các yêu cầu tối thiểu:

Password không lưu dạng plain text; authentication sử dụng Supabase Auth.

API phải kiểm tra quyền; RLS được bật cho các bảng dữ liệu cần bảo vệ, với context JWT được truyền đúng theo mục 6.6.4.

Validate input; chống SQL injection thông qua ORM/parameterized queries.

Rate limiting cho các endpoint nhạy cảm.

Không lưu password/token trong application log.

Audit Log không cho user thông thường sửa/xóa.

Database không public trực tiếp nếu không cần thiết.

| 🔧 Bổ sung ở bản 1.1 — Optimistic locking<br>• Mỗi bản ghi tasks có cột version. Khi PATCH /tasks/:id, request phải gửi kèm version hiện tại; nếu không khớp với version trong database (do người khác đã cập nhật trước), API trả lỗi xung đột (409) thay vì ghi đè âm thầm. Ngăn tình huống 2 tài khoản editor cùng phòng ban sửa đồng thời làm mất dữ liệu của nhau. |
| --- |

### 6.15. Database Indexing
Các trường thường xuyên được tìm kiếm/lọc phải có index phù hợp, đặc biệt:

tasks.owner_department_id, tasks.required_completion_date, tasks.actual_completion_date, tasks.created_at

tasks.is_cancelled, tasks.is_finalized (phục vụ lọc dashboard và kiểm tra quyền chỉnh sửa)

task_coordinating_departments.department_id (phục vụ truy vấn quyền xem của đơn vị phối hợp)

audit_logs.user_id, audit_logs.entity_id, audit_logs.created_at

Dashboard có thể sử dụng composite index (owner_department_id, required_completion_date). Việc indexing sẽ được điều chỉnh thêm dựa trên dữ liệu và query thực tế.

### 6.16. Scalability
Kiến trúc ban đầu sử dụng Modular Monolith (NestJS với các module Auth, Users, Departments, Tasks, Audit, Dashboard, Reports). Không sử dụng microservices trong MVP vì quy mô ban đầu khoảng 120 user, business logic chưa đủ lớn, và một codebase giúp dễ phát triển, debug, deploy với chi phí thấp. Có thể tách module thành service riêng khi hệ thống thực sự cần scale.

### 6.17. Khả năng mở rộng sau này
Nếu số lượng user tăng mạnh: Load Balancer → nhiều instance Backend → Redis → PostgreSQL. Không cần thay đổi business logic chính.

### 6.18. Deployment
Deployment chưa chốt trong giai đoạn Technical Design. Thiết kế phải đảm bảo ứng dụng có thể triển khai trên server hiện có của công ty, VPS, cloud, hoặc các nền tảng hosting hỗ trợ Next.js/NestJS. Domain/subdomain sẽ được cấu hình ở giai đoạn triển khai. Technical Design không phụ thuộc vào một nhà cung cấp hosting cụ thể.

### 6.19. Monitoring & Logging
Hệ thống cần có Application Log (theo dõi API request, error, warning, response time — dùng để debug hệ thống) và Audit Log (theo dõi ai sửa dữ liệu, sửa lúc nào, sửa trường nào, giá trị cũ/mới — dùng để truy vết nghiệp vụ). Hai loại log này có mục đích khác nhau và không thay thế cho nhau.

### 6.20. Backup
Database phải có backup, sử dụng cơ chế backup của Supabase phù hợp với gói triển khai. Mục tiêu: có thể khôi phục dữ liệu, không mất toàn bộ dữ liệu nếu xảy ra sự cố, có chính sách retention phù hợp khi đưa vào production. Backup production phải được kiểm tra khả năng restore, không chỉ kiểm tra việc backup có chạy hay không.

### 6.21. Testing Strategy

| 🔧 Mục bổ sung ở bản 1.1<br>• Bản 1.0 chưa đề cập chiến lược kiểm thử dù logic tính trạng thái là quy tắc nghiệp vụ lõi, ảnh hưởng trực tiếp đến số liệu dashboard. |
| --- |

Unit test bắt buộc cho hàm tính trạng thái (mục 6.9), bao phủ toàn bộ các dòng trong bảng logic tại mục 4.7, bao gồm các trường hợp biên (NULL, ngày bằng nhau, is_cancelled).

Integration test cho luồng khóa theo tháng (Nhóm A) và chốt nhiệm vụ (Nhóm A+B), đảm bảo đúng quyền chỉnh sửa ở từng trạng thái.

Integration test cho ma trận phân quyền RBAC + Department (owner vs. phối hợp vs. không liên quan) trên các API thay đổi dữ liệu.

Test optimistic locking: mô phỏng 2 request PATCH đồng thời trên cùng một task để xác nhận request thứ hai nhận lỗi xung đột version.

### 6.22. Công nghệ chốt

| Thành phần | Công nghệ |
| --- | --- |
| Frontend | Next.js |
| Language | TypeScript |
| UI | Tailwind CSS + shadcn/ui |
| Backend | NestJS |
| API | REST API |
| ORM | Prisma |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| Authorization | RBAC (ADMIN/SECRETARY/DEPARTMENT_EDITOR/VIEWER) + Department Permission |
| Database Security | PostgreSQL RLS (với JWT context truyền qua Prisma — mục 6.6.4) |
| File Storage | Supabase Storage |
| Cache | Redis — future |
| Deployment | TBD |
| Monitoring | TBD / Sentry hoặc tương đương |
| CI/CD | TBD |

### 6.23. Nguyên tắc thiết kế cuối cùng
Simple First — không đưa công nghệ phức tạp vào khi chưa cần.

Security by Design — phân quyền và bảo mật được thiết kế ngay từ đầu, không phụ thuộc một lớp bảo vệ duy nhất.

Backend là nguồn xử lý nghiệp vụ — không đặt business rule quan trọng ở Frontend.

Database là nguồn dữ liệu chính — không lưu trùng dữ liệu không cần thiết.

Auditability — mọi thay đổi quan trọng phải có thể truy vết.

Scalable — MVP đơn giản nhưng có thể mở rộng backend, database và cache khi cần.

Deployment Agnostic — không phụ thuộc cứng vào Vercel, VPS hay server công ty.

### 6.24. Kiến trúc chốt

| USER<br> \|<br> v<br> +-------------------+<br> \| Next.js \|<br> \| Frontend \|<br> +---------+---------+<br> \| REST API<br> v<br> +-------------------+<br> \| NestJS \|<br> \| Backend \|<br> \| Auth \|<br> \| Authorization \|<br> \| Tasks \|<br> \| Status \|<br> \| Period Lock \|<br> \| Finalize \|<br> \| Audit Log \|<br> \| Dashboard \|<br> +---------+---------+<br> \|<br> v<br> +-------------------+<br> \| Supabase \|<br> \| PostgreSQL \|<br> \| Auth \|<br> \| RLS \|<br> \| Storage \|<br> +-------------------+ |
| --- |

Đây là kiến trúc Technical Design được chốt cho MVP bản 1.1: đơn giản để một người phát triển, không phụ thuộc vào deployment cụ thể, có security/phân quyền ngay từ đầu (bao gồm quyền đơn vị phối hợp và cơ chế RLS đã làm rõ), có cơ chế khóa/chốt dữ liệu không gây tắc nghẽn vận hành, và có đường mở rộng khi hệ thống tăng quy mô.
