"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  createdAt: string;
  user: { id: string; fullName: string };
}

export default function AuditLogsPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: { role: string } }>("/auth/me")
      .then((res) => {
        if (!["ADMIN", "SECRETARY"].includes(res.data.role)) {
          router.replace("/dashboard");
          return;
        }
        return apiFetch<{ data: AuditLog[] }>("/audit-logs");
      })
      .then((res) => {
        if (res) setLogs(res.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("vi-VN");
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-muted-foreground mt-2">Đang tải...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-destructive mt-2">Lỗi: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div>
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <p className="text-muted-foreground mt-2">
          Lịch sử thay đổi dữ liệu ({logs.length} bản ghi)
        </p>
      </div>

      <div className="mt-6 rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="text-left p-3 font-medium text-muted-foreground">Thời gian</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Người thực hiện</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Hành động</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Đối tượng</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Trường</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Giá trị cũ</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Giá trị mới</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={log.id} className="border-t border-border hover:bg-muted/50">
                <td className="p-3 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                <td className="p-3">{log.user.fullName}</td>
                <td className="p-3">
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {log.action}
                  </span>
                </td>
                <td className="p-3 font-mono text-xs">{log.entityId.slice(0, 8)}...</td>
                <td className="p-3">{log.fieldName || "-"}</td>
                <td className="p-3 max-w-[200px] truncate text-muted-foreground">{log.oldValue || "-"}</td>
                <td className="p-3 max-w-[200px] truncate">{log.newValue || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
