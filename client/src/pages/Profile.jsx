import React, { useContext, useState, useEffect } from 'react';
import AuthContext from '../context/AuthContext';
import ImageUploadField from '../components/ImageUploadField';
import { uploadAvatar } from '../services/uploadService';
import {
  LogOut,
  User,
  Mail,
  Phone,
  BookMarked,
  FileText,
  Calendar,
  Save,
  Edit3,
  CheckCircle,
  AlertCircle,
  Shield,
  Loader,
  X,
  Bell,
  Inbox,
} from 'lucide-react';

// Phase 11: the four reminder categories a user can opt in/out of, in the
// order they're shown. Keys must match server/models/User.js's
// notificationPrefs schema exactly.
const NOTIFICATION_PREF_OPTIONS = [
  {
    key: 'readingReminders',
    label: 'Daily reading reminders',
    hint: "Nudge me if I haven't logged reading today",
  },
  {
    key: 'continueReadingNudges',
    label: 'Continue-reading nudges',
    hint: "Remind me about books I've gone quiet on",
  },
  {
    key: 'goalReminders',
    label: 'Goal pace alerts',
    hint: "Tell me if I'm falling behind a reading goal",
  },
  { key: 'streakAlerts', label: 'Streak milestones', hint: 'Celebrate my 7/30/100-day streaks' },
];

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

