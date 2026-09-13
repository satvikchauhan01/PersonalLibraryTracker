import React, { useState, useEffect, useCallback, useContext } from 'react';
import { CreditCard, Check, Sparkles, Loader } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import {
  createSubscription,
  verifyPayment,
  cancelSubscription,
  getPaymentStatus,
} from '../services/paymentService';

const FREE_FEATURES = [
  'Add & organize books',
  'Reading progress & streaks',
  '10 AI insights / month',
];
const PRO_FEATURES = [
  'Everything in Free',
  'Unlimited AI insights & writing prompts',
  'Full analytics dashboard',
  'Pro badge on your activity',
];

const Billing = () => {
  const { user, refreshUser } = useContext(AuthContext);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getPaymentStatus();
      setStatus(data);
    } catch (err) {
      console.error('Error fetching payment status:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleUpgrade = async () => {
    setError('');
    if (typeof window.Razorpay === 'undefined') {
      setError('Payment widget failed to load. Please refresh and try again.');
      return;
    }

    setProcessing(true);
    try {
      const { data } = await createSubscription();

      const razorpay = new window.Razorpay({
        key: data.keyId,
        subscription_id: data.subscriptionId,
        name: 'Library Nest',
        description: 'Library Pro — monthly subscription',
        theme: { color: '#4f46e5' },
        handler: async (response) => {
          try {
            await verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_subscription_id: response.razorpay_subscription_id,
              razorpay_signature: response.razorpay_signature,
            });
            // Reflect Pro status immediately, without a page reload
            await refreshUser();
            fetchStatus();
          } catch (err) {
            setError(err.response?.data?.message || 'Payment verification failed.');
          } finally {
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: () => setProcessing(false),
        },
        prefill: { name: user?.name, email: user?.email },
      });

      razorpay.on('payment.failed', () => {
        setError('Payment failed. Please try again.');
        setProcessing(false);
      });

      razorpay.open();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not start checkout.');
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    setError('');
    setProcessing(true);
    try {
      await cancelSubscription();
      fetchStatus();
    } catch (err) {
      setError(err.response?.data?.message || 'Could not cancel subscription.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return <div className="text-xl font-semibold text-indigo-600">Loading billing info...</div>;
  }

  const isPro = status?.isPro;
  const sub = status?.subscription;

  return (
    <>
      <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
        <CreditCard className="text-indigo-600" /> Billing
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {isPro ? 'You are on Library Pro.' : 'Upgrade for unlimited AI and full analytics.'}
      </p>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm rounded-lg px-4 py-3 max-w-xl">
          {error}
        </div>
      )}

      {isPro && sub && (
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 max-w-xl">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={16} className="text-amber-500" />
            <span className="font-semibold text-gray-800 dark:text-gray-100">Library Pro</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400 capitalize">
              {sub.status}
            </span>
          </div>
          {sub.currentEnd && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {sub.cancelAtCycleEnd ? 'Cancels' : 'Renews'} on{' '}
              {new Date(sub.currentEnd).toLocaleDateString()}
            </p>
          )}
          {!sub.cancelAtCycleEnd && (
            <button
              onClick={handleCancel}
              disabled={processing}
              className="mt-4 text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {processing ? 'Cancelling…' : 'Cancel subscription'}
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-2 border-transparent">
          <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1">Free</h3>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">₹0</p>
          <ul className="space-y-2">
            {FREE_FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <Check size={16} className="text-gray-400 mt-0.5 flex-shrink-0" /> {f}
              </li>
            ))}
          </ul>
        </div>

        <div
          className={`bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 border-2 ${isPro ? 'border-green-400' : 'border-indigo-500'}`}
        >
          <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-1 flex items-center gap-1.5">
            Library Pro <Sparkles size={15} className="text-amber-500" />
          </h3>
          <p className="text-2xl font-extrabold text-gray-900 dark:text-gray-100 mb-4">
            ₹99 <span className="text-sm font-normal text-gray-400">/ month</span>
          </p>
          <ul className="space-y-2 mb-5">
            {PRO_FEATURES.map((f) => (
              <li
                key={f}
                className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400"
              >
                <Check size={16} className="text-indigo-500 mt-0.5 flex-shrink-0" /> {f}
              </li>
            ))}
          </ul>
          {isPro ? (
            <div className="text-sm font-medium text-green-600 flex items-center gap-1.5">
              <Check size={16} /> Active
            </div>
          ) : (
            <button
              onClick={handleUpgrade}
              disabled={processing}
              className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-full bg-indigo-600 text-white font-semibold hover:bg-indigo-700 disabled:opacity-60"
            >
              {processing ? <Loader size={16} className="animate-spin" /> : 'Upgrade to Pro'}
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default Billing;
