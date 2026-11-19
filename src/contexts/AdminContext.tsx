import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { consumeGoogleReturn } from '@/lib/googleAdmin';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, SESSION_ENDED_CODES, type AdminData, type AdminRole } from '@/lib/api';

export type { AdminRole };

export interface AdminUser {
  email: string;
  role: AdminRole;
}

interface AdminContextValue {
  adminUser: AdminUser | null;
  token: string | null;
  authError: string | null;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Signs out and shows the message on the admin sign-in screen. */
  endSession: (message: string) => void;
  isSuper: boolean;
  clearError: () => void;
}

// sessionStorage: closing the browser tab ends the admin session.
const STORAGE_KEY = 'parkinn.admin';
export const LAST_ACTIVITY_KEY = 'parkinn.admin-activity';
const PING_MS = 2 * 60 * 1000;

const AdminContext = createContext<AdminContextValue | null>(null);

function loadStored(): { token: string; admin: AdminUser } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const stored = useRef(loadStored());
  const [token, setToken] = useState<string | null>(stored.current?.token ?? null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(stored.current?.admin ?? null);
  const [authError, setAuthError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setAdminUser(null);
    queryClient.removeQueries({ queryKey: ['admin-data'] });
  }, [queryClient]);

  const endSession = useCallback((message: string) => {
    clearSession();
    setAuthError(message);
  }, [clearSession]);

  const sendCode = async (email: string) => {
    setAuthError(null);
    await api('sendCode', { email, purpose: 'admin' });
  };

  const verifyCode = async (email: string, code: string) => {
    const res = await api<{ token: string; admin: AdminUser }>('verifyCode', { email, code, purpose: 'admin' });
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(res));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
    setToken(res.token);
    setAdminUser(res.admin);
    setAuthError(null);
  };

  useEffect(() => {
    const googleReturn = consumeGoogleReturn();
    if (!googleReturn) return;
    if (googleReturn.error) { setAuthError(googleReturn.error); return; }
    api<{ token: string; admin: AdminUser }>('googleAdminLogin', { code: googleReturn.code, verifier: googleReturn.verifier })
      .then(res => {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(res));
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
        setToken(res.token); setAdminUser(res.admin); setAuthError(null);
      }).catch(err => setAuthError(err.message));
  }, []);

  const signOut = async () => {
    const current = token;
    clearSession();
    if (current) await api('logout', {}, current).catch(() => undefined);
  };

  // Keep the server-side session alive while the admin is active, and notice
  // promptly when another device signs in or the server locks the session.
  useEffect(() => {
    if (!token) return;
    const id = window.setInterval(async () => {
      const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? 0);
      if (Date.now() - last > PING_MS) return;
      try {
        await api('adminPing', {}, token);
      } catch (err) {
        if (err instanceof ApiError && SESSION_ENDED_CODES.includes(err.code)) endSession(err.message);
      }
    }, PING_MS);
    return () => window.clearInterval(id);
  }, [token, endSession]);

  return (
    <AdminContext.Provider value={{
      adminUser, token, authError, sendCode, verifyCode, signOut, endSession,
      isSuper: adminUser?.role === 'super_admin',
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

/** Everything the admin panel shows, loaded in one request. */
export function useAdminData() {
  const { token, endSession } = useAdmin();
  const query = useQuery({
    queryKey: ['admin-data'],
    queryFn: () => api<AdminData>('adminData', {}, token),
    enabled: !!token,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: (count, err) => !(err instanceof ApiError && SESSION_ENDED_CODES.includes(err.code)) && count < 1,
  });
  const error = query.error;
  useEffect(() => {
    if (error instanceof ApiError && SESSION_ENDED_CODES.includes(error.code)) endSession(error.message);
  }, [error, endSession]);
  return query;
}

/** Runs an admin action and refreshes the panel data afterwards. */
export function useAdminAction<T = unknown>() {
  const { token, endSession } = useAdmin();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ action, payload }: { action: string; payload?: Record<string, unknown> }) =>
      api<T>(action, payload ?? {}, token),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-data'] }),
    onError: (err) => {
      if (err instanceof ApiError && SESSION_ENDED_CODES.includes(err.code)) endSession(err.message);
    },
  });
}
