"use client";

import { useEffect, useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Printer,
  Calendar,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { MonthPicker } from "@/components/ui/month-picker";
import { Button } from "@/components/ui/button";

interface UserInfo {
  id: string;
  role: string;
  fullName: string;
  departmentId?: string;
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

export default function ReportsPage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingUser, setLoadingUser] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Filters
  const currentYear = new Date().getFullYear();
  const currentMonth = `${currentYear}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const [dateFilterType, setDateFilterType] = useState<DateFilterType>("MONTH");
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
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

  // Pagination for Preview
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  // 1. Check Auth & Load Departments
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
        console.error("Failed to load report data", err);
      })
      .finally(() => setLoadingData(false));
  };

  useEffect(() => {
    if (userInfo?.role === "ADMIN") {
      fetchReportData();
    }
  }, [userInfo, dateFilterType, selectedYear, selectedMonth, dateFrom, dateTo, selectedDeptId, statusGroup]);

  // 3. Export Excel
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

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";
      const token = localStorage.getItem("accessToken") || "";
      const response = await fetch(`${apiUrl}/reports/tasks/export?${params.toString()}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error("Xuất báo cáo thất bại");

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `Bao_cao_nhiem_vu_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err: any) {
      alert(err.message || "Không thể xuất file Excel");
    } finally {
      setExporting(false);
    }
  };

  // 4. Print handler
  const handlePrint = () => {
    window.print();
  };

  // Format Helpers
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  };

  const getStatusBadge = (status: string, label: string) => {
    let style = "bg-slate-100 text-slate-700 border-slate-200";
    if (["COMPLETED_EARLY", "COMPLETED_ON_TIME"].includes(status)) {
      style = "bg-emerald-50 text-emerald-700 border-emerald-200 font-medium";
    } else if (status === "COMPLETED_LATE") {
      style = "bg-amber-50 text-amber-700 border-amber-200 font-medium";
    } else if (status === "IN_PROGRESS") {
      style = "bg-indigo-50 text-indigo-700 border-indigo-200 font-medium";
    } else if (["INCOMPLETE", "CANCELLED"].includes(status)) {
      style = "bg-rose-50 text-rose-700 border-rose-200 font-medium";
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs border ${style}`}>
        {label}
      </span>
    );
  };

  // Pagination slice
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tasks.slice(start, start + pageSize);
  }, [tasks, currentPage, pageSize]);

  const totalPages = Math.ceil(tasks.length / pageSize) || 1;

  // Description text for current period
  const periodDescription = useMemo(() => {
    if (dateFilterType === "ALL") return "Toàn thời gian (Từ trước đến nay)";
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
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  // Phase 1: Only ADMIN allowed
  if (userInfo?.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 shadow-sm ring-1 ring-rose-200">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-900">Giới hạn quyền truy cập</h2>
        <p className="mt-2 text-sm text-slate-500">
          Tính năng báo cáo đang trong giai đoạn thử nghiệm (Phase 1) và hiện chỉ dành cho Quản trị viên (ADMIN).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header (Hidden on print) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Báo cáo & Thống kê nhiệm vụ
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Tổng hợp, trích xuất dữ liệu Excel và in ấn báo cáo tiến độ nhiệm vụ
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="rounded-lg border-slate-200 bg-white shadow-sm hover:bg-slate-50 text-slate-700"
          >
            <Printer className="mr-2 h-4 w-4 text-slate-600" />
            In báo cáo
          </Button>
          <Button
            onClick={handleExportExcel}
            disabled={exporting}
            className="rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-[0_4px_14px_0_rgba(79,70,229,0.3)] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_0_rgba(79,70,229,0.4)]"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="mr-2 h-4 w-4" />
            )}
            Xuất Excel (.xlsx)
          </Button>
        </div>
      </div>

      {/* 2. Filter Section (Hidden on print) */}
      <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.06)] print:hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-semibold text-slate-800">
          <Filter className="h-4 w-4 text-indigo-600" />
          <span>Bộ lọc dữ liệu báo cáo</span>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
          {/* A. Mode thời gian */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Kiểu thời gian
            </label>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {[
                { id: "ALL", label: "Toàn bộ" },
                { id: "YEAR", label: "Theo năm" },
                { id: "MONTH", label: "Theo tháng" },
                { id: "CUSTOM", label: "Tùy chọn" },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setDateFilterType(m.id as DateFilterType)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    dateFilterType === m.id
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* B. Chọn chi tiết thời gian */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Mốc thời gian
            </label>
            <div className="mt-1.5">
              {dateFilterType === "ALL" && (
                <div className="flex h-9 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs text-slate-600">
                  Từ trước tới nay (100% dữ liệu)
                </div>
              )}
              {dateFilterType === "YEAR" && (
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
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
                    className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                  <span className="text-slate-400">-</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>
              )}
            </div>
          </div>

          {/* C. Lọc phòng ban */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Phòng ban / Đơn vị
            </label>
            <div className="mt-1.5">
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="">Tất cả phòng ban</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* D. Lọc nhóm trạng thái */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Trạng thái nhiệm vụ
            </label>
            <div className="mt-1.5">
              <select
                value={statusGroup}
                onChange={(e) => setStatusGroup(e.target.value as StatusGroup)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">Tất cả nhiệm vụ</option>
                <option value="COMPLETED">Đã hoàn thành (Sớm / Đúng / Trễ)</option>
                <option value="IN_PROGRESS">Đang thực hiện</option>
                <option value="INCOMPLETE">Chưa hoàn thành / Quá hạn</option>
                <option value="CANCELLED">Đã hủy</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Summary Stats Cards (Visible in Screen & Print) */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5 print:grid-cols-5 print:gap-2">
        {/* Total */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.06)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Tổng nhiệm vụ</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{summary.total}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Trong chu kỳ đã chọn</p>
        </div>

        {/* Completed */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.06)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đã hoàn thành</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-600">{summary.totalCompleted}</span>
            <span className="text-xs font-semibold text-emerald-600">({summary.completionRate}%)</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Sớm: {summary.completedEarly} · Đúng: {summary.completedOnTime} · Trễ: {summary.completedLate}
          </p>
        </div>

        {/* In Progress */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.06)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đang thực hiện</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-600">{summary.inProgress}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Chưa đến hạn chót</p>
        </div>

        {/* Incomplete / Overdue */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.06)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Quá hạn / Chưa xong</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-rose-600">{summary.incomplete}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Cần đốc thúc xử lý</p>
        </div>

        {/* Cancelled */}
        <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-[0_4px_20px_-2px_rgba(79,70,229,0.06)]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Đã hủy</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-700">{summary.cancelled}</span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">Loại khỏi đánh giá</p>
        </div>
      </div>

      {/* 4. PRINT ONLY: Official Administrative Header */}
      <div className="hidden print:block mb-6">
        <div className="flex justify-between items-start text-xs font-bold text-slate-800">
          <div className="text-center">
            <p>HỆ THỐNG QUẢN LÝ NHIỆM VỤ GTTM</p>
            <p className="font-normal text-[10px]">Phòng ban: {selectedDeptId ? departments.find(d => d.id === selectedDeptId)?.name : "Toàn cơ quan"}</p>
          </div>
          <div className="text-center">
            <p>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
            <p className="font-normal italic text-[11px]">Độc lập - Tự do - Hạnh phúc</p>
          </div>
        </div>

        <div className="text-center my-4">
          <h2 className="text-base font-bold uppercase text-slate-900">
            BÁO CÁO THEO DÕI VÀ ĐÁNH GIÁ THỰC HIỆN NHIỆM VỤ
          </h2>
          <p className="italic text-xs text-slate-600 mt-1">
            {periodDescription}
          </p>
        </div>
      </div>

      {/* 5. Detailed Tasks Table */}
      <div className="rounded-xl border border-slate-100 bg-white shadow-[0_4px_20px_-2px_rgba(79,70,229,0.06)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-900">Danh sách nhiệm vụ chi tiết</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {tasks.length} nhiệm vụ
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {periodDescription}
          </span>
        </div>

        {loadingData ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <span className="ml-2 text-sm text-slate-500">Đang tổng hợp dữ liệu...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-400">
            Không có nhiệm vụ nào phù hợp với bộ lọc đã chọn.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600 font-semibold print:bg-slate-100">
                  <th className="py-2.5 px-3 w-10 text-center border-r border-slate-200">STT</th>
                  <th className="py-2.5 px-3 w-24 border-r border-slate-200">Mã NV</th>
                  <th className="py-2.5 px-3 w-28 border-r border-slate-200">Số VB</th>
                  <th className="py-2.5 px-3 min-w-[200px] border-r border-slate-200">Nội dung nhiệm vụ</th>
                  <th className="py-2.5 px-3 w-32 border-r border-slate-200">Đơn vị chủ trì</th>
                  <th className="py-2.5 px-3 w-24 text-center border-r border-slate-200">Hạn hoàn thành</th>
                  <th className="py-2.5 px-3 w-24 text-center border-r border-slate-200">Ngày thực tế</th>
                  <th className="py-2.5 px-3 w-32 text-center border-r border-slate-200">Đánh giá tiến độ</th>
                  <th className="py-2.5 px-3 min-w-[150px]">Tiến độ / Bằng chứng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {/* When printing, print ALL tasks without pagination */}
                {(typeof window !== "undefined" && window.matchMedia("print").matches ? tasks : paginatedTasks).map(
                  (task, idx) => (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/50 transition-colors break-inside-avoid"
                    >
                      <td className="py-2.5 px-3 text-center border-r border-slate-100 font-medium text-slate-500">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-100 font-mono font-medium text-slate-900">
                        {task.taskCode}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-100 text-slate-600">
                        {task.documentNumber || "-"}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-100">
                        <div className="font-medium text-slate-900">{task.title}</div>
                        {task.directives.length > 0 && (
                          <div className="mt-1 text-[11px] text-amber-700 bg-amber-50/60 p-1 rounded">
                            <span className="font-semibold">Chỉ đạo:</span> {task.directives[0]}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 border-r border-slate-100 font-medium text-slate-800">
                        {task.ownerDepartmentName}
                        {task.coordinatingUnits && (
                          <div className="text-[10px] text-slate-400 font-normal">
                            PH: {task.coordinatingUnits}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-100 font-medium">
                        {formatDate(task.requiredCompletionDate)}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-100 font-medium">
                        {formatDate(task.actualCompletionDate)}
                      </td>
                      <td className="py-2.5 px-3 text-center border-r border-slate-100">
                        {getStatusBadge(task.status, task.statusLabel)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {task.completionEvidence || task.incompleteReason || "-"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination in preview (Hidden on print) */}
        {!loadingData && tasks.length > pageSize && (
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500 print:hidden">
            <div>
              Trang {currentPage} / {totalPages} (Hiển thị {paginatedTasks.length}/{tasks.length} nhiệm vụ)
            </div>
            <div className="flex items-center gap-2">
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
      </div>

      {/* 6. PRINT ONLY: Signatures Footer */}
      <div className="hidden print:block mt-8 pt-4">
        <div className="flex justify-between text-xs text-slate-800">
          <div className="text-center w-64">
            <p className="font-bold">NGƯỜI LẬP BIỂU</p>
            <p className="italic text-[11px] text-slate-500 mt-0.5">(Ký, ghi rõ họ tên)</p>
            <div className="h-20" />
            <p className="font-medium">{userInfo?.fullName || "Quản trị viên"}</p>
          </div>
          <div className="text-center w-64">
            <p className="italic text-[11px] text-slate-600">
              Hà Nội, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
            </p>
            <p className="font-bold mt-1">THỦ TRƯỞNG ĐƠN VỊ</p>
            <p className="italic text-[11px] text-slate-500 mt-0.5">(Ký, đóng dấu)</p>
            <div className="h-20" />
          </div>
        </div>
      </div>
    </div>
  );
}
