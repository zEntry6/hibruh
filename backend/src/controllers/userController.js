const bcrypt = require('bcryptjs');
const User = require('../models/User');
const crypto = require('crypto');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const { sendEmailVerification } = require('../utils/mailer');

// GET /api/users?search=...
exports.searchUsers = async (req, res) => {
  try {
    const search = (req.query.search || '').trim();
    if (!search) {
      return res.json([]);
    }

    const regex = new RegExp(search, 'i');

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ username: regex }, { displayName: regex }]
    })
      .select('username displayName avatarUrl bio')
      .limit(20);

    return res.json(users);
  } catch (err) {
    console.error('Search users error', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/me
exports.getMe = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const safeUser = {
      id: user._id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || '',
      bio: user.bio || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return res.json({ user: safeUser });
  } catch (err) {
    console.error('Get me error', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/users/me
exports.updateMe = async (req, res) => {
  try {
    const userId = req.user._id;
    const { displayName, bio, avatarUrl } = req.body;

    const update = {};

    if (typeof displayName === 'string') {
      const trimmed = displayName.trim();
      if (!trimmed) {
        return res
          .status(400)
          .json({ message: 'Display name cannot be empty' });
      }
      if (trimmed.length > 50) {
        return res
          .status(400)
          .json({ message: 'Display name too long (max 50 characters)' });
      }
      update.displayName = trimmed;
    }

    if (typeof bio === 'string') {
      if (bio.length > 160) {
        return res
          .status(400)
          .json({ message: 'Bio too long (max 160 characters)' });
      }
      update.bio = bio;
    }

    if (typeof avatarUrl === 'string') {
      update.avatarUrl = avatarUrl.trim();
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: update },
      { new: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const safeUser = {
      id: user._id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl || '',
      bio: user.bio || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    };

    return res.json({ user: safeUser });
  } catch (err) {
    console.error('Update me error', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/me/conversation-settings
exports.getConversationSettings = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .select('pinnedConversations mutedConversations archivedConversations')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({
      pinnedIds: (user.pinnedConversations || []).map((id) =>
        id.toString()
      ),
      mutedIds: (user.mutedConversations || []).map((id) => id.toString()),
      archivedIds: (user.archivedConversations || []).map((id) =>
        id.toString()
      )
    });
  } catch (err) {
    console.error('Get conversation settings error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/users/me/conversation-settings
exports.updateConversationSettings = async (req, res) => {
  try {
    const userId = req.user._id;
    const { pinnedIds, mutedIds, archivedIds } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (Array.isArray(pinnedIds)) {
      user.pinnedConversations = pinnedIds;
    }
    if (Array.isArray(mutedIds)) {
      user.mutedConversations = mutedIds;
    }
    if (Array.isArray(archivedIds)) {
      user.archivedConversations = archivedIds;
    }

    await user.save();

    return res.json({
      pinnedIds: (user.pinnedConversations || []).map((id) =>
        id.toString()
      ),
      mutedIds: (user.mutedConversations || []).map((id) => id.toString()),
      archivedIds: (user.archivedConversations || []).map((id) =>
        id.toString()
      )
    });
  } catch (err) {
    console.error('Update conversation settings error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/users/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res
        .status(400)
        .json({
          message: 'Current password and new password are required'
        });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({
          message: 'New password must be at least 6 characters long'
        });
    }

    // req.user dari authMiddleware tidak membawa passwordHash,
    // jadi kita fetch ulang user lengkap dari DB.
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: 'Current password is incorrect' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    user.passwordHash = newHash;
    await user.save();

    return res
      .status(200)
      .json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error', err.message || err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/users/change-email
exports.changeEmail = async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;

    if (!newEmail || !currentPassword) {
      return res.status(400).json({
        message: 'New email and current password are required'
      });
    }

    const normalizedEmail = newEmail.trim().toLowerCase();

    if (!normalizedEmail.includes('@') || normalizedEmail.length < 5) {
      return res
        .status(400)
        .json({ message: 'Please provide a valid email address' });
    }

    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // tidak boleh sama dengan email sekarang
    if (user.email && user.email.toLowerCase() === normalizedEmail) {
      return res
        .status(400)
        .json({ message: 'This is already your current email address' });
    }

    // cek email sudah dipakai user lain atau belum
    const existing = await User.findOne({
      email: normalizedEmail,
      _id: { $ne: userId }
    });
    if (existing) {
      return res
        .status(400)
        .json({ message: 'This email is already in use' });
    }

    // verifikasi password sekarang
    const isMatch = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: 'Current password is incorrect' });
    }

    // hapus token verifikasi lama user ini
    await EmailVerificationToken.deleteMany({ user: user._id });

    // buat token baru
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

    await EmailVerificationToken.create({
      user: user._id,
      tokenHash,
      newEmail: normalizedEmail,
      expiresAt,
      used: false
    });

    const clientBase = process.env.CLIENT_URL || 'http://192.168.1.3:5173';
    const verifyUrl = `${clientBase.replace(
      /\/$/,
      ''
    )}/verify-email?token=${rawToken}`;

    // kirim email ke alamat BARU
    await sendEmailVerification(user, verifyUrl, normalizedEmail);

    console.log(
      '[Change email] Verification URL for',
      normalizedEmail,
      ':',
      verifyUrl
    );

    return res.status(200).json({
      message:
        'Verification link has been sent to your new email address. Please check your inbox.',
      newEmail: normalizedEmail
    });
  } catch (err) {
    console.error('Change email error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/me/blocked
exports.getBlockedUsers = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId)
      .select('blockedUsers')
      .populate('blockedUsers', 'username displayName avatarUrl lastSeen');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const items = (user.blockedUsers || []).map((u) => ({
      id: u._id.toString(),
      username: u.username,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl || '',
      lastSeen: u.lastSeen
    }));

    return res.json({ items });
  } catch (err) {
    console.error('Get blocked users error', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/users/:id/block
exports.blockUser = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const targetUserId = req.params.id;

    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user is required' });
    }

    if (targetUserId === currentUserId) {
      return res
        .status(400)
        .json({ message: 'You cannot block yourself' });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId).select('blockedUsers'),
      User.findById(targetUserId).select('_id')
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const alreadyBlocked = (currentUser.blockedUsers || []).some(
      (id) => id.toString() === targetUserId
    );

    if (!alreadyBlocked) {
      currentUser.blockedUsers = [
        ...(currentUser.blockedUsers || []),
        targetUserId
      ];
      await currentUser.save();
    }

    return res.status(200).json({ message: 'User blocked successfully' });
  } catch (err) {
    console.error('Block user error', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/users/:id/block
exports.unblockUser = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const targetUserId = req.params.id;

    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user is required' });
    }

    const currentUser = await User.findById(currentUserId).select(
      'blockedUsers'
    );

    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    currentUser.blockedUsers = (currentUser.blockedUsers || []).filter(
      (id) => id.toString() !== targetUserId
    );
    await currentUser.save();

    return res.status(200).json({ message: 'User unblocked successfully' });
  } catch (err) {
    console.error('Unblock user error', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/users/:id/block-status
exports.getBlockStatus = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const targetUserId = req.params.id;

    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user is required' });
    }

    if (targetUserId === currentUserId) {
      return res.json({ isBlockedByMe: false, hasBlockedMe: false });
    }

    const [currentUser, targetUser] = await Promise.all([
      User.findById(currentUserId).select('blockedUsers'),
      User.findById(targetUserId).select('blockedUsers')
    ]);

    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isBlockedByMe = (currentUser.blockedUsers || []).some(
      (id) => id.toString() === targetUserId
    );
    const hasBlockedMe = (targetUser.blockedUsers || []).some(
      (id) => id.toString() === currentUserId
    );

    return res.json({ isBlockedByMe, hasBlockedMe });
  } catch (err) {
    console.error('Get block status error', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

