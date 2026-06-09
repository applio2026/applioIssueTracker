import { useState } from 'react';
import { useCategories, useCreateTicket } from './api.js';
import { PRIORITIES } from './constants.js';

const EMPTY = { title: '', description: '', categoryId: '', priority: 'MEDIUM' };
const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand';

export default function NewTicketModal({ onClose, onCreated }) {
  const { data: categories } = useCategories();
  const createTicket = useCreateTicket();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { ...form, categoryId: form.categoryId || undefined };
      const ticket = await createTicket.mutateAsync(payload);
      onCreated?.(ticket);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create ticket.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl"
      >
        <h3 className="mb-1 text-lg font-bold text-slate-800">Raise a Ticket</h3>
        <p className="mb-4 text-sm text-slate-400">
          Tell us what you need help with. You'll get updates as it progresses.
        </p>

        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <label className="mb-1 block text-xs font-semibold text-slate-500">Subject *</label>
        <input required value={form.title} onChange={set('title')} className={`${inputCls} mb-3`} placeholder="Short summary of the issue" />

        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Category</label>
            <select value={form.categoryId} onChange={set('categoryId')} className={inputCls}>
              <option value="">— Select —</option>
              {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Priority</label>
            <select value={form.priority} onChange={set('priority')} className={inputCls}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p[0] + p.slice(1).toLowerCase()}</option>)}
            </select>
          </div>
        </div>

        <label className="mb-1 block text-xs font-semibold text-slate-500">Description *</label>
        <textarea required rows={5} value={form.description} onChange={set('description')} className={`${inputCls} mb-4`} placeholder="Describe the problem, when it started, and any steps you've tried…" />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" disabled={createTicket.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
            {createTicket.isPending ? 'Submitting…' : 'Submit Ticket'}
          </button>
        </div>
      </form>
    </div>
  );
}
