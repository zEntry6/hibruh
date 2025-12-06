const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter
} = require('../middleware/rateLimit');

router.post('/register', registerLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/me', authMiddleware, authController.me);

// forgot / reset password
router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  authController.forgotPassword
);
router.post(
  '/reset-password',
  resetPasswordLimiter,
  authController.resetPassword
);

// resend verification email (butuh login)
router.post(
  '/send-verification-email',
  authMiddleware,
  authController.sendVerificationEmail
);

// verify email (pakai token dari link)
router.post('/verify-email', authController.verifyEmail);

module.exports = router;
