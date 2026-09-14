import mongoose from 'mongoose';

// Direct messages between two friends. Deliberately no separate
// "Conversation" model — for 1:1 chat, "the conversation between A and B" is
// just every Message with that (from,to) pair in either direction, and "my
// conversation list" is a group-by aggregation over this collection (see
// messageController.getConversations). A group-chat feature would need a
// Conversation model; this app only supports 1:1 friend DMs.
const messageSchema = new mongoose.Schema(
  {
    from: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
      index: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// "Messages between me and X, newest first" — covers both directions since
// a 1:1 thread is queried with an $or on (from,to)/(to,from).
messageSchema.index({ from: 1, to: 1, createdAt: -1 });
messageSchema.index({ to: 1, from: 1, createdAt: -1 });
// "How many unread messages do I have from X" / "list everyone who has
// unread messages to me" — used by getConversations' unread-count aggregation.
messageSchema.index({ to: 1, read: 1 });

const Message = mongoose.model('Message', messageSchema);
export default Message;
