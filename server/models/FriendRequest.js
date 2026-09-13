import mongoose from 'mongoose';

const friendRequestSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined'],
      default: 'pending',
    },
  },
  { timestamps: true }
);

// One request per direction at a time — resending after a decline reuses
// this same document rather than piling up duplicates (see friendController).
friendRequestSchema.index({ from: 1, to: 1 }, { unique: true });
// Fast "my pending incoming requests" lookups
friendRequestSchema.index({ to: 1, status: 1 });

const FriendRequest = mongoose.model('FriendRequest', friendRequestSchema);
export default FriendRequest;
