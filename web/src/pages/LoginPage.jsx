import { useRef, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import Recaptcha from '../components/Recaptcha.jsx';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const recaptchaRef = useRef(null);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const from = location.state?.from?.pathname || '/';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!captchaToken) {
      setError('Please confirm you are not a robot.');
      return;
    }
    setLoading(true);
    try {
      await login(email, password, captchaToken);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to sign in. Please try again.');
      recaptchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Brand panel */}
      <div className="hidden flex-1 flex-col justify-center bg-gradient-to-br from-brand to-accent p-12 text-white md:flex">
        <h1 className="mb-4 text-4xl font-bold">Tracking System</h1>
        <p className="max-w-sm text-white/90">
          One place for the whole campus to raise, track and resolve requests — from IT and
          hostel to exams and accounts.
        </p>
      </div>

      {/* Form */}
      <div className="flex flex-1 items-center justify-center p-8">
        <form onSubmit={onSubmit} className="w-full max-w-xs">
          <h2 className="text-xl font-bold text-slate-800">Sign in</h2>
          <p className="mb-6 mt-1 text-sm text-slate-400">Use the credentials provided to you</p>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}

          <label className="mb-1 block text-xs font-semibold text-slate-500">University Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@university.edu"
            className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />

          <label className="mb-1 block text-xs font-semibold text-slate-500">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="mb-5 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />

          <div className="mb-5">
            <Recaptcha ref={recaptchaRef} onChange={setCaptchaToken} />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-4 text-center text-xs text-slate-400">
            🔒 Accounts are created by the Super Admin only.
          </p>
        </form>
      </div>
    </div>
  );
}
