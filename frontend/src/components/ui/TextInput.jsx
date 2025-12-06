const TextInput = ({
  label,
  helper,
  className = '',
  inputClassName = '',
  ...props
}) => {
  return (
    <label className={`block text-sm ${className}`}>
      {label && <span className="mb-1 block text-slate-300">{label}</span>}
      <input
        className={`w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-woy-accent/60 focus:border-woy-accent/30 transition-all ${inputClassName}`}
        {...props}
      />
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </label>
  );
};

export default TextInput;
