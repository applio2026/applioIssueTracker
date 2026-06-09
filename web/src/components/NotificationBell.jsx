import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications, useMarkRead, useMarkAllRead } from '../features/notifications/api.js';

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const markAllRead = useMarkAllRead();

  const unread = data?.unread || 0;
  const items = data?.notifications || [];

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const openItem = (n) => {
    if (!n.isRead) markRead.mutate(n.id);
    setOpen(false);
    if (n.ticketId) navigate(`/tickets/${n.ticketId}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid h-9 w-9 place-items-center rounded-lg bg-slate-100 text-base hover:bg-slate-200"
        aria-label="Notifications"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <span className="text-sm font-bold text-slate-700">Notifications</span>
            {unread > 0 && (
              <button onClick={() => markAllRead.mutate()} className="text-xs font-medium text-brand hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-400">No notifications</div>
            )}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => openItem(n)}
                className={`flex w-full gap-2 border-b border-slate-50 px-4 py-3 text-left hover:bg-slate-50 ${n.isRead ? '' : 'bg-blue-50/40'}`}
              >
                {!n.isRead && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />}
                <div className={n.isRead ? 'pl-4' : ''}>
                  <p className="text-sm text-slate-700">{n.message}</p>
                  <p className="text-[11px] text-slate-400">{timeAgo(n.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
