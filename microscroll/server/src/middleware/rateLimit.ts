import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

// General API rate limiter
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isDev ? 1000 : 100, // Higher limit in dev
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT',
      message: 'Too many requests, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limiter for auth routes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isDev ? 100 : 5, // 5 attempts per 15 min in production
  message: {
    success: false,
    error: {
      code: 'AUTH_RATE_LIMIT',
      message: 'Too many authentication attempts, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// AI generation limiter (expensive operations)
export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: config.isDev ? 100 : 20, // 20 AI requests per hour
  message: {
    success: false,
    error: {
      code: 'AI_RATE_LIMIT',
      message: 'AI generation limit reached, please try again later',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});
