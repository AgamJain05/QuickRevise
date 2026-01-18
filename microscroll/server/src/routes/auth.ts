import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
} from '../schemas/auth.js';

const router = Router();

// Apply rate limiting to auth routes
router.use(authLimiter);

// POST /api/auth/register - Create new account
router.post(
  '/register',
  validateBody(registerSchema),
  authController.register
);

// POST /api/auth/login - Login and get tokens
router.post(
  '/login',
  validateBody(loginSchema),
  authController.login
);

// POST /api/auth/refresh - Refresh access token
router.post(
  '/refresh',
  validateBody(refreshSchema),
  authController.refresh
);

// POST /api/auth/logout - Invalidate refresh token
router.post(
  '/logout',
  validateBody(logoutSchema),
  authController.logout
);

// POST /api/auth/logout-all - Logout from all devices (requires auth)
router.post(
  '/logout-all',
  authenticate,
  authController.logoutAll
);

// GET /api/auth/me - Get current user
router.get(
  '/me',
  authenticate,
  authController.me
);

export default router;
