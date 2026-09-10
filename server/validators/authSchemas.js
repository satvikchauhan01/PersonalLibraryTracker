import { z } from 'zod';

const phoneField = z
  .string()
  .trim()
  .regex(/^(\+?\d{7,15})?$/, 'Please enter a valid phone number');

export const registerSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name is required')
    .max(60, 'Name must be at most 60 characters'),
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
  phone: phoneField.optional().default(''),
  bio: z.string().max(280, 'Bio must be at most 280 characters').optional().default(''),
  favoriteGenre: z.string().trim().optional().default(''),
});

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1, 'Name cannot be empty').max(60).optional(),
  phone: phoneField.optional(),
  bio: z.string().max(280, 'Bio must be at most 280 characters').optional(),
  favoriteGenre: z.string().trim().optional(),
  avatarUrl: z.string().trim().optional(),
});
