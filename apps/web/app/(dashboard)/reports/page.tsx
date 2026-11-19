"use client";

import { useEffect, useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarX,
  TrendingUp,
  ClipboardList,
  Building2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ShieldAlert,
  X,
  Eye,
} from "lucide-react";
import { apiFetch, apiDownload } from "@/lib/api";
import { MonthPicker } from "@/components/ui/month-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface UserInfo {
  id: string;
  role: string;
  fullName: string;
  departmentId?: string;
  departmentName?: string;
}

interface Department {
  id: string;
  name: string;
  code: string;
}

interface TaskItem {
  id: string;
  taskCode: string;
  title: string;
  content: string;
  documentNumber: string | null;
  priority: string;
  ownerDepartmentId: string;
  ownerDepartmentName: string;
  coordinatingUnits: string | null;
  assignedDate: string;
  assignedBy: string;
  requiredCompletionDate: string | null;
  actualCompletionDate: string | null;
  status: string;
  statusLabel: string;
  completionEvidence: string | null;
  incompleteReason: string | null;
  isFinalized: boolean;
  directives: string[];
}

interface SummaryStats {
  total: number;
  completedEarly: number;
  completedOnTime: number;
  completedLate: number;
  totalCompleted: number;
  inProgress: number;
  incomplete: number;
  cancelled: number;
  noEvaluation: number;
  completionRate: number;
}

type DateFilterType = "ALL" | "YEAR" | "MONTH" | "CUSTOM";
type StatusGroup = "ALL" | "COMPLETED" | "IN_PROGRESS" | "INCOMPLETE" | "CANCELLED";

