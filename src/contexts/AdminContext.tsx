import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type AdminRole = 'super_admin' | 'admin' | 'finance_manager';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  role: AdminRole;
  lastLogin: string | null;
}

export type Permission =
  | 'view_dashboard'
  | 'manage_bookings'
  | 'view_ledger'
  | 'manage_ledger'
  | 'manage_users'
  | 'view_audit_logs'
  | 'manage_settings'
  | 'manage_events';

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  super_admin: [
    'view_dashboard','manage_bookings','view_ledger','manage_ledger',
    'manage_users','view_audit_logs','manage_settings','manage_events',
  ],
  admin: [
    'view_dashboard','manage_bookings','view_ledger',
    'manage_users','view_audit_logs','manage_events',
  ],
  finance_manager: ['view_dashboard', 'view_ledger', 'manage_ledger'],
};

interface AdminContextValue {
  adminUser: AdminUser | null;
  session: Session | null;
  loading: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (p: Permission) => boolean;
  clearError: () => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  async function resolveAdminRole(user: User): Promise<boolean> {
    const { data, error } = await supabase
      .from('admin_roles')
      .select('role, is_active, last_login')
      .eq('email', user.email ?? '')
      .maybeSingle();

    if (error || !data) {
      await supabase.auth.signOut();
      setAuthError('Access denied. Your email is not on the admin whitelist.');
      setAdminUser(null);
      return false;
    }

    if (!data.is_active) {
      await supabase.auth.signOut();
      setAuthError('Your admin account has been deactivated. Contact a super admin.');
      setAdminUser(null);
      return false;
    }

    await supabase
      .from('admin_roles')
      .update({ last_login: new Date().toISOString() })
      .eq('email', user.email ?? '');

    setAdminUser({
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email!,
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      role: data.role as AdminRole,
      lastLogin: data.last_login,
    });
    setAuthError(null);
    return true;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        resolveAdminRole(session.user).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        if (event === 'SIGNED_IN' && session?.user) {
          setLoading(true);
          await resolveAdminRole(session.user);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setAdminUser(null);
          setLoading(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signInWithGoogle = async () => {
    setAuthError(null);
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '') + '/#/admin';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    });
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAdminUser(null);
    setSession(null);
  };

  const hasPermission = (p: Permission) =>
    !!adminUser && (ROLE_PERMISSIONS[adminUser.role]?.includes(p) ?? false);

  return (
    <AdminContext.Provider value={{
      adminUser, session, loading, authError,
      signInWithGoogle, signOut, hasPermission,
      clearError: () => setAuthError(null),
    }}>
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
