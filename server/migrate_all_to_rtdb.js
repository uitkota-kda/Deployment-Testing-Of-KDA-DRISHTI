const { PrismaClient } = require('@prisma/client');
const { rtdb } = require('./firebase');
const prisma = new PrismaClient();

async function migrate() {
  console.log('🚀 Starting Full Migration from SQLite to Realtime Database...');
  
  try {
    const rootRef = rtdb.ref();

    // 1. Migrate Users
    console.log('👥 Migrating Users...');
    const users = await prisma.user.findMany();
    for (const user of users) {
      await rootRef.child('users').child(user.id.toString()).set(user);
    }

    // 2. Migrate Projects
    console.log('🏗️ Migrating Projects...');
    const projects = await prisma.project.findMany();
    for (const project of projects) {
      await rootRef.child('projects').child(project.id.toString()).set(project);
    }

    // 3. Migrate Workflows
    console.log('🔄 Migrating Workflows...');
    const workflows = await prisma.projectWorkflow.findMany();
    for (const w of workflows) {
      await rootRef.child('workflows').child(w.id.toString()).set(w);
    }

    // 4. Migrate PERT Activities
    console.log('📊 Migrating PERT Activities...');
    const perts = await prisma.pertActivity.findMany();
    for (const p of perts) {
      await rootRef.child('pertActivities').child(p.id.toString()).set(p);
    }

    // 5. Migrate Updates
    console.log('📸 Migrating Project Updates...');
    const updates = await prisma.projectUpdate.findMany();
    for (const u of updates) {
      await rootRef.child('updates').child(u.id.toString()).set(u);
    }

    // 6. Migrate Directions
    console.log('📣 Migrating Directions...');
    const directions = await prisma.projectDirection.findMany();
    for (const d of directions) {
      await rootRef.child('directions').child(d.id.toString()).set(d);
    }

    // 7. Migrate Audit Logs
    console.log('📜 Migrating Audit Logs...');
    const logs = await prisma.auditLog.findMany();
    for (const log of logs) {
      await rootRef.child('auditLogs').child(log.id.toString()).set(log);
    }

    // 8. Migrate Config Versions
    console.log('⚙️ Migrating Config Versions...');
    const configs = await prisma.configVersion.findMany();
    for (const c of configs) {
      await rootRef.child('configVersions').child(c.id.toString()).set(c);
    }

    // 9. Migrate Stages & Fields
    console.log('📑 Migrating Stages & Fields...');
    const stages = await prisma.projectStage.findMany();
    for (const s of stages) {
      await rootRef.child('projectStages').child(s.id.toString()).set(s);
    }
    const fields = await prisma.projectField.findMany();
    for (const f of fields) {
      await rootRef.child('projectFields').child(f.id.toString()).set(f);
    }

    console.log('✅ All data migrated successfully to Realtime Database!');
    console.log('🔗 Database URL: https://kda-drishti-default-rtdb.firebaseio.com/');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit();
  }
}

migrate();
