import Avatar from './Avatar';

const ConversationItem = ({
  conversation,
  isActive,
  onClick,
  pinned,
  onTogglePin,
  muted,
  archived,
  onToggleMute,
  onToggleArchive
}) => {
  const isGroup = conversation.isGroup;
  const other = conversation.otherParticipant;

  const title = isGroup
    ? conversation.name || 'Group'
    : other?.displayName || other?.username;

  const subtitle = isGroup
    ? `${conversation.participants?.length || 0} members`
    : other
    ? `@${other.username}`
    : '';

  const last = conversation.lastMessage;
  const unread = conversation.unreadCount || 0;

  const avatarName = isGroup ? title : other?.displayName || other?.username;
  const avatarSrc = isGroup ? conversation.avatarUrl : other?.avatarUrl;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 mb-1.5 text-left transition-all ${
        isActive
          ? 'bg-white/10 border border-woy-accent/40 shadow-lg'
          : 'bg-white/5 border border-white/5 hover:bg-white/10'
      }`}
    >
      <Avatar size={38} name={avatarName} src={avatarSrc} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-slate-100">
            {title}
          </span>
                  {muted && (
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">
              🔕
            </span>
          )}
          {archived && (
            <span className="text-[10px] text-slate-400 uppercase tracking-wide">
              🗂️
            </span>
          )}
          {!isGroup && other?.username && (
            <span className="text-[10px] text-slate-500">
              @{other.username}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-xs text-slate-400">
          {last?.text || (isGroup ? 'Start the conversation 👋' : 'Say hi 👋')}
        </p>
        {isGroup && (
          <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
        )}
      </div>

      <div className="flex flex-col items-end gap-1">
        {unread > 0 && (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-woy-accent text-[10px] font-semibold text-slate-900">
            {unread > 9 ? '9+' : unread}
          </span>
        )}

        <div className="flex items-center gap-2">
          {/* Pin */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin && onTogglePin(conversation.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onTogglePin && onTogglePin(conversation.id);
              }
            }}
            className="text-[10px] text-slate-500 hover:text-woy-accent cursor-pointer"
          >
            {pinned ? 'Pinned' : 'Pin'}
          </span>

          {/* Mute / Unmute */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggleMute && onToggleMute(conversation.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggleMute && onToggleMute(conversation.id);
              }
            }}
            className={`text-[10px] cursor-pointer ${
              muted ? 'text-slate-400' : 'text-slate-500 hover:text-slate-200'
            }`}
          >
            {muted ? 'Muted' : 'Mute'}
          </span>

          {/* Archive / Unarchive */}
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onToggleArchive && onToggleArchive(conversation.id);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onToggleArchive && onToggleArchive(conversation.id);
              }
            }}
            className={`text-[10px] cursor-pointer ${
              archived
                ? 'text-slate-400'
                : 'text-slate-500 hover:text-slate-200'
            }`}
          >
            {archived ? 'Archived' : 'Archive'}
          </span>
        </div>
      </div>
    </button>
  );
};

export default ConversationItem;
