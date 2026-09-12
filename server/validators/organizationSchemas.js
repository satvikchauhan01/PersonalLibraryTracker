import { z } from 'zod';

// Phase 05: ratings, reviews, notes, favorites, tags, shelves, quotes

// Half-star increments: 0, 0.5, 1, ... 5. null clears the rating.
export const ratingSchema = z.object({
  rating: z
    .number({ required_error: 'Rating is required' })
    .min(0, 'Rating must be between 0 and 5')
    .max(5, 'Rating must be between 0 and 5')
    .multipleOf(0.5, 'Rating must be in half-star increments')
    .nullable(),
});

export const reviewSchema = z.object({
  text: z
    .string({ required_error: 'Review text is required' })
    .trim()
    .min(1, 'Review text is required')
    .max(4000, 'Review must be at most 4000 characters'),
});

export const noteSchema = z.object({
  text: z
    .string({ required_error: 'Note text is required' })
    .trim()
    .min(1, 'Note text is required')
    .max(4000, 'Note must be at most 4000 characters'),
});

export const favoriteSchema = z.object({
  // Optional: if omitted, the controller just toggles the current value
  isFavorite: z.boolean().optional(),
});

export const tagsSchema = z.object({
  tags: z
    .array(z.string().trim().min(1).max(30))
    .max(20, 'A book can have at most 20 tags')
    .default([]),
});

export const objectIdString = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const createShelfSchema = z.object({
  name: z
    .string({ required_error: 'Shelf name is required' })
    .trim()
    .min(1, 'Shelf name is required')
    .max(60, 'Shelf name must be at most 60 characters'),
});

export const updateShelfSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Shelf name cannot be empty')
    .max(60, 'Shelf name must be at most 60 characters')
    .optional(),
});

export const createQuoteSchema = z.object({
  book: objectIdString,
  text: z
    .string({ required_error: 'Quote text is required' })
    .trim()
    .min(1, 'Quote text is required')
    .max(2000, 'Quote must be at most 2000 characters'),
  page: z.number().int().min(1).optional().nullable(),
});

export const updateQuoteSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, 'Quote text cannot be empty')
    .max(2000, 'Quote must be at most 2000 characters')
    .optional(),
  page: z.number().int().min(1).optional().nullable(),
});
