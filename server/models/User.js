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
