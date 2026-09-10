"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileCheck2,
  Inbox,
  Loader2,
  MessageSquare,
  Search,
  Send,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Department {
  id: string;
  code: string;
  name: string;
}

interface TaskFeedback {
  id: string;
  type: "DIRECTIVE" | "REVIEW";
  decision?: "APPROVED" | "NEEDS_REVISION";
  content: string;
  createdAt: string;
  author: { id: string; fullName: string };
}

interface ApprovalTask {
  id: string;
  title: string;
  content: string;
  source: string;
  assignedBy: string;
  priority: "URGENT" | "NORMAL";
  requiredCompletionDate?: string;
  actualCompletionDate?: string;
  completionEvidence?: string;
  approvalStatus: "PENDING";
  status: string;
  statusLabel: string;
  ownerDepartment: Department;
  creator: { id: string; fullName: string };
  feedbacks?: TaskFeedback[];
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const REVIEWER_ROLES = ["ADMIN", "LEADER", "SECRETARY"];

const STATUS_COLORS: Record<string, string> = {
  IN_PROGRESS: "bg-blue-50 text-blue-700 ring-blue-200",
  INCOMPLETE: "bg-red-50 text-red-700 ring-red-200",
  COMPLETED_EARLY: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  COMPLETED_ON_TIME: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  COMPLETED_LATE: "bg-orange-50 text-orange-700 ring-orange-200",
  NO_EVALUATION: "bg-muted text-muted-foreground ring-border",
};

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "—";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

function getPriorityLabel(priority: ApprovalTask["priority"]) {
  return priority === "URGENT" ? "Hỏa tốc" : "Thường";
}

export default function ApprovalsPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<ApprovalTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<ApprovalTask | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [note, setNote] = useState("");
  const [directive, setDirective] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmApprove, setConfirmApprove] = useState(false);

  const fetchTasks = async (page = pagination.page, query = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(pagination.limit) });
      if (query.trim()) params.set("search", query.trim());
      const res = await apiFetch<{ data: ApprovalTask[]; pagination: Pagination }>(`/tasks/pending-approval?${params}`);
      setTasks(res.data);
      setPagination(res.pagination);
      if (selectedTask && !res.data.some((task) => task.id === selectedTask.id)) {
        setSelectedTask(null);
      }
    } catch (err: any) {
      setError(err.message || "Không thể tải danh sách chờ duyệt");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiFetch<{ data: { role: string } }>("/auth/me")
      .then((res) => {
        if (!REVIEWER_ROLES.includes(res.data.role)) {
          router.replace("/dashboard");
          return;
        }
        fetchTasks(1, "");
      })
      .catch(() => router.replace("/dashboard"));
  }, []);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    fetchTasks(1, search);
  };

  const openTask = async (task: ApprovalTask) => {
    setSelectedTask(task);
    setLoadingDetail(true);
    setNote("");
    setDirective("");
    try {
      const res = await apiFetch<{ data: ApprovalTask }>(`/tasks/${task.id}`);
      setSelectedTask(res.data);
    } catch (err: any) {
      setError(err.message || "Không thể tải chi tiết nhiệm vụ");
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedTask) return;
    setSubmitting(true);
    try {
      await apiFetch(`/tasks/${selectedTask.id}/approve`, { method: "PATCH" });
      setMessage("Đã duyệt hoàn thành nhiệm vụ");
      setSelectedTask(null);
      await fetchTasks(1, search);
    } catch (err: any) {
      setError(err.message || "Không thể duyệt nhiệm vụ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestRevision = async () => {
    if (!selectedTask || !note.trim()) {
      setError("Vui lòng nhập ý kiến yêu cầu bổ sung");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/tasks/${selectedTask.id}/request-revision`, {
        method: "PATCH",
        body: JSON.stringify({ content: note.trim() }),
      });
      setMessage("Đã gửi yêu cầu bổ sung");
      setSelectedTask(null);
      await fetchTasks(1, search);
    } catch (err: any) {
      setError(err.message || "Không thể gửi yêu cầu bổ sung");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDirective = async () => {
    if (!selectedTask || !directive.trim()) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<{ data: TaskFeedback }>(`/tasks/${selectedTask.id}/directives`, {
        method: "POST",
        body: JSON.stringify({ content: directive.trim() }),
      });
      setSelectedTask({ ...selectedTask, feedbacks: [...(selectedTask.feedbacks || []), res.data] });
      setDirective("");
      setMessage("Đã thêm ý kiến chỉ đạo");
    } catch (err: any) {
      setError(err.message || "Không thể thêm ý kiến chỉ đạo");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={confirmApprove}
        title="Duyệt hoàn thành nhiệm vụ?"
        description="Sau khi duyệt, trạng thái chính thức trên dashboard sẽ được cập nhật."
        confirmLabel="Duyệt hoàn thành"
        onCancel={() => setConfirmApprove(false)}
        onConfirm={() => {
          setConfirmApprove(false);
          void handleApprove();
        }}
        loading={submitting}
      />
      {(error || message) && (
        <div className={cn(
          "fixed left-1/2 top-4 z-[100] flex w-full max-w-md -translate-x-1/2 items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-lg",
          error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
        )}>
          {error ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <FileCheck2 className="h-4 w-4 shrink-0" />}
          <span className="flex-1">{error || message}</span>
          <button onClick={() => { setError(null); setMessage(null); }} aria-label="Đóng thông báo">×</button>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Inbox className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Hộp duyệt nhiệm vụ</h1>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-semibold text-primary ring-1 ring-primary/20">
              {pagination.total}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Danh sách nhiệm vụ phòng ban/đơn vị đã gửi chờ duyệt</p>
        </div>
        <form onSubmit={handleSearch} className="flex w-full max-w-sm items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm nhiệm vụ, phòng ban..." className="pl-9" />
          </div>
          <Button type="submit" variant="outline">Tìm</Button>
        </form>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
        <Card className="min-h-[540px]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Clock3 className="h-4 w-4 text-amber-600" />
              Chờ xử lý
            </div>
            <span className="text-xs text-muted-foreground">Mới cập nhật trước</span>
          </div>
          <CardContent className="p-2">
            {loading ? (
              <div className="flex min-h-[460px] items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : tasks.length === 0 ? (
              <div className="flex min-h-[460px] flex-col items-center justify-center gap-3 px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><FileCheck2 className="h-6 w-6" /></div>
                <p className="font-medium text-foreground">Không có nhiệm vụ chờ duyệt</p>
                <p className="text-sm text-muted-foreground">Hộp duyệt đã được xử lý hết.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {tasks.map((task, index) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => openTask(task)}
                    className={cn(
                      "group flex w-full items-start gap-3 rounded-xl border p-3 text-left shadow-sm transition-all hover:-translate-y-px hover:border-primary/30 hover:shadow-md",
                      selectedTask?.id === task.id
                        ? "border-primary/40 bg-accent/50 ring-1 ring-primary/10"
                        : "border-border/70 bg-card hover:bg-accent/20",
                    )}
                  >
                    <span className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums",
                      selectedTask?.id === task.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                    )}>
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                          {task.title}
                        </p>
                        {task.priority === "URGENT" && (
                          <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">
                            Hỏa tốc
                          </span>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="truncate font-medium text-foreground/70">{task.ownerDepartment.name}</span>
                        <span>Hạn {formatDate(task.requiredCompletionDate)}</span>
                        <span>Cập nhật {formatDate(task.updatedAt)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted-foreground">
              <span>Trang {pagination.page}/{pagination.totalPages}</span>
              <div className="flex gap-1">
                <Button size="icon-sm" variant="outline" disabled={pagination.page <= 1 || loading} onClick={() => fetchTasks(pagination.page - 1)}><ChevronLeft /></Button>
                <Button size="icon-sm" variant="outline" disabled={pagination.page >= pagination.totalPages || loading} onClick={() => fetchTasks(pagination.page + 1)}><ChevronRight /></Button>
              </div>
            </div>
          )}
        </Card>

        <Card className="min-h-[540px]">
          {!selectedTask ? (
            <div className="flex min-h-[540px] flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm">Chọn một nhiệm vụ để xem hồ sơ và duyệt</p>
            </div>
          ) : loadingDetail ? (
            <div className="flex min-h-[540px] items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div>
              <div className="border-b border-border px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="mt-1 text-lg font-semibold leading-tight text-foreground">{selectedTask.title}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Cập nhật {formatDateTime(selectedTask.updatedAt)} · {selectedTask.creator.fullName}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <span className={cn("rounded-full px-2.5 py-1 text-xs font-medium ring-1", STATUS_COLORS[selectedTask.status] || STATUS_COLORS.NO_EVALUATION)}>{selectedTask.statusLabel}</span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">Chờ duyệt</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-muted/20 p-3 text-sm">
                  <div><p className="text-xs text-muted-foreground">Phòng ban/đơn vị</p><p className="mt-1 font-medium">{selectedTask.ownerDepartment.name}</p></div>
                  <div><p className="text-xs text-muted-foreground">Mức độ</p><p className={cn("mt-1 font-medium", selectedTask.priority === "URGENT" ? "text-red-700" : "text-muted-foreground")}>{getPriorityLabel(selectedTask.priority)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Hạn hoàn thành</p><p className="mt-1 font-medium">{formatDate(selectedTask.requiredCompletionDate)}</p></div>
                  <div><p className="text-xs text-muted-foreground">Thực tế</p><p className="mt-1 font-medium">{formatDate(selectedTask.actualCompletionDate)}</p></div>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nguồn và nội dung</p>
                  <p className="mt-1 text-sm font-medium">Theo {selectedTask.source} và {selectedTask.assignedBy}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{selectedTask.content}</p>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bằng chứng hoàn thành</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{selectedTask.completionEvidence || "Chưa có bằng chứng."}</p>
                </div>

                {selectedTask.feedbacks && selectedTask.feedbacks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lịch sử phản hồi</p>
                    {selectedTask.feedbacks.map((feedback) => (
                      <div key={feedback.id} className="rounded-lg border border-border px-3 py-2">
                        <div className="flex flex-wrap justify-between gap-2 text-xs">
                          <span className="font-semibold">{feedback.type === "DIRECTIVE" ? "Ý kiến chỉ đạo" : feedback.decision === "APPROVED" ? "Đã duyệt" : "Yêu cầu bổ sung"}</span>
                          <span className="text-muted-foreground">{feedback.author.fullName} · {formatDateTime(feedback.createdAt)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm">{feedback.content}</p>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 border-t border-border pt-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Ý kiến chỉ đạo</label>
                    <div className="mt-1 flex items-end gap-2">
                      <textarea value={directive} onChange={(event) => setDirective(event.target.value)} rows={2} maxLength={2000} placeholder="Nhập ý kiến chỉ đạo..." className="min-h-[64px] flex-1 resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-1 ring-foreground/5 focus:border-primary focus:ring-2 focus:ring-primary/20" />
                      <Button type="button" variant="outline" size="sm" onClick={handleDirective} disabled={submitting || !directive.trim()}><Send />Gửi</Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Phản hồi hồ sơ hoàn thành</label>
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={2000} placeholder="Nhập lý do nếu cần bổ sung..." className="mt-1 min-h-[64px] w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none ring-1 ring-foreground/5 focus:border-primary focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={handleRequestRevision} disabled={submitting || !note.trim()} className="text-red-700 hover:bg-red-50 hover:text-red-700"><AlertTriangle />Yêu cầu bổ sung</Button>
                    <Button type="button" size="sm" onClick={() => setConfirmApprove(true)} disabled={submitting}>{submitting ? <Loader2 className="animate-spin" /> : <CheckCheck />}Duyệt hoàn thành</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
