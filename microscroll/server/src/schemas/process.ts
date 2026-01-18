import { z } from 'zod';

// Content limits (matches Gemini limits)
export const CONTENT_MAX_CHARS = 30000;

// Process text schema
export const processTextSchema = z.object({
  content: z
    .string()
    .min(50, 'Content must be at least 50 characters')
    .max(CONTENT_MAX_CHARS, `Content too long (max ${CONTENT_MAX_CHARS.toLocaleString()} characters)`),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(100, 'Title too long'),
});

// Process file schema (for title override)
export const processFileSchema = z.object({
  title: z
    .string()
    .max(100, 'Title too long')
    .optional(),
});

// Job ID param schema
export const jobIdSchema = z.object({
  id: z.string().min(1, 'Job ID is required'),
});

// Types
export type ProcessTextInput = z.infer<typeof processTextSchema>;
export type ProcessFileInput = z.infer<typeof processFileSchema>;
export type JobIdParams = z.infer<typeof jobIdSchema>;
