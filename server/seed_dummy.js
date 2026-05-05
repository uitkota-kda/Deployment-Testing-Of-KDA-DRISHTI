const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) throw new Error("Seed users first");

  // Project A: Highway (Execution) - On Track
  const pA = await prisma.project.create({
    data: {
      name: "High Priority Highway Phase 1",
      type: "EXECUTION",
      brief: "Construction of 4-lane highway connecting north and south corridor.",
      fundingAgency: "State Government",
      estimatedCost: 1500,
      inchargeName: "Ramesh Engineer",
      inchargeMobile: "9000000001",
      contractorName: "L&T Construction",
      contractorMobile: "9000000002",
      actualStartDate: new Date("2025-01-10"),
      stipulatedCompletionDate: new Date("2026-12-31"),
      expectedCompletionDate: new Date("2026-11-30"),
      overallStatus: "On Track",
      todaysUpdateNote: "Earthwork completed for 10km stretch. Base layer laying in progress.",
      currentProgress: 35.5,
      status: "ONGOING",
      timeExtension: "No",
      workflows: {
        create: [
          { stepName: 'A&F Received', isCompleted: true, date: new Date("2024-11-01") },
          { stepName: 'Technical Sanction', isCompleted: true, date: new Date("2024-11-15") },
          { stepName: 'Tender Processed', isCompleted: true, date: new Date("2024-12-10") },
          { stepName: 'Work Order Issued', isCompleted: true, date: new Date("2025-01-05") },
        ]
      },
      pertActivities: {
        create: [
          { name: 'Earthwork', weightage: 40, progress: 80, startDate: new Date("2025-01-15"), endDate: new Date("2025-06-30") },
          { name: 'Paving', weightage: 60, progress: 5.8, startDate: new Date("2025-07-01"), endDate: new Date("2026-10-31") },
        ]
      },
      updates: {
        create: {
          userId: adminUser.id,
          physicalProgress: 35.5,
          financialProgress: 30,
          gpsLat: 25.18,
          gpsLong: 75.83,
          photos: JSON.stringify(["highway_work.jpg", "base_layer.jpg"]),
          remarks: "Progressing well ahead of schedule.",
          overallStatus: "On Track",
          todaysUpdateNote: "Earthwork completed for 10km stretch. Base layer laying in progress.",
          expectedCompletionDate: new Date("2026-11-30"),
          timeExtension: "No"
        }
      }
    }
  });

  // Project B: Water Plant (Execution) - Delay
  const pB = await prisma.project.create({
    data: {
      name: "City Water Treatment Plant",
      type: "EXECUTION",
      brief: "100 MLD Water Treatment Plant for Eastern Grid.",
      fundingAgency: "Central Gov (AMRUT)",
      estimatedCost: 800,
      inchargeName: "Suresh Gupta",
      inchargeMobile: "9000000003",
      actualStartDate: new Date("2025-03-01"),
      stipulatedCompletionDate: new Date("2026-06-30"),
      expectedCompletionDate: new Date("2027-01-15"),
      overallStatus: "Delay",
      statusDelayReasons: JSON.stringify(["Land Acquisition", "NOC (Forest/Pollution/Other)"]),
      statusDelayBrief: "Awaiting environmental clearance and farmers are protesting for higher compensation.",
      todaysUpdateNote: "Work halted at site. Only boundary wall construction is partially active.",
      currentProgress: 12.0,
      status: "ONGOING",
      timeExtension: "Yes",
      workflows: {
        create: [
          { stepName: 'A&F Received', isCompleted: true, date: new Date("2024-12-01") },
          { stepName: 'Technical Sanction', isCompleted: true, date: new Date("2025-01-10") },
          { stepName: 'Tender Processed', isCompleted: true, date: new Date("2025-02-15") },
          { stepName: 'Work Order Issued', isCompleted: true, date: new Date("2025-02-28") },
        ]
      },
      pertActivities: {
        create: [
          { name: 'Civil Structure', weightage: 50, progress: 24, startDate: new Date("2025-03-10"), endDate: new Date("2025-12-31") },
          { name: 'Mechanical Setup', weightage: 50, progress: 0, startDate: new Date("2026-01-01"), endDate: new Date("2026-06-30") },
        ]
      },
      updates: {
        create: {
          userId: adminUser.id,
          physicalProgress: 12.0,
          financialProgress: 5,
          gpsLat: 25.15,
          gpsLong: 75.87,
          photos: JSON.stringify(["protest_site.jpg", "boundary.jpg"]),
          remarks: "Urgent intervention needed for land dispute.",
          overallStatus: "Delay",
          statusDelayReasons: JSON.stringify(["Land Acquisition", "NOC (Forest/Pollution/Other)"]),
          statusDelayBrief: "Awaiting environmental clearance and farmers are protesting for higher compensation.",
          todaysUpdateNote: "Work halted at site. Only boundary wall construction is partially active.",
          expectedCompletionDate: new Date("2027-01-15"),
          timeExtension: "Yes"
        }
      }
    }
  });

  // Project C: Smart City DB (Consultancy) - On Track
  const pC = await prisma.project.create({
    data: {
      name: "Smart City Digital Twin Model",
      type: "CONSULTANCY",
      brief: "Consultancy for mapping the city assets into a 3D digital twin.",
      fundingAgency: "Smart City Mission",
      estimatedCost: 150,
      inchargeName: "Anita Roy",
      inchargeMobile: "9000000004",
      consultantName: "TechGIS Solutions",
      consultantMobile: "9000000005",
      actualStartDate: new Date("2025-05-01"),
      stipulatedCompletionDate: new Date("2025-10-31"),
      expectedCompletionDate: new Date("2025-09-30"),
      overallStatus: "On Track",
      todaysUpdateNote: "Drone survey completed. Data processing ongoing.",
      currentProgress: 65.0,
      status: "ONGOING",
      timeExtension: "No",
      workflows: {
        create: [
          { stepName: 'A&F Received', isCompleted: true, date: new Date("2025-01-01") },
          { stepName: 'Technical Sanction', isCompleted: true, date: new Date("2025-02-01") },
          { stepName: 'Tender Processed', isCompleted: true, date: new Date("2025-03-01") },
          { stepName: 'Work Order Issued', isCompleted: true, date: new Date("2025-04-15") },
        ]
      },
      updates: {
        create: {
          userId: adminUser.id,
          physicalProgress: 65.0,
          financialProgress: 50,
          gpsLat: 25.17,
          gpsLong: 75.85,
          photos: JSON.stringify(["drone_survey.jpg"]),
          remarks: "Ahead of schedule.",
          overallStatus: "On Track",
          todaysUpdateNote: "Drone survey completed. Data processing ongoing.",
          expectedCompletionDate: new Date("2025-09-30"),
          timeExtension: "No"
        }
      }
    }
  });

  // Project D: Riverside (Execution) - On Hold
  const pD = await prisma.project.create({
    data: {
      name: "Chambal Riverfront Promenade Phase 2",
      type: "EXECUTION",
      brief: "Extension of riverfront with recreational zones.",
      fundingAgency: "Tourism Board",
      estimatedCost: 500,
      inchargeName: "Vikram Das",
      inchargeMobile: "9000000006",
      overallStatus: "On Hold",
      statusHoldReason: "Tourism Board suspended funds for Q3 review.",
      todaysUpdateNote: "No activity at site. Guard deployed to protect existing materials.",
      currentProgress: 2.0,
      status: "ONGOING",
      timeExtension: "No",
      workflows: {
        create: [
          { stepName: 'A&F Received', isCompleted: true, date: new Date("2025-01-20") },
          { stepName: 'Technical Sanction', isCompleted: true, date: new Date("2025-02-20") },
          { stepName: 'Tender Processed', isCompleted: false },
          { stepName: 'Work Order Issued', isCompleted: false },
        ]
      },
      updates: {
        create: {
          userId: adminUser.id,
          physicalProgress: 2.0,
          financialProgress: 0,
          gpsLat: 25.19,
          gpsLong: 75.82,
          photos: JSON.stringify(["empty_site.jpg"]),
          remarks: "Awaiting funds.",
          overallStatus: "On Hold",
          statusHoldReason: "Tourism Board suspended funds for Q3 review.",
          todaysUpdateNote: "No activity at site. Guard deployed to protect existing materials.",
          timeExtension: "No"
        }
      }
    }
  });

  console.log("Dummy projects seeded successfully!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
