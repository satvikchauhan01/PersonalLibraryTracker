import { z } from 'zod';

// Shared by setup / verify / disable — a diary PIN is always a 4-6 digit code.
export const pinSchema = z.object({
  pin: z
    .union([z.string(), z.number()])
    .transform((val) => String(val))
    .refine((val) => /^\d{4,6}$/.test(val), 'PIN must be 4-6 digits'),
});

const moodEnum = z.enum([
  'happy',
  'peaceful',
  'inspired',
  'productive',
  'neutral',
  'stressed',
  'sad',
]);

export const saveEntrySchema = z.object({
  title: z.string().max(150, 'Title must be at most 150 characters').optional().default(''),
  content: z.string().optional().default(''),
  mood: moodEnum.optional().default('neutral'),
  tags: z.array(z.string()).optional().default([]),
  linkedBook: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid book id')
    .nullable()
    .optional(),
  gratitude: z
    .array(z.string())
    .max(3, 'Maximum 3 gratitude bullets allowed')
    .optional()
    .default([]),
});
