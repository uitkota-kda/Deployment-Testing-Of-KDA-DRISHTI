const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Users:', users);
  
  const projects = await prisma.project.findMany();
  console.log('Projects count:', projects.length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
