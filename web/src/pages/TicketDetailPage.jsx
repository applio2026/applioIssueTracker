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
  useAddSubTask,
  useUpdateSubTask,
  useDeleteSubTask,
  useLogTime,
  useDeleteTimeLog,
  useWatchTicket,
  useAddLink,
  useDeleteLink,
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
const fmtMin = (m) => (!m ? '0m' : `${m >= 60 ? `${Math.floor(m / 60)}h ` : ''}${m % 60 ? `${m % 60}m` : ''}`.trim());
const initials = (name) => name?.split(' ').map((p) => p[0]).slice(0, 2).join('') || '?';

const SUBTASK_STATUSES = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
];

const inputCls =
  'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand';
const btnCls =
  'rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60';
const barBtnCls =
  'flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand';

// Card section with a plain header (no collapsing — keeps the page tidy).
function Section({ title, extra, children }) {
  return (
    <div className="mb-4 rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700">{title}</h3>
        {extra}
      </div>
      {children}
    </div>
  );
}

function Field({ name, children }) {
  return (
    <div className="flex items-start gap-3 py-0.5">
      <span className="w-28 shrink-0 text-xs font-medium text-slate-400">{name}</span>
      <span className="min-w-0 text-sm text-slate-700">{children}</span>
    </div>
  );
}

function Meta({ label: l, value }) {
  return (
    <>
      <dt className="mt-3 text-[11px] uppercase tracking-wide text-slate-400">{l}</dt>
      <dd className="mt-0.5 text-sm text-slate-700">{value}</dd>
    </>
  );
}

