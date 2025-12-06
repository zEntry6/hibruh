const tabs = [
  { id: 'all', label: 'All' },
  { id: 'pinned', label: 'Pinned' },
  { id: 'unread', label: 'Unread' },
  { id: 'archived', label: 'Archived' }
];

const CategoryTabs = ({ active, onChange }) => {
  return (
    <div className="flex gap-2 text-xs">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`badge-pill border border-white/10 transition-all ${
            active === tab.id
              ? 'bg-woy-accent text-slate-900 shadow-md'
              : 'bg-white/5 text-slate-300 hover:bg-white/10'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default CategoryTabs;
