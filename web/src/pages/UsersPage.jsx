import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import AppLayout from '../components/AppLayout.jsx';
import { useAuth } from '../features/auth/useAuth.js';
import { useCategories } from '../features/tickets/api.js';

const ROLES = [
  { value: 'CUSTOMER', label: 'Customer / Requester' },
  { value: 'DEVELOPER', label: 'Developer / Agent' },
  { value: 'ADMIN', label: 'Admin / Manager' },
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.value, r.label.split(' / ')[0]]));

const PERMISSIONS = [
  { key: 'canRaiseTickets', label: 'Raise tickets' },
  { key: 'canManageTickets', label: 'Manage & assign tickets' },
  { key: 'canViewDashboard', label: 'View dashboard & reports' },
  { key: 'canManageUsers', label: 'Manage users', superOnly: true },
];

const EMPTY = {
  name: '', email: '', role: 'CUSTOMER', department: '', company: '', password: '',
  canRaiseTickets: true, canManageTickets: false, canViewDashboard: false, canManageUsers: false,
  departmentIds: [],
};

const inputCls =
  'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand';

// Shared permission + department controls, used by both the create form and the edit modal.
function PermissionFields({ form, setForm, categories, canGrantManageUsers }) {
  const toggle = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));
  const toggleDept = (id) => (e) =>
    setForm((f) => ({
      ...f,
      departmentIds: e.target.checked
        ? [...f.departmentIds, id]
        : f.departmentIds.filter((x) => x !== id),
    }));

  return (
    <>
      <div className="mb-1 text-xs font-semibold text-slate-500">Permissions</div>
      <div className="mb-3 space-y-1.5 rounded-lg border border-slate-200 p-3">
        {PERMISSIONS.filter((p) => !p.superOnly || canGrantManageUsers).map((p) => (
          <label key={p.key} className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!form[p.key]} onChange={toggle(p.key)} className="accent-brand" />
            {p.label}
          </label>
        ))}
      </div>

      {form.role !== 'CUSTOMER' && (
        <>
          <div className="mb-1 text-xs font-semibold text-slate-500">
            Departments <span className="font-normal text-slate-400">(none = all)</span>
          </div>
          <div className="mb-3 max-h-40 space-y-1.5 overflow-y-auto rounded-lg border border-slate-200 p-3">
            {categories?.length ? (
              categories.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={form.departmentIds.includes(c.id)}
                    onChange={toggleDept(c.id)}
                    className="accent-brand"
                  />
                  {c.name}
                </label>
              ))
            ) : (
              <p className="text-xs text-slate-400">No categories defined yet.</p>
            )}
          </div>
        </>
      )}
    </>
  );
}

export default function UsersPage() {
  const qc = useQueryClient();
  const { user: me } = useAuth();
  const canGrantManageUsers = me.role === 'SUPER_ADMIN';
  const { data: categories } = useCategories();
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null); // user being edited
  const [resetting, setResetting] = useState(null); // user whose password is being reset
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
    onError: (err) => setMsg({ type: 'err', text: err.response?.data?.error || 'Failed to create user.' }),
  });

  const updateUser = useMutation({
    mutationFn: ({ id, ...payload }) => api.patch(`/users/${id}`, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    setMsg(null);
    const payload = { ...form };
    if (payload.role === 'CUSTOMER') payload.company = payload.company.trim();
    else delete payload.company;
    createUser.mutate(payload);
  };

  const toggleActive = (u) => updateUser.mutate({ id: u.id, isActive: !u.isActive });

  return (
    <AppLayout>
      <h2 className="mb-1 text-lg font-bold text-slate-800">User Management</h2>
      <p className="mb-5 text-sm text-slate-400">
        Create accounts, assign roles, and grant permissions — who can raise tickets, which
        departments they cover, and what admin abilities they have.
      </p>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        {/* Users table */}
        <div className="min-w-0 flex-[2] overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-100 text-left text-[11px] uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Permissions</th>
                <th className="px-4 py-3">Departments</th>
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
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-700">{u.name}</div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {PERMISSIONS.filter((p) => u.permissions?.[p.key]).map((p) => (
                        <span key={p.key} className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand">
                          {p.label.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.departments?.length ? u.departments.map((d) => d.name).join(', ') : <span className="text-slate-300">All</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold text-white ${u.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => setEditing(u)} className="mr-3 text-xs font-medium text-brand hover:underline">Edit</button>
                    {/* Only a Super Admin may touch another Super Admin's account
                        (the API enforces this too — see guardEscalation). */}
                    {(canGrantManageUsers || u.role !== 'SUPER_ADMIN') && (
                      <button onClick={() => setResetting(u)} className="mr-3 text-xs font-medium text-brand hover:underline">
                        Reset password
                      </button>
                    )}
                    <button onClick={() => toggleActive(u)} className="text-xs font-medium text-slate-500 hover:underline">
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
              {ROLES.filter((r) => r.value !== 'SUPER_ADMIN' || canGrantManageUsers).map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </Field>
          {form.role === 'CUSTOMER' && (
            <Field label="Company *">
              <input required value={form.company} onChange={set('company')} className={inputCls} placeholder="e.g. Acme Corp" />
            </Field>
          )}
          <Field label="Department (text)">
            <input value={form.department} onChange={set('department')} className={inputCls} placeholder="e.g. Network" />
          </Field>
          <Field label="Temporary Password *">
            <input required type="password" minLength={6} value={form.password} onChange={set('password')} className={inputCls} placeholder="min 6 characters" />
          </Field>

          <PermissionFields form={form} setForm={setForm} categories={categories} canGrantManageUsers={canGrantManageUsers} />

          <button type="submit" disabled={createUser.isPending} className="mt-1 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
            {createUser.isPending ? 'Creating…' : 'Create User'}
          </button>
        </form>
      </div>

      {editing && (
        <EditUserModal
          user={editing}
          categories={categories}
          canGrantManageUsers={canGrantManageUsers}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['users'] }); setEditing(null); }}
        />
      )}

      {resetting && (
        <ResetPasswordModal
          user={resetting}
          isSelf={resetting.id === me.id}
          onClose={() => setResetting(null)}
        />
      )}
    </AppLayout>
  );
}

