export interface CurrentUser {
  id: string;
  authUserId: string;
  email: string;
  fullName: string;
  roleId: string;
  departmentId: string | null;
  role: string;
  isActive: boolean;
}
