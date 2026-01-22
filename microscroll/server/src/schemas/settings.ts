import { z } from 'zod';

// ===========================================
// Settings Schemas
// ===========================================

export const updateSettingsSchema = z.object({
  theme: z.enum(['light', 'dark', 'system']).optional(),
  dailyGoal: z.number().int().min(5).max(100).optional(),
  soundEnabled: z.boolean().optional(),
  hapticsEnabled: z.boolean().optional(),
  autoPlayEnabled: z.boolean().optional(),
});

export const deleteDataSchema = z.object({
  confirm: z.literal('DELETE_ALL_DATA'),
});
