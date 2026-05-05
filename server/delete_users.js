const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function deleteUsers() {
  const mobiles = ['1000000000', '9999999999', '7777777777', '8888888888'];
  const result = await prisma.user.updateMany({
    where: { mobile: { in: mobiles } },
    data: { isDeleted: true }
  });
  console.log('Soft deleted users:', result);
}

deleteUsers().catch(console.error).finally(() => prisma.$disconnect());
