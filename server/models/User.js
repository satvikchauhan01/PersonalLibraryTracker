import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed password
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to compare entered diary PIN with hashed PIN
userSchema.methods.matchDiaryPin = async function (enteredPin) {
  if (!this.diaryPin) return false;
  return await bcrypt.compare(String(enteredPin), this.diaryPin);
};

const User = mongoose.model('User', userSchema);
export default User;
