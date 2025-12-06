const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

// profile current user
router.get('/me', authMiddleware, userController.getMe);
router.patch('/me', authMiddleware, userController.updateMe);

// conversation settings for current user
router.get(
  '/me/conversation-settings',
  authMiddleware,
  userController.getConversationSettings
);

router.patch(
  '/me/conversation-settings',
  authMiddleware,
  userController.updateConversationSettings
);

// search users
router.get('/', authMiddleware, userController.searchUsers);

// change password (current user)
router.post(
  '/change-password',
  authMiddleware,
  userController.changePassword
);

// change email (current user)
router.post(
  '/change-email',
  authMiddleware,
  userController.changeEmail
);

// list blocked users (current user)
router.get(
  '/me/blocked',
  authMiddleware,
  userController.getBlockedUsers
);

// block status terhadap user tertentu
router.get(
  '/:id/block-status',
  authMiddleware,
  userController.getBlockStatus
);

// block user
router.post(
  '/:id/block',
  authMiddleware,
  userController.blockUser
);

// unblock user
router.delete(
  '/:id/block',
  authMiddleware,
  userController.unblockUser
);

module.exports = router;

