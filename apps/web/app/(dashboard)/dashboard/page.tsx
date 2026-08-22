"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

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
      .then((deptRes) => {
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

      <div className="mt-8">
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted">
                <th className="text-center p-3 font-medium text-muted-foreground">STT</th>
                <th className="text-left p-3 font-medium text-muted-foreground">Tên Phòng</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Số lượng NV được giao</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Hoàn thành đúng hạn</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Hoàn thành quá hạn</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Chưa hoàn thành - còn hạn</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Chưa hoàn thành - quá hạn</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Không thuộc diện đánh giá</th>
                <th className="text-center p-3 font-medium text-muted-foreground">Tỷ lệ hoàn thành</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                departments.map((dept, index) => (
                  <tr key={dept.departmentId} className="border-t border-border hover:bg-muted/50">
                    <td className="p-3 text-center">{index + 1}</td>
                    <td className="p-3">
                      <div className="font-medium">{dept.departmentName}</div>
                    </td>
                    <td className="p-3 text-center">{dept.total}</td>
                    <td className="p-3 text-center text-green-600">{dept.completedOnTime}</td>
                    <td className="p-3 text-center text-orange-600">{dept.completedLate}</td>
                    <td className="p-3 text-center text-blue-600">{dept.inProgressOnTime}</td>
                    <td className="p-3 text-center text-red-600">{dept.inProgressLate}</td>
                    <td className="p-3 text-center text-gray-500">{dept.noEvaluation}</td>
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
