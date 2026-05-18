const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const compression = require('compression');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h';


dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Standardized Response Helper
const sendResponse = (res, success, message, data = null, statusCode = 200) => {
  return res.status(statusCode).json({
    success,
    message,
    data
  });
};

// Middleware: Authenticate JWT Token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return sendResponse(res, false, 'Authentication required', null, 401);
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return sendResponse(res, false, 'Invalid or expired token', null, 403);
    }
    req.user = user;
    next();
  });
};

// Middleware: Role-based Authorization
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendResponse(res, false, `Forbidden: ${roles.join(' or ')} access required`, null, 403);
    }
    next();
  };
};

const requireAuth = authenticateToken;
const requireAdmin = [authenticateToken, requireRole(['ADMIN'])];
const requireManager = [authenticateToken, requireRole(['ADMIN', 'DEO', 'ENGINEER'])]; // For project creation/deletion
const requireEditor = [authenticateToken, requireRole(['ADMIN', 'DEO', 'ENGINEER'])]; // For progress updates
const requireFieldWorker = [authenticateToken, requireRole(['ADMIN', 'DEO', 'ENGINEER'])];



// Basic health check
app.get('/', (req, res) => {
  res.json({ message: 'KDA Project Tracking API is running' });
});

// Helper: Chronological Date Validation for Workflows
const validateWorkflowDates = (workflows) => {
  if (!workflows || workflows.length <= 1) return;

  const SEQUENCE = [
    'AF_SANCTION', 'TECH_SANCTION', 'NIT_PUBLISHED', 'TENDER_OPENED', 
    'WORK_ORDER', 
    'DRAFT_DPR_SUBMITTED', 'DRAFT_DPR_APPROVED', 'FINAL_DPR_SUBMITTED', 'FINAL_DPR_APPROVED',
    'DPR_SUBMITTED', 'DPR_APPROVED'
  ];

  const NAME_MAP = {
    'A&F Sanction': 'AF_SANCTION',
    'A&F Received': 'AF_SANCTION',
    'Technical Sanction': 'TECH_SANCTION',
    'Technical Sanction (TS)': 'TECH_SANCTION',
    'NIT Published': 'NIT_PUBLISHED',
    'NIT Publication': 'NIT_PUBLISHED',
    'Tender Opened': 'TENDER_OPENED',

    'Work Order Issued': 'WORK_ORDER',
    'Work Order Release': 'WORK_ORDER'
  };

  const sorted = [...workflows].sort((a, b) => {
    const keyA = a.stageKey || NAME_MAP[a.stepName];
    const keyB = b.stageKey || NAME_MAP[b.stepName];
    const idxA = SEQUENCE.indexOf(keyA);
    const idxB = SEQUENCE.indexOf(keyB);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return (a.id || 0) - (b.id || 0);
  });

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    if (current.value === 'Yes' && current.date) {
      for (let j = i - 1; j >= 0; j--) {
        const prev = sorted[j];
        if (prev.value === 'Yes' && prev.date) {
          const dCur = new Date(current.date).getTime();
          const dPrev = new Date(prev.date).getTime();
          if (!isNaN(dCur) && !isNaN(dPrev) && dCur < dPrev) {
            throw new Error(`Date Conflict: "${current.stepName || 'Next Step'}" (${new Date(current.date).toLocaleDateString('en-GB')}) cannot be before "${prev.stepName || 'Previous Step'}" (${new Date(prev.date).toLocaleDateString('en-GB')}).`);
          }
          break;
        }
      }
    }
  }
};

// Helper: Standard Text Validation (Restriction of special characters)
const validateProjectText = (text, fieldName) => {
  if (!text) return;
  const allowedPattern = /^[A-Za-z0-9\s\-\/\,\.\(\)\&]*$/;
  if (!allowedPattern.test(text)) {
    throw new Error(`Invalid characters in ${fieldName}. Only A-Z, 0-9, space, and - / , . ( ) & are allowed.`);
  }
};

// Helper: Project Execution Timeline Validation
const validateExecutionDates = (startDate, completionDate) => {
  if (!startDate || !completionDate) return;
  const start = new Date(startDate);
  const end = new Date(completionDate);
  if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end < start) {
    throw new Error('Stipulated Completion Date cannot be earlier than Work Start Date.');
  }
};

// Helper: Mobile Validation (Exactly 10 digits)
const validateMobile = (mobile, fieldName) => {
  if (!mobile) return;
  if (!/^\d{10}$/.test(mobile)) {
    throw new Error(`${fieldName} must contain exactly 10 digits.`);
  }
};

// Auth Routes (Login with Password)
app.post('/api/auth/login', async (req, res) => {
  const { mobile, password } = req.body;

  try {
    validateMobile(mobile, 'Mobile number');

    let user = await prisma.user.findUnique({ where: { mobile } });

    if (!user || user.isDeleted) {
      return sendResponse(res, false, 'Mobile number is not registered.', null, 404);
    }

    // Check if account is locked or inactive
    if (!user.is_active) {
      return sendResponse(res, false, 'Your account has been locked due to multiple invalid password attempts. Please contact administrator.', null, 403);
    }

    if (user.password !== password) {
      // Increment failed attempts
      const newFailedAttempts = user.failed_attempt_count + 1;
      const isAdmin = user.role === 'ADMIN';
      
      // Safeguard: Admins never get locked out
      const isNowLocked = !isAdmin && newFailedAttempts >= 4;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failed_attempt_count: newFailedAttempts,
          last_failed_login_at: new Date(),
          is_active: !isNowLocked,
          locked_at: isNowLocked ? new Date() : user.locked_at
        }
      });

      if (isNowLocked) {
        // Log account lock
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: 'ACCOUNT_LOCKED',
            details: `Account locked due to 4 consecutive failed login attempts.`
          }
        });
        return sendResponse(res, false, 'Your account has been locked due to multiple invalid password attempts. Please contact administrator.', null, 403);
      }

      if (isAdmin) {
        return sendResponse(res, false, 'Invalid password.', null, 401);
      }

      const remaining = 4 - newFailedAttempts;
      return sendResponse(res, false, `Invalid password. ${remaining} attempts remaining before account is locked.`, null, 401);
    }

    // Reset failed attempts on successful login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failed_attempt_count: 0,
        locked_at: null
      }
    });

    // Generate JWT Token
    const token = jwt.sign(
      { userId: user.id, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return sendResponse(res, true, 'Login successful', {
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        mobile: user.mobile,
        designation: user.designation
      }
    });
  } catch (error) {
    if (error.message.includes('10 digits') || error.message.includes('required')) {
      return sendResponse(res, false, error.message, null, 400);
    }
    console.error('Login error:', error);
    return sendResponse(res, false, 'Server login error', null, 500);
  }
});


