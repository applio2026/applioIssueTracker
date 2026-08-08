import { useState } from 'react';
import { useAuth } from '../features/auth/useAuth.js';

const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand';

// Self-service password change for the signed-in user (any role). The current
// password is required — an admin resetting someone else's password goes
// through the Users screen instead.
export default function ChangePasswordModal({ onClose }) {
  const { changePassword } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setErr('');

    if (form.next !== form.confirm) return setErr('The two new passwords do not match.');
    if (form.next === form.current) return setErr('New password must be different from the current one.');

    setSaving(true);
    try {
      await changePassword(form.current, form.next);
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Could not change the password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-800">Change Password</h3>
          <button type="button" onClick={onClose} className="text-lg text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {done ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Password updated. Use it the next time you sign in.
          </div>
        ) : (
          <>
            {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Current Password *</label>
              <input
                required
                autoFocus
                type="password"
                autoComplete="current-password"
                value={form.current}
                onChange={set('current')}
                className={inputCls}
              />
            </div>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-slate-500">New Password *</label>
              <input
                required
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={form.next}
                onChange={set('next')}
                className={inputCls}
                placeholder="min 6 characters"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1 block text-xs font-semibold text-slate-500">Confirm New Password *</label>
              <input
                required
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={form.confirm}
                onChange={set('confirm')}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Update password'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
