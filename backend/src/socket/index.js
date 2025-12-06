const jwt = require('jsonwebtoken');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

// userId -> jumlah socket aktif
const onlineUsers = new Map();

const registerSocket = (io) => {
  // middleware auth untuk setiap koneksi socket
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('No auth token'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Ambil user lengkap dari DB, termasuk avatarUrl
      const user = await User.findById(decoded.id).select(
        'username displayName avatarUrl'
      );

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.user = {
        id: user._id.toString(),
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl || null
      };

      next();
    } catch (err) {
      console.error('Socket auth error', err.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user.id;
    console.log('Socket connected', userId);

    // update online map
    const prevCount = onlineUsers.get(userId) || 0;
    onlineUsers.set(userId, prevCount + 1);

    // join ke room personal
    socket.join(`user:${userId}`);

    // kirim list user yang online saat ini ke client baru
    socket.emit('presence:onlineUsers', {
      userIds: Array.from(onlineUsers.keys())
    });

    // broadcast bahwa user ini online
    io.emit('presence:update', {
      userId,
      isOnline: true,
      lastSeen: null
    });

    socket.on('conversation:join', (conversationId) => {
      if (!conversationId) return;
      socket.join(`conv:${conversationId}`);
    });

    // kirim pesan
    socket.on('message:send', async ({ conversationId, text, replyToId }) => {
      try {
        if (!conversationId || !text) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const isParticipant = conversation.participants.some(
          (p) => String(p) === String(userId)
        );
        if (!isParticipant) return;

                // BLOKIR DM (tidak berlaku untuk group)
        if (!conversation.isGroup) {
          const participants = conversation.participants || [];
          const otherId = participants.find(
            (p) => String(p) !== String(userId)
          );

          if (otherId) {
            const users = await User.find({
              _id: { $in: [userId, otherId] }
            }).select('_id blockedUsers');

            const me = users.find(
              (u) => String(u._id) === String(userId)
            );
            const other = users.find(
              (u) => String(u._id) === String(otherId)
            );

            const meBlockedOther = (me?.blockedUsers || []).some(
              (id) => String(id) === String(otherId)
            );
            const otherBlockedMe = (other?.blockedUsers || []).some(
              (id) => String(id) === String(userId)
            );

            if (meBlockedOther || otherBlockedMe) {
              socket.emit('message:blocked', {
                conversationId,
                reason: meBlockedOther
                  ? 'You blocked this user.'
                  : 'You are blocked by this user.'
              });
              return;
            }
          }
        }

        // status awal: sent
        let msg = await Message.create({
          conversationId,
          senderId: userId,
          text,
          status: 'sent',
          replyTo: replyToId || null
        });

        // anggap pesan langsung "delivered" ke server
        msg.status = 'delivered';
        await msg.save();

        // populate replyTo untuk payload socket
        msg = await msg.populate({
          path: 'replyTo',
          populate: {
            path: 'senderId',
            select: 'username displayName avatarUrl'
          }
        });

        conversation.lastMessage = {
          messageId: msg._id,
          text,
          sender: userId,
          createdAt: msg.createdAt,
          status: msg.status,
          isEdited: msg.isEdited || false,
          isDeleted: msg.isDeleted || false
        };
        await conversation.save();

        const replyPayload = msg.replyTo
          ? {
              id: msg.replyTo._id,
              text: msg.replyTo.text,
              isDeleted: msg.replyTo.isDeleted || false,
              sender: msg.replyTo.senderId
                ? {
                    id: msg.replyTo.senderId._id,
                    username: msg.replyTo.senderId.username,
                    displayName: msg.replyTo.senderId.displayName,
                    avatarUrl: msg.replyTo.senderId.avatarUrl
                  }
                : null
            }
          : null;

        const payload = {
          id: msg._id,
          conversationId,
          text: msg.text,
          type: msg.type,
          createdAt: msg.createdAt,
          status: msg.status,
          isEdited: msg.isEdited || false,
          isDeleted: msg.isDeleted || false,
          replyTo: replyPayload,
          sender: {
            id: socket.user.id,
            username: socket.user.username,
            displayName: socket.user.displayName,
            avatarUrl: socket.user.avatarUrl || null
          }
        };

        io.to(`conv:${conversationId}`).emit('message:new', payload);

        // update list conversation (sidebar) untuk PENGIRIM
        io.to(`user:${userId}`).emit('conversation:update', {
          conversationId,
          lastMessage: conversation.lastMessage,
          updatedAt: conversation.updatedAt
        });

        // kirim conversation baru ke peserta lain (penerima)
        const populatedConv = await Conversation.findById(conversationId)
          .populate(
            'participants',
            'username displayName avatarUrl lastSeen'
          )
          .lean();

        populatedConv.participants.forEach((p) => {
          const pid = String(p._id);
          if (pid === String(userId)) return;

          const participantsShaped = populatedConv.participants.map(
            (pp) => ({
              id: pp._id.toString(),
              username: pp.username,
              displayName: pp.displayName,
              avatarUrl: pp.avatarUrl,
              lastSeen: pp.lastSeen
            })
          );

          const isGroup = !!populatedConv.isGroup;

          let otherParticipant = null;
          if (!isGroup) {
            const otherRaw = populatedConv.participants.find(
              (pp) => String(pp._id) !== pid
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
            ? populatedConv.name || 'New group'
            : otherParticipant?.displayName || otherParticipant?.username || '';

          const avatarUrl = isGroup
            ? populatedConv.avatarUrl || ''
            : otherParticipant?.avatarUrl || '';

          io.to(`user:${pid}`).emit('conversation:new', {
            id: populatedConv._id.toString(),
            isGroup,
            name,
            avatarUrl,
            participants: participantsShaped,
            otherParticipant: isGroup ? null : otherParticipant,
            lastMessage: populatedConv.lastMessage,
            updatedAt: populatedConv.updatedAt,
            unreadCount: 1
          });
        });

      } catch (err) {
        console.error('Socket message error', err.message);
      }
    });

    // conversation dilihat (mark seen + update lastReadAt untuk unread)
    socket.on('conversation:seen', async (conversationId) => {
      try {
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const viewerId = socket.user.id;

        const isParticipant = conversation.participants.some(
          (p) => String(p) === String(viewerId)
        );
        if (!isParticipant) return;

        // tandai semua pesan yang BUKAN dikirim viewer sebagai "seen"
        await Message.updateMany(
          {
            conversationId,
            senderId: { $ne: viewerId },
            status: { $ne: 'seen' }
          },
          {
            $set: { status: 'seen' },
            $addToSet: { seenBy: viewerId }
          }
        );

        // update readBy.lastReadAt untuk viewer
        if (!conversation.readBy) {
          conversation.readBy = [];
        }

        const now = new Date();
        const idx = conversation.readBy.findIndex(
          (r) => String(r.user) === String(viewerId)
        );

        if (idx === -1) {
          conversation.readBy.push({
            user: viewerId,
            lastReadAt: now
          });
        } else {
          conversation.readBy[idx].lastReadAt = now;
        }

        // update lastMessage status jika ada
        if (conversation.lastMessage) {
          conversation.lastMessage.status = 'seen';
        }

        await conversation.save();

        // broadcast agar pengirim bisa update status ke "seen"
        io.to(`conv:${conversationId}`).emit('conversation:seen', {
          conversationId,
          seenBy: viewerId
        });
      } catch (err) {
        console.error('Socket conversation:seen error', err.message);
      }
    });

        // edit message (hanya boleh pesan sendiri)
    socket.on(
      'message:edit',
      async ({ conversationId, messageId, text }) => {
        try {
          if (!conversationId || !messageId || !text) return;

          const msg = await Message.findById(messageId);
          if (!msg) return;

          if (String(msg.conversationId) !== String(conversationId)) return;
          if (String(msg.senderId) !== String(userId)) return;
          if (msg.isDeleted) return; // pesan yang sudah dihapus tidak bisa diedit

          msg.text = text;
          msg.isEdited = true;
          msg.editedAt = new Date();
          await msg.save();

          const conversation = await Conversation.findById(conversationId);
          if (conversation && conversation.lastMessage) {
            const lm = conversation.lastMessage;
            const isSame =
              (lm.messageId &&
                String(lm.messageId) === String(msg._id)) ||
              (!lm.messageId &&
                String(lm.sender) === String(msg.senderId) &&
                lm.createdAt &&
                msg.createdAt &&
                new Date(lm.createdAt).getTime() ===
                  new Date(msg.createdAt).getTime());

            if (isSame) {
              conversation.lastMessage.text = msg.text;
              conversation.lastMessage.isEdited = true;
              conversation.markModified('lastMessage');
              await conversation.save();
            }
          }

          io.to(`conv:${conversationId}`).emit('message:updated', {
            id: msg._id.toString(),
            conversationId,
            text: msg.text,
            status: msg.status,
            isEdited: msg.isEdited,
            editedAt: msg.editedAt,
            isDeleted: msg.isDeleted,
            deletedAt: msg.deletedAt,
            lastMessage: conversation?.lastMessage || null,
            updatedAt: conversation?.updatedAt || null
          });
        } catch (err) {
          console.error('Socket message:edit error', err.message);
        }
      }
    );

    // delete message (soft delete)
    socket.on(
      'message:delete',
      async ({ conversationId, messageId }) => {
        try {
          if (!conversationId || !messageId) return;

          const msg = await Message.findById(messageId);
          if (!msg) return;

          if (String(msg.conversationId) !== String(conversationId)) return;
          if (String(msg.senderId) !== String(userId)) return;
          if (msg.isDeleted) return;

          msg.isDeleted = true;
          msg.deletedAt = new Date();
          await msg.save();

          const conversation = await Conversation.findById(conversationId);
          if (!conversation) return;

          // cari pesan terakhir yang masih belum dihapus
          const lastVisible = await Message.findOne({
            conversationId,
            isDeleted: { $ne: true }
          })
            .sort({ createdAt: -1 })
            .lean();

          if (lastVisible) {
            conversation.lastMessage = {
              messageId: lastVisible._id,
              text: lastVisible.text,
              sender: lastVisible.senderId,
              createdAt: lastVisible.createdAt,
              status: lastVisible.status || 'sent',
              isEdited: !!lastVisible.isEdited,
              isDeleted: !!lastVisible.isDeleted
            };
          } else {
            conversation.lastMessage = null;
          }

          await conversation.save();

          io.to(`conv:${conversationId}`).emit('message:deleted', {
            id: msg._id.toString(),
            conversationId,
            isDeleted: true,
            deletedAt: msg.deletedAt,
            lastMessage: conversation.lastMessage,
            updatedAt: conversation.updatedAt
          });
        } catch (err) {
          console.error('Socket message:delete error', err.message);
        }
      }
    );

    // typing start
    socket.on('typing:start', async ({ conversationId }) => {
      try {
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const isParticipant = conversation.participants.some(
          (p) => String(p) === String(userId)
        );
        if (!isParticipant) return;

        io.to(`conv:${conversationId}`).emit('typing', {
          conversationId,
          userId,
          isTyping: true
        });
      } catch (err) {
        console.error('Socket typing:start error', err.message);
      }
    });

    // typing stop
    socket.on('typing:stop', async ({ conversationId }) => {
      try {
        if (!conversationId) return;

        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return;

        const isParticipant = conversation.participants.some(
          (p) => String(p) === String(userId)
        );
        if (!isParticipant) return;

        io.to(`conv:${conversationId}`).emit('typing', {
          conversationId,
          userId,
          isTyping: false
        });
      } catch (err) {
        console.error('Socket typing:stop error', err.message);
      }
    });

    socket.on('disconnect', async () => {
      console.log('Socket disconnected', userId);
      const prev = onlineUsers.get(userId) || 0;
      if (prev <= 1) {
        onlineUsers.delete(userId);
        const lastSeen = new Date();
        try {
          await User.findByIdAndUpdate(userId, { lastSeen });
        } catch (err) {
          console.error('Update lastSeen error', err.message);
        }
        io.emit('presence:update', {
          userId,
          isOnline: false,
          lastSeen
        });
      } else {
        onlineUsers.set(userId, prev - 1);
      }
    });
  });
};

module.exports = registerSocket;
