import { z } from 'zod';

// ===========================================
// Study & Session Schemas
// ===========================================

export const createSessionSchema = z.object({
  deckId: z.string().min(1),
  mode: z.enum(['normal', 'speed', 'ghost']),
});

export const endSessionSchema = z.object({
  cardsStudied: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  totalTime: z.number().int().min(0),
  streak: z.number().int().min(0).optional(),
});

export const reviewCardSchema = z.object({
  cardId: z.string().min(1),
  correct: z.boolean(),
  timeSpent: z.number().int().min(0).optional(),
});

export const speedResultsSchema = z.object({
  deckId: z.string().min(1),
  cardsPlayed: z.number().int().min(0),
  correctAnswers: z.number().int().min(0),
  totalTime: z.number().int().min(0),
  maxStreak: z.number().int().min(0),
  cardResults: z.array(z.object({
    cardId: z.string().min(1),
    correct: z.boolean(),
    timeSpent: z.number().int().min(0),
  })).optional(),
});

export const sessionIdSchema = z.object({
  sessionId: z.string().min(1),
});