// Authority Directions Endpoint
app.post('/api/projects/:id/directions', requireAuth, async (req, res) => {
  const { direction } = req.body;
  const userId = req.user.userId;
  const projectId = parseInt(req.params.id);

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || (user.role !== 'VIEWER' && user.role !== 'ADMIN' && user.role !== 'DEO')) {
      return res.status(403).json({ error: 'Unauthorized: Only Authority or Admin can give directions.' });
    }


    if (!direction || direction.trim() === '') {
      return res.status(400).json({ error: 'Direction content cannot be empty.' });
    }

    const newDirection = await prisma.projectDirection.create({
      data: {
        direction: direction.trim(),
        projectId: projectId,
        userId: user.id
      },
      include: { user: { select: { name: true, designation: true } } }
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        projectId,
        userId: user.id,
        action: 'DIRECTION_GIVEN',
        details: `Authority Direction given by ${user.name} (${user.designation})`
      }
    });

    res.json(newDirection);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// User Management CRUD
app.get('/api/users', requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { isDeleted: false },
      orderBy: { id: 'desc' },
      select: { 
        id: true, 
        name: true, 
        mobile: true, 
        role: true, 
        designation: true,
        is_active: true,
        failed_attempt_count: true,
        locked_at: true
      } // Exclude password
    });
    return sendResponse(res, true, 'Users fetched successfully', users);
  } catch (error) {
    return sendResponse(res, false, 'Failed to fetch users', null, 500);
  }
});

app.post('/api/users', requireAdmin, async (req, res) => {
  const { name, mobile, password, designation, role } = req.body;
  try {
    validateMobile(mobile, 'Mobile number');
    const user = await prisma.user.create({
      data: { name, mobile, password, designation, role, is_active: true }
    });
    return sendResponse(res, true, 'User created successfully', user);
  } catch (error) {
    if (error.message.includes('10 digits') || error.message.includes('required')) {
      return sendResponse(res, false, error.message, null, 400);
    }
    if (error.code === 'P2002') {
      return sendResponse(res, false, 'User with this mobile number already exists', null, 400);
    }
    return sendResponse(res, false, 'Failed to create user', null, 500);
  }
});

app.put('/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, mobile, password, designation, role, is_active } = req.body;
  
  // Prevent Admin from deactivating own account
  if (parseInt(id) === req.user.userId && is_active === false) {
    return sendResponse(res, false, 'You cannot deactivate your own account', null, 400);
  }

  try {
    const data = { name, mobile, designation, role };
    if (password) data.password = password;
    if (is_active !== undefined) data.is_active = is_active;

    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data
    });
    return sendResponse(res, true, 'User updated successfully', user);
  } catch (error) {
    return sendResponse(res, false, 'Failed to update user', null, 500);
  }
});

// Admin Activation/Deactivation
app.patch('/api/users/:id/activate', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: {
        is_active: true,
        failed_attempt_count: 0,
        locked_at: null
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'USER_ACTIVATED',
        details: `Admin activated user ${user.name} (${user.mobile})`
      }
    });

    return sendResponse(res, true, 'User activated successfully');
  } catch (error) {
    return sendResponse(res, false, 'Failed to activate user', null, 500);
  }
});

app.patch('/api/users/:id/deactivate', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  // Prevent Admin from deactivating own account
  if (parseInt(id) === req.user.userId) {
    return sendResponse(res, false, 'You cannot deactivate your own account', null, 400);
  }

  try {
    const user = await prisma.user.update({
      where: { id: parseInt(id) },
      data: { is_active: false }
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.userId,
        action: 'USER_DEACTIVATED',
        details: `Admin deactivated user ${user.name} (${user.mobile})`
      }
    });

    return sendResponse(res, true, 'User deactivated successfully');
  } catch (error) {
    return sendResponse(res, false, 'Failed to deactivate user', null, 500);
  }
});

app.delete('/api/users/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  // Prevent Admin from deleting own account
  if (parseInt(id) === req.user.userId) {
    return sendResponse(res, false, 'You cannot delete your own account', null, 400);
  }

  try {
    await prisma.user.update({ where: { id: parseInt(id) }, data: { isDeleted: true } });

    return sendResponse(res, true, 'User deleted successfully');
  } catch (error) {
    return sendResponse(res, false, 'Failed to delete user', null, 500);
  }
});


// Seed some users for initial login (DISABLED IN PRODUCTION)
app.post('/api/seed', async (req, res) => {
  return res.status(403).json({ error: 'Access Denied: Seeding is disabled for security reasons.' });
});

