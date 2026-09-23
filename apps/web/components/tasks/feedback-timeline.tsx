import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface FeedbackTimelineItem {
  id: string;
  type: "DIRECTIVE" | "REVIEW";
  decision?: "APPROVED" | "NEEDS_REVISION";
  content: string;
  createdAt: string;
  author: { id: string; fullName: string };
}

interface FeedbackTimelineProps {
  feedbacks: FeedbackTimelineItem[];
  currentUserId?: string | null;
  canDelete?: (feedback: FeedbackTimelineItem) => boolean;
  onDelete?: (feedback: FeedbackTimelineItem) => void;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function getFeedbackMeta(feedback: FeedbackTimelineItem) {
  if (feedback.type === "DIRECTIVE") {
    return {
      label: "Ý kiến chỉ đạo",
      tone: "border-blue-200/80 bg-blue-50/40",
      dot: "bg-blue-500",
      labelTone: "text-blue-700",
    };
  }

  if (feedback.decision === "APPROVED") {
    return {
      label: "Đã duyệt hoàn thành",
      tone: "border-emerald-200/80 bg-emerald-50/40",
      dot: "bg-emerald-500",
      labelTone: "text-emerald-700",
    };
  }

  return {
    label: "Yêu cầu bổ sung",
    tone: "border-red-200/80 bg-red-50/40",
    dot: "bg-red-500",
    labelTone: "text-red-700",
  };
}

export function FeedbackTimeline({ feedbacks, currentUserId, canDelete, onDelete }: FeedbackTimelineProps) {
  const sortedFeedbacks = [...feedbacks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="relative max-h-[360px] space-y-2 overflow-y-auto pl-4 pr-1">
      <span className="absolute bottom-3 left-[3px] top-3 w-px bg-border" />
      {sortedFeedbacks.map((feedback) => {
        const meta = getFeedbackMeta(feedback);
        const showDelete = Boolean(
          onDelete &&
          currentUserId &&
          canDelete?.(feedback) &&
          feedback.author.id === currentUserId,
        );

        return (
          <div key={feedback.id} className="relative pl-4">
            <span className={`absolute left-[-1px] top-3 h-2 w-2 rounded-full ${meta.dot} ring-4 ring-card`} />
            <div className={`rounded-xl border px-3.5 py-3 ${meta.tone}`}>
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className={`text-xs font-semibold ${meta.labelTone}`}>{meta.label}</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-sm font-medium text-foreground">{feedback.author.fullName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex flex-col items-end text-[11px] leading-tight text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatTime(feedback.createdAt)}</span>
                    <span className="mt-0.5">{formatDate(feedback.createdAt)}</span>
                  </span>
                  {showDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-muted-foreground hover:bg-red-50 hover:text-red-600"
                      aria-label="Xóa ý kiến chỉ đạo"
                      title="Xóa ý kiến chỉ đạo"
                      onClick={() => onDelete?.(feedback)}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </div>
              </div>
              {feedback.content && (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{feedback.content}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
