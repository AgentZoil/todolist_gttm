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

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SECRETARY: "Thư ký",
  DEPARTMENT_EDITOR: "Phụ trách phòng ban",
  VIEWER: "Người xem",
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    fullName: "",
    password: "",
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
        setIsAdmin(res.data.role === "ADMIN");
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
      setFormData({ email: "", fullName: "", password: "", roleId: "", departmentId: "" });
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
        {isAdmin && (
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
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)} />
          <div className="relative bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg mx-4 ring-1 ring-foreground/5">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <UserPlus className="h-4 w-4 text-primary" />
                </span>
                <h2 className="text-lg font-semibold text-foreground">Thêm người dùng mới</h2>
              </div>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Họ và tên <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="Nguyễn Văn A"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Email <span className="text-destructive">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="nguyenvana@example.com"
                  required
                />
                <p className="text-xs text-muted-foreground">Hệ thống sẽ tự tạo tài khoản đăng nhập cho người dùng này</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Mật khẩu <span className="text-destructive">*</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className={INPUT_CLASS}
                  placeholder="Tối thiểu 6 ký tự"
                  minLength={6}
                  required
                />
                <p className="text-xs text-muted-foreground">Chia sẻ mật khẩu này cho người dùng để đăng nhập lần đầu</p>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  Vai trò <span className="text-destructive">*</span>
                </label>
                <select
                  value={formData.roleId}
                  onChange={(e) => setFormData({ ...formData, roleId: e.target.value, departmentId: "" })}
                  className={INPUT_CLASS}
                  required
                >
                  <option value="">-- Chọn vai trò --</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {ROLE_LABEL[role.name] || role.name}
                    </option>
                  ))}
                </select>
              </div>
              {roles.find((r) => r.id === formData.roleId)?.name === "DEPARTMENT_EDITOR" && (
                <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2 duration-200 fill-mode-both">
                  <label className="block text-sm font-medium text-foreground">
                    Phòng ban <span className="text-destructive">*</span>
                  </label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className={INPUT_CLASS}
                    required
                  >
                    <option value="">-- Chọn phòng ban --</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="gap-1.5">
                  <UserPlus className="h-4 w-4" />
                  Tạo người dùng
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowForm(false)}
                  className="gap-1.5"
                >
                  Hủy
                </Button>
              </div>
            </form>
          </div>
        </div>
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
                          {ROLE_LABEL[user.role.name] || user.role.name}
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
