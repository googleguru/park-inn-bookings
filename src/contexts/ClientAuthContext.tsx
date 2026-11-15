import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClientUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

export type AccessStatus = 'none' | 'pending' | 'approved' | 'rejected';

interface ClientAuthContextValue {
  clientUser: ClientUser | null;
  loading: boolean;
  /** Admin approval state for booking; null while unknown or signed out. */
  accessStatus: AccessStatus | null;
  requestAccess: (name?: string) => Promise<{ error?: string }>;
  refreshAccess: () => Promise<void>;
  signIn: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error?: string }>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<{ error?: string }>;
  resetPassword: (email: string) => Promise<{ error?: string }>;
  setPersistence: (stay: boolean) => void;
  signOut: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextValue | null>(null);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessStatus, setAccessStatus] = useState<AccessStatus | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user;
        setClientUser({
          id: u.id,
          email: u.email!,
          name: u.user_metadata?.full_name || u.user_metadata?.name || u.email!,
          avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
        });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        const u = session.user;
        setClientUser({
          id: u.id,
          email: u.email!,
          name: u.user_metadata?.full_name || u.user_metadata?.name || u.email!,
          avatarUrl: u.user_metadata?.avatar_url || u.user_metadata?.picture || '',
        });
      } else {
        setClientUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const refreshAccess = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email?.toLowerCase();
    if (!email) {
      setAccessStatus(null);
      return;
    }
    const { data, error } = await supabase
      .from('customer_access')
      .select('status')
      .eq('email', email)
      .maybeSingle();
    if (error) {
      console.error('Could not load access status:', error);
      setAccessStatus(null);
      return;
    }
    setAccessStatus((data?.status as AccessStatus | undefined) ?? 'none');
  }, []);

  const userId = clientUser?.id;
  useEffect(() => {
    if (userId) refreshAccess();
    else setAccessStatus(null);
  }, [userId, refreshAccess]);

  const requestAccess = async (name?: string) => {
    if (!clientUser) return { error: 'Please sign in first.' };
    const { error } = await supabase.from('customer_access').insert({
      email: clientUser.email.toLowerCase(),
      user_id: clientUser.id,
      name: (name ?? clientUser.name).trim().slice(0, 100) || null,
    });
    // 23505: a request already exists, so just reload its status.
    if (error && error.code !== '23505') return { error: 'Could not send your request. Please try again.' };
    await refreshAccess();
    return {};
  };

  const signIn = async () => {
    const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '');
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: base + '/',
        queryParams: { prompt: 'select_account' },
      },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '');
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: base + '/',
        data: name ? { full_name: name } : undefined,
      },
    });
    return error ? { error: error.message } : {};
  };

  const resetPassword = async (email: string) => {
    const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${base}/#/reset-password`,
    });
    return error ? { error: error.message } : {};
  };

  // When stay=false, sign out automatically when the tab/window is closed.
  const setPersistence = (stay: boolean) => {
    try {
      if (stay) {
        sessionStorage.removeItem('park-inn-ephemeral');
      } else {
        sessionStorage.setItem('park-inn-ephemeral', '1');
      }
    } catch { /* ignore */ }
  };

  useEffect(() => {
    const onUnload = () => {
      try {
        if (sessionStorage.getItem('park-inn-ephemeral') === '1') {
          supabase.auth.signOut();
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setClientUser(null);
  };

  return (
    <ClientAuthContext.Provider value={{ clientUser, loading, accessStatus, requestAccess, refreshAccess, signIn, signInWithEmail, signUpWithEmail, resetPassword, setPersistence, signOut }}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth must be used within ClientAuthProvider');
  return ctx;
}
