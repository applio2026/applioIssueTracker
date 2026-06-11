import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuthStore } from '../store/auth.js';

// Landing page for one-time SSO links: <origin>/sso?token=…
// Exchanges the token for a session, then drops the user on their tickets.
export default function SsoPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const attempted = useRef(false);

  useEffect(() => {
    // The token is single-use — guard against double-invoked effects.
    if (attempted.current) return;
    attempted.current = true;

    const token = params.get('token');
    if (!token) {
      setError('This sign-in link is missing its token.');
      return;
    }

    api
      .post('/auth/sso', { token })
      .then(({ data }) => {
        useAuthStore.getState().setAuth(data.accessToken, data.user);
        navigate('/', { replace: true });
      })
      .catch((err) => {
        setError(err.response?.data?.error || 'Sign-in link is invalid or has expired.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="grid min-h-screen place-items-center p-8">
      <div className="w-full max-w-sm text-center">
        {!error ? (
          <>
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-brand" />
            <p className="text-sm text-slate-500">Signing you in…</p>
          </>
        ) : (
          <>
            <h2 className="mb-2 text-lg font-bold text-slate-800">Unable to sign in</h2>
            <p className="mb-5 text-sm text-slate-500">{error}</p>
            <Link
              to="/login"
              className="inline-block rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand/90"
            >
              Go to sign-in page
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
