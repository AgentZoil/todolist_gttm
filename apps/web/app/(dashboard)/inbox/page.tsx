"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronRight, Inbox, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";

interface Feedback {
  type: "DIRECTIVE" | "REVIEW";
  decision?: "APPROVED" | "NEEDS_REVISION";
  author: { fullName: string };
}

interface AttentionTask {
  id: string;
  title: string;
  approvalStatus: "PENDING" | "APPROVED" | "NEEDS_REVISION" | "NOT_SUBMITTED";
  ownerDepartment: { id: string };
  feedbacks?: Feedback[];
}

function getLatestAttentionFeedback(task: AttentionTask) {
  if (task.approvalStatus === "NEEDS_REVISION") {
    return task.feedbacks?.find(
      (feedback) => feedback.type === "REVIEW" && feedback.decision === "NEEDS_REVISION",
    );
  }
  return task.feedbacks?.find((feedback) => feedback.type === "DIRECTIVE");
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

  const openTask = async (task: AttentionTask) => {
    try {
      await apiFetch(`/tasks/${task.id}/attention/read`, { method: "POST" });
      window.dispatchEvent(new Event("inbox:refresh"));
    } catch (err: any) {
      setError(err.message || "Không thể cập nhật trạng thái đã đọc");
    } finally {
      router.push(`/tasks?departmentId=${encodeURIComponent(task.ownerDepartment.id)}&taskId=${encodeURIComponent(task.id)}`);
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
        <div className="overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10">
          <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-3 sm:px-5">
            <div>
              <p className="font-semibold text-foreground">Cần xử lý</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Phản hồi mới từ Lãnh đạo/Thư ký</p>
            </div>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-semibold text-primary">
              {tasks.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {tasks.map((task) => {
              const needsRevision = task.approvalStatus === "NEEDS_REVISION";
              const feedback = getLatestAttentionFeedback(task);
              return (
                <div key={task.id} className="group flex flex-col gap-3 px-4 py-4 transition-colors hover:bg-muted/25 sm:flex-row sm:items-center sm:gap-5 sm:px-5">
                  <div className={needsRevision
                    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-destructive"
                    : "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"}
                  >
                    {needsRevision ? <AlertTriangle className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className={needsRevision ? "font-semibold text-destructive" : "font-semibold text-primary"}>
                        {needsRevision ? "Yêu cầu bổ sung" : "Ý kiến chỉ đạo"}
                      </span>
                      <span className="text-muted-foreground">
                        từ {feedback?.author.fullName || "Lãnh đạo/Thư ký"}
                      </span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-baseline gap-1.5">
                      <span className="shrink-0 text-xs text-muted-foreground">Nhiệm vụ:</span>
                      <h2 className="line-clamp-2 font-medium leading-5 text-foreground">{task.title}</h2>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 self-start sm:self-center"
                    onClick={() => void openTask(task)}
                  >
                    Xem chi tiết
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
