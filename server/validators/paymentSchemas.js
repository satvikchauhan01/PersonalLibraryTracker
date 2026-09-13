import { z } from 'zod';

export const verifyPaymentSchema = z.object({
  razorpay_payment_id: z.string({ required_error: 'razorpay_payment_id is required' }).min(1),
  razorpay_subscription_id: z
    .string({ required_error: 'razorpay_subscription_id is required' })
    .min(1),
  razorpay_signature: z.string({ required_error: 'razorpay_signature is required' }).min(1),
});
