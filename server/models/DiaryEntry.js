import mongoose from 'mongoose';

const diaryEntrySchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    // Date string in YYYY-MM-DD format - one entry per date per user
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    title: {
      type: String,
      default: '',
      maxlength: 150,
    },
    content: {
      type: String,
      default: '',
    },
    mood: {
      type: String,
      enum: ['happy', 'peaceful', 'inspired', 'productive', 'neutral', 'stressed', 'sad'],
      default: 'neutral',
    },
    tags: {
      type: [String],
      default: [],
    },
    // Optional: link to a book in user's library
    linkedBook: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Book',
      default: null,
    },
    // Up to 3 gratitude / highlight bullets
    gratitude: {
      type: [String],
      default: [],
      validate: [arr => arr.length <= 3, 'Maximum 3 gratitude bullets allowed'],
    },
    wordCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Unique compound index: one entry per user per date
diaryEntrySchema.index({ user: 1, date: 1 }, { unique: true });

const DiaryEntry = mongoose.model('DiaryEntry', diaryEntrySchema);
export default DiaryEntry;
