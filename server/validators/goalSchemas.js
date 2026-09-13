import { z } from 'zod';

const currentYear = new Date().getFullYear();

const baseGoalFields = {
  year: z
    .number({ required_error: 'Year is required' })
    .int()
    .min(2000)
    .max(currentYear + 5),
  period: z.enum(['yearly', 'monthly'], { required_error: 'Period is required' }),
  month: z.number().int().min(1).max(12).optional().nullable(),
  metric: z.enum(['books', 'pages'], { required_error: 'Metric is required' }),
  target: z
    .number({ required_error: 'Target is required' })
    .int('Target must be a whole number')
    .min(1, 'Target must be at least 1'),
};

// A monthly goal must carry a month; a yearly goal must not.
const requireMonthMatchesPeriod = (data, ctx) => {
  if (data.period === 'monthly' && !data.month) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Month is required for a monthly goal',
      path: ['month'],
    });
  }
  if (data.period === 'yearly' && data.month) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Yearly goals cannot have a month',
      path: ['month'],
    });
  }
};

export const createGoalSchema = z.object(baseGoalFields).superRefine(requireMonthMatchesPeriod);

export const updateGoalSchema = z.object({
  target: z
    .number()
    .int('Target must be a whole number')
    .min(1, 'Target must be at least 1')
    .optional(),
});
