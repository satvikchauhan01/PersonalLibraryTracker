import React, { useState, useEffect, useCallback, useContext } from 'react';
import { CreditCard, Check, X, Sparkles, Loader, Award, BookOpen } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import {
  createSubscription,
  verifyPayment,
  cancelSubscription,
  getPaymentStatus,
} from '../services/paymentService';

const FREE_FEATURES = [
  'Add & organize books across custom shelves',
  '10 AI reading insights per month',
  'Basic reading pace statistics',
  'Friends, messaging & shared activity',
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
        theme: { color: '#4648d4' },
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
    return <div className="text-xl font-semibold text-primary">Loading billing info...</div>;
  }

  const isPro = status?.isPro;
  const sub = status?.subscription;

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-xs text-secondary shadow-neu-inset-xs">
              Sanctuary Vault
            </span>
            <span className="text-outline-variant text-xs">•</span>
            <span className="text-xs text-on-surface-variant tracking-wider uppercase font-semibold">
              Account Tier
            </span>
          </div>
          <h1 className="font-display text-2xl text-on-surface font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="text-primary" size={22} /> Membership &amp; Billing
          </h1>
          <p className="text-sm text-on-surface-variant max-w-2xl">
            {isPro
              ? 'You are on Library Pro — thanks for supporting the library.'
              : 'Upgrade for unlimited AI and full analytics.'}
          </p>
        </div>
        <div className="flex items-center gap-3 bg-surface-container-low px-4 py-2.5 rounded-neu-xl shadow-neu-md shrink-0">
          <div
            className={`w-3 h-3 rounded-full ${isPro ? 'bg-secondary animate-pulse' : 'bg-outline'}`}
          />
          <div className="flex flex-col">
            <span className="text-[11px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Current Plan
            </span>
            <span className="text-sm font-bold text-on-surface">
              {isPro ? 'Library Pro' : 'Curator Free'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-surface border border-neu-error/30 text-neu-error text-sm rounded-neu-lg px-4 py-3 max-w-xl shadow-neu-inset-xs">
          {error}
        </div>
      )}

      {/* Active membership banner */}
      {isPro && sub && (
        <div className="mb-8 w-full bg-surface-container-low rounded-neu-xl p-4 lg:p-6 shadow-neu-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative overflow-hidden max-w-3xl">
          <div className="absolute -right-16 -top-16 w-64 h-64 bg-primary-container/10 rounded-full blur-3xl pointer-events-none" />
          <div className="flex items-start md:items-center gap-4 z-10">
            <div className="w-14 h-14 rounded-neu-lg bg-surface-container shadow-neu-inset flex items-center justify-center shrink-0 text-primary">
              <Award size={26} />
            </div>
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg text-on-surface font-bold">
                  Library Pro ✦
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-xs font-semibold capitalize">
                  {sub.status}
                </span>
              </div>
              {sub.currentEnd && (
                <p className="text-sm text-on-surface-variant">
                  {sub.cancelAtCycleEnd ? 'Cancels' : 'Renews'} on{' '}
                  {new Date(sub.currentEnd).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          {!sub.cancelAtCycleEnd && (
            <button
              onClick={handleCancel}
              disabled={processing}
              className="z-10 shrink-0 self-start lg:self-center px-4 py-2 rounded-full bg-surface shadow-neu-xs hover:shadow-neu-inset-sm text-neu-error text-sm font-semibold disabled:opacity-50 transition-all"
            >
              {processing ? 'Cancelling…' : 'Cancel subscription'}
            </button>
          )}
        </div>
      )}

      {/* Pricing comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-3xl items-stretch">
        {/* Free */}
        <div className="bg-surface-container-low rounded-neu-xl p-6 shadow-neu-lg flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs shadow-neu-inset-xs">
                  Free Edition
                </span>
                <h2 className="font-display text-xl text-on-surface font-bold">Curator Free</h2>
                <p className="text-xs text-on-surface-variant">
                  Essential cataloging for casual readers.
                </p>
              </div>
              <div className="w-12 h-12 rounded-neu-lg bg-surface-container shadow-neu-inset-sm flex items-center justify-center text-outline shrink-0">
                <BookOpen size={22} />
              </div>
            </div>
            <div className="flex items-baseline gap-1 py-1">
              <span className="font-display text-3xl text-on-surface font-bold">₹0</span>
              <span className="text-sm text-on-surface-variant">/ forever</span>
            </div>
            <div className="space-y-3 pt-2">
              {FREE_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-surface-container shadow-neu-inset-xs flex items-center justify-center shrink-0 text-secondary">
                    <Check size={13} />
                  </div>
                  <span className="text-sm text-on-surface">{f}</span>
                </div>
              ))}
              <div className="flex items-center gap-3 opacity-45">
                <div className="w-6 h-6 rounded-full bg-surface-container shadow-neu-inset-xs flex items-center justify-center shrink-0 text-outline">
                  <X size={13} />
                </div>
                <span className="text-sm text-on-surface-variant line-through">
                  Unlimited AI insights &amp; full analytics
                </span>
              </div>
            </div>
          </div>
          {isPro && (
            <button className="w-full py-3 rounded-neu-lg bg-surface-container-low text-on-surface-variant hover:text-on-surface text-sm font-bold shadow-neu-md hover:shadow-neu-inset-sm transition-all">
              (Downgrade at period end)
            </button>
          )}
        </div>

        {/* Pro */}
        <div className="bg-surface-container-low rounded-neu-xl p-6 shadow-neu-xl flex flex-col justify-between gap-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-44 h-44 bg-gradient-to-bl from-primary-container/40 via-secondary-container/20 to-transparent rounded-bl-full pointer-events-none" />
          <div className="space-y-4 relative">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-0.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold shadow-neu-xs">
                    Curator Tier
                  </span>
                  {isPro && (
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container shadow-neu-inset-xs text-primary text-[11px] font-bold">
                      YOUR CURRENT PLAN
                    </span>
                  )}
                </div>
                <h2 className="font-display text-xl text-on-surface font-bold flex items-center gap-1.5">
                  Library Pro <span className="text-tertiary">✦</span>
                </h2>
                <p className="text-xs text-on-surface-variant">
                  The limitless workstation for dedicated readers.
                </p>
              </div>
              <div className="w-12 h-12 rounded-neu-lg bg-primary-container/40 text-primary shadow-neu-inset-sm flex items-center justify-center shrink-0">
                <Sparkles size={22} />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5 py-1">
              <span className="font-display text-3xl text-primary font-bold">₹99</span>
              <span className="text-sm text-on-surface-variant">/ month</span>
            </div>
            <div className="space-y-3 pt-2">
              {PRO_FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary text-on-primary shadow-neu-xs flex items-center justify-center shrink-0">
                    <Check size={13} />
                  </div>
                  <span className="text-sm text-on-surface">{f}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            {isPro ? (
              <div className="text-sm font-bold text-secondary flex items-center gap-1.5 justify-center py-3">
                <Check size={16} /> Active
              </div>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={processing}
                className="w-full inline-flex items-center justify-center px-4 py-3 rounded-full bg-primary text-on-primary font-bold shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset disabled:opacity-60 transition-all"
              >
                {processing ? <Loader size={16} className="animate-spin" /> : 'Upgrade to Pro'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Billing;
