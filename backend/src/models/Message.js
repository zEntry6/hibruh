const mongoose = require('mongoose');
const { Schema } = mongoose;

const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    text: {
      type: String,
      trim: true,
      required: true
    },
    type: {
      type: String,
      enum: ['text', 'system'], // ← TAMBAH 'system'
      default: 'text'
    },
    systemType: {
      type: String,
      enum: [
        'group_created',
        'group_renamed',
        'group_member_added',
        'group_member_removed',
        'group_member_left',
        'group_avatar_changed'
      ],
      default: null
    },
    systemMeta: {
      type: Schema.Types.Mixed,
      default: null
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'seen'],
      default: 'sent'
    },
    seenBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: 'Message',
      default: null
    },

    // ====== EDIT / DELETE ======
    isEdited: {
      type: Boolean,
      default: false
    },
    editedAt: {
      type: Date
    },
    isDeleted: {
      type: Boolean,
      default: false
    },
    deletedAt: {
      type: Date
    },
    starredBy: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    reactions: [
      {
        emoji: { type: String, required: true },
        users: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
          }
        ]
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', messageSchema);
