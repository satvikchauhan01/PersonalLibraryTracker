import React, { useState, useContext } from 'react';
import AuthContext from '../context/AuthContext';
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
} from 'lucide-react';

const GENRE_OPTIONS = [
  'Fiction', 'Non-Fiction', 'Science Fiction', 'Fantasy', 'Mystery',
  'Thriller', 'Romance', 'Biography', 'Self-Help', 'History',
  'Science', 'Technology', 'Philosophy', 'Poetry', 'Comics & Manga',
];

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

  // Shared input styling
  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 p-3 text-gray-900 placeholder-gray-400 transition-all duration-200';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">
            {isLogin ? 'Welcome Back!' : step === 1 ? 'Create Your Account' : 'Almost There!'}
          </h2>
          <p className="text-indigo-100 text-sm mt-1">
            {isLogin
              ? 'Sign in to access your library & diary.'
              : step === 1
              ? 'Fill in the required details to get started.'
              : 'Add a few optional details about yourself.'}
          </p>

          {/* Step indicator for registration */}
          {!isLogin && (
            <div className="flex items-center justify-center gap-2 mt-4">
              <div className={`flex items-center gap-1.5 text-xs font-medium ${step === 1 ? 'text-white' : 'text-indigo-200'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? 'bg-white text-indigo-600' : 'bg-white/30 text-white'}`}>
                  {step > 1 ? <CheckCircle size={14} /> : '1'}
                </span>
                Required
              </div>
              <div className="w-8 h-px bg-indigo-300" />
              <div className={`flex items-center gap-1.5 text-xs font-medium ${step === 2 ? 'text-white' : 'text-indigo-300'}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? 'bg-white text-indigo-600' : 'bg-white/20 text-indigo-200'}`}>2</span>
                Optional
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-8 py-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 flex items-center">
              <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* ─── LOGIN FORM ─── */}
          {isLogin && (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Mail size={14} className="text-gray-400" /> Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Lock size={14} className="text-gray-400" /> Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    minLength="6"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass + ' pr-10'}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 transition-all duration-200"
              >
                {loading ? <Loader size={20} className="animate-spin" /> : 'Sign In'}
              </button>
            </form>
          )}

          {/* ─── REGISTER STEP 1: Required Fields ─── */}
          {!isLogin && step === 1 && (
            <form onSubmit={handleNextStep} className="space-y-4">
              <div>
                <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <User size={14} className="text-gray-400" /> Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  id="reg-name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                  placeholder="Satvik Chauhan"
                />
              </div>
              <div>
                <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Mail size={14} className="text-gray-400" /> Email address <span className="text-red-400">*</span>
                </label>
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Lock size={14} className="text-gray-400" /> Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength="6"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass + ' pr-10'}
                    placeholder="Min 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="reg-confirm-password" className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Lock size={14} className="text-gray-400" /> Confirm Password <span className="text-red-400">*</span>
                </label>
                <input
                  id="reg-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength="6"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Re-enter your password"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-indigo-500/30 transition-all duration-200"
              >
                Continue <ArrowRight size={16} />
              </button>
            </form>
          )}

          {/* ─── REGISTER STEP 2: Optional Fields ─── */}
          {!isLogin && step === 2 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="reg-phone" className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Phone size={14} className="text-gray-400" /> Phone Number
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div>
                <label htmlFor="reg-genre" className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <BookMarked size={14} className="text-gray-400" /> Favorite Genre
                </label>
                <select
                  id="reg-genre"
                  value={favoriteGenre}
                  onChange={(e) => setFavoriteGenre(e.target.value)}
                  className={inputClass}
                >
                  <option value="">— Select a genre (optional) —</option>
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="reg-bio" className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <FileText size={14} className="text-gray-400" /> Short Bio
                </label>
                <textarea
                  id="reg-bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={280}
                  rows={3}
                  className={inputClass + ' resize-none'}
                  placeholder="A book lover who enjoys rainy evenings and fiction…"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{bio.length}/280</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center justify-center gap-1.5 flex-1 py-3 px-4 rounded-xl text-sm font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 transition-all duration-200"
                >
                  {loading ? <Loader size={20} className="animate-spin" /> : 'Create Account'}
                </button>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleSkipAndRegister}
                className="w-full text-center text-sm text-indigo-600 hover:text-indigo-800 font-medium py-2 transition-colors"
              >
                Skip for now →
              </button>
            </form>
          )}

          {/* Toggle Login / Signup */}
          <p className="mt-6 text-center text-sm text-gray-600">
            {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                resetForm();
              }}
              className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
            >
              {isLogin ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthScreen;
