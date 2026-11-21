export interface ReportIdentity {
  role: string;
  departmentId?: string | null;
}

export function getReportAccess(user: ReportIdentity | null) {
  if (user?.role === "ADMIN" || user?.role === "SECRETARY") return "all";
  if (user?.role === "DEPARTMENT_EDITOR" && user.departmentId) return "department";
  return null;
}
