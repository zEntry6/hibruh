import { useState } from 'react';
import { useNavigate } from 'react-router-dom'; 
import Shell from '../components/layout/Shell';
import TextInput from '../components/ui/TextInput';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';

const AuthPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();  
const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
const [form, setForm] = useState({
  emailOrUsername: '',
  password: '',
  email: '',
  username: '',
  displayName: ''
});
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [info, setInfo] = useState('');

  const handleChange = (e) => {
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  };

const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setInfo('');
  setLoading(true);
  try {
    if (mode === 'login') {
      const { emailOrUsername, password } = form;
      const res = await api.post('/auth/login', {
        emailOrUsername,
        password
      });
      login(res.data);
    } else if (mode === 'register') {
      const { email, username, displayName, password } = form;
      const res = await api.post('/auth/register', {
        email,
        username,
        displayName,
        password
      });
      login(res.data);
    } else if (mode === 'forgot') {
      const { emailOrUsername } = form;
      if (!emailOrUsername.trim()) {
        setError('Please enter your email or username.');
        return;
      }

      const res = await api.post('/auth/forgot-password', {
        emailOrUsername
      });

      // Pesan sukses generik dari backend
      setInfo(
        res.data?.message ||
          'If an account with that email/username exists, a reset link has been sent.'
      );
    }
  } catch (err) {
    console.error('Auth error', err);
    const msg =
      err?.response?.data?.message ||
      'Authentication failed. Please try again.';
    setError(msg);
  } finally {
    setLoading(false);
  }
};
  
  return (
    <Shell>
      <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] min-h-[520px]">
        {/* Left: hero copy */}
        <div className="hidden md:flex flex-col justify-between border-r border-white/5 bg-gradient-to-br from-woy-soft/90 to-black/90 px-8 py-7 animate-fade-up">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-emerald-300/80 mb-3">
              Quiet by design
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-slate-100 mb-3">
              H!BRUH keeps your conversations{' '}
              <span className="text-woy-accent">close</span>, not loud.
            </h1>
            <p className="text-sm text-slate-400 max-w-md">
              A focused, real-time chat interface for the people you actually
              care to talk to. No feeds. No algorithms. Just direct messages.
            </p>
          </div>
          <div className="text-[11px] text-slate-500">
            <p>Built for late-night debugging and early-morning ideas.</p>
          </div>
        </div>

        {/* Right: form */}
        <div className="flex flex-col justify-center px-6 py-8 md:px-8 bg-black/40">
          <div className="max-w-sm w-full mx-auto">
            <div className="mb-6">
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500 mb-2">
                {mode === 'login' ? 'Welcome back' : 'Create account'}
              </p>
              <h2 className="text-xl font-semibold text-slate-100 mb-1">
                {mode === 'login' ? 'Sign in to H!BRUH' : 'Join H!BRUH'}
              </h2>
              <p className="text-xs text-slate-500">
                {mode === 'login'
                  ? 'Use your email or username to get back in.'
                  : 'We just need a couple of details to start.'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
            {mode === 'login' && (
              <>
                <TextInput
                  label="Email or username"
                  name="emailOrUsername"
                  value={form.emailOrUsername}
                  onChange={handleChange}
                  placeholder="you@example.com or username"
                />
                <TextInput
                  label="Password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                />
              </>
            )}

            {mode === 'register' && (
              <>
                <TextInput
                  label="Email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="you@example.com"
                />
                <TextInput
                  label="Username"
                  name="username"
                  value={form.username}
                  onChange={handleChange}
                  placeholder="username"
                  helper="Lowercase, no spaces. This is how others find you."
                />
                <TextInput
                  label="Display name"
                  name="displayName"
                  value={form.displayName}
                  onChange={handleChange}
                  placeholder="Display Name"
                />
                <TextInput
                  label="Password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                />
              </>
            )}

            {mode === 'forgot' && (
              <>
                <TextInput
                  label="Email or username"
                  name="emailOrUsername"
                  value={form.emailOrUsername}
                  onChange={handleChange}
                  placeholder="you@example.com or username"
                />
                <p className="mt-2 text-[11px] text-slate-500">
                  We’ll send a reset link if we find a matching account.
                </p>
              </>
            )}

            {mode === 'login' && (
              <div className="flex justify-end mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('forgot');
                    setError('');
                    setInfo('');
                  }}
                  className="text-[11px] text-slate-400 hover:text-slate-200 hover:underline"
                >
                  Forgot your password?
                </button>
              </div>
            )}

              {error && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/30 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              {info && (
                <p className="text-xs text-emerald-300 bg-emerald-900/20 border border-emerald-500/30 rounded-xl px-3 py-2 mt-1">
                  {info}
                </p>
              )}

              <Button
                type="submit"
                className="w-full mt-1"
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner size={16} />{' '}
                    <span className="text-xs">
                      {mode === 'login'
                        ? 'Signing in...'
                        : mode === 'register'
                        ? 'Creating account...'
                        : 'Sending reset link...'}
                    </span>
                  </span>
                ) : mode === 'login' ? (
                  'Sign in'
                ) : mode === 'register' ? (
                  'Create account'
                ) : (
                  'Send reset link'
                )}
              </Button>
            </form>

            <div className="mt-4 text-[11px] text-slate-500">
              {mode === 'login' && (
                <p>
                  No account yet?{' '}
                  <button
                    type="button"
                    className="text-woy-accent hover:underline"
                    onClick={() => {
                      setMode('register');
                      setError('');
                      setInfo('');
                    }}
                  >
                    Create one
                  </button>
                </p>
              )}

              {mode === 'register' && (
                <p>
                  Already here?{' '}
                  <button
                    type="button"
                    className="text-woy-accent hover:underline"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setInfo('');
                    }}
                  >
                    Sign in instead
                  </button>
                </p>
              )}

              {mode === 'forgot' && (
                <p>
                  Remember your password?{' '}
                  <button
                    type="button"
                    className="text-woy-accent hover:underline"
                    onClick={() => {
                      setMode('login');
                      setError('');
                      setInfo('');
                    }}
                  >
                    Back to sign in
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
};

export default AuthPage;