// Project Routes
app.get('/api/projects', requireAuth, async (req, res) => {

  try {
    const { includeDeleted, onlyDeleted, isAdmin } = req.query;

    const projects = await prisma.project.findMany({
      where: (isAdmin === 'true') 
        ? (onlyDeleted === 'true' ? { isDeleted: true } : (includeDeleted === 'true' ? {} : { isDeleted: false }))
        : { isDeleted: false },
      include: {
        workflows: { orderBy: { id: 'asc' } },
        pertActivities: true,
        updates: {
          include: { user: { select: { id: true, name: true, mobile: true, designation: true } } },
          orderBy: { timestamp: 'desc' },
          take: 5
        },
        directions: {
          include: { user: { select: { id: true, name: true, mobile: true, designation: true } } },
          orderBy: { timestamp: 'desc' },
          take: 10
        },
        configVersion: { include: { fields: true } }
      },
      orderBy: { id: 'desc' }
    });

    // Efficiently identify projects needing workflow defaults
    const missingWorkflows = projects.filter(p => p.workflows.length === 0);

    if (missingWorkflows.length > 0) {
      await prisma.$transaction(async (tx) => {
        for (const p of missingWorkflows) {
          const defaults = [
            { stepName: 'A&F Received', stageKey: 'AF_SANCTION', isCompleted: false, value: 'No' },
            { stepName: 'Technical Sanction', stageKey: 'TECH_SANCTION', isCompleted: false, value: 'No' },
            { stepName: 'NIT Published', stageKey: 'NIT_PUBLISHED', isCompleted: false, value: 'No' },
            { stepName: 'Tender Opened', stageKey: 'TENDER_OPENED', isCompleted: false, value: 'No' },

            { stepName: 'Work Order Issued', stageKey: 'WORK_ORDER', isCompleted: false, value: 'No' }
          ];
          await tx.projectWorkflow.createMany({ data: defaults.map(d => ({ ...d, projectId: p.id })) });
        }
      });
      // Re-fetch to return complete data
      const updatedProjects = await prisma.project.findMany({
        where: (isAdmin === 'true' && includeDeleted === 'true') ? {} : { isDeleted: false },
        include: {
          workflows: { orderBy: { id: 'asc' } },
          pertActivities: true,
          updates: {
            include: { user: { select: { id: true, name: true, mobile: true, designation: true } } },
            orderBy: { timestamp: 'desc' },
            take: 5
          },
          directions: {
            include: { user: { select: { id: true, name: true, mobile: true, designation: true } } },
            orderBy: { timestamp: 'desc' },
            take: 10
          },
          configVersion: { include: { fields: true } }
        },
        orderBy: { id: 'desc' }
      });
      return sendResponse(res, true, 'Projects fetched successfully', updatedProjects);
    }

    return sendResponse(res, true, 'Projects fetched successfully', projects);
  } catch (error) {
    return sendResponse(res, false, 'Failed to fetch projects', null, 500);
  }
});

app.post('/api/projects', requireManager, async (req, res) => {
  const { projectBaseData, workflows, pertActivities } = req.body;
  const creatorId = req.user.userId;

  try {
    const latestConfig = await prisma.configVersion.findFirst({
      where: { isActive: true },
      orderBy: { versionNumber: 'desc' }
    });

    // Validate Master Fields
    try {
      if (!projectBaseData.name || !projectBaseData.brief || !projectBaseData.fundingAgency || !projectBaseData.inchargeName || projectBaseData.estimatedCost === undefined) {
        throw new Error('Mandatory Fields Missing: Project Name, Description, Funding Agency, Executive Engineer Name, and Estimated Cost are required.');
      }

      validateProjectText(projectBaseData.name, 'Project Name');
      validateProjectText(projectBaseData.brief, 'Project Description');
      validateProjectText(projectBaseData.fundingAgency, 'Funding Agency');
      validateProjectText(projectBaseData.inchargeName, 'Incharge Name');
      validateProjectText(projectBaseData.consultantName, 'Consultant Name');
      validateProjectText(projectBaseData.contractorName, 'Contractor Name');
      
      // Mobile Validations
      validateMobile(projectBaseData.inchargeMobile, 'Executive Engineer Mobile');
      validateMobile(projectBaseData.consultantMobile, 'Consultant Mobile');
      validateMobile(projectBaseData.contractorMobile, 'Contractor Mobile');

      // Cost Validation
      if (parseFloat(projectBaseData.estimatedCost) < 0) {
        throw new Error('Estimated Cost cannot be negative.');
      }

      // Execution Timeline Validation
      validateExecutionDates(projectBaseData.actualStartDate, projectBaseData.stipulatedCompletionDate);

      // PERT Validation based on Work Started flag
      if (pertActivities && pertActivities.length > 0 && projectBaseData.workStarted !== 'Yes') {
        throw new Error('PERT activities can only be defined if Project Work has officially started (Work Started = Yes).');
      }
    } catch (err) {
      return sendResponse(res, false, err.message, null, 400);
    }

    const project = await prisma.$transaction(async (tx) => {

      const newProject = await tx.project.create({
        data: {
          ...projectBaseData,
          configVersionId: latestConfig ? latestConfig.id : null,
          estimatedCost: parseFloat(projectBaseData.estimatedCost) || 0,
          workflows: {
            create: (workflows && workflows.length > 0) ? workflows.map(w => ({
              stageKey: w.stageKey,
              stepName: w.stepName,
              isCompleted: w.isCompleted,
              value: w.value,
              date: (w.date && !isNaN(new Date(w.date).getTime())) ? new Date(w.date) : null,
              reason: w.reason
            })) : []
          },
          pertActivities: {
            create: (pertActivities && pertActivities.length > 0) ? pertActivities.map(p => ({
              name: p.name,
              weightage: parseFloat(p.weightage) || 0,
              startDate: (p.startDate && !isNaN(new Date(p.startDate).getTime())) ? new Date(p.startDate) : new Date(),
              endDate: (p.endDate && !isNaN(new Date(p.endDate).getTime())) ? new Date(p.endDate) : new Date(),
              progress: 0
            })) : []
          },
          actualStartDate: (projectBaseData.actualStartDate && !isNaN(new Date(projectBaseData.actualStartDate).getTime())) ? new Date(projectBaseData.actualStartDate) : null,
          stipulatedCompletionDate: (projectBaseData.stipulatedCompletionDate && !isNaN(new Date(projectBaseData.stipulatedCompletionDate).getTime())) ? new Date(projectBaseData.stipulatedCompletionDate) : null,
          expectedCompletionDate: (projectBaseData.expectedCompletionDate && !isNaN(new Date(projectBaseData.expectedCompletionDate).getTime())) ? new Date(projectBaseData.expectedCompletionDate) : null,
          workStarted: projectBaseData.workStarted || "No",
          consultancySource: projectBaseData.consultancySource || "NIT",
          qualitySampling: projectBaseData.qualitySampling || "No",
          qualitySamplingReason: projectBaseData.qualitySamplingReason || "",
          delayReasons: projectBaseData.delayReasons ? JSON.stringify(projectBaseData.delayReasons) : null,
          delayBrief: projectBaseData.delayBrief || null
        },
        include: { workflows: true, pertActivities: true }
      });

      // Create audit log inside transaction
      await tx.auditLog.create({
        data: {
          projectId: newProject.id,
          userId: parseInt(creatorId) || 0, // Fallback to 0 or a system user ID if missing
          action: 'PROJECT_CREATED',
          details: `Project ${newProject.name} created with ${newProject.workflows.length} milestones and ${newProject.pertActivities.length} PERT activities.`
        }
      });

      return newProject;
    });
    return sendResponse(res, true, 'Project created successfully', project, 201);
  } catch (error) {
    if (error.code === 'P2002') {
      return sendResponse(res, false, 'A project with this name already exists', null, 400);
    }
    return sendResponse(res, false, error.message || 'Could not create project', null, 400);
  }
});

