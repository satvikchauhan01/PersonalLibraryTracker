import { z } from 'zod';
import { objectIdString } from './organizationSchemas.js';

// Phase 18: AI stretch features

export const askDiarySchema = z.object({
  question: z
    .string({ required_error: 'A question is required' })
    .trim()
    .min(3, 'Question must be at least 3 characters')
    .max(500, 'Question must be at most 500 characters'),
});

export const reviewAssistSchema = z.object({
  bookId: objectIdString,
  bulletPoints: z
    .array(z.string().trim().min(1).max(300))
    .min(1, 'At least one bullet point is required')
    .max(10, 'At most 10 bullet points'),
});

export const aiSearchSchema = z.object({
  query: z
    .string({ required_error: 'A search query is required' })
    .trim()
    .min(3, 'Query must be at least 3 characters')
    .max(300, 'Query must be at most 300 characters'),
});