const Profile = () => {
  const { user, logout, updateUser, updateNotificationPrefs } = useContext(AuthContext);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [savingPref, setSavingPref] = useState(null); // key currently in flight
  const [savingDigest, setSavingDigest] = useState(false); // Phase 12

  // Editable form state
  const [form, setForm] = useState({
    name: '',
    phone: '',
    bio: '',
    favoriteGenre: '',
    avatarUrl: '', // Phase 10
  });

  // Sync form with user data
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        bio: user.bio || '',
        favoriteGenre: user.favoriteGenre || '',
        avatarUrl: user.avatarUrl || '',
      });
    }
  }, [user]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      showToast('Name cannot be empty.', 'error');
      return;
    }
    setSaving(true);
    try {
      await updateUser(form);
      setIsEditing(false);
      showToast('Profile updated successfully! ✨', 'success');
    } catch (err) {
      showToast(err.message || 'Failed to save profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setForm({
      name: user?.name || '',
      phone: user?.phone || '',
      bio: user?.bio || '',
      favoriteGenre: user?.favoriteGenre || '',
      avatarUrl: user?.avatarUrl || '',
    });
    setIsEditing(false);
  };

  // Phase 11: toggle one notification preference. Optimistic — flips
  // immediately, rolls back with a toast if the PATCH fails.
  const handleTogglePref = async (key) => {
    const current = user?.notificationPrefs?.[key] ?? true;
    setSavingPref(key);
    try {
      await updateNotificationPrefs({ [key]: !current });
    } catch (err) {
      showToast(err.message || 'Failed to update preference.', 'error');
    } finally {
      setSavingPref(null);
    }
  };

  // Phase 12: toggle the weekly email digest — goes through updateUser
  // (PUT /auth/update-profile) since emailDigestOptIn is a plain top-level
  // profile field, not a nested notificationPrefs key.
  const handleToggleDigest = async () => {
    setSavingDigest(true);
    try {
      await updateUser({ emailDigestOptIn: !user?.emailDigestOptIn });
    } catch (err) {
      showToast(err.message || 'Failed to update preference.', 'error');
    } finally {
      setSavingDigest(false);
    }
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  // Initials for avatar
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const inputClass =
    'w-full rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 p-3 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 transition-all duration-200';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-8 relative">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            {isEditing ? (
              <ImageUploadField
                currentUrl={form.avatarUrl}
                uploadFn={uploadAvatar}
                maxSizeMB={2}
                shape="square"
                size={80}
                buttonClassName="text-white/90 hover:text-white underline underline-offset-2"
                onUploaded={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
              />
            ) : user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-20 h-20 rounded-2xl object-cover border-2 border-white/40 shadow-lg flex-shrink-0"
              />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-2xl font-bold text-white shadow-lg flex-shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white">{user?.name || 'User'}</h2>
              <p className="text-indigo-100 text-sm flex items-center gap-1.5 mt-1">
                <Mail size={14} /> {user?.email || ''}
              </p>
              {memberSince && (
                <p className="text-indigo-200 text-xs flex items-center gap-1.5 mt-1">
                  <Calendar size={12} /> Member since {memberSince}
                </p>
              )}
            </div>
          </div>

          {/* Edit / Cancel buttons */}
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="absolute top-6 right-6 flex items-center gap-1.5 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm rounded-lg hover:bg-white/30 transition-colors"
            >
              <Edit3 size={14} /> Edit Profile
            </button>
          ) : (
            <button
              onClick={handleCancel}
              className="absolute top-6 right-6 flex items-center gap-1.5 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 text-white text-sm rounded-lg hover:bg-white/30 transition-colors"
            >
              <X size={14} /> Cancel
            </button>
          )}
        </div>

        {/* Profile Body */}
        <div className="px-8 py-6 space-y-6">
          {/* ── Display Mode ── */}
          {!isEditing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoCard
                icon={<User size={18} className="text-indigo-500" />}
                label="Full Name"
                value={user?.name || '—'}
              />
              <InfoCard
                icon={<Mail size={18} className="text-indigo-500" />}
                label="Email"
                value={user?.email || '—'}
              />
              <InfoCard
                icon={<Phone size={18} className="text-indigo-500" />}
                label="Phone"
                value={user?.phone || 'Not set'}
              />
              <InfoCard
                icon={<BookMarked size={18} className="text-indigo-500" />}
                label="Favorite Genre"
                value={user?.favoriteGenre || 'Not set'}
              />
              <div className="sm:col-span-2">
                <InfoCard
                  icon={<FileText size={18} className="text-indigo-500" />}
                  label="Bio"
                  value={user?.bio || 'No bio yet — tell us about yourself!'}
                />
              </div>
            </div>
          )}

          {/* ── Edit Mode ── */}
          {isEditing && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1">
                  <User size={14} className="text-gray-400" /> Full Name{' '}
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  placeholder="Your full name"
                />
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Shield size={14} className="text-gray-400" />
                <span>
                  Email: <strong className="text-gray-700 dark:text-gray-300">{user?.email}</strong>
                </span>
                <span className="text-xs text-gray-400 ml-auto">(Cannot be changed)</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1">
                  <Phone size={14} className="text-gray-400" /> Phone Number
                </label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className={inputClass}
                  placeholder="+91 98765 43210"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1">
                  <BookMarked size={14} className="text-gray-400" /> Favorite Genre
                </label>
                <select
                  value={form.favoriteGenre}
                  onChange={(e) => setForm({ ...form, favoriteGenre: e.target.value })}
                  className={inputClass}
                >
                  <option value="">— Select a genre —</option>
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1.5 mb-1">
                  <FileText size={14} className="text-gray-400" /> Bio
                </label>
                <textarea
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  maxLength={280}
                  rows={3}
                  className={inputClass + ' resize-none'}
                  placeholder="Tell us about yourself and your reading habits…"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{form.bio.length}/280</p>
              </div>

              <button
                onClick={handleSave}
                disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 transition-all duration-200"
              >
                {saving ? (
                  <Loader size={18} className="animate-spin" />
                ) : (
                  <>
                    <Save size={16} /> Save Changes
                  </>
                )}
              </button>
            </div>
          )}

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-800" />

          {/* Notification Preferences (Phase 11) */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Bell size={16} className="text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Notification Preferences
              </h3>
            </div>
            <div className="space-y-1">
              {NOTIFICATION_PREF_OPTIONS.map(({ key, label, hint }) => {
                const enabled = user?.notificationPrefs?.[key] ?? true;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-4 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {label}
                      </p>
                      <p className="text-xs text-gray-400">{hint}</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={enabled}
                      aria-label={label}
                      disabled={savingPref === key}
                      onClick={() => handleTogglePref(key)}
                      className={`relative flex-shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200 disabled:opacity-50 ${
                        enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'
                      }`}
                      style={{ width: '2.5rem', height: '1.375rem' }}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                          enabled ? 'translate-x-[1.125rem]' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-800" />

          {/* Weekly Email Digest (Phase 12) */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <Inbox size={16} className="text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                Email Digest
              </h3>
            </div>
            <div className="flex items-center justify-between gap-4 py-1">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  Weekly reading recap
                </p>
                <p className="text-xs text-gray-400">
                  A Monday-morning email with books completed & pages read
                </p>
              </div>
              <button
                role="switch"
                aria-checked={user?.emailDigestOptIn || false}
                aria-label="Weekly reading recap"
                disabled={savingDigest}
                onClick={handleToggleDigest}
                className={`relative flex-shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50 ${
                  user?.emailDigestOptIn ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700'
                }`}
                style={{ width: '2.5rem', height: '1.375rem' }}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${
                    user?.emailDigestOptIn ? 'translate-x-[1.125rem]' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-800" />

          {/* Danger Zone */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sign Out</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Log out of your account on this device.
              </p>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-800 text-sm font-medium rounded-xl text-red-600 dark:text-red-400 bg-white dark:bg-gray-900 hover:bg-red-50 dark:hover:bg-red-950/40 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400 transition-all duration-200"
            >
              <LogOut size={16} className="mr-2" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Small display-only card for profile view mode
const InfoCard = ({ icon, label, value }) => (
  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {label}
      </span>
    </div>
    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">{value}</p>
  </div>
);

export default Profile;
