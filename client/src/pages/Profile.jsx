import React, { useContext, useState, useEffect } from 'react';
import AuthContext from '../context/AuthContext';
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
} from 'lucide-react';

const GENRE_OPTIONS = [
  'Fiction', 'Non-Fiction', 'Science Fiction', 'Fantasy', 'Mystery',
  'Thriller', 'Romance', 'Biography', 'Self-Help', 'History',
  'Science', 'Technology', 'Philosophy', 'Poetry', 'Comics & Manga',
];

const Profile = () => {
  const { user, logout, updateUser } = useContext(AuthContext);

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Editable form state
  const [form, setForm] = useState({
    name: '',
    phone: '',
    bio: '',
    favoriteGenre: '',
  });

  // Sync form with user data
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        bio: user.bio || '',
        favoriteGenre: user.favoriteGenre || '',
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
    });
    setIsEditing(false);
  };

  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-IN', {
        year: 'numeric', month: 'long', day: 'numeric',
      })
    : '';

  // Initials for avatar
  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const inputClass =
    'w-full rounded-lg border border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 p-3 text-gray-900 placeholder-gray-400 transition-all duration-200';

  return (
    <div className="max-w-2xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium
          ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-8 py-8 relative">
          <div className="flex items-center gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/40 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {initials}
            </div>
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
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1">
                  <User size={14} className="text-gray-400" /> Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputClass}
                  placeholder="Your full name"
                />
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 flex items-center gap-2 text-sm text-gray-500">
                <Shield size={14} className="text-gray-400" />
                <span>Email: <strong className="text-gray-700">{user?.email}</strong></span>
                <span className="text-xs text-gray-400 ml-auto">(Cannot be changed)</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1">
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
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1">
                  <BookMarked size={14} className="text-gray-400" /> Favorite Genre
                </label>
                <select
                  value={form.favoriteGenre}
                  onChange={(e) => setForm({ ...form, favoriteGenre: e.target.value })}
                  className={inputClass}
                >
                  <option value="">— Select a genre —</option>
                  {GENRE_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5 mb-1">
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
                {saving ? <Loader size={18} className="animate-spin" /> : <><Save size={16} /> Save Changes</>}
              </button>
            </div>
          )}

          {/* Divider */}
          <hr className="border-gray-200" />

          {/* Danger Zone */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Sign Out</p>
              <p className="text-xs text-gray-500">Log out of your account on this device.</p>
            </div>
            <button
              onClick={logout}
              className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-xl text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-400 transition-all duration-200"
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
  <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
    <div className="flex items-center gap-2 mb-1">
      {icon}
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-sm font-medium text-gray-900 mt-1">{value}</p>
  </div>
);

export default Profile;
