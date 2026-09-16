import React, { useState, useContext } from 'react';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import {
  BookOpen,
  AlertTriangle,
  Loader,
  User,
  Mail,
  Lock,
  Phone,
  BookMarked,
  FileText,
  ArrowRight,
  ArrowLeft,
  Eye,
  EyeOff,
  CheckCircle,
  MailCheck,
} from 'lucide-react';

const GENRE_OPTIONS = [
  'Fiction',
  'Non-Fiction',
  'Science Fiction',
  'Fantasy',
  'Mystery',
  'Thriller',
  'Romance',
  'Biography',
  'Self-Help',
  'History',
  'Science',
  'Technology',
  'Philosophy',
  'Poetry',
  'Comics & Manga',
];

// Neumorphic redesign ("Tactile Bibliotheca"): each field is an icon +
// input pair inside a single inset "channel", not a label-above-bordered-box
// — matches Stitch's Auth mock. `icon` renders inline at the left.
const Field = ({ icon: Icon, label, action, children }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-xs font-bold tracking-wide uppercase text-on-surface-variant">
        {label}
      </label>
      {action}
    </div>
    <div className="relative flex items-center gap-3 rounded-neu-lg bg-surface shadow-neu-inset-lg focus-within:shadow-neu-inset-focus px-4 py-3 transition-all">
      <Icon size={16} className="text-outline shrink-0" />
      {children}
    </div>
  </div>
);

