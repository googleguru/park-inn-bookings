import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { startGoogleAdmin } from '@/lib/googleAdmin';
import { isApiConfigured } from '@/lib/api';

export function AdminLogin() {
  const { adminUser, authError } = useAdmin();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (adminUser) navigate('/admin/dashboard', { replace: true });
  }, [adminUser, navigate]);

  return <main className="min-h-screen grid place-items-center bg-stone-100 px-5 py-12">
    <section className="w-full max-w-md rounded-xl border bg-white p-8 text-stone-900 shadow-sm">
      <Link to="/" className="text-sm underline">Back to venue</Link>
      <p className="mt-10 text-sm text-stone-600">Dhanlakshmi Park Inn</p>
      <h1 className="mt-1 text-3xl">Staff sign in</h1>
      {authError && <p role="alert" className="mt-4 text-sm text-red-700">{authError}</p>}
      <p className="my-5 text-sm text-stone-600">Use your registered venue Google account to manage bookings.</p>
      <button disabled={busy || !isApiConfigured} className="w-full rounded-md bg-stone-900 p-3 font-medium text-white disabled:opacity-60" onClick={async () => {
        setBusy(true); setMessage('');
        try { await startGoogleAdmin(); } catch (err) { setMessage((err as Error).message); setBusy(false); }
      }}>{busy ? 'Connecting to Google…' : 'Sign in with Google'}</button>
      {message && <p className="mt-3 text-sm" role="alert">{message}</p>}
      {!isApiConfigured && <p className="mt-3 text-sm text-stone-600" role="status">Google sign-in is awaiting venue activation.</p>}
    </section>
  </main>;
}
