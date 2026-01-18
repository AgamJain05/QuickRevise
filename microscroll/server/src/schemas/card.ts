import { z } from 'zod';

// Create card schema
export const createCardSchema = z.object({
  headline: z
    .string()
    .min(1, 'Headline is required')
    .max(200, 'Headline too long'),
  detailParagraph: z
    .string()
    .min(1, 'Detail paragraph is required')
    .max(5000, 'Detail too long'),
  bulletPoints: z
    .array(z.string().max(500))
    .max(10)
    .default([]),
  emoji: z
    .string()
    .max(10)
    .default('📝'),
  difficulty: z
    .enum(['easy', 'medium', 'hard'])
    .default('medium'),
  ghostWords: z
    .array(z.string().max(100))
    .max(20)
    .default([]),
  eli5Version: z
    .string()
    .max(2000)
    .nullable()
    .optional(),
  quizQuestion: z
    .string()
    .max(500)
    .nullable()
    .optional(),
  quizAnswer: z
    .boolean()
    .nullable()
    .optional(),
});

// Update card schema
export const updateCardSchema = z.object({
  headline: z
    .string()
    .min(1, 'Headline is required')
    .max(200, 'Headline too long')
    .optional(),
  detailParagraph: z
    .string()
    .min(1, 'Detail paragraph is required')
    .max(5000, 'Detail too long')
    .optional(),
  bulletPoints: z
    .array(z.string().max(500))
    .max(10)
    .optional(),
  emoji: z
    .string()
    .max(10)
    .optional(),
  difficulty: z
    .enum(['easy', 'medium', 'hard'])
    .optional(),
  ghostWords: z
    .array(z.string().max(100))
    .max(20)
    .optional(),
  eli5Version: z
    .string()
    .max(2000)
    .nullable()
    .optional(),
  quizQuestion: z
    .string()
    .max(500)
    .nullable()
    .optional(),
  quizAnswer: z
    .boolean()
    .nullable()
    .optional(),
});

// Create multiple cards schema
export const createCardsSchema = z.object({
  cards: z.array(createCardSchema).min(1).max(100),
});

// Reorder cards schema
export const reorderCardsSchema = z.object({
  cardIds: z.array(z.string()).min(1),
});

// Card ID param schema
export const cardIdSchema = z.object({
  cardId: z.string().min(1, 'Card ID is required'),
});

// Types
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
export type CreateCardsInput = z.infer<typeof createCardsSchema>;
export type ReorderCardsInput = z.infer<typeof reorderCardsSchema>;
export type CardIdParams = z.infer<typeof cardIdSchema>;