const STATUS_COLORS: Record<string, string> = {
  COMPLETED_EARLY: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  COMPLETED_ON_TIME: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  COMPLETED_LATE: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
  IN_PROGRESS: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  INCOMPLETE: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  CANCELLED: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  NO_EVALUATION: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
};

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function ReportsPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Selected Task for Preview modal
  const [previewTask, setPreviewTask] = useState<TaskItem | null>(null);

  // Search keyword inside table
  const [searchQuery, setSearchQuery] = useState("");

  // Filters
  const currentYear = new Date().getFullYear();
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>("MONTH");
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [statusGroup, setStatusGroup] = useState<StatusGroup>("ALL");

  // Data
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    total: 0,
    completedEarly: 0,
    completedOnTime: 0,
    completedLate: 0,
    totalCompleted: 0,
    inProgress: 0,
    incomplete: 0,
    cancelled: 0,
    noEvaluation: 0,
    completionRate: 0,
  });

  // Pagination for Preview table
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 1. Load User & Departments
  useEffect(() => {
    Promise.all([
      apiFetch<{ data: UserInfo }>("/auth/me"),
      apiFetch<{ data: Department[] }>("/departments"),
    ])
      .then(([userRes, deptRes]) => {
        setUserInfo(userRes.data);
        setDepartments(deptRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoadingUser(false));
  }, []);

  // 2. Fetch Report Data
  const fetchReportData = () => {
    if (!userInfo || userInfo.role !== "ADMIN") return;
    setLoadingData(true);
    setErrorMessage(null);

    const params = new URLSearchParams();
    params.set("dateFilterType", dateFilterType);
    if (dateFilterType === "YEAR") params.set("year", selectedYear);
    if (dateFilterType === "MONTH") params.set("month", selectedMonth);
    if (dateFilterType === "CUSTOM") {
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
    }
    if (selectedDeptId) params.set("departmentId", selectedDeptId);
    if (statusGroup !== "ALL") params.set("statusGroup", statusGroup);

    apiFetch<{ summary: SummaryStats; tasks: TaskItem[] }>(`/reports/tasks?${params.toString()}`)
      .then((res) => {
        setSummary(res.summary);
        setTasks(res.tasks || []);
        setCurrentPage(1);
      })
      .catch((err) => {
        setErrorMessage(err.message || "Không thể tải dữ liệu báo cáo");
      })
      .finally(() => setLoadingData(false));
  };

  useEffect(() => {
    if (userInfo?.role === "ADMIN") {
      fetchReportData();
    }
  }, [userInfo, dateFilterType, selectedYear, selectedMonth, dateFrom, dateTo, selectedDeptId, statusGroup]);

  // 3. Export Excel via standard apiDownload (Supabase session token included)
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("dateFilterType", dateFilterType);
      if (dateFilterType === "YEAR") params.set("year", selectedYear);
      if (dateFilterType === "MONTH") params.set("month", selectedMonth);
      if (dateFilterType === "CUSTOM") {
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);
      }
      if (selectedDeptId) params.set("departmentId", selectedDeptId);
      if (statusGroup !== "ALL") params.set("statusGroup", statusGroup);

      const filename = `Bao_cao_nhiem_vu_${dateFilterType}_${Date.now()}.xlsx`;
      await apiDownload(`/reports/tasks/export?${params.toString()}`, filename);
    } catch (err: any) {
      alert(err.message || "Xuất báo cáo Excel thất bại");
    } finally {
      setExporting(false);
    }
  };

  // 4. Print handler
  const handlePrint = () => {
    window.print();
  };

  // Helper date format
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  // Filter tasks with search query
  const filteredTasks = useMemo(() => {
    if (!searchQuery.trim()) return tasks;
    const q = searchQuery.toLowerCase().trim();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.taskCode.toLowerCase().includes(q) ||
        (t.documentNumber && t.documentNumber.toLowerCase().includes(q)) ||
        t.ownerDepartmentName.toLowerCase().includes(q) ||
        t.assignedBy.toLowerCase().includes(q)
    );
  }, [tasks, searchQuery]);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize) || 1;

  // Selected department label
  const selectedDeptLabel = useMemo(() => {
    if (!selectedDeptId) return "Toàn cơ quan";
    const d = departments.find((dept) => dept.id === selectedDeptId);
    return d ? d.name : "Toàn cơ quan";
  }, [selectedDeptId, departments]);

  // Period label
  const periodLabel = useMemo(() => {
    if (dateFilterType === "ALL") return "Toàn thời gian";
    if (dateFilterType === "YEAR") return `Năm ${selectedYear}`;
    if (dateFilterType === "MONTH") {
      const [y, m] = selectedMonth.split("-");
      return `Tháng ${Number(m)}/${y}`;
    }
    if (dateFilterType === "CUSTOM") {
      return `Từ ${dateFrom ? formatDate(dateFrom) : "..."} đến ${dateTo ? formatDate(dateTo) : "..."}`;
    }
    return "";
  }, [dateFilterType, selectedYear, selectedMonth, dateFrom, dateTo]);

  if (loadingUser) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Phase 1 restriction: ADMIN only
  if (userInfo?.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-sm ring-1 ring-destructive/20">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-foreground">Giới hạn quyền truy cập</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Tính năng báo cáo đang trong giai đoạn thử nghiệm (Giai đoạn 1) và hiện chỉ dành riêng cho Quản trị viên (ADMIN).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ========================================================
          SCREEN VIEW: UI tương thích 100% với Codebase hiện tại
         ======================================================== */}
      <div className="space-y-6 print:hidden">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
              Báo cáo & Thống kê nhiệm vụ
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tổng hợp tiến độ, kết xuất file Excel định dạng hành chính và in ấn báo cáo
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={handlePrint}
              variant="outline"
              className="gap-2 shadow-sm border-border bg-card hover:bg-muted/50"
            >
              <Printer className="h-4 w-4 text-muted-foreground" />
              In báo cáo
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={exporting}
              className="gap-2 shadow-sm bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              Xuất Excel (.xlsx)
            </Button>
          </div>
        </div>

        {/* Hero Completion Rate Banner (Tương tự Dashboard page) */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary via-primary to-secondary p-6 shadow-xl shadow-primary/10">
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-primary-foreground/85">
                  Tỷ lệ hoàn thành nhiệm vụ ({periodLabel})
                </p>
                <div className="flex items-baseline gap-3">
                  <p className="text-4xl font-bold tabular-nums text-primary-foreground sm:text-5xl">
                    {summary.completionRate}%
                  </p>
                  <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-sm">
                    {selectedDeptLabel}
                  </span>
                </div>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/25">
                <TrendingUp className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            <div className="mt-5 space-y-1.5">
              <div className="flex items-center justify-between text-xs text-primary-foreground/80">
                <span>Tiến độ thực hiện: {summary.totalCompleted}/{summary.total} nhiệm vụ</span>
                <span>{summary.completionRate}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-white transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(0, summary.completionRate))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stat Cards (Nhất quán 100% với dashboard/page.tsx) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Card 1: Tổng số */}
          <Card className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tổng số</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardList className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">{summary.total}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Theo kỳ lọc</p>
          </Card>

          {/* Card 2: Hoàn thành đúng hạn */}
          <Card className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Đúng hạn</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-emerald-600">
              {summary.completedOnTime + summary.completedEarly}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">Sớm: {summary.completedEarly} · Đúng: {summary.completedOnTime}</p>
          </Card>

          {/* Card 3: Hoàn thành quá hạn */}
          <Card className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Trễ hạn</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-600">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-orange-600">{summary.completedLate}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Hoàn thành sau hạn</p>
          </Card>

          {/* Card 4: Đang thực hiện */}
          <Card className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Đang làm</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-blue-600">{summary.inProgress}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Trong thời hạn</p>
          </Card>

          {/* Card 5: Không hoàn thành */}
          <Card className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quá hạn</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-600">
                <CalendarX className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-red-600">{summary.incomplete}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Chưa hoàn thành</p>
          </Card>

          {/* Card 6: Đã hủy */}
          <Card className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Đã hủy</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-bold tabular-nums text-muted-foreground">{summary.cancelled}</div>
            <p className="mt-1 text-[11px] text-muted-foreground">Không tính vào KPI</p>
          </Card>
        </div>

        {/* Filter Toolbar (Chuẩn giao diện như tasks/page.tsx) */}
        <Card className="p-3.5 rounded-2xl border border-border bg-card shadow-sm ring-1 ring-foreground/5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Time Pills */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/60 rounded-xl">
              {[
                { id: "ALL", label: "Toàn bộ" },
                { id: "YEAR", label: "Theo năm" },
                { id: "MONTH", label: "Theo tháng" },
                { id: "CUSTOM", label: "Khoảng ngày" },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setDateFilterType(item.id as DateFilterType)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                    dateFilterType === item.id
                      ? "bg-card text-foreground shadow-sm ring-1 ring-foreground/5"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Keyword Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Tìm mã NV, số VB, tiêu đề..."
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-1 border-t border-border/50">
            {/* Mốc thời gian */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mốc thời gian
              </label>
              {dateFilterType === "ALL" && (
                <div className="flex h-9 items-center rounded-lg border border-border bg-muted/30 px-3 text-xs text-muted-foreground">
                  Toàn thời gian (Từ trước đến nay)
                </div>
              )}
              {dateFilterType === "YEAR" && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {[2024, 2025, 2026, 2027, 2028].map((y) => (
                    <option key={y} value={y}>
                      Năm {y}
                    </option>
                  ))}
                </select>
              )}
              {dateFilterType === "MONTH" && (
                <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
              )}
              {dateFilterType === "CUSTOM" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <span className="text-muted-foreground">-</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-2.5 text-xs focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              )}
            </div>

            {/* Phòng ban */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Phòng ban / Đơn vị
              </label>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Tất cả phòng ban</option>
                {[...departments]
                  .sort((a, b) => a.id.localeCompare(b.id))
                  .map((dept, i) => (
                    <option key={dept.id} value={dept.id}>
                      {i + 1}. {dept.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Nhóm trạng thái */}
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Trạng thái đánh giá
              </label>
              <select
                value={statusGroup}
                onChange={(e) => setStatusGroup(e.target.value as StatusGroup)}
                className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">Tất cả nhiệm vụ ({summary.total})</option>
                <option value="COMPLETED">Đã hoàn thành ({summary.totalCompleted})</option>
                <option value="IN_PROGRESS">Đang thực hiện ({summary.inProgress})</option>
                <option value="INCOMPLETE">Chưa hoàn thành / Quá hạn ({summary.incomplete})</option>
                <option value="CANCELLED">Đã hủy ({summary.cancelled})</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Detailed Table (Tương thích chuẩn UI tasks/page.tsx) */}
        <Card className="overflow-hidden relative shadow-sm border-border">
          {loadingData && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">Đang tổng hợp dữ liệu...</span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">Danh sách nhiệm vụ</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {filteredTasks.length} nhiệm vụ
              </span>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {periodLabel} · {selectedDeptLabel}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">
                    STT
                  </th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-28 whitespace-nowrap">
                    Mã NV
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-2/5">
                    Nhiệm vụ & Số VB
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Đơn vị chủ trì
                  </th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Hạn hoàn thành
                  </th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Thực tế
                  </th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Đánh giá
                  </th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">
                    Chi tiết
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-10 text-center text-muted-foreground">
                      Không tìm thấy nhiệm vụ nào phù hợp với bộ lọc hiện tại.
                    </td>
                  </tr>
                ) : (
                  paginatedTasks.map((task, index) => (
                    <tr
                      key={task.id}
                      onClick={() => setPreviewTask(task)}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/30 cursor-pointer",
                        index % 2 === 0 ? "bg-card" : "bg-muted/10"
                      )}
                    >
                      <td className="px-2 py-2.5 text-center text-muted-foreground tabular-nums">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-2 py-2.5 text-center font-mono text-xs font-semibold text-foreground">
                        {task.taskCode}
                      </td>
                      <td className="px-2 py-2.5">
                        <div className="line-clamp-2 font-medium text-foreground">{task.title}</div>
                        <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {task.documentNumber ? `VB: ${task.documentNumber} · ` : ""}
                          Lãnh đạo giao: {task.assignedBy}
                        </div>
                        {task.directives.length > 0 && (
                          <div className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <span className="font-semibold">Chỉ đạo:</span> {task.directives[0]}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 whitespace-nowrap font-medium text-foreground">
                        {task.ownerDepartmentName}
                        {task.coordinatingUnits && (
                          <div className="text-[11px] text-muted-foreground font-normal">
                            PH: {task.coordinatingUnits}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center whitespace-nowrap tabular-nums text-muted-foreground font-medium">
                        {formatDate(task.requiredCompletionDate)}
                      </td>
                      <td className="px-2 py-2.5 text-center whitespace-nowrap tabular-nums text-muted-foreground font-medium">
                        {formatDate(task.actualCompletionDate)}
                      </td>
                      <td className="px-2 py-2.5 text-center whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            STATUS_COLORS[task.status] || "bg-muted text-muted-foreground"
                          )}
                        >
                          {task.statusLabel}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewTask(task);
                          }}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                          title="Xem chi tiết"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loadingData && filteredTasks.length > pageSize && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground bg-card">
              <div>
                Trang {currentPage} / {totalPages} (Hiển thị {paginatedTasks.length}/{filteredTasks.length} nhiệm vụ)
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ========================================================
          PREVIEW MODAL: Xem chi tiết nhiệm vụ từ Báo cáo
         ======================================================== */}
      {previewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 print:hidden">
          <div className="fixed inset-0 cursor-pointer bg-slate-950/45 backdrop-blur-sm" onClick={() => setPreviewTask(null)} />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/20">
              <div>
                <span className="font-mono text-xs font-semibold text-primary">{previewTask.taskCode}</span>
                <h3 className="text-base font-bold text-foreground mt-0.5">{previewTask.title}</h3>
              </div>
              <button onClick={() => setPreviewTask(null)} className="rounded p-1 text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto p-5 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Đơn vị chủ trì:</span>
                  <p className="font-medium text-foreground">{previewTask.ownerDepartmentName}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Đơn vị phối hợp:</span>
                  <p className="font-medium text-foreground">{previewTask.coordinatingUnits || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Lãnh đạo giao NV:</span>
                  <p className="font-medium text-foreground">{previewTask.assignedBy}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Số/ký hiệu VB:</span>
                  <p className="font-medium text-foreground">{previewTask.documentNumber || "—"}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Hạn hoàn thành:</span>
                  <p className="font-medium text-foreground">{formatDate(previewTask.requiredCompletionDate)}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Ngày hoàn thành thực tế:</span>
                  <p className="font-medium text-foreground">{formatDate(previewTask.actualCompletionDate)}</p>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Nội dung nhiệm vụ:</span>
                <p className="mt-1 rounded-lg bg-muted/30 p-3 text-sm text-foreground whitespace-pre-wrap">{previewTask.content}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Tiến độ / Bằng chứng / Lý do:</span>
                <p className="mt-1 rounded-lg bg-muted/30 p-3 text-sm text-foreground">
                  {previewTask.completionEvidence || previewTask.incompleteReason || "Chưa có thông tin cập nhật."}
                </p>
              </div>
              {previewTask.directives.length > 0 && (
                <div>
                  <span className="text-xs font-semibold text-amber-800">Ý kiến chỉ đạo của lãnh đạo:</span>
                  <ul className="mt-1 list-disc pl-5 text-xs text-amber-900 space-y-1">
                    {previewTask.directives.map((dir, i) => (
                      <li key={i}>{dir}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="border-t border-border px-5 py-3 text-right bg-muted/20">
              <Button variant="outline" size="sm" onClick={() => setPreviewTask(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          PRINT VIEW: Chuẩn văn bản hành chính Việt Nam (Nghị định 30/2020/NĐ-CP)
          Khổ giấy A4 ngang, phông Times New Roman, border đen sắc nét
         ======================================================== */}
      <div className="hidden print:block font-serif text-black leading-tight bg-white">
        {/* Header 2 cột hành chính */}
        <div className="flex justify-between items-start text-xs">
          <div className="text-center w-72">
            <p className="font-bold uppercase tracking-wider text-[11px]">CỤC ĐƯỜNG BỘ VIỆT NAM</p>
            <p className="font-bold uppercase text-[11px]">{selectedDeptLabel}</p>
            <div className="w-24 mx-auto border-b border-black my-1" />
            <p className="text-[10px] italic">Số: ...../BC-TH</p>
          </div>
          <div className="text-center w-80">
            <p className="font-bold uppercase tracking-wider text-[11px]">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p className="font-bold text-[12px]">Độc lập - Tự do - Hạnh phúc</p>
            <div className="w-36 mx-auto border-b border-black my-1" />
            <p className="text-[10px] italic">Hà Nội, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</p>
          </div>
        </div>

        {/* Tiêu đề Báo cáo */}
        <div className="text-center my-5">
          <h1 className="text-base font-bold uppercase tracking-wide">
            BÁO CÁO TỔNG HỢP THEO DÕI VÀ ĐÁNH GIÁ THỰC HIỆN NHIỆM VỤ
          </h1>
          <p className="italic text-xs mt-1">
            (Kỳ báo cáo: {periodLabel} — Phạm vi: {selectedDeptLabel})
          </p>
        </div>

        {/* PHẦN I: TỔNG HỢP SỐ LIỆU */}
        <div className="mb-4">
          <h2 className="font-bold text-xs uppercase mb-1.5">I. TỔNG HỢP TÌNH HÌNH THỰC HIỆN</h2>
          <table className="w-full text-xs border-collapse border border-black text-center">
            <thead>
              <tr className="bg-slate-100 font-bold">
                <th className="border border-black p-1.5">Tổng nhiệm vụ</th>
                <th className="border border-black p-1.5">Hoàn thành trước hạn</th>
                <th className="border border-black p-1.5">Hoàn thành đúng hạn</th>
                <th className="border border-black p-1.5">Hoàn thành quá hạn</th>
                <th className="border border-black p-1.5">Đang thực hiện</th>
                <th className="border border-black p-1.5">Chưa hoàn thành</th>
                <th className="border border-black p-1.5">Đã hủy</th>
                <th className="border border-black p-1.5">Tỷ lệ hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              <tr className="font-semibold">
                <td className="border border-black p-1.5">{summary.total}</td>
                <td className="border border-black p-1.5">{summary.completedEarly}</td>
                <td className="border border-black p-1.5">{summary.completedOnTime}</td>
                <td className="border border-black p-1.5">{summary.completedLate}</td>
                <td className="border border-black p-1.5">{summary.inProgress}</td>
                <td className="border border-black p-1.5">{summary.incomplete}</td>
                <td className="border border-black p-1.5">{summary.cancelled}</td>
                <td className="border border-black p-1.5">{summary.completionRate}%</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* PHẦN II: BẢNG DANH SÁCH CHI TIẾT */}
        <div className="mb-6">
          <h2 className="font-bold text-xs uppercase mb-1.5">II. DANH SÁCH CHI TIẾT CÁC NHIỆM VỤ</h2>
          <table className="w-full text-[10px] border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100 font-bold text-center">
                <th className="border border-black p-1 w-8">STT</th>
                <th className="border border-black p-1 w-20">Mã NV</th>
                <th className="border border-black p-1 w-24">Số VB</th>
                <th className="border border-black p-1 text-left">Nội dung nhiệm vụ</th>
                <th className="border border-black p-1 w-28">Đơn vị chủ trì</th>
                <th className="border border-black p-1 w-16">Hạn HT</th>
                <th className="border border-black p-1 w-16">Thực tế</th>
                <th className="border border-black p-1 w-24">Đánh giá</th>
                <th className="border border-black p-1 w-36">Tiến độ / Bằng chứng</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, idx) => (
                <tr key={task.id} className="break-inside-avoid">
                  <td className="border border-black p-1 text-center font-medium">{idx + 1}</td>
                  <td className="border border-black p-1 text-center font-mono font-medium">{task.taskCode}</td>
                  <td className="border border-black p-1 text-center">{task.documentNumber || "—"}</td>
                  <td className="border border-black p-1">
                    <div className="font-semibold text-black">{task.title}</div>
                    {task.directives.length > 0 && (
                      <div className="italic text-[9px] text-gray-800 mt-0.5">
                        Chỉ đạo: {task.directives[0]}
                      </div>
                    )}
                  </td>
                  <td className="border border-black p-1 text-center">{task.ownerDepartmentName}</td>
                  <td className="border border-black p-1 text-center">{formatDate(task.requiredCompletionDate)}</td>
                  <td className="border border-black p-1 text-center">{formatDate(task.actualCompletionDate)}</td>
                  <td className="border border-black p-1 text-center font-semibold">{task.statusLabel}</td>
                  <td className="border border-black p-1 text-[9px]">{task.completionEvidence || task.incompleteReason || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* PHẦN CHỮ KÝ */}
        <div className="flex justify-between items-start text-xs break-inside-avoid mt-6">
          <div className="w-64">
            <p className="font-bold italic">Nơi nhận:</p>
            <p className="text-[10px]">- Lãnh đạo Cục;</p>
            <p className="text-[10px]">- Các phòng ban, đơn vị;</p>
            <p className="text-[10px]">- Lưu: VT, TH.</p>
          </div>
          <div className="flex gap-14 text-center">
            <div className="w-40">
              <p className="font-bold uppercase">NGƯỜI LẬP BIỂU</p>
              <p className="italic text-[10px] text-gray-600">(Ký, ghi rõ họ tên)</p>
              <div className="h-16" />
              <p className="font-bold">{userInfo?.fullName || "Quản trị viên"}</p>
            </div>
            <div className="w-44">
              <p className="font-bold uppercase">THỦ TRƯỞNG ĐƠN VỊ</p>
              <p className="italic text-[10px] text-gray-600">(Ký, đóng dấu)</p>
              <div className="h-16" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
