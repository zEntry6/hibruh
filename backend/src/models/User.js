const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    displayName: {
      type: String,
      required: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    avatarUrl: {
      type: String,
      default: ''
    },
    bio: {
      type: String,
      default: ''
    },
    pinnedConversations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation'
      }
    ],
    mutedConversations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation'
      }
    ],
    archivedConversations: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation'
      }
    ],
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    isAdmin: {
      type: Boolean,
      default: false
    },
    lastSeen: {
      type: Date,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
