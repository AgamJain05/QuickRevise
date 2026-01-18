import { z } from 'zod';

// Create deck schema
export const createDeckSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title too long'),
  description: z
    .string()
    .max(500, 'Description too long')
    .optional(),
  emoji: z
    .string()
    .max(10)
    .default('📚'),
  colorTheme: z
    .enum(['blue', 'purple', 'green', 'orange', 'pink'])
    .default('blue'),
  sourceType: z
    .enum(['text', 'pdf', 'docx', 'pptx', 'url'])
    .default('text'),
  sourceName: z
    .string()
    .max(255)
    .optional(),
  isPublic: z
    .boolean()
    .default(false),
});

// Update deck schema
export const updateDeckSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title too long')
    .optional(),
  description: z
    .string()
    .max(500, 'Description too long')
    .nullable()
    .optional(),
  emoji: z
    .string()
    .max(10)
    .optional(),
  colorTheme: z
    .enum(['blue', 'purple', 'green', 'orange', 'pink'])
    .optional(),
  isPublic: z
    .boolean()
    .optional(),
});

// Deck ID param schema
export const deckIdSchema = z.object({
  id: z.string().min(1, 'Deck ID is required'),
});

// List decks query schema
export const listDecksQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Types
export type CreateDeckInput = z.infer<typeof createDeckSchema>;
export type UpdateDeckInput = z.infer<typeof updateDeckSchema>;
export type DeckIdParams = z.infer<typeof deckIdSchema>;
export type ListDecksQuery = z.infer<typeof listDecksQuerySchema>;
