"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ListTodo,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Search,
  Loader2,
  Calendar,
  Lock,
  Unlock,
  Check,
  Flag,
  Circle,
  Clock3,
} from "lucide-react";

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Task {
  id: string;
  title: string;
  content: string;
  source: string;
  assignedDate: string;
  assignedBy: string;
  priority: "URGENT" | "NORMAL";
  documentNumber?: string;
  coordinatingUnits?: string;
  requiredCompletionDate?: string;
  actualCompletionDate?: string;
  completionEvidence?: string;
  incompleteReason?: string;
  isCancelled: boolean;
  cancelledAt?: string;
  isFinalized: boolean;
  finalizedAt?: string;
  finalizedBy?: string;
  version: number;
  createdAt: string;
  ownerDepartment: Department;
  creator: { id: string; fullName: string };
  status: string;
  statusLabel: string;
  statusColor: string;
  approvalStatus: "NOT_SUBMITTED" | "PENDING" | "APPROVED" | "NEEDS_REVISION";
  approvalStatusLabel?: string;
  feedbacks?: TaskFeedback[];
}

interface TaskFeedback {
  id: string;
  type: "DIRECTIVE" | "REVIEW";
  decision?: "APPROVED" | "NEEDS_REVISION";
  content: string;
  createdAt: string;
  author: { id: string; fullName: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface UserInfo {
  id: string;
  email: string;
  fullName: string;
  role: string;
  departmentId: string;
  departmentName: string;
}

const STATUS_COLORS: Record<string, string> = {
  CANCELLED: "bg-red-50/80 text-red-700 ring-red-200/70",
  IN_PROGRESS: "bg-blue-50/80 text-blue-700 ring-blue-200/70",
  INCOMPLETE: "bg-red-50/80 text-red-700 ring-red-200/70",
  COMPLETED_EARLY: "bg-emerald-50/80 text-emerald-700 ring-emerald-200/70",
  COMPLETED_ON_TIME: "bg-emerald-50/80 text-emerald-700 ring-emerald-200/70",
  COMPLETED_LATE: "bg-orange-50/80 text-orange-700 ring-orange-200/70",
  NO_EVALUATION: "bg-muted/70 text-muted-foreground ring-border/70",
};

const STATUS_LABELS: Record<string, string> = {
  CANCELLED: "Đã hủy",
  IN_PROGRESS: "Đang thực hiện",
  INCOMPLETE: "Không hoàn thành",
  COMPLETED_EARLY: "Hoàn thành trước hạn",
  COMPLETED_ON_TIME: "Hoàn thành đúng hạn",
  COMPLETED_LATE: "Hoàn thành quá hạn",
  NO_EVALUATION: "Không đánh giá",
};

const STATUS_ICONS: Record<string, LucideIcon> = {
  CANCELLED: AlertCircle,
  IN_PROGRESS: Clock3,
  INCOMPLETE: AlertCircle,
  COMPLETED_EARLY: CheckCircle2,
  COMPLETED_ON_TIME: CheckCircle2,
  COMPLETED_LATE: AlertCircle,
  NO_EVALUATION: Calendar,
};

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function getLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDayDifference(later: Date, earlier: Date) {
  return Math.round((getLocalDay(later).getTime() - getLocalDay(earlier).getTime()) / DAY_IN_MS);
}

function getRealtimeStatus(task: Pick<Task, "isCancelled" | "requiredCompletionDate" | "actualCompletionDate">, now: Date) {
  if (task.isCancelled) return "CANCELLED";
  if (!task.requiredCompletionDate) return "NO_EVALUATION";
  if (!task.actualCompletionDate) {
    const deadline = new Date(task.requiredCompletionDate);
    const deadlineEnd = new Date(deadline.getFullYear(), deadline.getMonth(), deadline.getDate(), 23, 59, 59, 999);
    return now.getTime() > deadlineEnd.getTime() ? "INCOMPLETE" : "IN_PROGRESS";
  }

  const difference = getDayDifference(new Date(task.actualCompletionDate), new Date(task.requiredCompletionDate));
  if (difference < 0) return "COMPLETED_EARLY";
  if (difference === 0) return "COMPLETED_ON_TIME";
  return "COMPLETED_LATE";
}

function getDeadlineSummary(task: Pick<Task, "isCancelled" | "requiredCompletionDate" | "actualCompletionDate">, now: Date) {
  if (task.isCancelled) {
    return { label: "Đã hủy", className: "text-muted-foreground" };
  }
  if (!task.requiredCompletionDate) {
    return null;
  }

  const requiredDate = new Date(task.requiredCompletionDate);
  if (!task.actualCompletionDate) {
    const days = getDayDifference(requiredDate, now);
    if (days > 0) return { label: `Còn ${days} ngày`, className: "text-blue-600" };
    if (days === 0) return { label: "Hôm nay", className: "text-blue-600" };
    return { label: `Trễ ${Math.abs(days)} ngày`, className: "text-destructive" };
  }

  const days = getDayDifference(requiredDate, new Date(task.actualCompletionDate));
  if (days > 0) return { label: `Sớm ${days} ngày`, className: "text-emerald-600" };
  if (days === 0) return null;
  return { label: `Trễ ${Math.abs(days)} ngày`, className: "text-orange-600" };
}

function RealtimeStatusCell({ task, now }: { task: Task; now: Date }) {
  const status = getRealtimeStatus(task, now);
  const StatusIcon = STATUS_ICONS[status] || AlertCircle;
  const deadline = getDeadlineSummary(task, now);

  return (
    <div className="flex min-w-[150px] flex-col items-center gap-1">
      <span className={cn("inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold ring-1", STATUS_COLORS[status] || STATUS_COLORS.NO_EVALUATION)}>
        <StatusIcon className="h-3.5 w-3.5" strokeWidth={2.5} />
        {STATUS_LABELS[status] || task.statusLabel}
      </span>
      {deadline && (
        <span className={cn("text-[11px] font-medium", deadline.className)}>
          {deadline.label}
        </span>
      )}
    </div>
  );
}

type TaskPriority = "URGENT" | "NORMAL";

const PRIORITY_META: Record<TaskPriority, {
  label: string;
  icon: LucideIcon;
  badge: string;
  iconBox: string;
  selected: string;
}> = {
  URGENT: {
    label: "Hỏa tốc",
    icon: Flag,
    badge: "bg-destructive/10 text-destructive ring-destructive/20",
    iconBox: "bg-destructive/15 text-destructive",
    selected: "border-destructive/40 bg-destructive/5 text-destructive shadow-[0_4px_14px_rgba(239,68,68,0.12)]",
  },
  NORMAL: {
    label: "Thường",
    icon: Circle,
    badge: "bg-muted text-muted-foreground ring-border",
    iconBox: "bg-muted text-muted-foreground",
    selected: "border-primary/30 bg-accent/60 text-primary shadow-[0_4px_14px_rgba(79,70,229,0.10)]",
  },
};

function PriorityBadge({ value }: { value?: string }) {
  const priority = value === "URGENT" ? "URGENT" : "NORMAL";
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;

  if (priority === "NORMAL") {
    return <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>;
  }

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1", meta.badge)}>
      {priority === "URGENT" && <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />}
      {meta.label}
    </span>
  );
}

function PrioritySelector({
  value,
  onChange,
  disabled = false,
}: {
  value?: string;
  onChange: (value: TaskPriority) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Mức độ ưu tiên" className="grid grid-cols-2 gap-2">
      {(Object.keys(PRIORITY_META) as TaskPriority[]).map((priority) => {
        const meta = PRIORITY_META[priority];
        const Icon = meta.icon;
        const selected = (value || "NORMAL") === priority;

        return (
          <button
            key={priority}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(priority)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-lg border px-3 text-left text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60",
              selected
                ? meta.selected
                : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent/30",
            )}
          >
            <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", selected ? meta.iconBox : "bg-muted/70 text-muted-foreground")}>
              <Icon className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className="min-w-0 flex-1 font-medium">{meta.label}</span>
            {selected && <Check className="h-4 w-4 shrink-0" strokeWidth={2.5} />}
          </button>
        );
      })}
    </div>
  );
}

