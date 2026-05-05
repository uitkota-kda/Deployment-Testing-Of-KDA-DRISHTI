const { PrismaClient } = require('@prisma/client');
const { db } = require('./firebase');
const prisma = new PrismaClient();

async function migrate() {
  console.log('🔄 Starting migration to Firestore...');
  
  try {
    const users = await prisma.user.findMany({ where: { isDeleted: false } });
    console.log(`Found ${users.length} users in Prisma.`);

    for (const user of users) {
      await db.collection('users').doc(user.mobile).set({
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        password: user.password,
        role: user.role,
        designation: user.designation,
        isDeleted: false,
        migratedAt: new Date()
      });
      console.log(`✅ Migrated user: ${user.name} (${user.mobile})`);
    }

    console.log('🎉 Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migrate();
