import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import NotificationBell from './NotificationBell.jsx';
import ChangePasswordModal from './ChangePasswordModal.jsx';

const ROLE_LABEL = {
  CUSTOMER: 'Customer',
  DEVELOPER: 'Developer',
  ADMIN: 'Admin',
  SUPER_ADMIN: 'Super Admin',
};

function initials(name = '') {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const linkBase =
  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 transition';
const linkActive = 'bg-brand-light/20 text-white font-semibold';

export default function AppLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [changingPassword, setChangingPassword] = useState(false);

  const isStaff = ['DEVELOPER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role);
  const p = user.permissions || {};
  const showAdmin = p.canManageUsers || user.role === 'SUPER_ADMIN';

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 bg-brand-dark text-slate-200 p-3">
        <div className="flex items-center gap-2 font-bold text-white px-2 py-3 mb-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-brand to-accent text-sm">
            T
          </span>
          Tracking System
        </div>
        <nav className="space-y-1">
          <NavLink to="/tickets" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
            🎫 Tickets
          </NavLink>
          {isStaff && (
            <NavLink to="/board" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
              🗂️ Board
            </NavLink>
          )}
          {p.canViewDashboard && (
            <NavLink to="/dashboard" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
              📊 Dashboard
            </NavLink>
          )}
          {showAdmin && (
            <>
              <div className="px-3 pt-4 pb-1 text-[11px] uppercase tracking-wide text-slate-500">
                Admin
              </div>
              {p.canManageUsers && (
                <NavLink to="/admin/users" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
                  👥 Users
                </NavLink>
              )}
              {user.role === 'SUPER_ADMIN' && (
                <NavLink to="/admin/settings" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
                  ⚙️ Settings
                </NavLink>
              )}
            </>
          )}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-slate-200 bg-white px-5">
          <div className="flex-1" />
          <NotificationBell />
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand-light to-accent text-sm font-semibold text-white">
            {initials(user.name)}
          </div>
          <div className="text-sm leading-tight">
            <div className="font-semibold text-slate-700">{user.name}</div>
            <div className="text-xs text-slate-400">{ROLE_LABEL[user.role]}</div>
          </div>
          <button
            onClick={() => setChangingPassword(true)}
            className="ml-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Change Password
          </button>
          <button
            onClick={handleLogout}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Logout
          </button>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>

      {changingPassword && <ChangePasswordModal onClose={() => setChangingPassword(false)} />}
    </div>
  );
}
