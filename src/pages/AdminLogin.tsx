import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { useQuery } from '@tanstack/react-query';
import { EmailCodeForm } from '@/components/SignInDialog';
import { getGoogleConfig, startGoogleAdmin } from '@/lib/googleAdmin';
import { isApiConfigured } from '@/lib/api';

export function AdminLogin() {
  const { adminUser, authError, sendCode, verifyCode } = useAdmin();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const config = useQuery({
    queryKey: ['admin-google-config'],
    queryFn: getGoogleConfig,
    enabled: isApiConfigured,
  });

  useEffect(() => {
    if (adminUser) navigate('/admin/dashboard', { replace: true });
  }, [adminUser, navigate]);

  return <main className="min-h-screen grid place-items-center bg-stone-100 px-5 py-12">
    <section className="w-full max-w-md rounded-xl border bg-white p-8 text-stone-900 shadow-sm">
      <Link to="/" className="text-sm underline">Back to venue</Link>
      <p className="mt-10 text-sm text-stone-600">Dhanlakshmi Park Inn</p>
      <h1 className="mt-1 text-3xl">Staff sign in</h1>
      {authError && <p role="alert" className="mt-4 text-sm text-red-700">{authError}</p>}
      {!isApiConfigured ? (
        <p role="status" className="mt-4">The booking service is not connected.</p>
      ) : config.isError ? (
        <div className="mt-4">
          <p role="alert">Could not load staff sign-in.</p>
          <button className="mt-2 underline" onClick={() => config.refetch()}>Try again</button>
        </div>
      ) : config.isPending ? (
        <p role="status" className="mt-4">Loading staff sign-in…</p>
      ) : config.data === null ? (
        <>
          <p className="my-5 text-sm text-stone-600">Enter your registered staff email to receive a six-digit sign-in code.</p>
          <EmailCodeForm onSendCode={sendCode} onVerify={verifyCode} sentHint="Only registered venue staff receive a code." />
        </>
      ) : (
        <>
          <p className="my-5 text-sm text-stone-600">Use your registered venue Google account to manage bookings.</p>
          <button disabled={busy} className="w-full rounded-md bg-stone-900 p-3 font-medium text-white disabled:opacity-60" onClick={async () => {
            setBusy(true); setMessage('');
            try { await startGoogleAdmin(config.data); } catch (err) { setMessage((err as Error).message); setBusy(false); }
          }}>{busy ? 'Connecting to Google…' : 'Sign in with Google'}</button>
          {message && <p className="mt-3 text-sm" role="alert">{message}</p>}
        </>
      )}
    </section>
  </main>;
}
