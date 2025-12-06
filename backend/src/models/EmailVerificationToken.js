const mongoose = require('mongoose');
const { Schema } = mongoose;

const emailVerificationTokenSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    tokenHash: {
      type: String,
      required: true
    },
    newEmail: {
      type: String,
      lowercase: true,
      trim: true
    },
    expiresAt: {
      type: Date,
      required: true
    },
    used: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// TTL index: dokumen akan otomatis dihapus setelah expiresAt
emailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model(
  'EmailVerificationToken',
  emailVerificationTokenSchema
);
