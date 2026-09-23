import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import argon2 from 'argon2';

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    // Admin moderation: a banned user can't log in or use an existing
    // session (see authMiddleware.protect and authController.loginUser).
    isBanned: {
      type: Boolean,
      default: false,
    },
    banReason: {
      type: String,
      default: '',
    },
    bannedAt: {
      type: Date,
      default: null,
    },
    phone: {
      type: String,
      default: '',
      match: [/^(\+?\d{7,15})?$/, 'Please enter a valid phone number'],
    },
    bio: {
      type: String,
      default: '',
      maxlength: 280,
    },
    favoriteGenre: {
      type: String,
      default: '',
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    // Personal Diary security fields
    diaryLockEnabled: {
      type: Boolean,
      default: false,
    },
    diaryPin: {
      type: String,
      default: null,
      select: false, // never returned in regular queries
    },
    // Phase 08: mutual friends list (kept in sync on both users when a
    // request is accepted — see friendController.acceptFriendRequest)
    friends: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
    },
    // Phase 09: Library Pro — the fast denormalized gate check. Subscription
    // (the full billing history/lifecycle) lives in its own collection;
    // this field is what every requirePro/quota check actually reads.
    isPro: {
      type: Boolean,
      default: false,
    },
    // Free-tier Gemini usage — reset the first time a call lands in a new
    // month (see middleware/checkAiQuota.js).
    aiCallCount: {
      type: Number,
      default: 0,
    },
    aiCallMonth: {
      type: String,
      default: null,
    },
    // Phase 11: per-category opt-outs for the reminder/notification system.
    // Read by services/notificationService.js before it ever creates a
    // notification — see PREF_KEY_BY_TYPE there for the type → key mapping.
    notificationPrefs: {
      readingReminders: { type: Boolean, default: true },
      goalReminders: { type: Boolean, default: true },
      continueReadingNudges: { type: Boolean, default: true },
      streakAlerts: { type: Boolean, default: true },
    },
    // Phase 12: password-reset flow. Same shape as diaryPin — a hash, never
    // the raw token, and select:false so a normal query never even risks
    // leaking it. Cleared (both fields, back to null) once the reset succeeds.
    passwordResetTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetExpires: {
      type: Date,
      default: null,
      select: false,
    },
    // Phase 12: opt-in weekly reading recap email — off by default, unlike
    // notificationPrefs' in-app reminders, since email is a higher-commitment ask.
    emailDigestOptIn: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving (Argon2id for anything new/changed)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next(); // bug fix: was missing `return`, so password got re-hashed on every save
  }
  this.password = await argon2.hash(this.password, { type: argon2.argon2id });
  next();
});

const isBcryptHash = (hash) => /^\$2[aby]\$/.test(hash);

// Compares entered password with the stored hash. Supports legacy bcrypt
// hashes: verifies with bcrypt, then transparently re-hashes with argon2id
// on success (lazy migration) — writes straight to the DB to avoid
// re-triggering the pre-save hook and double-hashing.
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (isBcryptHash(this.password)) {
    const isMatch = await bcrypt.compare(enteredPassword, this.password);
    if (isMatch) {
      const newHash = await argon2.hash(enteredPassword, { type: argon2.argon2id });
      this.password = newHash;
      await this.constructor.updateOne({ _id: this._id }, { $set: { password: newHash } });
    }
    return isMatch;
  }
  return argon2.verify(this.password, enteredPassword);
};

// Method to compare entered diary PIN with hashed PIN
userSchema.methods.matchDiaryPin = async function (enteredPin) {
  if (!this.diaryPin) return false;
  return await bcrypt.compare(String(enteredPin), this.diaryPin);
};

const User = mongoose.model('User', userSchema);
export default User;
