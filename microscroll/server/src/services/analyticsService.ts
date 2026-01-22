import { prisma } from '../lib/prisma.js';

// ===========================================
// Analytics Service
// ===========================================

export interface UserAnalytics {
  streak: number;
  longestStreak: number;
  totalCards: number;
  totalReviewed: number;
  totalDecks: number;
  masteryPercent: number;
  weeklyActivity: number[];
  dueForReview: number;
  todayStudied: number;
  dailyGoal: number;
}

export interface WeeklyBreakdown {
  date: string;
  cardsStudied: number;
  timeSpent: number;
  sessions: number;
}

/**
 * Get comprehensive analytics for a user
 */
export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
  // Get user settings (includes streak)
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  // Get deck and card counts
  const decks = await prisma.deck.findMany({
    where: { userId },
    select: { id: true, totalCards: true },
  });

  const totalDecks = decks.length;
  const totalCards = decks.reduce((sum, d) => sum + d.totalCards, 0);

  // Get review stats from CardProgress
  const progressStats = await prisma.cardProgress.aggregate({
    where: { userId },
    _sum: {
      reviewCount: true,
      correctCount: true,
    },
    _avg: {
      masteryLevel: true,
    },
  });

  // Get cards due for review (nextReviewDate <= now)
  const dueForReview = await prisma.cardProgress.count({
    where: {
      userId,
      nextReviewDate: { lte: new Date() },
    },
  });

  // Get weekly activity (last 7 days)
  const weeklyActivity = await getWeeklyActivity(userId);

  // Get today's studied count
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todaySessions = await prisma.studySession.aggregate({
    where: {
      userId,
      startedAt: { gte: todayStart },
    },
    _sum: {
      cardsStudied: true,
    },
  });

  return {
    streak: settings?.currentStreak || 0,
    longestStreak: settings?.longestStreak || 0,
    totalCards,
    totalReviewed: progressStats._sum.reviewCount || 0,
    totalDecks,
    masteryPercent: Math.round(progressStats._avg.masteryLevel || 0),
    weeklyActivity,
    dueForReview,
    todayStudied: todaySessions._sum.cardsStudied || 0,
    dailyGoal: settings?.dailyGoal || 20,
  };
}

/**
 * Get activity counts for the last 7 days
 */
async function getWeeklyActivity(userId: string): Promise<number[]> {
  const activity: number[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const daySessions = await prisma.studySession.aggregate({
      where: {
        userId,
        startedAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
      _sum: {
        cardsStudied: true,
      },
    });

    activity.push(daySessions._sum.cardsStudied || 0);
  }

  return activity;
}

/**
 * Get detailed weekly breakdown
 */
export async function getWeeklyBreakdown(userId: string): Promise<WeeklyBreakdown[]> {
  const breakdown: WeeklyBreakdown[] = [];
  const now = new Date();

  for (let i = 6; i >= 0; i--) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() - i);
    dayStart.setHours(0, 0, 0, 0);

    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const sessions = await prisma.studySession.findMany({
      where: {
        userId,
        startedAt: {
          gte: dayStart,
          lte: dayEnd,
        },
      },
    });

    breakdown.push({
      date: dayStart.toISOString().split('T')[0],
      cardsStudied: sessions.reduce((sum, s) => sum + s.cardsStudied, 0),
      timeSpent: sessions.reduce((sum, s) => sum + s.totalTime, 0),
      sessions: sessions.length,
    });
  }

  return breakdown;
}

/**
 * Update user streak based on activity
 */
export async function updateStreak(userId: string): Promise<number> {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = settings.lastActiveDate;
  let newStreak = settings.currentStreak;

  if (!lastActive) {
    // First activity ever
    newStreak = 1;
  } else {
    const lastActiveDay = new Date(lastActive);
    lastActiveDay.setHours(0, 0, 0, 0);

    const daysDiff = Math.floor(
      (today.getTime() - lastActiveDay.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff === 0) {
      // Same day, streak unchanged
      return newStreak;
    } else if (daysDiff === 1) {
      // Consecutive day, increment streak
      newStreak = settings.currentStreak + 1;
    } else {
      // Streak broken, reset to 1
      newStreak = 1;
    }
  }

  // Update settings
  const longestStreak = Math.max(settings.longestStreak, newStreak);
  
  await prisma.userSettings.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak,
      lastActiveDate: today,
    },
  });

  return newStreak;
}

/**
 * Get deck-specific analytics
 */
export async function getDeckAnalytics(userId: string, deckId: string) {
  const deck = await prisma.deck.findFirst({
    where: { id: deckId, userId },
    include: {
      cards: {
        include: {
          progress: {
            where: { userId },
          },
        },
      },
      studySessions: {
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!deck) {
    return null;
  }

  // Calculate deck mastery
  const cardsWithProgress = deck.cards.filter(c => c.progress.length > 0);
  const avgMastery = cardsWithProgress.length > 0
    ? cardsWithProgress.reduce((sum, c) => sum + (c.progress[0]?.masteryLevel || 0), 0) / cardsWithProgress.length
    : 0;

  // Count due cards
  const dueCards = deck.cards.filter(c => {
    const progress = c.progress[0];
    if (!progress?.nextReviewDate) return true;
    return new Date(progress.nextReviewDate) <= new Date();
  }).length;

  return {
    deckId,
    title: deck.title,
    totalCards: deck.totalCards,
    masteryPercent: Math.round(avgMastery),
    dueForReview: dueCards,
    recentSessions: deck.studySessions.map(s => ({
      id: s.id,
      mode: s.mode,
      cardsStudied: s.cardsStudied,
      correctAnswers: s.correctAnswers,
      date: s.startedAt,
    })),
  };
}
