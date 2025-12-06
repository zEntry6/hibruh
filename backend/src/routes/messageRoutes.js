const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/search', authMiddleware, messageController.searchMessages);

// STARRED / PINNED messages
router.get(
  '/starred',
  authMiddleware,
  messageController.getStarredMessages
);

router.post(
  '/:id/star',
  authMiddleware,
  messageController.toggleStarMessage
);

// REACTION – toggle emoji untuk satu pesan
router.post(
  '/:id/reactions',
  authMiddleware,
  messageController.reactToMessage
);

// detail read receipts per message
router.get(
  '/:id/receipts',
  authMiddleware,
  messageController.getMessageReadReceipts
);

router.get('/:id', authMiddleware, messageController.getMessages);

module.exports = router;
