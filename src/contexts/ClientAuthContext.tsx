import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, ApiError, isApiConfigured, type AccessStatus, type CustomerProfile } from '@/lib/api';
import { toast } from 'sonner';
import SignInDialog from '@/components/SignInDialog';

export type { AccessStatus };

interface ClientAuthContextValue {
  customer: CustomerProfile | null;
  /** True until the stored session has been checked with the server. */
  loading: boolean;
  token: string | null;
  /** Opens the email-code sign-in dialog; `onSignedIn` runs after a successful sign-in. */
  openSignIn: (onSignedIn?: () => void) => void;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  requestAccess: (name: string, mobile: string) => Promise<void>;
  refresh: () => Promise<void>;
  signOut: () => void;
}

const STORAGE_KEY = 'parkinn.customer';
const ClientAuthContext = createContext<ClientAuthContextValue | null>(null);

export function ClientAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(!!token && isApiConfigured);
  const [dialogOpen, setDialogOpen] = useState(false);
  const afterSignIn = useRef<(() => void) | undefined>();

  const clearSession = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setCustomer(null);
  }, []);

  const signOut = useCallback(async () => {
    try {
      if (token) await api('logout', {}, token);
      clearSession();
    } catch {
      toast.error('Could not sign out. Check your connection and try again.');
    }
  }, [token, clearSession]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setCustomer(await api<CustomerProfile>('me', {}, token));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'AUTH') clearSession();
    }
  }, [token, clearSession]);

  useEffect(() => {
    if (!token || !isApiConfigured) return;
    refresh().finally(() => setLoading(false));
  }, [token, refresh]);

  const sendCode = async (email: string) => {
    await api('sendCode', { email, purpose: 'customer' });
  };

  const verifyCode = async (email: string, code: string) => {
    const res = await api<{ token: string; profile: CustomerProfile }>('verifyCode', { email, code, purpose: 'customer' });
    localStorage.setItem(STORAGE_KEY, res.token);
    setToken(res.token);
    setCustomer(res.profile);
    setDialogOpen(false);
    const next = afterSignIn.current;
    afterSignIn.current = undefined;
    next?.();
  };

  const requestAccess = async (name: string, mobile: string) => {
    setCustomer(await api<CustomerProfile>('requestAccess', { name, mobile }, token));
  };

  const openSignIn = (onSignedIn?: () => void) => {
    afterSignIn.current = onSignedIn;
    setDialogOpen(true);
  };

  return (
    <ClientAuthContext.Provider value={{
      customer, loading, token, openSignIn, sendCode, verifyCode, requestAccess, refresh, signOut,
    }}>
      {children}
      <SignInDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) afterSignIn.current = undefined;
        }}
        title="Sign in to book"
        description="We'll email you a 6-digit code. No password needed."
        onSendCode={sendCode}
        onVerify={verifyCode}
      />
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  const ctx = useContext(ClientAuthContext);
  if (!ctx) throw new Error('useClientAuth must be used within ClientAuthProvider');
  return ctx;
}
