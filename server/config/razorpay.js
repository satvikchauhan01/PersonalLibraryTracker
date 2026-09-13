import Razorpay from 'razorpay';

// Lazily constructed so the app can still boot (and every non-payment route
// still work) if Razorpay keys aren't configured yet in this environment —
// paymentController calls getRazorpay() only when a payment route is hit.
let instance = null;

export const getRazorpay = () => {
  if (!instance) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not configured.');
    }
    instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return instance;
};
