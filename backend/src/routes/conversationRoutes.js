// backend/src/routes/conversationRoutes.js
const express = require('express');
const router = express.Router();

const auth = require('../middleware/authMiddleware');
const {
  getConversations,
  createConversation,
  getConversationsPaginated
} = require('../controllers/conversationController');

// endpoint baru: paginated
router.get('/paginated', auth, getConversationsPaginated);

// ambil semua percakapan user
router.get('/', auth, getConversations);

// buat percakapan baru / ambil existing conversation 1–1
router.post('/', auth, createConversation);

module.exports = router;
