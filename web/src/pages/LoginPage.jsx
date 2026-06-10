import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../features/auth/useAuth.js';
import { api } from '../api/client.js';

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState(null); // { captchaId, question }
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Challenges are single-use and short-lived, so fetch a fresh one on mount
  // and after every failed attempt.
  const loadCaptcha = useCallback(async () => {
    setAnswer('');
    try {
      const { data } = await api.get('/auth/captcha');
      setCaptcha(data);
    } catch {
      setCaptcha(null);
    }
  }, []);

  useEffect(() => {
    loadCaptcha();
  }, [loadCaptcha]);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const from = location.state?.from?.pathname || '/';

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password, { captchaId: captcha?.captchaId, captchaAnswer: answer });
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to sign in. Please try again.');
      loadCaptcha();
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
          <h2 className="mb-6 text-xl font-bold text-slate-800">Sign in</h2>

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
            className="mb-4 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-brand"
          />

          <label className="mb-1 block text-xs font-semibold text-slate-500">Security Check</label>
          <div className="mb-5 flex items-center gap-2">
            <span className="rounded-lg bg-slate-100 px-3 py-2.5 font-mono text-sm font-semibold text-slate-700">
              {captcha ? `${captcha.question} =` : '…'}
            </span>
            <input
              required
              inputMode="numeric"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="?"
              className="w-16 rounded-lg border border-slate-200 px-3 py-2.5 text-center text-sm outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={loadCaptcha}
              title="New question"
              className="rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-500 hover:border-brand hover:text-brand"
            >
              ↻
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || !captcha}
            className="w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-60"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
