import { STATUS_META, PRIORITY_META } from '../features/tickets/constants.js';

export function StatusBadge({ status }) {
  const m = STATUS_META[status] || { label: status, cls: 'bg-slate-400' };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white ${m.cls}`}>
      {m.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority] || { label: priority, cls: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-bold ${m.cls}`}>
      {m.label}
    </span>
  );
}
