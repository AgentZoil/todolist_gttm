"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarX,
  TrendingUp,
  ClipboardList,
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

interface ReportFilterState {
  dateFilterType: DateFilterType;
  year: string;
  month: string;
  dateFrom: string;
  dateTo: string;
  departmentId: string;
  statusGroup: StatusGroup;
  search: string;
}

const STATUS_COLORS: Record<string, string> = {
  COMPLETED_EARLY: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  COMPLETED_ON_TIME: "bg-emerald-50 text-emerald-700 ring-emerald-200",
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
  const [filtering, setFiltering] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Selected Task for Preview modal
  const [previewTask, setPreviewTask] = useState<TaskItem | null>(null);

  // Date Popover State
  const [showDatePopover, setShowDatePopover] = useState(false);
  const datePopoverRef = useRef<HTMLDivElement>(null);

  // Initial Filter defaults
  const currentYear = new Date().getFullYear();
  const defaultFilters: ReportFilterState = {
    dateFilterType: "MONTH",
    year: String(currentYear),
    month: getCurrentMonth(),
    dateFrom: "",
    dateTo: "",
    departmentId: "",
    statusGroup: "ALL",
    search: "",
  };

  // Draft filters (User changes these in UI)
  const [draftFilters, setDraftFilters] = useState<ReportFilterState>(defaultFilters);

  // Applied filters (The filters currently active for data)
  const [appliedFilters, setAppliedFilters] = useState<ReportFilterState>(defaultFilters);

  // Temp date states for popover editing
  const [tempDateType, setTempDateType] = useState<DateFilterType>("MONTH");
  const [tempYear, setTempYear] = useState<string>(String(currentYear));
  const [tempMonth, setTempMonth] = useState<string>(getCurrentMonth());
  const [tempDateFrom, setTempDateFrom] = useState<string>("");
  const [tempDateTo, setTempDateTo] = useState<string>("");

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

  // 2. Fetch Report Data using given filters
  const executeFetch = (filtersToApply: ReportFilterState) => {
    if (!userInfo || userInfo.role !== "ADMIN") return;
    setFiltering(true);

    const params = new URLSearchParams();
    params.set("dateFilterType", filtersToApply.dateFilterType);
    if (filtersToApply.dateFilterType === "YEAR") params.set("year", filtersToApply.year);
    if (filtersToApply.dateFilterType === "MONTH") params.set("month", filtersToApply.month);
    if (filtersToApply.dateFilterType === "CUSTOM") {
      if (filtersToApply.dateFrom) params.set("dateFrom", filtersToApply.dateFrom);
      if (filtersToApply.dateTo) params.set("dateTo", filtersToApply.dateTo);
    }
    if (filtersToApply.departmentId) params.set("departmentId", filtersToApply.departmentId);
    if (filtersToApply.statusGroup !== "ALL") params.set("statusGroup", filtersToApply.statusGroup);

    apiFetch<{ summary: SummaryStats; tasks: TaskItem[] }>(`/reports/tasks?${params.toString()}`)
      .then((res) => {
        setSummary(res.summary);
        setTasks(res.tasks || []);
        setCurrentPage(1);
      })
      .catch((err) => {
        console.error("Failed to load report data", err);
      })
      .finally(() => setFiltering(false));
  };

  // Initial load once userInfo is ready
  useEffect(() => {
    if (userInfo?.role === "ADMIN") {
      executeFetch(appliedFilters);
    }
  }, [userInfo]);

  // Check if draft differs from applied
  const hasFilterChanges = useMemo(() => {
    return JSON.stringify(draftFilters) !== JSON.stringify(appliedFilters);
  }, [draftFilters, appliedFilters]);

  // Check if any filter is set (not default/empty)
  const hasAnyActiveFilter = useMemo(() => {
    return (
      draftFilters.departmentId !== "" ||
      draftFilters.statusGroup !== "ALL" ||
      draftFilters.search !== "" ||
      draftFilters.dateFilterType !== "MONTH" ||
      draftFilters.month !== getCurrentMonth()
    );
  }, [draftFilters]);

  // Apply filters button clicked
  const handleApplyFilters = () => {
    setAppliedFilters(draftFilters);
    executeFetch(draftFilters);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setDraftFilters(defaultFilters);
    setAppliedFilters(defaultFilters);
    setTempDateType("MONTH");
    setTempMonth(getCurrentMonth());
    setTempYear(String(currentYear));
    setTempDateFrom("");
    setTempDateTo("");
    executeFetch(defaultFilters);
  };

  // Open Date Popover
  const handleOpenDatePopover = () => {
    setTempDateType(draftFilters.dateFilterType);
    setTempYear(draftFilters.year);
    setTempMonth(draftFilters.month);
    setTempDateFrom(draftFilters.dateFrom);
    setTempDateTo(draftFilters.dateTo);
    setShowDatePopover(true);
  };

  // Apply Date from Popover to draft
  const handleSaveDatePopover = () => {
    setDraftFilters((prev) => ({
      ...prev,
      dateFilterType: tempDateType,
      year: tempYear,
      month: tempMonth,
      dateFrom: tempDateFrom,
      dateTo: tempDateTo,
    }));
    setShowDatePopover(false);
  };

  // Quick Date Preset Select
  const handleSelectDatePreset = (preset: "ALL" | "THIS_MONTH" | "LAST_MONTH" | "THIS_YEAR" | "LAST_YEAR") => {
    const now = new Date();
    if (preset === "ALL") {
      setTempDateType("ALL");
    } else if (preset === "THIS_MONTH") {
      setTempDateType("MONTH");
      setTempMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    } else if (preset === "LAST_MONTH") {
      setTempDateType("MONTH");
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      setTempMonth(`${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}`);
    } else if (preset === "THIS_YEAR") {
      setTempDateType("YEAR");
      setTempYear(String(now.getFullYear()));
    } else if (preset === "LAST_YEAR") {
      setTempDateType("YEAR");
      setTempYear(String(now.getFullYear() - 1));
    }
  };

  // 3. Export Excel via standard apiDownload (using applied filters)
  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("dateFilterType", appliedFilters.dateFilterType);
      if (appliedFilters.dateFilterType === "YEAR") params.set("year", appliedFilters.year);
      if (appliedFilters.dateFilterType === "MONTH") params.set("month", appliedFilters.month);
      if (appliedFilters.dateFilterType === "CUSTOM") {
        if (appliedFilters.dateFrom) params.set("dateFrom", appliedFilters.dateFrom);
        if (appliedFilters.dateTo) params.set("dateTo", appliedFilters.dateTo);
      }
      if (appliedFilters.departmentId) params.set("departmentId", appliedFilters.departmentId);
      if (appliedFilters.statusGroup !== "ALL") params.set("statusGroup", appliedFilters.statusGroup);

      const filename = `Bao_cao_nhiem_vu_${appliedFilters.dateFilterType}_${Date.now()}.xlsx`;
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

  // Filter tasks in table with draft search keyword
  const filteredTasks = useMemo(() => {
    if (!draftFilters.search.trim()) return tasks;
    const q = draftFilters.search.toLowerCase().trim();
    return tasks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.documentNumber && t.documentNumber.toLowerCase().includes(q)) ||
        t.ownerDepartmentName.toLowerCase().includes(q) ||
        t.assignedBy.toLowerCase().includes(q)
    );
  }, [tasks, draftFilters.search]);

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize) || 1;

  // Selected department label
  const selectedDeptLabel = useMemo(() => {
    if (!appliedFilters.departmentId) return "Toàn cơ quan";
    const d = departments.find((dept) => dept.id === appliedFilters.departmentId);
    return d ? d.name : "Toàn cơ quan";
  }, [appliedFilters.departmentId, departments]);

  // Current date button label
  const dateButtonLabel = useMemo(() => {
    if (draftFilters.dateFilterType === "ALL") return "Toàn thời gian";
    if (draftFilters.dateFilterType === "YEAR") return `Năm ${draftFilters.year}`;
    if (draftFilters.dateFilterType === "MONTH") {
      const [y, m] = draftFilters.month.split("-");
      return `Tháng ${Number(m)}/${y}`;
    }
    if (draftFilters.dateFilterType === "CUSTOM") {
      if (draftFilters.dateFrom || draftFilters.dateTo) {
        return `${draftFilters.dateFrom ? formatDate(draftFilters.dateFrom) : "..."} - ${draftFilters.dateTo ? formatDate(draftFilters.dateTo) : "..."}`;
      }
      return "Chọn khoảng ngày";
    }
    return "Thời gian";
  }, [draftFilters]);

  // Period label for report headers
  const appliedPeriodLabel = useMemo(() => {
    if (appliedFilters.dateFilterType === "ALL") return "Toàn thời gian";
    if (appliedFilters.dateFilterType === "YEAR") return `Năm ${appliedFilters.year}`;
    if (appliedFilters.dateFilterType === "MONTH") {
      const [y, m] = appliedFilters.month.split("-");
      return `Tháng ${Number(m)}/${y}`;
    }
    if (appliedFilters.dateFilterType === "CUSTOM") {
      return `Từ ${appliedFilters.dateFrom ? formatDate(appliedFilters.dateFrom) : "..."} đến ${appliedFilters.dateTo ? formatDate(appliedFilters.dateTo) : "..."}`;
    }
    return "";
  }, [appliedFilters]);

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
          SCREEN VIEW: UI nhất quán chuẩn với /tasks và Dashboard
         ======================================================== */}
      <div className="space-y-6 print:hidden">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
              Báo cáo & Thống kê nhiệm vụ
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tổng hợp tiến độ, xuất file Excel và in ấn báo cáo theo chuẩn hành chính
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

        {/* 6 Stat Cards (Nhất quán 100% với Dashboard, không có banner tím) */}
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
            <p className="mt-1 text-[11px] text-muted-foreground">Nhiệm vụ trong kỳ</p>
          </Card>

          {/* Card 2: Hoàn thành đúng hạn */}
          <Card className="p-4 rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Đúng hạn</span>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums text-emerald-600">
                {summary.completedOnTime + summary.completedEarly}
              </span>
              <span className="text-xs font-semibold text-emerald-600">({summary.completionRate}%)</span>
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
            <p className="mt-1 text-[11px] text-muted-foreground">Trong hạn quy định</p>
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

        {/* Filter Toolbar (Thiết kế & Logic chuẩn /tasks: Chọn filter rồi ấn Áp dụng) */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Lọc phòng ban */}
          <label className="block w-full sm:w-[220px]">
            <span className="sr-only">Phòng ban / Đơn vị</span>
            <select
              value={draftFilters.departmentId}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, departmentId: e.target.value }))}
              disabled={filtering}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 pr-8 text-sm shadow-sm ring-1 ring-foreground/5 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              <option value="">Tất cả phòng ban/đơn vị</option>
              {[...departments]
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((dept, i) => (
                  <option key={dept.id} value={dept.id}>
                    {i + 1}. {dept.name}
                  </option>
                ))}
            </select>
          </label>

          {/* Lọc trạng thái */}
          <label className="block w-full sm:w-[190px]">
            <span className="sr-only">Trạng thái đánh giá</span>
            <select
              value={draftFilters.statusGroup}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, statusGroup: e.target.value as StatusGroup }))}
              disabled={filtering}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 pr-8 text-sm shadow-sm ring-1 ring-foreground/5 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="COMPLETED">Đã hoàn thành</option>
              <option value="IN_PROGRESS">Đang thực hiện</option>
              <option value="INCOMPLETE">Chưa hoàn thành / Quá hạn</option>
              <option value="CANCELLED">Đã hủy</option>
            </select>
          </label>

          {/* Date Filter Popover thông minh, khoa học theo design system */}
          <div className="relative w-full sm:w-[200px]" ref={datePopoverRef}>
            <button
              type="button"
              onClick={() => {
                if (!showDatePopover) handleOpenDatePopover();
                else setShowDatePopover(false);
              }}
              className={cn(
                "flex h-9 w-full items-center gap-2 rounded-lg border bg-background px-3 text-left text-sm shadow-sm ring-1 ring-foreground/5 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20",
                draftFilters.dateFilterType !== "ALL"
                  ? "border-primary/40 font-medium text-primary"
                  : "border-border text-muted-foreground"
              )}
            >
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="truncate">{dateButtonLabel}</span>
            </button>

            {showDatePopover && (
              <>
                <div className="fixed inset-0 z-40 cursor-pointer" onClick={() => setShowDatePopover(false)} />
                <div className="absolute left-0 top-full z-50 mt-1.5 w-[310px] rounded-xl border border-border bg-card p-3.5 shadow-xl ring-1 ring-foreground/5 space-y-3">
                  {/* Preset Buttons */}
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Chọn nhanh
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: "ALL", label: "Toàn bộ" },
                        { id: "THIS_MONTH", label: "Tháng này" },
                        { id: "LAST_MONTH", label: "Tháng trước" },
                        { id: "THIS_YEAR", label: "Năm nay" },
                        { id: "LAST_YEAR", label: "Năm trước" },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectDatePreset(preset.id as any)}
                          className={cn(
                            "rounded-md py-1 px-2 text-xs font-medium transition-colors border",
                            (preset.id === "ALL" && tempDateType === "ALL") ||
                              (preset.id === "THIS_MONTH" && tempDateType === "MONTH" && tempMonth === getCurrentMonth())
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border bg-muted/40 hover:bg-muted text-foreground"
                          )}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Mode Tabs */}
                  <div className="pt-2 border-t border-border/60">
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                      Tùy chỉnh thời gian
                    </label>
                    <div className="flex rounded-lg bg-muted/60 p-0.5 text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setTempDateType("MONTH")}
                        className={cn(
                          "flex-1 rounded-md py-1 text-center transition-colors",
                          tempDateType === "MONTH" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Tháng
                      </button>
                      <button
                        type="button"
                        onClick={() => setTempDateType("YEAR")}
                        className={cn(
                          "flex-1 rounded-md py-1 text-center transition-colors",
                          tempDateType === "YEAR" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Năm
                      </button>
                      <button
                        type="button"
                        onClick={() => setTempDateType("CUSTOM")}
                        className={cn(
                          "flex-1 rounded-md py-1 text-center transition-colors",
                          tempDateType === "CUSTOM" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        Khoảng ngày
                      </button>
                    </div>

                    <div className="mt-2.5">
                      {tempDateType === "MONTH" && (
                        <MonthPicker value={tempMonth} onChange={setTempMonth} />
                      )}
                      {tempDateType === "YEAR" && (
                        <select
                          value={tempYear}
                          onChange={(e) => setTempYear(e.target.value)}
                          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        >
                          {[2024, 2025, 2026, 2027, 2028].map((y) => (
                            <option key={y} value={y}>
                              Năm {y}
                            </option>
                          ))}
                        </select>
                      )}
                      {tempDateType === "CUSTOM" && (
                        <div className="flex flex-col gap-2">
                          <div>
                            <span className="text-[11px] text-muted-foreground">Từ ngày:</span>
                            <input
                              type="date"
                              value={tempDateFrom}
                              onChange={(e) => setTempDateFrom(e.target.value)}
                              className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 mt-0.5"
                            />
                          </div>
                          <div>
                            <span className="text-[11px] text-muted-foreground">Đến ngày:</span>
                            <input
                              type="date"
                              value={tempDateTo}
                              min={tempDateFrom || undefined}
                              onChange={(e) => setTempDateTo(e.target.value)}
                              className="h-8 w-full rounded-lg border border-border bg-background px-2.5 text-xs shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 mt-0.5"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Popover Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveDatePopover}
                      className="flex-1 h-8 text-xs font-medium"
                    >
                      Xong
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDatePopover(false)}
                      className="h-8 text-xs"
                    >
                      Đóng
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Ô tìm kiếm từ khóa (tiêu đề, số VB, lãnh đạo...) */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={draftFilters.search}
              onChange={(e) => setDraftFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Tìm tiêu đề, số VB..."
              className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-7 text-sm shadow-sm ring-1 ring-foreground/5 transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {draftFilters.search && (
              <button
                type="button"
                onClick={() => setDraftFilters((prev) => ({ ...prev, search: "" }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Nút Xóa bộ lọc */}
          {hasAnyActiveFilter && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="h-9 rounded-lg px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Xóa
            </button>
          )}

          {/* Nút Áp dụng (Chỉ xuất hiện khi có thay đổi bộ lọc, chuẩn theo /tasks) */}
          {hasFilterChanges && (
            <Button
              type="button"
              size="sm"
              onClick={handleApplyFilters}
              disabled={filtering}
            >
              {filtering ? <Loader2 className="h-4 w-4 animate-spin" /> : "Áp dụng"}
            </Button>
          )}
        </div>

        {/* Detailed Table (Không còn cột Mã nhiệm vụ) */}
        <Card className="overflow-hidden relative shadow-sm border-border">
          {filtering && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm font-medium">Đang tải dữ liệu...</span>
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
              {appliedPeriodLabel} · {selectedDeptLabel}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-12">
                    STT
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-2/5">
                    Nội dung nhiệm vụ & Số VB
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Đơn vị chủ trì
                  </th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Hạn hoàn thành
                  </th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                    Thực tế
                  </th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
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
                    <td colSpan={7} className="p-10 text-center text-muted-foreground">
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
                      <td className="px-3 py-2.5">
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
                      <td className="px-3 py-2.5 whitespace-nowrap font-medium text-foreground">
                        {task.ownerDepartmentName}
                        {task.coordinatingUnits && (
                          <div className="text-[11px] text-muted-foreground font-normal">
                            PH: {task.coordinatingUnits}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap tabular-nums text-muted-foreground font-medium">
                        {formatDate(task.requiredCompletionDate)}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap tabular-nums text-muted-foreground font-medium">
                        {formatDate(task.actualCompletionDate)}
                      </td>
                      <td className="px-3 py-2.5 text-center whitespace-nowrap">
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
          {!filtering && filteredTasks.length > pageSize && (
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
          PREVIEW MODAL: Xem chi tiết nhiệm vụ (Không có Mã NV)
         ======================================================== */}
      {previewTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 print:hidden">
          <div className="fixed inset-0 cursor-pointer bg-slate-950/45 backdrop-blur-sm" onClick={() => setPreviewTask(null)} />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-5 py-4 bg-muted/20">
              <div className="min-w-0 pr-4">
                <h3 className="text-base font-bold text-foreground line-clamp-1">{previewTask.title}</h3>
                {previewTask.documentNumber && (
                  <p className="text-xs text-muted-foreground mt-0.5">Số văn bản: {previewTask.documentNumber}</p>
                )}
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
          Khổ giấy A4 ngang, phông Times New Roman, border đen sắc nét (Không có Mã NV)
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
            (Kỳ báo cáo: {appliedPeriodLabel} — Phạm vi: {selectedDeptLabel})
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

        {/* PHẦN II: BẢNG DANH SÁCH CHI TIẾT (Không có Mã NV) */}
        <div className="mb-6">
          <h2 className="font-bold text-xs uppercase mb-1.5">II. DANH SÁCH CHI TIẾT CÁC NHIỆM VỤ</h2>
          <table className="w-full text-[10px] border-collapse border border-black">
            <thead>
              <tr className="bg-slate-100 font-bold text-center">
                <th className="border border-black p-1 w-8">STT</th>
                <th className="border border-black p-1 w-24">Số VB</th>
                <th className="border border-black p-1 text-left">Nội dung nhiệm vụ</th>
                <th className="border border-black p-1 w-32">Đơn vị chủ trì</th>
                <th className="border border-black p-1 w-20">Hạn HT</th>
                <th className="border border-black p-1 w-20">Thực tế</th>
                <th className="border border-black p-1 w-28">Đánh giá</th>
                <th className="border border-black p-1 w-40">Tiến độ / Bằng chứng</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((task, idx) => (
                <tr key={task.id} className="break-inside-avoid">
                  <td className="border border-black p-1 text-center font-medium">{idx + 1}</td>
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
