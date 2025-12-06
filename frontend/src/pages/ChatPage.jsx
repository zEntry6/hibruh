import { useEffect, useState } from 'react';
import Shell from '../components/layout/Shell';
import TopBar from '../components/ui/TopBar';
import Sidebar from '../components/layout/Sidebar';
import ChatPanel from '../components/layout/ChatPanel';
import { api } from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';

const ChatPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
    // pagination list conversation
  const [convHasMore, setConvHasMore] = useState(true);
  const [convLoadingMore, setConvLoadingMore] = useState(false);
  const [convCursor, setConvCursor] = useState(null);

  const CONVERSATION_PAGE_SIZE = 20;

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // per-conversation settings (pinned / muted / archived)
  const [pinnedIds, setPinnedIds] = useState([]);
  const [mutedIds, setMutedIds] = useState([]);
  const [archivedIds, setArchivedIds] = useState([]);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

    // load pinned/muted/archived dari server (fallback ke localStorage kalau gagal)
  useEffect(() => {
    if (!user) return;

    const fetchSettings = async () => {
      try {
        const res = await api.get('/users/me/conversation-settings');
        const data = res.data || {};
        const serverPinned = Array.isArray(data.pinnedIds)
          ? data.pinnedIds
          : [];
        const serverMuted = Array.isArray(data.mutedIds) ? data.mutedIds : [];
        const serverArchived = Array.isArray(data.archivedIds)
          ? data.archivedIds
          : [];

        setPinnedIds(serverPinned);
        setMutedIds(serverMuted);
        setArchivedIds(serverArchived);

        try {
          localStorage.setItem('woy_pinned', JSON.stringify(serverPinned));
          localStorage.setItem('woy_muted', JSON.stringify(serverMuted));
          localStorage.setItem(
            'woy_archived',
            JSON.stringify(serverArchived)
          );
        } catch (err) {
          console.error('Failed to persist settings to localStorage', err);
        }
      } catch (err) {
        console.error('Failed to load conversation settings from server', err);
        // fallback: pakai localStorage kalau ada
        try {
          const pinnedStored = localStorage.getItem('woy_pinned');
          const mutedStored = localStorage.getItem('woy_muted');
          const archivedStored = localStorage.getItem('woy_archived');

          setPinnedIds(pinnedStored ? JSON.parse(pinnedStored) : []);
          setMutedIds(mutedStored ? JSON.parse(mutedStored) : []);
          setArchivedIds(archivedStored ? JSON.parse(archivedStored) : []);
        } catch (parseErr) {
          console.error('Failed to parse local conversation settings', parseErr);
        }
      } finally {
        setSettingsLoaded(true);
      }
    };

    fetchSettings();
  }, [user?.id]);

    // ====== NOTIFICATION STATE ======
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState('default'); // 'default' | 'granted' | 'denied'
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('woy_notif_enabled');
      if (stored === 'true') return true;
      if (stored === 'false') return false;
      return false;
    } catch {
      return false;
    }
  });

  const [verifyInfo, setVerifyInfo] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const isEmailVerified =
