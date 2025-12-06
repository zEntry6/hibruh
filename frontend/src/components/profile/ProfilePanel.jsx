import { useEffect, useState } from 'react';
import Avatar from '../ui/Avatar';
import TextInput from '../ui/TextInput';
import Button from '../ui/Button';
import { api } from '../../utils/api';

const ProfilePanel = ({ isOpen, onClose, user }) => {
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailChangePassword, setEmailChangePassword] = useState('');
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState('');
  const [emailChangeSuccess, setEmailChangeSuccess] = useState('');

  const [blockedUsers, setBlockedUsers] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [blockedError, setBlockedError] = useState('');

  const [myReports, setMyReports] = useState([]);
  const [myReportsLoading, setMyReportsLoading] = useState(false);
  const [myReportsError, setMyReportsError] = useState('');

  useEffect(() => {
    if (!isOpen || !user) return;

    // reset data profile ke nilai dari user
    setDisplayName(user.displayName || user.username || '');
    setBio(user.bio || '');
    setAvatarUrl(user.avatarUrl || '');
    setError('');

    // reset form password setiap kali panel dibuka
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess('');

    // reset form change email
    setNewEmail('');
    setEmailChangePassword('');
    setEmailChangeError('');
    setEmailChangeSuccess('');

    // reset state privacy
    setBlockedUsers([]);
    setBlockedError('');
    setMyReports([]);
    setMyReportsError('');

    const fetchPrivacy = async () => {
      // blocked users
      try {
        setBlockedLoading(true);
        const res = await api.get('/users/me/blocked');
        setBlockedUsers(res.data?.items || []);
      } catch (err) {
        console.error('Load blocked users error', err);
        setBlockedError(
          err?.response?.data?.message || 'Failed to load blocked users.'
        );
      } finally {
        setBlockedLoading(false);
      }

      // my reports
      try {
        setMyReportsLoading(true);
        const res2 = await api.get('/reports/my', {
          params: { limit: 10 }
        });
        setMyReports(res2.data?.items || []);
      } catch (err) {
        console.error('Load my reports error', err);
        setMyReportsError(
          err?.response?.data?.message || 'Failed to load your reports.'
        );
      } finally {
        setMyReportsLoading(false);
      }
    };

    fetchPrivacy();
  }, [isOpen, user]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const res = await api.patch('/users/me', {
        displayName,
        bio,
        avatarUrl
      });

      const updatedUser = res.data?.user || res.data;

      // update user di localStorage supaya setelah reload data baru kepakai
      localStorage.setItem('woy_user', JSON.stringify(updatedUser));

      // paling simple: reload seluruh app supaya semua context & UI sync
      window.location.reload();
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message || 'Failed to update profile';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

    const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await api.post('/users/change-password', {
        currentPassword,
        newPassword
      });

      setPasswordSuccess(
        res.data?.message || 'Password updated successfully.'
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        'Failed to change password. Please try again.';
      setPasswordError(msg);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleChangeEmail = async (e) => {
  e.preventDefault();
  setEmailChangeError('');
  setEmailChangeSuccess('');

  if (!newEmail || !emailChangePassword) {
    setEmailChangeError('Please fill in new email and your password.');
    return;
  }

  const trimmedEmail = newEmail.trim();
  if (!trimmedEmail.includes('@') || trimmedEmail.length < 5) {
    setEmailChangeError('Please enter a valid email address.');
    return;
  }

  setEmailChangeLoading(true);
  try {
    const res = await api.post('/users/change-email', {
      newEmail: trimmedEmail,
      currentPassword: emailChangePassword
    });

    setEmailChangeSuccess(
      res.data?.message ||
        'Verification link has been sent to your new email address.'
    );
    setNewEmail('');
    setEmailChangePassword('');
  } catch (err) {
    console.error(err);
    const msg =
      err?.response?.data?.message ||
      'Failed to request email change. Please try again.';
    setEmailChangeError(msg);
  } finally {
    setEmailChangeLoading(false);
  }
};

  const handleUnblockUser = async (targetUserId) => {
    if (!targetUserId) return;

    try {
      // panggil API unblock
      await api.delete(`/users/${targetUserId}/block`);

      // update state lokal
      setBlockedUsers((prev) =>
        prev.filter((u) => u.id !== targetUserId)
      );
    } catch (err) {
      console.error('Unblock user error', err);
      setBlockedError(
        err?.response?.data?.message || 'Failed to unblock user.'
      );
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="h-full w-full max-w-sm bg-gradient-to-b from-slate-900/95 via-slate-950 to-black border-l border-white/10 shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
              profile
            </p>
            <h2 className="text-sm font-semibold text-slate-100">
              {user?.username ? `@${user.username}` : 'Your profile'}
            </h2>
                        {user?.isAdmin && (
              <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full border border-amber-400/60 text-[10px] text-amber-200">
                Admin
              </span>
            )}

          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full h-8 w-8 flex items-center justify-center bg-white/5 hover:bg-white/10 text-slate-300 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <Avatar
              size={56}
              name={displayName || user?.username}
              src={avatarUrl}
            />
            <div className="text-[11px] text-slate-400 space-y-0.5">
              <p>Avatar uses a direct image URL.</p>
              <p>Paste any public PNG/JPEG/WebP link.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Display name
              </label>
              <TextInput
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How should people see you?"
                inputClassName="text-sm bg-black/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Bio / status
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Chillin, working, building H!BRUH…"
                className="w-full rounded-xl bg-black/60 border border-white/10 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-woy-accent/70"
              />
              <p className="mt-1 text-[10px] text-slate-500 text-right">
                {bio.length}/160
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Avatar URL
              </label>
              <TextInput
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="https://your-avatar-image.png"
                inputClassName="text-sm bg-black/60"
              />
            </div>

            {error && (
              <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="text-xs px-3"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                className="text-xs px-4"
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </form>
          {/* Change password */}
        <div className="border-t border-white/10 pt-5">
          <h3 className="text-xs font-semibold text-slate-200 mb-3">
            Change password
          </h3>

          {passwordError && (
            <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2 mb-3">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="text-[11px] text-emerald-300 bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2 mb-3">
              {passwordSuccess}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Current password
              </label>
              <TextInput
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                inputClassName="text-sm bg-black/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                New password
              </label>
              <TextInput
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                inputClassName="text-sm bg-black/60"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Confirm new password
              </label>
              <TextInput
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                inputClassName="text-sm bg-black/60"
              />
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                variant="primary"
                className="text-xs px-4"
                disabled={changingPassword}
              >
                {changingPassword ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </form>
        </div>
          {/* Change email */}
  <div className="border-t border-white/10 pt-5">
    <h3 className="text-xs font-semibold text-slate-200 mb-1">
      Change email
    </h3>
    <p className="text-[11px] text-slate-400 mb-3">
      We&apos;ll send a verification link to your new email address. Your
      current email will stay active until you complete verification.
    </p>

    {emailChangeError && (
      <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2 mb-3">
        {emailChangeError}
      </div>
    )}

    {emailChangeSuccess && (
      <div className="text-[11px] text-emerald-300 bg-emerald-900/20 border border-emerald-500/30 rounded-lg px-3 py-2 mb-3">
        {emailChangeSuccess}
      </div>
    )}

    <form onSubmit={handleChangeEmail} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          New email
        </label>
        <TextInput
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder={user?.email || 'you@example.com'}
          inputClassName="text-sm bg-black/60"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1">
          Current password
        </label>
        <TextInput
          type="password"
          value={emailChangePassword}
          onChange={(e) => setEmailChangePassword(e.target.value)}
          inputClassName="text-sm bg-black/60"
        />
      </div>

      <div className="flex justify-end pt-1">
        <Button
          type="submit"
          variant="primary"
          className="text-xs px-4"
          disabled={emailChangeLoading}
        >
          {emailChangeLoading ? 'Sending…' : 'Send verification link'}
        </Button>
      </div>
    </form>
  </div>
            {/* Privacy & safety */}
          <div className="border-t border-white/10 pt-5 mt-2">
            <h3 className="text-xs font-semibold text-slate-200 mb-1">
              Privacy &amp; safety
            </h3>
            <p className="text-[11px] text-slate-400 mb-3">
              Manage blocked users and see the reports you have submitted.
            </p>

            {/* Blocked users */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[11px] font-semibold text-slate-200">
                  Blocked users
                </h4>
                {blockedLoading && (
                  <span className="text-[10px] text-slate-500">
                    Loading…
                  </span>
                )}
              </div>

              {blockedError && (
                <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2 mb-2">
                  {blockedError}
                </div>
              )}

              {!blockedLoading &&
                !blockedError &&
                (!blockedUsers || blockedUsers.length === 0) && (
                  <p className="text-[11px] text-slate-500">
                    You have not blocked anyone.
                  </p>
                )}

              {blockedUsers && blockedUsers.length > 0 && (
                <ul className="space-y-2">
                  {blockedUsers.map((u) => (
                    <li
                      key={u.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-3 py-2 bg-black/40"
                    >
                      <div>
                        <div className="text-[12px] text-slate-100">
                          {u.displayName || u.username || 'Unknown'}
                        </div>
                        {u.username && (
                          <div className="text-[10px] text-slate-500">
                            @{u.username}
                          </div>
                        )}
                      </div>
                      <Button
                        type="button"
                        className="text-[10px] px-3 py-1"
                        onClick={() => handleUnblockUser(u.id)}
                      >
                        Unblock
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* My reports */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-[11px] font-semibold text-slate-200">
                  Your reports
                </h4>
                {myReportsLoading && (
                  <span className="text-[10px] text-slate-500">
                    Loading…
                  </span>
                )}
              </div>

              {myReportsError && (
                <div className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/40 rounded-lg px-3 py-2 mb-2">
                  {myReportsError}
                </div>
              )}

              {!myReportsLoading &&
                !myReportsError &&
                (!myReports || myReports.length === 0) && (
                  <p className="text-[11px] text-slate-500">
                    You have not submitted any reports yet.
                  </p>
                )}

              {myReports && myReports.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {myReports.slice(0, 10).map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-[11px]"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="uppercase tracking-wide text-[10px] text-slate-300">
                          {r.type === 'message' ? 'Message' : 'User'}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {r.status}
                        </span>
                      </div>
                      <div className="text-slate-100">
                        {r.reasonCode}
                        {r.reasonText ? ` — ${r.reasonText}` : ''}
                      </div>
                      {r.message && r.message.text && (
                        <div className="mt-1 text-slate-400 line-clamp-2">
                          “{r.message.text}”
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePanel;
