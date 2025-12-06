import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Shell from '../components/layout/Shell';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { api } from '../utils/api';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [status, setStatus] = useState('idle'); // idle | submitting | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage(
        'Invalid or missing verification token. Please use the link from your email.'
      );
      return;
    }

    const verify = async () => {
      setStatus('submitting');
      try {
        const res = await api.post('/auth/verify-email', { token });
        setStatus('success');
        setMessage(
          res.data?.message ||
            'Email verified successfully. You can now sign in.'
        );
      } catch (err) {
        console.error('verify email error', err);
        const msg =
          err?.response?.data?.message ||
          'Failed to verify email. The link may have expired.';
        setStatus('error');
        setMessage(msg);
      }
    };

    verify();
  }, [token]);

  const handleGoToAuth = () => {
    navigate('/auth');
  };

  const handleGoToApp = () => {
    navigate('/app');
  };

  return (
    <Shell>
      <div className="flex flex-col min-h-screen md:min-h-[520px]">
        <div className="flex flex-1 items-center justify-center px-4 py-8">
          <div className="w-full max-w-md">
            <div className="bg-slate-900/80 border border-white/10 rounded-2xl px-6 py-6 shadow-xl">
              <h1 className="text-xl font-semibold text-slate-100 mb-1">
                Verify your email
              </h1>
              <p className="text-xs text-slate-400 mb-4">
                We&apos;re confirming your email address for your H!BRUH account.
              </p>

              {status === 'submitting' && (
                <div className="flex items-center gap-2 text-xs text-slate-200 bg-slate-800/60 rounded-xl px-3 py-2">
                  <Spinner size={16} />
                  <span>Verifying your email...</span>
                </div>
              )}

              {status !== 'submitting' && message && (
                <div
                  className={`text-xs rounded-xl px-3 py-2 mb-4 ${
                    status === 'success'
                      ? 'text-emerald-300 bg-emerald-900/20 border border-emerald-500/30'
                      : 'text-rose-300 bg-rose-900/20 border border-rose-500/30'
                  }`}
                >
                  {message}
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-xs px-3"
                  onClick={handleGoToAuth}
                >
                  Go to sign in
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  className="text-xs px-3"
                  onClick={handleGoToApp}
                >
                  Go to app
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Shell>
  );
};

export default VerifyEmailPage;
