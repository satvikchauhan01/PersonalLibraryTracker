import { z } from 'zod';

// Phase 04: extended status set (old values kept for migration compatibility)
const statusEnum = z.enum(['wantToRead', 'reading', 'completed', 'dnf', 'onHold']);

// ISO date string OR Date-coercible string
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .optional()
  .nullable();

export const createBookSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).trim().min(1, 'Title is required'),
  author: z.string({ required_error: 'Author is required' }).trim().min(1, 'Author is required'),
  genre: z.string().trim().optional(),
  status: statusEnum.optional(),
  coverUrl: z.string().trim().optional(),
  // Phase 03: ISBN (10 or 13 digits, hyphens allowed)
  isbn: z
    .string()
    .trim()
    .regex(/^[\d\-X]{10,17}$/, 'ISBN must be 10 or 13 digits')
    .optional()
    .nullable(),
  // Phase 04: reading progress
  currentPage: z.number().int().min(0).optional(),
  totalPages: z.number().int().min(0).optional(),
  startDate: dateString,
  finishDate: dateString,
});

export const updateBookSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').optional(),
  author: z.string().trim().min(1, 'Author cannot be empty').optional(),
  genre: z.string().trim().optional(),
  status: statusEnum.optional(),
  coverUrl: z.string().trim().optional(),
  // Phase 03: Allow updating isbn
  isbn: z
    .string()
    .trim()
    .regex(/^[\d\-X]{10,17}$/, 'ISBN must be 10 or 13 digits')
    .optional()
    .nullable(),
  // Phase 04: reading progress
  currentPage: z.number().int().min(0).optional(),
  totalPages: z.number().int().min(0).optional(),
  startDate: dateString,
  finishDate: dateString,
});