// Admin Soft Delete
app.patch('/api/projects/:id/delete', requireAdmin, async (req, res) => {
  const projectId = parseInt(req.params.id);
  const userId = req.user.userId;
  try {
    const project = await prisma.project.update({

      where: { id: projectId },
      data: { isDeleted: true, deletedAt: new Date() }
    });

    await prisma.auditLog.create({
      data: {
        projectId,
        userId: userId,
        action: 'PROJECT_DELETED',
        details: `Project ${project.name} moved to recycle bin by ${req.user.name}`
      }
    });


    return sendResponse(res, true, 'Project moved to recycle bin');
  } catch (error) {
    return sendResponse(res, false, 'Failed to delete project', null, 500);
  }
});

// Admin Restore
app.patch('/api/projects/:id/restore', requireAdmin, async (req, res) => {
  const projectId = parseInt(req.params.id);
  const userId = req.user.userId;
  try {
    const project = await prisma.project.update({

      where: { id: projectId },
      data: { isDeleted: false, deletedAt: null }
    });

    await prisma.auditLog.create({
      data: {
        projectId,
        userId: userId,
        action: 'PROJECT_RESTORED',
        details: `Project ${project.name} restored by ${req.user.name}`
      }
    });


    return sendResponse(res, true, 'Project restored successfully');
  } catch (error) {
    return sendResponse(res, false, 'Failed to restore project', null, 500);
  }
});

// Admin Permanent Delete
app.delete('/api/projects/:id/permanent', requireAdmin, async (req, res) => {
  const projectId = parseInt(req.params.id);
  try {
    await prisma.$transaction([

      prisma.projectWorkflow.deleteMany({ where: { projectId } }),
      prisma.pertActivity.deleteMany({ where: { projectId } }),
      prisma.projectUpdate.deleteMany({ where: { projectId } }),
      prisma.auditLog.deleteMany({ where: { projectId } }),
      prisma.projectDirection.deleteMany({ where: { projectId } }),
      prisma.project.delete({ where: { id: projectId } })
    ]);

    return sendResponse(res, true, 'Project permanently removed');
  } catch (error) {
    return sendResponse(res, false, 'Failed to permanently delete project', null, 500);
  }
});

// Admin Empty Bin
app.delete('/api/projects/empty-bin', requireAdmin, async (req, res) => {
  try {
    // Find all deleted projects

    const deletedProjects = await prisma.project.findMany({
      where: { isDeleted: true },
      select: { id: true }
    });

    const projectIds = deletedProjects.map(p => p.id);

    if (projectIds.length === 0) {
      return res.json({ message: 'Recycle bin is already empty' });
    }

    await prisma.$transaction([
      prisma.projectWorkflow.deleteMany({ where: { projectId: { in: projectIds } } }),
      prisma.pertActivity.deleteMany({ where: { projectId: { in: projectIds } } }),
      prisma.projectUpdate.deleteMany({ where: { projectId: { in: projectIds } } }),
      prisma.auditLog.deleteMany({ where: { projectId: { in: projectIds } } }),
      prisma.projectDirection.deleteMany({ where: { projectId: { in: projectIds } } }),
      prisma.project.deleteMany({ where: { id: { in: projectIds } } })
    ]);

    return sendResponse(res, true, `Successfully emptied recycle bin (${projectIds.length} projects removed)`);
  } catch (error) {
    return sendResponse(res, false, 'Failed to empty recycle bin', null, 500);
  }
});

// Get Project Logs
app.get('/api/projects/:id/logs', requireAuth, async (req, res) => {

  const projectId = parseInt(req.params.id);
  try {
    const logs = await prisma.auditLog.findMany({
      where: { projectId },
      include: { user: { select: { name: true, role: true, designation: true } } },
      orderBy: { timestamp: 'desc' }
    });
    return sendResponse(res, true, 'Logs fetched successfully', logs);
  } catch (error) {
    return sendResponse(res, false, 'Failed to fetch logs', null, 500);
  }
});

// PERT Endpoints
app.get('/api/projects/:id/pert', requireAuth, async (req, res) => {

  try {
    const activities = await prisma.pertActivity.findMany({
      where: { projectId: parseInt(req.params.id) }
    });
    return sendResponse(res, true, 'PERT activities fetched', activities);
  } catch (error) {
    return sendResponse(res, false, 'Failed to fetch PERT', null, 500);
  }
});

app.post('/api/projects/:id/pert', requireEditor, async (req, res) => {
  const projectId = parseInt(req.params.id);
  const userId = req.user.userId;

  try {
    // Validation: Only allow PERT changes if Work Started = Yes
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { workStarted: true }
    });

    if (!project || project.workStarted !== 'Yes') {
      return res.status(400).json({ 
        error: 'PERT structure can only be created or modified after project work has officially started at site (Work Started = Yes).' 
      });
    }

    const { activities } = req.body;
    const totalWeight = activities.reduce((sum, a) => sum + parseFloat(a.weightage), 0);

    if (Math.abs(totalWeight - 100) > 0.01) {
      return res.status(400).json({ error: 'Total weightage must be 100%' });
    }

    for (const a of activities) {
      if (new Date(a.startDate) > new Date(a.endDate)) {
        return res.status(400).json({ error: `Activity "${a.name}" has an invalid date range: Start cannot be after End.` });
      }
    }

    await prisma.$transaction(async (tx) => {
      // 1. Clear existing PERT structure
      await tx.pertActivity.deleteMany({ where: { projectId } });

      // 2. Insert new structure
      for (const a of activities) {
        await tx.pertActivity.create({
          data: {
            projectId,
            name: a.name,
            weightage: parseFloat(a.weightage),
            startDate: new Date(a.startDate),
            endDate: new Date(a.endDate),
            progress: parseFloat(a.progress) || 0
          }
        });
      }

      await tx.auditLog.create({
        data: {
          projectId,
          userId: userId,
          action: 'PERT_RESTRUCTURED',
          details: `DEO updated PERT structure to ${activities.length} activities.`
        }
      });
    });

    return sendResponse(res, true, 'PERT structure updated successfully');
  } catch (error) {
    return sendResponse(res, false, error.message || 'PERT update failed', null, 500);
  }
});

