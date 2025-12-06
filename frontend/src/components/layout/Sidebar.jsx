import { useEffect, useMemo, useState } from 'react';
import TextInput from '../ui/TextInput';
import CategoryTabs from '../ui/CategoryTabs';
import ConversationItem from '../ui/ConversationItem';
import { api } from '../../utils/api';
import Spinner from '../ui/Spinner';

const Sidebar = ({
  conversations,
  activeConversationId,
  onSelectConversation,
  pinnedIds,
  setPinnedIds,
  mutedIds,
  setMutedIds,
  archivedIds,
  setArchivedIds,
  onCreateGroup,
  onJoinGroupByCode,
  hasMoreConversations,
  loadingMoreConversations,
  onLoadMoreConversations
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
    // GLOBAL MESSAGE SEARCH
  const [messageSearchTerm, setMessageSearchTerm] = useState('');
  const [messageSearchResults, setMessageSearchResults] = useState([]);
  const [messageSearchLoading, setMessageSearchLoading] = useState(false);
  const [messageSearchError, setMessageSearchError] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // state baru untuk group
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [creatingGroupLoading, setCreatingGroupLoading] = useState(false);

  const [joinCode, setJoinCode] = useState('');
  const [joiningGroup, setJoiningGroup] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!searchTerm.trim()) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      api
        .get('/users', { params: { search: searchTerm } })
        .then((res) => setSearchResults(res.data))
        .finally(() => setSearchLoading(false));
    }, 350);

    return () => clearTimeout(timeout);
  }, [searchTerm]);

    useEffect(() => {
    const timeout = setTimeout(() => {
      const term = messageSearchTerm.trim();

      if (!term) {
        setMessageSearchResults([]);
        setMessageSearchError('');
        return;
      }

      if (term.length < 2) {
        setMessageSearchResults([]);
        setMessageSearchError('Type at least 2 characters');
        return;
      }

      setMessageSearchLoading(true);
      setMessageSearchError('');

      api
        .get('/messages/search', {
          params: {
            q: term,
            limit: 20 // global search: ambil max 20 hasil
          }
        })
        .then((res) => {
          const items = Array.isArray(res.data?.items)
            ? res.data.items
            : [];
          setMessageSearchResults(items);
        })
        .catch((err) => {
          console.error('Global message search error', err);
          setMessageSearchError('Failed to search messages');
        })
        .finally(() => {
          setMessageSearchLoading(false);
        });
    }, 400);

    return () => clearTimeout(timeout);
  }, [messageSearchTerm]);

  const filteredConversations = useMemo(() => {
    let base = conversations;

    // Archive: jika tab 'archived', hanya tampilkan yang di-archive
    // selain itu, sembunyikan yang di-archive
    if (activeTab === 'archived') {
      base = base.filter((c) => archivedIds.includes(c.id));
    } else {
      base = base.filter((c) => !archivedIds.includes(c.id));
    }

    if (activeTab === 'pinned') {
      return base.filter((c) => pinnedIds.includes(c.id));
    }
    if (activeTab === 'unread') {
      return base.filter((c) => c.unreadCount > 0);
    }

    // tab 'all' atau lainnya → base saja
    return base;
  }, [conversations, activeTab, pinnedIds, archivedIds]);

  const togglePin = (id) => {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

    const toggleMute = (id) => {
    setMutedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleArchive = (id) => {
    setArchivedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

    const handleCreateGroupClick = async () => {
    if (!onCreateGroup) return;

    const name = groupName.trim();
    if (!name || selectedUsers.length < 2) return;

    setCreatingGroupLoading(true);
    try {
      await onCreateGroup({
        name,
        memberIds: selectedUsers.map((u) => u._id)
      });

      // reset state setelah berhasil
      setGroupName('');
      setSelectedUsers([]);
      setIsCreatingGroup(false);
      setSearchTerm('');
      setSearchResults([]);
    } catch (err) {
      console.error('Create group error', err);
    } finally {
      setCreatingGroupLoading(false);
    }
  };

  const handleJoinGroupClick = async () => {
    const code = joinCode.trim();
    if (!code) return;
    if (!onJoinGroupByCode) return;

    setJoiningGroup(true);
    setJoinError('');
    try {
      const conv = await onJoinGroupByCode(code);
      if (conv) {
        setJoinCode('');
        setIsJoinModalOpen(false); // tutup modal kalau berhasil join
      }
    } catch (err) {
      setJoinError(
        err?.response?.data?.message || 'Failed to join group by code'
      );
    } finally {
      setJoiningGroup(false);
    }
  };

  return (
    <aside className="flex w-full flex-col bg-black/10 border-white/5 md:border-r md:max-w-xs md:h-[520px]">
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-1">
          Inbox
        </p>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-100">
            H!BRUH
          </h2>
          <button
            type="button"
            onClick={() => setIsCreatingGroup((prev) => !prev)}
            className="text-[11px] text-woy-accent hover:text-woy-accent/80"
          >
            {isCreatingGroup ? 'Close' : 'New group'}
          </button>
        </div>
        <CategoryTabs active={activeTab} onChange={setActiveTab} />
      </div>


      {/* UNIFIED SEARCH: users + messages */}
      <div className="px-4 py-3 border-b border-white/5 bg-black/30">
        <TextInput
          placeholder="Search users or messages..."
          value={searchTerm}
          onChange={(e) => {
            const value = e.target.value;
            // satu input mengontrol dua state
            setSearchTerm(value);
            setMessageSearchTerm(value);
          }}
          inputClassName="text-xs"
        />

        {/* USER SEARCH RESULTS */}
        {searchTerm && (
          <div className="mt-2 max-h-52 overflow-y-auto rounded-2xl bg-black/40 border border-white/10 p-2 text-xs">
            {searchLoading ? (
              <div className="flex justify-center py-4">
                <Spinner />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-slate-500 text-[11px]">
                No users found for &quot;{searchTerm}&quot;
              </p>
            ) : (
              searchResults.map((u) => {
                const isSelected = selectedUsers.some((p) => p._id === u._id);

                return (
                  <button
                    key={u._id}
                    type="button"
                    onClick={() => {
                      if (isCreatingGroup) {
                        // mode bikin group → toggle user sebagai member
                        setSelectedUsers((prev) =>
                          prev.some((p) => p._id === u._id)
                            ? prev.filter((p) => p._id !== u._id)
                            : [...prev, u]
                        );
                      } else {
                        // mode biasa → langsung buka DM seperti sebelumnya
                        onSelectConversation({ newUserForConversation: u });
                        setSearchTerm('');
                        setMessageSearchTerm('');
                        setSearchResults([]);
                        setMessageSearchResults([]);
                      }
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-white/5 text-left"
                  >
                    <span className="h-6 w-6 rounded-full bg-white/10 text-[10px] flex items-center justify-center font-semibold">
                      {(u.displayName || u.username || '?')
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-slate-100 truncate">
                        {u.displayName || u.username}
                      </p>
                      {u.username && (
                        <p className="text-[10px] text-slate-500 truncate">
                          @{u.username}
                        </p>
                      )}
                    </div>
                    {isCreatingGroup && (
                      <span className="ml-2 text-[10px] text-woy-accent">
                        {isSelected ? 'Selected' : 'Add'}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {/* MESSAGE SEARCH RESULTS */}
        {messageSearchTerm && (
          <div className="mt-2 max-h-60 overflow-y-auto rounded-2xl bg-black/40 border border-white/10 p-2 text-xs">
            {messageSearchLoading ? (
              <div className="flex justify-center py-3">
                <Spinner />
              </div>
            ) : messageSearchError ? (
              <p className="text-rose-400 text-[11px]">{messageSearchError}</p>
            ) : messageSearchResults.length === 0 ? (
              <p className="text-slate-500 text-[11px]">
                No messages found for &quot;{messageSearchTerm}&quot;
              </p>
            ) : (
              messageSearchResults.map((m) => {
                // cari conversation full dari props conversations
                const conv = conversations.find(
                  (c) => c.id === m.conversation.id
                );
                const other = conv?.otherParticipant;
                const convTitle = m.conversation.isGroup
                  ? m.conversation.name || 'Group'
                  : other?.displayName || other?.username || 'Conversation';

                const senderName =
                  m.sender?.displayName || m.sender?.username || 'Unknown';

                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      // buka chat yang sesuai dan jump ke pesan ini
                      if (conv) {
                        onSelectConversation({
                          conversation: conv,
                          jumpToMessageId: m.id
                        });
                      }
                      setSearchTerm('');
                      setMessageSearchTerm('');
                      setMessageSearchResults([]);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded-xl hover:bg-white/5 mb-1 last:mb-0"
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-medium text-slate-100 truncate max-w-[55%]">
                        {convTitle}
                      </span>
                      {m.createdAt && (
                        <span className="text-[10px] text-slate-500">
                          {new Date(m.createdAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 mb-0.5 truncate">
                      <span className="font-medium">{senderName}:</span>{' '}
                      {m.snippet}
                    </p>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

            {isCreatingGroup && (
        <div className="px-4 py-3 border-b border-white/5 bg-black/40">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 mb-2">
            New group
          </p>
          <TextInput
            placeholder="Group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedUsers.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                Select at least 2 members from search above.
              </p>
            ) : (
              selectedUsers.map((u) => (
                <span
                  key={u._id}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-slate-100"
                >
                  {u.displayName || u.username}
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedUsers((prev) =>
                        prev.filter((p) => p._id !== u._id)
                      )
                    }
                    className="text-[9px] text-slate-400 hover:text-rose-300"
                  >
                    ×
                  </button>
                </span>
              ))
            )}
          </div>
          <div className="mt-3 flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => {
                setIsCreatingGroup(false);
                setGroupName('');
                setSelectedUsers([]);
              }}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateGroupClick}
              disabled={
                !groupName.trim() ||
                selectedUsers.length < 2 ||
                creatingGroupLoading
              }
              className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-woy-accent text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creatingGroupLoading ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* JOIN GROUP BY CODE */}
      <div className="px-4 py-3 border-b border-white/5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500 mb-1">
          Join group
        </p>
        <button
          type="button"
          onClick={() => {
            setIsJoinModalOpen(true);
            setJoinError('');
          }}
          className="text-[11px] px-3 py-1 rounded-full border border-white/10 text-slate-100 hover:bg-white/5"
        >
          Join with code
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
      {filteredConversations.length === 0 ? (
        <div className="h-full flex items-center justify-center text-xs text-slate-500">
          <p>No conversations yet. Search a username to start a chat.</p>
        </div>
      ) : (
        <>
      {filteredConversations.map((c) => (
        <ConversationItem
          key={c.id}
          conversation={c}
          isActive={c.id === activeConversationId}
          onClick={() => onSelectConversation({ conversation: c })}
          pinned={pinnedIds.includes(c.id)}
          muted={mutedIds.includes(c.id)}
          archived={archivedIds.includes(c.id)}
          onTogglePin={togglePin}
          onToggleMute={toggleMute}
          onToggleArchive={toggleArchive}
        />
      ))}

          {hasMoreConversations && (
            <div className="mt-2 mb-1 flex justify-center">
              <button
                type="button"
                onClick={onLoadMoreConversations}
                disabled={loadingMoreConversations}
                className="text-xs px-3 py-1 rounded-full border border-white/10 hover:bg-white/5 disabled:opacity-50"
              >
                {loadingMoreConversations ? 'Loading…' : 'Load more conversations'}
              </button>
            </div>
          )}
        </>
      )}
      </div>

      {isJoinModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-xs mx-4 rounded-2xl bg-slate-950 border border-white/10 shadow-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-slate-100">
                Join group
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (!joiningGroup) {
                    setIsJoinModalOpen(false);
                    setJoinError('');
                  }
                }}
                className="text-xs text-slate-400 hover:text-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <TextInput
                label="Invite code"
                placeholder="Enter invite code..."
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  setJoinError('');
                }}
                inputClassName="text-xs"
              />

              {joinError && (
                <p className="text-[11px] text-rose-300">{joinError}</p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    if (!joiningGroup) {
                      setIsJoinModalOpen(false);
                      setJoinError('');
                    }
                  }}
                  className="text-[11px] px-3 py-1 rounded-full border border-white/10 text-slate-200 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleJoinGroupClick}
                  disabled={joiningGroup || !joinCode.trim()}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-woy-accent text-slate-900 hover:bg-woy-accent/90 disabled:opacity-40"
                >
                  {joiningGroup ? 'Joining…' : 'Join'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
