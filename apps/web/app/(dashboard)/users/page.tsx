"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, AlertTriangle, Check, Copy, RefreshCw, Trash2, UserRoundCheck, UserRoundX } from "lucide-react";
import { cn } from "@/lib/utils";

interface Role {
  id: string;
  name: string;
}

interface Department {
  id: string;
  code: string;
  name: string;
  isActive?: boolean;
}

interface User {
  id: string;
  fullName: string;
  isActive: boolean;
  role: Role;
  department?: Department | null;
}

interface RegistrationRequest {
  id: string;
  email: string;
  fullName: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  passwordReady: boolean;
  rejectionReason?: string | null;
  createdAt: string;
  reviewer?: { id: string; fullName: string } | null;
}

interface PasswordResetRequest {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  user: { fullName: string; email: string | null; isActive: boolean };
}

interface PendingActionBanner {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  requiresReason?: boolean;
  onConfirm: (reason: string) => void;
}

const ROLE_BADGE: Record<string, string> = {
  ADMIN: "bg-primary/10 text-primary ring-primary/20",
  SECRETARY: "bg-secondary/10 text-secondary ring-secondary/20",
  LEADER: "bg-amber-50 text-amber-700 ring-amber-200",
  DEPARTMENT_EDITOR: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  VIEWER: "bg-muted text-muted-foreground ring-border",
};

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  SECRETARY: "Thư ký",
  LEADER: "Lãnh đạo",
  DEPARTMENT_EDITOR: "Phụ trách phòng ban/đơn vị",
  VIEWER: "Người xem",
};

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingActionBanner | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([]);
  const [registrationRequestsLoading, setRegistrationRequestsLoading] = useState(true);
  const [registrationRequestsError, setRegistrationRequestsError] = useState<string | null>(null);
  const [passwordResetRequests, setPasswordResetRequests] = useState<PasswordResetRequest[]>([]);
  const [passwordResetRequestsLoading, setPasswordResetRequestsLoading] = useState(true);
  const [passwordResetRequestsError, setPasswordResetRequestsError] = useState<string | null>(null);
  const [approvalRoles, setApprovalRoles] = useState<Record<string, string>>({});
  const [approvalDepartments, setApprovalDepartments] = useState<Record<string, string>>({});
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [passwordResetLink, setPasswordResetLink] = useState<{ fullName: string; email: string; link: string } | null>(null);
  const [passwordResetLinkCopied, setPasswordResetLinkCopied] = useState(false);
  const [userDrafts, setUserDrafts] = useState<Record<string, { roleId: string; departmentId: string }>>({});
  const [processingUser, setProcessingUser] = useState<string | null>(null);

  const refreshRegistrationRequests = useCallback(async () => {
    setRegistrationRequestsLoading(true);
    setRegistrationRequestsError(null);
    try {
      const res = await apiFetch<{ data: RegistrationRequest[] }>("/users/registration-requests");
      setRegistrationRequests(res.data);
    } catch {
      setRegistrationRequestsError("Chưa tải được yêu cầu đăng ký. Vui lòng thử làm mới lại.");
    } finally {
      setRegistrationRequestsLoading(false);
    }
  }, []);

  const refreshPasswordResetRequests = useCallback(async () => {
    setPasswordResetRequestsLoading(true);
    setPasswordResetRequestsError(null);
    try {
      const res = await apiFetch<{ data: PasswordResetRequest[] }>('/users/password-reset-requests');
      setPasswordResetRequests(res.data);
    } catch {
      setPasswordResetRequestsError('Chưa tải được yêu cầu đặt lại mật khẩu. Vui lòng thử làm mới lại.');
    } finally {
      setPasswordResetRequestsLoading(false);
    }
  }, []);

  useEffect(() => {
    apiFetch<{ data: { id: string; role: string } }>("/auth/me")
      .then((res) => {
        setCurrentUserId(res.data.id);
        if (!["ADMIN", "SECRETARY"].includes(res.data.role)) {
          router.replace("/dashboard");
          return;
        }
        setIsAdmin(res.data.role === "ADMIN");
        if (res.data.role === "ADMIN") {
          void refreshRegistrationRequests();
          void refreshPasswordResetRequests();
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
  }, [router, refreshPasswordResetRequests, refreshRegistrationRequests]);

  useEffect(() => {
    if (!isAdmin) return;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshRegistrationRequests();
        void refreshPasswordResetRequests();
      }
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [isAdmin, refreshPasswordResetRequests, refreshRegistrationRequests]);

  const approveRequest = (request: RegistrationRequest) => {
    const roleId = approvalRoles[request.id];
    const role = roles.find((item) => item.id === roleId);
    if (!roleId) return;
    if (role?.name === "DEPARTMENT_EDITOR" && !approvalDepartments[request.id]) {
      setError("Cần chọn phòng ban cho tài khoản phòng ban");
      return;
    }
    if (!request.passwordReady) {
      setError("Yêu cầu cũ chưa có mật khẩu. Hãy từ chối yêu cầu này và nhờ người đăng ký gửi lại.");
      return;
    }
    const departmentId = approvalDepartments[request.id] || undefined;
    setPendingAction({
      title: "Xác nhận duyệt tài khoản",
      description: "Hãy chắc chắn bạn đã xác minh người đăng ký qua kênh tin cậy. Email chưa được xác minh tự động.",
      confirmLabel: "Duyệt tài khoản",
      onConfirm: () => void executeApproveRequest(request, roleId, departmentId),
    });
    setActionReason("");
  };

  const executeApproveRequest = async (request: RegistrationRequest, roleId: string, departmentId?: string) => {
    setProcessingRequest(request.id);
    try {
      await apiFetch<{ data: User }>(`/users/registration-requests/${request.id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({
          roleId,
          departmentId,
        }),
      });
      await Promise.all([
        refreshRegistrationRequests(),
        apiFetch<{ data: User[] }>("/users").then((res) => setUsers(res.data)),
      ]);
    } catch (err) {
      setError("Lỗi duyệt yêu cầu: " + (err instanceof Error ? err.message : "Vui lòng thử lại."));
    } finally {
      setProcessingRequest(null);
    }
  };

  const approvePasswordReset = (request: PasswordResetRequest) => {
    if (!request.user.email) {
      setError("Tài khoản thiếu email. Vui lòng báo quản trị viên kiểm tra.");
      return;
    }
    setPendingAction({
      title: "Xác nhận đặt lại mật khẩu",
      description: "Chỉ duyệt sau khi đã xác minh đúng chủ tài khoản. Liên kết tạo ra cần được gửi riêng cho họ qua kênh tin cậy.",
      confirmLabel: "Duyệt và tạo liên kết",
      onConfirm: () => void executeApprovePasswordReset(request),
    });
    setActionReason("");
  };

  const executeApprovePasswordReset = async (request: PasswordResetRequest) => {
    setProcessingRequest(request.id);
    try {
      const response = await apiFetch<{ data: { fullName: string; email: string; passwordResetLink: string } }>(`/users/password-reset-requests/${request.id}/approve`, {
        method: "PATCH",
      });
      setPasswordResetLink({
        fullName: response.data.fullName,
        email: response.data.email,
        link: response.data.passwordResetLink,
      });
      setPasswordResetLinkCopied(false);
      await refreshPasswordResetRequests();
    } catch (err) {
      setError("Lỗi duyệt yêu cầu đặt lại mật khẩu: " + (err instanceof Error ? err.message : "Vui lòng thử lại."));
    } finally {
      setProcessingRequest(null);
    }
  };

  const rejectPasswordReset = (request: PasswordResetRequest) => {
    setPendingAction({
      title: "Từ chối yêu cầu đặt lại mật khẩu?",
      description: `Yêu cầu của ${request.user.fullName} sẽ bị từ chối.`,
      confirmLabel: "Từ chối yêu cầu",
      destructive: true,
      onConfirm: () => void executeRejectPasswordReset(request),
    });
    setActionReason("");
  };

  const executeRejectPasswordReset = async (request: PasswordResetRequest) => {
    setProcessingRequest(request.id);
    try {
      await apiFetch(`/users/password-reset-requests/${request.id}/reject`, {
        method: "PATCH",
      });
      await refreshPasswordResetRequests();
    } catch (err) {
      setError("Lỗi từ chối yêu cầu đặt lại mật khẩu: " + (err instanceof Error ? err.message : "Vui lòng thử lại."));
    } finally {
      setProcessingRequest(null);
    }
  };

  const rejectRequest = (request: RegistrationRequest) => {
    setActionReason("");
    setPendingAction({
      title: "Từ chối yêu cầu đăng ký?",
      description: `Yêu cầu của ${request.fullName} sẽ bị từ chối. Có thể ghi lý do để người đăng ký biết cần làm gì tiếp theo.`,
      confirmLabel: "Từ chối yêu cầu",
      destructive: true,
      requiresReason: true,
      onConfirm: (reason) => void executeRejectRequest(request, reason),
    });
  };

  const executeRejectRequest = async (request: RegistrationRequest, reason: string) => {
    setProcessingRequest(request.id);
    try {
      await apiFetch(`/users/registration-requests/${request.id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });
      await refreshRegistrationRequests();
    } catch (err) {
      setError("Lỗi từ chối yêu cầu: " + (err instanceof Error ? err.message : "Vui lòng thử lại."));
    } finally {
      setProcessingRequest(null);
    }
  };

  const updateUser = async (user: User, changes: { roleId?: string; departmentId?: string | null }) => {
    setProcessingUser(user.id);
    setError(null);
    try {
      const response = await apiFetch<{ data: User }>(`/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      });
      setUsers((current) => current.map((item) => item.id === user.id ? response.data : item));
      setUserDrafts((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể cập nhật tài khoản");
    } finally {
      setProcessingUser(null);
    }
  };

  const deleteUserAccount = (user: User) => {
    setPendingAction({
      title: `Xóa tài khoản ${user.fullName}?`,
      description: "Tài khoản sẽ bị xóa hẳn và không thể khôi phục. Nếu còn nhiệm vụ, phản hồi hoặc kỳ khóa liên quan, hệ thống sẽ giữ tài khoản lại.",
      confirmLabel: "Xóa tài khoản",
      destructive: true,
      onConfirm: () => void executeDeleteUserAccount(user),
    });
    setActionReason("");
  };

  const executeDeleteUserAccount = async (user: User) => {
    setProcessingUser(user.id);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetch<{ data: { id: string; fullName: string; authCleanupPending: boolean } }>(`/users/${user.id}`, {
        method: "DELETE",
      });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setUserDrafts((current) => {
        const next = { ...current };
        delete next[user.id];
        return next;
      });
      setNotice(response.data.authCleanupPending
        ? `Đã xóa hồ sơ ${response.data.fullName}. Hệ thống đang tự hoàn tất xóa thông tin đăng nhập.`
        : `Đã xóa tài khoản ${response.data.fullName}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa tài khoản");
      await apiFetch<{ data: User[] }>("/users")
        .then((response) => setUsers(response.data))
        .catch(() => undefined);
    } finally {
      setProcessingUser(null);
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

  const pendingRequests = registrationRequests.filter((request) => request.status === "PENDING");
  const pendingPasswordResetRequests = passwordResetRequests.filter((request) => request.status === "PENDING");

  return (
    <div className="space-y-6">
      {pendingAction && (
        <section
          aria-label="Xác nhận thao tác"
          className="fixed left-1/2 top-4 z-[110] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-amber-200 bg-white shadow-xl ring-1 ring-black/5"
        >
          <div className="flex gap-3 p-4 sm:p-5">
            <div className={cn(
              "mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              pendingAction.destructive ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600",
            )}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-foreground">{pendingAction.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{pendingAction.description}</p>
              {pendingAction.requiresReason && (
                <label className="mt-3 block text-sm font-medium text-foreground">
                  Lý do từ chối <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
                  <textarea
                    value={actionReason}
                    onChange={(event) => setActionReason(event.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Nhập lý do để người đăng ký biết cần làm gì tiếp theo..."
                    className="mt-1.5 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              )}
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setPendingAction(null); setActionReason(""); }}
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant={pendingAction.destructive ? "destructive" : "default"}
                  onClick={() => {
                    const action = pendingAction;
                    setPendingAction(null);
                    setActionReason("");
                    setError(null);
                    action.onConfirm(actionReason.trim());
                  }}
                >
                  {pendingAction.confirmLabel}
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className={cn(
            "fixed left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-800 shadow-lg",
            pendingAction ? "top-36" : "top-4",
          )}
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <p className="flex-1 text-sm">{error}</p>
          <Button variant="outline" size="sm" onClick={() => setError(null)}>Đóng</Button>
        </div>
      )}
      {notice && (
        <div
          role="status"
          aria-live="polite"
          className="fixed left-1/2 top-4 z-[100] flex w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 shadow-lg"
        >
          <Check className="h-5 w-5 shrink-0 text-emerald-600" />
          <p className="flex-1 text-sm">{notice}</p>
          <Button variant="outline" size="sm" onClick={() => setNotice(null)}>Đóng</Button>
        </div>
      )}
      {passwordResetLink && (
        <Card className="border-emerald-200">
          <CardContent className="space-y-3 py-4">
            <div>
              <h2 className="font-semibold text-foreground">Đã duyệt đặt lại mật khẩu cho {passwordResetLink.fullName} ({passwordResetLink.email})</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Không gửi email. Gửi riêng liên kết cho đúng người qua kênh tin cậy; ai có liên kết đều có thể đặt mật khẩu.
              </p>
            </div>
            <p className="max-h-24 select-all overflow-y-auto break-all rounded-lg bg-muted p-3 font-mono text-xs">{passwordResetLink.link}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => {
                void navigator.clipboard.writeText(passwordResetLink.link)
                  .then(() => setPasswordResetLinkCopied(true))
                  .catch(() => setError("Không sao chép được liên kết. Hãy chọn liên kết rồi sao chép thủ công."));
              }}>
                {passwordResetLinkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {passwordResetLinkCopied ? "Đã sao chép" : "Sao chép liên kết"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPasswordResetLink(null)}>Ẩn liên kết</Button>
              <span className="text-xs text-muted-foreground">Liên kết có hạn và chỉ dùng một lần.</span>
            </div>
          </CardContent>
        </Card>
      )}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Người dùng</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quản lý {users.length} người dùng
          </p>
        </div>
      </div>

      {isAdmin && (
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <UserRoundCheck className="h-4 w-4 text-primary" />
                Yêu cầu đăng ký chờ duyệt
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Người đăng ký đã chọn mật khẩu. Email không được xác minh tự động; chỉ duyệt sau khi xác minh đúng người qua kênh tin cậy.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void refreshRegistrationRequests()} disabled={registrationRequestsLoading}>
                <RefreshCw className={cn("h-4 w-4", registrationRequestsLoading && "animate-spin")} />
                Làm mới
              </Button>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {pendingRequests.length}
              </span>
            </div>
          </div>
          {registrationRequestsError && (
            <CardContent className="pb-0 text-sm text-destructive" role="alert">{registrationRequestsError}</CardContent>
          )}
          {registrationRequestsLoading && pendingRequests.length === 0 ? (
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Đang tải yêu cầu đăng ký...</CardContent>
          ) : pendingRequests.length === 0 ? (
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Chưa có yêu cầu chờ duyệt. Nếu vừa đăng ký, hãy bấm “Làm mới”.
            </CardContent>
          ) : (
            <div className="divide-y divide-border">
              {pendingRequests.map((request) => {
                const selectedRoleId = approvalRoles[request.id] || "";
                const selectedRole = roles.find((role) => role.id === selectedRoleId)?.name;
                const busy = processingRequest === request.id;
                return (
                  <div key={request.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{request.fullName}</p>
              <p className="text-sm text-muted-foreground">{request.email}</p>
                      {!request.passwordReady && <p className="mt-1 text-xs text-amber-700">Yêu cầu cũ chưa có mật khẩu; cần đăng ký lại.</p>}
                      <p className="mt-1 text-xs text-muted-foreground">Gửi lúc {new Date(request.createdAt).toLocaleString("vi-VN")}</p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <select
                        value={selectedRoleId}
                        onChange={(event) => setApprovalRoles({ ...approvalRoles, [request.id]: event.target.value })}
                        className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
                        disabled={busy}
                      >
                        <option value="">Chọn vai trò</option>
                        {roles.map((role) => <option key={role.id} value={role.id}>{ROLE_LABEL[role.name] || role.name}</option>)}
                      </select>
                      {selectedRole === "DEPARTMENT_EDITOR" && (
                        <select
                          value={approvalDepartments[request.id] || ""}
                          onChange={(event) => setApprovalDepartments({ ...approvalDepartments, [request.id]: event.target.value })}
                          className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
                          disabled={busy}
                        >
                          <option value="">Chọn phòng ban</option>
                          {departments.filter((department) => department.isActive !== false).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                        </select>
                      )}
                      <Button size="sm" onClick={() => void approveRequest(request)} disabled={busy || !selectedRoleId || !request.passwordReady}>
                        {busy ? "Đang xử lý..." : <><Check className="h-4 w-4" />Duyệt</>}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void rejectRequest(request)} disabled={busy}>
                        <UserRoundX className="h-4 w-4" />Từ chối
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {isAdmin && (
        <Card>
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <UserRoundCheck className="h-4 w-4 text-primary" />
                Yêu cầu đặt lại mật khẩu
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">Ứng dụng không gửi email. Xác minh đúng chủ tài khoản qua kênh tin cậy; khi duyệt, hãy gửi riêng liên kết một lần để họ tự đặt mật khẩu.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void refreshPasswordResetRequests()} disabled={passwordResetRequestsLoading}>
                <RefreshCw className={cn("h-4 w-4", passwordResetRequestsLoading && "animate-spin")} />
                Làm mới
              </Button>
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                {pendingPasswordResetRequests.length}
              </span>
            </div>
          </div>
          {passwordResetRequestsError && (
            <CardContent className="pb-0 text-sm text-destructive" role="alert">{passwordResetRequestsError}</CardContent>
          )}
          {passwordResetRequestsLoading && pendingPasswordResetRequests.length === 0 ? (
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Đang tải yêu cầu...</CardContent>
          ) : pendingPasswordResetRequests.length === 0 ? (
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Chưa có yêu cầu chờ duyệt.</CardContent>
          ) : (
            <div className="divide-y divide-border">
              {pendingPasswordResetRequests.map((request) => {
                const busy = processingRequest === request.id;
                return (
                  <div key={request.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">{request.user.fullName}</p>
                      <p className="text-sm text-muted-foreground">{request.user.email || "Tài khoản thiếu email"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Gửi lúc {new Date(request.createdAt).toLocaleString("vi-VN")}</p>
                      {!request.user.isActive && <p className="mt-1 text-xs text-destructive">Tài khoản đã ngừng hoạt động.</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void approvePasswordReset(request)} disabled={busy || !request.user.email || !request.user.isActive}>
                        {busy ? "Đang xử lý..." : <><Check className="h-4 w-4" />Duyệt và tạo link</>}
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => void rejectPasswordReset(request)} disabled={busy}>
                        <UserRoundX className="h-4 w-4" />Từ chối
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                  Phòng ban/Đơn vị
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Trạng thái
                </th>
                {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quản lý</th>}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 6 : 5}
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
                  const isCurrentUser = user.id === currentUserId;
                  const roleBadge =
                    ROLE_BADGE[user.role.name] || ROLE_BADGE.VIEWER;
                  const draft = userDrafts[user.id] || {
                    roleId: user.role.id,
                    departmentId: user.department?.id || "",
                  };
                  const draftRole = roles.find((role) => role.id === draft.roleId)?.name;
                  const busy = processingUser === user.id;
                  return (
                    <tr
                      key={user.id}
                      aria-current={isCurrentUser ? "true" : undefined}
                      className={cn(
                        "border-b border-border/50 transition-colors hover:bg-muted/30",
                        isCurrentUser ? "bg-primary/5" : isEven ? "bg-card" : "bg-muted/10"
                      )}
                    >
                      <td className={cn("px-4 py-3 text-center text-muted-foreground", isCurrentUser && "border-l-4 border-primary")}>
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{user.fullName}</span>
                          {isCurrentUser && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                              <Check className="h-3 w-3" aria-hidden="true" />
                              Đang đăng nhập
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin ? (
                          <select
                            aria-label={`Vai trò của ${user.fullName}`}
                            value={draft.roleId}
                            onChange={(event) => setUserDrafts({ ...userDrafts, [user.id]: { ...draft, roleId: event.target.value } })}
                            className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
                            disabled={busy}
                          >
                            {roles.map((role) => <option key={role.id} value={role.id}>{ROLE_LABEL[role.name] || role.name}</option>)}
                          </select>
                        ) : (
                          <span className={cn("inline-flex h-6 items-center justify-center rounded-full px-2.5 text-xs font-semibold ring-1", roleBadge)}>
                            {ROLE_LABEL[user.role.name] || user.role.name}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isAdmin && draftRole === "DEPARTMENT_EDITOR" ? (
                          <select
                            aria-label={`Phòng ban của ${user.fullName}`}
                            value={draft.departmentId}
                            onChange={(event) => setUserDrafts({ ...userDrafts, [user.id]: { ...draft, departmentId: event.target.value } })}
                            className="h-9 rounded-lg border border-border bg-card px-3 text-sm"
                            disabled={busy}
                          >
                            <option value="">Chọn phòng ban</option>
                            {departments.filter((department) => department.isActive !== false).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
                          </select>
                        ) : user.department?.name || "—"}
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
                      {isAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy || (draft.roleId === user.role.id && (draftRole !== "DEPARTMENT_EDITOR" || draft.departmentId === (user.department?.id || "")))}
                              onClick={() => void updateUser(user, {
                                roleId: draft.roleId,
                                departmentId: draftRole === "DEPARTMENT_EDITOR" ? draft.departmentId : null,
                              })}
                            >
                              {busy ? "Đang lưu..." : "Lưu"}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={busy || isCurrentUser}
                              title={isCurrentUser ? "Không thể xóa tài khoản đang đăng nhập" : undefined}
                              onClick={() => void deleteUserAccount(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                              {busy ? "Đang xử lý..." : "Xóa"}
                            </Button>
                          </div>
                        </td>
                      )}
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