function getTodayInputValue() {
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${today.getFullYear()}-${month}-${day}`;
}

function getActualCompletionMin(requiredCompletionDate: string) {
  const today = getTodayInputValue();
  return requiredCompletionDate && requiredCompletionDate < today ? today : undefined;
}

function getEditFormData(task: Task): Record<string, string> {
  return {
    title: task.title || "",
    content: task.content || "",
    source: task.source || "",
    assignedBy: task.assignedBy || "",
    priority: task.priority || "NORMAL",
    assignedDate: task.assignedDate?.split("T")[0] || "",
    documentNumber: task.documentNumber || "",
    requiredCompletionDate: task.requiredCompletionDate?.split("T")[0] || "",
    actualCompletionDate: task.actualCompletionDate?.split("T")[0] || "",
    completionEvidence: task.completionEvidence || "",
    incompleteReason: task.incompleteReason || "",
    coordinatingUnits: task.coordinatingUnits || "",
  };
}

const APPROVAL_STATUS_META: Record<Task["approvalStatus"], { label: string; className: string }> = {
  NOT_SUBMITTED: { label: "Chưa gửi", className: "bg-muted text-muted-foreground ring-border" },
  PENDING: { label: "Chờ duyệt", className: "bg-amber-50 text-amber-700 ring-amber-200" },
  APPROVED: { label: "Đã duyệt", className: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  NEEDS_REVISION: { label: "Cần bổ sung", className: "bg-red-50 text-red-700 ring-red-200" },
};

function ApprovalStatusBadge({ task }: { task: Pick<Task, "approvalStatus" | "approvalStatusLabel"> }) {
  if (task.approvalStatus === "NOT_SUBMITTED") return null;
  const meta = APPROVAL_STATUS_META[task.approvalStatus];
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold ring-1", meta.className)}>
      {task.approvalStatusLabel || meta.label}
    </span>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFeedbackTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatFeedbackDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask] = useState<Task | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});
  const [savingEdit, setSavingEdit] = useState(false);
  const [unsavedAction, setUnsavedAction] = useState<"close" | "cancel-edit" | null>(null);
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [tempDateFrom, setTempDateFrom] = useState("");
  const [tempDateTo, setTempDateTo] = useState("");
  const [showDatePopover, setShowDatePopover] = useState(false);
  const [filterAssignedBy, setFilterAssignedBy] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteFeedbackId, setConfirmDeleteFeedbackId] = useState<string | null>(null);
  const [confirmTaskAction, setConfirmTaskAction] = useState<{
    type: "finalize" | "unfinalize";
    taskId: string;
  } | null>(null);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    source: "",
    assignedDate: "",
    assignedBy: "",
    priority: "NORMAL",
    documentNumber: "",
    coordinatingUnits: "",
    ownerDepartmentId: "",
    requiredCompletionDate: "",
  });

  const canChooseDepartment = userInfo?.role === "ADMIN" || userInfo?.role === "SECRETARY";
  const isDepartmentEditor = userInfo?.role === "DEPARTMENT_EDITOR";
  const isOwnDepartmentSelected = !isDepartmentEditor || filterDepartment === userInfo?.departmentId;
  const canCreateTasks = userInfo?.role === "ADMIN" || userInfo?.role === "SECRETARY" ||
    (isDepartmentEditor && isOwnDepartmentSelected);
  const canEditDetail = userInfo?.role === "ADMIN" || userInfo?.role === "SECRETARY" ||
    (userInfo?.role === "DEPARTMENT_EDITOR" && detailTask?.ownerDepartment?.id === userInfo?.departmentId && detailTask?.approvalStatus !== "APPROVED");
  const isRevisionOnly = detailTask?.approvalStatus === "NEEDS_REVISION";
  const isCompletionOnly = isDepartmentEditor || isRevisionOnly;
  const canDeleteDetail = canEditDetail && (!detailTask?.isFinalized || userInfo?.role === "ADMIN");
  const originalEditFormData = detailTask ? getEditFormData(detailTask) : {};
  const hasUnsavedChanges = editingDetail && Object.keys(originalEditFormData).some(
    (key) => editFormData[key] !== originalEditFormData[key],
  );

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchTasks = (params: {
    deptId?: string;
    page?: number;
    search?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    assignedBy?: string;
    sortBy?: string;
    sortOrder?: string;
    isFilter?: boolean;
  } = {}) => {
    const { deptId, page = 1, search, status, dateFrom, dateTo, assignedBy, sortBy: sb, sortOrder: so, isFilter } = params;
    if (isFilter) setFiltering(true);
    const queryParams = new URLSearchParams();
    if (deptId) queryParams.set("departmentId", deptId);
    if (page) queryParams.set("page", page.toString());
    if (search) queryParams.set("search", search);
    if (status) queryParams.set("status", status);
    if (dateFrom) queryParams.set("dateFrom", dateFrom);
    if (dateTo) queryParams.set("dateTo", dateTo);
    if (assignedBy) queryParams.set("assignedBy", assignedBy);
    if (sb) queryParams.set("sortBy", sb);
    if (so) queryParams.set("sortOrder", so);
    const query = queryParams.toString() ? `?${queryParams.toString()}` : "";
    return apiFetch<{ data: Task[]; pagination: Pagination }>(`/tasks${query}`)
      .then((res) => {
        setTasks(res.data);
        setPagination(res.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setFiltering(false));
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlDeptId = urlParams.get("departmentId") || "";
    const urlStatus = urlParams.get("status") || "";
    const urlDateFrom = urlParams.get("dateFrom") || "";
    const urlDateTo = urlParams.get("dateTo") || "";
    const urlTaskId = urlParams.get("taskId");

    apiFetch<{ data: UserInfo }>("/auth/me")
      .then((res) => {
        setUserInfo(res.data);
        return Promise.all([
          res.data,
          apiFetch<{ data: Department[] }>("/departments").then((r) => {
            setDepartments(r.data);
            return r.data;
          }),
        ]);
      })
      .then(([user, depts]) => {
        if (depts && depts.length > 0) {
          const sortedDepts = [...depts].sort((a, b) => a.id.localeCompare(b.id));
          const defaultDept = urlDeptId || user.departmentId || sortedDepts[0].id;
          setFilterStatus(urlStatus);
          setFilterDateFrom(urlDateFrom);
          setFilterDateTo(urlDateTo);
          setTempDateFrom(urlDateFrom);
          setTempDateTo(urlDateTo);
          setFilterDepartment(defaultDept);
          const createDepartment = user.role === "DEPARTMENT_EDITOR" && user.departmentId
            ? user.departmentId
            : defaultDept;
          setFormData((prev) => ({ ...prev, ownerDepartmentId: createDepartment }));
          return fetchTasks({
            deptId: defaultDept,
            status: urlStatus || undefined,
            dateFrom: urlDateFrom || undefined,
            dateTo: urlDateTo || undefined,
          }).then(async () => {
            if (!urlTaskId) return;
            setLoadingDetail(true);
            try {
              const taskRes = await apiFetch<{ data: Task }>(`/tasks/${urlTaskId}`);
              setSelectedTask(taskRes.data);
              setDetailTask(taskRes.data);
            } catch (err: any) {
              setError(err.message || "Không thể tải chi tiết nhiệm vụ");
            } finally {
              setLoadingDetail(false);
            }
          });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleFilterChange = (deptId: string) => {
    setFilterDepartment(deptId);
    fetchTasks({ deptId, page: 1, search: searchQuery, status: filterStatus, dateFrom: filterDateFrom, dateTo: filterDateTo, assignedBy: filterAssignedBy, sortBy, sortOrder, isFilter: true });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTasks({ deptId: filterDepartment, page: 1, search: searchQuery, status: filterStatus, dateFrom: filterDateFrom, dateTo: filterDateTo, assignedBy: filterAssignedBy, sortBy, sortOrder, isFilter: true });
  };

  const handleStatusFilter = (status: string) => {
    setFilterStatus(status);
    fetchTasks({ deptId: filterDepartment, page: 1, search: searchQuery, status, dateFrom: filterDateFrom, dateTo: filterDateTo, assignedBy: filterAssignedBy, sortBy, sortOrder, isFilter: true });
  };

  const handleDateFromFilter = (dateFrom: string) => {
    setTempDateFrom(dateFrom);
  };

  const handleDateToFilter = (dateTo: string) => {
    setTempDateTo(dateTo);
  };

  const applyDateFilter = () => {
    setFilterDateFrom(tempDateFrom);
    setFilterDateTo(tempDateTo);
    fetchTasks({ deptId: filterDepartment, page: 1, search: searchQuery, status: filterStatus, dateFrom: tempDateFrom, dateTo: tempDateTo, assignedBy: filterAssignedBy, sortBy, sortOrder, isFilter: true });
    setShowDatePopover(false);
  };

  const clearDateFilter = () => {
    setTempDateFrom("");
    setTempDateTo("");
    setFilterDateFrom("");
    setFilterDateTo("");
    fetchTasks({ deptId: filterDepartment, page: 1, search: searchQuery, status: filterStatus, dateFrom: "", dateTo: "", assignedBy: filterAssignedBy, sortBy, sortOrder, isFilter: true });
  };

  const handleAssignedByFilter = (assignedBy: string) => {
    setFilterAssignedBy(assignedBy);
    fetchTasks({ deptId: filterDepartment, page: 1, search: searchQuery, status: filterStatus, dateFrom: filterDateFrom, dateTo: filterDateTo, assignedBy, sortBy, sortOrder, isFilter: true });
  };

  const handleSort = (field: string) => {
    const newOrder = sortBy === field && sortOrder === "asc" ? "desc" : "asc";
    setSortBy(field);
    setSortOrder(newOrder);
    fetchTasks({ deptId: filterDepartment, page: 1, search: searchQuery, status: filterStatus, dateFrom: filterDateFrom, dateTo: filterDateTo, assignedBy: filterAssignedBy, sortBy: field, sortOrder: newOrder, isFilter: true });
  };

  const handlePageChange = (newPage: number) => {
    fetchTasks({ deptId: filterDepartment, page: newPage, search: searchQuery, status: filterStatus, dateFrom: filterDateFrom, dateTo: filterDateTo, assignedBy: filterAssignedBy, sortBy, sortOrder, isFilter: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.assignedDate && formData.requiredCompletionDate) {
      if (new Date(formData.requiredCompletionDate) < new Date(formData.assignedDate)) {
        setValidationMsg("Ngày yêu cầu hoàn thành không được sớm hơn ngày giao nhiệm vụ");
        setTimeout(() => setValidationMsg(null), 8000);
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(true);
    const deptId = formData.ownerDepartmentId || filterDepartment || departments[0]?.id || "";
    const payload = {
      ...formData,
      ownerDepartmentId: deptId,
      documentNumber: formData.documentNumber || undefined,
      coordinatingUnits: formData.coordinatingUnits || undefined,
      requiredCompletionDate: formData.requiredCompletionDate || undefined,
    };
    try {
      await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setShowForm(false);
      setFormData({
        title: "",
        content: "",
        source: "",
        assignedDate: "",
        assignedBy: "",
        priority: "NORMAL",
        documentNumber: "",
        coordinatingUnits: "",
        ownerDepartmentId: "",
        requiredCompletionDate: "",
      });
      await fetchTasks({ deptId: filterDepartment, page: 1 });
    } catch (err: any) {
      const msg = err?.message || "Không rõ lỗi";
      setValidationMsg("Lỗi tạo nhiệm vụ: " + msg);
      setTimeout(() => setValidationMsg(null), 8000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFinalize = async (taskId: string) => {
    try {
      await apiFetch(`/tasks/${taskId}/finalize`, { method: "PATCH" });
      await fetchTasks({ deptId: filterDepartment, page: pagination.page, search: searchQuery, status: filterStatus, dateFrom: filterDateFrom, dateTo: filterDateTo, assignedBy: filterAssignedBy, sortBy, sortOrder });
      if (detailTask?.id === taskId) {
        setDetailTask({ ...detailTask, isFinalized: true });
      }
    } catch (err: any) {
      setValidationMsg(err.message || "Lỗi chốt nhiệm vụ");
      setTimeout(() => setValidationMsg(null), 8000);
    }
  };

  const handleUnfinalize = async (taskId: string) => {
    try {
      await apiFetch(`/tasks/${taskId}/unfinalize`, { method: "PATCH" });
      await fetchTasks({ deptId: filterDepartment, page: pagination.page, search: searchQuery, status: filterStatus, dateFrom: filterDateFrom, dateTo: filterDateTo, assignedBy: filterAssignedBy, sortBy, sortOrder });
      if (detailTask?.id === taskId) {
        setDetailTask({ ...detailTask, isFinalized: false });
      }
    } catch (err: any) {
      setValidationMsg(err.message || "Lỗi mở chốt nhiệm vụ");
      setTimeout(() => setValidationMsg(null), 8000);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await apiFetch(`/tasks/${taskId}`, { method: "DELETE" });
      setSelectedTask(null);
      setDetailTask(null);
      setDeleteMsg("Xóa nhiệm vụ thành công");
      setTimeout(() => setDeleteMsg(null), 8000);
      await fetchTasks({ deptId: filterDepartment, page: pagination.page, search: searchQuery, status: filterStatus, dateFrom: filterDateFrom, dateTo: filterDateTo, assignedBy: filterAssignedBy, sortBy, sortOrder });
    } catch (err: any) {
      setDeleteMsg(err.message || "Xóa nhiệm vụ thất bại");
      setTimeout(() => setDeleteMsg(null), 8000);
    }
  };

  const handleDeleteFeedback = async (feedbackId: string) => {
    if (!detailTask) return;
    try {
      await apiFetch(`/tasks/${detailTask.id}/directives/${feedbackId}`, { method: "DELETE" });
      const feedbacks = (detailTask.feedbacks || []).filter((feedback) => feedback.id !== feedbackId);
      setDetailTask({ ...detailTask, feedbacks });
      setSelectedTask((task) => task?.id === detailTask.id ? { ...task, feedbacks } : task);
      setDeleteMsg("Xóa ý kiến chỉ đạo thành công");
      setTimeout(() => setDeleteMsg(null), 8000);
    } catch (err: any) {
      setDeleteMsg(err.message || "Xóa ý kiến chỉ đạo thất bại");
      setTimeout(() => setDeleteMsg(null), 8000);
    }
  };

  const handleViewDetail = async (task: Task) => {
    setSelectedTask(task);
    setLoadingDetail(true);
    setEditingDetail(false);
    try {
      const res = await apiFetch<{ data: Task }>(`/tasks/${task.id}`);
      setDetailTask(res.data);
    } catch (err: any) {
      setDetailTask(task);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleStartEdit = () => {
    if (!detailTask) return;
    setEditFormData(getEditFormData(detailTask));
    setEditingDetail(true);
  };

  const handleSaveDetail = async (closeAfterSave = true) => {
    if (!detailTask) return false;
    const requiredFields = [
      { key: "title", label: "Tiêu đề nhiệm vụ" },
      { key: "content", label: "Nội dung nhiệm vụ" },
      { key: "source", label: "Nguồn giao NV" },
      { key: "assignedBy", label: "Lãnh đạo giao NV" },
      { key: "assignedDate", label: "Ngày giao NV" },
      { key: "documentNumber", label: "Số/ký hiệu VB" },
    ];
    if (!isCompletionOnly) {
      for (const field of requiredFields) {
        const value = editFormData[field.key] ?? "";
        if (!value.trim()) {
          setValidationMsg(`${field.label} không được để trống`);
          setTimeout(() => setValidationMsg(null), 8000);
          setSavingEdit(false);
          return false;
        }
      }
    }
    const assignedDate = editFormData.assignedDate || detailTask.assignedDate?.split("T")[0];
    if (assignedDate && editFormData.requiredCompletionDate) {
      if (new Date(editFormData.requiredCompletionDate) < new Date(assignedDate)) {
        setValidationMsg("Ngày yêu cầu hoàn thành không được sớm hơn ngày giao nhiệm vụ");
        setTimeout(() => setValidationMsg(null), 8000);
        setSavingEdit(false);
        return false;
      }
    }
    if (assignedDate && editFormData.actualCompletionDate) {
      if (new Date(editFormData.actualCompletionDate) < new Date(assignedDate)) {
        setValidationMsg("Ngày hoàn thành thực tế không được sớm hơn ngày giao nhiệm vụ");
        setTimeout(() => setValidationMsg(null), 8000);
        setSavingEdit(false);
        return false;
      }
    }
    setSavingEdit(true);
    try {
      const payload: Record<string, any> = isCompletionOnly
        ? {
            actualCompletionDate: editFormData.actualCompletionDate || null,
            completionEvidence: editFormData.completionEvidence || null,
          }
        : {
            title: editFormData.title,
            content: editFormData.content,
            source: editFormData.source,
            assignedBy: editFormData.assignedBy,
            priority: editFormData.priority || "NORMAL",
            assignedDate: editFormData.assignedDate || undefined,
            documentNumber: editFormData.documentNumber || undefined,
            requiredCompletionDate: editFormData.requiredCompletionDate || null,
            actualCompletionDate: editFormData.actualCompletionDate || null,
            completionEvidence: editFormData.completionEvidence || null,
            incompleteReason: editFormData.incompleteReason || null,
            coordinatingUnits: editFormData.coordinatingUnits || null,
          };
      const res = await apiFetch<{ data: Task }>(`/tasks/${detailTask.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setDetailTask(res.data);
      setEditingDetail(false);
      window.dispatchEvent(new Event("inbox:refresh"));
      if (closeAfterSave) setSelectedTask(null);
      await fetchTasks({ deptId: filterDepartment, page: pagination.page, search: searchQuery, status: filterStatus, dateFrom: filterDateFrom, dateTo: filterDateTo, assignedBy: filterAssignedBy, sortBy, sortOrder });
      return true;
    } catch (err: any) {
      setValidationMsg("Lỗi lưu: " + err.message);
      setTimeout(() => setValidationMsg(null), 8000);
      return false;
    } finally {
      setSavingEdit(false);
    }
  };

  const closeDetail = () => {
    setSelectedTask(null);
    setDetailTask(null);
    setEditingDetail(false);
    setEditFormData({});
  };

  const requestCloseDetail = () => {
    if (hasUnsavedChanges) {
      setUnsavedAction("close");
      return;
    }
    closeDetail();
  };

  const requestCancelEdit = () => {
    if (hasUnsavedChanges) {
      setUnsavedAction("cancel-edit");
      return;
    }
    setEditingDetail(false);
  };

  const discardUnsavedChanges = () => {
    const action = unsavedAction;
    setUnsavedAction(null);
    setEditFormData({});
    if (action === "close") closeDetail();
    if (action === "cancel-edit") setEditingDetail(false);
  };

  const saveUnsavedChanges = async () => {
    const saved = await handleSaveDetail(unsavedAction === "close");
    if (saved) setUnsavedAction(null);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN");
  };

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <span className="text-sm text-muted-foreground">Đang tải dữ liệu...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-sm w-full">
          <CardContent className="flex flex-col items-center gap-3 py-8">
            <AlertTriangle className="h-10 w-10 text-destructive" />
            <p className="text-destructive font-medium">Lỗi: {error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {validationMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 ring-1 ring-foreground/5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <span className="text-sm text-foreground flex-1">{validationMsg}</span>
            <button onClick={() => setValidationMsg(null)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {deleteMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-card border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 ring-1 ring-foreground/5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-sm text-foreground flex-1">{deleteMsg}</span>
            <button onClick={() => setDeleteMsg(null)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 cursor-pointer bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
          <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-sm mx-4 p-6 ring-1 ring-foreground/5">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
                <Trash2 className="h-6 w-6 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Xóa nhiệm vụ?</h3>
              <p className="text-sm text-muted-foreground mt-1">Hành động này không thể hoàn tác.</p>
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDeleteId(null)}>
                Hủy
              </Button>
              <Button variant="destructive" className="flex-1" onClick={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}>
                Xóa
              </Button>
            </div>
          </div>
        </div>
      )}
      {confirmTaskAction && (() => {
        const actionMeta = {
          finalize: {
            title: "Chốt nhiệm vụ?",
            description: "Sau khi chốt, nhiệm vụ sẽ không thể tiếp tục chỉnh sửa.",
            confirmLabel: "Chốt nhiệm vụ",
            confirmVariant: "default" as const,
            handler: handleFinalize,
          },
          unfinalize: {
            title: "Mở chốt nhiệm vụ?",
            description: "Nhiệm vụ sẽ được mở lại để tiếp tục chỉnh sửa.",
            confirmLabel: "Mở chốt",
            confirmVariant: "default" as const,
            handler: handleUnfinalize,
          },
        }[confirmTaskAction.type];

        return (
          <ConfirmDialog
            open
            title={actionMeta.title}
            description={actionMeta.description}
            confirmLabel={actionMeta.confirmLabel}
            confirmVariant={actionMeta.confirmVariant}
            onCancel={() => setConfirmTaskAction(null)}
            onConfirm={() => {
              const taskId = confirmTaskAction.taskId;
              setConfirmTaskAction(null);
              void actionMeta.handler(taskId);
            }}
          />
        );
      })()}
      <ConfirmDialog
        open={Boolean(confirmDeleteFeedbackId)}
        title="Xóa ý kiến chỉ đạo?"
        description="Ý kiến này sẽ bị xóa khỏi lịch sử trao đổi và không thể khôi phục."
        confirmLabel="Xóa ý kiến"
        confirmVariant="destructive"
        onCancel={() => setConfirmDeleteFeedbackId(null)}
        onConfirm={() => {
          const feedbackId = confirmDeleteFeedbackId;
          setConfirmDeleteFeedbackId(null);
          if (feedbackId) void handleDeleteFeedback(feedbackId);
        }}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" />
            Nhiệm vụ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isDepartmentEditor
              ? `Nhiệm vụ được giao cho ${userInfo?.departmentName || "phòng ban/đơn vị"}`
              : "Quản lý nhiệm vụ theo phòng ban/đơn vị"}
          </p>
        </div>
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
          <div className="relative">
            <select
              value={filterDepartment}
              onChange={(e) => handleFilterChange(e.target.value)}
              disabled={filtering}
              className="h-9 rounded-lg border-2 border-primary/40 bg-accent/50 px-3 pr-8 text-sm font-medium text-primary shadow-sm ring-1 ring-primary/10 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50"
            >
              {[...departments].sort((a, b) => a.id.localeCompare(b.id)).map((dept, i) => (
                <option key={dept.id} value={dept.id}>{i + 1}. {dept.name}</option>
              ))}
            </select>
            {filtering && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {canCreateTasks && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Thêm nhiệm vụ
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <select
          value={filterStatus}
          onChange={(e) => handleStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 pr-8 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="IN_PROGRESS">Đang thực hiện</option>
          <option value="INCOMPLETE">Không hoàn thành</option>
          <option value="COMPLETED_EARLY">Hoàn thành trước hạn</option>
          <option value="COMPLETED_ON_TIME">Hoàn thành đúng hạn</option>
          <option value="COMPLETED_LATE">Hoàn thành quá hạn</option>
          <option value="NO_EVALUATION">Không đánh giá</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
        <select
          value={filterAssignedBy}
          onChange={(e) => handleAssignedByFilter(e.target.value)}
          className="h-9 rounded-lg border border-border bg-card px-3 pr-8 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
        >
          <option value="">Tất cả lãnh đạo</option>
          <option value="Cục trưởng Bùi Quang Thái">Cục trưởng Bùi Quang Thái</option>
          <option value="PCT Nguyễn Mạnh Thắng">PCT Nguyễn Mạnh Thắng</option>
          <option value="PCT Nguyễn Viết Huy">PCT Nguyễn Viết Huy</option>
          <option value="PCT Nguyễn Thanh Hoài">PCT Nguyễn Thanh Hoài</option>
          <option value="PCT Nguyễn Thành Vinh">PCT Nguyễn Thành Vinh</option>
          <option value="PCT Phan Thị Thu Hiền">PCT Phan Thị Thu Hiền</option>
          <option value="PCT Ngô Lâm">PCT Ngô Lâm</option>
          <option value="PBT Trần Hưng Hà">PBT Trần Hưng Hà</option>
        </select>
        <div className="relative">
          <button
            onClick={() => {
              setTempDateFrom(filterDateFrom);
              setTempDateTo(filterDateTo);
              setShowDatePopover(!showDatePopover);
            }}
            className={cn(
              "h-9 rounded-lg border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors flex items-center gap-2",
              filterDateFrom || filterDateTo
                ? "border-primary/40 text-primary font-medium"
                : "border-border text-muted-foreground"
            )}
          >
            <Calendar className="h-4 w-4" />
            {filterDateFrom || filterDateTo ? (
              <span>
                {filterDateFrom ? formatDateShort(filterDateFrom) : "..."} - {filterDateTo ? formatDateShort(filterDateTo) : "..."}
              </span>
            ) : (
              <span>Khoảng ngày</span>
            )}
          </button>
          {showDatePopover && (
            <>
              <div className="fixed inset-0 z-40 cursor-pointer" onClick={() => setShowDatePopover(false)} />
              <div className="absolute top-full left-0 mt-1 z-50 bg-card rounded-xl border border-border shadow-lg p-3 min-w-[260px]">
                <div className="flex flex-col gap-2.5">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Từ ngày</label>
                    <input
                      type="date"
                      value={tempDateFrom}
                      onChange={(e) => handleDateFromFilter(e.target.value)}
                      className="h-8 w-full rounded-lg border border-border bg-card px-2.5 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Đến ngày</label>
                    <input
                      type="date"
                      value={tempDateTo}
                      min={tempDateFrom || undefined}
                      onChange={(e) => handleDateToFilter(e.target.value)}
                      className="h-8 w-full rounded-lg border border-border bg-card px-2.5 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button
                      onClick={applyDateFilter}
                      className="flex-1 h-8 rounded-lg bg-primary text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
                    >
                      Áp dụng
                    </button>
                    {(tempDateFrom || tempDateTo) && (
                      <button
                        onClick={clearDateFilter}
                        className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
        {(filterStatus || filterDateFrom || filterDateTo || filterAssignedBy) && (
          <button
            onClick={() => {
              setFilterStatus("");
              setTempDateFrom("");
              setTempDateTo("");
              setFilterDateFrom("");
              setFilterDateTo("");
              setFilterAssignedBy("");
              fetchTasks({ deptId: filterDepartment, page: 1, search: searchQuery, isFilter: true });
            }}
            className="h-9 px-3 rounded-lg border border-border bg-card text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {canCreateTasks && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 cursor-pointer bg-black/40 backdrop-blur-sm" onClick={() => !submitting && setShowForm(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto mx-4 ring-1 ring-foreground/5">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <Plus className="h-4 w-4 text-primary" />
                </span>
                <h2 className="text-lg font-semibold text-foreground">Thêm nhiệm vụ mới</h2>
              </div>
              <button
                onClick={() => !submitting && setShowForm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Tiêu đề nhiệm vụ <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    placeholder="Nhập tiêu đề ngắn gọn"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Nội dung nhiệm vụ <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    rows={3}
                    placeholder="Mô tả chi tiết nhiệm vụ"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Nguồn giao NV <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Ngày giao NV <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.assignedDate}
                    onChange={(e) => setFormData({ ...formData, assignedDate: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Lãnh đạo giao NV <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={formData.assignedBy}
                    onChange={(e) => setFormData({ ...formData, assignedBy: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    required
                  >
                    <option value="">Chọn lãnh đạo</option>
                    <option value="Cục trưởng Bùi Quang Thái">Cục trưởng Bùi Quang Thái</option>
                    <option value="PCT Nguyễn Mạnh Thắng">PCT Nguyễn Mạnh Thắng</option>
                    <option value="PCT Nguyễn Viết Huy">PCT Nguyễn Viết Huy</option>
                    <option value="PCT Nguyễn Thanh Hoài">PCT Nguyễn Thanh Hoài</option>
                    <option value="PCT Nguyễn Thành Vinh">PCT Nguyễn Thành Vinh</option>
                    <option value="PCT Phan Thị Thu Hiền">PCT Phan Thị Thu Hiền</option>
                    <option value="PCT Ngô Lâm">PCT Ngô Lâm</option>
                    <option value="PBT Trần Hưng Hà">PBT Trần Hưng Hà</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Mức độ ưu tiên <span className="text-destructive">*</span>
                  </label>
                  <PrioritySelector
                    value={formData.priority}
                    onChange={(priority) => setFormData({ ...formData, priority })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Số/ký hiệu VB <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.documentNumber}
                    onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Đơn vị phối hợp cùng
                  </label>
                  <input
                    type="text"
                    value={formData.coordinatingUnits}
                    onChange={(e) => setFormData({ ...formData, coordinatingUnits: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                    placeholder="Nhập đơn vị phối hợp (nếu có)"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Đơn vị thực hiện <span className="text-destructive">*</span>
                  </label>
                  {canChooseDepartment ? (
                    <select
                      value={formData.ownerDepartmentId}
                      onChange={(e) => setFormData({ ...formData, ownerDepartmentId: e.target.value })}
                      className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                      required
                    >
                      <option value="">Chọn phòng ban/đơn vị</option>
                      {[...departments].sort((a, b) => a.id.localeCompare(b.id)).map((dept, i) => (
                        <option key={dept.id} value={dept.id}>
                          {i + 1}. {dept.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={userInfo?.departmentName || ""}
                      className="h-9 w-full rounded-lg border border-border bg-muted px-3 text-sm"
                      disabled
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Ngày YC hoàn thành
                  </label>
                  <input
                    type="date"
                    value={formData.requiredCompletionDate}
                    onChange={(e) => setFormData({ ...formData, requiredCompletionDate: e.target.value })}
                    className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                </div>
              </div>
              <div className="mt-5 flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => !submitting && setShowForm(false)}
                  disabled={submitting}
                >
                  Hủy
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Đang tạo...
                    </>
                  ) : (
                    "Tạo"
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="fixed inset-0 cursor-pointer bg-slate-950/45 backdrop-blur-sm" onClick={requestCloseDetail} />
          <div className="relative flex max-h-[min(92vh,900px)] w-full max-w-6xl flex-col overflow-hidden rounded-[24px] border border-white/70 bg-card shadow-[0_24px_80px_-20px_rgba(15,23,42,0.45)] ring-1 ring-foreground/5">
            <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border/80 bg-card/95 px-5 py-4 backdrop-blur-xl sm:px-6">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/75">
                  {editingDetail ? isCompletionOnly ? "Cập nhật kết quả" : "Chỉnh sửa nhiệm vụ" : "Chi tiết nhiệm vụ"}
                </p>
                {!editingDetail && detailTask && (
                  <h2 className="mt-1 line-clamp-2 text-base font-semibold leading-6 text-foreground sm:text-lg">
                    {detailTask.title}
                  </h2>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                {editingDetail ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={requestCancelEdit}
                      disabled={savingEdit}
                    >
                      Hủy
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSaveDetail()}
                      disabled={savingEdit}
                    >
                      {savingEdit && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      Lưu
                    </Button>
                  </>
                ) : (
                  <>
                    {canEditDetail && !detailTask?.isFinalized && !detailTask?.isCancelled && (
                      <Button
                        size="sm"
                        onClick={handleStartEdit}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Thay đổi
                      </Button>
                    )}
                    {canDeleteDetail && !detailTask?.isCancelled && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmDeleteId(detailTask!.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Xóa
                      </Button>
                    )}
                    {canEditDetail && !detailTask?.isCancelled && (
                      <>
                        {detailTask?.isFinalized ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmTaskAction({ type: "unfinalize", taskId: detailTask!.id })}
                          >
                            <Unlock className="h-3.5 w-3.5" />
                            Mở chốt
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmTaskAction({ type: "finalize", taskId: detailTask!.id })}
                          >
                            <Lock className="h-3.5 w-3.5" />
                            Chốt
                          </Button>
                        )}
                      </>
                    )}
                    <button
                      onClick={requestCloseDetail}
                      aria-label="Đóng chi tiết nhiệm vụ"
                      className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto bg-muted/20 p-4 sm:p-6">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Đang tải...
                </div>
              ) : detailTask ? (
                <div className="space-y-4">
                  {/* Overview */}
                  <div className="rounded-xl border border-border/70 bg-card px-4 py-3.5 shadow-sm sm:px-5">
                    <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {editingDetail ? (
                        <input
                          type="text"
                          value={editFormData.title}
                          onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                          disabled={isCompletionOnly}
                          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-sm shadow-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                      ) : null}
                      <p className="text-xs leading-5 text-muted-foreground">
                        <span className="font-medium text-foreground/70">Tạo bởi</span> {detailTask.creator?.fullName} · {formatDate(detailTask.createdAt)}
                      </p>
                    </div>
                    {!editingDetail && (
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        {detailTask.priority === "URGENT" && <PriorityBadge value={detailTask.priority} />}
                        {detailTask.isFinalized && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                            <Lock className="h-3 w-3" />
                            Đã chốt
                          </span>
                        )}
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${STATUS_COLORS[detailTask.status] || "bg-gray-100 text-gray-600"}`}>
                          {detailTask.statusLabel}
                        </span>
                      </div>
                    )}
                    </div>
                  </div>

                  {/* Section 1: Thông tin chung */}
                  <div className="overflow-hidden rounded-2xl border border-border/70 border-l-4 border-l-primary/40 bg-card shadow-sm">
                    <div className="border-b border-border/70 px-5 py-3.5 sm:px-6">
                      <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Thông tin chung</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">
                      <div>
                        <label className="text-xs text-muted-foreground">Nguồn giao NV <span className="text-destructive">*</span></label>
                        {editingDetail ? (
                          <input type="text" value={editFormData.source} onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })} disabled={isCompletionOnly} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.source}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Số/ký hiệu VB <span className="text-destructive">*</span></label>
                        {editingDetail ? (
                          <input type="text" value={editFormData.documentNumber} onChange={(e) => setEditFormData({ ...editFormData, documentNumber: e.target.value })} disabled={isCompletionOnly} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.documentNumber || "—"}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Lãnh đạo giao NV <span className="text-destructive">*</span></label>
                        {editingDetail ? (
                          <select value={editFormData.assignedBy} onChange={(e) => setEditFormData({ ...editFormData, assignedBy: e.target.value })} disabled={isCompletionOnly} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1">
                            <option value="">Chọn lãnh đạo</option>
                            <option value="Cục trưởng Bùi Quang Thái">Cục trưởng Bùi Quang Thái</option>
                            <option value="PCT Nguyễn Mạnh Thắng">PCT Nguyễn Mạnh Thắng</option>
                            <option value="PCT Nguyễn Viết Huy">PCT Nguyễn Viết Huy</option>
                            <option value="PCT Nguyễn Thanh Hoài">PCT Nguyễn Thanh Hoài</option>
                            <option value="PCT Nguyễn Thành Vinh">PCT Nguyễn Thành Vinh</option>
                            <option value="PCT Phan Thị Thu Hiền">PCT Phan Thị Thu Hiền</option>
                            <option value="PCT Ngô Lâm">PCT Ngô Lâm</option>
                            <option value="PBT Trần Hưng Hà">PBT Trần Hưng Hà</option>
                          </select>
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.assignedBy}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Ngày giao NV <span className="text-destructive">*</span></label>
                        {editingDetail ? (
                          <input type="date" value={editFormData.assignedDate} onChange={(e) => setEditFormData({ ...editFormData, assignedDate: e.target.value })} disabled={isCompletionOnly} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{formatDate(detailTask.assignedDate)}</p>
                        )}
                      </div>
                      {editingDetail && (
                        <div className="col-span-2">
                          <label className="text-xs text-muted-foreground">Mức độ ưu tiên <span className="text-destructive">*</span></label>
                          <PrioritySelector
                            value={editFormData.priority}
                            onChange={(priority) => setEditFormData({ ...editFormData, priority })}
                            disabled={isCompletionOnly}
                          />
                        </div>
                      )}
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Nội dung nhiệm vụ <span className="text-destructive">*</span></label>
                        {editingDetail ? (
                          <textarea value={editFormData.content} onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })} disabled={isCompletionOnly} rows={3} className="min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1 resize-y" />
                        ) : (
                          <p className="text-sm text-foreground mt-0.5 leading-relaxed whitespace-pre-wrap">{detailTask.content}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Đơn vị */}
                  <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
                    <div className="border-b border-border/70 px-5 py-3.5 sm:px-6">
                      <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Đơn vị liên quan</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">
                      <div>
                        <label className="text-xs text-muted-foreground">Đơn vị thực hiện <span className="text-destructive">*</span></label>
                        <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          {detailTask.ownerDepartment.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Đơn vị phối hợp</label>
                        {editingDetail ? (
                          <input type="text" value={editFormData.coordinatingUnits} onChange={(e) => setEditFormData({ ...editFormData, coordinatingUnits: e.target.value })} disabled={isCompletionOnly} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" placeholder="Nhập đơn vị phối hợp" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.coordinatingUnits || "—"}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Tiến độ */}
                  <div className="overflow-hidden rounded-2xl border border-border/70 border-l-4 border-l-emerald-400/60 bg-card shadow-sm">
                    <div className="border-b border-border/70 px-5 py-3.5 sm:px-6">
                      <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Tiến độ hoàn thành</h4>
                    </div>
                    <div className="grid grid-cols-1 gap-x-8 gap-y-5 p-5 sm:grid-cols-2 sm:p-6">
                      <div>
                        <label className="text-xs text-muted-foreground">Ngày YC hoàn thành</label>
                        {editingDetail ? (
                          <input type="date" value={editFormData.requiredCompletionDate} onChange={(e) => setEditFormData({ ...editFormData, requiredCompletionDate: e.target.value })} disabled={isCompletionOnly} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.requiredCompletionDate ? formatDate(detailTask.requiredCompletionDate) : "—"}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Ngày hoàn thành thực tế</label>
                        {editingDetail ? (
                          <input type="date" min={getActualCompletionMin(editFormData.requiredCompletionDate)} value={editFormData.actualCompletionDate} onChange={(e) => setEditFormData({ ...editFormData, actualCompletionDate: e.target.value })} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.actualCompletionDate ? formatDate(detailTask.actualCompletionDate) : "—"}</p>
                        )}
                      </div>
                      <div className="col-span-2 rounded-xl bg-muted/30 p-4">
                        <label className="text-xs text-muted-foreground">Bằng chứng hoàn thành</label>
                        {editingDetail ? (
                          <textarea value={editFormData.completionEvidence} onChange={(e) => setEditFormData({ ...editFormData, completionEvidence: e.target.value })} rows={2} className="min-h-[64px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1 resize-y" />
                        ) : (
                          <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{detailTask.completionEvidence || "—"}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Lý do chưa hoàn thành</label>
                        {editingDetail ? (
                          <textarea value={editFormData.incompleteReason} onChange={(e) => setEditFormData({ ...editFormData, incompleteReason: e.target.value })} disabled={isCompletionOnly} rows={2} className="min-h-[64px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1 resize-y" />
                        ) : (
                          <p className="text-sm text-foreground mt-0.5 whitespace-pre-wrap">{detailTask.incompleteReason || "—"}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {editingDetail && isCompletionOnly && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {isRevisionOnly
                        ? "Nhiệm vụ cần bổ sung. Chỉ có thể cập nhật ngày hoàn thành thực tế và bằng chứng."
                        : "Đại diện phòng ban chỉ cập nhật ngày hoàn thành thực tế và bằng chứng."}
                    </div>
                  )}

                  {(detailTask.approvalStatus !== "NOT_SUBMITTED" || (detailTask.feedbacks || []).length > 0) && (() => {
                    const feedbacks = detailTask.feedbacks || [];
                    return (
                      <div className={`overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ${detailTask.approvalStatus === "NEEDS_REVISION" ? "border-l-4 border-l-red-400" : "border-l-4 border-l-primary/30"}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-5 py-3.5 sm:px-6">
                          <h4 className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Phản hồi xử lý</h4>
                          <ApprovalStatusBadge task={detailTask} />
                        </div>
                        <div className="space-y-3 p-4">
                          {detailTask.approvalStatus === "PENDING" && (
                            <p className="text-sm text-amber-700">
                              Hồ sơ hoàn thành đã được gửi và đang chờ Lãnh đạo/Thư ký duyệt.
                            </p>
                          )}

                          {feedbacks.length > 0 && (
                            <div className="rounded-xl border border-border/70 bg-card p-3 shadow-sm">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground">Lịch sử phản hồi</p>
                                  <p className="mt-1 text-xs text-muted-foreground">Theo dõi toàn bộ trao đổi của nhiệm vụ</p>
                                </div>
                                <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
                                  {feedbacks.length} phản hồi
                                </span>
                              </div>
                              <div className="mt-4 max-h-[360px] space-y-5 overflow-y-auto pr-1">
                                {["DIRECTIVE", "REVIEW"].map((groupType) => {
                                  const groupItems = feedbacks
                                    .filter((feedback) => feedback.type === groupType)
                                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                                  if (groupItems.length === 0) return null;
                                  const isDirectiveGroup = groupType === "DIRECTIVE";
                                  const hasRevision = groupItems.some((feedback) => feedback.decision === "NEEDS_REVISION");
                                  const groupTitle = isDirectiveGroup ? "Ý kiến chỉ đạo" : hasRevision ? "Yêu cầu bổ sung" : "Đã duyệt hoàn thành";
                                  const groupTitleTone = isDirectiveGroup ? "text-foreground" : hasRevision ? "text-red-700" : "text-emerald-700";
                                  return (
                                    <div key={groupType}>
                                      <div className="mb-2 flex items-center justify-between gap-3">
                                        <p className={`flex items-center gap-2 text-xs font-semibold ${groupTitleTone}`}>
                                          <span className={`h-2 w-2 rounded-full ${isDirectiveGroup ? "bg-blue-500" : hasRevision ? "bg-red-500" : "bg-emerald-500"}`} />
                                          {groupTitle}
                                        </p>
                                      </div>
                                      <div className="relative space-y-2 pl-4">
                                        <span className="absolute bottom-3 left-[3px] top-3 w-px bg-border" />
                                        {groupItems.map((feedback) => {
                                          const isApproved = feedback.decision === "APPROVED";
                                          const title = isDirectiveGroup || !isApproved ? null : "Đã duyệt hoàn thành";
                                          const tone = isDirectiveGroup
                                            ? "border-blue-200/80 bg-blue-50/40"
                                            : isApproved
                                              ? "border-emerald-200/80 bg-emerald-50/40"
                                              : "border-red-200/80 bg-red-50/40";
                                          const dot = isDirectiveGroup ? "bg-blue-500" : isApproved ? "bg-emerald-500" : "bg-red-500";
                                          return (
                                            <div key={feedback.id} className="relative pl-4">
                                              <span className={`absolute left-[-1px] top-3 h-2 w-2 rounded-full ${dot} ring-4 ring-card`} />
                                              <div className={`rounded-xl border px-3.5 py-3 ${tone}`}>
                                                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                                                  <span className="text-sm font-medium text-foreground">{feedback.author.fullName}</span>
                                                  <span className="flex items-center gap-2">
                                                    <span className="flex flex-col items-end text-[11px] leading-tight text-muted-foreground">
                                                      <span className="font-semibold text-foreground">{formatFeedbackTime(feedback.createdAt)}</span>
                                                      <span className="mt-0.5">{formatFeedbackDate(feedback.createdAt)}</span>
                                                    </span>
                                                    {isDirectiveGroup && feedback.author.id === userInfo?.id && !detailTask.isFinalized && (
                                                      <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon-xs"
                                                        className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
                                                        aria-label="Xóa ý kiến chỉ đạo"
                                                        title="Xóa ý kiến chỉ đạo"
                                                        onClick={() => setConfirmDeleteFeedbackId(feedback.id)}
                                                      >
                                                        <Trash2 />
                                                      </Button>
                                                    )}
                                                  </span>
                                                </div>
                                                {title && <p className={`mt-1 text-xs font-semibold ${isApproved ? "text-emerald-700" : "text-red-700"}`}>{title}</p>}
                                                {feedback.content && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{feedback.content}</p>}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {unsavedAction && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-changes-title"
            className="relative mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <h3 id="unsaved-changes-title" className="text-lg font-semibold text-foreground">
              Có thay đổi chưa lưu
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Bạn có muốn lưu những thay đổi trước khi thoát không?
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUnsavedAction(null)}
                disabled={savingEdit}
              >
                Tiếp tục chỉnh sửa
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={discardUnsavedChanges}
                disabled={savingEdit}
              >
                Bỏ thay đổi
              </Button>
              <Button
                type="button"
                onClick={saveUnsavedChanges}
                disabled={savingEdit}
              >
                {savingEdit && <Loader2 className="h-3 w-3 animate-spin" />}
                {unsavedAction === "close" ? "Lưu và đóng" : "Lưu thay đổi"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        <Card className="overflow-hidden relative">
          {filtering && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Đang tải...</span>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-10">STT</th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-2/5">Tiêu đề</th>
                  <th className="text-left px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Lãnh đạo</th>
                  <th
                    className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort("assignedDate")}
                  >
                    Ngày giao {sortBy === "assignedDate" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th
                    className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort("requiredCompletionDate")}
                  >
                    Hạn hoàn thành {sortBy === "requiredCompletionDate" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th
                    className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort("actualCompletionDate")}
                  >
                    Thực tế {sortBy === "actualCompletionDate" ? (sortOrder === "asc" ? "▲" : "▼") : ""}
                  </th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Trạng thái</th>
                  <th className="text-center px-2 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">Mức độ</th>
                </tr>
              </thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                      Không có nhiệm vụ nào
                    </td>
                  </tr>
                ) : (
                  tasks.map((task, index) => (
                    <tr
                      key={task.id}
                      className={cn("border-b border-border/50 transition-colors hover:bg-muted/30 cursor-pointer", index % 2 === 0 ? "bg-card" : "bg-muted/10")}
                      onClick={() => handleViewDetail(task)}
                    >
                      <td className="px-2 py-2 text-center text-muted-foreground">{index + 1}</td>
                      <td className="px-2 py-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <div className="line-clamp-2 min-w-0 font-medium">{task.title}</div>
                          <ApprovalStatusBadge task={task} />
                        </div>
                        <div className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          Theo {task.source}{task.documentNumber ? ` và ${task.documentNumber}` : ""}
                        </div>
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-muted-foreground">{task.assignedBy}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-center tabular-nums text-muted-foreground">{formatDate(task.assignedDate)}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-center tabular-nums text-muted-foreground">
                        {task.requiredCompletionDate
                          ? formatDate(task.requiredCompletionDate)
                          : "—"}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap text-center tabular-nums text-muted-foreground">
                        {task.actualCompletionDate
                          ? formatDate(task.actualCompletionDate)
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <RealtimeStatusCell task={task} now={currentTime} />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <PriorityBadge value={task.priority} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Hiển thị {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} trong {pagination.total} kết quả
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Trước
              </Button>
              <span className="text-sm text-muted-foreground">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
              >
                Sau
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
