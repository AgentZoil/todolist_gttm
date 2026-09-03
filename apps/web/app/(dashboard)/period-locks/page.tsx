"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Lock, Unlock, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PeriodLock {
  id: string;
  year: number;
  month: number;
  lockedBy: string;
  lockedAt: string;
}

const MONTH_NAMES = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6",
  "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

export default function PeriodLocksPage() {
  const router = useRouter();
  const [locks, setLocks] = useState<PeriodLock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  useEffect(() => {
    apiFetch<{ data: { role: string } }>("/auth/me")
      .then((res) => {
        if (res.data.role !== "ADMIN") {
          router.replace("/dashboard");
          return;
        }
        return apiFetch<{ data: PeriodLock[] }>("/period-locks");
      })
      .then((res) => {
        if (res) setLocks(res.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [router]);

  const handleLock = async (month: number) => {
    const key = `${selectedYear}-${month}`;
    setActionLoading(key);
    try {
      await apiFetch(`/period-locks/${selectedYear}/${month}`, { method: "POST" });
      await fetchLocks();
    } catch (err: any) {
      setError(err.message || "Lỗi khóa tháng");
      setTimeout(() => setError(null), 3000);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlock = async (month: number) => {
    if (!confirm(`Bạn có chắc muốn mở khóa tháng ${month}/${selectedYear}?`)) return;
    const key = `${selectedYear}-${month}`;
    setActionLoading(key);
    try {
      await apiFetch(`/period-locks/${selectedYear}/${month}`, { method: "DELETE" });
      await fetchLocks();
    } catch (err: any) {
      setError(err.message || "Lỗi mở khóa tháng");
      setTimeout(() => setError(null), 3000);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchLocks = async () => {
    const res = await apiFetch<{ data: PeriodLock[] }>("/period-locks");
    setLocks(res.data);
  };

  const currentMonth = now.getMonth() + 1;
  const isCurrentYear = selectedYear === now.getFullYear();

  const lockedInYear = locks.filter((l) => l.year === selectedYear).length;

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Khóa tháng</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Khóa tháng để ngăn việc chỉnh sửa thông tin quan trọng của nhiệm vụ đã qua kỳ.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedYear((y) => y - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[60px] text-center text-sm font-semibold text-foreground tabular-nums">
              {selectedYear}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSelectedYear((y) => y + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <span className="text-sm text-muted-foreground">
            {lockedInYear}/12 đã khóa
          </span>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Hướng dẫn */}
      <div className="rounded-xl border border-border/40 bg-card/80 p-5 shadow-sm backdrop-blur-sm">
        <h3 className="text-sm font-semibold text-foreground mb-3">Hướng dẫn sử dụng</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Khi tháng bị khóa, <span className="text-amber-600">không được phép sửa</span>:</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Nội dung nhiệm vụ
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Nguồn giao nhiệm vụ (lãnh đạo, văn bản...)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Ngày giao nhiệm vụ
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Lãnh đạo giao nhiệm vụ
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Số/ ký hiệu văn bản
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Phòng ban phụ trách
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                Ngày yêu cầu hoàn thành
              </li>
            </ul>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Vẫn <span className="text-emerald-600">được phép sửa</span>:</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Ngày hoàn thành thực tế
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Bằng chứng hoàn thành (hình ảnh, file đính kèm)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                Lý do chưa hoàn thành
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3 pt-2 border-t border-border/40">
              <span className="font-medium">Lưu ý:</span> Admin vẫn chỉnh sửa được tất cả. Thư ký bị hạn chế tương tự Phụ trách phòng ban.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
          const isLocked = locks.some((l) => l.year === selectedYear && l.month === month);
          const isCurrent = isCurrentYear && month === currentMonth;
          const isLoading = actionLoading === `${selectedYear}-${month}`;

          return (
            <div
              key={month}
              className={cn(
                "relative overflow-hidden rounded-xl border p-4 transition-all",
                isCurrent
                  ? "border-primary/40 bg-primary/5"
                  : "border-border/40 bg-card/80 hover:border-border/60 hover:shadow-sm"
              )}
            >
              <div className="flex flex-col items-center gap-3">
                <span className={cn(
                  "text-sm font-semibold",
                  isCurrent ? "text-primary" : "text-foreground"
                )}>
                  {MONTH_NAMES[month - 1]}
                </span>

                {isLocked ? (
                  <div className="flex flex-col items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
                      <Lock className="h-3 w-3" />
                      Đã khóa
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnlock(month)}
                      disabled={isLoading}
                      className="h-7 gap-1.5 text-xs"
                    >
                      {isLoading ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      ) : (
                        <Unlock className="h-3 w-3" />
                      )}
                      Mở khóa
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                      <Unlock className="h-3 w-3" />
                      Mở
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleLock(month)}
                      disabled={isLoading}
                      className="h-7 gap-1.5 text-xs"
                    >
                      {isLoading ? (
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      ) : (
                        <Lock className="h-3 w-3" />
                      )}
                      Khóa
                    </Button>
                  </div>
                )}
              </div>

              {isCurrent && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
