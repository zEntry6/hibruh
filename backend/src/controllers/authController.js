const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const EmailVerificationToken = require('../models/EmailVerificationToken');
const RefreshToken = require('../models/RefreshToken');
const { sendPasswordResetEmail, sendEmailVerification} = require('../utils/mailer');

const REFRESH_TOKEN_COOKIE_NAME = 'hibruh_refresh';
const REFRESH_TOKEN_DAYS = Number(process.env.REFRESH_TOKEN_DAYS || 7);

const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      username: user.username,
      displayName: user.displayName
    },
    process.env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

async function issueTokens(user, res) {
  const accessToken = generateToken(user);

  const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
  const refreshTokenHash = crypto
    .createHash('sha256')
    .update(refreshTokenRaw)
    .digest('hex');

  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  );

  await RefreshToken.create({
    user: user._id,
    tokenHash: refreshTokenHash,
    expiresAt,
    revoked: false
  });

  const isProd = process.env.NODE_ENV === 'production';

  res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshTokenRaw, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    path: '/api/auth/refresh',
    maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
  });

  return accessToken;
}

async function createAndSendEmailVerification(user) {
  try {
    if (!user || !user._id || !user.email) return;

    // kalau sudah verified, tidak perlu kirim
    if (user.emailVerified === true) return;

    // hapus token verifikasi lama
    await EmailVerificationToken.deleteMany({ user: user._id });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 jam

    await EmailVerificationToken.create({
      user: user._id,
      tokenHash,
      expiresAt,
      used: false
    });

    const clientBase = process.env.CLIENT_URL || 'http://192.168.1.3:5173';
    const verifyUrl = `${clientBase.replace(
      /\/$/,
      ''
    )}/verify-email?token=${rawToken}`;

    await sendEmailVerification(user, verifyUrl);

    console.log(
      '[Email verification] URL for',
      user.email,
      ':',
      verifyUrl
    );
  } catch (err) {
    console.error('createAndSendEmailVerification error', err);
  }
}

exports.register = async (req, res) => {
  try {
    const { email, username, displayName, password } = req.body;

    if (!email || !username || !displayName || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    const existingUsername = await User.findOne({ username: username.toLowerCase() });
    if (existingUsername) {
      return res.status(400).json({ message: 'Username already taken' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email,
      username: username.toLowerCase(),
      displayName,
      passwordHash
    });

        // kirim email verifikasi, tapi tidak blokir flow register
    createAndSendEmailVerification(user).catch((err) => {
      console.error('Failed to send verification email after register', err);
    });

    const token = await issueTokens(user, res);

    return res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified === true,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio
      },
      token
    });
  } catch (err) {
    console.error('Register error', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;

    if (!emailOrUsername || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const query = emailOrUsername.includes('@')
      ? { email: emailOrUsername.toLowerCase() }
      : { username: emailOrUsername.toLowerCase() };

    const user = await User.findOne(query);
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = await issueTokens(user, res);

    return res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        emailVerified: user.emailVerified === true,
        username: user.username,
        displayName: user.displayName,
        isAdmin: user.isAdmin === true,
        avatarUrl: user.avatarUrl,
        bio: user.bio
      },
      token
    });
  } catch (err) {
    console.error('Login error', err.message);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.me = async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authenticated' });
  }
  return res.json({ user: req.user });
};

