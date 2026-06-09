import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { PriorityBadge } from '../components/Badges.jsx';
import { useTickets, useChangeStatus } from '../features/tickets/api.js';
import { STATUS_META, STATUS_TRANSITIONS } from '../features/tickets/constants.js';

// Columns shown on the board (main workflow; Rejected/Reopened live in the list view).
const COLUMNS = ['NEW', 'OPEN', 'IN_PROGRESS', 'ON_HOLD', 'IN_REVIEW', 'RESOLVED', 'CLOSED'];

function initials(name = '') {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function BoardPage() {
  const navigate = useNavigate();
  const { data: tickets, isLoading } = useTickets();
  const changeStatus = useChangeStatus();

  const [dragId, setDragId] = useState(null);
  const [dragFrom, setDragFrom] = useState(null);
  const [overCol, setOverCol] = useState(null);
  const [error, setError] = useState('');

  const byStatus = (status) => (tickets || []).filter((t) => t.status === status);

  const canDrop = (to) => dragFrom && (dragFrom === to || STATUS_TRANSITIONS[dragFrom]?.includes(to));

  const onDrop = (to) => {
    setOverCol(null);
    const id = dragId;
    const from = dragFrom;
    setDragId(null);
    setDragFrom(null);
    if (!id || from === to) return;
    if (!STATUS_TRANSITIONS[from]?.includes(to)) {
      setError(`Can't move ${STATUS_META[from].label} → ${STATUS_META[to].label}`);
      setTimeout(() => setError(''), 3000);
      return;
    }
    setError('');
    changeStatus.mutate(
      { id, status: to },
      { onError: (e) => setError(e.response?.data?.error || 'Move failed') },
    );
  };

  return (
    <AppLayout>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Board</h2>
          <p className="text-sm text-slate-400">Drag a card to change its status</p>
        </div>
        <button onClick={() => navigate('/tickets')} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
          List view
        </button>
      </div>

      {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
      {isLoading && <div className="text-slate-400">Loading…</div>}

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((status) => {
          const cards = byStatus(status);
          const highlight = overCol === status && canDrop(status);
          const blocked = overCol === status && !canDrop(status);
          return (
            <div
              key={status}
              onDragOver={(e) => { e.preventDefault(); setOverCol(status); }}
              onDragLeave={() => setOverCol((c) => (c === status ? null : c))}
              onDrop={() => onDrop(status)}
              className={`w-64 shrink-0 rounded-xl p-2.5 transition ${
                highlight ? 'bg-blue-100 ring-2 ring-brand' : blocked ? 'bg-red-50 ring-2 ring-red-300' : 'bg-slate-200/60'
              }`}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <span className={`h-2 w-2 rounded-full ${STATUS_META[status].cls}`} />
                  {STATUS_META[status].label}
                </span>
                <span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-600">{cards.length}</span>
              </div>

              <div className="min-h-[300px] space-y-2">
                {cards.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => { setDragId(t.id); setDragFrom(t.status); }}
                    onDragEnd={() => { setDragId(null); setDragFrom(null); setOverCol(null); }}
                    onClick={() => navigate(`/tickets/${t.id}`)}
                    className={`cursor-grab rounded-lg border-l-[3px] bg-white p-2.5 shadow-sm hover:shadow active:cursor-grabbing ${
                      dragId === t.id ? 'opacity-50' : ''
                    }`}
                    style={{ borderLeftColor: 'var(--tw-brand, #0052cc)' }}
                  >
                    <div className="font-mono text-[11px] font-semibold text-slate-400">{t.key}</div>
                    <div className="my-1 text-sm font-medium text-slate-700">{t.title}</div>
                    <div className="flex items-center justify-between">
                      <PriorityBadge priority={t.priority} />
                      {t.assignee ? (
                        <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-brand-light to-accent text-[10px] font-semibold text-white" title={t.assignee.name}>
                          {initials(t.assignee.name)}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-300">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AppLayout>
  );
}
