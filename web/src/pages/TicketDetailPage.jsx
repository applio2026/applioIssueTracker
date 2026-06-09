import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '../components/AppLayout.jsx';
import { StatusBadge, PriorityBadge } from '../components/Badges.jsx';
import { useAuth } from '../features/auth/useAuth.js';
import {
  useTicket,
  useAssignees,
  useChangeStatus,
  useAssignTicket,
  useChangePriority,
  useAddComment,
  useUploadAttachment,
  useDeleteAttachment,
  downloadAttachment,
} from '../features/tickets/api.js';
import { STATUS_TRANSITIONS, STATUS_META, PRIORITIES } from '../features/tickets/constants.js';

const ACTIVITY_TEXT = {
  CREATED: () => 'created the ticket',
  STATUS_CHANGED: (a) => `changed status ${label(a.fromValue)} → ${label(a.toValue)}`,
  PRIORITY_CHANGED: (a) => `changed priority ${cap(a.fromValue)} → ${cap(a.toValue)}`,
  ASSIGNED: (a) => (a.toValue ? 'assigned the ticket' : 'unassigned the ticket'),
  COMMENTED: () => 'commented',
  REOPENED: () => 'reopened the ticket',
};
const label = (s) => STATUS_META[s]?.label || s || '—';
const cap = (s) => (s ? s[0] + s.slice(1).toLowerCase() : '—');
const fmt = (iso) => new Date(iso).toLocaleString();
const fmtSize = (b) => (!b ? '' : b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export default function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: ticket, isLoading } = useTicket(id);

  const isManager = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  const { data: assignees } = useAssignees(isManager);

  const changeStatus = useChangeStatus();
  const assignTicket = useAssignTicket();
  const changePriority = useChangePriority();
  const addComment = useAddComment();
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();

  const [comment, setComment] = useState('');
  const [err, setErr] = useState('');

  if (isLoading) return <AppLayout><div className="text-slate-400">Loading…</div></AppLayout>;
  if (!ticket) return <AppLayout><div className="text-slate-400">Ticket not found.</div></AppLayout>;

  const canMoveStatus = isManager || ticket.assignee?.id === user.id;
  const nextStatuses = STATUS_TRANSITIONS[ticket.status] || [];

  const run = (mutation, vars) => {
    setErr('');
    mutation.mutate(vars, { onError: (e) => setErr(e.response?.data?.error || 'Action failed') });
  };

  const submitComment = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    run(addComment, { id, body: comment });
    setComment('');
  };

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file) return;
    run(uploadAttachment, { id, file });
  };

  return (
    <AppLayout>
      <Link to="/tickets" className="text-sm text-brand hover:underline">← Back to tickets</Link>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-slate-500">{ticket.key}</span>
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
      </div>
      <h2 className="mb-4 mt-1 text-xl font-bold text-slate-800">{ticket.title}</h2>

      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* Main column */}
        <div>
          <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
            <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
          </div>

          {/* Attachments */}
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-700">Attachments</h3>
              <label className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100">
                {uploadAttachment.isPending ? 'Uploading…' : '📎 Add file'}
                <input type="file" className="hidden" onChange={onUpload} disabled={uploadAttachment.isPending} />
              </label>
            </div>
            {ticket.attachments?.length === 0 && <p className="text-sm text-slate-400">No attachments.</p>}
            <div className="space-y-1.5">
              {ticket.attachments?.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <button onClick={() => downloadAttachment(id, a)} className="truncate text-left text-sm font-medium text-brand hover:underline">
                    📄 {a.fileName}
                  </button>
                  <div className="flex items-center gap-3 pl-3">
                    <span className="shrink-0 text-[11px] text-slate-400">{fmtSize(a.size)}</span>
                    {(a.uploadedById === user.id || isManager) && (
                      <button onClick={() => run(deleteAttachment, { id, attId: a.id })} className="text-xs text-slate-400 hover:text-red-500">✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity */}
          <h3 className="mb-3 text-sm font-bold text-slate-700">Activity</h3>
          <div className="ml-2 border-l-2 border-slate-200 pl-5">
            {ticket.activities?.map((a) => (
              <div key={a.id} className="relative mb-4 text-sm">
                <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                <span className="font-semibold text-slate-700">{a.actor?.name}</span>{' '}
                <span className="text-slate-600">{ACTIVITY_TEXT[a.type]?.(a) || a.type}</span>
                <div className="text-[11px] text-slate-400">{fmt(a.createdAt)}</div>
              </div>
            ))}
          </div>

          {/* Comments */}
          <h3 className="mb-3 mt-5 text-sm font-bold text-slate-700">Comments</h3>
          {ticket.comments?.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
          <div className="space-y-3">
            {ticket.comments?.map((c) => (
              <div key={c.id} className="flex gap-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-light to-accent text-[10px] font-semibold text-white">
                  {c.author?.name?.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                </div>
                <div className="flex-1 rounded-lg bg-slate-100 px-3 py-2">
                  <div className="text-sm">
                    <span className="font-semibold text-slate-700">{c.author?.name}</span>
                    {c.isInternal && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">INTERNAL</span>}
                    <span className="ml-2 text-[11px] text-slate-400">{fmt(c.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{c.body}</p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={submitComment} className="mt-4">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Add a comment…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <div className="mt-2 flex justify-end">
              <button type="submit" disabled={addComment.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
                {addComment.isPending ? 'Posting…' : 'Comment'}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar */}
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4">
          {/* Status control */}
          {canMoveStatus && nextStatuses.length > 0 && (
            <div className="mb-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Move status to</div>
              <div className="flex flex-wrap gap-1.5">
                {nextStatuses.map((s) => (
                  <button key={s} onClick={() => run(changeStatus, { id, status: s })}
                    className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:border-brand hover:text-brand">
                    {STATUS_META[s].label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Assignment (managers) */}
          {isManager && (
            <div className="mb-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Assignee</div>
              <select
                value={ticket.assignee?.id || ''}
                onChange={(e) => run(assignTicket, { id, assigneeId: e.target.value || null })}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand"
              >
                <option value="">Unassigned</option>
                {assignees?.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role.toLowerCase()})</option>)}
              </select>
            </div>
          )}

          {/* Priority (managers) */}
          {isManager && (
            <div className="mb-4">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Priority</div>
              <select
                value={ticket.priority}
                onChange={(e) => run(changePriority, { id, priority: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand"
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          )}

          <dl className="text-sm">
            <Meta label="Assignee" value={ticket.assignee?.name || 'Unassigned'} />
            <Meta label="Requester" value={ticket.requester?.name} />
            <Meta label="Category" value={ticket.category?.name || '—'} />
            <Meta label="SLA Due" value={ticket.slaDueAt ? fmt(ticket.slaDueAt) : '—'} />
            <Meta label="Created" value={fmt(ticket.createdAt)} />
          </dl>
        </aside>
      </div>
    </AppLayout>
  );
}

function Meta({ label, value }) {
  return (
    <>
      <dt className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-700">{value}</dd>
    </>
  );
}