! user || user.emailVerified === undefined || user.emailVerified === true;

  const [pinnedMessages, setPinnedMessages] = useState([]);

  // presence per user: { [userId]: { isOnline, lastSeen } }
  const [presence, setPresence] = useState({});

  const [activeBlockStatus, setActiveBlockStatus] = useState({
    isBlockedByMe: false,
    hasBlockedMe: false
  });

  // mobile: layar list vs layar chat
  const [isMobileConversationVisible, setIsMobileConversationVisible] =
    useState(false);

  // typing indicator
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  // pagination pesan
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);

  // sinyal untuk auto scroll ke bawah
  const [scrollAnchor, setScrollAnchor] = useState(0);

  // target pesan dari GLOBAL SEARCH
  const [jumpTarget, setJumpTarget] = useState(null); // { conversationId, messageId }
  const [focusMessageIdFromGlobal, setFocusMessageIdFromGlobal] = useState(null);

  // setiap pinned/muted/archived berubah (setelah settingsLoaded),
  // simpan ke localStorage dan sync ke server
  useEffect(() => {
    if (!settingsLoaded || !user) return;

    try {
      localStorage.setItem('woy_pinned', JSON.stringify(pinnedIds));
      localStorage.setItem('woy_muted', JSON.stringify(mutedIds));
      localStorage.setItem('woy_archived', JSON.stringify(archivedIds));
    } catch (err) {
      console.error('Failed to persist conversation settings to localStorage', err);
    }

    api
      .patch('/users/me/conversation-settings', {
        pinnedIds,
        mutedIds,
        archivedIds
      })
      .catch((err) => {
        console.error('Failed to sync conversation settings to server', err);
      });
  }, [pinnedIds, mutedIds, archivedIds, settingsLoaded, user?.id]);

    // deteksi dukungan Notification API & sync permission awal
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      if (!('Notification' in window)) return;

      setNotificationsSupported(true);
      setNotificationPermission(Notification.permission);

      const stored = localStorage.getItem('woy_notif_enabled');

      // kalau user sudah pernah grant di browser tapi belum ada flag lokal
      if (Notification.permission === 'granted' && stored == null) {
        setNotificationsEnabled(true);
        localStorage.setItem('woy_notif_enabled', 'true');
      }
    } catch (err) {
      console.error('notification init error', err);
    }
  }, []);

  // simpan pilihan enable/disable ke localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'woy_notif_enabled',
        notificationsEnabled ? 'true' : 'false'
      );
    } catch (err) {
      console.error('notification persist error', err);
    }
  }, [notificationsEnabled]);

    // minta izin notifikasi ke browser
  const handleEnableNotifications = async () => {
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) return;

      const perm = await Notification.requestPermission();
      setNotificationPermission(perm);
      const enabled = perm === 'granted';
      setNotificationsEnabled(enabled);
    } catch (err) {
      console.error('request notification permission error', err);
    }
  };

  // tampilkan browser notification untuk pesan baru
  const showNotificationForMessage = (msg, isActiveConversation) => {
    try {
      if (!notificationsSupported) return;
      if (!notificationsEnabled) return;
      if (notificationPermission !== 'granted') return;
      if (!msg || !msg.text) return;

      // kalau conversation aktif dan tab kelihatan → tidak perlu notif
      const isHidden = typeof document !== 'undefined' ? document.hidden : false;
      const shouldNotifyBecauseHidden = isHidden;
      const shouldNotifyBecauseOtherConversation = !isActiveConversation;

      if (!shouldNotifyBecauseHidden && !shouldNotifyBecauseOtherConversation) {
        return;
      }

      // hormati mute: jangan kirim notif untuk conv yang di-mute
      if (Array.isArray(mutedIds) && mutedIds.includes(msg.conversationId)) {
        return;
      }

      // cari info conversation untuk judul notif
      const conv = conversations.find(
        (c) => c.id === msg.conversationId
      );
      const isGroup = conv?.isGroup;

      let title = 'New message';
      if (isGroup) {
        title = conv?.name || 'New group message';
      } else if (msg.sender) {
        title =
          msg.sender.displayName ||
          msg.sender.username ||
          title;
      }

      const rawBody = msg.text || '';
      const body =
        rawBody.length > 120 ? `${rawBody.slice(0, 117)}...` : rawBody;

      // kirim browser notification
      new Notification(title, {
        body
        // bisa ditambah icon di sini kalau nanti kamu punya asset: icon: '/icon-192.png'
      });
    } catch (err) {
      console.error('showNotificationForMessage error', err);
    }
  };

  const {
    joinConversation,
    sendMessage,
    markConversationSeen,
    startTyping,
    stopTyping,
    editMessage,
    deleteMessage
  } = useSocket({
messageNew: (msg) => {
  setConversations((prev) =>
    prev.map((c) => {
      if (c.id !== msg.conversationId) return c;

      const isFromMe = msg.sender.id === user.id;

      return {
        ...c,
        lastMessage: {
          text: msg.text,
          sender: msg.sender.id,
          createdAt: msg.createdAt,
          status: msg.status || 'sent'
        },
        unreadCount: isFromMe
          ? 0
          : activeConversation && activeConversation.id === c.id
          ? 0
          : (c.unreadCount || 0) + 1
      };
    })
  );

      // update panel chat aktif + scroll ke bawah
      if (activeConversation && activeConversation.id === msg.conversationId) {
        setMessages((prev) => [
          ...prev,
          {
            ...msg,
            status: msg.status || 'sent',
            sender: {
              ...msg.sender,
              isMe: msg.sender.id === user.id
            }
          }
        ]);
        setScrollAnchor((x) => x + 1);

        // kalau pesan dari lawan bicara dan kita lagi di chat ini → tandai seen di server
        if (msg.sender.id !== user.id) {
          markConversationSeen(msg.conversationId);
        }
      }
            // push notification (browser) untuk pesan baru
      if (msg.sender.id !== user.id) {
        const isActive =
          activeConversation &&
          activeConversation.id === msg.conversationId;
        showNotificationForMessage(msg, isActive);
      }
    },
    
    conversationUpdate: (update) => {
      setConversations((prev) => {
        // cari index conversation yang di-update
        const idx = prev.findIndex((c) => c.id === update.conversationId);
        if (idx === -1) return prev;

        const target = prev[idx];

        // update lastMessage + updatedAt, tapi JANGAN sentuh unreadCount
        const updatedConv = {
          ...target,
          lastMessage: update.lastMessage || target.lastMessage,
          updatedAt: update.updatedAt || target.updatedAt
        };

        // hapus dari posisi lama
        const rest = [...prev];
        rest.splice(idx, 1);

        // masukkan di paling atas
        return [updatedConv, ...rest];
      });
    },

    conversationSeen: ({ conversationId, seenBy }) => {
      if (seenBy === user.id) return;

      setMessages((prev) => {
        if (!activeConversation || activeConversation.id !== conversationId) {
          return prev;
        }
        return prev.map((m) => {
          if (m.sender?.id === user.id) {
            return { ...m, status: 'seen' };
          }
          return m;
        });
      });

      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId && c.lastMessage
            ? {
                ...c,
                lastMessage: {
                  ...c.lastMessage,
                  status: 'seen'
                }
              }
            : c
        )
      );
    },
    typing: ({ conversationId, userId, isTyping }) => {
      if (
        !activeConversation ||
        activeConversation.id !== conversationId ||
        userId === user.id
      ) {
        return;
      }
      setIsOtherTyping(isTyping);
    },
    conversationNew: (conv) => {
      setConversations((prev) => {
        if (prev.some((c) => c.id === conv.id)) {
          return prev;
        }
        return [conv, ...prev];
      });

      const other = conv.otherParticipant;
      if (other?.id && other.lastSeen) {
        setPresence((prev) => ({
          ...prev,
          [other.id]: {
            ...(prev[other.id] || {}),
            isOnline: prev[other.id]?.isOnline || false,
            lastSeen: other.lastSeen
          }
        }));
      }
    },
    presenceBootstrap: ({ userIds }) => {
      setPresence((prev) => {
        const updated = { ...prev };
        userIds.forEach((id) => {
          updated[id] = { ...(updated[id] || {}), isOnline: true };
        });
        return updated;
      });
    },
    presenceUpdate: ({ userId, isOnline, lastSeen }) => {
      setPresence((prev) => ({
        ...prev,
        [userId]: {
          ...(prev[userId] || {}),
          isOnline,
          lastSeen: lastSeen || prev[userId]?.lastSeen || null
        }
      }));
    },
    // pesan di-edit
    messageUpdated: (msg) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                text: msg.text,
                status: msg.status || m.status,
                isEdited: msg.isEdited,
                editedAt: msg.editedAt,
                isDeleted: msg.isDeleted,
                deletedAt: msg.deletedAt
              }
            : m
        )
      );

      if (msg.lastMessage) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === msg.conversationId
              ? {
                  ...c,
                  lastMessage: msg.lastMessage,
                  updatedAt: msg.updatedAt || c.updatedAt
                }
              : c
          )
        );
      }
    },

    // pesan di-delete
    messageDeleted: (msg) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id
            ? {
                ...m,
                isDeleted: true,
                deletedAt: msg.deletedAt,
                // optional: kosongkan text di UI
                text: m.text
              }
            : m
        )
      );

      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                lastMessage: msg.lastMessage || null,
                updatedAt: msg.updatedAt || c.updatedAt
              }
            : c
        )
      );
    },
    messageBlocked: (payload) => {
      if (!payload) return;
      if (payload.reason) {
        window.alert(payload.reason);
      } else {
        window.alert('You cannot send messages in this conversation.');
      }
    }
  });

  // load conversations awal (paginated)
  useEffect(() => {
    const fetchInitialConversations = async () => {
      try {
        const res = await api.get('/conversations/paginated', {
          params: { limit: CONVERSATION_PAGE_SIZE }
        });

        const { items, hasMore, nextCursor } = res.data;

        const conv = (items || []).map((c) => ({
          ...c,
          unreadCount: c.unreadCount || 0
        }));

        setConversations(conv);
        setConvHasMore(!!hasMore);
        setConvCursor(nextCursor || null);

        if (conv.length > 0) {
          setActiveConversation((prev) => prev || conv[0]);
        }

        // seed presence dengan lastSeen dari otherParticipant
        const seed = {};
        conv.forEach((c) => {
          const other = c.otherParticipant;
          if (other?.id && other.lastSeen) {
            seed[other.id] = {
              isOnline: false,
              lastSeen: other.lastSeen
            };
          }
        });
        setPresence((prev) => ({ ...seed, ...prev }));
      } catch (err) {
        console.error('Failed to load conversations (paginated)', err);
      }
    };

    fetchInitialConversations();
  }, []);

  const mapMessages = (raw) =>
    raw.messages
      ? // kalau backend mengirim { messages, hasMore }
        raw.messages.map((m) => ({
          ...m,
          status: m.status || 'sent',
          sender: {
            ...m.sender,
            isMe: m.sender.id === user.id
          }
        }))
      : raw.map((m) => ({
          ...m,
          status: m.status || 'sent',
          sender: {
            ...m.sender,
            isMe: m.sender.id === user.id
          }
        }));

  // load batch pertama ketika activeConversation berubah
  useEffect(() => {
    if (!activeConversation) return;

    joinConversation(activeConversation.id);
    setIsOtherTyping(false);
    setHasMoreMessages(true);

    setLoadingMessages(true);
    api
      .get(`/messages/${activeConversation.id}`, {
        params: { limit: 30 }
      })
      .then((res) => {
        const { messages: raw, hasMore } = res.data;
        setHasMoreMessages(hasMore);
        setMessages(
          (raw || []).map((m) => ({
            ...m,
            status: m.status || 'sent',
            sender: {
              ...m.sender,
              isMe: m.sender.id === user.id
            }
          }))
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.id === activeConversation.id ? { ...c, unreadCount: 0 } : c
          )
        );
        markConversationSeen(activeConversation.id);
        setScrollAnchor((x) => x + 1);
      })
      .finally(() => setLoadingMessages(false));
  }, [activeConversation?.id]);

    useEffect(() => {
    if (!activeConversation) {
      setPinnedMessages([]);
      return;
    }

    api
      .get('/messages/starred', {
        params: { conversationId: activeConversation.id }
      })
      .then((res) => {
        const items = res.data?.items || [];
        setPinnedMessages(
          items.map((m) => ({
            ...m,
            sender: {
              ...m.sender,
              isMe: m.sender?.id === user.id
            }
          }))
        );
      })
      .catch((err) => {
        console.error('Failed to load pinned messages', err);
        setPinnedMessages([]);
      });
  }, [activeConversation?.id, user.id]);

  // load pesan lebih lama (infinite scroll)
  const handleLoadMoreMessages = async () => {
    if (
      !activeConversation ||
      loadingMoreMessages ||
      !hasMoreMessages ||
      messages.length === 0
    ) {
      return;
    }

    setLoadingMoreMessages(true);
    const oldest = messages[0];

    try {
      const res = await api.get(`/messages/${activeConversation.id}`, {
        params: {
          limit: 20,
          before: oldest.createdAt
        }
      });

      const { messages: raw, hasMore } = res.data;
      if (!raw || raw.length === 0) {
        setHasMoreMessages(false);
        return;
      }

      const mapped = raw.map((m) => ({
        ...m,
        status: m.status || 'sent',
        sender: {
          ...m.sender,
          isMe: m.sender.id === user.id
        }
      }));

      setMessages((prev) => [...mapped, ...prev]);
      setHasMoreMessages(hasMore);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMoreMessages(false);
    }
  };

    useEffect(() => {
    if (!jumpTarget) return;
    if (!activeConversation || activeConversation.id !== jumpTarget.conversationId) {
      return;
    }

    // cek apakah pesan target sudah ada di list messages
    const exists = messages.some((m) => m.id === jumpTarget.messageId);
    if (exists) {
      setFocusMessageIdFromGlobal(jumpTarget.messageId);
      setJumpTarget(null);
      return;
    }

    // kalau belum ada dan masih bisa load lebih banyak, ambil batch berikutnya
    if (!hasMoreMessages || loadingMoreMessages) {
      return;
    }

    handleLoadMoreMessages();
  }, [
    jumpTarget,
    activeConversation?.id,
    messages,
    hasMoreMessages,
    loadingMoreMessages
  ]);

