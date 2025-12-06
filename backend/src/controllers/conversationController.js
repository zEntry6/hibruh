const Conversation = require('../models/Conversation');
const User = require('../models/User');
const Message = require('../models/Message');

const shapeConversation = (conv, currentUserId, unreadCount = 0) => {
  const participants = conv.participants || [];

  const shapedParticipants = participants.map((p) => ({
    id: p._id.toString(),
    username: p.username,
    displayName: p.displayName,
    avatarUrl: p.avatarUrl,
    lastSeen: p.lastSeen
  }));

  const isGroup = !!conv.isGroup;

  let otherParticipant = null;
  if (!isGroup) {
    const otherRaw = participants.find(
      (p) => p._id.toString() !== currentUserId.toString()
    );

    otherParticipant = otherRaw
      ? {
          id: otherRaw._id.toString(),
          username: otherRaw.username,
          displayName: otherRaw.displayName,
          avatarUrl: otherRaw.avatarUrl,
          lastSeen: otherRaw.lastSeen
        }
      : null;
  }

  const name = isGroup
    ? conv.name || 'New group'
    : otherParticipant?.displayName || otherParticipant?.username || '';

  const avatarUrl = isGroup
    ? conv.avatarUrl || ''
    : otherParticipant?.avatarUrl || '';

  // === tambahan: createdBy & admins ===
  const createdBy = conv.createdBy ? conv.createdBy.toString() : null;
  const admins = Array.isArray(conv.admins)
    ? conv.admins.map((id) => id.toString())
    : [];

  return {
    id: conv._id.toString(),
    isGroup,
    name,
    avatarUrl,
    participants: shapedParticipants,
    otherParticipant: isGroup ? null : otherParticipant,
    lastMessage: conv.lastMessage || null,
    updatedAt: conv.updatedAt,
    unreadCount,
    createdBy,
    admins,
    inviteCode: conv.inviteCode || null
  };
};

/**
 * GET /api/conversations
 * Mengambil semua percakapan user yang sedang login
 * + menghitung unreadCount di server.
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;

    const convs = await Conversation.find({
      participants: userId
    })
      .sort({ updatedAt: -1 })
      .populate('participants', 'username displayName avatarUrl lastSeen')
      .lean();

    const formatted = await Promise.all(
      convs.map(async (c) => {
        // ambil lastReadAt user ini dari readBy
        const entry = (c.readBy || []).find(
          (rb) => String(rb.user) === String(userId)
        );
        const lastReadAt = entry?.lastReadAt || null;

        const criteria = {
          conversationId: c._id,
          senderId: { $ne: userId }
        };

        if (lastReadAt) {
          criteria.createdAt = { $gt: lastReadAt };
        }

        const unreadCount = await Message.countDocuments(criteria);

        return shapeConversation(c, userId, unreadCount);
      })
    );

    res.json(formatted);
  } catch (err) {
    console.error('getConversations error', err.message);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
};

/**
 * GET /api/conversations/paginated
 * Query: ?limit=20&cursor=ISO_DATE
 * Response: { items, hasMore, nextCursor }
 */
const getConversationsPaginated = async (req, res) => {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit, 10) || 20;
    const cursor = req.query.cursor;

    const query = { participants: userId };

    // kalau ada cursor → ambil yang updatedAt < cursor (infinite scroll ke bawah)
    if (cursor) {
      const cursorDate = new Date(cursor);
      if (!isNaN(cursorDate.getTime())) {
        query.updatedAt = { $lt: cursorDate };
      }
    }

    const convs = await Conversation.find(query)
      .sort({ updatedAt: -1 })
      .limit(limit + 1) // ambil 1 ekstra untuk deteksi hasMore
      .populate('participants', 'username displayName avatarUrl lastSeen')
      .lean();

    let hasMore = false;
    let slice = convs;

    if (convs.length > limit) {
      hasMore = true;
      slice = convs.slice(0, limit);
    }

    const items = await Promise.all(
      slice.map(async (c) => {
        const entry = (c.readBy || []).find(
          (rb) => String(rb.user) === String(userId)
        );
        const lastReadAt = entry?.lastReadAt || null;

        const criteria = {
          conversationId: c._id,
          senderId: { $ne: userId }
        };

        if (lastReadAt) {
          criteria.createdAt = { $gt: lastReadAt };
        }

        const unreadCount = await Message.countDocuments(criteria);

        return shapeConversation(c, userId, unreadCount);
      })
    );

    const nextCursor =
      hasMore && slice.length > 0
        ? slice[slice.length - 1].updatedAt.toISOString()
        : null;

    return res.json({
      items,
      hasMore,
      nextCursor
    });
  } catch (err) {
    console.error('getConversationsPaginated error', err.message);
    return res
      .status(500)
      .json({ message: 'Failed to fetch conversations (paginated)' });
  }
};

/**
 * POST /api/conversations
 * Body: { targetUserId }
 * Membuat (atau mengembalikan) percakapan 1–1 antara user & targetUser
 */
const createConversation = async (req, res) => {
  try {
    const userId = req.user.id;
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({ message: 'targetUserId required' });
    }

    if (targetUserId === userId) {
      return res
        .status(400)
        .json({ message: 'Cannot create conversation with yourself' });
    }

    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

        // CEK BLOKIR untuk DM 1–1
    const me = await User.findById(userId).select('blockedUsers');

    const meBlockedTarget = (me.blockedUsers || []).some(
      (id) => id.toString() === targetUserId
    );
    const targetBlockedMe = (targetUser.blockedUsers || []).some(
      (id) => id.toString() === userId
    );

    if (meBlockedTarget) {
      return res.status(403).json({
        message:
          'You have blocked this user. Unblock to start a conversation again.'
      });
    }

    if (targetBlockedMe) {
      return res.status(403).json({
        message: 'You are blocked by this user.'
      });
    }

    let conv = await Conversation.findOne({
      participants: { $all: [userId, targetUserId], $size: 2 }
    }).populate('participants', 'username displayName avatarUrl lastSeen');

    if (!conv) {
      conv = await Conversation.create({
        participants: [userId, targetUserId],
        lastMessage: null,
        readBy: [
          {
            user: userId,
            lastReadAt: new Date()
          }
        ]
      });
      conv = await conv.populate(
        'participants',
        'username displayName avatarUrl lastSeen'
      );
    }

    const base =
      typeof conv.toObject === 'function' ? conv.toObject() : conv;

    // conversation baru → unreadCount untuk creator = 0
    const shaped = shapeConversation(base, userId, 0);

    res.status(201).json(shaped);
  } catch (err) {
    console.error('createConversation error', err.message);
    res.status(500).json({ message: 'Failed to create conversation' });
  }
};

module.exports = {
  getConversations,
  createConversation,
  shapeConversation,
  getConversationsPaginated // <- ditambahkan supaya bisa dipakai controller group
};

