import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Shell from '../components/layout/Shell';
import TopBar from '../components/ui/TopBar';
import Button from '../components/ui/Button';
import Spinner from '../components/ui/Spinner';
import { api } from '../utils/api';

const ModerationPage = () => {
  const navigate = useNavigate();
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('open');
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');

  // cek apakah user admin (pakai /auth/me)
  useEffect(() => {
    let cancelled = false;
    setCheckingAccess(true);
    api
      .get('/auth/me')
      .then((res) => {
        if (cancelled) return;
        const me = res.data?.user;
        const admin = !!me?.isAdmin;
        setIsAdmin(admin);
        if (!admin) {
          setError('You are not allowed to access this page.');
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('check admin error', err);
        setError(
          err?.response?.data?.message || 'Failed to check permissions.'
        );
      })
      .finally(() => {
        if (!cancelled) setCheckingAccess(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // load reports jika admin
  useEffect(() => {
    if (!isAdmin) return;

    let cancelled = false;
    setLoading(true);
    setError('');

    const params =
      statusFilter && statusFilter !== 'all'
        ? { status: statusFilter }
        : undefined;

    api
      .get('/reports', { params })
      .then((res) => {
        if (cancelled) return;
        const items = res.data?.items || [];
        setReports(items);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('load reports error', err);
        setError(
          err?.response?.data?.message || 'Failed to load reports.'
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isAdmin, statusFilter]);

  const handleUpdateStatus = (id, status) => {
    if (!isAdmin || !id || !status) return;

    const note = window.prompt(
      'Optional note about this action (leave empty if not needed):',
      ''
    );

    setUpdatingId(id);
    api
      .patch(`/reports/${id}`, {
        status,
        resolutionNote: note || ''
      })
      .then((res) => {
        const updated = res.data?.report;
        if (!updated) return;
        setReports((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
      })
      .catch((err) => {
        console.error('update report status error', err);
        window.alert(
          err?.response?.data?.message || 'Failed to update report.'
        );
      })
      .finally(() => setUpdatingId(null));
  };

  const handleBackToChat = () => {
    navigate('/');
  };

  const renderStatusBadge = (status) => {
    const baseClass =
      'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] border';
    switch (status) {
      case 'open':
        return (
          <span className={`${baseClass} border-rose-500/60 text-rose-300`}>
            open
          </span>
        );
      case 'in_review':
        return (
          <span
            className={`${baseClass} border-amber-500/60 text-amber-300`}
          >
            in review
          </span>
        );
      case 'resolved':
        return (
          <span
            className={`${baseClass} border-emerald-500/60 text-emerald-300`}
          >
            resolved
          </span>
        );
      case 'dismissed':
        return (
          <span
            className={`${baseClass} border-slate-500/60 text-slate-300`}
          >
            dismissed
          </span>
        );
      default:
        return <span className={baseClass}>{status}</span>;
    }
  };

  return (
    <Shell>
      <div className="flex flex-col min-h-screen md:min-h-[520px]">
        <TopBar />

        <div className="px-4 py-2 border-b border-white/5 bg-black/40">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex items-baseline gap-2">
              <h1 className="text-sm font-semibold text-slate-100">
                Moderation
              </h1>
              <span className="text-[11px] text-slate-400">
                Review and manage abuse reports
              </span>
            </div>
            <Button
              type="button"
              className="text-xs px-3 py-1 self-start md:self-auto"
              onClick={handleBackToChat}
            >
              Back to chat
            </Button>
          </div>
        </div>

        <div className="flex-1 px-4 py-3 overflow-auto">
          {checkingAccess ? (
            <div className="flex items-center justify-center h-full">
              <Spinner />
            </div>
          ) : !isAdmin ? (
            <div className="text-center text-sm text-rose-300 mt-8">
              {error || 'You are not allowed to access this page.'}
            </div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3 text-[11px]">
                <span className="text-slate-300">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-full px-2 py-1 text-[11px] text-slate-100"
                >
                  <option value="open">Open</option>
                  <option value="in_review">In review</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                  <option value="all">All</option>
                </select>
              </div>

              {error && (
                <div className="mb-3 text-[11px] text-rose-300">
                  {error}
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Spinner />
                </div>
              ) : reports.length === 0 ? (
                <div className="text-[12px] text-slate-400">
                  No reports found for this filter.
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map((r) => {
                    const createdAt = r.createdAt
                      ? new Date(r.createdAt)
                      : null;
                    return (
                      <div
                        key={r.id}
                        className="border border-white/10 rounded-xl bg-black/40 px-3 py-2 text-[11px]"
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            {renderStatusBadge(r.status)}
                            <span className="uppercase tracking-wide text-slate-300">
                              {r.type === 'message'
                                ? 'MESSAGE'
                                : 'USER'}
                            </span>
                            {createdAt && (
                              <span className="text-slate-500">
                                ·{' '}
                                {createdAt.toLocaleString(undefined, {
                                  dateStyle: 'short',
                                  timeStyle: 'short'
                                })}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              className="text-[10px] px-2 py-0.5"
                              disabled={
                                updatingId === r.id ||
                                r.status === 'open'
                              }
                              onClick={() =>
                                handleUpdateStatus(r.id, 'open')
                              }
                            >
                              Mark open
                            </Button>
                            <Button
                              type="button"
                              className="text-[10px] px-2 py-0.5"
                              disabled={updatingId === r.id}
                              onClick={() =>
                                handleUpdateStatus(r.id, 'in_review')
                              }
                            >
                              In review
                            </Button>
                            <Button
                              type="button"
                              className="text-[10px] px-2 py-0.5"
                              disabled={updatingId === r.id}
                              onClick={() =>
                                handleUpdateStatus(r.id, 'resolved')
                              }
                            >
                              Resolve
                            </Button>
                            <Button
                              type="button"
                              className="text-[10px] px-2 py-0.5"
                              disabled={updatingId === r.id}
                              onClick={() =>
                                handleUpdateStatus(r.id, 'dismissed')
                              }
                            >
                              Dismiss
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
                          <div className="space-y-0.5">
                            <div className="text-slate-400">Reporter</div>
                            <div className="text-slate-100">
                              {r.reporter
                                ? r.reporter.displayName ||
                                  r.reporter.username
                                : '-'}
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <div className="text-slate-400">Target</div>
                            <div className="text-slate-100">
                              {r.type === 'user' && r.targetUser
                                ? r.targetUser.displayName ||
                                  r.targetUser.username
                                : r.message && r.message.sender
                                ? r.message.sender.displayName ||
                                  r.message.sender.username
                                : '-'}
                            </div>
                          </div>

                          <div className="space-y-0.5">
                            <div className="text-slate-400">Reason</div>
                            <div className="text-slate-100">
                              {r.reasonCode}{' '}
                              {r.reasonText
                                ? `— ${r.reasonText}`
                                : ''}
                            </div>
                          </div>
                        </div>

                        {r.message && (
                          <div className="mt-2 border-t border-white/10 pt-2">
                            <div className="text-slate-400 mb-0.5">
                              Reported message
                            </div>
                            <div className="text-slate-100 text-[11px] line-clamp-3">
                              {r.message.text || '(no text)'}
                            </div>
                          </div>
                        )}

                        {r.resolutionNote && (
                          <div className="mt-2 border-t border-white/10 pt-2">
                            <div className="text-slate-400 mb-0.5">
                              Resolution note
                            </div>
                            <div className="text-slate-100 text-[11px]">
                              {r.resolutionNote}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Shell>
  );
};

export default ModerationPage;
