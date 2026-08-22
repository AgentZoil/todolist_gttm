"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, X, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Role {
  id: string;
  name: string;
}

interface Department {
  id: string;
  code: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  authUserId: string;
  isActive: boolean;
  role: Role;
  department: Department;
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-primary/10 text-primary ring-primary/20",
  SECRETARY: "bg-secondary/10 text-secondary ring-secondary/20",
  DEPARTMENT_EDITOR: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  VIEWER: "bg-muted text-muted-foreground ring-border",
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    authUserId: "",
    fullName: "",
    roleId: "",
    departmentId: "",
  });

  useEffect(() => {
    apiFetch<{ data: { role: string } }>("/auth/me")
      .then((res) => {
        if (!["ADMIN", "SECRETARY"].includes(res.data.role)) {
          router.replace("/dashboard");
          return;
        }
        return Promise.all([
          apiFetch<{ data: User[] }>("/users"),
          apiFetch<{ data: Role[] }>("/auth/roles"),
          apiFetch<{ data: Department[] }>("/departments"),
        ]);
      })
      .then((result) => {
        if (!result) return;
        const [usersRes, rolesRes, deptsRes] = result;
        setUsers(usersRes.data);
        setRoles(rolesRes.data);
        setDepartments(deptsRes.data);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch("/users", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setShowForm(false);
      setFormData({ authUserId: "", fullName: "", roleId: "", departmentId: "" });
      const res = await apiFetch<{ data: User[] }>("/users");
      setUsers(res.data);
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
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

  const INPUT_CLASS =
    "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm shadow-sm ring-1 ring-foreground/5 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Người dùng</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý {users.length} người dùng
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? "outline" : "default"}
          className="gap-1.5"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4" />
              Đóng
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Thêm người dùng
            </>
          )}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Auth User ID (từ Supabase)
                  </label>
                  <input
                    type="text"
                    value={formData.authUserId}
                    onChange={(e) =>
                      setFormData({ ...formData, authUserId: e.target.value })
                    }
                    className={INPUT_CLASS}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Họ tên
                  </label>
                  <input
                    type="text"
                    value={formData.fullName}
                    onChange={(e) =>
                      setFormData({ ...formData, fullName: e.target.value })
                    }
                    className={INPUT_CLASS}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Vai trò
                  </label>
                  <select
                    value={formData.roleId}
                    onChange={(e) =>
                      setFormData({ ...formData, roleId: e.target.value })
                    }
                    className={INPUT_CLASS}
                    required
                  >
                    <option value="">Chọn vai trò</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    Phòng ban
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) =>
                      setFormData({ ...formData, departmentId: e.target.value })
                    }
                    className={INPUT_CLASS}
                    required
                  >
                    <option value="">Chọn phòng ban</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  Tạo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="gap-1.5"
                >
                  <X className="h-4 w-4" />
                  Hủy
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  STT
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Họ tên
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Vai trò
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Phòng ban
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-16 text-center text-muted-foreground"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 opacity-40" />
                      <span className="text-sm">Không có dữ liệu</span>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((user, index) => {
                  const isEven = index % 2 === 0;
                  const roleBadge =
                    ROLE_BADGE[user.role.name] || ROLE_BADGE.VIEWER;
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/30",
                        isEven ? "bg-card" : "bg-muted/10"
                      )}
                    >
                      <td className="px-4 py-3 text-center text-muted-foreground">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{user.fullName}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "inline-flex h-6 items-center justify-center rounded-full px-2.5 text-xs font-semibold ring-1",
                            roleBadge
                          )}
                        >
                          {user.role.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {user.department?.name || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              user.isActive ? "bg-emerald-500" : "bg-gray-400"
                            )}
                          />
                          {user.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
                        </span>
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
