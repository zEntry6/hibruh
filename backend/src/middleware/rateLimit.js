const rateLimit = require('express-rate-limit');

// Limit login: 10 percobaan / 15 menit per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 menit
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Too many login attempts from this IP. Please try again in 15 minutes.'
  }
});

// Limit register: 5 request / 60 menit per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Too many sign-up attempts from this IP. Please try again later.'
  }
});

// Limit forgot password: 5 request / 60 menit per IP
const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Too many password reset requests from this IP. Please try again later.'
  }
});

// Optional: limit reset password langsung (token sudah dikirim)
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 jam
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      'Too many password reset attempts from this IP. Please try again later.'
  }
});

module.exports = {
  loginLimiter,
  registerLimiter,
  forgotPasswordLimiter,
  resetPasswordLimiter
};
