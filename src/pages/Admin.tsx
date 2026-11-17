import { Link, Navigate, useLocation } from 'react-router-dom';
import { Settings2 } from 'lucide-react';
import { AdminProvider, useAdmin } from '@/contexts/AdminContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminLogin } from '@/pages/AdminLogin';
import { Button } from '@/components/ui/button';
import { isApiConfigured } from '@/lib/api';

function NotConnected() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-elegant">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent">
          <Settings2 className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-semibold">Connect your Google account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The admin panel and online booking switch on once the venue's Google account is connected.
          It takes about 10 minutes and is free.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/setup">Open the setup guide</Link>
        </Button>
      </div>
    </div>
  );
}

function AdminGuard() {
  const { adminUser } = useAdmin();
  const location = useLocation();

  if (!isApiConfigured) return <NotConnected />;
  if (!adminUser) return <AdminLogin />;
  if (location.pathname === '/admin' || location.pathname === '/admin/') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <AdminLayout />;
}

export default function AdminPage() {
  return (
    <AdminProvider>
      <AdminGuard />
    </AdminProvider>
  );
}
