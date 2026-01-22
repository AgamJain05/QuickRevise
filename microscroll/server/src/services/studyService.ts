import { prisma } from '../lib/prisma.js';
import { updateStreak } from './analyticsService.js';

// ===========================================
// Study Session & Progress Service
// ===========================================

export interface CreateSessionInput {
  deckId: string;
  mode: 'normal' | 'speed' | 'ghost';
}

export interface EndSessionInput {
  cardsStudied: number;
  correctAnswers: number;
  totalTime: number;
  streak?: number;
}

export interface CardReviewInput {
  cardId: string;
  correct: boolean;
  timeSpent?: number;
}

// SM-2 Algorithm constants
const SM2 = {
  MIN_EASE: 1.3,
  INITIAL_EASE: 2.5,
  EASY_BONUS: 1.3,
  HARD_PENALTY: 0.8,
};

/**
 * Start a new study session
 */
export async function startSession(
  userId: string,
  input: CreateSessionInput
) {
  // Verify deck belongs to user
  const deck = await prisma.deck.findFirst({
    where: { id: input.deckId, userId },
  });

  if (!deck) {
    throw new Error('Deck not found');
  }

  const session = await prisma.studySession.create({
    data: {
      userId,
      deckId: input.deckId,
      mode: input.mode,
    },
  });

  // Update streak when starting a session
  await updateStreak(userId);

  return session;
}

/**
 * End a study session
 */
export async function endSession(
  userId: string,
  sessionId: string,
  input: EndSessionInput
) {
  const session = await prisma.studySession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) {
    throw new Error('Session not found');
  }

  const updated = await prisma.studySession.update({
    where: { id: sessionId },
    data: {
      cardsStudied: input.cardsStudied,
      correctAnswers: input.correctAnswers,
      totalTime: input.totalTime,
      streak: input.streak || 0,
      endedAt: new Date(),
    },
  });

  return updated;
}

/**
 * Get user's study sessions
 */
export async function getSessions(
  userId: string,
  options?: {
    deckId?: string;
    mode?: string;
    limit?: number;
    offset?: number;
  }
) {
  const where: any = { userId };
  
  if (options?.deckId) where.deckId = options.deckId;
  if (options?.mode) where.mode = options.mode;

  const sessions = await prisma.studySession.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: options?.limit || 20,
    skip: options?.offset || 0,
    include: {
      deck: {
        select: { id: true, title: true, emoji: true },
      },
    },
  });

  return sessions;
}

/**
 * Record a card review (updates progress using SM-2 algorithm)
 */
export async function recordCardReview(
  userId: string,
  input: CardReviewInput
) {
  // Get or create card progress
  let progress = await prisma.cardProgress.findUnique({
    where: {
      cardId_userId: {
        cardId: input.cardId,
        userId,
      },
    },
  });

  if (!progress) {
    progress = await prisma.cardProgress.create({
      data: {
        cardId: input.cardId,
        userId,
        easeFactor: SM2.INITIAL_EASE,
      },
    });
  }

  // Apply SM-2 algorithm
  const { newEase, newInterval, newMastery } = calculateSM2(
    progress.easeFactor,
    progress.interval,
    progress.masteryLevel,
    input.correct
  );

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  // Update progress
  const updated = await prisma.cardProgress.update({
    where: { id: progress.id },
    data: {
      reviewCount: { increment: 1 },
      correctCount: input.correct ? { increment: 1 } : undefined,
      incorrectCount: !input.correct ? { increment: 1 } : undefined,
      easeFactor: newEase,
      interval: newInterval,
      masteryLevel: newMastery,
      lastReviewed: new Date(),
      nextReviewDate,
    },
  });

  return updated;
}

/**
 * SM-2 Spaced Repetition Algorithm
 */
function calculateSM2(
  currentEase: number,
  currentInterval: number,
  currentMastery: number,
  correct: boolean
): { newEase: number; newInterval: number; newMastery: number } {
  let newEase = currentEase;
  let newInterval = currentInterval;
  let newMastery = currentMastery;

  if (correct) {
    // Correct answer - increase interval
    if (currentInterval === 0) {
      newInterval = 1;
    } else if (currentInterval === 1) {
      newInterval = 6;
    } else {
      newInterval = Math.round(currentInterval * currentEase);
    }

    // Slightly increase ease factor
    newEase = Math.min(currentEase + 0.1, 3.0);
    
    // Increase mastery (diminishing returns)
    const masteryGain = Math.max(5, 20 - currentMastery * 0.15);
    newMastery = Math.min(100, currentMastery + masteryGain);
  } else {
    // Incorrect answer - reset interval
    newInterval = 1;
    
    // Decrease ease factor
    newEase = Math.max(SM2.MIN_EASE, currentEase - 0.2);
    
    // Decrease mastery
    newMastery = Math.max(0, currentMastery - 10);
  }

  return { newEase, newInterval, newMastery };
}

/**
 * Get cards due for review
 */
export async function getDueCards(
  userId: string,
  options?: {
    deckId?: string;
    limit?: number;
  }
) {
  const now = new Date();
  
  // Get cards with progress that are due
  const dueProgress = await prisma.cardProgress.findMany({
    where: {
      userId,
      nextReviewDate: { lte: now },
      card: options?.deckId ? { deckId: options.deckId } : undefined,
    },
    include: {
      card: {
        include: {
          deck: {
            select: { id: true, title: true, emoji: true },
          },
        },
      },
    },
    orderBy: { nextReviewDate: 'asc' },
    take: options?.limit || 50,
  });

  // Also get cards that have never been reviewed
  let neverReviewedCards: any[] = [];
  
  if (!options?.limit || dueProgress.length < options.limit) {
    const remainingLimit = (options?.limit || 50) - dueProgress.length;
    
    const reviewedCardIds = await prisma.cardProgress.findMany({
      where: { userId },
      select: { cardId: true },
    });
    
    const reviewedIds = reviewedCardIds.map(p => p.cardId);

    neverReviewedCards = await prisma.card.findMany({
      where: {
        id: { notIn: reviewedIds },
        deck: {
          userId,
          ...(options?.deckId ? { id: options.deckId } : {}),
        },
      },
      include: {
        deck: {
          select: { id: true, title: true, emoji: true },
        },
      },
      take: remainingLimit,
    });
  }

  // Combine and format results
  const dueCards = dueProgress.map(p => ({
    ...p.card,
    progress: {
      masteryLevel: p.masteryLevel,
      reviewCount: p.reviewCount,
      lastReviewed: p.lastReviewed,
    },
  }));

  const newCards = neverReviewedCards.map(c => ({
    ...c,
    progress: null,
  }));

  return [...dueCards, ...newCards];
}

/**
 * Save speed revision game results
 */
export async function saveSpeedResults(
  userId: string,
  input: {
    deckId: string;
    cardsPlayed: number;
    correctAnswers: number;
    totalTime: number;
    maxStreak: number;
    cardResults: Array<{
      cardId: string;
      correct: boolean;
      timeSpent: number;
    }>;
  }
) {
  // Create study session
  const session = await prisma.studySession.create({
    data: {
      userId,
      deckId: input.deckId,
      mode: 'speed',
      cardsStudied: input.cardsPlayed,
      correctAnswers: input.correctAnswers,
      totalTime: input.totalTime,
      streak: input.maxStreak,
      endedAt: new Date(),
    },
  });

  // Update progress for each card
  for (const result of input.cardResults) {
    await recordCardReview(userId, {
      cardId: result.cardId,
      correct: result.correct,
      timeSpent: result.timeSpent,
    });
  }

  // Update streak
  await updateStreak(userId);

  return session;
}
