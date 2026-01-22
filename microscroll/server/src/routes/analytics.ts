import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getAnalytics,
  getWeekly,
  getDeckStats,
} from '../controllers/analyticsController.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// GET /api/analytics - Get overall analytics
router.get('/', getAnalytics);

// GET /api/analytics/weekly - Get weekly breakdown
router.get('/weekly', getWeekly);

// GET /api/analytics/deck/:deckId - Get deck-specific analytics
router.get('/deck/:deckId', getDeckStats);

export default router;
