import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create 5 roles
  const roles = await Promise.all([
    prisma.role.upsert({
      where: { name: 'ADMIN' },
      update: {},
      create: { name: 'ADMIN', description: 'Quản trị viên tối cao' },
    }),
    prisma.role.upsert({
      where: { name: 'SECRETARY' },
      update: {},
      create: { name: 'SECRETARY', description: 'Thư ký / Người giao nhiệm vụ' },
    }),
    prisma.role.upsert({
      where: { name: 'LEADER' },
      update: {},
      create: { name: 'LEADER', description: 'Lãnh đạo / Người duyệt nhiệm vụ' },
    }),
    prisma.role.upsert({
      where: { name: 'DEPARTMENT_EDITOR' },
      update: {},
      create: { name: 'DEPARTMENT_EDITOR', description: 'Phòng ban - Chỉnh sửa nhiệm vụ' },
    }),
    prisma.role.upsert({
      where: { name: 'VIEWER' },
      update: {},
      create: { name: 'VIEWER', description: 'Chỉ xem' },
    }),
  ]);
  console.log('Roles created:', roles.map((r) => r.name).join(', '));

  // Create admin user (auth_user_id = 'admin-test' for dev only)
  const adminUser = await prisma.user.upsert({
    where: { authUserId: 'admin-test' },
    update: {},
    create: {
      authUserId: 'admin-test',
      fullName: 'Admin User',
      roleId: roles.find((r) => r.name === 'ADMIN')!.id,
      departmentId: null,
    },
  });
  console.log('Admin user created:', adminUser.fullName);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
