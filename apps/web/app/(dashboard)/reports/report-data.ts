export const STATUS_OPTIONS = [
  ["ALL", "Tất cả trạng thái"],
  ["COMPLETED", "Đã hoàn thành"],
  ["COMPLETED_EARLY", "Hoàn thành trước hạn"],
  ["COMPLETED_ON_TIME", "Hoàn thành đúng hạn"],
  ["COMPLETED_LATE", "Hoàn thành quá hạn"],
  ["IN_PROGRESS", "Đang thực hiện"],
  ["INCOMPLETE", "Không hoàn thành"],
  ["CANCELLED", "Đã hủy"],
  ["NO_EVALUATION", "Không đánh giá"],
] as const;

type StatusFilter = typeof STATUS_OPTIONS[number][0];
type DateFilter = "MONTH" | "YEAR" | "CUSTOM" | "ALL";

export interface ReportFilters {
  dateFilterType: DateFilter;
  month: string;
  year: string;
  dateFrom: string;
  dateTo: string;
  departmentId: string;
  statusGroup: StatusFilter;
  search: string;
}

export interface ReportTask {
  id: string;
  title: string;
  content: string;
  documentNumber: string | null;
  ownerDepartmentName: string;
  coordinatingUnits: string | null;
  assignedDate: string;
  assignedBy: string;
  requiredCompletionDate: string | null;
  actualCompletionDate: string | null;
  status: Exclude<StatusFilter, "ALL" | "COMPLETED">;
  statusLabel: string;
  completionEvidence: string | null;
  incompleteReason: string | null;
  directives: string[];
}

export interface ReportData {
  summary: {
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
    onTimeRate: number;
  };
  tasks: ReportTask[];
  scope: { period: string; department: string; status: string; search: string };
}

const timeZone = "Asia/Ho_Chi_Minh";
const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  timeZone, day: "2-digit", month: "2-digit", year: "numeric",
});

export function formatReportDate(value: string | Date | null) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

export function defaultFilters(): ReportFilters {
  const now = new Date();
  const year = new Intl.DateTimeFormat("en", { timeZone, year: "numeric" }).format(now);
  const month = new Intl.DateTimeFormat("en", { timeZone, month: "2-digit" }).format(now);
  return {
    dateFilterType: "MONTH",
    month: `${year}-${month}`,
    year,
    dateFrom: "",
    dateTo: "",
    departmentId: "",
    statusGroup: "ALL",
    search: "",
  };
}

export function reportQuery(filters: ReportFilters) {
  const { dateFilterType, year, month, dateFrom, dateTo, departmentId, statusGroup, search } = filters;
  const query = new URLSearchParams({ dateFilterType });
  if (dateFilterType === "YEAR") query.set("year", year);
  if (dateFilterType === "MONTH") query.set("month", month);
  if (dateFilterType === "CUSTOM") {
    if (dateFrom) query.set("dateFrom", dateFrom);
    if (dateTo) query.set("dateTo", dateTo);
  }
  if (departmentId) query.set("departmentId", departmentId);
  if (statusGroup !== "ALL") query.set("statusGroup", statusGroup);
  if (search.trim()) query.set("search", search.trim());
  return query.toString();
}

export function reportSummaryRows(summary: ReportData["summary"]) {
  return [
    ["Tổng số", summary.total],
    ["Hoàn thành trước hạn", summary.completedEarly],
    ["Hoàn thành đúng hạn", summary.completedOnTime],
    ["Hoàn thành quá hạn", summary.completedLate],
    ["Đang thực hiện", summary.inProgress],
    ["Không hoàn thành", summary.incomplete],
    ["Đã hủy", summary.cancelled],
    ["Không đánh giá", summary.noEvaluation],
    ["Tỷ lệ xử lý", `${summary.completionRate}%`],
    ["Tỷ lệ đúng hạn", `${summary.onTimeRate}%`],
  ] as const;
}

export function reportScopeLabel(scope: ReportData["scope"]) {
  return [
    scope.period,
    scope.department,
    scope.status,
    scope.search && `Từ khóa “${scope.search}”`,
  ].filter(Boolean).join(" · ");
}
