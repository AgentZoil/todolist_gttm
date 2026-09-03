import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Checking tasks in database...\n');

  const tasks = await prisma.task.findMany({
    include: {
      ownerDepartment: true,
      creator: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📋 Found ${tasks.length} tasks:\n`);

  tasks.forEach((task, index) => {
    console.log(`${index + 1}. ${task.title}`);
    console.log(`   ID: ${task.id}`);
    console.log(`   Phòng ban: ${task.ownerDepartment.name}`);
    console.log(`   Người tạo: ${task.creator.fullName}`);
    console.log(`   Ngày giao: ${task.assignedDate}`);
    console.log(`   Ngày YC hoàn thành: ${task.requiredCompletionDate || 'Không có'}`);
    console.log('');
  });

  const departments = await prisma.department.findMany();
  console.log(`\n🏛️  Departments:`);
  departments.forEach(dept => {
    console.log(`   - ${dept.name} (${dept.code})`);
  });
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
