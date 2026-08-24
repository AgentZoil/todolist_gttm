# VER FIX 1 — Patch Notes

**Ngày:** 24/08/2026  
**Phiên bản:** Fix 1  
**Mục đích:** Sửa lỗi, tối ưu UI, bổ sung tính năng cho hệ thống theo dõi nhiệm vụ

---

## Thứ tự thực hiện

| # | Task | Ưu tiên | Thời gian | File thay đổi |
|---|------|---------|-----------|---------------|
| 1 | Sửa tên lãnh đạo | Cao | 5 phút | `tasks/page.tsx` |
| 2 | Ngày HT thực tế ≤ hôm nay | Cao | 15 phút | `tasks/page.tsx`, `tasks.service.ts` |
| 3 | Fix responsive UI | Cao | 30 phút | `tasks/page.tsx` |
| 4 | Thêm thanh tìm kiếm | Cao | 15 phút | `tasks/page.tsx` |
| 5 | Filter & sort Tasks | Trung bình | 45 phút | `tasks/page.tsx`, `tasks.service.ts` |
| 6 | Dashboard tiếng Việt | Trung bình | 15 phút | `dashboard/page.tsx` |
| 7 | Tách Dashboard chi tiết | Thấp | 30 phút | `dashboard/page.tsx`, `detail/page.tsx`, `sidebar.tsx` |
| 8 | Thêm biểu đồ | Thấp | 60 phút | `dashboard/page.tsx`, `dashboard-charts.tsx`, `dashboard.controller.ts`, `dashboard.service.ts`, `package.json` |

**Tổng dự kiến:** ~3.5 giờ

---

## Task 1: Sửa tên lãnh đạo

**File:** `apps/web/app/(dashboard)/tasks/page.tsx`

| Dòng | Cũ | Mới |
|------|-----|------|
| 546, 768 | `PCT Nguyễn Việt Huy` | `PCT Nguyễn Viết Huy` |

---

## Task 2: Ngày hoàn thành thực tế ≤ hôm nay

**Luật:** Ngày hoàn thành thực tế **không được lớn hơn ngày hiện tại**

### Frontend (`apps/web/app/(dashboard)/tasks/page.tsx`)

Thêm `max` attribute trên input date:

```tsx
<input 
  type="date" 
  max={new Date().toISOString().split("T")[0]}
  value={editFormData.actualCompletionDate} 
  onChange={...}
/>
```

### Backend (`apps/api/src/tasks/tasks.service.ts`)

Thêm validation sau dòng 314 (sau check `actualCompletionDate < assignedDate`):

```typescript
if (actualCompletionDate && actualCompletionDate > new Date()) {
  throw new ForbiddenException(
    'Ngày hoàn thành thực tế không được lớn hơn ngày hiện tại'
  );
}
```

---

## Task 3: Fix Responsive UI

| Vấn đề | File: Dòng | Sửa |
|--------|-----------|-----|
| Bảng task `table-fixed` ~1000px cứng | `tasks/page.tsx:881` | Đổi sang `table-auto` |
| `whitespace-nowrap` chặn wrap text | `tasks/page.tsx:911-918` | Bỏ `whitespace-nowrap` |
| Modal chi tiết `max-w-5xl` quá rộng | `tasks/page.tsx:649` | Đổi `max-w-full sm:max-w-5xl` |
| Modal tạo `max-w-2xl` | `tasks/page.tsx:466` | Đổi `max-w-full sm:max-w-2xl` |

---

## Task 4: Thêm thanh tìm kiếm

**File:** `apps/web/app/(dashboard)/tasks/page.tsx`

### Hiện tại (toolbar dòng 436-460)
```tsx
<div className="flex items-center gap-2.5">
  <select>Phòng ban</select>
  <Button>Thêm nhiệm vụ</Button>
</div>
```

### Sau khi thêm
```tsx
<div className="flex items-center gap-2.5">
  <form onSubmit={handleSearch} className="relative">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <input
      type="text"
      placeholder="Tìm nhiệm vụ..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="h-9 rounded-lg border border-border bg-card pl-9 pr-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors w-48 sm:w-64"
    />
  </form>
  <select>Phòng ban</select>
  <Button>Thêm nhiệm vụ</Button>
</div>
```