const AuthScreen = () => {
  const [isLogin, setIsLogin] = useState(true);

  // Step 1 (required): Name, Email, Password
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Step 2 (optional): Phone, Bio, Favorite Genre
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [favoriteGenre, setFavoriteGenre] = useState('');

  // UI state
  const [step, setStep] = useState(1); // 1 = required, 2 = optional
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Phase 12: forgot-password — a third mode, reachable only from the login view
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const { login, register } = useContext(AuthContext);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setPhone('');
    setBio('');
    setFavoriteGenre('');
    setStep(1);
    setError(null);
    setShowPassword(false);
    setShowForgotPassword(false);
    setForgotEmail('');
    setForgotSent(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotLoading(true);
    setError(null);
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail.trim() });
      setForgotSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  // Validate step 1 before proceeding
  const handleNextStep = (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setStep(2);
  };

  // Submit login or final registration
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        await register({
          name: name.trim(),
          email,
          password,
          phone: phone.trim(),
          bio: bio.trim(),
          favoriteGenre,
        });
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  // Skip optional step and register with just required fields
  const handleSkipAndRegister = async () => {
    setLoading(true);
    setError(null);
    try {
      await register({
        name: name.trim(),
        email,
        password,
      });
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const fieldInputClass =
    'w-full bg-transparent border-none p-0 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:ring-0';
  const selectClass =
    'w-full bg-surface border-none text-sm text-on-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 rounded-neu-lg px-4 py-3 transition-all';

  return (
    <div className="min-h-screen flex items-center justify-center bg-neu-background p-4">
      <div className="max-w-md w-full bg-surface rounded-neu-xl shadow-neu-xl overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-6 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 rounded-neu-lg bg-surface-container-low shadow-neu-lg flex items-center justify-center">
              <BookOpen className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h2 className="font-display text-2xl font-bold text-on-surface">
            {isLogin
              ? showForgotPassword
                ? 'Reset Password'
                : 'Welcome Back!'
              : step === 1
                ? 'Create Your Account'
                : 'Almost There!'}
          </h2>
          <p className="text-on-surface-variant text-sm mt-1">
            {isLogin
              ? showForgotPassword
                ? "Enter your email and we'll send you a reset link."
                : 'Sign in to access your library & diary.'
              : step === 1
                ? 'Fill in the required details to get started.'
                : 'Add a few optional details about yourself.'}
          </p>

          {/* Step indicator for registration */}
          {!isLogin && (
            <div className="flex items-center justify-center gap-2 mt-5">
              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${step === 1 ? 'text-primary' : 'text-on-surface-variant'}`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-primary text-on-primary shadow-neu-xs' : 'bg-surface-container shadow-neu-inset-xs'}`}
                >
                  {step > 1 ? <CheckCircle size={14} /> : '1'}
                </span>
                Required
              </div>
              <div className="w-8 h-px bg-outline-variant" />
              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${step === 2 ? 'text-primary' : 'text-on-surface-variant'}`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-primary text-on-primary shadow-neu-xs' : 'bg-surface-container shadow-neu-inset-xs'}`}
                >
                  2
                </span>
                Optional
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-8 pb-8">
          {error && (
            <div className="bg-surface shadow-neu-inset-xs text-neu-error px-4 py-3 rounded-neu-lg mb-5 flex items-center">
              <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* ─── LOGIN FORM ─── */}
          {isLogin && !showForgotPassword && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <Field icon={Mail} label="Email address">
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldInputClass}
                  placeholder="you@example.com"
                />
              </Field>
              <Field
                icon={Lock}
                label="Password"
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotPassword(true);
                      setError(null);
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                }
              >
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  minLength="6"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldInputClass}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-outline hover:text-on-surface-variant shrink-0"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </Field>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3.5 px-4 rounded-full text-sm font-bold text-on-primary bg-primary shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset disabled:opacity-50 transition-all duration-200"
              >
                {loading ? <Loader size={20} className="animate-spin" /> : 'Sign In'}
              </button>
            </form>
          )}

          {/* ─── FORGOT PASSWORD ─── */}
          {isLogin && showForgotPassword && (
            <div className="space-y-5">
              {forgotSent ? (
                <div className="text-center py-4">
                  <MailCheck size={36} className="text-secondary mx-auto mb-3" />
                  <p className="text-sm text-on-surface-variant">
                    If <strong className="text-on-surface">{forgotEmail}</strong> is registered, a
                    reset link is on its way. Check your inbox — the link expires in 30 minutes.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <Field icon={Mail} label="Email address">
                    <input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className={fieldInputClass}
                      placeholder="you@example.com"
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full flex justify-center py-3.5 px-4 rounded-full text-sm font-bold text-on-primary bg-primary shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset disabled:opacity-50 transition-all duration-200"
                  >
                    {forgotLoading ? (
                      <Loader size={20} className="animate-spin" />
                    ) : (
                      'Send Reset Link'
                    )}
                  </button>
                </form>
              )}
              <button
                type="button"
                onClick={() => {
                  setShowForgotPassword(false);
                  setForgotSent(false);
                  setForgotEmail('');
                  setError(null);
                }}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-on-surface-variant hover:text-on-surface font-medium py-2 transition-colors"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>
          )}

          {/* ─── REGISTER STEP 1: Required Fields ─── */}
          {!isLogin && step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-4">
              <Field icon={User} label="Full Name *">
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={fieldInputClass}
                  placeholder="Your full name"
                />
              </Field>
              <Field icon={Mail} label="Email address *">
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={fieldInputClass}
                  placeholder="you@example.com"
                />
              </Field>
              <Field icon={Lock} label="Password *">
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength="6"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={fieldInputClass}
                  placeholder="Min 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-outline hover:text-on-surface-variant shrink-0"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </Field>
              <Field icon={Lock} label="Confirm Password *">
                <input
                  id="reg-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength="6"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={fieldInputClass}
                  placeholder="Re-enter your password"
                />
              </Field>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-full text-sm font-bold text-on-primary bg-primary shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset transition-all duration-200"
              >
                Continue <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* ─── REGISTER STEP 2: Optional Fields ─── */}
          {!isLogin && step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field icon={Phone} label="Phone Number">
                <input
                  id="reg-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={fieldInputClass}
                  placeholder="+91 98765 43210"
                />
              </Field>
              <div>
                <label className="text-xs font-bold tracking-wide uppercase text-on-surface-variant flex items-center gap-1.5 mb-1.5">
                  <BookMarked size={13} /> Favorite Genre
                </label>
                <select
                  id="reg-genre"
                  value={favoriteGenre}
                  onChange={(e) => setFavoriteGenre(e.target.value)}
                  className={selectClass}
                >
                  <option value="">— Select a genre (optional) —</option>
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold tracking-wide uppercase text-on-surface-variant flex items-center gap-1.5 mb-1.5">
                  <FileText size={13} /> Short Bio
                </label>
                <textarea
                  id="reg-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  rows={3}
                  className={`${selectClass} resize-none`}
                  placeholder="A book lover who enjoys rainy evenings and fiction…"
                />
                <p className="text-xs text-outline text-right mt-1">{bio.length}/280</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-1.5 flex-1 py-3 px-4 rounded-full text-sm font-bold text-on-surface bg-surface shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex justify-center py-3 px-4 rounded-full text-sm font-bold text-on-primary bg-primary shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset disabled:opacity-50 transition-all duration-200"
                >
                  {loading ? <Loader size={20} className="animate-spin" /> : 'Create Account'}
                </button>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleSkipAndRegister}
                className="w-full text-center text-sm text-primary hover:underline font-semibold py-2 transition-colors"
              >
                Skip for now →
              </button>
            </form>
          )}

          {/* Toggle Login / Signup */}
          {!(isLogin && showForgotPassword) && (
            <p className="mt-6 text-center text-sm text-on-surface-variant">
              {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  resetForm();
                }}
                className="font-bold text-primary hover:underline transition-colors"
              >
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
