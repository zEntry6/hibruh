const Avatar = ({ size = 32, name = '?', src }) => {
  const initials =
    name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?';

  return src ? (
    <img
      src={src}
      alt={name}
      className="rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full bg-white/10 text-xs flex items-center justify-center font-semibold"
      style={{ width: size, height: size }}
    >
      {initials}
    </div>
  );
};

export default Avatar;
