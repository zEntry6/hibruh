const Shell = ({ children }) => {
  return (
    <div className="min-h-screen flex justify-center md:items-center bg-woy-bg px-0 md:px-4 py-0 md:py-6">
      <div className="glass-panel w-full md:max-w-6xl md:rounded-3xl rounded-none overflow-hidden relative min-h-screen md:min-h-[520px]">
        {/* background glow */}
        <div className="pointer-events-none absolute -left-24 -top-24 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative h-full">{children}</div>
      </div>
    </div>
  );
};

export default Shell;
