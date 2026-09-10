"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Inbox, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface Feedback {
  id: string;
  type: "DIRECTIVE" | "REVIEW";
  decision?: "APPROVED" | "NEEDS_REVISION";
  content: string;
  createdAt: string;
  author: { fullName: string };
}

interface AttentionTask {
  id: string;
  title: string;
  requiredCompletionDate?: string;
  actualCompletionDate?: string;
  approvalStatus: "PENDING" | "APPROVED" | "NEEDS_REVISION" | "NOT_SUBMITTED";
  updatedAt: string;
  ownerDepartment: { id: string; name: string };
  feedbacks?: Feedback[];
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString("vi-VN") : "—";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("vi-VN");
}

function getLatestAttentionFeedback(task: AttentionTask) {
  return task.feedbacks?.find(
    (feedback) =>
      (feedback.type === "REVIEW" && feedback.decision === "NEEDS_REVISION") ||
      feedback.type === "DIRECTIVE",
  );
}

export default function InboxPage() {
  const router = useRouter();
  const [tasks, setTasks] = useState<AttentionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<{ data: AttentionTask[] }>("/tasks/attention");
      setTasks(res.data);
    } catch (err: any) {
      setError(err.message || "Không thể tải hộp công việc");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiFetch<{ data: { role: string } }>("/auth/me")
      .then((res) => {
        if (res.data.role !== "DEPARTMENT_EDITOR") {
          router.replace("/dashboard");
          return;
        }
        loadTasks();
      })
      .catch(() => router.replace("/dashboard"));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Inbox className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Hộp công việc</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Nhiệm vụ cần phòng ban đọc hoặc bổ sung
              </p>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadTasks} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Làm mới
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Đang tải hộp công việc...
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 font-medium text-foreground">Không có việc cần xử lý</p>
          <p className="mt-1 text-sm text-muted-foreground">Phòng ban chưa có yêu cầu bổ sung hoặc ý kiến mới.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const feedback = getLatestAttentionFeedback(task);
            const needsRevision = task.approvalStatus === "NEEDS_REVISION";
            return (
              <div key={task.id} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {needsRevision ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                      ) : (
                        <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
                      )}
                      <h2 className="font-semibold text-foreground">{task.title}</h2>
                      <span className={needsRevision
                        ? "rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 ring-1 ring-red-200"
                        : "rounded-full bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700 ring-1 ring-blue-200"}
                      >
                        {needsRevision ? "Cần bổ sung" : "Ý kiến chỉ đạo"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {task.ownerDepartment.name} · Cập nhật {formatDateTime(task.updatedAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => router.push(`/tasks?departmentId=${encodeURIComponent(task.ownerDepartment.id)}&taskId=${encodeURIComponent(task.id)}`)}
                  >
                    Mở nhiệm vụ
                  </Button>
                </div>
                {feedback && (
                  <div className="mt-3 rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{feedback.content}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {feedback.author.fullName} · {formatDateTime(feedback.createdAt)}
                    </p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <span>Hạn hoàn thành: {formatDate(task.requiredCompletionDate)}</span>
                  <span>Thực tế: {formatDate(task.actualCompletionDate)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
