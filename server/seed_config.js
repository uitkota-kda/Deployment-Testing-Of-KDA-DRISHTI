const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial configuration...');

  // Check if any config exists
  const existing = await prisma.configVersion.findFirst();
  if (existing) {
    console.log('Configuration already exists. Skipping...');
    return;
  }

  // Create Version 1
  const v1 = await prisma.configVersion.create({
    data: {
      versionNumber: 1,
      createdBy: 1, // Assuming admin user ID is 1
      isActive: true,
      stages: {
        create: [
          { stageKey: 'AF_SANCTION', displayName: 'A&F Sanction', sequenceOrder: 1 },
          { stageKey: 'TECH_SANCTION', displayName: 'Technical Sanction', sequenceOrder: 2 },
          { stageKey: 'NIT_PUBLISHED', displayName: 'NIT Published', sequenceOrder: 3 },
          { stageKey: 'TENDER_OPENED', displayName: 'Tender Opened', sequenceOrder: 4 },
          { stageKey: 'WORK_ORDER', displayName: 'Work Order Issued', sequenceOrder: 5 }
        ]
      }
    }
  });

  // Create Draft (copy of v1)
  await prisma.configVersion.create({
    data: {
      versionNumber: 0,
      createdBy: 1,
      isActive: false,
      stages: {
        create: [
          { stageKey: 'AF_SANCTION', displayName: 'A&F Sanction', sequenceOrder: 1 },
          { stageKey: 'TECH_SANCTION', displayName: 'Technical Sanction', sequenceOrder: 2 },
          { stageKey: 'NIT_PUBLISHED', displayName: 'NIT Published', sequenceOrder: 3 },
          { stageKey: 'TENDER_OPENED', displayName: 'Tender Opened', sequenceOrder: 4 },
          { stageKey: 'WORK_ORDER', displayName: 'Work Order Issued', sequenceOrder: 5 }
        ]
      }
    }
  });

  // Also seed an admin user if not exists
  const admin = await prisma.user.upsert({
    where: { mobile: '9999999999' },
    update: {},
    create: {
      mobile: '9999999999',
      name: 'Super Admin',
      password: 'admin',
      role: 'ADMIN',
      designation: 'Administrator'
    }
  });

  console.log('Seeding complete!', { v1Id: v1.id, adminId: admin.id });
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
