const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const mobiles = ['1000000000', '9999999999', '7777777777', '8888888888'];
  const users = await prisma.user.findMany({
    where: { mobile: { in: mobiles } },
    include: {
      _count: {
        select: { updates: true, logs: true, directions: true }
      }
    }
  });
  console.log(JSON.stringify(users, null, 2));
}

check().catch(console.error).finally(() => prisma.$disconnect());
