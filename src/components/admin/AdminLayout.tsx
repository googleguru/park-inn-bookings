import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAdmin } from '@/contexts/AdminContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  LayoutDashboard, CalendarDays, DollarSign, Users, UserCheck,
  TrendingUp, ClipboardList, Settings, LogOut,
  Menu, Sun, Moon, ShieldCheck, Lock,
} from 'lucide-react';

const IDLE_LIMIT_MS = 15 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;
const LAST_ACTIVITY_KEY = 'admin-last-activity';

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  super_admin:     { label: 'Super Admin',     cls: 'bg-gold/20 text-primary' },
  admin:           { label: 'Admin',           cls: 'bg-blue-500/10 text-blue-700 dark:text-blue-300' },
  finance_manager: { label: 'Finance Manager', cls: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' },
};

const NAV = [
  { to: '/admin/dashboard',   label: 'Dashboard',        icon: LayoutDashboard, roles: ['super_admin','admin','finance_manager'] },
  { to: '/admin/bookings',    label: 'Bookings',         icon: CalendarDays,    roles: ['super_admin','admin'] },
  { to: '/admin/access',      label: 'Customer Access',  icon: UserCheck,       roles: ['super_admin','admin'] },
  { to: '/admin/ledger',      label: 'Ledger',           icon: DollarSign,      roles: ['super_admin','admin','finance_manager'] },
  { to: '/admin/users',       label: 'Users',            icon: Users,           roles: ['super_admin','admin'] },
  { to: '/admin/events',      label: 'Events & Pricing', icon: TrendingUp,      roles: ['super_admin','admin'] },
  { to: '/admin/audit-logs',  label: 'Audit Logs',       icon: ClipboardList,   roles: ['super_admin','admin'] },
  { to: '/admin/settings',    label: 'Settings',         icon: Settings,        roles: ['super_admin'] },
];

function SidebarNav({ role, onNav }: { role: string; onNav?: () => void }) {
  const { adminUser, signOut } = useAdmin();
  const navigate = useNavigate();
  const badge = ROLE_BADGE[role];
  const allowed = NAV.filter(n => n.roles.includes(role));

  const handleSignOut = async () => {
    await signOut();
    navigate('/admin');
  };

  return (
    <div className="flex h-full flex-col bg-secondary text-secondary-foreground">
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold/15 ring-1 ring-gold/30">
          <ShieldCheck size={17} className="text-gold" />
        </div>
        <div>
          <p className="font-serif text-lg leading-none">
            Park <span className="italic text-gold">Inn</span>
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-secondary-foreground/50">Admin console</p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {allowed.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} onClick={onNav} className="relative block">
            {({ isActive }) => (
              <span
                className={cn(
                  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
                  isActive ? 'text-secondary' : 'text-secondary-foreground/65 hover:bg-white/5 hover:text-secondary-foreground'
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId={onNav ? 'admin-nav-mobile' : 'admin-nav'}
                    className="absolute inset-0 -z-0 rounded-xl bg-gold"
                    transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                  />
                )}
                <Icon size={16} className="relative" />
                <span className="relative font-medium">{label}</span>
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0 ring-2 ring-gold/40">
            <AvatarImage src={adminUser?.avatarUrl} alt="" referrerPolicy="no-referrer" />
            <AvatarFallback className="bg-gold/20 text-sm font-semibold text-gold">
              {adminUser?.name?.[0]?.toUpperCase() ?? 'A'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-tight">{adminUser?.name}</p>
            <p className="truncate text-[11px] text-secondary-foreground/50">{adminUser?.email}</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          {badge && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider', badge.cls)}>
              {badge.label}
            </span>
          )}
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-secondary-foreground/60 transition-colors hover:bg-red-500/15 hover:text-red-300"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

/** Locks the console after 15 minutes without activity (also across closed tabs). */
function useIdleLock(onLock: () => void) {
  const [remainingMs, setRemainingMs] = useState(IDLE_LIMIT_MS);
  const lastWrite = useRef(0);
  const onLockRef = useRef(onLock);
  onLockRef.current = onLock;

  const touch = useCallback(() => {
    const now = Date.now();
    // Throttle storage writes; mousemove fires constantly.
    if (now - lastWrite.current < 5_000) return;
    lastWrite.current = now;
    localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  }, []);

  useEffect(() => {
    const last = Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? 0);
    if (last && Date.now() - last > IDLE_LIMIT_MS) {
      onLockRef.current();
      return;
    }
    lastWrite.current = 0;
    touch();

    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
    events.forEach(e => window.addEventListener(e, touch, { passive: true, capture: true }));
    const id = window.setInterval(() => {
      const idle = Date.now() - Number(localStorage.getItem(LAST_ACTIVITY_KEY) ?? Date.now());
      const left = IDLE_LIMIT_MS - idle;
      setRemainingMs(left);
      if (left <= 0) onLockRef.current();
    }, 1_000);

    return () => {
      events.forEach(e => window.removeEventListener(e, touch, { capture: true }));
      window.clearInterval(id);
    };
  }, [touch]);

  const stayActive = () => {
    lastWrite.current = 0;
    touch();
    setRemainingMs(IDLE_LIMIT_MS);
  };

  return { remainingMs, stayActive };
}

export function AdminLayout() {
  const { adminUser, endSession } = useAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return (
      localStorage.getItem('admin-theme') === 'dark' ||
      (!localStorage.getItem('admin-theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches)
    );
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
      localStorage.setItem('admin-theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('admin-theme', 'light');
    }
    // The public site has no dark theme; don't leak it there.
    return () => root.classList.remove('dark');
  }, [isDark]);

  const lock = useCallback(async () => {
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    await endSession('The admin console locked after 15 minutes of inactivity. Sign in with Google to continue.');
    navigate('/admin', { replace: true });
  }, [endSession, navigate]);

  const { remainingMs, stayActive } = useIdleLock(lock);
  const current = NAV.find(n => location.pathname.startsWith(n.to));

  if (!adminUser) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-muted/40 text-foreground">
      <aside className="hidden w-64 shrink-0 lg:flex lg:flex-col">
        <SidebarNav role={adminUser.role} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 bg-background/80 px-4 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" aria-label="Open navigation">
                  <Menu size={18} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 border-0 p-0">
                <SidebarNav role={adminUser.role} onNav={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Dhanlakshmi Park Inn</p>
              <p className="font-serif text-lg leading-tight">{current?.label ?? 'Admin'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground sm:flex">
              <Lock size={12} className="text-primary" />
              Auto-lock in {Math.max(1, Math.ceil(remainingMs / 60_000))} min
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={() => setIsDark(d => !d)}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto max-w-7xl p-4 lg:p-8"
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        {remainingMs <= IDLE_WARNING_MS && remainingMs > 0 && (
          <motion.div
            role="alertdialog"
            aria-label="Admin console is about to lock"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-secondary/70 p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm rounded-3xl border border-border bg-card p-7 text-center shadow-elegant"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Still there?</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                For security, the console locks in{' '}
                <span className="font-semibold tabular-nums text-foreground">{Math.ceil(remainingMs / 1000)}s</span>.
              </p>
              <div className="mt-6 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={lock}>Lock now</Button>
                <Button className="flex-1" onClick={stayActive}>Stay signed in</Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
