import { useState } from 'react';
import Avatar from './Avatar';
import { formatTime } from '../../utils/date';

// Komponen kecil untuk status dots
const StatusDots = ({ status }) => {
  let count = 1;
  let colorClass = 'bg-slate-900'; // default: hitam gelap

  switch (status) {
    case 'sent':
      count = 1;
      colorClass = 'bg-slate-900'; // 1 dot hitam
      break;
    case 'delivered':
      count = 2;
      colorClass = 'bg-slate-900'; // 2 dot hitam
      break;
    case 'seen':
      count = 2;
      colorClass = 'bg-white'; // 2 dot putih
      break;
    default:
      count = 1;
      colorClass = 'bg-slate-900';
  }

  return (
    <span className="inline-flex items-center gap-[3px] ml-0.5">
      {Array.from({ length: count }).map((_, idx) => (
        <span
          key={idx}
          className={`inline-block w-1.5 h-1.5 rounded-full ${colorClass} opacity-80`}
        />
      ))}
    </span>
  );
};

const QUICK_REACTIONS = ['👍', '❤️', '😂', '🔥', '😮', '😢'];

const MessageBubble = ({
  message,
  isOwn,
  isGroup,
  onReply,
  onEdit,
  onDelete,
  onReact,
  isPinned = false,
  onTogglePin,
  onForward,
  onShowReadReceipts,
  onReport
}) => {
  const isSystem = message?.type === 'system';

  // kalau system message: tampil sederhana di tengah, tanpa avatar & menu
  if (isSystem) {
    return (
      <div className="w-full flex justify-center my-2">
        <div className="px-3 py-1 rounded-full bg-slate-800/60 text-[11px] text-slate-200">
          {message.text}
        </div>
      </div>
    );
  }

  // deklarasi dulu
  const isDeleted = !!message.isDeleted;
  const isEdited = !!message.isEdited;

  // baru pakai di sini
  const showSenderName = isGroup && !isOwn && !isDeleted;
  const timeLabel = formatTime(message.createdAt);
  const status = message.status || 'sent';

  const content = isDeleted ? 'Message deleted' : message.text;

  const reply = message.replyTo || null;
  const replySender =
    reply?.sender?.displayName || reply?.sender?.username;

  const reactions = message.reactions || [];

  // state untuk membuka / menutup picker emoji di bawah bubble
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  return (
    <div
      className={`flex gap-2 mb-2 ${
        isOwn ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isOwn && message.sender && (
        <Avatar
          size={24}
          name={message.sender.displayName || message.sender.username}
          src={message.sender.avatarUrl}
        />
      )}

      <div className="flex max-w-[70%] flex-col">
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-snug shadow-sm ${
            isOwn
              ? isDeleted
                ? 'bg-emerald-500/10 text-emerald-100 border border-emerald-500/40 rounded-br-md'
                : 'bg-woy-accent text-slate-900 rounded-br-md'
              : isDeleted
              ? 'bg-white/5 text-slate-400 border border-white/10 rounded-bl-md'
              : 'bg-white/8 text-slate-100 border border-white/10 rounded-bl-md'
          }`}
        >
          {/* Sender name for group */}
          {showSenderName && (
            <p className="mb-0.5 text-[11px] text-emerald-400">
              {message.sender?.displayName || message.sender?.username}
            </p>
          )}

          {/* Reply header */}
          {reply && (
            <div className="mb-1 px-2 py-1 rounded-xl bg-black/10 border-l-2 border-woy-accent/60 text-[11px]">
              <p className="font-medium text-slate-200">
                {replySender || 'Quoted message'}
              </p>
              <p className="text-slate-300 truncate">
                {reply.isDeleted ? 'Message deleted' : reply.text}
              </p>
            </div>
          )}

          {/* Main content */}
          <p className={isDeleted ? 'italic text-[12px] opacity-80' : undefined}>
            {content}
          </p>

          <p className="mt-1 text-[10px] flex items-center justify-end gap-1">
            <span
              className={
                isOwn ? 'text-slate-800/80' : 'text-slate-400/80'
              }
            >
              {timeLabel}
              {isPinned && (
                <span className="ml-1 text-[10px] text-yellow-400">★</span>
              )}
              {isEdited && !isDeleted && (
                <span className="ml-1 opacity-75">(edited)</span>
              )}
            </span>
            {isOwn && !isDeleted && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onShowReadReceipts) {
                    onShowReadReceipts();
                  }
                }}
                className="inline-flex items-center"
                title={
                  isGroup
                    ? 'Lihat siapa saja yang sudah membaca'
                    : undefined
                }
              >
                <StatusDots status={status} />
              </button>
            )}
          </p>
        </div>

        {/* Actions: 1 tombol emoji + Reply/Edit/Delete */}
        <div className="mt-1 flex justify-end gap-3 text-[10px] text-slate-500">
          {/* TOMBOL EMOJI TUNGGAL DI BAWAH BUBBLE */}
          <div className="relative">
            <button
              type="button"
              className="text-xs px-1.5 py-0.5 rounded-full bg-black/40 hover:bg-black/60 border border-white/10"
              onClick={(e) => {
                e.stopPropagation();
                setShowReactionPicker((prev) => !prev);
              }}
            >
              🙂
            </button>

            {/* PICKER EMOJI MUNCUL DI ROOM CHAT */}
            {showReactionPicker && onReact && !isDeleted && (
              <div
                className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 
                           flex items-center gap-1 bg-black/90 px-2 py-1 rounded-full shadow-lg z-10"
              >
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReact(emoji);
                      setShowReactionPicker(false);
                    }}
                    className="text-base hover:scale-110 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* TOMBOL Reply / Forward / Edit / Delete */}
          <button
            type="button"
            onClick={onReply}
            className="hover:text-slate-300 transition-colors"
          >
            Reply
          </button>

          {/* Forward tersedia selama pesan belum dihapus */}
          {!isDeleted && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onForward && onForward();
              }}
              className="hover:text-slate-300 transition-colors"
            >
              Forward
            </button>
          )}

                    {!isDeleted && onReport && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReport();
              }}
              className="hover:text-amber-300 transition-colors"
            >
              Report
            </button>
          )}

          {isOwn && !isDeleted && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="hover:text-slate-300 transition-colors"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="hover:text-rose-300 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>
        {reactions.length > 0 && (
  <div
    className={`mt-1 flex flex-wrap gap-1 ${
      isOwn ? 'justify-end' : 'justify-start'
    }`}
  >
    {reactions.map((r) => (
      <button
        key={r.emoji}
        type="button"
        onClick={() => onReact?.(r.emoji)}
        className={`px-2 py-0.5 rounded-full border text-[11px] flex items-center gap-1
          ${
            r.reactedByMe
              ? 'bg-woy-soft border-woy-accent text-white'
              : 'bg-black/40 border-white/10 text-slate-200'
          }`}
      >
        <span>{r.emoji}</span>
        <span>{r.count}</span>
      </button>
    ))}
  </div>
)}
      </div>

      {isOwn && <div className="w-6" />}
    </div>
  );
};

export default MessageBubble;
