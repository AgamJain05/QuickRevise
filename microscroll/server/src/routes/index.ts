import { Router } from 'express';
import authRoutes from './auth.js';
import deckRoutes from './decks.js';
import cardRoutes from './cards.js';
import processRoutes from './process.js';
import analyticsRoutes from './analytics.js';
import settingsRoutes from './settings.js';
import studyRoutes from './study.js';

const router = Router();

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
  });
});

// Mount route modules
router.use('/auth', authRoutes);
router.use('/decks', deckRoutes);
router.use('/cards', cardRoutes);
router.use('/process', processRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/settings', settingsRoutes);
router.use('/study', studyRoutes);

export default router;
