import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Shell from '../components/layout/Shell';
import TextInput from '../components/ui/TextInput';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { api } from '../utils/api';

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!token) {
      setError(
        'Invalid or missing reset token. Please use the link from your email.'
      );
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token) return;

    setError('');
    setSuccess('');

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirm) {
      setError('Password confirmation does not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', {
        token,
        password
      });

      setSuccess(
        res.data?.message ||
          'Your password has been reset. You can now sign in.'
      );
      setPassword('');
      setConfirm('');

      // Setelah beberapa detik, kembali ke halaman sign in
      setTimeout(() => {
        navigate('/auth');
      }, 1500);
    } catch (err) {
      console.error('Reset password error', err);
      const msg =
        err?.response?.data?.message || 'Failed to reset password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="flex flex-col min-h-screen md:min-h-[520px]">
        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl px-6 py-6 shadow-xl">
              <h1 className="text-xl font-semibold text-slate-100 mb-1">
                Reset password
              </h1>
              <p className="text-xs text-slate-400 mb-4">
                Choose a new password for your account.
              </p>

              {error && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded-xl px-3 py-2 mb-2">
                  {error}
                </p>
              )}

              {success && (
                <p className="text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-500/30 rounded-xl px-3 py-2 mb-2">
                  {success}
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-3">
                <TextInput
                  label="New password"
                  type="password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <TextInput
                  label="Confirm new password"
                  type="password"
                  name="confirm"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />

                <Button
                  type="submit"
                  className="w-full mt-1"
                  disabled={loading || !token}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner size={16} />{' '}
                      <span className="text-xs">Resetting password...</span>
                    </span>
                  ) : (
                    'Reset password'
                  )}
                </Button>
              </form>

              <div className="mt-4 text-[11px] text-slate-500 text-center">
                <button
                  type="button"
                  className="text-woy-accent hover:underline"
                  onClick={() => navigate('/auth')}
                >
                  Back to sign in
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
};

export default ResetPasswordPage;
