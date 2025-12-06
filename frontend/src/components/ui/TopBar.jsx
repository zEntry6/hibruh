import { useState } from 'react';
import Avatar from './Avatar';
import Button from './Button';
import { useAuth } from '../../context/AuthContext';
import ProfilePanel from '../profile/ProfilePanel';
import { Link } from 'react-router-dom';

const TopBar = () => {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleOpenProfile = () => {
    if (!user) return;
    setProfileOpen(true);
  };

  const handleCloseProfile = () => {
    setProfileOpen(false);
  };

  const displayName = user?.displayName || user?.username || 'You';

  return (
    <>
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-black/40 backdrop-blur-sm">
        {/* Kiri: profile chip */}
        {user && (
          <button
            type="button"
            onClick={handleOpenProfile}
            className="flex items-center gap-2 rounded-full px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
          >
            <Avatar
              size={30}
              name={displayName}
              src={user.avatarUrl}
            />
            <div className="text-left">
              <p className="text-xs font-medium text-slate-100 leading-tight truncate max-w-[140px]">
                {displayName}
              </p>
              <p className="text-[10px] text-slate-500 leading-tight truncate max-w-[140px]">
                @{user.username}
              </p>
            </div>
          </button>
        )}

      {/* Kanan: Moderation (admin) + Logout */}
      <div className="flex items-center gap-2">
        {user?.isAdmin && (
          <Link
            to="/moderation"
            className="text-[11px] px-2 py-1 rounded-full border border-amber-400/60 text-amber-200 hover:bg-amber-500/10"
          >
            Moderation
          </Link>
        )}

        {user && (
          <Button
            variant="ghost"
            onClick={logout}
            className="text-xs px-3 py-1.5"
          >
            Logout
          </Button>
        )}
        </div>
      </header>

      {user && (
        <ProfilePanel
          isOpen={profileOpen}
          onClose={handleCloseProfile}
          user={user}
        />
      )}
    </>
  );
};

export default TopBar;
