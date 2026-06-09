import { useState } from 'react';
import AppLayout from '../components/AppLayout.jsx';
import { useCategories } from '../features/tickets/api.js';
import {
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '../features/settings/api.js';

const inputCls = 'rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand';
const EMPTY = { name: '', defaultTeam: '', defaultSlaHours: 48 };

export default function SettingsPage() {
  const { data: categories, isLoading } = useCategories();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const deleteCat = useDeleteCategory();

  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({});
  const [msg, setMsg] = useState(null);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    setMsg(null);
    createCat.mutate(
      { ...form, defaultSlaHours: Number(form.defaultSlaHours), defaultTeam: form.defaultTeam || null },
      {
        onSuccess: () => { setForm(EMPTY); setMsg({ type: 'ok', text: 'Category added.' }); },
        onError: (err) => setMsg({ type: 'err', text: err.response?.data?.error || 'Failed to add category.' }),
      },
    );
  };

  const startEdit = (c) => {
    setEditId(c.id);
    setEdit({ name: c.name, defaultTeam: c.defaultTeam || '', defaultSlaHours: c.defaultSlaHours });
  };
  const saveEdit = (id) => {
    updateCat.mutate(
      { id, ...edit, defaultSlaHours: Number(edit.defaultSlaHours), defaultTeam: edit.defaultTeam || null },
      { onSuccess: () => setEditId(null) },
    );
  };

  return (
    <AppLayout>
      <h2 className="mb-1 text-lg font-bold text-slate-800">Settings</h2>
      <p className="mb-5 text-sm text-slate-400">Manage ticket categories, their default team, and SLA targets (hours).</p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Category table */}
        <div className="min-w-0 flex-[2] overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Default Team</th>
                <th className="px-4 py-3">SLA (hrs)</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>}
              {categories?.map((c) => (
                <tr key={c.id} className="border-b border-slate-100">
                  {editId === c.id ? (
                    <>
                      <td className="px-4 py-2"><input value={edit.name} onChange={(e) => setEdit((s) => ({ ...s, name: e.target.value }))} className={`${inputCls} w-full`} /></td>
                      <td className="px-4 py-2"><input value={edit.defaultTeam} onChange={(e) => setEdit((s) => ({ ...s, defaultTeam: e.target.value }))} className={`${inputCls} w-full`} /></td>
                      <td className="px-4 py-2"><input type="number" value={edit.defaultSlaHours} onChange={(e) => setEdit((s) => ({ ...s, defaultSlaHours: e.target.value }))} className={`${inputCls} w-20`} /></td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => saveEdit(c.id)} className="mr-2 text-xs font-semibold text-brand hover:underline">Save</button>
                        <button onClick={() => setEditId(null)} className="text-xs text-slate-400 hover:underline">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium text-slate-700">{c.name}</td>
                      <td className="px-4 py-3 text-slate-500">{c.defaultTeam || '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{c.defaultSlaHours}</td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => startEdit(c)} className="mr-3 text-xs font-medium text-brand hover:underline">Edit</button>
                        <button
                          onClick={() => { if (confirm(`Delete "${c.name}"? Tickets keep their data but lose this category.`)) deleteCat.mutate(c.id); }}
                          className="text-xs text-slate-400 hover:text-red-500"
                        >
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {categories?.length === 0 && <tr><td colSpan="4" className="px-4 py-6 text-center text-slate-400">No categories.</td></tr>}
            </tbody>
          </table>
        </div>

        {/* Add form */}
        <form onSubmit={submit} className="flex-1 rounded-xl border border-slate-200 bg-white p-4 lg:max-w-xs">
          <h3 className="mb-3 text-sm font-bold text-slate-700">Add Category</h3>
          {msg && <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>{msg.text}</div>}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Name *</label>
            <input required value={form.name} onChange={set('name')} className={`${inputCls} w-full`} placeholder="e.g. Transport" />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold text-slate-500">Default Team</label>
            <input value={form.defaultTeam} onChange={set('defaultTeam')} className={`${inputCls} w-full`} placeholder="e.g. Facilities" />
          </div>
          <div className="mb-3">
            <label className="mb-1 block text-xs font-semibold text-slate-500">SLA target (hours)</label>
            <input type="number" min="1" value={form.defaultSlaHours} onChange={set('defaultSlaHours')} className={`${inputCls} w-full`} />
          </div>
          <button type="submit" disabled={createCat.isPending} className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
            {createCat.isPending ? 'Adding…' : 'Add Category'}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