exports.forgotPassword = async (req, res) => {
  try {
    const { emailOrUsername } = req.body;

    if (!emailOrUsername || !emailOrUsername.trim()) {
      return res
        .status(400)
        .json({ message: 'Email or username is required' });
    }

    const identifier = emailOrUsername.trim().toLowerCase();

    const query = identifier.includes('@')
      ? { email: identifier }
      : { username: identifier };

    const user = await User.findOne(query);

    // Selalu respon sukses, walaupun user tidak ditemukan (jangan bocorkan)
    if (!user) {
      return res.status(200).json({
        message:
          'If an account with that email/username exists, a reset link has been sent.'
      });
    }

    // Hapus token sebelumnya untuk user ini
    await PasswordResetToken.deleteMany({ user: user._id });

    // Buat token baru
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 jam

    await PasswordResetToken.create({
      user: user._id,
      tokenHash,
      expiresAt,
      used: false
    });

    const clientBase = process.env.CLIENT_URL || 'http://192.168.1.3:5173';
    const resetUrl = `${clientBase.replace(/\/$/, '')}/reset-password?token=${rawToken}`;

    // kirim email reset
    try {
      await sendPasswordResetEmail(user, resetUrl);
    } catch (mailErr) {
      console.error('Error sending reset email', mailErr);
      // jangan kirim detail error ke client
    }

    console.log('[Password reset] Reset URL for', user.email, ':', resetUrl);

    const responsePayload = {
      message:
        'If an account with that email/username exists, a reset link has been sent.'
    };

    if (process.env.NODE_ENV !== 'production') {
      responsePayload.devResetUrl = resetUrl;
    }

    return res.status(200).json(responsePayload);

  } catch (err) {
    console.error('Forgot password error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res
        .status(400)
        .json({ message: 'Token and new password are required' });
    }

    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: 'Password must be at least 6 characters long' });
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const resetDoc = await PasswordResetToken.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() }
    }).populate('user');

    if (!resetDoc || !resetDoc.user) {
      return res
        .status(400)
        .json({ message: 'Invalid or expired reset token' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    resetDoc.user.passwordHash = passwordHash;
    await resetDoc.user.save();

    resetDoc.used = true;
    await resetDoc.save();

    // Opsional: bersihkan semua token reset lain untuk user ini
    await PasswordResetToken.deleteMany({ user: resetDoc.user._id });

    return res
      .status(200)
      .json({ message: 'Password has been reset. You can now sign in.' });
  } catch (err) {
    console.error('Reset password error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /auth/send-verification-email (protected)
exports.sendVerificationEmail = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.emailVerified === true) {
      return res.status(400).json({ message: 'Email is already verified' });
    }

    await createAndSendEmailVerification(user);

    return res.status(200).json({
      message: 'Verification email has been sent. Please check your inbox.'
    });
  } catch (err) {
    console.error('sendVerificationEmail error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /auth/refresh
exports.refreshToken = async (req, res) => {
  try {
    const rawToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

    if (!rawToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    const existing = await RefreshToken.findOne({
      tokenHash,
      revoked: false,
      expiresAt: { $gt: new Date() }
    });

    if (!existing) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const user = await User.findById(existing.user);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // rotate refresh token
    existing.revoked = true;
    await existing.save();

    const newAccessToken = generateToken(user);

    const newRefreshRaw = crypto.randomBytes(40).toString('hex');
    const newRefreshHash = crypto
      .createHash('sha256')
      .update(newRefreshRaw)
      .digest('hex');

    const expiresAt = new Date(
      Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
    );

    await RefreshToken.create({
      user: user._id,
      tokenHash: newRefreshHash,
      expiresAt,
      revoked: false
    });

    const isProd = process.env.NODE_ENV === 'production';

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, newRefreshRaw, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/api/auth/refresh',
      maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000
    });

    return res.status(200).json({
      token: newAccessToken
    });
  } catch (err) {
    console.error('Refresh token error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /auth/logout
exports.logout = async (req, res) => {
  try {
    const rawToken = req.cookies[REFRESH_TOKEN_COOKIE_NAME];

    if (rawToken) {
      const tokenHash = crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

      await RefreshToken.updateMany(
        { tokenHash },
        { $set: { revoked: true } }
      );
    }

    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
      path: '/api/auth/refresh'
    });

    return res.status(200).json({ message: 'Logged out' });
  } catch (err) {
    console.error('Logout error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// POST /auth/verify-email
exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res
        .status(400)
        .json({ message: 'Verification token is required' });
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const verificationDoc = await EmailVerificationToken.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() }
    }).populate('user');

    if (!verificationDoc || !verificationDoc.user) {
      return res
        .status(400)
        .json({ message: 'Invalid or expired verification token' });
    }

    const user = verificationDoc.user;
    const newEmail = verificationDoc.newEmail;

    // kalau ini token change-email (punya newEmail)
    if (newEmail) {
      const existing = await User.findOne({
        email: newEmail,
        _id: { $ne: user._id }
      });
      if (existing) {
        verificationDoc.used = true;
        await verificationDoc.save();

        return res.status(400).json({
          message:
            'This email address is already in use. Please try changing to a different email.'
        });
      }

      user.email = newEmail;
    }

    if (user.emailVerified !== true) {
      user.emailVerified = true;
    }
    await user.save();

    verificationDoc.used = true;
    await verificationDoc.save();

    await EmailVerificationToken.deleteMany({
      user: user._id,
      _id: { $ne: verificationDoc._id }
    });

    const successMsg = newEmail
      ? 'Email address updated and verified successfully.'
      : 'Email verified successfully. You can now use all features.';

    return res.status(200).json({
      message: successMsg
    });
  } catch (err) {
    console.error('verifyEmail error', err);
    return res.status(500).json({ message: 'Server error' });
  }
};
