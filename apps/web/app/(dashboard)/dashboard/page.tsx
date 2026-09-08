"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { DepartmentStatusChart } from "@/components/dashboard/department-status-chart";
import {
  ClipboardList,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarX,
  TrendingUp,
} from "lucide-react";

interface DepartmentStats {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  total: number;
  completedOnTime: number;
  completedLate: number;
  inProgressOnTime: number;
  inProgressLate: number;
  noEvaluation: number;
  completionRate: number;
}

const MONTH_LABELS = [
  "Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4",
  "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8",
  "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12",
];

export default function DashboardPage() {
  const [departments, setDepartments] = useState<DepartmentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );

  useEffect(() => {
    setLoading(true);
    apiFetch<{ data: { departments: DepartmentStats[] } }>(`/dashboard/departments?month=${selectedMonth}`)
      .then((deptRes) => setDepartments(deptRes.data.departments))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  const totals = useMemo(() => {
    const t = departments.reduce(
      (acc, d) => ({
        total: acc.total + d.total,
        completedOnTime: acc.completedOnTime + d.completedOnTime,
        completedLate: acc.completedLate + d.completedLate,
        inProgressOnTime: acc.inProgressOnTime + d.inProgressOnTime,
        inProgressLate: acc.inProgressLate + d.inProgressLate,
        noEvaluation: acc.noEvaluation + d.noEvaluation,
      }),
      { total: 0, completedOnTime: 0, completedLate: 0, inProgressOnTime: 0, inProgressLate: 0, noEvaluation: 0 }
    );
    const rated = t.completedOnTime + t.completedLate + t.inProgressOnTime + t.inProgressLate;
    return { ...t, completionRate: rated > 0 ? Math.round(((t.completedOnTime + t.completedLate) / rated) * 100) : 0 };
  }, [departments]);

  const monthName = (() => {
    const [y, m] = selectedMonth.split("-").map(Number);
    return `${MONTH_LABELS[m - 1]} ${y}`;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <span className="text-sm text-muted-foreground">Đang tải dữ liệu...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-8 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <p className="font-medium text-destructive">Lỗi: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Tổng nhiệm vụ",
      value: totals.total,
      icon: ClipboardList,
      gradient: "from-primary/20 to-primary/5",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      glowColor: "hover:shadow-primary/20",
    },
    {
      label: "Hoàn thành đúng hạn",
      value: totals.completedOnTime,
      icon: CheckCircle2,
      gradient: "from-emerald-500/20 to-emerald-500/5",
      iconBg: "bg-emerald-500/10",
      iconColor: "text-emerald-500",
      glowColor: "hover:shadow-emerald-500/20",
    },
    {
      label: "Hoàn thành quá hạn",
      value: totals.completedLate,
      icon: Clock,
      gradient: "from-orange-500/20 to-orange-500/5",
      iconBg: "bg-orange-500/10",
      iconColor: "text-orange-500",
      glowColor: "hover:shadow-orange-500/20",
    },
    {
      label: "Đang thực hiện",
      value: totals.inProgressOnTime,
      icon: TrendingUp,
      gradient: "from-blue-500/20 to-blue-500/5",
      iconBg: "bg-blue-500/10",
      iconColor: "text-blue-500",
      glowColor: "hover:shadow-blue-500/20",
    },
    {
      label: "Không hoàn thành",
      value: totals.inProgressLate,
      icon: CalendarX,
      gradient: "from-red-500/20 to-red-500/5",
      iconBg: "bg-red-500/10",
      iconColor: "text-red-500",
      glowColor: "hover:shadow-red-500/20",
    },
    {
      label: "Không đánh giá",
      value: totals.noEvaluation,
      icon: ClipboardList,
      gradient: "from-muted-foreground/20 to-muted-foreground/5",
      iconBg: "bg-muted",
      iconColor: "text-muted-foreground",
      glowColor: "hover:shadow-muted-foreground/10",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground lg:text-3xl">
            Bảng tổng hợp đánh giá
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-10 rounded-xl border border-border/60 bg-card/80 px-4 text-sm font-medium shadow-sm ring-1 ring-foreground/5 backdrop-blur-sm transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:shadow-lg focus:shadow-primary/10"
            />
          </div>
        </div>
      </div>

      {/* Completion Rate Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary via-primary to-secondary p-6 shadow-xl shadow-primary/10">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <p className="text-sm font-medium text-primary-foreground/80">Tỷ lệ hoàn thành tháng này</p>
              <div className="flex items-baseline gap-2">
                <p className="text-5xl font-bold tabular-nums text-primary-foreground">{totals.completionRate}%</p>
                <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-medium text-primary-foreground backdrop-blur-sm">
                  {monthName}
                </span>
              </div>
            </div>
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
              <TrendingUp className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between text-xs text-primary-foreground/70">
              <span>Tiến độ</span>
              <span>{totals.completionRate}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full rounded-full bg-gradient-to-r from-white/90 to-white/60 transition-all duration-1000 ease-out"
                style={{ width: `${totals.completionRate}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s) => (
          <div
            key={s.label}
            className={`group relative overflow-hidden rounded-xl border border-border/40 bg-gradient-to-br ${s.gradient} p-4 backdrop-blur-sm transition-all duration-300 hover:border-border/60 hover:shadow-lg ${s.glowColor} cursor-default`}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-card/50 to-card/80" />
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.iconBg} ring-1 ring-black/5 transition-transform duration-300 group-hover:scale-110`}>
                  <s.icon className={`h-5 w-5 ${s.iconColor}`} />
                </div>
                <span className={`text-2xl font-bold tabular-nums ${s.iconColor}`}>
                  {s.value}
                </span>
              </div>
              <p className="mt-3 text-xs font-medium text-muted-foreground leading-tight">
                {s.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Department Status Chart */}
      {departments.length > 0 && (
        <DepartmentStatusChart
          key={selectedMonth}
          data={departments}
          selectedMonth={selectedMonth}
        />
      )}
    </div>
  );
}