// Progress Updates (DEPRECATED: Use /cycle-update instead)
app.post('/api/projects/:id/updates', requireEditor, async (req, res) => {
  console.warn(`[DEPRECATION] Legacy update endpoint called for project ${req.params.id}. Use /cycle-update.`);
  const projectId = parseInt(req.params.id);
  const { physicalProgress, financialProgress, gpsLat, gpsLong, photos, remarks } = req.body;
  const userId = req.user.userId;

  try {
    // Logic for no regression
    const lastUpdate = await prisma.projectUpdate.findFirst({
      where: { projectId },
      orderBy: { timestamp: 'desc' }
    });

    if (lastUpdate && physicalProgress < lastUpdate.physicalProgress) {
      // Check if user is DEO for legacy override
      const user = await prisma.user.findUnique({ where: { id: parseInt(userId) } });
      if (user.role !== 'DEO') {
        return res.status(400).json({ error: 'Progress regression not allowed' });
      }
    }

    const update = await prisma.projectUpdate.create({
      data: {
        projectId,
        userId: parseInt(userId),
        physicalProgress: parseFloat(physicalProgress),
        financialProgress: parseFloat(financialProgress),
        gpsLat: parseFloat(gpsLat),
        gpsLong: parseFloat(gpsLong),
        photos: JSON.stringify(photos || []),
        remarks: remarks || ''
      }
    });

    // Update project current progress
    await prisma.project.update({
      where: { id: projectId },
      data: { 
        currentProgress: parseFloat(physicalProgress),
        gpsLat: parseFloat(gpsLat) || undefined,
        gpsLong: parseFloat(gpsLong) || undefined
      }
    });

    res.json(update);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard Stats
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {

  try {
    const projects = await prisma.project.findMany({
      include: { workflows: true }
    });

    const completedProjects = projects.filter(p => {
      if (p.type === 'CONSULTANCY') {
        return p.workflows.some(w => w.stepName === 'DPR Approved' && w.value === 'Yes');
      }
      return p.currentProgress >= 100;
    });

    const ongoingProjects = projects.filter(p => !completedProjects.find(cp => cp.id === p.id));

    const stats = {
      total: projects.length,
      ongoing: ongoingProjects.length,
      completed: completedProjects.length,
      typeDistribution: {
        execution: projects.filter(p => p.type === 'EXECUTION').length,
        consultancy: projects.filter(p => p.type === 'CONSULTANCY').length,
      },
      dprStatus: {
        submitted: projects.filter(p => p.workflows.some(w => w.stepName === 'DPR Submitted' && w.isCompleted)).length,
        approved: completedProjects.filter(p => p.type === 'CONSULTANCY').length,
      }
    };
    return sendResponse(res, true, 'Dashboard stats fetched', stats);
  } catch (error) {
    return sendResponse(res, false, 'Failed to fetch dashboard stats', null, 500);
  }
});

// Update Workflow Step (DEPRECATED: Use /cycle-update instead)
app.put('/api/projects/:projectId/workflow/:stepId', requireEditor, async (req, res) => {

  console.warn(`[DEPRECATION] Individual workflow update called for step ${req.params.stepId}. Use /cycle-update.`);
  const { projectId, stepId } = req.params;
  const { isCompleted, value, reason, date, userId } = req.body;

  try {
    const step = await prisma.projectWorkflow.update({
      where: { id: parseInt(stepId) },
      data: {
        isCompleted,
        value,
        reason,
        date: date ? new Date(date) : null
      }
    });

    // Auto-complete logic for Consultancy
    if (step.stepName === 'DPR Approved' && isCompleted) {
      await prisma.project.update({
        where: { id: parseInt(projectId) },
        data: { status: 'COMPLETED', currentProgress: 100 }
      });
    }

    await prisma.auditLog.create({
      data: {
        projectId: parseInt(projectId),
        userId: parseInt(userId),
        action: 'WORKFLOW_UPDATE',
        details: `Step ${step.stepName} updated to ${isCompleted ? 'Completed' : 'Pending'}`
      }
    });

    res.json(step);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Unified Cycle Update (Wizard Backend)
app.post('/api/projects/:id/cycle-update', requireEditor, async (req, res) => {
  const projectId = parseInt(req.params.id);
  const { workflowUpdates, pertUpdates, statusUpdate } = req.body;
  const userId = req.user.userId;

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: "User session expired or invalid. Please log in again." });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return res.status(404).json({ error: "Project not found" });


    // 0. Strict Backend Validation: Fetch existing and merge with updates
    if (workflowUpdates && workflowUpdates.length > 0) {
      const existingWorkflows = await prisma.projectWorkflow.findMany({
        where: { projectId },
        orderBy: { id: 'asc' } // Assuming ID order matches stage sequence
      });

      // Merge updates into existing data to validate full sequence
      const mergedWorkflows = existingWorkflows.map(ew => {
        const update = workflowUpdates.find(u => u.id === ew.id);
        return update ? { ...ew, ...update } : ew;
      });

      validateWorkflowDates(mergedWorkflows);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 0. Update Master Details if provided (usually by DEO)
      if (req.body.projectMasterUpdates) {
        const {
          name, brief, estimatedCost, fundingAgency,
          inchargeName, inchargeMobile,
          consultantName, consultantMobile,
          contractorName, contractorMobile,
          workStarted, delayReasons, delayBrief,
          fieldData
        } = req.body.projectMasterUpdates;

        const masterData = {};
        if (name) masterData.name = name;
        if (brief !== undefined) masterData.brief = brief;
        if (fundingAgency) masterData.fundingAgency = fundingAgency;
        if (estimatedCost !== undefined && estimatedCost !== '') {
          const costVal = parseFloat(estimatedCost);
          if (!isNaN(costVal)) masterData.estimatedCost = costVal;
        }
        if (inchargeName) masterData.inchargeName = inchargeName;
        if (inchargeMobile) masterData.inchargeMobile = inchargeMobile;
        if (consultantName !== undefined) masterData.consultantName = consultantName;
        if (consultantMobile !== undefined) masterData.consultantMobile = consultantMobile;
        if (contractorName !== undefined) masterData.contractorName = contractorName;
        if (contractorMobile !== undefined) masterData.contractorMobile = contractorMobile;
        if (workStarted !== undefined) masterData.workStarted = workStarted;
        if (delayReasons !== undefined) masterData.delayReasons = delayReasons;
        if (delayBrief !== undefined) masterData.delayBrief = delayBrief;
        if (fieldData !== undefined) masterData.fieldData = fieldData;

        // Validate Master Updates
        try {
          if (masterData.name) validateProjectText(masterData.name, 'Project Name');
          if (masterData.brief) validateProjectText(masterData.brief, 'Project Description');
          if (masterData.fundingAgency) validateProjectText(masterData.fundingAgency, 'Funding Agency');
          if (masterData.inchargeName) validateProjectText(masterData.inchargeName, 'Incharge Name');
          if (masterData.consultantName) validateProjectText(masterData.consultantName, 'Consultant Name');
          if (masterData.contractorName) validateProjectText(masterData.contractorName, 'Contractor Name');
          
          if (masterData.inchargeMobile) validateMobile(masterData.inchargeMobile, 'Incharge Mobile');
          if (masterData.consultantMobile) validateMobile(masterData.consultantMobile, 'Consultant Mobile');
          if (masterData.contractorMobile) validateMobile(masterData.contractorMobile, 'Contractor Mobile');

          if (masterData.estimatedCost !== undefined && parseFloat(masterData.estimatedCost) < 0) {
            throw new Error('Estimated Cost cannot be negative.');
          }
        } catch (err) {
          return res.status(400).json({ error: err.message });
        }

        if (Object.keys(masterData).length > 0) {
          await tx.project.update({
            where: { id: projectId },
            data: masterData
          });
        }
      }

      // 1. Update Workflows (Milestones) using official Upsert
      if (workflowUpdates) {
        for (const w of workflowUpdates) {
          if (!w.stageKey) {
            console.warn(`[SKIP] Workflow update missing stageKey for step: ${w.stepName}`);
            continue;
          }
          const workflowData = {
            isCompleted: w.isCompleted,
            value: w.value,
            reason: w.reason || null,
            date: (w.date && !isNaN(new Date(w.date).getTime())) ? new Date(w.date) : null,
            stepName: w.stepName
          };

          await tx.projectWorkflow.upsert({
            where: {
              projectId_stageKey: {
                projectId: projectId,
                stageKey: w.stageKey
              }
            },
            update: workflowData,
            create: {
              ...workflowData,
              projectId: projectId,
              stageKey: w.stageKey
            }
          });
        }

        // Sync Bid Evaluation fields to Project model for easier reporting
        const techUpdate = workflowUpdates.find(u => u.stageKey === 'BID_TECH_EVAL');
        const finUpdate = workflowUpdates.find(u => u.stageKey === 'BID_FIN_EVAL');
        
        if (techUpdate || finUpdate) {
          const syncData = {};
          if (techUpdate) {
            syncData.bidTechEvalCompleted = techUpdate.value;
            syncData.bidTechEvalDate = (techUpdate.date && !isNaN(new Date(techUpdate.date).getTime())) ? new Date(techUpdate.date) : null;
            syncData.bidTechEvalDelayReason = techUpdate.reason || null;
          }
          if (finUpdate) {
            syncData.bidFinEvalCompleted = finUpdate.value;
            syncData.bidFinEvalDate = (finUpdate.date && !isNaN(new Date(finUpdate.date).getTime())) ? new Date(finUpdate.date) : null;
            syncData.bidFinEvalDelayReason = finUpdate.reason || null;
          }
          await tx.project.update({
            where: { id: projectId },
            data: syncData
          });
        }

        // Fetch all workflows for this project
        const allWorkflowsRaw = await tx.projectWorkflow.findMany({
          where: { projectId }
        });

        // Robust Sorting: Use predefined sequence for logic
        const SEQUENCE = [
          'AF_SANCTION', 'TECH_SANCTION', 'NIT_PUBLISHED', 'TENDER_OPENED', 
          'BID_TECH_EVAL', 'BID_FIN_EVAL', 'WORK_ORDER', 
          'DRAFT_DPR_SUBMITTED', 'DRAFT_DPR_APPROVED', 'FINAL_DPR_SUBMITTED', 'FINAL_DPR_APPROVED',
          'DPR_SUBMITTED', 'DPR_APPROVED'
        ];

        const allWorkflows = allWorkflowsRaw.sort((a, b) => {
          const idxA = SEQUENCE.indexOf(a.stageKey);
          const idxB = SEQUENCE.indexOf(b.stageKey);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          return a.id - b.id; // Fallback to ID for unknown stages
        });

        let foundPending = false;
        for (const w of allWorkflows) {
          if (foundPending) {
            // Reset downstream milestone
            await tx.projectWorkflow.update({
              where: { id: w.id },
              data: { 
                isCompleted: false, 
                value: 'No', 
                reason: null, 
                date: null 
              }
            });
          } else if (w.value === 'No' || !w.isCompleted) {
            // This is the first pending stage
            foundPending = true;
          }
        }
      }

      // 2. Update PERT Activities
      if (pertUpdates && pertUpdates.length > 0) {
        if (project.workStarted !== 'Yes') {
          throw new Error('PERT activity progress can only be updated after project work has officially started at site.');
        }
        for (const p of pertUpdates) {
          await tx.pertActivity.update({
            where: { id: p.id },
            data: { progress: parseFloat(p.progress) }
          });
        }
      }

      // 3. Create Progress Evidence (Optional for milestones-only saves)
      if (statusUpdate && statusUpdate.isProgressUpdate) {
        let finalGpsLat = parseFloat(statusUpdate.gpsLat || 0);
        let finalGpsLong = parseFloat(statusUpdate.gpsLong || 0);
        let finalPhotos = JSON.stringify(statusUpdate.photos || []);

        // ROLE-BASED PROTECTION: Only Engineer or DEO can update evidence
        if (user.role !== 'ENGINEER' && user.role !== 'DEO' && user.role !== 'ADMIN') {

          const currentProject = await tx.project.findUnique({
            where: { id: projectId },
            include: { updates: { orderBy: { timestamp: 'desc' }, take: 1 } }
          });

          if (currentProject.updates && currentProject.updates.length > 0) {
            finalGpsLat = currentProject.updates[0].gpsLat;
            finalGpsLong = currentProject.updates[0].gpsLong;
            finalPhotos = currentProject.updates[0].photos;
          } else {
            finalGpsLat = currentProject.gpsLat;
            finalGpsLong = currentProject.gpsLong;
            finalPhotos = "[]";
          }
        }

        await tx.projectUpdate.create({
          data: {
            projectId,
            userId: userId,
            physicalProgress: parseFloat(statusUpdate.physicalProgress),

            financialProgress: parseFloat(statusUpdate.financialProgress),
            gpsLat: finalGpsLat,
            gpsLong: finalGpsLong,
            photos: finalPhotos,
            remarks: statusUpdate.remarks || '',
            overallStatus: statusUpdate.overallStatus || null,
            statusHoldReason: statusUpdate.statusHoldReason || null,
            statusDelayReasons: statusUpdate.statusDelayReasons ? JSON.stringify(statusUpdate.statusDelayReasons) : null,
            statusDelayBrief: statusUpdate.statusDelayBrief || null,
            todaysUpdateNote: statusUpdate.todaysUpdateNote || null,
            qualitySampling: statusUpdate.qualitySampling || "No",
            qualitySamplingReason: statusUpdate.qualitySamplingReason || "",
            expectedCompletionDate: (statusUpdate.expectedCompletionDate && !isNaN(new Date(statusUpdate.expectedCompletionDate).getTime())) ? new Date(statusUpdate.expectedCompletionDate) : null,
            timeExtension: statusUpdate.timeExtension || null,
            fieldData: statusUpdate.fieldData || null
          }
        });
      }

      // 4. Update Project Overall Progress & Dates
      const projectUpdateData = {};
      if (statusUpdate) {
        // ALWAYS update status and note if provided
        projectUpdateData.overallStatus = statusUpdate.overallStatus || null;
        projectUpdateData.todaysUpdateNote = statusUpdate.todaysUpdateNote || null;
        
        if (statusUpdate.isProgressUpdate) {
          projectUpdateData.currentProgress = parseFloat(statusUpdate.physicalProgress);
          projectUpdateData.status = statusUpdate.physicalProgress >= 100 ? 'COMPLETED' : 'ONGOING';
          projectUpdateData.statusHoldReason = statusUpdate.statusHoldReason || null;
          projectUpdateData.statusDelayReasons = statusUpdate.statusDelayReasons ? JSON.stringify(statusUpdate.statusDelayReasons) : null;
          projectUpdateData.statusDelayBrief = statusUpdate.statusDelayBrief || null;
          projectUpdateData.todaysUpdateNote = statusUpdate.todaysUpdateNote || null;
          projectUpdateData.qualitySampling = statusUpdate.qualitySampling || "No";
          projectUpdateData.qualitySamplingReason = statusUpdate.qualitySamplingReason || "";
          projectUpdateData.expectedCompletionDate = (statusUpdate.expectedCompletionDate && !isNaN(new Date(statusUpdate.expectedCompletionDate).getTime())) ? new Date(statusUpdate.expectedCompletionDate) : null;
          projectUpdateData.timeExtension = statusUpdate.timeExtension || null;
          // Sync project-level coordinates with latest evidence
          if (statusUpdate.gpsLat) projectUpdateData.gpsLat = parseFloat(statusUpdate.gpsLat);
          if (statusUpdate.gpsLong) projectUpdateData.gpsLong = parseFloat(statusUpdate.gpsLong);
        } else {
          // Partial update (e.g. from Step 2)
          if (statusUpdate.overallStatus) projectUpdateData.overallStatus = statusUpdate.overallStatus;
          if (statusUpdate.todaysUpdateNote) projectUpdateData.todaysUpdateNote = statusUpdate.todaysUpdateNote;
        }

        if (statusUpdate.actualStartDate && !isNaN(new Date(statusUpdate.actualStartDate).getTime())) projectUpdateData.actualStartDate = new Date(statusUpdate.actualStartDate);
        if (statusUpdate.stipulatedCompletionDate && !isNaN(new Date(statusUpdate.stipulatedCompletionDate).getTime())) projectUpdateData.stipulatedCompletionDate = new Date(statusUpdate.stipulatedCompletionDate);
        if (statusUpdate.contractorName) projectUpdateData.contractorName = statusUpdate.contractorName;
        if (statusUpdate.contractorMobile) projectUpdateData.contractorMobile = statusUpdate.contractorMobile;
        if (statusUpdate.consultantName) projectUpdateData.consultantName = statusUpdate.consultantName;
        if (statusUpdate.consultantMobile) projectUpdateData.consultantMobile = statusUpdate.consultantMobile;
        if (statusUpdate.fieldData) projectUpdateData.fieldData = statusUpdate.fieldData;

        // --- VALIDATE EXECUTION DATES ---
        try {
          const finalStart = projectUpdateData.actualStartDate || project.actualStartDate;
          const finalCompletion = projectUpdateData.stipulatedCompletionDate || project.stipulatedCompletionDate;
          validateExecutionDates(finalStart, finalCompletion);
        } catch (err) {
          return res.status(400).json({ success: false, message: err.message });
        }
      }

      if (Object.keys(projectUpdateData).length > 0) {
        await tx.project.update({
          where: { id: projectId },
          data: projectUpdateData
        });
      }

      // Log the cycle update
      await tx.auditLog.create({
        data: {
          projectId,
          userId: userId,
          action: 'CYCLE_UPDATE',

          details: `Unified update submitted by ${user.name}. Included: ${workflowUpdates ? 'Workflows, ' : ''}${pertUpdates ? 'PERT, ' : ''}${statusUpdate ? 'Status/Evidence' : ''}`
        }
      });
    });

    return sendResponse(res, true, 'Cycle update processed successfully');
  } catch (error) {
    return sendResponse(res, false, error.message || 'Cycle update failed', null, 500);
  }
});

// --- Dynamic Configuration Management ---

// Get Project-specific config
app.get('/api/projects/:id/config', requireAuth, async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { configVersion: { include: { stages: true, fields: true } } }
    });
    if (!project || !project.configVersion) {
      // Fallback to latest active if project has no version
      const latest = await prisma.configVersion.findFirst({
        where: { isActive: true },
        include: { 
          stages: { orderBy: { sequenceOrder: 'asc' } }, 
          fields: { orderBy: { sequenceOrder: 'asc' } } 
        },
        orderBy: { versionNumber: 'desc' }
      });
      return sendResponse(res, true, 'Fallback config fetched', latest);
    }

    if (project.configVersion) {
      project.configVersion.stages.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
      project.configVersion.fields.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    }
    return sendResponse(res, true, 'Project config fetched', project.configVersion);
  } catch (error) {
    return sendResponse(res, false, 'Failed to fetch project config', null, 500);
  }
});

