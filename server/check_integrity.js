const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const updates = await prisma.projectUpdate.findMany();
  const users = await prisma.user.findMany();
  const userIds = users.map(u => u.id);

  console.log('Total Users:', users.length);
  console.log('User IDs:', userIds);
  console.log('Total Updates:', updates.length);

  const orphans = updates.filter(u => !userIds.includes(u.userId));
  if (orphans.length > 0) {
    console.log('Found', orphans.length, 'orphan updates pointing to non-existent users:', orphans.map(o => o.userId));
    // Optionally delete them
    // await prisma.projectUpdate.deleteMany({ where: { userId: { notIn: userIds } } });
  } else {
    console.log('No orphan updates found.');
  }
  process.exit(0);
}

check();
