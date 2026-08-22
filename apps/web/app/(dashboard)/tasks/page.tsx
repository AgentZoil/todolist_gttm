"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Building2,
  Loader2,
  XCircle,
} from "lucide-react";

interface Department {
  id: string;
  code: string;
  name: string;
}

interface Task {
  id: string;
  taskCode: string;
  title: string;
  content: string;
  source: string;
  assignedDate: string;
  assignedBy: string;
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
  updatedAt: string;
  ownerDepartment: Department;
  creator: { id: string; fullName: string };
  updater?: { id: string; fullName: string };
  status: string;
  statusLabel: string;
  statusColor: string;
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

type TabType = "in_progress" | "completed";

const STATUS_COLORS: Record<string, string> = {
  CANCELLED: "bg-red-50 text-red-700",
  IN_PROGRESS: "bg-blue-50 text-blue-700",
  COMPLETED_EARLY: "bg-green-50 text-green-700",
  COMPLETED_ON_TIME: "bg-emerald-50 text-emerald-700",
  COMPLETED_LATE: "bg-orange-50 text-orange-700",
  NO_EVALUATION: "bg-gray-100 text-gray-600",
};

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
  const [filterDepartment, setFilterDepartment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("in_progress");
  const [validationMsg, setValidationMsg] = useState<string | null>(null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    source: "",
    assignedDate: "",
    assignedBy: "",
    documentNumber: "",
    coordinatingUnits: "",
    ownerDepartmentId: "",
    requiredCompletionDate: "",
  });

  const canChooseDepartment = userInfo?.role === "ADMIN" || userInfo?.role === "SECRETARY";
  const canEditTasks = userInfo?.role !== "VIEWER";
  const canEditDetail = userInfo?.role === "ADMIN" || userInfo?.role === "SECRETARY" ||
    (userInfo?.role === "DEPARTMENT_EDITOR" && detailTask?.ownerDepartment?.id === userInfo?.departmentId);
  const canDeleteDetail = canEditDetail && (!detailTask?.isFinalized || userInfo?.role === "ADMIN");

