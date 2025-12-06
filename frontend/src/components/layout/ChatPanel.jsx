import { useEffect, useRef, useState } from 'react';
import MessageBubble from '../ui/MessageBubble';
import TextInput from '../ui/TextInput';
import Button from '../ui/Button';
import Avatar from '../ui/Avatar';
import Spinner from '../ui/Spinner';
import { formatDateHeader, formatLastSeen, formatTime } from '../../utils/date';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../utils/api';

const ChatPanel = ({
  conversation,
  messages,
  onSendMessage,
  loadingMessages,
  showBackButton = false,
  onBack,
  isOtherTyping = false,
  onStartTyping = () => {},
  onStopTyping = () => {},
  onLoadMore = () => {},
  hasMoreMessages = false,
  loadingMoreMessages = false,
  scrollAnchor = 0,
  presence,
  onUpdateGroupDetails,
  onUpdateGroupMembers,
  onUpdateGroupAdmins,
  onLeaveGroup,
  onDeleteGroup,
  onEditMessage,
  onDeleteMessage,
  externalFocusMessageId = null,
  onReactMessage,
  pinnedMessages = [],
  onToggleStarMessage,
  allConversations = [],
  onForwardMessage,
  blockStatus,
  onBlockUser,
  onUnblockUser,
  onJumpToMessageFromSearch = () => {}
}) => {
  const { user } = useAuth();

  const [text, setText] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyTo, setReplyTo] = useState(null);

    // ====== FORWARD MESSAGE ======
  const [forwardSource, setForwardSource] = useState(null);
  const [forwardFilter, setForwardFilter] = useState('');

    // ====== MENTION DI GROUP (@username) ======
  const [isMentionOpen, setIsMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionSuggestions, setMentionSuggestions] = useState([]);
  const [mentionAnchorIndex, setMentionAnchorIndex] = useState(null);

    // ====== STATE BARU: SEARCH PESAN ======
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [showPinned, setShowPinned] = useState(false);

  // state untuk panel Group Info
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [isActionsMenuOpen, setIsActionsMenuOpen] = useState(false);
  const [groupName, setGroupName] = useState(
    conversation?.isGroup ? conversation.name || '' : ''
  );
  const [groupAvatar, setGroupAvatar] = useState(
    conversation?.isGroup ? conversation.avatarUrl || '' : ''
  );
  const [savingDetails, setSavingDetails] = useState(false);

    const [inviteCode, setInviteCode] = useState(
    conversation?.isGroup ? conversation.inviteCode || '' : ''
  );
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState([]);
  const [memberSearchLoading, setMemberSearchLoading] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState(null);

  const [leavingGroup, setLeavingGroup] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);
  const [groupError, setGroupError] = useState('');

    // ====== READ RECEIPTS (detail per pesan, khusus group) ======
  const [readReceiptMessage, setReadReceiptMessage] = useState(null);
  const [readReceiptData, setReadReceiptData] = useState(null);
  const [readReceiptLoading, setReadReceiptLoading] = useState(false);
  const [readReceiptError, setReadReceiptError] = useState('');

    // ====== HANDLER READ RECEIPTS ======
  const openReadReceipts = async (message) => {
    if (!message) return;

    // buka panel dulu
    setReadReceiptMessage(message);
    setReadReceiptLoading(true);
    setReadReceiptError('');
    setReadReceiptData(null);

    // kita hanya pakai di group, tapi cek lagi untuk jaga-jaga
    if (!conversation?.isGroup) {
      setReadReceiptLoading(false);
      setReadReceiptError('Detail read receipts hanya tersedia untuk group chat.');
      return;
    }

    const messageId = message.id || message._id;
    if (!messageId) {
      setReadReceiptLoading(false);
      setReadReceiptError('ID pesan tidak valid.');
      return;
    }

    try {
      const res = await api.get(`/messages/${messageId}/receipts`);
      setReadReceiptData(res.data || null);
    } catch (err) {
      console.error('Failed to fetch read receipts', err);
      const msg =
        err?.response?.data?.message ||
        'Gagal mengambil data read receipts pesan';
      setReadReceiptError(msg);
      setReadReceiptData(null);
    } finally {
      setReadReceiptLoading(false);
    }
  };

  const closeReadReceipts = () => {
    setReadReceiptMessage(null);
    setReadReceiptData(null);
    setReadReceiptLoading(false);
    setReadReceiptError('');
  };

  const scrollRef = useRef(null);

    // ===== Fokus pesan untuk jump dari hasil search =====
  const [focusedMessageId, setFocusedMessageId] = useState(null);
  const messageRefs = useRef({});

  const registerMessageRef = (id) => (el) => {
    if (el) {
      messageRefs.current[id] = el;
    } else {
      delete messageRefs.current[id];
    }
  };

  useEffect(() => {
    if (!focusedMessageId) return;
    const t = setTimeout(() => setFocusedMessageId(null), 2000); // highlight 2 detik
    return () => clearTimeout(t);
  }, [focusedMessageId]);

    useEffect(() => {
    if (!externalFocusMessageId) return;

    const container = scrollRef.current;
    if (!container) return;

    const target = messageRefs.current[externalFocusMessageId];
    if (!target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = targetRect.top - containerRect.top;

    container.scrollTo({
      top: container.scrollTop + offset - 80,
      behavior: 'smooth'
    });

    setFocusedMessageId(externalFocusMessageId);
  }, [externalFocusMessageId]);

  const startReply = (message) => {
    if (!message) return;
    setReplyTo({
      id: message.id,
      text: message.text,
      isDeleted: message.isDeleted,
      sender: message.sender
    });
  };

  const cancelReply = () => {
    setReplyTo(null);
  };

  // reset input ketika ganti conversation
  useEffect(() => {
    setText('');
    setEditingMessage(null);
    setReplyTo(null);

    if (conversation?.isGroup) {
      setGroupName(conversation.name || '');
      setGroupAvatar(conversation.avatarUrl || '');
      setInviteCode(conversation.inviteCode || '');
    } else {
      setGroupName('');
      setGroupAvatar('');
      setInviteCode('');
    }
    setMemberSearchTerm('');
    setMemberSearchResults([]);
    setGroupError('');
    setShowGroupInfo(false);
    setIsMentionOpen(false);
    setMentionQuery('');
    setMentionSuggestions([]);
    setMentionAnchorIndex(null);
    setForwardSource(null);
    setForwardFilter('');
    setIsActionsMenuOpen(false);
    setForwardSource(null);
    setForwardFilter('');
    setIsActionsMenuOpen(false);
    setInviteCopied(false);
  }, [conversation?.id]);


  // scroll ke bawah saat scrollAnchor berubah
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [scrollAnchor]);

    // search user untuk Add member di panel Group Info
  useEffect(() => {
    if (!showGroupInfo || !conversation?.isGroup) return;

    const term = memberSearchTerm.trim();
    if (!term) {
      setMemberSearchResults([]);
      setMemberSearchLoading(false);
      return;
    }

    setMemberSearchLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await api.get(
          `/users?search=${encodeURIComponent(term)}`
        );
        const existingIds = new Set(
          (conversation.participants || []).map((p) => p.id)
        );

        const data = Array.isArray(res.data)
          ? res.data
          : res.data.users || [];

        const filtered = data.filter((u) => {
          const uid = u.id || u._id;
          return uid && !existingIds.has(uid);
        });

        setMemberSearchResults(filtered);
      } catch (err) {
        console.error('Search users for group error', err);
      } finally {
        setMemberSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [memberSearchTerm, showGroupInfo, conversation]);

  if (!conversation) {
    return (
      <section className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-woy-soft/80 to-black/80">
        <div className="text-center px-6">
          <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3">
            Welcome to
          </p>
          <h2 className="text-2xl font-semibold text-slate-100 mb-2">
            H!BRUH
          </h2>
          <p className="text-sm text-slate-400 max-w-sm mx-auto">
            Start by searching a username on the left, then say hi. No noise,
            no feeds, just conversations.
          </p>
        </div>
      </section>
    );
  }

  const isGroup = conversation.isGroup;
  const other = !isGroup ? conversation.otherParticipant : null;
  const isBlockedByMe = blockStatus?.isBlockedByMe || false;
  const hasBlockedMe = blockStatus?.hasBlockedMe || false;
  const isDmBlocked = !isGroup && (isBlockedByMe || hasBlockedMe);

  const creatorId = conversation.createdBy;
  const adminIds = conversation.admins || [];
  const currentUserId = user?.id;

  const isCreator =
    !!currentUserId && creatorId && creatorId === currentUserId;
  const isAdmin =
    isCreator || (currentUserId && adminIds.includes(currentUserId));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isDmBlocked) return;

    const trimmed = text.trim();
    if (!trimmed) return;

    if (editingMessage) {
      onEditMessage?.(editingMessage.id, trimmed);
      setEditingMessage(null);
      setText('');
    } else {
      onSendMessage?.({
        text: trimmed,
        replyToId: replyTo?.id || null
      });
      setText('');
      setReplyTo(null);
    }
      setIsMentionOpen(false);
      setMentionQuery('');
      setMentionSuggestions([]);
      setMentionAnchorIndex(null);

    onStopTyping();
  };

  const startEdit = (message) => {
    if (!message || !message.sender?.isMe || message.isDeleted) return;
    setEditingMessage(message);
    setText(message.text || '');
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setText('');
    onStopTyping();
  };

    // ====== FORWARD MESSAGE ======
  const startForward = (message) => {
    if (!message) return;
    setForwardSource(message);
    setForwardFilter('');
  };

  const cancelForward = () => {
    setForwardSource(null);
    setForwardFilter('');
  };

  const handleSelectForwardTarget = (targetConversationId) => {
    if (!onForwardMessage || !forwardSource || !targetConversationId) return;
    onForwardMessage(forwardSource, targetConversationId);
    setForwardSource(null);
    setForwardFilter('');
  };

    const handleReportMessage = async (message) => {
    if (!message || !message.id) return;

    try {
      const reasonText = window.prompt(
        'Why are you reporting this message? (optional)',
        ''
      );

      if (reasonText === null) {
        // user tekan Cancel
        return;
      }

      await api.post('/reports', {
        type: 'message',
        messageId: message.id,
        reasonCode: 'other',
        reasonText: reasonText || undefined
      });

      window.alert('Thank you. Your report has been submitted.');
    } catch (err) {
      console.error('Report message error', err);
      window.alert(
        err?.response?.data?.message || 'Failed to submit report.'
      );
    }
  };

  // pilih user dari daftar mention
  const handleSelectMention = (member) => {
    if (!conversation?.isGroup || !member) return;

    const username = member.username || member.displayName;
    if (!username) {
      setIsMentionOpen(false);
      return;
    }

    setText((prev) => {
      if (mentionAnchorIndex == null) return prev;

      const query = mentionQuery || '';
      const before = prev.slice(0, mentionAnchorIndex); // sebelum '@'
      const after = prev.slice(
        mentionAnchorIndex + 1 + query.length
      ); // setelah "@{query}"

      const mentionText = `@${username} `;
      return `${before}${mentionText}${after}`;
    });

    setIsMentionOpen(false);
    setMentionQuery('');
    setMentionSuggestions([]);
    setMentionAnchorIndex(null);
  };
    const handleReportUser = async (userToReport) => {
    if (!userToReport || !userToReport.id) return;

    try {
      const reasonText = window.prompt(
        `Why are you reporting ${
          userToReport.username || userToReport.displayName || 'this user'
        }? (optional)`,
        ''
      );

      if (reasonText === null) {
        // user tekan Cancel
        return;
      }

      await api.post('/reports', {
        type: 'user',
        targetUserId: userToReport.id,
        reasonCode: 'other',
        reasonText: reasonText || undefined
      });

      window.alert('Thank you. Your report has been submitted.');
    } catch (err) {
      console.error('Report user error', err);
      window.alert(
        err?.response?.data?.message || 'Failed to submit report.'
      );
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;

    // typing indicator
    if (!text && value) {
      onStartTyping();
    }
    if (text && !value) {
      onStopTyping();
    }
    setText(value);

    // ====== LOGIC MENTION: hanya untuk group ======
    if (!conversation?.isGroup) {
      setIsMentionOpen(false);
      setMentionQuery('');
      setMentionSuggestions([]);
      setMentionAnchorIndex(null);
      return;
    }

    const cursorPos = e.target.selectionStart ?? value.length;
    const uptoCursor = value.slice(0, cursorPos);
    const atIndex = uptoCursor.lastIndexOf('@');

    // tidak ada '@' sebelum cursor → tutup panel
    if (atIndex === -1) {
      setIsMentionOpen(false);
      setMentionQuery('');
      setMentionSuggestions([]);
      setMentionAnchorIndex(null);
      return;
    }

    // karakter sebelum '@' harus awal string / whitespace
    if (atIndex > 0) {
      const prevChar = uptoCursor[atIndex - 1];
      if (prevChar !== ' ' && prevChar !== '\n' && prevChar !== '\t') {
        setIsMentionOpen(false);
        setMentionQuery('');
        setMentionSuggestions([]);
        setMentionAnchorIndex(null);
        return;
      }
    }

    const afterAt = uptoCursor.slice(atIndex + 1); // teks setelah '@' sampai cursor

    // kalau sudah ada spasi di query (contoh: "@fay adh") → anggap mention selesai
    if (/\s/.test(afterAt)) {
      setIsMentionOpen(false);
      setMentionQuery('');
      setMentionSuggestions([]);
      setMentionAnchorIndex(null);
      return;
    }

    const query = afterAt; // boleh kosong → tampilkan semua member
    const participants = conversation.participants || [];
    const lowerQ = (query || '').toLowerCase();

    const suggestions = participants.filter((p) => {
      const uid = p.id || p._id;
      if (!uid) return false;

      const username = (p.username || '').toLowerCase();
      const displayName = (p.displayName || '').toLowerCase();

      // opsional: tidak usah mention diri sendiri
      const isSelf =
        user && (uid === user.id || uid === user._id);
      if (isSelf) return false;

      if (!lowerQ) return true; // kalau query kosong, tampilkan semua member

      return (
        username.includes(lowerQ) ||
        displayName.includes(lowerQ)
      );
    });

    setMentionAnchorIndex(atIndex);
    setMentionQuery(query);
    setMentionSuggestions(suggestions);
    setIsMentionOpen(suggestions.length > 0);
  };

  const handleBlur = () => {
    if (text) {
      onStopTyping();
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (!hasMoreMessages || loadingMoreMessages) return;
    if (el.scrollTop < 60) {
      onLoadMore();
    }
  };

    // ====== HANDLER BARU: SEARCH PESAN ======
  const handleSearchSubmit = async (e) => {
    e.preventDefault();

    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      setSearchError('');
      return;
    }
    if (!conversation?.id) return;

    setSearchLoading(true);
    setSearchError('');
    try {
      const res = await api.get('/messages/search', {
        params: {
          q: term,
          conversationId: conversation.id,
          limit: 30
        }
      });

      const items = Array.isArray(res.data?.items)
        ? res.data.items
        : [];
      setSearchResults(items);
    } catch (err) {
      console.error('handleSearchSubmit error', err);
      setSearchError('Gagal mencari pesan.');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSearchError('');
  };

  const handleClickSearchResult = (result) => {
    if (!result?.id) return;

    const container = scrollRef.current;
    const target = container ? messageRefs.current[result.id] : null;

    // Jika pesan belum ada di batch messages yang sedang dimuat,
    // delegasikan ke parent (ChatPage) untuk melakukan jump
    if (!target) {
      onJumpToMessageFromSearch(result.id);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const offset = targetRect.top - containerRect.top;

    container.scrollTo({
      top: container.scrollTop + offset - 80,
      behavior: 'smooth'
    });

    setFocusedMessageId(result.id);
  };

    const handleClickPinned = (message) => {
    if (!message?.id) return;
    handleClickSearchResult(message);
    setShowPinned(false);
  };
  // ========================================

  // ========================================

    const handleSaveGroupDetails = async () => {
    if (!onUpdateGroupDetails) return;
    setSavingDetails(true);
    setGroupError('');
    try {
      await onUpdateGroupDetails(conversation.id, {
        name: groupName.trim(),
        avatarUrl: groupAvatar.trim()
      });
    } catch (err) {
      setGroupError(
        err?.response?.data?.message || 'Failed to update group'
      );
    } finally {
      setSavingDetails(false);
    }
  };

  const handleGenerateInvite = async () => {
    if (!conversation?.id) return;
    setInviteLoading(true);
    setGroupError('');
    setInviteCopied(false);
    try {
      const res = await api.post(`/groups/${conversation.id}/invite`);
      const updated = res.data;
      if (updated.inviteCode) {
        setInviteCode(updated.inviteCode);
      }
    } catch (err) {
      console.error('Generate invite error', err);
      setGroupError(
        err?.response?.data?.message || 'Failed to generate invite link'
      );
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!inviteCode) return;
    try {
      await navigator.clipboard.writeText(inviteCode);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 1500);
    } catch (err) {
      console.error('Copy invite code error', err);
      setGroupError('Failed to copy invite code');
    }
  };

  const handleAddMember = async (userToAdd) => {
    if (!onUpdateGroupMembers) return;
    const id = userToAdd.id || userToAdd._id;
    if (!id) return;
    setUpdatingMemberId(id);
    setGroupError('');
    try {
      await onUpdateGroupMembers(conversation.id, {
        addMemberIds: [id],
        removeMemberIds: []
      });
      setMemberSearchTerm('');
      setMemberSearchResults([]);
    } catch (err) {
      setGroupError(
        err?.response?.data?.message || 'Failed to add member'
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!onUpdateGroupMembers) return;
    setUpdatingMemberId(memberId);
    setGroupError('');
    try {
      await onUpdateGroupMembers(conversation.id, {
        addMemberIds: [],
        removeMemberIds: [memberId]
      });
    } catch (err) {
      setGroupError(
        err?.response?.data?.message || 'Failed to remove member'
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handlePromoteToAdmin = async (memberId) => {
    if (!onUpdateGroupAdmins) return;
    setUpdatingMemberId(memberId);
    setGroupError('');
    try {
      await onUpdateGroupAdmins(conversation.id, {
        addAdminIds: [memberId],
        removeAdminIds: []
      });
    } catch (err) {
      setGroupError(
        err?.response?.data?.message || 'Failed to update admin role'
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleDemoteAdmin = async (memberId) => {
    if (!onUpdateGroupAdmins) return;
    setUpdatingMemberId(memberId);
    setGroupError('');
    try {
      await onUpdateGroupAdmins(conversation.id, {
        addAdminIds: [],
        removeAdminIds: [memberId]
      });
    } catch (err) {
      setGroupError(
        err?.response?.data?.message || 'Failed to update admin role'
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleLeaveGroupClick = async () => {
    if (!onLeaveGroup) return;
    if (!window.confirm('Leave this group?')) return;
    setLeavingGroup(true);
    setGroupError('');
    try {
      await onLeaveGroup(conversation.id);
    } catch (err) {
      setGroupError(
        err?.response?.data?.message || 'Failed to leave group'
      );
    } finally {
      setLeavingGroup(false);
    }
  };

  const handleDeleteGroupClick = async () => {
    if (!onDeleteGroup) return;
    if (
      !window.confirm(
        'Delete this group for all members? This cannot be undone.'
      )
    )
      return;
    setDeletingGroup(true);
    setGroupError('');
    try {
      await onDeleteGroup(conversation.id);
    } catch (err) {
      setGroupError(
        err?.response?.data?.message || 'Failed to delete group'
      );
    } finally {
      setDeletingGroup(false);
    }
  };

  let statusText;
  if (isGroup) {
    if (isOtherTyping) {
      statusText = (
        <span className="text-woy-accent">Someone is typing…</span>
      );
    } else {
      const memberCount = conversation.participants?.length || 0;
      statusText = (
        <span className="text-slate-500">
          {memberCount} member{memberCount === 1 ? '' : 's'}
        </span>
      );
    }
  } else {
    if (isOtherTyping) {
      statusText = <span className="text-woy-accent">typing…</span>;
    } else if (presence?.isOnline) {
      statusText = <span className="text-emerald-400">online now</span>;
    } else if (presence?.lastSeen || other?.lastSeen) {
      const ls = presence?.lastSeen || other?.lastSeen;
      statusText = (
        <span className="text-slate-500">
          {formatLastSeen(ls)}
        </span>
      );
    } else {
      statusText = <span className="text-slate-500">@{other?.username}</span>;
    }
  }

  return (
    <section className="flex-1 flex flex-col bg-gradient-to-br from-woy-soft to-black/90">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-5 py-3 border-b border-white/5 bg-black/40">
        <div className="flex items-center gap-3 min-w-0">
          {showBackButton && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center justify-center rounded-full h-8 w-8 bg-white/5 text-slate-300 hover:bg-white/10 md:hidden"
            >
              <span className="text-lg leading-none">&larr;</span>
            </button>
          )}
          <Avatar
            size={40}
            name={isGroup ? conversation.name : other?.displayName || other?.username}
            src={isGroup ? conversation.avatarUrl : other?.avatarUrl}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100 truncate">
              {isGroup
                ? conversation.name
                : other?.displayName || other?.username}
            </p>
            <p className="text-[11px] truncate">{statusText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="badge-pill bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[11px]">
            secure
          </span>

          {/* DM: Report / Block */}
          {!isGroup && other && (
            <>
              {/* DESKTOP (≥ sm): tetap dua tombol biasa */}
              <div className="hidden sm:flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleReportUser(other)}
                  className="text-[10px] px-2 py-1 rounded-full border border-amber-500/60 text-amber-200 hover:bg-amber-500/10"
                >
                  Report
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (isBlockedByMe) {
                      onUnblockUser?.(other.id);
                    } else {
                      onBlockUser?.(other.id);
                    }
                  }}
                  className={
                    'text-[10px] px-2 py-1 rounded-full border ' +
                    (isBlockedByMe
                      ? 'border-slate-500 text-slate-300 hover:bg-white/5'
                      : 'border-rose-500/60 text-rose-300 hover:bg-rose-500/10')
                  }
                >
                  {isBlockedByMe ? 'Unblock' : 'Block'}
                </button>
              </div>

              {/* MOBILE (< sm): satu tombol menu (⋯) */}
              <div className="relative sm:hidden">
                <button
                  type="button"
                  onClick={() => setIsActionsMenuOpen((v) => !v)}
                  className="h-8 w-8 rounded-full border border-white/15 flex items-center justify-center text-[16px] text-slate-100 hover:bg-white/5"
                >
                  ⋯
                </button>

                {isActionsMenuOpen && (
                  <div className="absolute right-0 mt-1 w-36 rounded-xl border border-white/10 bg-black/95 shadow-lg py-1 z-20">
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        handleReportUser(other);
                      }}
                      className="block w-full text-left text-[11px] px-3 py-1.5 text-slate-100 hover:bg-white/5"
                    >
                      Report user
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsActionsMenuOpen(false);
                        if (isBlockedByMe) {
                          onUnblockUser?.(other.id);
                        } else {
                          onBlockUser?.(other.id);
                        }
                      }}
                      className="block w-full text-left text-[11px] px-3 py-1.5 text-rose-300 hover:bg-white/5"
                    >
                      {isBlockedByMe ? 'Unblock' : 'Block'}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* GROUP: tetap seperti semula */}
          {isGroup && (
            <button
              type="button"
              onClick={() => setShowGroupInfo(true)}
              className="text-[10px] text-slate-400 hover:text-slate-100"
            >
              Group info
            </button>
          )}
        </div>
      </div>
      
      {/* Search bar untuk pesan di conversation ini */}
      {conversation && (
        <form
          onSubmit={handleSearchSubmit}
          className="px-3 md:px-5 py-2 border-b border-white/5 bg-black/30 flex items-center gap-2 text-xs"
        >
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari pesan di chat ini..."
            className="flex-1 bg-black/60 border border-white/10 rounded-full px-3 py-2 outline-none focus:border-woy-accent text-[11px] md:text-xs"
          />
          <button
            type="submit"
            className="px-3 py-2 rounded-full border border-white/20 text-[11px] hover:bg-white/10 disabled:opacity-50"
            disabled={searchLoading}
          >
            {searchLoading ? '...' : 'Cari'}
          </button>
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="text-[11px] text-slate-400 hover:text-slate-100"
            >
              Reset
            </button>
          )}
        </form>
      )}

              {/* Panel hasil search (opsional) */}
        {searchTerm && (
          <div className="mb-3 rounded-lg border border-white/10 bg-black/40 text-xs">
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <span className="text-slate-300">
                Hasil untuk: <span className="font-semibold">"{searchTerm}"</span>
              </span>
              {searchError && (
                <span className="text-[10px] text-rose-300">
                  {searchError}
                </span>
              )}
            </div>

            {searchLoading ? (
              <div className="flex justify-center py-3">
                <Spinner size={18} />
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-2 text-slate-400">
                Tidak ada pesan yang cocok.
              </div>
            ) : (
            <div className="max-h-52 overflow-y-auto divide-y divide-white/5">
              {searchResults.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleClickSearchResult(m)}
                  className="w-full text-left px-3 py-2 hover:bg-white/10 focus:outline-none"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] text-slate-300">
                      {m.sender?.displayName || m.sender?.username || 'Unknown'}
                    </span>
                    {m.createdAt && (
                      <span className="text-[10px] text-slate-500">
                        {new Date(m.createdAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-100 line-clamp-3">
                    {m.text}
                  </p>
                </button>
              ))}
            </div>
            )}
          </div>
        )
        }

          {/* Pinned messages bar */}
    {pinnedMessages && pinnedMessages.length > 0 && (
      <div className="px-4 md:px-5 py-2 border-t border-b border-white/5 bg-black/30">
        <button
          type="button"
          onClick={() => setShowPinned((prev) => !prev)}
          className="w-full flex items-center justify-between gap-2 text-xs text-slate-200"
        >
          <span className="font-medium">
            Pinned messages ({pinnedMessages.length})
          </span>
          <span className="text-[10px] text-slate-400">
            {showPinned ? 'Hide' : 'Show'}
          </span>
        </button>

        {showPinned && (
          <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
            {pinnedMessages.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleClickPinned(m)}
                className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-white/5 text-[11px]"
              >
                <div className="flex justify-between gap-2">
                  <span className="truncate font-medium">
                    {m.sender?.displayName || m.sender?.username || 'Unknown'}
                  </span>
                  <span className="shrink-0 text-slate-400">
                    {m.createdAt ? formatTime(m.createdAt) : ''}
                  </span>
                </div>
                <div className="truncate text-slate-300">
                  {m.text}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )}

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-1"
        onScroll={handleScroll}
      >

        {loadingMoreMessages && (
          <div className="flex justify-center py-2">
            <Spinner size={18} />
          </div>
        )}

        {loadingMessages ? (
          <div className="flex justify-center pt-10">
            <Spinner size={28} />
          </div>
        ) : (
          (() => {
            let lastDateKey = null;

            return messages.map((m) => {
              const date = m.createdAt ? new Date(m.createdAt) : null;
              const dayKey = date ? date.toDateString() : null;
              const showHeader = dayKey && dayKey !== lastDateKey;
              if (dayKey) lastDateKey = dayKey;

            return (
              <div
                key={m.id}
                ref={registerMessageRef(m.id)}
                className={
                  focusedMessageId === m.id
                    ? 'bg-white/5 rounded-xl -mx-2 px-2 py-1 transition-colors'
                    : undefined
                }
              >
                {showHeader && (
                  <div className="flex justify-center my-3">
                    <span className="px-3 py-1 text-[10px] rounded-full bg-white/5 text-slate-400 border border-white/10">
                      {formatDateHeader(date)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={m}
                  isOwn={m.sender?.isMe}
                  isGroup={conversation.isGroup}
                  onReply={() => startReply(m)}
                  onEdit={() => startEdit(m)}
                  onDelete={() => onDeleteMessage?.(m.id)}
                  onReact={(emoji) => onReactMessage?.(m.id, emoji)}
                  isPinned={pinnedMessages?.some((pm) => pm.id === m.id)}
                  onTogglePin={() => onToggleStarMessage?.(m.id)}
                  onForward={() => startForward(m)}
                  onReport={() => handleReportMessage(m)}
                  onShowReadReceipts={conversation.isGroup && m.sender?.isMe? () => openReadReceipts(m): undefined}
                />
              </div>
            );
            });
          })()
        )}
      </div>

            {editingMessage && (
        <div className="px-4 py-1.5 text-[11px] bg-amber-500/5 border-t border-amber-500/40 text-amber-200 flex items-center justify-between">
          <span>
            Editing message
            <span className="opacity-70"> – press Enter to save</span>
          </span>
          <button
            type="button"
            onClick={cancelEdit}
            className="text-[11px] underline underline-offset-2"
          >
            Cancel
          </button>
        </div>
      )}

        {replyTo && (
        <div className="px-4 py-2 border-t border-white/10 bg-black/40 flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-[10px] text-woy-accent mb-0.5">
              Replying to{' '}
              {replyTo.sender?.isMe
                ? 'yourself'
                : replyTo.sender?.displayName || replyTo.sender?.username}
            </p>
            <p className="text-[11px] text-slate-300 truncate">
              {replyTo.isDeleted ? 'Message deleted' : replyTo.text}
            </p>
          </div>
          <button
            type="button"
            onClick={cancelReply}
            className="text-xs text-slate-400 hover:text-slate-200"
          >
            ✕
          </button>
        </div>
      )}

            {readReceiptMessage && conversation?.isGroup && (
        <div className="px-4 py-2 border-t border-white/10 bg-black/90 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-200">
              Read receipts
            </span>
            <button
              type="button"
              onClick={closeReadReceipts}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              ✕
            </button>
          </div>

          <div className="text-[11px] text-slate-300">
            <p className="mb-1 truncate">
              Pesan:{' '}
              {readReceiptMessage.isDeleted
                ? 'Message deleted'
                : readReceiptMessage.text || '(no text)'}
            </p>

            {readReceiptLoading && (
              <p className="text-slate-400">Memuat read receipts...</p>
            )}

            {readReceiptError && (
              <p className="text-rose-300">{readReceiptError}</p>
            )}

            {readReceiptData && (
              <>
                <p className="mt-1 text-[10px] uppercase text-slate-400">
                  Seen by ({readReceiptData.seenBy?.length || 0})
                </p>
                {readReceiptData.seenBy?.length ? (
                  <ul className="mt-1 max-h-32 overflow-auto space-y-1">
                    {readReceiptData.seenBy.map((u) => (
                      <li
                        key={u.id}
                        className="flex items-center gap-2"
                      >
                        <Avatar
                          size={20}
                          name={u.displayName || u.username}
                          src={u.avatarUrl}
                        />
                        <span className="text-slate-100">
                          {u.displayName || u.username}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-400">
                    Belum ada member yang membaca pesan ini.
                  </p>
                )}

                {readReceiptData.notSeenBy?.length > 0 && (
                  <>
                    <p className="mt-2 text-[10px] uppercase text-slate-400">
                      Belum membaca (
                      {readReceiptData.notSeenBy.length})
                    </p>
                    <ul className="mt-1 max-h-32 overflow-auto space-y-1">
                      {readReceiptData.notSeenBy.map((u) => (
                        <li
                          key={u.id}
                          className="flex items-center gap-2"
                        >
                          <Avatar
                            size={20}
                            name={u.displayName || u.username}
                            src={u.avatarUrl}
                          />
                          <span className="text-slate-100">
                            {u.displayName || u.username}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {forwardSource && (
  <div className="px-4 py-2 border-t border-white/10 bg-black/90 flex flex-col gap-2">
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-slate-200">
        Forward message
      </span>
      <button
        type="button"
        onClick={cancelForward}
        className="text-[11px] text-slate-400 hover:text-slate-200"
      >
        ✕
      </button>
    </div>

    {/* preview pesan yang di-forward */}
    <div className="px-2 py-1 rounded bg-white/5 text-[11px] text-slate-200 line-clamp-2">
      {forwardSource.isDeleted
        ? 'Message deleted'
        : forwardSource.text || '(no text)'}
    </div>

    {/* filter/search destinasi */}
    <input
      type="text"
      value={forwardFilter}
      onChange={(e) => setForwardFilter(e.target.value)}
      placeholder="Search chat to forward..."
      className="mt-1 w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-slate-200 outline-none focus:border-woy-accent"
    />

    {/* daftar conversation tujuan */}
    <div className="mt-1 max-h-40 overflow-y-auto space-y-1">
      {allConversations
        .filter((c) => {
          if (!c) return false;
          // opsional: boleh exclude current conversation kalau mau
          // if (conversation && c.id === conversation.id) return false;

          const isGroup = c.isGroup;
          const other = c.otherParticipant;
          const title = isGroup
            ? c.name || 'Group'
            : other?.displayName || other?.username || 'User';

          if (!forwardFilter.trim()) return true;
          return title
            .toLowerCase()
            .includes(forwardFilter.toLowerCase());
        })
        .map((c) => {
          const isGroup = c.isGroup;
          const other = c.otherParticipant;
          const title = isGroup
            ? c.name || 'Group'
            : other?.displayName || other?.username || 'User';

          return (
            <button
              key={c.id}
              type="button"
              onClick={() => handleSelectForwardTarget(c.id)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded-lg text-left text-[11px] bg-black/40 hover:bg-white/10 border border-white/5"
            >
              <Avatar
                user={isGroup ? null : other}
                src={isGroup ? c.avatarUrl : undefined}
                size="xs"
              />
              <span className="truncate text-slate-100">{title}</span>
            </button>
          );
        })}
      {allConversations.length === 0 && (
        <p className="text-[10px] text-slate-500">
          No conversations to forward.
        </p>
      )}
    </div>
  </div>
)}

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-white/5 bg-black/40 px-3 md:px-4 py-3"
      >
        <div className="flex gap-2 items-end">
    <div className="flex-1 relative">
      <TextInput
        placeholder={
          isDmBlocked
            ? isBlockedByMe
              ? 'You blocked this user. Unblock to send messages.'
              : 'You are blocked by this user. You cannot send messages.'
            : 'Say something chill...'
        }
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        disabled={isDmBlocked}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && editingMessage) {
            e.preventDefault();
            cancelEdit();
          }
        }}
      />

      {/* DROPDOWN MENTION */}
      {conversation?.isGroup &&
        isMentionOpen &&
        mentionSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 bottom-full mb-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-black/95 shadow-lg z-20">
            {mentionSuggestions.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => handleSelectMention(m)}
                className="w-full px-3 py-2 text-left text-xs hover:bg-white/10 flex items-center gap-2"
              >
                <Avatar user={m} size="xs" />
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-100 truncate">
                    {m.displayName || m.username}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    @{m.username}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
    </div>
          <Button
            type="submit"
            variant="primary"
            className="h-11 px-4 text-xs"
            disabled={isDmBlocked}
          >
            Send
          </Button>
        </div>
      </form>

      {isGroup && showGroupInfo && (
        <div className="absolute inset-y-0 right-0 w-full max-w-xs bg-black/95 border-l border-white/10 shadow-2xl z-20 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div>
              <p className="text-xs font-semibold text-slate-100">
                Group info
              </p>
              <p className="text-[11px] text-slate-500 truncate">
                Manage members & settings
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGroupInfo(false)}
              className="text-xs text-slate-400 hover:text-slate-100"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
            {/* DETAILS */}
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-2">
                Details
              </p>
              {isAdmin ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Group name
                    </label>
                    <input
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-woy-accent"
                      value={groupName}
                      onChange={(e) => setGroupName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2 mt-3">
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Avatar URL
                    </label>
                    <input
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-woy-accent"
                      value={groupAvatar}
                      onChange={(e) => setGroupAvatar(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveGroupDetails}
                    disabled={savingDetails}
                    className="mt-3 inline-flex items-center justify-center rounded-full bg-woy-accent px-3 py-1.5 text-[11px] font-medium text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingDetails ? 'Saving…' : 'Save changes'}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-100">
                    {conversation.name}
                  </p>
                  {conversation.avatarUrl && (
                    <p className="text-[11px] text-slate-500 break-all mt-1">
                      {conversation.avatarUrl}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* INVITE CODE */}
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-2">
                Invite
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 px-2.5 py-1.5 text-[11px] text-slate-100 outline-none"
                    value={inviteCode || ''}
                    readOnly
                    placeholder="No invite code yet"
                  />
                  <button
                    type="button"
                    onClick={handleCopyInviteCode}
                    disabled={!inviteCode}
                    className="text-[10px] px-2 py-1 rounded-full border border-white/15 text-slate-100 hover:bg-white/5 disabled:opacity-40"
                  >
                    {inviteCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleGenerateInvite}
                    disabled={inviteLoading}
                    className="text-[10px] px-2 py-1 rounded-full border border-woy-accent/60 text-woy-accent hover:bg-woy-accent/10 disabled:opacity-40"
                  >
                    {inviteLoading
                      ? 'Generating…'
                      : inviteCode
                      ? 'Reset invite code'
                      : 'Generate invite code'}
                  </button>
                )}
              </div>
            </div>

            {/* MEMBERS */}
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-2">
                Members ({conversation.participants?.length || 0})
              </p>
              <div className="space-y-2">
                {conversation.participants?.map((m) => {
                  const isMemberCreator = creatorId === m.id;
                  const isMemberAdmin = adminIds.includes(m.id);
                  const isSelf = currentUserId === m.id;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between rounded-xl bg-white/5 px-2.5 py-1.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="inline-flex h-7 w-7 rounded-full bg-white/10 items-center justify-center text-[11px] text-slate-100">
                          {m.displayName?.[0]?.toUpperCase() ||
                            m.username?.[0]?.toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-100 truncate">
                            {m.displayName || m.username}
                            {isSelf && (
                              <span className="ml-1 text-[10px] text-slate-400">
                                (you)
                              </span>
                            )}
                          </p>
                          <p className="text-[10px] text-slate-500 truncate">
                            @{m.username}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isMemberCreator && (
                          <span className="text-[10px] text-amber-300">
                            owner
                          </span>
                        )}
                        {!isMemberCreator && isMemberAdmin && (
                          <span className="text-[10px] text-emerald-300">
                            admin
                          </span>
                        )}

                        {isAdmin && !isMemberCreator && !isSelf && (
                          <>
                            {!isMemberAdmin && (
                              <button
                                type="button"
                                onClick={() => handlePromoteToAdmin(m.id)}
                                disabled={updatingMemberId === m.id}
                                className="text-[10px] text-emerald-300 hover:text-emerald-200 disabled:opacity-40"
                              >
                                {updatingMemberId === m.id
                                  ? 'Updating…'
                                  : 'Make admin'}
                              </button>
                            )}

                            {isMemberAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDemoteAdmin(m.id)}
                                disabled={updatingMemberId === m.id}
                                className="text-[10px] text-slate-300 hover:text-slate-100 disabled:opacity-40"
                              >
                                {updatingMemberId === m.id
                                  ? 'Updating…'
                                  : 'Remove admin'}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.id)}
                              disabled={updatingMemberId === m.id}
                              className="text-[10px] text-rose-300 hover:text-rose-200 disabled:opacity-40"
                            >
                              {updatingMemberId === m.id
                                ? 'Removing…'
                                : 'Remove'}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {isAdmin && (
                <div className="mt-3">
                  <p className="text-[11px] text-slate-400 mb-1">
                    Add member
                  </p>
                  <input
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-woy-accent"
                    placeholder="Search username…"
                    value={memberSearchTerm}
                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                  />
                  {memberSearchTerm && (
                    <div className="mt-1 max-h-40 overflow-y-auto rounded-xl bg-black/80 border border-white/10">
                      {memberSearchLoading ? (
                        <p className="text-[11px] text-slate-400 px-3 py-2">
                          Searching…
                        </p>
                      ) : memberSearchResults.length === 0 ? (
                        <p className="text-[11px] text-slate-500 px-3 py-2">
                          No users
                        </p>
                      ) : (
                        memberSearchResults.map((u) => (
                          <button
                            key={u.id || u._id}
                            type="button"
                            onClick={() => handleAddMember(u)}
                            disabled={updatingMemberId === (u.id || u._id)}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-left text-[11px] hover:bg-white/5"
                          >
                            <span className="inline-flex h-6 w-6 rounded-full bg-white/10 items-center justify-center text-[10px] text-slate-100">
                              {u.displayName?.[0]?.toUpperCase() ||
                                u.username?.[0]?.toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-slate-100">
                                {u.displayName || u.username}
                              </p>
                              <p className="truncate text-[10px] text-slate-500">
                                @{u.username}
                              </p>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* DANGER ZONE */}
            <div className="border-t border-white/10 pt-3 mt-2">
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-2">
                Danger zone
              </p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={handleLeaveGroupClick}
                  disabled={leavingGroup}
                  className="w-full inline-flex items-center justify-center rounded-full border border-rose-400/70 px-3 py-1.5 text-[11px] font-medium text-rose-200 hover:bg-rose-500/10 disabled:opacity-40"
                >
                  {leavingGroup ? 'Leaving…' : 'Leave group'}
                </button>
                {isCreator && (
                  <button
                    type="button"
                    onClick={handleDeleteGroupClick}
                    disabled={deletingGroup}
                    className="w-full inline-flex items-center justify-center rounded-full bg-rose-600/80 px-3 py-1.5 text-[11px] font-medium text-slate-50 hover:bg-rose-600 disabled:opacity-40"
                  >
                    {deletingGroup ? 'Deleting…' : 'Delete group for everyone'}
                  </button>
                )}
              </div>
            </div>

            {groupError && (
              <p className="mt-2 text-[11px] text-rose-300">{groupError}</p>
            )}
          </div>
        </div>
      )}

    </section>
  );
};

export default ChatPanel;