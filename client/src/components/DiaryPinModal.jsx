import React, { useState, useEffect, useRef } from 'react';
import { X, Lock, ShieldCheck, ShieldOff, AlertCircle } from 'lucide-react';
import { verifyPin, setupPin, disablePin } from '../services/diaryService';

/**
 * DiaryPinModal
 *
 * mode = 'unlock'   → asks for existing PIN to unlock diary
 * mode = 'setup'    → asks for new PIN to enable lock (and confirmation)
 * mode = 'disable'  → asks for current PIN to disable lock
 */
const DiaryPinModal = ({ mode = 'unlock', onSuccess, onClose }) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Auto-focus input
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      triggerShake();
      return;
    }

    if (mode === 'setup' && pin !== confirmPin) {
      setError('PINs do not match. Please try again.');
      triggerShake();
      setPin('');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      if (mode === 'unlock') {
        await verifyPin(pin);
      } else if (mode === 'setup') {
        await setupPin(pin);
      } else if (mode === 'disable') {
        await disablePin(pin);
      }
      onSuccess();
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong.';
      setError(msg);
      triggerShake();
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Neumorphic redesign ("Tactile Bibliotheca"): each mode keeps a distinct
  // semantic accent (primary/secondary/error) rather than a gradient —
  // consistent with the rest of the token system's color restraint.
  const modeConfig = {
    unlock: {
      icon: <Lock size={26} className="text-primary" />,
      title: 'Unlock Your Diary',
      subtitle: 'Enter your PIN to access your private journal.',
      submitLabel: 'Unlock',
      accent: 'primary',
    },
    setup: {
      icon: <ShieldCheck size={26} className="text-secondary" />,
      title: 'Set Diary PIN',
      subtitle: 'Choose a 4–6 digit PIN to protect your personal diary.',
      submitLabel: 'Enable Lock',
      accent: 'secondary',
    },
    disable: {
      icon: <ShieldOff size={26} className="text-neu-error" />,
      title: 'Disable Diary Lock',
      subtitle: 'Enter your current PIN to remove the lock.',
      submitLabel: 'Disable Lock',
      accent: 'error',
    },
  };

  const cfg = modeConfig[mode];
  const SUBMIT_CLASS = {
    primary: 'bg-primary text-on-primary',
    secondary: 'bg-secondary text-on-secondary',
    error: 'bg-neu-error text-on-neu-error',
  };

  // Dot indicator row — an inset "socket" per digit, filled with a raised
  // primary bead once entered.
  const DotRow = ({ value, label }) => (
    <div className="flex flex-col items-center gap-2">
      {label && <span className="text-xs text-on-surface-variant">{label}</span>}
      <div className={`flex gap-3 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`w-3.5 h-3.5 rounded-full transition-all duration-200 ${
              i < value.length
                ? 'bg-primary shadow-neu-xs scale-110'
                : 'bg-surface shadow-neu-inset-xs'
            }`}
          />
        ))}
      </div>
    </div>
  );

  const Keypad = ({ onDigit, onBack, onSubmit, disabled }) => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];
    return (
      <div className="grid grid-cols-3 gap-3 w-full max-w-[240px] mx-auto mt-4">
        {keys.map((k, idx) => {
          if (k === '') return <div key={idx} />;
          const isBack = k === '⌫';
          return (
            <button
              key={idx}
              disabled={disabled}
              onClick={() => (isBack ? onBack() : onDigit(k))}
              className={`h-14 rounded-neu-lg text-lg font-semibold transition-all duration-150 active:shadow-neu-inset bg-surface shadow-neu-xs hover:shadow-neu-inset-sm
                ${isBack ? 'text-neu-error' : 'text-on-surface'} disabled:opacity-50`}
            >
              {k}
            </button>
          );
        })}
      </div>
    );
  };

  const [setupStep, setSetupStep] = useState('enter'); // 'enter' | 'confirm'

  const handleSetupNext = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits.');
      triggerShake();
      return;
    }
    setSetupStep('confirm');
    setError('');
  };

  const activePin = mode === 'setup' && setupStep === 'confirm' ? confirmPin : pin;
  const setActivePin =
    mode === 'setup' && setupStep === 'confirm'
      ? (v) => setConfirmPin(typeof v === 'function' ? v(confirmPin) : v)
      : (v) => setPin(typeof v === 'function' ? v(pin) : v);

  const handleKeypadDigit = (d) => {
    if (activePin.length < 6) {
      setActivePin((prev) => prev + d);
      setError('');
    }
  };
  const handleKeypadBack = () => {
    setActivePin((prev) => prev.slice(0, -1));
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 bg-surface rounded-neu-xl shadow-neu-xl w-full max-w-sm p-6 flex flex-col items-center gap-5">
        {/* Close */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface shadow-neu-xs hover:shadow-neu-inset-sm text-on-surface-variant flex items-center justify-center transition-all"
          >
            <X size={16} />
          </button>
        )}

        {/* Icon + Title */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-full bg-surface-container-low shadow-neu-inset-sm flex items-center justify-center">
            {cfg.icon}
          </div>
          <h2 className="font-display text-xl font-bold text-on-surface">{cfg.title}</h2>
          <p className="text-sm text-on-surface-variant">{cfg.subtitle}</p>
        </div>

        {/* PIN Dots */}
        {mode === 'setup' ? (
          <div className="flex flex-col items-center gap-3 w-full">
            <DotRow value={pin} label={setupStep === 'enter' ? 'Enter new PIN' : 'Entered PIN ✓'} />
            {setupStep === 'confirm' && <DotRow value={confirmPin} label="Confirm new PIN" />}
          </div>
        ) : (
          <DotRow value={pin} />
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-neu-error text-sm bg-surface shadow-neu-inset-xs rounded-neu-lg px-3 py-2 w-full">
            <AlertCircle size={14} className="flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Keypad */}
        <Keypad
          onDigit={handleKeypadDigit}
          onBack={handleKeypadBack}
          onSubmit={handleSubmit}
          disabled={loading}
        />

        {/* Submit / Next Button */}
        {mode === 'setup' && setupStep === 'enter' ? (
          <button
            onClick={handleSetupNext}
            disabled={loading || pin.length < 4}
            className="w-full py-3 rounded-full font-bold shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset transition-all disabled:opacity-40 bg-secondary text-on-secondary"
          >
            Next →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={loading || activePin.length < 4}
            className={`w-full py-3 rounded-full font-bold shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset transition-all disabled:opacity-40 ${SUBMIT_CLASS[cfg.accent]}`}
          >
            {loading ? 'Verifying...' : cfg.submitLabel}
          </button>
        )}
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        .animate-shake { animation: shake 0.5s ease; }
      `}</style>
    </div>
  );
};

export default DiaryPinModal;
