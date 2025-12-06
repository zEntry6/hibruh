const mongoose = require('mongoose');
const { Schema } = mongoose;

const reportSchema = new Schema(
  {
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    type: {
      type: String,
      enum: ['message', 'user'],
      required: true
    },
    messageId: {
      type: Schema.Types.ObjectId,
      ref: 'Message'
    },
    targetUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation'
    },
    reasonCode: {
      type: String,
      enum: ['spam', 'abuse', 'harassment', 'hate', 'self-harm', 'other'],
      required: true
    },
    reasonText: {
      type: String,
      trim: true
    },
    status: {
      type: String,
      enum: ['open', 'in_review', 'resolved', 'dismissed'],
      default: 'open'
    },
    resolvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    resolutionNote: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Report', reportSchema);
