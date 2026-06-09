import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';

const ROLES = [
  { value: 'CUSTOMER', label: 'Customer / Requester' },
  { value: 'DEVELOPER', label: 'Developer / Agent' },
  { value: 'ADMIN', label: 'Admin / Manager' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label.split(' / ')[0]]));

const EMPTY = { name: '', email: '', role: 'CUSTOMER', department: '', password: '' };

export default function UsersPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(EMPTY);
  const [msg, setMsg] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data.users,
  });

  const createUser = useMutation({
    mutationFn: (payload) => api.post('/users', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      setForm(EMPTY);
      setMsg({ type: 'ok', text: 'User created successfully.' });
    },
    onError: (err) =>
      setMsg({ type: 'err', text: err.response?.data?.error || 'Failed to create user.' }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }) => api.patch(`/users/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    setMsg(null);
    createUser.mutate(form);
  };

  return (
    <AppLayout>
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-800">User Management</h2>
      </div>
      <p className="mb-5 text-sm text-slate-400">
        🔒 Only the Super Admin can create accounts and assign roles. There is no public sign-up.
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Users table */}
        <div className="min-w-0 flex-[2] overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Dept</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan="6" className="px-4 py-6 text-center text-slate-400">Loading…</td></tr>
              )}
              {data?.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{u.name}</td>
                  <td className="px-4 py-3 text-slate-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{u.department || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${u.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleActive.mutate({ id: u.id, isActive: !u.isActive })}
                      className="text-xs font-medium text-brand hover:underline"
                    >
                      {u.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create form */}
        <form onSubmit={submit} className="flex-1 rounded-xl border border-slate-200 bg-white p-4 lg:max-w-xs">
          <h3 className="mb-3 text-sm font-bold text-slate-700">Create User</h3>

          {msg && (
            <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
              {msg.text}
            </div>
          )}

          <Field label="Full Name *">
            <input required value={form.name} onChange={set('name')} className={inputCls} placeholder="e.g. Rahul Kumar" />
          </Field>
          <Field label="Email *">
            <input required type="email" value={form.email} onChange={set('email')} className={inputCls} placeholder="name@university.edu" />
          </Field>
          <Field label="Role *">
            <select value={form.role} onChange={set('role')} className={inputCls}>
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Department">
            <input value={form.department} onChange={set('department')} className={inputCls} placeholder="e.g. Network" />
          </Field>
          <Field label="Temporary Password *">
            <input required type="password" minLength={6} value={form.password} onChange={set('password')} className={inputCls} placeholder="min 6 characters" />
          </Field>

          <button
            type="submit"
            disabled={createUser.isPending}
            className="mt-1 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {createUser.isPending ? 'Creating…' : 'Create User'}
          </button>
        </form>
      </div>
    </AppLayout>
  );
}

const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand';

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}
