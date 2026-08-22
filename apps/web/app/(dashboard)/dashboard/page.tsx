"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
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

  const statCards = [
    {
      label: "Tổng nhiệm vụ",
      value: totals.total,
      icon: ClipboardList,
      color: "text-primary",
      bg: "bg-primary/10",
      ring: "ring-primary/20",
    },
    {
      label: "Hoàn thành đúng hạn",
      value: totals.completedOnTime,
      icon: CheckCircle2,
      color: "text-emerald-600",
      bg: "bg-emerald-50",
      ring: "ring-emerald-200",
    },
    {
      label: "Hoàn thành quá hạn",
      value: totals.completedLate,
      icon: Clock,
      color: "text-orange-500",
      bg: "bg-orange-50",
      ring: "ring-orange-200",
    },
    {
      label: "Chưa hoàn thành - còn hạn",
      value: totals.inProgressOnTime,
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
      ring: "ring-blue-200",
    },
    {
      label: "Chưa hoàn thành - quá hạn",
      value: totals.inProgressLate,
      icon: CalendarX,
      color: "text-red-500",
      bg: "bg-red-50",
      ring: "ring-red-200",
    },
    {
      label: "Không đánh giá",
      value: totals.noEvaluation,
      icon: ClipboardList,
      color: "text-muted-foreground",
      bg: "bg-muted",
      ring: "ring-border",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">BẢNG TỔNG HỢP ĐÁNH GIÁ HOÀN THÀNH NHIỆM VỤ</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="h-9 rounded-lg border border-border bg-card px-3 pr-8 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statCards.map((s) => (
          <Card key={s.label} className="relative overflow-hidden">
            <CardContent className="py-4">
              <div className="flex items-center justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${s.bg} ${s.ring}`}>
                  <s.icon className={`h-4.5 w-4.5 ${s.color}`} />
                </div>
                <span className={`text-2xl font-bold tabular-nums ${s.color}`}>
                  {s.value}
                </span>
              </div>
              <p className="mt-2.5 text-xs font-medium text-muted-foreground leading-tight">
                {s.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Completion Rate */}
      <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary to-secondary shadow-lg shadow-primary/10">
        <CardContent className="py-5">
          <div className="flex items-center justify-between text-primary-foreground">
            <div>
              <p className="text-sm font-medium opacity-80">Tỷ lệ hoàn thành</p>
              <p className="mt-1 text-4xl font-bold tabular-nums">{totals.completionRate}%</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
              <TrendingUp className="h-8 w-8" />
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-700 ease-out"
              style={{ width: `${totals.completionRate}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs opacity-70">
            <span>0%</span>
            <span>100%</span>
          </div>
        </CardContent>
      </Card>

      {/* Department Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">STT</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phòng ban</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tổng NV</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-emerald-600">Đúng hạn</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-orange-500">Quá hạn</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-blue-600">Còn hạn</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-red-500">Hết hạn</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Không ĐG</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ClipboardList className="h-8 w-8 opacity-40" />
                      <span className="text-sm">Không có dữ liệu</span>
                    </div>
                  </td>
                </tr>
              ) : (
                departments.map((dept, index) => {
                  const isEven = index % 2 === 0;
                  return (
                    <tr
                      key={dept.departmentId}
                      className={`border-b border-border/50 transition-colors hover:bg-muted/30 ${
                        isEven ? "bg-card" : "bg-muted/10"
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{dept.departmentName}</span>
                      </td>
                      <td className="px-4 py-3 text-center font-semibold">{dept.total}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          {dept.completedOnTime}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-orange-50 px-2 text-xs font-semibold text-orange-600 ring-1 ring-orange-200">
                          {dept.completedLate}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-blue-50 px-2 text-xs font-semibold text-blue-600 ring-1 ring-blue-200">
                          {dept.inProgressOnTime}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-red-50 px-2 text-xs font-semibold text-red-500 ring-1 ring-red-200">
                          {dept.inProgressLate}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-muted px-2 text-xs font-semibold text-muted-foreground ring-1 ring-border">
                          {dept.noEvaluation}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                dept.completionRate >= 80
                                  ? "bg-emerald-500"
                                  : dept.completionRate >= 50
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                              }`}
                              style={{ width: `${dept.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold tabular-nums">{dept.completionRate}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
