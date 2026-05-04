import { Navigate, useLocation } from 'react-router-dom';
import { AdminProvider, useAdmin } from '@/contexts/AdminContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminLogin } from '@/pages/AdminLogin';
import { Loader2 } from 'lucide-react';

function AdminGuard() {
  const { adminUser, loading, session } = useAdmin();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading admin panel…</p>
        </div>
      </div>
    );
  }

  if (!session || !adminUser) {
    return <AdminLogin />;
  }

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
