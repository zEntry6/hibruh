import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_URL } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export const useSocket = (handlers = {}) => {
  const { token } = useAuth();
  const socketRef = useRef(null);

  // 1) Koneksi / disconnect socket, hanya tergantung token
  useEffect(() => {
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token }
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [token]);

  // 2) Registrasi event listener, selalu pakai handlers TERBARU
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const eventMap = [
      ['message:new', 'messageNew'],
      ['conversation:update', 'conversationUpdate'],
      ['conversation:seen', 'conversationSeen'],
      ['typing', 'typing'],
      ['conversation:new', 'conversationNew'],
      ['presence:onlineUsers', 'presenceBootstrap'], // ← TAMBAH INI
      ['presence:update', 'presenceUpdate'],
      ['message:updated', 'messageUpdated'],
      ['message:deleted', 'messageDeleted'],
      ['message:blocked', 'messageBlocked']
    ];

    // lepas listener lama lalu pasang yang baru
    eventMap.forEach(([event, key]) => {
      socket.off(event);
      const handler = handlers[key];
      if (handler) {
        socket.on(event, handler);
      }
    });

    // optional cleanup saat handlers berubah lagi
    return () => {
      eventMap.forEach(([event]) => {
        socket.off(event);
      });
    };
  }, [handlers]);

  const joinConversation = (conversationId) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('conversation:join', conversationId);
  };

  // >>> PENTING: sekarang kirim replyToId juga <<<
  const sendMessage = ({ conversationId, text, replyToId = null }) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('message:send', { conversationId, text, replyToId });
  };

  const markConversationSeen = (conversationId) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('conversation:seen', conversationId);
  };

  const startTyping = (conversationId) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('typing:start', { conversationId });
  };

  const stopTyping = (conversationId) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('typing:stop', { conversationId });
  };

  const editMessage = (conversationId, messageId, text) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('message:edit', { conversationId, messageId, text });
  };

  const deleteMessage = (conversationId, messageId) => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.emit('message:delete', { conversationId, messageId });
  };

  return {
    socket: socketRef.current,
    joinConversation,
    sendMessage,
    markConversationSeen,
    startTyping,
    stopTyping,
    editMessage,
    deleteMessage
  };
};
