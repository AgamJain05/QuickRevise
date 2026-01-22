import { prisma } from '../lib/prisma.js';

// ===========================================
// User Settings Service
// ===========================================

export interface UserSettingsData {
  theme: string;
  dailyGoal: number;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  autoPlayEnabled: boolean;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date | null;
}

/**
 * Get user settings (creates default if not exists)
 */
export async function getSettings(userId: string): Promise<UserSettingsData> {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: { userId },
    update: {},
  });

  return {
    theme: settings.theme,
    dailyGoal: settings.dailyGoal,
    soundEnabled: settings.soundEnabled,
    hapticsEnabled: settings.hapticsEnabled,
    autoPlayEnabled: settings.autoPlayEnabled,
    currentStreak: settings.currentStreak,
    longestStreak: settings.longestStreak,
    lastActiveDate: settings.lastActiveDate,
  };
}

/**
 * Update user settings
 */
export async function updateSettings(
  userId: string,
  data: Partial<Pick<UserSettingsData, 'theme' | 'dailyGoal' | 'soundEnabled' | 'hapticsEnabled' | 'autoPlayEnabled'>>
): Promise<UserSettingsData> {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    create: {
      userId,
      ...data,
    },
    update: data,
  });

  return {
    theme: settings.theme,
    dailyGoal: settings.dailyGoal,
    soundEnabled: settings.soundEnabled,
    hapticsEnabled: settings.hapticsEnabled,
    autoPlayEnabled: settings.autoPlayEnabled,
    currentStreak: settings.currentStreak,
    longestStreak: settings.longestStreak,
    lastActiveDate: settings.lastActiveDate,
  };
}

/**
 * Reset user streak
 */
export async function resetStreak(userId: string): Promise<void> {
  await prisma.userSettings.update({
    where: { userId },
    data: {
      currentStreak: 0,
      lastActiveDate: null,
    },
  });
}

/**
 * Delete all user data (for "Clear All Data" feature)
 */
export async function deleteAllUserData(userId: string): Promise<void> {
  // Delete in order to respect foreign key constraints
  await prisma.$transaction([
    prisma.cardProgress.deleteMany({ where: { userId } }),
    prisma.studySession.deleteMany({ where: { userId } }),
    prisma.processingJob.deleteMany({ where: { userId } }),
    prisma.deck.deleteMany({ where: { userId } }),
    prisma.userSettings.deleteMany({ where: { userId } }),
    prisma.refreshToken.deleteMany({ where: { userId } }),
  ]);
}

/**
 * Export all user data (for GDPR compliance)
 */
export async function exportUserData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
    },
  });

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  const decks = await prisma.deck.findMany({
    where: { userId },
    include: {
      cards: true,
      tags: {
        include: { tag: true },
      },
    },
  });

  const progress = await prisma.cardProgress.findMany({
    where: { userId },
  });

  const sessions = await prisma.studySession.findMany({
    where: { userId },
  });

  return {
    exportDate: new Date().toISOString(),
    user,
    settings,
    decks: decks.map(d => ({
      ...d,
      tags: d.tags.map(t => t.tag.name),
    })),
    progress,
    studySessions: sessions,
  };
}
