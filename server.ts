import express, { type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { optionalAuth, requireAuth, type AuthRequest } from './src/middleware/auth.ts';
import { isSqlHostConfigured } from './src/db/index.ts';
import { getOrCreateUser, getUsers } from './src/db/users.ts';
import {
  getCheckInsFromDb,
  insertCheckInToDb,
  updateCheckInValidationInDb,
  bulkUpdateCheckInValidationInDb,
  getRondasFromDb,
  insertRondaToDb,
  getSchoolsFromDb,
  saveSchoolsToDb,
  getStaffFromDb,
  saveStaffToDb,
  getDeviceBindingsFromDb,
  saveDeviceBindingToDb,
  getAuditLogsFromDb,
  saveAuditLogToDb,
  getConfigFromDb,
  saveConfigToDb,
  wipeAllDbTables,
  deleteCheckInFromDb,
  deleteRondaFromDb,
  deleteDeviceBindingFromDb,
  deleteAuditLogFromDb,
  clearRangeFromDb,
} from './src/db/operations.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // ==========================================
  // API ROUTES (Cloud SQL PostgreSQL Backend)
  // ==========================================

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      engine: isSqlHostConfigured() ? 'cloudsql_postgresql' : 'resilient_storage',
      operational: true,
    });
  });

  // Users (Firebase Auth synchronization)
  app.post('/api/users/sync', optionalAuth, async (req: AuthRequest, res: Response) => {
    try {
      const { uid, email } = req.body;
      const targetUid = req.user?.uid || uid;
      const targetEmail = req.user?.email || email;

      if (!targetUid || !targetEmail) {
        return res.status(400).json({ error: 'UID and email are required' });
      }

      const user = await getOrCreateUser(targetUid, targetEmail);
      res.json(user);
    } catch (error: any) {
      console.error('Failed to sync user:', error);
      res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  app.get('/api/users', optionalAuth, async (_req: AuthRequest, res: Response) => {
    try {
      const users = await getUsers();
      res.json(users);
    } catch (error: any) {
      console.error('Failed to get users:', error);
      res.status(500).json({ error: error.message || 'Failed to get users' });
    }
  });

  // Check-ins (High-throughput operations)
  app.get('/api/checkins', async (_req: Request, res: Response) => {
    try {
      const list = await getCheckInsFromDb();
      res.json(list);
    } catch (error: any) {
      console.error('Failed to get check-ins:', error);
      res.status(500).json({ error: error.message || 'Failed to retrieve check-ins' });
    }
  });

  app.post('/api/checkins', async (req: Request, res: Response) => {
    try {
      await insertCheckInToDb(req.body);
      res.status(201).json({ success: true, id: req.body.id });
    } catch (error: any) {
      console.error('Failed to record check-in:', error);
      res.status(500).json({ error: error.message || 'Failed to record check-in' });
    }
  });

  app.patch('/api/checkins/:id/validate', async (req: Request, res: Response) => {
    try {
      await updateCheckInValidationInDb(req.params.id, req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to validate check-in:', error);
      res.status(500).json({ error: error.message || 'Failed to update validation' });
    }
  });

  app.post('/api/checkins/bulk-validate', async (req: Request, res: Response) => {
    try {
      const { ids, updates } = req.body;
      if (!Array.isArray(ids) || !updates) {
        return res.status(400).json({ error: 'Invalid payload: ids and updates required' });
      }
      await bulkUpdateCheckInValidationInDb(ids, updates);
      res.json({ success: true, count: ids.length });
    } catch (error: any) {
      console.error('Failed to bulk validate check-ins:', error);
      res.status(500).json({ error: error.message || 'Failed to bulk update check-ins' });
    }
  });

  // Rondas
  app.get('/api/rondas', async (_req: Request, res: Response) => {
    try {
      const list = await getRondasFromDb();
      res.json(list);
    } catch (error: any) {
      console.error('Failed to get rondas:', error);
      res.status(500).json({ error: error.message || 'Failed to retrieve rondas' });
    }
  });

  app.post('/api/rondas', async (req: Request, res: Response) => {
    try {
      await insertRondaToDb(req.body);
      res.status(201).json({ success: true, id: req.body.id });
    } catch (error: any) {
      console.error('Failed to record ronda:', error);
      res.status(500).json({ error: error.message || 'Failed to record ronda' });
    }
  });

  // Schools
  app.get('/api/schools', async (_req: Request, res: Response) => {
    try {
      const list = await getSchoolsFromDb();
      res.json(list);
    } catch (error: any) {
      console.error('Failed to get schools:', error);
      res.status(500).json({ error: error.message || 'Failed to retrieve schools' });
    }
  });

  app.post('/api/schools', async (req: Request, res: Response) => {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Payload must be an array of schools' });
      }
      await saveSchoolsToDb(req.body);
      res.json({ success: true, count: req.body.length });
    } catch (error: any) {
      console.error('Failed to save schools:', error);
      res.status(500).json({ error: error.message || 'Failed to save schools' });
    }
  });

  // Staff
  app.get('/api/staff', async (_req: Request, res: Response) => {
    try {
      const list = await getStaffFromDb();
      res.json(list);
    } catch (error: any) {
      console.error('Failed to get staff:', error);
      res.status(500).json({ error: error.message || 'Failed to retrieve staff' });
    }
  });

  app.post('/api/staff', async (req: Request, res: Response) => {
    try {
      if (!Array.isArray(req.body)) {
        return res.status(400).json({ error: 'Payload must be an array of staff members' });
      }
      await saveStaffToDb(req.body);
      res.json({ success: true, count: req.body.length });
    } catch (error: any) {
      console.error('Failed to save staff:', error);
      res.status(500).json({ error: error.message || 'Failed to save staff' });
    }
  });

  // Device Bindings
  app.get('/api/device-bindings', async (_req: Request, res: Response) => {
    try {
      const bindings = await getDeviceBindingsFromDb();
      res.json(bindings);
    } catch (error: any) {
      console.error('Failed to get device bindings:', error);
      res.status(500).json({ error: error.message || 'Failed to retrieve device bindings' });
    }
  });

  app.post('/api/device-bindings', async (req: Request, res: Response) => {
    try {
      await saveDeviceBindingToDb(req.body);
      res.json({ success: true, deviceId: req.body.deviceId });
    } catch (error: any) {
      console.error('Failed to save device binding:', error);
      res.status(500).json({ error: error.message || 'Failed to save device binding' });
    }
  });

  // Audit Logs
  app.get('/api/audit-logs', async (_req: Request, res: Response) => {
    try {
      const logs = await getAuditLogsFromDb();
      res.json(logs);
    } catch (error: any) {
      console.error('Failed to get audit logs:', error);
      res.status(500).json({ error: error.message || 'Failed to retrieve audit logs' });
    }
  });

  app.post('/api/audit-logs', async (req: Request, res: Response) => {
    try {
      await saveAuditLogToDb(req.body);
      res.status(201).json({ success: true, id: req.body.id });
    } catch (error: any) {
      console.error('Failed to record audit log:', error);
      res.status(500).json({ error: error.message || 'Failed to save audit log' });
    }
  });

  // System Configuration
  app.get('/api/config/:key', async (req: Request, res: Response) => {
    try {
      const config = await getConfigFromDb(req.params.key);
      res.json(config);
    } catch (error: any) {
      console.error(`Failed to get config ${req.params.key}:`, error);
      res.status(500).json({ error: error.message || 'Failed to retrieve config' });
    }
  });

  app.post('/api/config/:key', async (req: Request, res: Response) => {
    try {
      await saveConfigToDb(req.params.key, req.body);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`Failed to save config ${req.params.key}:`, error);
      res.status(500).json({ error: error.message || 'Failed to save config' });
    }
  });

  // Delete single items
  app.delete('/api/checkins/:id', async (req: Request, res: Response) => {
    try {
      await deleteCheckInFromDb(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete checkin:', error);
      res.status(500).json({ error: error.message || 'Failed to delete checkin' });
    }
  });

  app.delete('/api/rondas/:id', async (req: Request, res: Response) => {
    try {
      await deleteRondaFromDb(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete ronda:', error);
      res.status(500).json({ error: error.message || 'Failed to delete ronda' });
    }
  });

  app.delete('/api/device-bindings/:deviceId', async (req: Request, res: Response) => {
    try {
      await deleteDeviceBindingFromDb(req.params.deviceId);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete device binding:', error);
      res.status(500).json({ error: error.message || 'Failed to delete device binding' });
    }
  });

  app.delete('/api/audit-logs/:id', async (req: Request, res: Response) => {
    try {
      await deleteAuditLogFromDb(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to delete audit log:', error);
      res.status(500).json({ error: error.message || 'Failed to delete audit log' });
    }
  });

  app.post('/api/system/clear-range', async (req: Request, res: Response) => {
    try {
      const { from, to } = req.body;
      if (typeof from !== 'number' || typeof to !== 'number') {
        return res.status(400).json({ error: 'from and to numbers are required' });
      }
      await clearRangeFromDb(from, to);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Failed to clear range:', error);
      res.status(500).json({ error: error.message || 'Failed to clear range' });
    }
  });

  // System wipe / database reset
  app.post('/api/system/wipe', async (_req: Request, res: Response) => {
    try {
      await wipeAllDbTables();
      res.json({ success: true, message: 'All database tables wiped successfully.' });
    } catch (error: any) {
      console.error('Failed to wipe database:', error);
      res.status(500).json({ error: error.message || 'Failed to wipe database' });
    }
  });

  // ==========================================
  // FRONTEND INTEGRATION (Vite Dev / Prod)
  // ==========================================

  const distPath = path.resolve(__dirname, 'dist');
  const hasDist = fs.existsSync(distPath);
  const isDev = process.env.npm_lifecycle_event === 'dev' || process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production' || (!isDev && hasDist);

  if (isProduction && hasDist) {
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cloud SQL Full-Stack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});
