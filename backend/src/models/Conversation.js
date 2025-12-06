const mongoose = require('mongoose');
const { Schema } = mongoose;

const lastMessageSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, ref: 'Message' },
    text: String,
    sender: { type: Schema.Types.ObjectId, ref: 'User' },
    createdAt: Date,
    status: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent'
    },
    isEdited: {
      type: Boolean,
      default: false
    },
    isDeleted: {
      type: Boolean,
      default: false
    }
  },
  { _id: false }
);

const readBySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    lastReadAt: { type: Date, required: true }
  },
  { _id: false }
);

const conversationSchema = new Schema(
  {
    // ==== field baru untuk group ====
    isGroup: {
      type: Boolean,
      default: false
    },
    name: {
      type: String,
      trim: true
    },
    avatarUrl: {
      type: String,
      trim: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    admins: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    // =================================
    inviteCode: {
      type: String,
      trim: true,
      index: true
    },
    inviteCodeCreatedAt: {
      type: Date
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    lastMessage: {
      type: lastMessageSchema,
      default: null
    },
    // server-side tracking unread per user
    readBy: {
      type: [readBySchema],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conversation', conversationSchema);
