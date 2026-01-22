import { Request, Response, NextFunction } from 'express';
import {
  getUserAnalytics,
  getWeeklyBreakdown,
  getDeckAnalytics,
} from '../services/analyticsService.js';

// ===========================================
// Analytics Controller
// ===========================================

/**
 * GET /api/analytics
 * Get user's overall analytics
 */
export async function getAnalytics(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const analytics = await getUserAnalytics(userId);
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/weekly
 * Get detailed weekly breakdown
 */
export async function getWeekly(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const breakdown = await getWeeklyBreakdown(userId);
    
    res.json({
      success: true,
      data: breakdown,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/analytics/deck/:deckId
 * Get analytics for a specific deck
 */
export async function getDeckStats(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const { deckId } = req.params;
    
    const analytics = await getDeckAnalytics(userId, deckId);
    
    if (!analytics) {
      return res.status(404).json({
        success: false,
        error: 'Deck not found',
      });
    }
    
    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    next(error);
  }
}
