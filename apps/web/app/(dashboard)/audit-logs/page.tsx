"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import {
  ScrollText,
  AlertTriangle,
  Clock,
  Edit3,
  Trash2,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 50;

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
  user: { id: string; fullName: string } | null;
}

const ACTION_STYLE: Record<string, { badge: string; icon: React.ElementType; label: string }> = {
  SUBMIT_REGISTRATION: {
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: PlusCircle,
    label: "Gửi yêu cầu đăng ký",
  },
  APPROVE_REGISTRATION: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: PlusCircle,
    label: "Duyệt đăng ký",
  },
  REJECT_REGISTRATION: {
    badge: "bg-red-50 text-red-600 ring-red-200",
    icon: Trash2,
    label: "Từ chối đăng ký",
  },
  CREATE_USER: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: PlusCircle,
    label: "Cấp tài khoản",
  },
  UPDATE_USER: {
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: Edit3,
    label: "Cập nhật tài khoản",
  },
  DELETE_USER: {
    badge: "bg-red-50 text-red-600 ring-red-200",
    icon: Trash2,
    label: "Xóa tài khoản",
  },
  CREATE_DEPARTMENT: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: PlusCircle,
    label: "Tạo phòng ban",
  },
  UPDATE_DEPARTMENT: {
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: Edit3,
    label: "Cập nhật phòng ban",
  },
  LOCK_PERIOD: {
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    icon: Edit3,
    label: "Khóa kỳ",
  },
  UNLOCK_PERIOD: {
    badge: "bg-purple-50 text-purple-700 ring-purple-200",
    icon: Edit3,
    label: "Mở khóa kỳ",
  },
  APPROVE_COMPLETION: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: Edit3,
    label: "Duyệt hoàn thành",
  },
  REQUEST_COMPLETION_REVISION: {
    badge: "bg-orange-50 text-orange-600 ring-orange-200",
    icon: Edit3,
    label: "Yêu cầu bổ sung",
  },
  ADD_TASK_DIRECTIVE: {
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: PlusCircle,
    label: "Thêm ý kiến chỉ đạo",
  },
  DELETE_TASK_DIRECTIVE: {
    badge: "bg-red-50 text-red-600 ring-red-200",
    icon: Trash2,
    label: "Xóa ý kiến chỉ đạo",
  },
  CREATE: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    icon: PlusCircle,
    label: "Tạo mới",
  },
  UPDATE: {
    badge: "bg-blue-50 text-blue-700 ring-blue-200",
    icon: Edit3,
    label: "Chỉnh sửa",
  },
  DELETE: {
    badge: "bg-red-50 text-red-600 ring-red-200",
    icon: Trash2,
    label: "Xóa",
  },
  CANCEL: {
    badge: "bg-orange-50 text-orange-600 ring-orange-200",
    icon: Trash2,
    label: "Hủy",
  },
  FINALIZE: {
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
    icon: Edit3,
    label: "Chốt",
  },
  UNFINALIZE: {
    badge: "bg-purple-50 text-purple-700 ring-purple-200",
    icon: Edit3,
    label: "Mở chốt",
  },
};

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch<{ data: { role: string } }>("/auth/me")
      .then((res) => {
        if (res.data.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        return apiFetch<{ data: AuditLog[]; meta: { total: number } }>(`/audit-logs?page=${page}&limit=${PAGE_SIZE}`);
      })
      .then((res) => {
        if (active && res) {
          setLogs(res.data);
          setTotal(res.meta.total);
        }
      })
      .catch((err) => { if (active) setError(err.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, router]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("vi-VN");
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
      <div>
        <div className="flex items-center gap-2.5">
          <ScrollText className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">Nhật ký hoạt động</h1>
          <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-primary/10 px-2 text-xs font-semibold text-primary ring-1 ring-primary/20">
            {total}
          </span>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Lịch sử thay đổi dữ liệu
        </p>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Thời gian
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Người thực hiện
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Hành động
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Đối tượng
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Trường
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Giá trị cũ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Giá trị mới
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-16 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <ScrollText className="h-8 w-8 opacity-40" />
                      <span className="text-sm">Không có dữ liệu</span>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => {
                  const isEven = index % 2 === 0;
                  const style = ACTION_STYLE[log.action];
                  const ActionIcon = style?.icon || Clock;
                  return (
                    <tr
                      key={log.id}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/30",
                        isEven ? "bg-card" : "bg-muted/10"
                      )}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          {formatDate(log.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground ring-1 ring-border">
                            {log.user?.fullName.charAt(0) || "?"}
                          </span>
                          {log.user?.fullName || "Khách / hệ thống"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex h-6 items-center justify-center gap-1 rounded-full px-2.5 text-xs font-semibold ring-1",
                            style?.badge || "bg-muted text-muted-foreground ring-border"
                          )}
                        >
                          <ActionIcon className="h-3 w-3" />
                          {style?.label || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {log.entityType}
                          <span className="ml-1 text-[10px] opacity-60">
                            {log.entityId.slice(0, 8)}...
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {log.fieldName ? (
                          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground ring-1 ring-border">
                            {log.fieldName}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {log.oldValue ? (
                          <span className="inline-block truncate rounded bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground ring-1 ring-border/50">
                            {log.oldValue}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {log.newValue ? (
                          <span className="inline-block truncate rounded bg-emerald-50/60 px-1.5 py-0.5 font-mono text-xs text-emerald-700 ring-1 ring-emerald-200/50">
                            {log.newValue}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          {total === 0 ? "Chưa có nhật ký" : `Đang xem ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} trên ${total}`}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>
            Trước
          </Button>
          <span>{page} / {Math.max(1, Math.ceil(total / PAGE_SIZE))}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / PAGE_SIZE) || loading} onClick={() => setPage((current) => current + 1)}>
            Sau
          </Button>
        </div>
      </div>
    </div>
  );
}
