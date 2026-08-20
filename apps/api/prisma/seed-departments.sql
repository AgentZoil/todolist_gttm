-- Seed Roles
INSERT INTO roles (id, name, description) VALUES
  ('c57853e5-02a6-4dbb-82f9-f0af804c085f', 'ADMIN', 'Quản trị viên tối cao'),
  ('159f7327-8844-48f2-9590-0d1a2b2af78d', 'DEPARTMENT_EDITOR', 'Phòng ban - Chỉnh sửa nhiệm vụ'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'SECRETARY', 'Thư ký / Người giao nhiệm vụ'),
  ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'VIEWER', 'Chỉ xem')
ON CONFLICT (name) DO NOTHING;

-- Seed 22 Departments
INSERT INTO departments (id, code, name) VALUES
  ('d0100000-0000-0000-0000-000000000001', 'VPC', 'Văn phòng cục'),
  ('d0100000-0000-0000-0000-000000000002', 'P_TOCHUC', 'Phòng Tổ chức cán bộ'),
  ('d0100000-0000-0000-0000-000000000003', 'P_KHCN', 'Phòng KHCN, MT & HTQT'),
  ('d0100000-0000-0000-0000-000000000004', 'P_KHTC', 'Phòng Kế hoạch - Tài chính'),
  ('d0100000-0000-0000-0000-000000000005', 'P_DAUTU', 'Phòng Quản lý đầu tư công tư'),
  ('d0100000-0000-0000-0000-000000000006', 'P_GIAOTHONG', 'Phòng Quản lý, tổ chức giao thông'),
  ('d0100000-0000-0000-0000-000000000007', 'P_BAOTRI', 'Phòng Quản lý bảo trì'),
  ('d0100000-0000-0000-0000-000000000008', 'P_VANTAI', 'Phòng Quản lý vận tải'),
  ('d0100000-0000-0000-0000-000000000009', 'P_PHAPCHE', 'Phòng Pháp chế đấu thầu'),
  ('d0100000-0000-0000-0000-000000000010', 'P_THAMDINH', 'Phòng Thẩm Định'),
  ('d0100000-0000-0000-0000-000000000011', 'P_CHATLUONG', 'Phòng Quản lý chất lượng'),
  ('d0100000-0000-0000-0000-000000000012', 'VP_DANGUY', 'Văn phòng Đảng ủy'),
  ('d0100000-0000-0000-0000-000000000013', 'KQLDB_I', 'Khu Quản lý đường bộ I'),
  ('d0100000-0000-0000-0000-000000000014', 'KQLDB_II', 'Khu Quản lý đường bộ II'),
  ('d0100000-0000-0000-0000-000000000015', 'KQLDB_III', 'Khu Quản lý đường bộ III'),
  ('d0100000-0000-0000-0000-000000000016', 'KQLDB_IV', 'Khu Quản lý đường bộ IV'),
  ('d0100000-0000-0000-0000-000000000017', 'BQLDA_MB', 'Ban QLDA miền Bắc'),
  ('d0100000-0000-0000-0000-000000000018', 'BQLDA_MT', 'Ban QLDA miền Trung'),
  ('d0100000-0000-0000-0000-000000000019', 'BQLDA_MN', 'Ban QLDA miền Nam'),
  ('d0100000-0000-0000-0000-000000000020', 'TT_MB', 'Trung tâm KT & CNĐB phía Bắc'),
  ('d0100000-0000-0000-0000-000000000021', 'TT_MN', 'Trung tâm KT & CNĐB phía Nam'),
  ('d0100000-0000-0000-0000-000000000022', 'TRUONG_CĐ', 'Trường CĐ Công nghệ GTVT')
ON CONFLICT (code) DO NOTHING;

SELECT 'Roles: ' || count(*) FROM roles;
SELECT 'Departments: ' || count(*) FROM departments;
