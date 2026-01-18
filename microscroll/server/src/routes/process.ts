import { Router } from 'express';
import * as processController from '../controllers/processController.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { aiLimiter } from '../middleware/rateLimit.js';
import { processTextSchema, jobIdSchema } from '../schemas/process.js';

const router = Router();

// ===========================================
// Public Routes (no auth required)
// ===========================================

// GET /api/process/limits - Get content limits
router.get('/limits', processController.getLimits);

// ===========================================
// Protected Routes (auth required)
// ===========================================

// POST /api/process/upload - Upload and process file
router.post(
  '/upload',
  authenticate,
  aiLimiter,
  upload.single('file'),
  processController.uploadFile
);

// POST /api/process/text - Process raw text
router.post(
  '/text',
  authenticate,
  aiLimiter,
  validateBody(processTextSchema),
  processController.processText
);

// GET /api/process/jobs - List processing jobs
router.get('/jobs', authenticate, processController.listJobs);

// GET /api/process/jobs/:id - Get job status
router.get(
  '/jobs/:id',
  authenticate,
  validateParams(jobIdSchema),
  processController.getJob
);

export default router;
