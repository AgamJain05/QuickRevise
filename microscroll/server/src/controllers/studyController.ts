import { Request, Response, NextFunction } from 'express';
import {
  startSession,
  endSession,
  getSessions,
  recordCardReview,
  getDueCards,
  saveSpeedResults,
} from '../services/studyService.js';

// ===========================================
// Study Controller
// ===========================================

/**
 * POST /api/study/sessions
 * Start a new study session
 */
export async function createSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const { deckId, mode } = req.body;
    
    const session = await startSession(userId, { deckId, mode });
    
    res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PATCH /api/study/sessions/:sessionId
 * End a study session
 */
export async function updateSession(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const { sessionId } = req.params;
    const { cardsStudied, correctAnswers, totalTime, streak } = req.body;
    
    const session = await endSession(userId, sessionId, {
      cardsStudied,
      correctAnswers,
      totalTime,
      streak,
    });
    
    res.json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/study/sessions
 * Get user's study sessions
 */
export async function listSessions(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const { deckId, mode, limit, offset } = req.query;
    
    const sessions = await getSessions(userId, {
      deckId: deckId as string,
      mode: mode as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    
    res.json({
      success: true,
      data: sessions,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/study/review
 * Record a card review (for progress tracking)
 */
export async function reviewCard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const { cardId, correct, timeSpent } = req.body;
    
    const progress = await recordCardReview(userId, {
      cardId,
      correct,
      timeSpent,
    });
    
    res.json({
      success: true,
      data: progress,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/study/due
 * Get cards due for review
 */
export async function getDue(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const { deckId, limit } = req.query;
    
    const cards = await getDueCards(userId, {
      deckId: deckId as string,
      limit: limit ? parseInt(limit as string) : undefined,
    });
    
    res.json({
      success: true,
      data: cards,
      count: cards.length,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/study/speed-results
 * Save speed revision game results
 */
export async function submitSpeedResults(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user!.id;
    const { deckId, cardsPlayed, correctAnswers, totalTime, maxStreak, cardResults } = req.body;
    
    const session = await saveSpeedResults(userId, {
      deckId,
      cardsPlayed,
      correctAnswers,
      totalTime,
      maxStreak,
      cardResults: cardResults || [],
    });
    
    res.status(201).json({
      success: true,
      data: session,
    });
  } catch (error) {
    next(error);
  }
}
