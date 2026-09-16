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
  Lock,
  Sparkles,
  AlarmClock,
} from 'lucide-react';

// Phase 11: the four reminder categories a user can opt in/out of, in the
// order they're shown. Keys must match server/models/User.js's
// notificationPrefs schema exactly.
const NOTIFICATION_PREF_OPTIONS = [
  {
    key: 'readingReminders',
    icon: AlarmClock,
    label: 'Daily Reading Reminders',
    hint: "Nudge me if I haven't logged reading today",
  },
  {
    key: 'continueReadingNudges',
    icon: BookMarked,
    label: 'Continue-Reading Nudges',
    hint: "Remind me about books I've gone quiet on",
  },
  {
    key: 'goalReminders',
    icon: CheckCircle,
    label: 'Goal Pace Alerts',
    hint: "Tell me if I'm falling behind a reading goal",
  },
  {
    key: 'streakAlerts',
    icon: Sparkles,
    label: 'Streak Milestones',
    hint: 'Celebrate my 7/30/100-day streaks',
  },
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

// Neumorphic redesign ("Tactile Bibliotheca"): a tactile pill toggle — the
// track stays a constant inset groove regardless of state, only the knob's
// color/position/shadow changes (extruded + primary when on, flush + neutral
// when off). Matches Stitch's own `neumorphic-toggle` component exactly.
const Toggle = ({ checked, onChange, disabled, label }) => (
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className="relative w-14 h-8 rounded-full bg-surface shadow-neu-inset-sm transition-all p-1 shrink-0 disabled:opacity-50"
  >
    <span
      className={`block w-6 h-6 rounded-full transition-transform ${
        checked
          ? 'bg-primary shadow-neu-xs translate-x-6'
          : 'bg-surface-container-highest shadow-neu-xs translate-x-0'
      }`}
    />
  </button>
);

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
    'w-full rounded-neu-lg border-none bg-surface shadow-neu-inset-lg focus:shadow-neu-inset-focus focus:ring-0 p-3 text-on-surface placeholder:text-outline transition-all duration-200';

  return (
    <div className="max-w-3xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-neu-lg shadow-neu-xl text-sm font-medium bg-surface
          ${toast.type === 'success' ? 'text-secondary' : 'text-neu-error'}`}
        >
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary shadow-neu-xs" />
            <span className="text-xs text-secondary tracking-widest uppercase font-semibold">
              Curator Sanctuary
            </span>
          </div>
          <h1 className="font-display text-2xl text-on-surface tracking-tight font-bold">
            Profile &amp; Settings
          </h1>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2.5 rounded-full bg-surface-container-low text-on-surface text-sm font-medium shadow-neu-md hover:shadow-neu active:shadow-neu-inset flex items-center gap-1.5 transition-all shrink-0"
          >
            <Edit3 size={14} className="text-primary" /> Edit Profile
          </button>
        ) : (
          <button
            onClick={handleCancel}
            className="px-4 py-2.5 rounded-full bg-surface-container-low text-on-surface text-sm font-medium shadow-neu-md hover:shadow-neu active:shadow-neu-inset flex items-center gap-1.5 transition-all shrink-0"
          >
            <X size={14} /> Cancel
          </button>
        )}
      </div>

      {/* Identity banner */}
      <div className="relative overflow-hidden bg-surface-container-low rounded-neu-xl p-6 lg:p-8 shadow-neu-xl mb-8">
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-gradient-to-br from-primary-container/20 to-secondary-container/20 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6 text-center sm:text-left">
          <div className="relative shrink-0">
            {isEditing ? (
              <div className="w-32 h-32 rounded-full p-2 bg-surface-container-low shadow-neu-lg flex items-center justify-center">
                <ImageUploadField
                  currentUrl={form.avatarUrl}
                  uploadFn={uploadAvatar}
                  maxSizeMB={2}
                  shape="circle"
                  size={112}
                  buttonClassName="text-primary hover:text-on-surface underline underline-offset-2 text-xs"
                  onUploaded={(url) => setForm((f) => ({ ...f, avatarUrl: url }))}
                />
              </div>
            ) : (
              <div className="w-32 h-32 rounded-full p-2 bg-surface-container-low shadow-neu-lg flex items-center justify-center">
                <div className="w-full h-full rounded-full p-1 shadow-neu-inset overflow-hidden bg-surface flex items-center justify-center">
                  {user?.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.name}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <span className="text-3xl font-bold text-primary">{initials}</span>
                  )}
                </div>
              </div>
            )}
            <div className="absolute bottom-1 right-1 flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container shadow-neu-sm">
              <span className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_6px_rgba(55,103,88,0.7)] animate-pulse" />
              <span className="text-[0.6875rem] text-secondary font-bold">Online</span>
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="font-display text-2xl text-on-surface font-bold">
                {user?.name || 'User'}
              </h2>
              {user?.isPro && (
                <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-secondary-container/60 to-primary-container/40 shadow-neu-xs">
                  <Sparkles size={13} className="text-secondary" />
                  <span className="text-xs font-bold text-on-secondary-container tracking-wide">
                    Library Pro
                  </span>
                </div>
              )}
            </div>
            <p className="text-on-surface-variant text-sm flex items-center justify-center sm:justify-start gap-1.5">
              <Mail size={13} /> {user?.email || ''}
            </p>
            {memberSince && (
              <p className="text-on-surface-variant text-xs flex items-center justify-center sm:justify-start gap-1.5">
                <Calendar size={12} /> Member since {memberSince}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Personal dossier */}
      {!isEditing && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <InfoCard icon={<User size={15} />} label="Full Name" value={user?.name || '—'} />
          <InfoCard
            icon={<Lock size={15} />}
            label="Email"
            value={user?.email || '—'}
            badge="Verified"
          />
          <InfoCard icon={<Phone size={15} />} label="Phone" value={user?.phone || 'Not set'} />
          <InfoCard
            icon={<BookMarked size={15} />}
            label="Favorite Genre"
            value={user?.favoriteGenre || 'Not set'}
          />
          <div className="sm:col-span-2">
            <InfoCard
              icon={<FileText size={15} />}
              label="Bio"
              value={user?.bio || 'No bio yet — tell us about yourself!'}
            />
          </div>
        </div>
      )}

      {/* Edit mode */}
      {isEditing && (
        <div className="space-y-5 mb-8 p-5 bg-surface rounded-neu-xl shadow-neu-lg">
          <div>
            <label className="text-sm font-medium text-on-surface-variant flex items-center gap-1.5 mb-1">
              <User size={14} /> Full Name <span className="text-neu-error">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              placeholder="Your full name"
            />
          </div>

          <div className="p-3 bg-surface-container-low rounded-neu-lg shadow-neu-inset-xs flex items-center gap-2 text-sm text-on-surface-variant">
            <Shield size={14} />
            <span>
              Email: <strong className="text-on-surface">{user?.email}</strong>
            </span>
            <span className="text-xs text-outline ml-auto">(Cannot be changed)</span>
          </div>

          <div>
            <label className="text-sm font-medium text-on-surface-variant flex items-center gap-1.5 mb-1">
              <Phone size={14} /> Phone Number
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
            <label className="text-sm font-medium text-on-surface-variant flex items-center gap-1.5 mb-1">
              <BookMarked size={14} /> Favorite Genre
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
            <label className="text-sm font-medium text-on-surface-variant flex items-center gap-1.5 mb-1">
              <FileText size={14} /> Bio
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
              maxLength={280}
              rows={3}
              className={inputClass + ' resize-none'}
              placeholder="Tell us about yourself and your reading habits…"
            />
            <p className="text-xs text-outline text-right mt-1">{form.bio.length}/280</p>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-bold text-on-primary bg-primary shadow-neu-md hover:shadow-neu-sm active:shadow-neu-inset disabled:opacity-50 transition-all duration-200"
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

      {/* Notification preferences */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 mb-3">
          <Bell size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-on-surface">Notification Preferences</h3>
        </div>
        <div className="rounded-neu-xl bg-surface-container-low shadow-neu-lg p-3 space-y-1">
          {NOTIFICATION_PREF_OPTIONS.map(({ key, icon: Icon, label, hint }) => {
            const enabled = user?.notificationPrefs?.[key] ?? true;
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-4 p-2.5 rounded-neu-lg hover:bg-surface-container/40 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-surface-container-low shadow-neu-sm flex items-center justify-center text-primary shrink-0">
                    <Icon size={17} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-on-surface">{label}</p>
                    <p className="text-xs text-on-surface-variant">{hint}</p>
                  </div>
                </div>
                <Toggle
                  checked={enabled}
                  disabled={savingPref === key}
                  onChange={() => handleTogglePref(key)}
                  label={label}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Email digest */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 mb-3">
          <Inbox size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-on-surface">Email Digest</h3>
        </div>
        <div className="rounded-neu-xl bg-surface-container-low shadow-neu-lg p-3">
          <div className="flex items-center justify-between gap-4 p-2.5">
            <div className="min-w-0">
              <p className="text-sm font-bold text-on-surface">Weekly reading recap</p>
              <p className="text-xs text-on-surface-variant">
                A Monday-morning email with books completed &amp; pages read
              </p>
            </div>
            <Toggle
              checked={user?.emailDigestOptIn || false}
              disabled={savingDigest}
              onChange={handleToggleDigest}
              label="Weekly reading recap"
            />
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="flex items-center justify-between p-5 bg-surface rounded-neu-xl shadow-neu-lg">
        <div>
          <p className="text-sm font-bold text-on-surface">Sign Out</p>
          <p className="text-xs text-on-surface-variant">Log out of your account on this device.</p>
        </div>
        <button
          onClick={logout}
          className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold text-neu-error bg-surface shadow-neu-xs hover:shadow-neu-inset-sm transition-all"
        >
          <LogOut size={16} className="mr-2" />
          Sign Out
        </button>
      </div>
    </div>
  );
};

// Small display-only card for profile view mode — an inset "read-only field"
// row nested inside its own extruded outer card, per Stitch's dossier grid.
const InfoCard = ({ icon, label, value, badge }) => (
  <div className="p-4 rounded-neu-xl bg-surface-container-low shadow-neu-lg flex flex-col gap-1.5">
    <div className="flex items-center justify-between">
      <span className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
        {label}
      </span>
      {badge && (
        <span className="text-[11px] text-secondary font-semibold flex items-center gap-1">
          <CheckCircle size={11} /> {badge}
        </span>
      )}
    </div>
    <div className="flex items-center justify-between p-3 rounded-neu-lg bg-surface shadow-neu-inset-xs">
      <span className="text-sm text-on-surface font-semibold truncate">{value}</span>
      <span className="text-on-surface-variant shrink-0 ml-2">{icon}</span>
    </div>
  </div>
);

export default Profile;