const handleJumpToMessageFromSearch = (messageId) => {
  if (!activeConversation || !messageId) return;

  setJumpTarget({
    conversationId: activeConversation.id,
    messageId
  });
};

const handleSelectConversationBase = async ({
  conversation,
  newUserForConversation,
  jumpToMessageId
}) => {
  if (conversation) {
    // muat block-status untuk DM yang sudah ada
    if (!conversation.isGroup && conversation?.otherParticipant?.id) {
      try {
        const resStatus = await api.get(
          `/users/${conversation.otherParticipant.id}/block-status`
        );
        setActiveBlockStatus(
          resStatus.data || { isBlockedByMe: false, hasBlockedMe: false }
        );
      } catch (err) {
        console.error('Get block-status error', err);
        setActiveBlockStatus({
          isBlockedByMe: false,
          hasBlockedMe: false
        });
      }
    } else {
      // kalau group atau data lain → anggap tidak diblokir
      setActiveBlockStatus({
        isBlockedByMe: false,
        hasBlockedMe: false
      });
    }

    setActiveConversation(conversation);

    if (jumpToMessageId && conversation?.id) {
      setJumpTarget({
        conversationId: conversation.id,
        messageId: jumpToMessageId
      });
    }

    return;
  }

    if (newUserForConversation) {
      try {
        const res = await api.post('/conversations', {
          targetUserId: newUserForConversation._id
        });
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === res.data.id);
          if (exists) return prev;
          return [res.data, ...prev];
        });
        const other = res.data.otherParticipant;
        if (other?.id && other.lastSeen) {
          setPresence((prev) => ({
            ...prev,
            [other.id]: {
              ...(prev[other.id] || {}),
              isOnline: prev[other.id]?.isOnline || false,
              lastSeen: other.lastSeen
            }
          }));
        }
              // block-status untuk DM baru
      if (!res.data.isGroup && other?.id) {
        try {
          const resStatus = await api.get(
            `/users/${other.id}/block-status`
          );
          setActiveBlockStatus(
            resStatus.data || { isBlockedByMe: false, hasBlockedMe: false }
          );
        } catch (err) {
          console.error('Get block-status error', err);
          setActiveBlockStatus({
            isBlockedByMe: false,
            hasBlockedMe: false
          });
        }
      } else {
        setActiveBlockStatus({
          isBlockedByMe: false,
          hasBlockedMe: false
        });
      }
        setActiveConversation(res.data);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSelectConversationDesktop = (payload) => {
    handleSelectConversationBase(payload);
  };

  const handleSelectConversationMobile = async (payload) => {
    await handleSelectConversationBase(payload);
    setIsMobileConversationVisible(true);
  };

  const handleCreateGroup = async ({ name, memberIds }) => {
    try {
      const res = await api.post('/groups', {
        name,
        memberIds
      });

      const conv = res.data;

      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conv.id);
        if (exists) return prev;
        return [conv, ...prev];
      });

      setActiveConversation(conv);
    } catch (err) {
      console.error('Create group error', err);
    }
  };

  const handleJoinGroupByCode = async (code) => {
    try {
      const res = await api.post('/groups/join-by-code', { code });
      const conv = res.data;

      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === conv.id);
        if (idx !== -1) {
          const copy = [...prev];
          copy[idx] = conv;
          return copy;
        }
        return [conv, ...prev];
      });

      setActiveConversation(conv);
      setIsMobileConversationVisible(true);
      return conv;
    } catch (err) {
      console.error('Join group by code error', err);
      throw err;
    }
  };

  const handleUpdateGroupDetails = async (conversationId, payload) => {
    try {
      const res = await api.patch(`/groups/${conversationId}`, payload);
      const updated = res.data;

      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setActiveConversation((prev) =>
        prev && prev.id === updated.id ? updated : prev
      );
    } catch (err) {
      console.error('Update group details error', err);
      throw err;
    }
  };

  const handleUpdateGroupMembers = async (
    conversationId,
    { addMemberIds = [], removeMemberIds = [] }
  ) => {
    try {
      const res = await api.patch(`/groups/${conversationId}/members`, {
        addMemberIds,
        removeMemberIds
      });
      const updated = res.data;

      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setActiveConversation((prev) =>
        prev && prev.id === updated.id ? updated : prev
      );
    } catch (err) {
      console.error('Update group members error', err);
      throw err;
    }
  };

    const handleUpdateGroupAdmins = async (
    conversationId,
    { addAdminIds = [], removeAdminIds = [] }
  ) => {
    try {
      const res = await api.patch(`/groups/${conversationId}/admins`, {
        addAdminIds,
        removeAdminIds
      });
      const updated = res.data;

      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      setActiveConversation((prev) =>
        prev && prev.id === updated.id ? updated : prev
      );
    } catch (err) {
      console.error('Update group admins error', err);
      throw err;
    }
  };

  const handleLeaveGroup = async (conversationId) => {
    try {
      await api.post(`/groups/${conversationId}/leave`);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setActiveConversation((prev) =>
        prev && prev.id === conversationId ? null : prev
      );
    } catch (err) {
      console.error('Leave group error', err);
      throw err;
    }
  };

  const handleDeleteGroup = async (conversationId) => {
    try {
      await api.delete(`/groups/${conversationId}`);
      setConversations((prev) => prev.filter((c) => c.id !== conversationId));
      setActiveConversation((prev) =>
        prev && prev.id === conversationId ? null : prev
      );
    } catch (err) {
      console.error('Delete group error', err);
      throw err;
    }
  };

    const handleBlockUser = async (userId) => {
    try {
      await api.post(`/users/${userId}/block`);
      setActiveBlockStatus((prev) => ({
        ...prev,
        isBlockedByMe: true
      }));
      window.alert('User blocked.');
    } catch (err) {
      console.error('Block user error', err);
      window.alert(
        err?.response?.data?.message || 'Failed to block user.'
      );
    }
  };

  const handleUnblockUser = async (userId) => {
    try {
      await api.delete(`/users/${userId}/block`);
      setActiveBlockStatus((prev) => ({
        ...prev,
        isBlockedByMe: false
      }));
      window.alert('User unblocked.');
    } catch (err) {
      console.error('Unblock user error', err);
      window.alert(
        err?.response?.data?.message || 'Failed to unblock user.'
      );
    }
  };

  const handleSendMessage = ({ text, replyToId }) => {
    if (!activeConversation) return;
    sendMessage({
      conversationId: activeConversation.id,
      text,
      replyToId: replyToId || null
    });
    stopTyping(activeConversation.id);
  };


    const handleEditMessage = (messageId, newText) => {
    if (!activeConversation) return;
    editMessage(activeConversation.id, messageId, newText);
  };

  const handleDeleteMessage = (messageId) => {
    if (!activeConversation) return;
    deleteMessage(activeConversation.id, messageId);
  };

  const handleStartTyping = () => {
    if (!activeConversation) return;
    startTyping(activeConversation.id);
  };

  const handleStopTyping = () => {
    if (!activeConversation) return;
    stopTyping(activeConversation.id);
  };

    const handleReactMessage = async (messageId, emoji) => {
    try {
      const res = await api.post(`/messages/${messageId}/reactions`, {
        emoji
      });

      const { messageId: id, reactions } = res.data || {};

      if (!id) return;

      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                reactions
              }
            : m
        )
      );
    } catch (err) {
      console.error('handleReactMessage error', err);
      // kalau kamu pakai toast: toast.error('Gagal menambahkan reaction');
    }
  };

    const handleToggleStarMessage = async (messageId) => {
    if (!activeConversation) return;

    try {
      const res = await api.post(`/messages/${messageId}/star`);
      const { messageId: id, starCount, starredByMe } = res.data || {};
      if (!id) return;

      // update di list messages aktif
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id
            ? {
                ...m,
                starCount,
                starredByMe
              }
            : m
        )
      );

      // refresh daftar pinned untuk conversation ini
      const pinnedRes = await api.get('/messages/starred', {
        params: { conversationId: activeConversation.id }
      });
      const items = pinnedRes.data?.items || [];

      setPinnedMessages(
        items.map((m) => ({
          ...m,
          sender: {
            ...m.sender,
            isMe: m.sender?.id === user.id
          }
        }))
      );
    } catch (err) {
      console.error('handleToggleStarMessage error', err);
    }
  };

    const handleForwardMessage = (sourceMessage, targetConversationId) => {
    if (!sourceMessage || !targetConversationId) return;
    if (!sourceMessage.text) return; // sekarang cuma support text

    // kirim pesan baru ke conversation lain via socket
    sendMessage({
      conversationId: targetConversationId,
      text: sourceMessage.text,
      replyToId: null
    });
  };

    const handleResendVerification = async () => {
    setVerifyError('');
    setVerifyInfo('');
    setVerifyLoading(true);
    try {
      const res = await api.post('/auth/send-verification-email');
      setVerifyInfo(
        res.data?.message ||
          'Verification email has been sent. Please check your inbox.'
      );
    } catch (err) {
      console.error('resend verification error', err);
      const msg =
        err?.response?.data?.message ||
        'Failed to send verification email. Please try again.';
      setVerifyError(msg);
    } finally {
      setVerifyLoading(false);
    }
  };

    const handleLoadMoreConversations = async () => {
    if (convLoadingMore || !convHasMore || !convCursor) return;

    setConvLoadingMore(true);
    try {
      const res = await api.get('/conversations/paginated', {
        params: {
          limit: CONVERSATION_PAGE_SIZE,
          cursor: convCursor
        }
      });

      const { items, hasMore, nextCursor } = res.data;

      const newConv = (items || []).map((c) => ({
        ...c,
        unreadCount: c.unreadCount || 0
      }));

      setConversations((prev) => [...prev, ...newConv]);
      setConvHasMore(!!hasMore);
      setConvCursor(nextCursor || null);

      // seed presence untuk conversations tambahan
      setPresence((prev) => {
        const updated = { ...prev };
        newConv.forEach((c) => {
          const other = c.otherParticipant;
          if (other?.id && other.lastSeen && !updated[other.id]) {
            updated[other.id] = {
              isOnline: false,
              lastSeen: other.lastSeen
            };
          }
        });
        return updated;
      });
    } catch (err) {
      console.error('Failed to load more conversations', err);
    } finally {
      setConvLoadingMore(false);
    }
  };

  const activeOtherId = activeConversation?.otherParticipant?.id;
  const activePresence =
    activeOtherId && presence[activeOtherId]
      ? presence[activeOtherId]
      : activeConversation?.otherParticipant?.lastSeen
      ? {
          isOnline: false,
          lastSeen: activeConversation.otherParticipant.lastSeen
        }
      : undefined;

  return (
    <Shell>
      <div className="flex flex-col min-h-screen md:min-h-[520px]">
        <TopBar />

        {notificationsSupported && (
          <div className="flex items-center justify-between px-4 py-1 border-t border-b border-white/5 bg-black/40 text-[11px]">
            <span className="text-slate-300">
              Notifications:{' '}
              {notificationPermission === 'denied'
                ? 'blocked in browser settings'
                : notificationsEnabled
                ? 'enabled'
                : 'disabled'}
            </span>

            {notificationPermission !== 'denied' && !notificationsEnabled && (
              <button
                type="button"
                onClick={handleEnableNotifications}
                className="px-2 py-1 rounded bg-woy-accent/90 text-[11px] text-black hover:bg-woy-accent"
              >
                Enable notifications
              </button>
            )}
          </div>
        )}

        {!isEmailVerified && (
          <div className="px-4 py-2 border-b border-white/5 bg-amber-900/40 text-[11px] flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div className="text-amber-100">
              <span className="font-semibold">Email not verified.</span>{' '}
              <span>
                Some features may be limited until you verify your email.
              </span>
              {verifyError && (
                <div className="mt-1 text-[10px] text-rose-200">
                  {verifyError}
                </div>
              )}
              {verifyInfo && (
                <div className="mt-1 text-[10px] text-emerald-200">
                  {verifyInfo}
                </div>
              )}
            </div>
            <div className="mt-1 md:mt-0 flex justify-end">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={verifyLoading}
                className="px-2 py-1 rounded border border-amber-400/70 text-amber-50 hover:bg-amber-500/20 disabled:opacity-60"
              >
                {verifyLoading ? 'Sending...' : 'Resend verification email'}
              </button>
            </div>
          </div>
        )}
        {/* Desktop */}
        <div className="hidden md:flex border-t border-white/5 h-[520px]">
          <Sidebar
            conversations={conversations}
            activeConversationId={activeConversation?.id}
            onSelectConversation={handleSelectConversationDesktop}
            pinnedIds={pinnedIds}
            setPinnedIds={setPinnedIds}
            mutedIds={mutedIds}
            setMutedIds={setMutedIds}
            archivedIds={archivedIds}
            setArchivedIds={setArchivedIds}
            onCreateGroup={handleCreateGroup}
            onJoinGroupByCode={handleJoinGroupByCode}
            hasMoreConversations={convHasMore}
            loadingMoreConversations={convLoadingMore}
            onLoadMoreConversations={handleLoadMoreConversations}
          />
          <ChatPanel
            conversation={activeConversation}
            messages={messages}
            onSendMessage={handleSendMessage}
            loadingMessages={loadingMessages}
            isOtherTyping={isOtherTyping}
            onStartTyping={handleStartTyping}
            onStopTyping={handleStopTyping}
            onLoadMore={handleLoadMoreMessages}
            hasMoreMessages={hasMoreMessages}
            loadingMoreMessages={loadingMoreMessages}
            scrollAnchor={scrollAnchor}
            presence={activePresence}
            onUpdateGroupDetails={handleUpdateGroupDetails}
            onUpdateGroupMembers={handleUpdateGroupMembers}
            onUpdateGroupAdmins={handleUpdateGroupAdmins}
            onLeaveGroup={handleLeaveGroup}
            onDeleteGroup={handleDeleteGroup}
            onEditMessage={handleEditMessage}
            blockStatus={activeBlockStatus}
            onBlockUser={handleBlockUser}
            onUnblockUser={handleUnblockUser}
            onDeleteMessage={handleDeleteMessage}
            onReactMessage={handleReactMessage}
            pinnedMessages={pinnedMessages}
            onToggleStarMessage={handleToggleStarMessage}
            externalFocusMessageId={focusMessageIdFromGlobal}
            allConversations={conversations}
            onForwardMessage={handleForwardMessage}
            onJumpToMessageFromSearch={handleJumpToMessageFromSearch}
          />
        </div>
        
        {/* Mobile layout: satu layar (list atau chat) */}
        <div className="flex md:hidden border-t border-white/5 h-[calc(100vh-52px)] overflow-hidden">
          {isMobileConversationVisible && activeConversation ? (
            <ChatPanel
              conversation={activeConversation}
              messages={messages}
              onSendMessage={handleSendMessage}
              loadingMessages={loadingMessages}
              // === tambahkan dua baris ini khusus mobile ===
              showBackButton
              onBack={() => setIsMobileConversationVisible(false)}
              // =============================================
              isOtherTyping={isOtherTyping}
              onStartTyping={handleStartTyping}
              onStopTyping={handleStopTyping}
              onLoadMore={handleLoadMoreMessages}
              hasMoreMessages={hasMoreMessages}
              loadingMoreMessages={loadingMoreMessages}
              scrollAnchor={scrollAnchor}
              presence={activePresence}
              onUpdateGroupDetails={handleUpdateGroupDetails}
              onUpdateGroupMembers={handleUpdateGroupMembers}
              onUpdateGroupAdmins={handleUpdateGroupAdmins}
              onLeaveGroup={handleLeaveGroup}
              onDeleteGroup={handleDeleteGroup}
              blockStatus={activeBlockStatus}
              onBlockUser={handleBlockUser}
              onUnblockUser={handleUnblockUser}
              onEditMessage={handleEditMessage}
              onDeleteMessage={handleDeleteMessage}
              onReactMessage={handleReactMessage}
              pinnedMessages={pinnedMessages}
              onToggleStarMessage={handleToggleStarMessage}
              externalFocusMessageId={focusMessageIdFromGlobal}
              allConversations={conversations}
              onForwardMessage={handleForwardMessage}
              onJumpToMessageFromSearch={handleJumpToMessageFromSearch}
            />
          ) : (
            <Sidebar
              conversations={conversations}
              activeConversationId={activeConversation?.id}
              onSelectConversation={handleSelectConversationMobile}
              pinnedIds={pinnedIds}
              setPinnedIds={setPinnedIds}
              mutedIds={mutedIds}
              setMutedIds={setMutedIds}
              archivedIds={archivedIds}
              setArchivedIds={setArchivedIds}
              onCreateGroup={handleCreateGroup}
              onJoinGroupByCode={handleJoinGroupByCode}
              hasMoreConversations={convHasMore}
              loadingMoreConversations={convLoadingMore}
              onLoadMoreConversations={handleLoadMoreConversations}
            />
          )}
        </div>
      </div>
    </Shell>
  );
};

export default ChatPage;