// Get Latest Active Config
app.get('/api/config/latest', requireAuth, async (req, res) => {
  try {
    const latest = await prisma.configVersion.findFirst({
      where: { isActive: true },
      include: { 
        stages: { orderBy: { sequenceOrder: 'asc' } }, 
        fields: { orderBy: { sequenceOrder: 'asc' } } 
      },
      orderBy: { versionNumber: 'desc' }
    });
    return sendResponse(res, true, 'Latest config fetched', latest);
  } catch (error) {
    return sendResponse(res, false, 'Failed to fetch config', null, 500);
  }
});

// Get Draft Config (versionNumber: 0)
app.get('/api/config/draft', requireAdmin, async (req, res) => {
  try {
    let draft = await prisma.configVersion.findUnique({
      where: { versionNumber: 0 },
      include: { stages: true, fields: true }
    });

    if (!draft) {
      // Initialize draft from latest active
      const latest = await prisma.configVersion.findFirst({
        where: { isActive: true },
        include: { stages: true, fields: true },
        orderBy: { versionNumber: 'desc' }
      });

      draft = await prisma.configVersion.create({
        data: {
          versionNumber: 0,
          createdBy: req.user.userId,
          isActive: false,
          stages: {
            create: latest ? latest.stages.map(s => ({
              stageKey: s.stageKey,
              displayName: s.displayName,
              sequenceOrder: s.sequenceOrder,
              isActive: s.isActive
            })) : []
          },
          fields: {
            create: latest ? latest.fields.map(f => ({
              fieldKey: f.fieldKey,
              displayName: f.displayName,
              fieldType: f.fieldType,
              isRequired: f.isRequired,
              isActive: f.isActive
            })) : []
          }
        },
        include: { stages: true, fields: true }
      });
    }
    return sendResponse(res, true, 'Draft config fetched', draft);
  } catch (error) {
    return sendResponse(res, false, 'Failed to fetch draft', null, 500);
  }
});

