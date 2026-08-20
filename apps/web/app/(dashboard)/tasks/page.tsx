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
  isCancelled: boolean;
  isFinalized: boolean;
  version: number;
  createdAt: string;
  ownerDepartment: Department;
  creator: { id: string; fullName: string };
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
  const [filterDepartment, setFilterDepartment] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("in_progress");
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
    Promise.all([
      apiFetch<{ data: UserInfo }>("/auth/me").then((res) => {
        setUserInfo(res.data);
      }),
      apiFetch<{ data: Department[] }>("/departments").then((res) => {
        setDepartments(res.data);
        return res.data;
      }),
    ])
      .then(([, depts]) => {
        if (depts && depts.length > 0) {
          const defaultDept = depts[0].id;
          setFilterDepartment(defaultDept);
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
    setSubmitting(true);
    try {
      await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          documentNumber: formData.documentNumber || undefined,
          requiredCompletionDate: formData.requiredCompletionDate || undefined,
        }),
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
      alert("Lỗi: " + err.message);
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
      alert("Lỗi: " + err.message);
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("vi-VN");
  };

  const isInProgress = (task: Task) =>
    task.status === "IN_PROGRESS" || task.status === "OVERDUE";

  const isCompleted = (task: Task) =>
    task.status === "COMPLETED" || task.status === "FINALIZED";

  const filteredTasks = tasks.filter((t) =>
    activeTab === "in_progress" ? isInProgress(t) : isCompleted(t)
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nhiệm vụ</h1>
          <p className="text-muted-foreground mt-2">
            Quản lý nhiệm vụ theo phòng ban
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-border rounded-md px-3 py-2 text-sm bg-background"
            />
            <button
              type="submit"
              className="bg-secondary text-secondary-foreground px-3 py-2 rounded-md text-sm font-medium hover:bg-secondary/90"
            >
              Tìm
            </button>
          </form>
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
          <button
            onClick={() => setShowForm(true)}
            className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
          >
            Thêm nhiệm vụ
          </button>
        </div>
      </div>

      {showForm && (
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

      <div className="mt-6">
        <div className="flex gap-1 border-b border-border">
          <button
            onClick={() => setActiveTab("in_progress")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "in_progress"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Đang thực hiện ({tasks.filter(isInProgress).length})
          </button>
          <button
            onClick={() => setActiveTab("completed")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "completed"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Đã hoàn thành ({tasks.filter(isCompleted).length})
          </button>
        </div>

        <div className="mt-0 rounded-lg border border-t-0 border-border overflow-hidden relative">
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
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-3 font-medium text-muted-foreground w-12">STT</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Nội dung</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Đơn vị</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Ngày giao</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Ngày YC HT</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Trạng thái</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {activeTab === "in_progress"
                      ? "Không có nhiệm vụ đang thực hiện"
                      : "Không có nhiệm vụ đã hoàn thành"}
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task, index) => (
                  <tr key={task.id} className="border-t border-border hover:bg-muted/50">
                    <td className="p-3 text-muted-foreground">{index + 1}</td>
                    <td className="p-3 max-w-xs truncate">{task.title}</td>
                    <td className="p-3">{task.ownerDepartment.name}</td>
                    <td className="p-3">{formatDate(task.assignedDate)}</td>
                    <td className="p-3">
                      {task.requiredCompletionDate
                        ? formatDate(task.requiredCompletionDate)
                        : "-"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${task.statusColor}`}
                      >
                        {task.statusLabel}
                      </span>
                    </td>
                    <td className="p-3">
                      {!task.isCancelled && (
                        <button
                          onClick={() => handleCancel(task.id)}
                          className="text-destructive hover:text-destructive/80 text-xs font-medium"
                        >
                          Hủy
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
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
