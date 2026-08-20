"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Department {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: Department[] }>("/departments")
      .then((res) => setDepartments(res.data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">Phòng ban</h1>
        <p className="text-muted-foreground mt-2">Đang tải...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">Phòng ban</h1>
        <p className="text-destructive mt-2">Lỗi: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground">Phòng ban</h1>
      <p className="text-muted-foreground mt-2">
        Danh sách {departments.length} phòng ban
      </p>

      <div className="mt-6 rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="text-left p-3 font-medium text-muted-foreground">
                STT
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground">
                Mã phòng
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground">
                Tên phòng ban
              </th>
              <th className="text-left p-3 font-medium text-muted-foreground">
                Trạng thái
              </th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept, index) => (
              <tr
                key={dept.id}
                className="border-t border-border hover:bg-muted/50"
              >
                <td className="p-3">{index + 1}</td>
                <td className="p-3 font-mono text-xs">{dept.code}</td>
                <td className="p-3">{dept.name}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      dept.isActive
                        ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {dept.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
