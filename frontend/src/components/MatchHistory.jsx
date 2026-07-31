import { useEffect, useState } from 'react';
import API from '../api/axios.js';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';

const formatMs = (ms) => {
  if (!ms || ms < 0) return '—';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
};

export default function MatchHistory() {
  const navigate = useNavigate();
  const [history, setHistory] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const res = await API.get(`/history?page=${page}&limit=20`);
        if (cancelled) return;
        setHistory(res.data.history || []);
        setPagination(res.data.pagination || null);
      } catch (err) {
        if (!cancelled) console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [page]);

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans p-6 md:p-12 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:32px:32px] opacity-40" />

      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 text-slate-500 hover:text-black font-bold mb-10 transition-colors group"
        >
          <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>

        <h2 className="text-4xl md:text-5xl font-black tracking-tighter italic mb-2">
          Match History
        </h2>
        <p className="text-slate-500 font-medium mb-10">
          Every solo puzzle you attempted, newest first.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-emerald-500" size={32} />
          </div>
        )}

        {!loading && history.length === 0 && (
          <div className="bg-slate-50 border border-slate-100 p-10 rounded-[2.5rem] text-center text-slate-400 font-bold">
            No puzzles yet — play your first one!
          </div>
        )}

        <div className="space-y-3">
          {history.map((s) => (
            <div
              key={s.id}
              className={`flex items-center justify-between p-5 rounded-2xl border ${
                s.status === 'solved'
                  ? 'border-emerald-100 bg-emerald-50/40'
                  : 'border-red-100 bg-red-50/30'
              }`}
            >
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-slate-400">
                  {s.tier || 'unknown'}
                </span>
                <p className="text-sm font-bold text-slate-700">
                  {s.wrong_moves} wrong {s.wrong_moves === 1 ? 'move' : 'moves'}
                </p>
              </div>
              <div className="text-right">
                <div className="font-mono font-bold text-slate-700">
                  {formatMs(s.solve_time_ms)}
                </div>
                {s.reward_amount > 0 && (
                  <div className="text-xs font-black text-emerald-600">
                    +{Number(s.reward_amount).toFixed(6)} SOL
                  </div>
                )}
                {s.reward_amount == null && s.status === 'solved' && (
                  <div className="text-xs font-bold text-slate-400">no reward</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <div className="flex justify-between items-center pt-8">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-sm font-bold text-slate-400 disabled:opacity-30"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-slate-500">
              {page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="text-sm font-bold text-slate-400 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
