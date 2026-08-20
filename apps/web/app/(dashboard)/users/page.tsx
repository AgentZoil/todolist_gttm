"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

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

export default function UsersPage() {
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
    Promise.all([
      apiFetch<{ data: User[] }>("/users"),
      apiFetch<{ data: Role[] }>("/auth/roles"),
      apiFetch<{ data: Department[] }>("/departments"),
    ])
      .then(([usersRes, rolesRes, deptsRes]) => {
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
      <div>
        <h1 className="text-2xl font-bold text-foreground">Người dùng</h1>
        <p className="text-muted-foreground mt-2">Đang tải...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-foreground">Người dùng</h1>
        <p className="text-destructive mt-2">Lỗi: {error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Người dùng</h1>
          <p className="text-muted-foreground mt-2">
            Quản lý {users.length} người dùng
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
        >
          {showForm ? "Đóng" : "Thêm người dùng"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mt-4 p-4 border border-border rounded-lg bg-card">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Auth User ID (từ Supabase)
              </label>
              <input
                type="text"
                value={formData.authUserId}
                onChange={(e) => setFormData({ ...formData, authUserId: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Họ tên
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Vai trò
              </label>
              <select
                value={formData.roleId}
                onChange={(e) => setFormData({ ...formData, roleId: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-2 text-sm"
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
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Phòng ban
              </label>
              <select
                value={formData.departmentId}
                onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                className="w-full border border-border rounded-md px-3 py-2 text-sm"
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
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-primary/90"
            >
              Tạo
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md text-sm font-medium hover:bg-secondary/90"
            >
              Hủy
            </button>
          </div>
        </form>
      )}

      <div className="mt-6 rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="text-left p-3 font-medium text-muted-foreground">STT</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Họ tên</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Vai trò</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Phòng ban</th>
              <th className="text-left p-3 font-medium text-muted-foreground">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, index) => (
              <tr key={user.id} className="border-t border-border hover:bg-muted/50">
                <td className="p-3">{index + 1}</td>
                <td className="p-3">{user.fullName}</td>
                <td className="p-3">
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                    {user.role.name}
                  </span>
                </td>
                <td className="p-3">{user.department.name}</td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      user.isActive
                        ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {user.isActive ? "Đang hoạt động" : "Ngừng hoạt động"}
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
