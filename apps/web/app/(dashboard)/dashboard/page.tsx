"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface DashboardSummary {
  month: string;
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  noEvaluation: number;
  completionRate: number;
}

interface DepartmentStats {
  departmentId: string;
  departmentCode: string;
  departmentName: string;
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
  completionRate: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [departments, setDepartments] = useState<DepartmentStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiFetch<{ data: DashboardSummary }>(`/dashboard/summary?month=${selectedMonth}`),
      apiFetch<{ data: { departments: DepartmentStats[] } }>(`/dashboard/departments?month=${selectedMonth}`),
    ])
      .then(([summaryRes, deptRes]) => {
        setSummary(summaryRes.data);
        setDepartments(deptRes.data.departments);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedMonth]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedMonth(e.target.value);
  };

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
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
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-destructive mt-2">Lỗi: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">Tổng quan nhiệm vụ theo tháng</p>
        </div>
        <div>
          <input
            type="month"
            value={selectedMonth}
            onChange={handleMonthChange}
            className="border border-border rounded-md px-3 py-2 text-sm bg-background"
          />
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="p-4 border border-border rounded-lg bg-card">
            <p className="text-sm text-muted-foreground">Tổng nhiệm vụ</p>
            <p className="text-3xl font-bold text-foreground mt-1">{summary.total}</p>
          </div>
          <div className="p-4 border border-border rounded-lg bg-card">
            <p className="text-sm text-muted-foreground">Hoàn thành</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{summary.completed}</p>
            <p className="text-xs text-muted-foreground mt-1">{summary.completionRate}% hoàn thành</p>
          </div>
          <div className="p-4 border border-border rounded-lg bg-card">
            <p className="text-sm text-muted-foreground">Đang thực hiện</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{summary.inProgress}</p>
          </div>
          <div className="p-4 border border-border rounded-lg bg-card">
            <p className="text-sm text-muted-foreground">Quá hạn</p>
            <p className="text-3xl font-bold text-orange-600 mt-1">{summary.overdue}</p>
          </div>
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-foreground mb-4">Theo phòng ban</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-left p-3 font-medium text-muted-foreground">Phòng ban</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Tổng</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Hoàn thành</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Đang thực hiện</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Quá hạn</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Tỷ lệ %</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr key={dept.departmentId} className="border-t border-border hover:bg-muted/50">
                    <td className="p-3">
                      <div className="font-medium">{dept.departmentName}</div>
                      <div className="text-xs text-muted-foreground">{dept.departmentCode}</div>
                    </td>
                    <td className="p-3 text-center">{dept.total}</td>
                    <td className="p-3 text-center text-green-600">{dept.completed}</td>
                    <td className="p-3 text-center text-blue-600">{dept.inProgress}</td>
                    <td className="p-3 text-center text-orange-600">{dept.overdue}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                          dept.completionRate >= 80
                            ? "bg-green-50 text-green-700"
                            : dept.completionRate >= 50
                            ? "bg-yellow-50 text-yellow-700"
                            : "bg-red-50 text-red-700"
                        }`}
                      >
                        {dept.completionRate}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
