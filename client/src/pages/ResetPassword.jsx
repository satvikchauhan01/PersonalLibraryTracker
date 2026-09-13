import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { BookOpen, Lock, Eye, EyeOff, Loader, AlertTriangle, CheckCircle } from 'lucide-react';
import api from '../services/api';

// Phase 12: reached via the link in the password-reset email
// (client/src/services/emailService... no — server/services/emailService.js
// builds this exact URL: `${clientOrigin}/reset-password/${rawToken}`).
const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const inputClass =
    'mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 p-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/auth/reset-password/${token}`, { password });
      setSuccess(true);
      setTimeout(() => navigate('/auth'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'This reset link is invalid or has expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-6 text-center">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white">Set a New Password</h2>
          <p className="text-indigo-100 text-sm mt-1">Choose a new password for your account.</p>
        </div>

        <div className="px-8 py-6">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle size={36} className="text-emerald-500 mx-auto mb-3" />
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Password reset! Every other session has been signed out. Redirecting you to log in…
              </p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl mb-5 flex items-center">
                  <AlertTriangle size={18} className="mr-2 flex-shrink-0" />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
                  >
                    <Lock size={14} className="text-gray-400" /> New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
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
                  <label
                    htmlFor="confirm-new-password"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5"
                  >
                    <Lock size={14} className="text-gray-400" /> Confirm Password
                  </label>
                  <input
                    id="confirm-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength="6"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={inputClass}
                    placeholder="Re-enter your new password"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 transition-all duration-200"
                >
                  {loading ? <Loader size={20} className="animate-spin" /> : 'Reset Password'}
                </button>
              </form>

              <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                <Link
                  to="/auth"
                  className="font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
                >
                  Back to Sign In
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
