const Button = ({ children, className = '', variant = 'primary', ...props }) => {
  const base =
    'inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-woy-bg';

  const variants = {
    primary:
      'bg-woy-accent text-slate-900 hover:bg-woy-accentSoft active:scale-[0.97]',
    ghost:
      'bg-white/5 text-slate-100 hover:bg-white/10 border border-white/10 active:scale-[0.97]',
    subtle:
      'bg-white/5 text-slate-300 hover:bg-white/10 active:scale-[0.97]'
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
};

export default Button;
