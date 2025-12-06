// frontend/src/utils/date.js

// format "HH.mm", mis: 14.23
export const formatTime = (isoString) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);
};

// cek apakah dua tanggal ada di hari yang sama
export const isSameDay = (a, b) => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

// untuk header pemisah hari ("Today", "Yesterday", atau dd MMM yyyy)
export const formatDateHeader = (date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

export const formatLastSeen = (isoString) => {
  if (!isoString) return 'last seen recently';

  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'last seen recently';

  const now = new Date();
  const today = now;
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const timePart = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(date);

  if (isSameDay(date, today)) {
    return `last seen today at ${timePart}`;
  }
  if (isSameDay(date, yesterday)) {
    return `last seen yesterday at ${timePart}`;
  }

  const datePart = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(date);

  return `last seen ${datePart} at ${timePart}`;
};
