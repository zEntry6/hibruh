// backend/src/controllers/messageController.js
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// ambil messages dengan pagination
exports.getMessages = async (req, res) => {
  try {
    const conversationId = req.params.id;
    const limit = parseInt(req.query.limit, 10) || 30;
    const beforeParam = req.query.before;

    const conv = await Conversation.findById(conversationId);
    if (!conv) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const query = { conversationId };

    if (beforeParam) {
      const beforeDate = new Date(beforeParam);
      if (!isNaN(beforeDate.getTime())) {
        query.createdAt = { $lt: beforeDate };
      }
    }

    // ambil dari yang terbaru dulu
    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('senderId', 'username displayName avatarUrl')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'senderId',
          select: 'username displayName avatarUrl'
        }
      })
      .lean();

    const hasMore = messages.length === limit;

    const formatted = messages
      .reverse()
      .map((m) => ({
        id: m._id,
        conversationId: m.conversationId,
        text: m.text,
        type: m.type,
        createdAt: m.createdAt,
        status: m.status || 'sent',
        isEdited: m.isEdited || false,
        editedAt: m.editedAt || null,
        isDeleted: m.isDeleted || false,
        deletedAt: m.deletedAt || null,
        replyTo: m.replyTo
          ? {
              id: m.replyTo._id,
              text: m.replyTo.text,
              isDeleted: m.replyTo.isDeleted || false,
              sender: m.replyTo.senderId
                ? {
                    id: m.replyTo.senderId._id,
                    username: m.replyTo.senderId.username,
                    displayName: m.replyTo.senderId.displayName,
                    avatarUrl: m.replyTo.senderId.avatarUrl
                  }
                : null
            }
          : null,
        sender: {
          id: m.senderId._id,
          username: m.senderId.username,
          displayName: m.senderId.displayName,
          avatarUrl: m.senderId.avatarUrl
        },
        reactions: (m.reactions || []).map((r) => ({
          emoji: r.emoji,
          count: r.users.length,
          reactedByMe: r.users.some(
            (u) => String(u) === String(req.user._id)
          )
        })),
        starCount: (m.starredBy || []).length,
        starredByMe: (m.starredBy || []).some(
          (u) => String(u) === String(req.user._id)
        )
      }));

    return res.json({
      messages: formatted,
      hasMore
    });
  } catch (err) {
    console.error('getMessages error', err.message);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

// ====== TAMBAHKAN FUNGSI BARU DI BAWAH SINI ======
exports.searchMessages = async (req, res) => {
  try {
    let { q, conversationId, page = 1, limit = 20 } = req.query;

    if (!q || !q.trim() || q.trim().length < 2) {
      return res
        .status(400)
        .json({ message: 'Query (q) minimal 2 karakter' });
    }

    q = q.trim();
    page = Number(page) || 1;
    limit = Math.min(Number(limit) || 20, 50);
    const skip = (page - 1) * limit;

    // cari conversation yang boleh diakses user
    let allowedConversationIds = [];

    if (conversationId) {
      const conv = await Conversation.findById(conversationId).select(
        '_id participants isGroup name avatarUrl'
      );
      if (!conv) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const isParticipant = conv.participants.some(
        (p) => String(p) === String(req.user._id)
      );
      if (!isParticipant) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      allowedConversationIds = [conv._id];
    } else {
      const convs = await Conversation.find({
        participants: req.user._id
      }).select('_id');

      if (!convs.length) {
        return res.json({
          items: [],
          page: 1,
          pageSize: limit,
          total: 0
        });
      }

      allowedConversationIds = convs.map((c) => c._id);
    }

    // filter pesan: hanya yang bukan deleted dan mengandung q (case-insensitive)
    const filter = {
      conversationId: { $in: allowedConversationIds },
      isDeleted: { $ne: true },
      text: { $regex: q, $options: 'i' }
    };

    const total = await Message.countDocuments(filter);

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('senderId', 'username displayName avatarUrl')
      .populate('conversationId', 'isGroup name avatarUrl');

    const items = messages.map((m) => ({
      id: m._id,
      text: m.text,
      type: m.type,
      createdAt: m.createdAt,
      status: m.status,
      isEdited: m.isEdited,
      isDeleted: m.isDeleted,
      sender: m.senderId && {
        id: m.senderId._id,
        username: m.senderId.username,
        displayName: m.senderId.displayName,
        avatarUrl: m.senderId.avatarUrl
      },
      conversation: m.conversationId && {
        id: m.conversationId._id,
        isGroup: m.conversationId.isGroup,
        name: m.conversationId.name,
        avatarUrl: m.conversationId.avatarUrl
      },
      starCount: (m.starredBy || []).length,
      starredByMe: (m.starredBy || []).some(
        (u) => String(u) === String(req.user._id)
      )
    }));

    return res.json({
      items,
      page,
      pageSize: limit,
      total
    });
  } catch (err) {
    console.error('searchMessages error', err.message);
    res.status(500).json({ message: 'Failed to search messages' });
  }
};

exports.reactToMessage = async (req, res) => {
  try {
    const { id } = req.params; // messageId
    const { emoji } = req.body;
    const userId = req.user._id;

    if (!emoji || typeof emoji !== 'string' || emoji.trim().length === 0) {
      return res.status(400).json({ message: 'Emoji is required' });
    }

    const message = await Message.findById(id).populate('conversationId');
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // pastikan user adalah participant conversation
    const conv = message.conversationId;
    const isParticipant = conv.participants.some(
      (p) => String(p) === String(userId)
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // toggle reaction
    const emojiKey = emoji.trim();
    const reactions = message.reactions || [];
    const existing = reactions.find((r) => r.emoji === emojiKey);

    if (!existing) {
      // belum ada reaction emoji ini sama sekali -> tambah
      reactions.push({
        emoji: emojiKey,
        users: [userId]
      });
    } else {
      const alreadyReacted = existing.users.some(
        (u) => String(u) === String(userId)
      );
      if (alreadyReacted) {
        // user sudah react -> hapus dari list
        existing.users = existing.users.filter(
          (u) => String(u) !== String(userId)
        );
        // kalau sudah tidak ada user lain, hapus entry reaction
        if (existing.users.length === 0) {
          const idx = reactions.findIndex((r) => r.emoji === emojiKey);
          if (idx !== -1) reactions.splice(idx, 1);
        }
      } else {
        // belum react -> tambahkan user ke list
        existing.users.push(userId);
      }
    }

    message.reactions = reactions;
    await message.save();

    // kirim bentuk ringan ke frontend
    const formattedReactions = (message.reactions || []).map((r) => ({
      emoji: r.emoji,
      count: r.users.length,
      reactedByMe: r.users.some((u) => String(u) === String(userId))
    }));

    return res.json({
      messageId: message._id,
      reactions: formattedReactions
    });
  } catch (err) {
    console.error('reactToMessage error', err);
    return res.status(500).json({ message: 'Failed to react to message' });
  }
};

exports.toggleStarMessage = async (req, res) => {
  try {
    const { id } = req.params; // messageId
    const userId = req.user._id;

    const message = await Message.findById(id).populate('conversationId');
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    const conv = message.conversationId;
    const isParticipant = conv.participants.some(
      (p) => String(p) === String(userId)
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const starred = message.starredBy || [];
    const already = starred.some((u) => String(u) === String(userId));

    if (already) {
      message.starredBy = starred.filter(
        (u) => String(u) !== String(userId)
      );
    } else {
      message.starredBy = [...starred, userId];
    }

    await message.save();

    const starCount = (message.starredBy || []).length;
    const starredByMe = (message.starredBy || []).some(
      (u) => String(u) === String(userId)
    );

    return res.json({
      messageId: message._id,
      starCount,
      starredByMe
    });
  } catch (err) {
    console.error('toggleStarMessage error', err);
    return res.status(500).json({ message: 'Failed to toggle star' });
  }
};

exports.getStarredMessages = async (req, res) => {
  try {
    const userId = req.user._id;
    const { conversationId } = req.query;

    const filter = {
      starredBy: userId,
      isDeleted: { $ne: true }
    };

    if (conversationId) {
      const conv = await Conversation.findById(conversationId);
      if (!conv) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const isParticipant = conv.participants.some(
        (p) => String(p) === String(userId)
      );
      if (!isParticipant) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      filter.conversationId = conv._id;
    } else {
      // fallback: semua conversation yang user ikuti
      const convs = await Conversation.find({
        participants: userId
      }).select('_id');

      filter.conversationId = { $in: convs.map((c) => c._id) };
    }

    const messages = await Message.find(filter)
      .sort({ createdAt: -1 })
      .populate('senderId', 'username displayName avatarUrl')
      .populate('conversationId', 'isGroup name avatarUrl')
      .lean();

    const items = messages.map((m) => ({
      id: m._id,
      text: m.text,
      type: m.type,
      createdAt: m.createdAt,
      status: m.status,
      isEdited: m.isEdited,
      isDeleted: m.isDeleted,
      sender: m.senderId && {
        id: m.senderId._id,
        username: m.senderId.username,
        displayName: m.senderId.displayName,
        avatarUrl: m.senderId.avatarUrl
      },
      conversation: m.conversationId && {
        id: m.conversationId._id,
        isGroup: m.conversationId.isGroup,
        name: m.conversationId.name,
        avatarUrl: m.conversationId.avatarUrl
      },
      starCount: (m.starredBy || []).length,
      starredByMe: (m.starredBy || []).some(
        (u) => String(u) === String(userId)
      )
    }));

    return res.json({ items });
  } catch (err) {
    console.error('getStarredMessages error', err);
    return res
      .status(500)
      .json({ message: 'Failed to fetch starred messages' });
  }
};

// Detail read receipts untuk satu pesan
exports.getMessageReadReceipts = async (req, res) => {
  try {
    const { id } = req.params; // messageId
    const userId = req.user._id;

    // Cari message
    const message = await Message.findById(id).lean();
    if (!message) {
      return res.status(404).json({ message: 'Message not found' });
    }

    // Cari conversation + participants
    const conversation = await Conversation.findById(message.conversationId)
      .populate('participants', 'username displayName avatarUrl lastSeen')
      .lean();

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const participants = conversation.participants || [];

    // Pastikan requester adalah participant conversation
    const isParticipant = participants.some(
      (p) => String(p._id) === String(userId)
    );
    if (!isParticipant) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Ambil list userId yang sudah melihat pesan ini
    const seenByIds = (message.seenBy || []).map((u) => u.toString());

    const seenBy = participants
      .filter((p) => seenByIds.includes(p._id.toString()))
      .map((p) => ({
        id: p._id.toString(),
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl || '',
        lastSeen: p.lastSeen || null
      }));

    // User yang belum melihat (kecualikan sender sendiri)
    const notSeenBy = participants
      .filter(
        (p) =>
          p._id.toString() !== String(message.senderId) &&
          !seenByIds.includes(p._id.toString())
      )
      .map((p) => ({
        id: p._id.toString(),
        username: p.username,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl || '',
        lastSeen: p.lastSeen || null
      }));

    return res.json({
      messageId: message._id.toString(),
      conversationId: message.conversationId.toString(),
      seenBy,
      notSeenBy
    });
  } catch (err) {
    console.error('getMessageReadReceipts error', err);
    return res
      .status(500)
      .json({ message: 'Failed to fetch message read receipts' });
  }
};

