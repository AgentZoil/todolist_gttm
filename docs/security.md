# Security — RLS Decision

## Quyết định về Row Level Security (RLS)

**Giai đoạn**: Auth skeleton (Giai đoạn 2)

**Mục tham chiếu**: 6.6.4 Technical Design v1.1

---

### Quyết định

MVP sử dụng **NestJS + Prisma (kết nối bằng service-role/privileged DB user)** làm lớp phân quyền chính.

**Không triển khai** truyền JWT context qua Prisma để kích hoạt RLS ở giai đoạn này.

### Lý do chấp nhận

- Kiến trúc hiện tại: tất cả request đi từ Frontend → NestJS API → Prisma → PostgreSQL.
- Frontend **không** truy vấn Supabase DB trực tiếp (chưa có realtime subscription, không có RPC call trực tiếp).
- Prisma kết nối bằng service-role key (privileged DB user), bypass RLS.
- RBAC + Department-level authorization được kiểm tra đầy đủ ở tầng NestJS (AuthGuard → CurrentUserMiddleware → Controllers/Services).

### Phạm vi kiểm soát quyền hiện tại

| Lớp | Cơ chế | Trạng thái |
|---|---|---|
| Authentication | Supabase Auth (JWT Bearer token) | ✅ Hoạt động |
| Authorization | NestJS AuthGuard + CurrentUserMiddleware + RolesGuard | ✅ Hoạt động |
| Department Permission | Business logic trong Task/Service | ⏳ Chưa triển khai (Giai đoạn 10) |
| Row Level Security (RLS) | Postgres RLS | ❌ Chưa kích hoạt |

### Điều kiện phải quay lại triển khai RLS

Nếu trong tương lai bổ sung tính năng cho frontend truy vấn Supabase trực tiếp, **phải** triển khai đầy đủ RLS theo mục 6.6.4 Technical Design **trước khi** bật tính năng đó.

Các trường hợp cụ thể:
- Realtime subscription từ frontend vào Supabase
- Supabase Edge Functions gọi trực tiếp DB
- Bất kỳ client nào gọi trực tiếp Supabase PostgREST API

### Yêu cầu khi quay lại triển khai

1. Cấu hình middleware NestJS để thực hiện `SET LOCAL request.jwt.claims` (hoặc cơ chế tương đương) trong cùng transaction của mỗi request, trước khi Prisma thực thi câu lệnh.
2. Viết RLS policies cho tất cả các bảng cần bảo vệ (users, tasks, audit_logs, departments).
3. Test toàn bộ luồng với RLS enabled.

---

> **Lưu ý**: Quyết định này được ghi nhận rõ ràng, không phải bỏ sót. Nếu agent khác review và hỏi về RLS, đây là tài liệu tham chiếu.
