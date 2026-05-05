const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const projects = await prisma.project.findMany({ include: { workflows: true } });
  console.log('Projects count:', projects.length);
  console.log('Missing Workflows:', projects.filter(p => p.workflows.length === 0).length);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
