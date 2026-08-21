"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nhiệm vụ</h1>
        <div className="flex items-center gap-2 text-muted-foreground mt-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Đang tải dữ liệu...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nhiệm vụ</h1>
        <p className="text-destructive mt-2">Lỗi: {error}</p>
      </div>
    );
  }

  return (
    <div>
      {validationMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="bg-white border-l-4 border-red-500 rounded-md shadow-md px-4 py-3 flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <span className="text-sm text-gray-700">{validationMsg}</span>
            <button onClick={() => setValidationMsg(null)} className="ml-auto shrink-0 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {deleteMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="bg-white border-l-4 border-green-500 rounded-md shadow-md px-4 py-3 flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="text-sm text-gray-700">{deleteMsg}</span>
            <button onClick={() => setDeleteMsg(null)} className="ml-auto shrink-0 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {confirmDeleteId && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md" style={{ animation: "fadeIn 0.2s ease-out" }}>
          <div className="bg-white border-l-4 border-orange-500 rounded-md shadow-md px-4 py-3 flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-orange-50 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <span className="text-sm text-gray-700 flex-1">Bạn có chắc chắn muốn xóa nhiệm vụ này?</span>
            <button
              onClick={() => { handleDelete(confirmDeleteId); setConfirmDeleteId(null); }}
              className="text-sm px-3 py-1 rounded-md bg-red-500 text-white hover:bg-red-600 font-medium"
            >
              Xóa
            </button>
            <button
              onClick={() => setConfirmDeleteId(null)}
              className="text-sm px-3 py-1 rounded-md bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nhiệm vụ</h1>
          <p className="text-muted-foreground mt-2">
            Quản lý nhiệm vụ theo phòng ban
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={filterDepartment}
              onChange={(e) => handleFilterChange(e.target.value)}
              disabled={filtering}
              className="border border-border rounded-md px-3 py-2 text-sm bg-background disabled:opacity-50"
            >
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            {filtering && (
              <div className="absolute right-8 top-1/2 -translate-y-1/2">
                <svg className="animate-spin h-3 w-3 text-muted-foreground" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            )}
          </div>
          {canEditTasks && (
            <button
              onClick={() => setShowForm(true)}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
            >
              Thêm nhiệm vụ
            </button>
          )}
        </div>
      </div>

      {canEditTasks && showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => !submitting && setShowForm(false)} />
          <div className="relative bg-card rounded-lg shadow-lg border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Thêm nhiệm vụ mới</h2>
              <button
                onClick={() => !submitting && setShowForm(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Tiêu đề nhiệm vụ
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    placeholder="Nhập tiêu đề ngắn gọn"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Nội dung nhiệm vụ
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    rows={3}
                    placeholder="Mô tả chi tiết nhiệm vụ"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Nguồn giao NV
                  </label>
                  <input
                    type="text"
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Ngày giao NV
                  </label>
                  <input
                    type="date"
                    value={formData.assignedDate}
                    onChange={(e) => setFormData({ ...formData, assignedDate: e.target.value })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Lãnh đạo giao NV
                  </label>
                  <select
                    value={formData.assignedBy}
                    onChange={(e) => setFormData({ ...formData, assignedBy: e.target.value })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
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
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Số/ký hiệu VB
                  </label>
                  <input
                    type="text"
                    value={formData.documentNumber}
                    onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Đơn vị phối hợp cùng
                  </label>
                  <input
                    type="text"
                    value={formData.coordinatingUnits}
                    onChange={(e) => setFormData({ ...formData, coordinatingUnits: e.target.value })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                    placeholder="Nhập đơn vị phối hợp (nếu có)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Đơn vị thực hiện
                  </label>
                  {canChooseDepartment ? (
                    <select
                      value={formData.ownerDepartmentId}
                      onChange={(e) => setFormData({ ...formData, ownerDepartmentId: e.target.value })}
                      className="w-full border border-border rounded-md px-3 py-2 text-sm"
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
                      className="w-full border border-border rounded-md px-3 py-2 text-sm bg-muted"
                      disabled
                    />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Ngày YC hoàn thành
                  </label>
                  <input
                    type="date"
                    value={formData.requiredCompletionDate}
                    onChange={(e) => setFormData({ ...formData, requiredCompletionDate: e.target.value })}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="mt-4 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => !submitting && setShowForm(false)}
                  disabled={submitting}
                  className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary/90 disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Đang tạo...
                    </>
                  ) : (
                    "Tạo"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => { setSelectedTask(null); setDetailTask(null); setEditingDetail(false); }} />
          <div className="relative bg-card rounded-lg shadow-lg border border-border w-full max-w-5xl max-h-[90vh] overflow-y-auto mx-4">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">
                {editingDetail ? "Chỉnh sửa nhiệm vụ" : "Chi tiết nhiệm vụ"}
              </h2>
              <div className="flex items-center gap-2">
                {editingDetail ? (
                  <>
                    <button
                      onClick={() => setEditingDetail(false)}
                      disabled={savingEdit}
                      className="text-sm px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSaveDetail}
                      disabled={savingEdit}
                      className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
                    >
                      {savingEdit && (
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                      Lưu
                    </button>
                  </>
                ) : (
                  <>
                    {canEditDetail && !detailTask?.isFinalized && !detailTask?.isCancelled && (
                      <button
                        onClick={handleStartEdit}
                        className="text-sm px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Thay đổi
                      </button>
                    )}
                    {canDeleteDetail && !detailTask?.isCancelled && (
                      <button
                        onClick={() => setConfirmDeleteId(detailTask!.id)}
                        className="text-sm px-3 py-1.5 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Xóa
                      </button>
                    )}
                    <button
                      onClick={() => { setSelectedTask(null); setDetailTask(null); setEditingDetail(false); }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="p-4">
              {loadingDetail ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
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
                          className="w-full text-lg font-semibold text-foreground border border-border rounded-md px-3 py-1.5 bg-background"
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
                          <input type="text" value={editFormData.source} onChange={(e) => setEditFormData({ ...editFormData, source: e.target.value })} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.source}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Số/ký hiệu VB</label>
                        {editingDetail ? (
                          <input type="text" value={editFormData.documentNumber} onChange={(e) => setEditFormData({ ...editFormData, documentNumber: e.target.value })} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.documentNumber || "—"}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Lãnh đạo giao NV</label>
                        {editingDetail ? (
                          <select value={editFormData.assignedBy} onChange={(e) => setEditFormData({ ...editFormData, assignedBy: e.target.value })} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background mt-1">
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
                          <input type="date" value={editFormData.assignedDate} onChange={(e) => setEditFormData({ ...editFormData, assignedDate: e.target.value })} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{formatDate(detailTask.assignedDate)}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Nội dung nhiệm vụ</label>
                        {editingDetail ? (
                          <textarea value={editFormData.content} onChange={(e) => setEditFormData({ ...editFormData, content: e.target.value })} rows={3} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background mt-1" />
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
                          <input type="text" value={editFormData.coordinatingUnits} onChange={(e) => setEditFormData({ ...editFormData, coordinatingUnits: e.target.value })} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background mt-1" placeholder="Nhập đơn vị phối hợp" />
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
                          <input type="date" value={editFormData.requiredCompletionDate} onChange={(e) => setEditFormData({ ...editFormData, requiredCompletionDate: e.target.value })} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.requiredCompletionDate ? formatDate(detailTask.requiredCompletionDate) : "—"}</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground">Ngày hoàn thành thực tế</label>
                        {editingDetail ? (
                          <input type="date" value={editFormData.actualCompletionDate} onChange={(e) => setEditFormData({ ...editFormData, actualCompletionDate: e.target.value })} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background mt-1" />
                        ) : (
                          <p className="text-sm font-medium text-foreground mt-0.5">{detailTask.actualCompletionDate ? formatDate(detailTask.actualCompletionDate) : "—"}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Bằng chứng hoàn thành</label>
                        {editingDetail ? (
                          <textarea value={editFormData.completionEvidence} onChange={(e) => setEditFormData({ ...editFormData, completionEvidence: e.target.value })} rows={2} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background mt-1" />
                        ) : (
                          <p className="text-sm text-foreground mt-0.5">{detailTask.completionEvidence || "—"}</p>
                        )}
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-muted-foreground">Lý do chưa hoàn thành</label>
                        {editingDetail ? (
                          <textarea value={editFormData.incompleteReason} onChange={(e) => setEditFormData({ ...editFormData, incompleteReason: e.target.value })} rows={2} className="w-full border border-border rounded-md px-3 py-1.5 text-sm bg-background mt-1" />
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
        <div className="rounded-lg border border-border overflow-hidden relative">
          {filtering && (
            <div className="absolute inset-0 bg-background/60 flex items-center justify-center z-10">
              <div className="flex items-center gap-2 text-muted-foreground">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm">Đang tải...</span>
              </div>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead>
                <tr className="bg-muted">
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground w-10">STT</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground">Tiêu đề</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap w-[260px]">Lãnh đạo giao NV</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap w-[180px]">Ngày giao NV</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap w-[180px]">Ngày YC HT</th>
                  <th className="text-left px-3 py-3 font-medium text-muted-foreground whitespace-nowrap w-[170px]">Ngày HT thực tế</th>
                  <th className="text-center px-3 py-3 font-medium text-muted-foreground whitespace-nowrap w-[200px]">Tình trạng</th>
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
                      className="border-t border-border hover:bg-muted/50 cursor-pointer"
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
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[task.status] || "bg-gray-100 text-gray-600"}`}
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
        </div>

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Hiển thị {(pagination.page - 1) * pagination.limit + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} trong {pagination.total} kết quả
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="px-3 py-1 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Trước
              </button>
              <span className="text-sm text-muted-foreground">
                Trang {pagination.page} / {pagination.totalPages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="px-3 py-1 text-sm border border-border rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