- `Search` icon đã import sẵn (dòng 19)
- `searchQuery` state đã có (dòng 105)
- `handleSearch` function đã có (dòng 179-182)

---

## Task 5: Bổ sung filter & sort

### 5.1 Bộ lọc mới

| Bộ lọc | UI | Backend param |
|--------|-----|---------------|
| Trạng thái | Select dropdown | `?status=IN_PROGRESS\|COMPLETED\|CANCELLED` |
| Chu kỳ (tháng/năm) | `<input type="month">` | `?month=YYYY-MM` |
| Lãnh đạo giao | Select dropdown (dynamic) | `?assignedBy=...` |

### 5.2 Sắp xếp mới

| Tiêu chí | Backend param |
|----------|---------------|
| Ngày giao nhiệm vụ | `?sortBy=assignedDate&sortOrder=asc\|desc` |
| Ngày yêu cầu hoàn thành | `?sortBy=requiredCompletionDate` |
| Ngày hoàn thành thực tế | `?sortBy=actualCompletionDate` |

### 5.3 UI mới (toolbar)

```
[🔍 Tìm...] [Trạng thái ▾] [Tháng ▾] [Lãnh đạo ▾] [Phòng ban ▾]
[Ngày giao ▲▼] [Ngày YC HT ▲▼] [Ngày HT ▲▼]
```

### 5.4 Frontend changes (`tasks/page.tsx`)

Thêm state:
```tsx
const [filterStatus, setFilterStatus] = useState("");
const [filterMonth, setFilterMonth] = useState("");
const [filterAssignedBy, setFilterAssignedBy] = useState("");
const [sortBy, setSortBy] = useState("");
const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
```

Cập nhật `fetchTasks`:
```tsx
const fetchTasks = (params: {
  deptId?: string;
  page?: number;
  search?: string;
  status?: string;
  month?: string;
  assignedBy?: string;
  sortBy?: string;
  sortOrder?: string;
  isFilter?: boolean;
} = {}) => {
  // ... existing code ...
  if (params.status) queryParams.set("status", params.status);
  if (params.month) queryParams.set("month", params.month);
  if (params.assignedBy) queryParams.set("assignedBy", params.assignedBy);
  if (params.sortBy) queryParams.set("sortBy", params.sortBy);
  if (params.sortOrder) queryParams.set("sortOrder", params.sortOrder);
  // ... rest ...
};
```

### 5.5 Backend changes (`tasks.service.ts`)

Thêm vào `findAll` method:
```typescript
// Status filter
if (status === 'IN_PROGRESS') { where.actualCompletionDate = null; }
if (status === 'COMPLETED') { where.actualCompletionDate = { not: null }; }

// Month filter
if (month) {
  const [year, m] = month.split('-').map(Number);
  const start = new Date(year, m - 1, 1);
  const end = new Date(year, m, 0, 23, 59, 59);
  where.requiredCompletionDate = { gte: start, lte: end };
}

// Assigned by filter
if (assignedBy) { where.assignedBy = assignedBy; }

// Sort
const orderBy: Record<string, string> = {};
if (sortBy) { orderBy[sortBy] = sortOrder || 'asc'; }
```

---

## Task 6: Dashboard tiếng Việt rõ ràng

**File:** `apps/web/app/(dashboard)/dashboard/page.tsx`

### Thay đổi labels

| Cũ | Mới |
|----|-----|
| `BANG TONG HOP DANH GIA HOAN THANH NHIEM VU` | `BẢNG TỔNG HỢP ĐÁNH GIÁ HOÀN THÀNH NHIỆM VU` |
| (không subtitle) | `Thống kê theo tháng {MM/YYYY}` |

### Stat cards

| Cũ | Mới |
|----|-----|
| `Tong so NV` | `Tổng nhiệm vụ` |
| `Dung/Truoc han` | `Hoàn thành đúng/trước hạn` |
| `Qua han` | `Hoàn thành quá hạn` |
| `Con han (Dang TH)` | `Đang thực hiện (còn hạn)` |
| `Het han (Dang TH)` | `Đang thực hiện (quá hạn)` |
| `Khong danh gia` | `Không đánh giá` |

---

## Task 7: Tách Dashboard chi tiết

### 7.1 Tạo trang mới

**File mới:** `apps/web/app/(dashboard)/dashboard/detail/page.tsx`

Nội dung: Bảng phòng ban đầy đủ (9 cột) + filter tháng + nút quay lại