// Admin-initiated reset: sets a new password directly, without knowing the old
// one. Users changing their own password use the header's Change Password
// dialog, which requires the current password.
function ResetPasswordModal({ user, isSelf, onClose }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState('');
  const [done, setDone] = useState(false);

  const save = useMutation({
    mutationFn: (payload) => api.patch(`/users/${user.id}`, payload),
    onSuccess: () => setDone(true),
    onError: (e) => setErr(e.response?.data?.error || 'Failed to reset the password.'),
  });

  const submit = (e) => {
    e.preventDefault();
    setErr('');
    if (password !== confirm) return setErr('The two passwords do not match.');
    save.mutate({ password });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Reset Password</h3>
            <p className="text-xs text-slate-400">{user.name} — {user.email}</p>
          </div>
          <button type="button" onClick={onClose} className="text-lg text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {done ? (
          <>
            <div className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              Password reset. Share the new password with {isSelf ? 'yourself' : user.name.split(' ')[0]} securely —
              it is not emailed automatically.
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={onClose} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90">
                Done
              </button>
            </div>
          </>
        ) : (
          <>
            {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}
            {isSelf && (
              <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                This is your own account — you will keep using this session, but the new password
                applies at your next sign-in.
              </div>
            )}

            <Field label="New Password *">
              <input
                required
                autoFocus
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputCls}
                placeholder="min 6 characters"
              />
            </Field>
            <Field label="Confirm New Password *">
              <input
                required
                type="password"
                minLength={6}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={inputCls}
              />
            </Field>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
                Cancel
              </button>
              <button type="submit" disabled={save.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
                {save.isPending ? 'Resetting…' : 'Reset password'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function EditUserModal({ user, categories, canGrantManageUsers, onClose, onSaved }) {
  const [form, setForm] = useState({
    role: user.role,
    department: user.department || '',
    company: user.company || '',
    isActive: user.isActive,
    password: '',
    canRaiseTickets: user.grants?.canRaiseTickets ?? true,
    canManageTickets: user.grants?.canManageTickets ?? false,
    canViewDashboard: user.grants?.canViewDashboard ?? false,
    canManageUsers: user.grants?.canManageUsers ?? false,
    departmentIds: user.departmentIds || [],
  });
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = useMutation({
    mutationFn: (payload) => api.patch(`/users/${user.id}`, payload),
    onSuccess: onSaved,
    onError: (e) => setErr(e.response?.data?.error || 'Failed to save.'),
  });

  const submit = (e) => {
    e.preventDefault();
    setErr('');
    const payload = { ...form };
    if (!payload.password) delete payload.password;
    if (payload.role === 'CUSTOMER') payload.company = payload.company.trim();
    else delete payload.company;
    save.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Edit {user.name}</h3>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
          <button type="button" onClick={onClose} className="text-lg text-slate-400 hover:text-slate-600">✕</button>
        </div>

        {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

        <Field label="Role">
          <select value={form.role} onChange={set('role')} className={inputCls}>
            {ROLES.filter((r) => r.value !== 'SUPER_ADMIN' || canGrantManageUsers).map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </Field>
        {form.role === 'CUSTOMER' && (
          <Field label="Company *">
            <input required value={form.company} onChange={set('company')} className={inputCls} placeholder="e.g. Acme Corp" />
          </Field>
        )}
        <Field label="Department (text)">
          <input value={form.department} onChange={set('department')} className={inputCls} placeholder="e.g. Network" />
        </Field>

        <PermissionFields form={form} setForm={setForm} categories={categories} canGrantManageUsers={canGrantManageUsers} />

        <Field label="Reset Password (optional)">
          <input type="password" minLength={6} value={form.password} onChange={set('password')} className={inputCls} placeholder="leave blank to keep current" />
        </Field>
        <label className="mb-4 flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} className="accent-brand" />
          Active
        </label>

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Cancel
          </button>
          <button type="submit" disabled={save.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60">
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}
