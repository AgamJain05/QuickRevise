import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  getUserSettings,
  patchSettings,
  exportData,
  deleteData,
} from '../controllers/settingsController.js';
import { updateSettingsSchema, deleteDataSchema } from '../schemas/settings.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/settings - Get user settings
router.get('/', getUserSettings);

// PATCH /api/settings - Update user settings
router.patch('/', validateBody(updateSettingsSchema), patchSettings);

// GET /api/settings/export - Export all user data
router.get('/export', exportData);

// DELETE /api/settings/data - Delete all user data
router.delete('/data', validateBody(deleteDataSchema), deleteData);

export default router;
