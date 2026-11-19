import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { EmailCodeForm } from '@/components/SignInDialog';
import { isApiConfigured } from '@/lib/api';

export function AdminLogin() {
  const { adminUser, authError, sendCode, verifyCode } = useAdmin();
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
      {isApiConfigured ? <div className="mt-5"><p className="mb-5 text-sm text-stone-600">Use the email address registered by the venue owner.</p>
        <EmailCodeForm onSendCode={sendCode} onVerify={verifyCode} submitLabel="Send sign-in code" sentHint="Check your registered email for your code." />
      </div> : <p role="status" className="mt-5 text-sm">Staff sign-in is unavailable until the venue owner connects the booking service.</p>}
    </section>
  </main>;
}