### 7.2 Sửa Dashboard chính

**File:** `apps/web/app/(dashboard)/dashboard/page.tsx`

- **Xóa** bảng phòng ban (lines 212-304)
- **Giữ lại:** 6 stat cards + completion rate bar + biểu đồ (task 8)
- **Thêm** nút **"Xem chi tiết theo phòng ban"** → link `/dashboard/detail`

### 7.3 Thêm sidebar item

**File:** `apps/web/components/layout/sidebar.tsx`

```tsx
{ name: "Chi tiết", path: "/dashboard/detail", icon: BarChart3, roles: ["ADMIN", "SECRETARY"] },
```

---

## Task 8: Thêm biểu đồ thống kê

### 8.1 Cài thư viện

```bash
cd apps/web && npm install recharts
```

### 8.2 Backend — Endpoint mới

**File:** `apps/api/src/dashboard/dashboard.controller.ts`

```typescript
@Get('charts')
@UseGuards(AuthGuard)
async getCharts(@Query('month') month?: string) {
  return this.dashboardService.getCharts(month);
}
```

**File:** `apps/api/src/dashboard/dashboard.service.ts`

Thêm method `getCharts`:
```typescript
async getCharts(month?: string) {
  // Tương tự getSummary nhưng trả data cho biểu đồ
  return {
    completedOnTime: number,
    completedLate: number,
    inProgressOnTime: number,
    inProgressLate: number,
    noEvaluation: number,
    cancelled: number
  };
}
```

### 8.3 Frontend — Component mới

**File mới:** `apps/web/components/dashboard/dashboard-charts.tsx`

```tsx
"use client";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

// Pie Chart: Tỷ lệ hoàn thành vs chưa hoàn thành
// Bar Chart: So sánh 6 trạng thái nhiệm vụ
```

### 8.4 Dashboard page tích hợp

**File:** `apps/web/app/(dashboard)/dashboard/page.tsx`

Thêm component `<DashboardCharts data={chartData} />` bên dưới stat cards.

---

## Danh sách file thay đổi

| File | Task |
|------|------|
| `apps/web/app/(dashboard)/tasks/page.tsx` | 1, 2, 3, 4, 5 |
| `apps/api/src/tasks/tasks.service.ts` | 2, 5 |
| `apps/web/app/(dashboard)/dashboard/page.tsx` | 6, 7, 8 |
| `apps/web/app/(dashboard)/dashboard/detail/page.tsx` | 7 (mới) |
| `apps/web/components/dashboard/dashboard-charts.tsx` | 8 (mới) |
| `apps/web/components/layout/sidebar.tsx` | 7 |
| `apps/api/src/dashboard/dashboard.controller.ts` | 8 |
| `apps/api/src/dashboard/dashboard.service.ts` | 8 |
| `apps/web/package.json` | 8 (thêm `recharts`) |

---

## Test checklist

- [ ] Task 1: Tên "Nguyễn Viết Huy" hiển thị đúng ở tạo + sửa nhiệm vụ
- [ ] Task 2: Không thể chọn ngày hoàn thành thực tế > hôm nay
- [ ] Task 2: Backend trả lỗi 403 khi gửi ngày > hôm nay
- [ ] Task 3: Bảng nhiệm vụ không bị vỡ giao diện trên màn hình nhỏ
- [ ] Task 3: Modal không bị tràn màn hình trên mobile
- [ ] Task 4: Thanh tìm kiếm hiển thị, gõ tìm được task
- [ ] Task 5: Filter trạng thái hoạt động đúng
- [ ] Task 5: Filter tháng hoạt động đúng
- [ ] Task 5: Sort theo các ngày hoạt động đúng
- [ ] Task 6: Dashboard hiển thị tiếng Việt có dấu đầy đủ
- [ ] Task 7: Dashboard chính chỉ hiển thị tổng quan
- [ ] Task 7: Trang chi tiết hiển thị bảng phòng ban
- [ ] Task 7: Sidebar có item "Chi tiết" (ADMIN/SECRETARY)
- [ ] Task 8: Biểu đồ tròn hiển thị tỷ lệ hoàn thành
- [ ] Task 8: Biểu đồ cột hiển thị so sánh trạng thái
- [ ] Task 8: Biểu đồ cập nhật khi đổi tháng
