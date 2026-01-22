import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateBody, validateParams } from '../middleware/validate.js';
import {
  createSession,
  updateSession,
  listSessions,
  reviewCard,
  getDue,
  submitSpeedResults,
} from '../controllers/studyController.js';
import {
  createSessionSchema,
  endSessionSchema,
  reviewCardSchema,
  speedResultsSchema,
  sessionIdSchema,
} from '../schemas/study.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/study/sessions - Start a new study session
router.post('/sessions', validateBody(createSessionSchema), createSession);

// PATCH /api/study/sessions/:sessionId - End a study session
router.patch(
  '/sessions/:sessionId',
  validateParams(sessionIdSchema),
  validateBody(endSessionSchema),
  updateSession
);

// GET /api/study/sessions - List study sessions
router.get('/sessions', listSessions);

// POST /api/study/review - Record a card review
router.post('/review', validateBody(reviewCardSchema), reviewCard);

// GET /api/study/due - Get cards due for review
router.get('/due', getDue);

// POST /api/study/speed-results - Save speed revision results
router.post('/speed-results', validateBody(speedResultsSchema), submitSpeedResults);

export default router;
