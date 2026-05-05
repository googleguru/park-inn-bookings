import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ClientUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
}

interface ClientAuthContextValue {
  clientUser: ClientUser | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const ClientAuthContext = createContext<ClientAuthContextValue | null>(null);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [clientUser, setClientUser] = useState<ClientUser | null>(null);
  const [loading, setLoading] = useState(true);

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

  const signOut = async () => {
    await supabase.auth.signOut();
    setClientUser(null);
  };

  return (
    <ClientAuthContext.Provider value={{ clientUser, loading, signIn, signOut }}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth must be used within ClientAuthProvider');
  return ctx;
}