function Modal({ title, onClose, error, children }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-lg text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        {children}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-4 py-2.5 text-sm font-semibold ${active ? 'text-brand' : 'text-slate-500 hover:text-slate-700'}`}
    >
      {children}
      {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded bg-brand" />}
    </button>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const { data: ticket, isLoading } = useTicket(id);

  const isManager = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  const { data: assignees } = useAssignees();

  const changeStatus = useChangeStatus();
  const assignTicket = useAssignTicket();
  const changePriority = useChangePriority();
  const addComment = useAddComment();
  const addSubTask = useAddSubTask();
  const updateSubTask = useUpdateSubTask();
  const deleteSubTask = useDeleteSubTask();
  const logTime = useLogTime();
  const deleteTimeLog = useDeleteTimeLog();
  const watchTicket = useWatchTicket();
  const addLink = useAddLink();
  const deleteLink = useDeleteLink();
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();

  const [comment, setComment] = useState('');
  const [subTask, setSubTask] = useState({ title: '', assigneeId: '' });
  const [time, setTime] = useState({ hours: '', minutes: '', note: '' });
  const [linkKey, setLinkKey] = useState('');
  const [statusMenu, setStatusMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [modal, setModal] = useState(null); // 'subtasks' | 'links' | 'time'
  const [tab, setTab] = useState('comments'); // 'comments' | 'activity'
  const [err, setErr] = useState('');

  if (isLoading) return <AppLayout><div className="text-slate-400">Loading…</div></AppLayout>;
  if (!ticket) return <AppLayout><div className="text-slate-400">Ticket not found.</div></AppLayout>;

  const canMoveStatus = isManager || ticket.assignee?.id === user.id;
  const nextStatuses = STATUS_TRANSITIONS[ticket.status] || [];
  const isDone = ['RESOLVED', 'CLOSED'].includes(ticket.status);

  const amWatching = ticket.watchers?.some((w) => w.userId === user.id);
  const links = [
    ...(ticket.linksFrom || []).map((l) => ({ id: l.id, other: l.to })),
    ...(ticket.linksTo || []).map((l) => ({ id: l.id, other: l.from })),
  ];

  const subTaskAssignees = [
    { id: user.id, name: `${user.name} (me)` },
    ...(assignees || []).filter((a) => a.id !== user.id),
  ];
  const doneCount = ticket.subTasks?.filter((s) => s.status === 'DONE').length || 0;
  const subTotal = ticket.subTasks?.length || 0;

  const totalMinutes = ticket.timeLogs?.reduce((sum, l) => sum + l.minutes, 0) || 0;
  const timeByUser = Object.entries(
    (ticket.timeLogs || []).reduce((acc, l) => {
      const name = l.user?.name || 'Unknown';
      acc[name] = (acc[name] || 0) + l.minutes;
      return acc;
    }, {}),
  );

  const run = (mutation, vars) => {
    setErr('');
    mutation.mutate(vars, { onError: (e) => setErr(e.response?.data?.error || 'Action failed') });
  };
  const openModal = (name) => { setErr(''); setMoreMenu(false); setModal(name); };
  const closeModal = () => { setErr(''); setModal(null); };

  const submitComment = (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    run(addComment, { id, body: comment });
    setComment('');
  };
  const submitSubTask = (e) => {
    e.preventDefault();
    if (!subTask.title.trim()) return;
    run(addSubTask, { id, title: subTask.title.trim(), assigneeId: subTask.assigneeId || null });
    setSubTask({ title: '', assigneeId: '' });
  };
  const submitTime = (e) => {
    e.preventDefault();
    const minutes = (Number(time.hours) || 0) * 60 + (Number(time.minutes) || 0);
    if (minutes < 1) {
      setErr('Enter the time you spent (hours and/or minutes).');
      return;
    }
    run(logTime, { id, minutes, note: time.note.trim() });
    setTime({ hours: '', minutes: '', note: '' });
  };
  const submitLink = (e) => {
    e.preventDefault();
    if (!linkKey.trim()) return;
    run(addLink, { id, key: linkKey.trim() });
    setLinkKey('');
  };
  const onUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    run(uploadAttachment, { id, file });
  };

  return (
    <AppLayout>
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-slate-400">
        <Link to="/tickets" className="hover:text-brand hover:underline">Tickets</Link>
        <span>/</span>
        <span className="font-mono font-semibold text-slate-500">{ticket.key}</span>
      </div>
      <h2 className="mb-3 mt-1 text-2xl font-bold text-slate-800">{ticket.title}</h2>

      {/* Action bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {canMoveStatus && nextStatuses.length > 0 && (
          <div className="relative">
            <button onClick={() => setStatusMenu((o) => !o)} className={barBtnCls}>
              {STATUS_META[ticket.status]?.label} <span className="text-[9px]">▾</span>
            </button>
            {statusMenu && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" onClick={() => setStatusMenu(false)} aria-hidden />
                <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {nextStatuses.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setStatusMenu(false); run(changeStatus, { id, status: s }); }}
                      className="block w-full px-3 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                    >
                      {STATUS_META[s].label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <button
          onClick={() => run(watchTicket, { id, watching: amWatching })}
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
            amWatching ? 'border-brand bg-brand/5 text-brand' : 'border-slate-200 bg-white text-slate-600 hover:border-brand hover:text-brand'
          }`}
        >
          👁 {amWatching ? 'Watching' : 'Watch'}
        </button>

        <button onClick={() => openModal('time')} className={barBtnCls}>🕐 Log time</button>

        {/* More menu → sub-tasks / issue links */}
        <div className="relative">
          <button onClick={() => setMoreMenu((o) => !o)} className={barBtnCls}>
            More <span className="text-[9px]">▾</span>
          </button>
          {moreMenu && (
            <>
              <button className="fixed inset-0 z-10 cursor-default" onClick={() => setMoreMenu(false)} aria-hidden />
              <div className="absolute left-0 top-full z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button onClick={() => openModal('subtasks')} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50">
                  <span>✔️ Sub-tasks</span>
                  <span className="text-xs text-slate-400">{subTotal ? `${doneCount}/${subTotal}` : '—'}</span>
                </button>
                <button onClick={() => openModal('links')} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50">
                  <span>🔗 Issue Links</span>
                  <span className="text-xs text-slate-400">{links.length || '—'}</span>
                </button>
              </div>
            </>
          )}
        </div>

        <span className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
      </div>

      {err && !modal && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        {/* Main column */}
        <div>
          {/* Details */}
          <Section title="Details">
            <div className="grid gap-x-10 sm:grid-cols-2">
              <div>
                <Field name="Type">Service Request</Field>
                <Field name="Category">{ticket.category?.name || 'None'}</Field>
                <Field name="Label">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{ticket.label}</span>
                </Field>
                <Field name="Priority"><PriorityBadge priority={ticket.priority} /></Field>
              </div>
              <div>
                <Field name="Status"><StatusBadge status={ticket.status} /></Field>
                <Field name="Resolution">{isDone ? 'Done' : 'Unresolved'}</Field>
                <Field name="SLA Due">{ticket.slaDueAt ? fmt(ticket.slaDueAt) : '—'}</Field>
              </div>
            </div>
          </Section>

          {/* Description */}
          <Section title="Description">
            <p className="whitespace-pre-wrap text-sm text-slate-700">{ticket.description}</p>
          </Section>

          {/* Attachments */}
          <Section
            title="Attachments"
            extra={
              <label className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100">
                {uploadAttachment.isPending ? 'Uploading…' : '📎 Add file'}
                <input type="file" className="hidden" onChange={onUpload} disabled={uploadAttachment.isPending} />
              </label>
            }
          >
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
          </Section>

          {/* Comments / Activity tabs */}
          <div className="rounded-xl border border-slate-200 bg-white">
            <div className="flex gap-1 border-b border-slate-200 px-2">
              <TabButton active={tab === 'comments'} onClick={() => setTab('comments')}>
                Comments{ticket.comments?.length ? ` (${ticket.comments.length})` : ''}
              </TabButton>
              <TabButton active={tab === 'activity'} onClick={() => setTab('activity')}>Activity</TabButton>
            </div>

            <div className="p-4">
              {tab === 'comments' ? (
                <>
                  {ticket.comments?.length === 0 && <p className="text-sm text-slate-400">No comments yet.</p>}
                  <div className="space-y-3">
                    {ticket.comments?.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-light to-accent text-[10px] font-semibold text-white">
                          {initials(c.author?.name)}
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
                      <button type="submit" disabled={addComment.isPending} className={btnCls}>
                        {addComment.isPending ? 'Posting…' : 'Comment'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="ml-2 border-l-2 border-slate-200 pl-5">
                  {ticket.activities?.length === 0 && <p className="-ml-6 text-sm text-slate-400">No activity yet.</p>}
                  {ticket.activities?.map((a) => (
                    <div key={a.id} className="relative mb-4 text-sm">
                      <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                      <span className="font-semibold text-slate-700">{a.actor?.name}</span>{' '}
                      <span className="text-slate-600">{ACTIVITY_TEXT[a.type]?.(a) || a.type}</span>
                      <div className="text-[11px] text-slate-400">{fmt(a.createdAt)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-400">People</h4>
          <dl className="text-sm">
            <Meta
              label="Assignee"
              value={
                isManager ? (
                  <select
                    value={ticket.assignee?.id || ''}
                    onChange={(e) => run(assignTicket, { id, assigneeId: e.target.value || null })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand"
                  >
                    <option value="">Unassigned</option>
                    {assignees?.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role.toLowerCase()})</option>)}
                  </select>
                ) : (
                  ticket.assignee?.name || 'Unassigned'
                )
              }
            />
            <Meta label="Reporter" value={ticket.requester?.name} />
            <Meta
              label="Watchers"
              value={
                <span className="flex items-center gap-2">
                  <span>{ticket.watchers?.length || 0}</span>
                  <button onClick={() => run(watchTicket, { id, watching: amWatching })} className="text-xs text-brand hover:underline">
                    {amWatching ? 'Stop watching this issue' : 'Start watching this issue'}
                  </button>
                </span>
              }
            />
          </dl>

          <h4 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">Dates</h4>
          <dl className="text-sm">
            <Meta label="Created" value={fmt(ticket.createdAt)} />
            <Meta label="Updated" value={fmt(ticket.updatedAt)} />
            <Meta label="SLA Due" value={ticket.slaDueAt ? fmt(ticket.slaDueAt) : '—'} />
          </dl>

          <h4 className="mt-5 text-xs font-bold uppercase tracking-wide text-slate-400">More</h4>
          <dl className="text-sm">
            {isManager && (
              <Meta
                label="Priority"
                value={
                  <select
                    value={ticket.priority}
                    onChange={(e) => run(changePriority, { id, priority: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-brand"
                  >
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
                  </select>
                }
              />
            )}
            <Meta label="Category" value={ticket.category?.name || '—'} />
            <Meta label="Label" value={ticket.label} />
            <Meta
              label="Sub-tasks"
              value={
                <button onClick={() => openModal('subtasks')} className="text-brand hover:underline">
                  {subTotal ? `${doneCount}/${subTotal} done` : 'Add'}
                </button>
              }
            />
            <Meta
              label="Issue links"
              value={
                <button onClick={() => openModal('links')} className="text-brand hover:underline">
                  {links.length || 'Add'}
                </button>
              }
            />
            <Meta
              label="Time logged"
              value={
                <button onClick={() => openModal('time')} className="text-brand hover:underline">
                  {fmtMin(totalMinutes)}
                </button>
              }
            />
          </dl>
        </aside>
      </div>

      {/* ---------- Sub-tasks modal ---------- */}
      {modal === 'subtasks' && (
        <Modal title={`Sub-tasks${subTotal ? ` · ${doneCount}/${subTotal} done` : ''}`} onClose={closeModal} error={err}>
          {subTotal > 0 && (
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(doneCount / subTotal) * 100}%` }} />
            </div>
          )}
          {subTotal === 0 && <p className="mb-3 text-sm text-slate-400">No sub-tasks yet.</p>}
          <div className="space-y-1.5">
            {ticket.subTasks?.map((s) => {
              const canEdit = isManager || s.createdBy?.id === user.id || s.assignee?.id === user.id;
              return (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <select
                    value={s.status}
                    disabled={!canEdit}
                    onChange={(e) => run(updateSubTask, { id, subId: s.id, status: e.target.value })}
                    className="rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-600 outline-none focus:border-brand disabled:bg-slate-50"
                  >
                    {SUBTASK_STATUSES.map((st) => <option key={st.value} value={st.value}>{st.label}</option>)}
                  </select>
                  <span className={`min-w-0 flex-1 truncate text-sm ${s.status === 'DONE' ? 'text-slate-400 line-through' : 'text-slate-700'}`}>
                    {s.title}
                  </span>
                  <select
                    value={s.assignee?.id || ''}
                    disabled={!canEdit}
                    onChange={(e) => run(updateSubTask, { id, subId: s.id, assigneeId: e.target.value || null })}
                    className="max-w-[130px] rounded-md border border-slate-200 px-1.5 py-1 text-xs text-slate-600 outline-none focus:border-brand disabled:bg-slate-50"
                  >
                    <option value="">Unassigned</option>
                    {subTaskAssignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  {(isManager || s.createdBy?.id === user.id) && (
                    <button onClick={() => run(deleteSubTask, { id, subId: s.id })} className="text-xs text-slate-400 hover:text-red-500">✕</button>
                  )}
                </div>
              );
            })}
          </div>
          <form onSubmit={submitSubTask} className="mt-3 border-t border-slate-100 pt-3">
            <input
              value={subTask.title}
              onChange={(e) => setSubTask((f) => ({ ...f, title: e.target.value }))}
              placeholder="Sub-task title…"
              className={`${inputCls} mb-2 w-full`}
            />
            <div className="flex gap-2">
              <select
                value={subTask.assigneeId}
                onChange={(e) => setSubTask((f) => ({ ...f, assigneeId: e.target.value }))}
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2 py-2 text-sm text-slate-600 outline-none focus:border-brand"
              >
                <option value="">Unassigned</option>
                {subTaskAssignees.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <button type="submit" disabled={addSubTask.isPending} className={btnCls}>Add sub-task</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ---------- Issue links modal ---------- */}
      {modal === 'links' && (
        <Modal title="Issue Links" onClose={closeModal} error={err}>
          {links.length === 0 && <p className="mb-3 text-sm text-slate-400">No linked tickets.</p>}
          <div className="space-y-1.5">
            {links.map((l) => (
              <div key={l.id} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <span className="shrink-0 text-xs text-slate-400">relates to</span>
                <Link to={`/tickets/${l.other.id}`} className="shrink-0 font-mono text-xs font-semibold text-brand hover:underline">
                  {l.other.key}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-700">{l.other.title}</span>
                <StatusBadge status={l.other.status} />
                <button onClick={() => run(deleteLink, { id, linkId: l.id })} className="text-xs text-slate-400 hover:text-red-500">✕</button>
              </div>
            ))}
          </div>
          <form onSubmit={submitLink} className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
            <input
              value={linkKey}
              onChange={(e) => setLinkKey(e.target.value)}
              placeholder="Link a ticket by key, e.g. UNIV-104"
              className={`${inputCls} min-w-0 flex-1`}
            />
            <button type="submit" disabled={addLink.isPending} className={btnCls}>Link</button>
          </form>
        </Modal>
      )}

      {/* ---------- Log time modal ---------- */}
      {modal === 'time' && (
        <Modal title={`Time Tracking · ${fmtMin(totalMinutes)}`} onClose={closeModal} error={err}>
          {timeByUser.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {timeByUser.map(([name, mins]) => (
                <span key={name} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">
                  <span className="font-semibold">{name}</span>: {fmtMin(mins)}
                </span>
              ))}
            </div>
          )}
          <form onSubmit={submitTime} className="flex flex-wrap gap-2">
            <input type="number" min="0" max="99" placeholder="h" value={time.hours}
              onChange={(e) => setTime((f) => ({ ...f, hours: e.target.value }))}
              className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand" />
            <input type="number" min="0" max="59" placeholder="m" value={time.minutes}
              onChange={(e) => setTime((f) => ({ ...f, minutes: e.target.value }))}
              className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-sm outline-none focus:border-brand" />
            <input value={time.note}
              onChange={(e) => setTime((f) => ({ ...f, note: e.target.value }))}
              placeholder="What did you work on? (optional)"
              className={`${inputCls} min-w-[140px] flex-1`} />
            <button type="submit" disabled={logTime.isPending} className={btnCls}>Log time</button>
          </form>

          <h4 className="mb-2 mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">History</h4>
          {ticket.timeLogs?.length === 0 && <p className="text-sm text-slate-400">No time logged yet.</p>}
          <div className="space-y-1.5">
            {ticket.timeLogs?.map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-semibold text-slate-700">{l.user?.name}</span>
                  <span className="ml-2 font-mono text-xs font-semibold text-brand">{fmtMin(l.minutes)}</span>
                  {l.note && <span className="ml-2 text-slate-500">— {l.note}</span>}
                </div>
                <div className="flex shrink-0 items-center gap-3 pl-3">
                  <span className="text-[11px] text-slate-400">{fmt(l.createdAt)}</span>
                  {(l.user?.id === user.id || isManager) && (
                    <button onClick={() => run(deleteTimeLog, { id, logId: l.id })} className="text-xs text-slate-400 hover:text-red-500">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </AppLayout>
  );
}