  const fetchTasks = (params: {
    deptId?: string;
    page?: number;
    search?: string;
    isFilter?: boolean;
  } = {}) => {
    const { deptId, page = 1, search, isFilter } = params;
    if (isFilter) setFiltering(true);
    const queryParams = new URLSearchParams();
    if (deptId) queryParams.set("departmentId", deptId);
    if (page) queryParams.set("page", page.toString());
    if (search) queryParams.set("search", search);
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
          const defaultDept = user.departmentId || depts[0].id;
          setFilterDepartment(defaultDept);
          setFormData((prev) => ({ ...prev, ownerDepartmentId: defaultDept }));
          return fetchTasks({ deptId: defaultDept });
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleFilterChange = (deptId: string) => {
    setFilterDepartment(deptId);
    fetchTasks({ deptId, page: 1, isFilter: true });
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTasks({ deptId: filterDepartment, page: 1, search: searchQuery, isFilter: true });
  };

  const handlePageChange = (newPage: number) => {
    fetchTasks({ deptId: filterDepartment, page: newPage, search: searchQuery, isFilter: true });
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

  const handleCancel = async (taskId: string) => {
    if (!confirm("Bạn có chắc chắn muốn hủy nhiệm vụ này?")) return;
    try {
      await apiFetch(`/tasks/${taskId}/cancel`, { method: "PATCH" });
      await fetchTasks({ deptId: filterDepartment, page: pagination.page, search: searchQuery });
    } catch (err: any) {
      setValidationMsg(err.message || "Lỗi hủy nhiệm vụ");
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
      await fetchTasks({ deptId: filterDepartment, page: pagination.page, search: searchQuery });
    } catch (err: any) {
      setDeleteMsg(err.message || "Xóa nhiệm vụ thất bại");
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
    setEditFormData({
      title: detailTask.title || "",
      content: detailTask.content || "",
      source: detailTask.source || "",
      assignedBy: detailTask.assignedBy || "",
      assignedDate: detailTask.assignedDate?.split("T")[0] || "",
      documentNumber: detailTask.documentNumber || "",
      requiredCompletionDate: detailTask.requiredCompletionDate?.split("T")[0] || "",
      actualCompletionDate: detailTask.actualCompletionDate?.split("T")[0] || "",
      completionEvidence: detailTask.completionEvidence || "",
      incompleteReason: detailTask.incompleteReason || "",
      coordinatingUnits: detailTask.coordinatingUnits || "",
    });
    setEditingDetail(true);
  };

  const handleSaveDetail = async () => {
    if (!detailTask) return;
    const assignedDate = editFormData.assignedDate || detailTask.assignedDate?.split("T")[0];
    if (assignedDate && editFormData.requiredCompletionDate) {
      if (new Date(editFormData.requiredCompletionDate) < new Date(assignedDate)) {
        setValidationMsg("Ngày yêu cầu hoàn thành không được sớm hơn ngày giao nhiệm vụ");
        setTimeout(() => setValidationMsg(null), 8000);
        setSavingEdit(false);
        return;
      }
    }
    if (assignedDate && editFormData.actualCompletionDate) {
      if (new Date(editFormData.actualCompletionDate) < new Date(assignedDate)) {
        setValidationMsg("Ngày hoàn thành thực tế không được sớm hơn ngày giao nhiệm vụ");
        setTimeout(() => setValidationMsg(null), 8000);
        setSavingEdit(false);
        return;
      }
    }
    setSavingEdit(true);
    try {
      const payload: Record<string, any> = {
        title: editFormData.title,
        content: editFormData.content,
        source: editFormData.source,
        assignedBy: editFormData.assignedBy,
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
      await fetchTasks({ deptId: filterDepartment, page: pagination.page, search: searchQuery });
    } catch (err: any) {
      setValidationMsg("Lỗi lưu: " + err.message);
      setTimeout(() => setValidationMsg(null), 8000);
    } finally {
      setSavingEdit(false);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN");
  };

  const isInProgress = (task: Task) =>
    task.status === "IN_PROGRESS" || task.status === "NO_EVALUATION";

  const isCompleted = (task: Task) =>
    task.status === "COMPLETED_EARLY" ||
    task.status === "COMPLETED_ON_TIME" ||
    task.status === "COMPLETED_LATE";

  const filteredTasks = tasks;

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
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDeleteId(null)} />
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-primary" />
            Nhiệm vụ
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Quản lý nhiệm vụ theo phòng ban</p>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <select
              value={filterDepartment}
              onChange={(e) => handleFilterChange(e.target.value)}
              disabled={filtering}
              className="h-9 rounded-lg border border-border bg-card px-3 pr-8 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors disabled:opacity-50"
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>{dept.name}</option>
              ))}
            </select>
            {filtering && (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
          {canEditTasks && (
            <Button size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4" />
              Thêm nhiệm vụ
            </Button>
          )}
        </div>
      </div>

      {canEditTasks && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && setShowForm(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 ring-1 ring-foreground/5">
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
                    Tiêu đề nhiệm vụ
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
                    Nội dung nhiệm vụ
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
                    Nguồn giao NV
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
                    Ngày giao NV
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
                    Lãnh đạo giao NV
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
                    <option value="PCT Nguyễn Việt Huy">PCT Nguyễn Việt Huy</option>
                    <option value="PCT Nguyễn Thanh Hoài">PCT Nguyễn Thanh Hoài</option>
                    <option value="PCT Nguyễn Thành Vinh">PCT Nguyễn Thành Vinh</option>
                    <option value="PCT Phan Thị Thu Hiền">PCT Phan Thị Thu Hiền</option>
                    <option value="PCT Ngô Lâm">PCT Ngô Lâm</option>
                    <option value="PBT Trần Hưng Hà">PBT Trần Hưng Hà</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                    Số/ký hiệu VB
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
                    Đơn vị thực hiện
                  </label>
                  {canChooseDepartment ? (
                    <select
                      value={formData.ownerDepartmentId}
                      onChange={(e) => setFormData({ ...formData, ownerDepartmentId: e.target.value })}
                      className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                      required
                    >
                      <option value="">Chọn phòng ban</option>
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.name}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setSelectedTask(null); setDetailTask(null); setEditingDetail(false); }} />
          <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-5xl max-h-[90vh] overflow-y-auto mx-4 ring-1 ring-foreground/5">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editingDetail ? "Chỉnh sửa nhiệm vụ" : "Chi tiết nhiệm vụ"}
              </h2>
              <div className="flex items-center gap-2">
                {editingDetail ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingDetail(false)}
                      disabled={savingEdit}
                    >
                      Hủy
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveDetail}
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
                    <button
                      onClick={() => { setSelectedTask(null); setDetailTask(null); setEditingDetail(false); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="p-4">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Đang tải...
                </div>
              ) : detailTask ? (
                <div className="space-y-5">
                  {/* Header: Task code + Title + Status */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {editingDetail ? (
                        <input
                          type="text"
                          value={editFormData.title}
                          onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                          className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                        />
                      ) : (
                        <h3 className="text-lg font-semibold text-foreground leading-tight">{detailTask.title}</h3>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Tạo bởi {detailTask.creator?.fullName} - {formatDate(detailTask.createdAt)}
                      </p>
                    </div>
                    {!editingDetail && (
                      <span className={`shrink-0 inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[detailTask.status] || "bg-gray-100 text-gray-600"}`}>
                        {detailTask.statusLabel}
                      </span>
                    )}
                  </div>

                  {/* Section 1: Thông tin chung */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b border-border">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thông tin chung</h4>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Nguồn giao NV</label>
                        {editingDetail ? (
                          <input type="text" value={editFormData.source} onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.source}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Số/ký hiệu VB</label>
                        {editingDetail ? (
                          <input type="text" value={editFormData.documentNumber} onChange={(e) => setEditFormData({ ...editFormData, documentNumber: e.target.value })} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.documentNumber || "—"}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Lãnh đạo giao NV</label>
                        {editingDetail ? (
                          <select value={editFormData.assignedBy} onChange={(e) => setEditFormData({ ...editFormData, assignedBy: e.target.value })} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1">
                            <option value="">Chọn lãnh đạo</option>
                            <option value="Cục trưởng Bùi Quang Thái">Cục trưởng Bùi Quang Thái</option>
                            <option value="PCT Nguyễn Mạnh Thắng">PCT Nguyễn Mạnh Thắng</option>
                            <option value="PCT Nguyễn Việt Huy">PCT Nguyễn Việt Huy</option>
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
                        <label className="text-xs text-muted-foreground">Ngày giao NV</label>
                        {editingDetail ? (
                          <input type="date" value={editFormData.assignedDate} onChange={(e) => setEditFormData({ ...editFormData, assignedDate: e.target.value })} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{formatDate(detailTask.assignedDate)}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Nội dung nhiệm vụ</label>
                        {editingDetail ? (
                          <textarea value={editFormData.content} onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })} rows={3} className="min-h-[80px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1 resize-y" />
                        ) : (
                          <p className="text-sm text-foreground mt-0.5 leading-relaxed">{detailTask.content}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Đơn vị */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b border-border">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Đơn vị liên quan</h4>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Đơn vị thực hiện</label>
                        <p className="text-sm font-medium text-foreground mt-0.5 flex items-center gap-1.5">
                          <svg className="w-3.5 h-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                          {detailTask.ownerDepartment.name}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Đơn vị phối hợp</label>
                        {editingDetail ? (
                          <input type="text" value={editFormData.coordinatingUnits} onChange={(e) => setEditFormData({ ...editFormData, coordinatingUnits: e.target.value })} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" placeholder="Nhập đơn vị phối hợp" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.coordinatingUnits || "—"}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Tiến độ */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b border-border">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tiến độ hoàn thành</h4>
                    </div>
                    <div className="p-4 grid grid-cols-2 gap-x-6 gap-y-3">
                      <div>
                        <label className="text-xs text-muted-foreground">Ngày YC hoàn thành</label>
                        {editingDetail ? (
                          <input type="date" value={editFormData.requiredCompletionDate} onChange={(e) => setEditFormData({ ...editFormData, requiredCompletionDate: e.target.value })} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.requiredCompletionDate ? formatDate(detailTask.requiredCompletionDate) : "—"}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Ngày hoàn thành thực tế</label>
                        {editingDetail ? (
                          <input type="date" value={editFormData.actualCompletionDate} onChange={(e) => setEditFormData({ ...editFormData, actualCompletionDate: e.target.value })} className="h-8 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.actualCompletionDate ? formatDate(detailTask.actualCompletionDate) : "—"}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Bằng chứng hoàn thành</label>
                        {editingDetail ? (
                          <textarea value={editFormData.completionEvidence} onChange={(e) => setEditFormData({ ...editFormData, completionEvidence: e.target.value })} rows={2} className="min-h-[64px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1 resize-y" />
                        ) : (
                          <p className="text-sm text-foreground mt-0.5">{detailTask.completionEvidence || "—"}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Lý do chưa hoàn thành</label>
                        {editingDetail ? (
                          <textarea value={editFormData.incompleteReason} onChange={(e) => setEditFormData({ ...editFormData, incompleteReason: e.target.value })} rows={2} className="min-h-[64px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors mt-1 resize-y" />
                        ) : (
                          <p className="text-sm text-foreground mt-0.5">{detailTask.incompleteReason || "—"}</p>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ) : null}
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
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground w-10">STT</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tiêu đề</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[260px]">Lãnh đạo giao NV</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[180px]">Ngày giao NV</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[180px]">Ngày YC HT</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[170px]">Ngày HT thực tế</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap w-[200px]">Tình trạng</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-muted-foreground">
                      Không có nhiệm vụ nào
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task, index) => (
                    <tr
                      key={task.id}
                      className={cn("border-b border-border/50 transition-colors hover:bg-muted/30 cursor-pointer", index % 2 === 0 ? "bg-card" : "bg-muted/10")}
                      onClick={() => handleViewDetail(task)}
                    >
                      <td className="px-3 py-2 text-center text-muted-foreground">{index + 1}</td>
                      <td className="px-3 py-2 max-w-0">
                        <div className="font-medium truncate">{task.title}</div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{task.assignedBy}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{formatDate(task.assignedDate)}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {task.requiredCompletionDate
                          ? formatDate(task.requiredCompletionDate)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {task.actualCompletionDate
                          ? formatDate(task.actualCompletionDate)
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span
                          className={cn("inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-semibold ring-1", STATUS_COLORS[task.status] || "bg-gray-100 text-gray-600")}
                        >
                          {task.statusLabel}
                        </span>
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
