import { z } from 'zod';

const statusEnum = z.enum(['toRead', 'currentlyReading', 'completed']);

export const createBookSchema = z.object({
  title: z.string({ required_error: 'Title is required' }).trim().min(1, 'Title is required'),
  author: z.string({ required_error: 'Author is required' }).trim().min(1, 'Author is required'),
  genre: z.string().trim().optional(),
  status: statusEnum.optional(),
  coverUrl: z.string().trim().optional(),
});

export const updateBookSchema = z.object({
  title: z.string().trim().min(1, 'Title cannot be empty').optional(),
  author: z.string().trim().min(1, 'Author cannot be empty').optional(),
  genre: z.string().trim().optional(),
  status: statusEnum.optional(),
  coverUrl: z.string().trim().optional(),
});