// Update Draft (Stage/Field)
app.post('/api/config/draft/update', requireAdmin, async (req, res) => {
  const { stages, fields } = req.body;
  try {
    await prisma.$transaction(async (tx) => {
      const draft = await tx.configVersion.findUnique({ where: { versionNumber: 0 } });
      if (!draft) throw new Error("Draft not initialized");

      // Clear existing draft stages/fields and replace
      await tx.projectStage.deleteMany({ where: { versionId: draft.id } });
      await tx.projectField.deleteMany({ where: { versionId: draft.id } });

      await tx.projectStage.createMany({
        data: stages.map(s => ({ ...s, versionId: draft.id }))
      });
      await tx.projectField.createMany({
        data: fields.map(f => ({ ...f, versionId: draft.id }))
      });
    });
    return sendResponse(res, true, 'Draft updated successfully');
  } catch (error) {
    return sendResponse(res, false, error.message, null, 500);
  }
});

// Publish Draft
app.post('/api/config/publish', requireAdmin, async (req, res) => {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const draft = await tx.configVersion.findUnique({
        where: { versionNumber: 0 },
        include: { stages: true, fields: true }
      });

      if (!draft) throw new Error("No draft to publish");

      // Deactivate current active
      await tx.configVersion.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // Get new version number
      const maxVersion = await tx.configVersion.findFirst({
        where: { versionNumber: { not: 0 } },
        orderBy: { versionNumber: 'desc' }
      });
      const nextVer = (maxVersion ? maxVersion.versionNumber : 0) + 1;

      // Create new version snapshot
      const published = await tx.configVersion.create({
        data: {
          versionNumber: nextVer,
          createdBy: req.user.userId,
          isActive: true,
          stages: {
            create: draft.stages.map(s => ({
              stageKey: s.stageKey,
              displayName: s.displayName,
              sequenceOrder: s.sequenceOrder,
              isActive: s.isActive
            }))
          },
          fields: {
            create: draft.fields.map(f => ({
              fieldKey: f.fieldKey,
              displayName: f.displayName,
              fieldType: f.fieldType,
              isRequired: f.isRequired,
              isActive: f.isActive,
              location: f.location,
              sequenceOrder: f.sequenceOrder
            }))
          }
        }
      });

      // Keep the draft as is, or reset it? Let's keep it as the base for next changes.
      
      await tx.auditLog.create({
        data: {
          userId: req.user.userId,
          action: 'CONFIG_PUBLISHED',
          details: `Published configuration version ${nextVer}`
        }
      });

      return published;
    });
    return sendResponse(res, true, 'Config published successfully', result);
  } catch (error) {
    return sendResponse(res, false, error.message, null, 500);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
