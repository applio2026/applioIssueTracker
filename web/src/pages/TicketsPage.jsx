import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { StatusBadge, PriorityBadge } from '../components/Badges.jsx';
import { useTickets, useCategories } from '../features/tickets/api.js';
import { useAuth } from '../features/auth/useAuth.js';
import { ALL_STATUSES, PRIORITIES, STATUS_META } from '../features/tickets/constants.js';
import NewTicketModal from '../features/tickets/NewTicketModal.jsx';

const selectCls =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand';

const VIEW_LABEL = { open: 'Open issues', resolved7d: 'Resolved (7d)', breached: 'SLA breached' };

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function TicketsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRaise = user.permissions?.canRaiseTickets;
  const [params] = useSearchParams();
  // Dashboard drill-downs land here with filters in the URL.
  const [filters, setFilters] = useState(() => ({
    status: params.get('status') || '',
    priority: params.get('priority') || '',
    categoryId: params.get('categoryId') || '',
    q: params.get('q') || '',
    view: params.get('view') || '',
    label: params.get('label') || '',
    from: params.get('from') || '',
    to: params.get('to') || '',
    assigneeId: params.get('assigneeId') || '',
  }));
  const assigneeName = params.get('assigneeName') || '';
  const [showNew, setShowNew] = useState(false);

  const { data: tickets, isLoading } = useTickets(filters);
  const { data: categories } = useCategories();

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const clear = (k) => () => setFilters((f) => ({ ...f, [k]: '' }));

  // Filters that came from a dashboard drill-down (no dedicated control here)
  // are shown as removable chips.
  const chips = [
    filters.view && { k: 'view', text: VIEW_LABEL[filters.view] || filters.view },
    filters.label && { k: 'label', text: `Label: ${filters.label}` },
    filters.from && { k: 'from', text: `From: ${filters.from}` },
    filters.to && { k: 'to', text: `To: ${filters.to}` },
    filters.assigneeId && { k: 'assigneeId', text: `Assignee: ${assigneeName || 'filtered'}` },
  ].filter(Boolean);

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Tickets</h2>
          <p className="text-sm text-slate-400">{tickets?.length ?? 0} ticket(s)</p>
        </div>
        {canRaise && (
          <button onClick={() => setShowNew(true)} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
            ➕ Raise a Ticket
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <input value={filters.q} onChange={set('q')} placeholder="🔍 Search title or key…" className={`${selectCls} min-w-[220px] flex-1`} />
        <select value={filters.status} onChange={set('status')} className={selectCls}>
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select value={filters.priority} onChange={set('priority')} className={selectCls}>
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
        </select>
        <select value={filters.categoryId} onChange={set('categoryId')} className={selectCls}>
          <option value="">All categories</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Drill-down filter chips */}
      {chips.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span key={c.k} className="flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
              {c.text}
              <button onClick={clear(c.k)} className="hover:text-red-500" title="Remove filter">✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Subject</th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assignee</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">Loading…</td></tr>}
            {!isLoading && tickets?.length === 0 && (
              <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">No tickets yet.</td></tr>
            )}
            {tickets?.map((t) => (
              <tr key={t.id} onClick={() => navigate(`/tickets/${t.id}`)} className="cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-500">{t.key}</td>
                <td className="px-4 py-3 font-medium text-slate-700">{t.title}</td>
                <td className="px-4 py-3">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{t.label}</span>
                </td>
                <td className="px-4 py-3 text-slate-500">{t.category?.name || '—'}</td>
                <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
                <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                <td className="px-4 py-3 text-slate-500">{t.assignee?.name || <span className="text-slate-300">Unassigned</span>}</td>
                <td className="px-4 py-3 text-slate-400">{timeAgo(t.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewTicketModal onClose={() => setShowNew(false)} onCreated={(t) => navigate(`/tickets/${t.id}`)} />}
    </AppLayout>
  );
}
