const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.project.count();
  console.log('Project count:', count);
  const projects = await prisma.project.findMany({ take: 5 });
  console.log('Sample projects:', JSON.stringify(projects, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
