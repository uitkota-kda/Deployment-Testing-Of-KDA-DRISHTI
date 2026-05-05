const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const compression = require('compression');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { bucket, messaging, rtdb } = require('./firebase');

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = '24h';
const PORT = process.env.PORT || 5000;

const app = express();
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// --- RTDB Helper Functions ---

const dbRef = (path) => rtdb.ref(path);

const getAll = async (path) => {
  const snapshot = await dbRef(path).once('value');
  const val = snapshot.val();
  if (!val) return [];
  // Return as array with IDs
  return Object.keys(val).map(key => ({ ...val[key] }));
};

const getById = async (path, id) => {
  const snapshot = await dbRef(path).child(id.toString()).once('value');
  return snapshot.val();
};

const findOne = async (path, queryFn) => {
  const all = await getAll(path);
  return all.find(queryFn);
};

const create = async (path, data) => {
  // If ID is not provided, use timestamp or counter
  if (!data.id) {
    // For many tables, we might want a simple incrementing ID or Push ID
    // Let's use timestamp for simplicity or find max ID
    const all = await getAll(path);
    const maxId = all.reduce((max, item) => Math.max(max, item.id || 0), 0);
    data.id = maxId + 1;
  }
  await dbRef(path).child(data.id.toString()).set(data);
  return data;
};

const update = async (path, id, data) => {
  const ref = dbRef(path).child(id.toString());
  await ref.update(data);
  const snapshot = await ref.once('value');
  return snapshot.val();
};

// --- API Logic ---

const sendResponse = (res, success, message, data = null, statusCode = 200) => {
  return res.status(statusCode).json({ success, message, data });
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return sendResponse(res, false, 'Authentication required', null, 401);
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return sendResponse(res, false, 'Invalid or expired token', null, 403);
    req.user = user;
    next();
  });
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return sendResponse(res, false, `Forbidden: ${roles.join(' or ')} access required`, null, 403);
  }
  next();
};

const requireAuth = authenticateToken;
const requireAdmin = [authenticateToken, requireRole(['ADMIN'])];
const requireEditor = [authenticateToken, requireRole(['ADMIN', 'DEO', 'ENGINEER'])];

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { mobile, password } = req.body;
  try {
    const user = await findOne('users', u => u.mobile === mobile);
    if (!user || user.isDeleted) return sendResponse(res, false, 'User not found', null, 404);
    if (user.password !== password) return sendResponse(res, false, 'Invalid password', null, 401);
    
    const token = jwt.sign({ userId: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    return sendResponse(res, true, 'Login successful', {
      token,
      user: { id: user.id, name: user.name, role: user.role, mobile: user.mobile, designation: user.designation }
    });
  } catch (error) {
    return sendResponse(res, false, error.message, null, 500);
  }
});

// Project Routes
app.get('/api/projects', requireAuth, async (req, res) => {
  try {
    const { includeDeleted, isAdmin } = req.query;
    let projects = await getAll('projects');
    
    if (isAdmin !== 'true' || includeDeleted !== 'true') {
      projects = projects.filter(p => !p.isDeleted);
    }
    
    // Attach relations manually (RTDB is flat)
    const workflows = await getAll('workflows');
    const perts = await getAll('pertActivities');
    const updates = await getAll('updates');
    const directions = await getAll('directions');
    const configs = await getAll('configVersions');
    const fields = await getAll('projectFields');

    const enriched = projects.map(p => ({
      ...p,
      workflows: workflows.filter(w => w.projectId === p.id),
      pertActivities: perts.filter(pt => pt.projectId === p.id),
      updates: updates.filter(u => u.projectId === p.id).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5),
      directions: directions.filter(d => d.projectId === p.id).sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 10),
      configVersion: configs.find(c => c.id === p.configVersionId) ? {
        ...configs.find(c => c.id === p.configVersionId),
        fields: fields.filter(f => f.versionId === p.configVersionId)
      } : null
    }));

    return sendResponse(res, true, 'Projects fetched', enriched);
  } catch (error) {
    return sendResponse(res, false, error.message, null, 500);
  }
});

// Dashboard Stats
app.get('/api/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const projects = await getAll('projects');
    const workflows = await getAll('workflows');
    
    const stats = {
      total: projects.length,
      ongoing: projects.filter(p => p.status === 'ONGOING').length,
      completed: projects.filter(p => p.status === 'COMPLETED').length,
      typeDistribution: {
        execution: projects.filter(p => p.type === 'EXECUTION').length,
        consultancy: projects.filter(p => p.type === 'CONSULTANCY').length,
      }
    };
    return sendResponse(res, true, 'Stats fetched', stats);
  } catch (error) {
    return sendResponse(res, false, error.message, null, 500);
  }
});

// Cycle Update (Wizard) - Simplified for brevity but functional
app.post('/api/projects/:id/cycle-update', requireEditor, async (req, res) => {
  const projectId = parseInt(req.params.id);
  const { workflowUpdates, pertUpdates, statusUpdate, projectMasterUpdates } = req.body;
  const userId = req.user.userId;

  try {
    // 1. Master Updates
    if (projectMasterUpdates) {
      await update('projects', projectId, projectMasterUpdates);
    }

    // 2. Workflow Updates
    if (workflowUpdates) {
      for (const w of workflowUpdates) {
        if (w.id) {
          await update('workflows', w.id, { ...w, projectId });
        } else {
          await create('workflows', { ...w, projectId });
        }
      }
    }

    // 3. PERT Updates
    if (pertUpdates) {
      for (const p of pertUpdates) {
        await update('pertActivities', p.id, { progress: parseFloat(p.progress) });
      }
    }

    // 4. Status Update (Progress Evidence)
    if (statusUpdate && statusUpdate.isProgressUpdate) {
      await create('updates', {
        ...statusUpdate,
        projectId,
        userId,
        timestamp: new Date().toISOString()
      });
      
      // Update project progress
      await update('projects', projectId, {
        currentProgress: parseFloat(statusUpdate.physicalProgress),
        status: statusUpdate.physicalProgress >= 100 ? 'COMPLETED' : 'ONGOING',
        overallStatus: statusUpdate.overallStatus
      });
    }

    // 5. Audit Log
    await create('auditLogs', {
      projectId,
      userId,
      action: 'CYCLE_UPDATE',
      details: 'Unified update via Realtime Database',
      timestamp: new Date().toISOString()
    });

    return sendResponse(res, true, 'Update processed successfully');
  } catch (error) {
    return sendResponse(res, false, error.message, null, 500);
  }
});

// Health check
app.get('/', (req, res) => res.json({ message: 'KDA Project Tracking API (Cloud Mode) is running' }));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
