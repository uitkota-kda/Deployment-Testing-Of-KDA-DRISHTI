const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.project.count()
  .then(c => console.log('Count:', c))
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
