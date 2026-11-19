import { Navigate, useLocation } from 'react-router-dom';
import { AdminProvider, useAdmin } from '@/contexts/AdminContext';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminLogin } from '@/pages/AdminLogin';

function AdminGuard() {
  const { adminUser } = useAdmin();
  const location = useLocation();

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
