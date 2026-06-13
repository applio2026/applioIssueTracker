import { useState } from 'react';
import { Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { useDashboardStats, downloadTicketsCsv } from '../features/dashboard/api.js';
import { useCategories } from '../features/tickets/api.js';
import { STATUS_META, PRIORITIES } from '../features/tickets/constants.js';

const ROLE_LABEL = { DEVELOPER: 'Developer', ADMIN: 'Admin', SUPER_ADMIN: 'Super Admin' };

const EMPTY_FILTERS = { label: '', priority: '', categoryId: '', from: '', to: '', openOnly: '' };

const selectCls =
  'rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand';

export default function DashboardPage() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const { data, isLoading } = useDashboardStats(filters);
  const { data: categories } = useCategories();
  const [downloading, setDownloading] = useState(false);

  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));
  const hasFilters = Object.values(filters).some(Boolean);

  // Drill-down URL to the tickets list, carrying the active dashboard filters.
  const ticketsUrl = (extra = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({
      label: filters.label,
      priority: filters.priority,
      categoryId: filters.categoryId,
      from: filters.from,
      to: filters.to,
      ...extra,
    })) if (v) p.set(k, v);
    return `/tickets?${p.toString()}`;
  };

  const exportCsv = async () => {
    setDownloading(true);
    try {
      await downloadTicketsCsv(filters);
    } finally {
      setDownloading(false);
    }
  };

  if (isLoading) return <AppLayout><div className="text-slate-400">Loading…</div></AppLayout>;
  if (!data) return <AppLayout><div className="text-slate-400">No data.</div></AppLayout>;

  const { kpis, trend, byStatus, workload, labels } = data;
  const maxTrend = Math.max(1, ...trend.map((d) => d.count));
  const totalTickets = byStatus.reduce((s, x) => s + x.count, 0);

  return (
    <AppLayout>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">Dashboard</h2>
        <button onClick={exportCsv} disabled={downloading} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60">
          {downloading ? 'Exporting…' : '⬇ Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select value={filters.label} onChange={set('label')} className={selectCls}>
          <option value="">All labels</option>
          {labels?.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={filters.priority} onChange={set('priority')} className={selectCls}>
          <option value="">All severities</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
        </select>
        <select value={filters.categoryId} onChange={set('categoryId')} className={selectCls}>
          <option value="">All categories</option>
          {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          From
          <input type="date" value={filters.from} onChange={set('from')} className={selectCls} />
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-500">
          To
          <input type="date" value={filters.to} onChange={set('to')} className={selectCls} />
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={filters.openOnly === '1'}
            onChange={(e) => setFilters((f) => ({ ...f, openOnly: e.target.checked ? '1' : '' }))}
            className="accent-brand"
          />
          Open issues only
        </label>
        {hasFilters && (
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-sm font-medium text-brand hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {/* KPIs — click a number to open those tickets */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Open Tickets" value={kpis.open} to={ticketsUrl({ view: 'open' })} />
        <Kpi label="Resolved (7d)" value={kpis.resolved7d} to={ticketsUrl({ view: 'resolved7d' })} />
        <Kpi label="Avg. Resolution" value={`${kpis.avgResolutionHours}h`} />
        <Kpi label="SLA Breaches" value={kpis.slaBreaches} danger={kpis.slaBreaches > 0} to={ticketsUrl({ view: 'breached' })} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Trend bar chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 lg:col-span-2">
          <h3 className="mb-4 text-sm font-bold text-slate-700">Tickets created — last 7 days</h3>
          <div className="flex h-44 items-end gap-3">
            {trend.map((d) => (
              <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1">
                <span className="text-xs font-semibold text-slate-500">{d.count}</span>
                <div
                  className="w-full rounded-t-md bg-gradient-to-b from-brand-light to-brand"
                  style={{ height: `${(d.count / maxTrend) * 100}%`, minHeight: d.count ? '6px' : '2px' }}
                  title={`${d.date}: ${d.count}`}
                />
                <span className="text-[11px] text-slate-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status donut */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-4 text-sm font-bold text-slate-700">By status</h3>
          <StatusDonut byStatus={byStatus} total={totalTickets} linkFor={(s) => ticketsUrl({ status: s })} />
        </div>
      </div>

      {/* Workload table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="px-4 py-3 text-sm font-bold text-slate-700">Developer workload</div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Dept</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Resolved (7d)</th>
              <th className="px-4 py-3">SLA breaches</th>
            </tr>
          </thead>
          <tbody>
            {workload.map((w) => (
              <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">{w.name}</td>
                <td className="px-4 py-3 text-slate-500">{ROLE_LABEL[w.role] || w.role}</td>
                <td className="px-4 py-3 text-slate-500">{w.department || '—'}</td>
                <td className="px-4 py-3">
                  <Link to={ticketsUrl({ view: 'open', assigneeId: w.id, assigneeName: w.name })} className="text-slate-700 hover:text-brand hover:underline">{w.active}</Link>
                </td>
                <td className="px-4 py-3">
                  <Link to={ticketsUrl({ view: 'resolved7d', assigneeId: w.id, assigneeName: w.name })} className="text-slate-700 hover:text-brand hover:underline">{w.resolved7d}</Link>
                </td>
                <td className="px-4 py-3">
                  <Link to={ticketsUrl({ view: 'breached', assigneeId: w.id, assigneeName: w.name })} className={`font-semibold hover:underline ${w.breaches > 0 ? 'text-red-600' : 'text-slate-400 hover:text-brand'}`}>{w.breaches}</Link>
                </td>
              </tr>
            ))}
            {workload.length === 0 && (
              <tr><td colSpan="6" className="px-4 py-6 text-center text-slate-400">No staff yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </AppLayout>
  );
}

function Kpi({ label, value, danger, to }) {
  const body = (
    <>
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`mt-1 text-3xl font-extrabold ${danger ? 'text-red-600' : 'text-slate-800'}`}>{value}</div>
    </>
  );
  if (to) {
    return (
      <Link to={to} title="View these tickets" className="block rounded-xl border border-slate-200 bg-white p-4 transition hover:border-brand hover:shadow-sm">
        {body}
      </Link>
    );
  }
  return <div className="rounded-xl border border-slate-200 bg-white p-4">{body}</div>;
}

// SVG donut built from the status breakdown (no chart library needed).
function StatusDonut({ byStatus, total, linkFor }) {
  const tailwindToHex = {
    'bg-slate-500': '#64748b', 'bg-blue-600': '#2563eb', 'bg-amber-500': '#f59e0b',
    'bg-violet-500': '#8b5cf6', 'bg-cyan-500': '#06b6d4', 'bg-emerald-500': '#10b981',
    'bg-slate-600': '#475569', 'bg-red-600': '#dc2626', 'bg-orange-500': '#f97316',
  };
  const data = byStatus.filter((s) => s.count > 0);
  if (total === 0) return <p className="text-sm text-slate-400">No tickets yet.</p>;

  const R = 60, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-4">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <g transform="translate(70,70) rotate(-90)">
          {data.map((s) => {
            const frac = s.count / total;
            const dash = frac * C;
            const seg = (
              <circle
                key={s.status}
                r={R} cx="0" cy="0" fill="none"
                stroke={tailwindToHex[STATUS_META[s.status]?.cls] || '#cbd5e1'}
                strokeWidth="18"
                strokeDasharray={`${dash} ${C - dash}`}
                strokeDashoffset={-offset}
              />
            );
            offset += dash;
            return seg;
          })}
        </g>
        <text x="70" y="76" textAnchor="middle" className="fill-slate-800" fontSize="22" fontWeight="800">{total}</text>
      </svg>
      <div className="space-y-1 text-xs">
        {data.map((s) => (
          <Link
            key={s.status}
            to={linkFor(s.status)}
            title="View these tickets"
            className="flex items-center gap-2 text-slate-500 hover:text-brand hover:underline"
          >
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: tailwindToHex[STATUS_META[s.status]?.cls] || '#cbd5e1' }} />
            {STATUS_META[s.status]?.label || s.status} · {s.count}
          </Link>
        ))}
      </div>
    </div>
  );
}
