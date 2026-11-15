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
  /** Google OAuth access token — available after fresh sign-in; null after page refresh */
  providerToken: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Signs out and shows the message on the admin sign-in screen. */
  endSession: (message: string) => Promise<void>;
  hasPermission: (p: Permission) => boolean;
  clearError: () => void;
}

type SessionStatus = 'ok' | 'not_admin' | 'inactive' | 'not_google' | 'superseded';

const SESSION_ERRORS: Record<Exclude<SessionStatus, 'ok'>, string> = {
  not_admin:  'Access denied. Your Google account is not on the admin list.',
  inactive:   'Your admin account has been deactivated. Contact a super admin.',
  not_google: 'Admins must sign in with Google. Please use “Continue with Google”.',
  superseded: 'You were signed out because this admin account signed in on another device.',
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const [adminUser, setAdminUser]     = useState<AdminUser | null>(null);
  const [session, setSession]         = useState<Session | null>(null);
  const [loading, setLoading]         = useState(true);
  const [authError, setAuthError]     = useState<string | null>(null);
  const [providerToken, setProviderToken] = useState<string | null>(null);

  async function resolveAdminRole(user: User, token?: string | null): Promise<boolean> {
    // Claims the single-device admin lock; the database also enforces Google-only sign-in.
    const { data, error } = await supabase.rpc('admin_session', { claim: true });
    const result = (data ?? {}) as { status?: SessionStatus; role?: AdminRole; last_login?: string | null };

    if (error || result.status !== 'ok' || !result.role) {
      const reason = result.status && result.status !== 'ok' ? result.status : 'not_admin';
      setAuthError(SESSION_ERRORS[reason]);
      setAdminUser(null);
      return false;
    }

    setAdminUser({
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.full_name || user.user_metadata?.name || user.email!,
      avatarUrl: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
      role: result.role,
      lastLogin: result.last_login ?? null,
    });
    if (token) setProviderToken(token);
    setAuthError(null);
    return true;
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        resolveAdminRole(session.user, session.provider_token).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        if (event === 'SIGNED_IN' && session?.user) {
          setLoading(true);
          // Supabase holds its auth lock while notifying; calling it from inside
          // the callback deadlocks (e.g. right after the Google redirect), so defer.
          setTimeout(() => {
            resolveAdminRole(session.user, session.provider_token).finally(() => setLoading(false));
          }, 0);
        } else if (event === 'SIGNED_OUT') {
          setAdminUser(null);
          setProviderToken(null);
          setLoading(false);
        }
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  // Re-validate the admin lock: a newer sign-in elsewhere or deactivation ends this session.
  useEffect(() => {
    if (!adminUser) return;
    const check = async () => {
      const { data, error } = await supabase.rpc('admin_session', { claim: false });
      const status = (data as { status?: SessionStatus } | null)?.status;
      if (error || !status || status === 'ok') return;
      setAuthError(SESSION_ERRORS[status]);
      await supabase.auth.signOut({ scope: 'local' });
      setAdminUser(null);
      setSession(null);
      setProviderToken(null);
    };
    const onVisible = () => document.visibilityState === 'visible' && check();
    const id = window.setInterval(check, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [adminUser]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    const redirectTo = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '') + '/#/admin';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
        scopes: 'https://www.googleapis.com/auth/calendar.events',
      },
    });
    if (error) setAuthError(error.message);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAdminUser(null);
    setSession(null);
    setProviderToken(null);
  };

  const endSession = async (message: string) => {
    await signOut();
    setAuthError(message);
  };

  const hasPermission = (p: Permission) =>
    !!adminUser && (ROLE_PERMISSIONS[adminUser.role]?.includes(p) ?? false);

  return (
    <AdminContext.Provider value={{
      adminUser, session, loading, authError, providerToken,
      signInWithGoogle, signOut, endSession, hasPermission,
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
