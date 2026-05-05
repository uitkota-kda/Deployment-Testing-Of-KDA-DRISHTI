const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const p = await prisma.project.findFirst({
      where: { name: { contains: 'Ramashray Bhawan' } },
      include: { pertActivities: true }
    });
    console.log(JSON.stringify(p, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

check();
