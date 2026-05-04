import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdmin } from '@/contexts/AdminContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import {
  LayoutDashboard, CalendarDays, DollarSign, Users,
  TrendingUp, ClipboardList, Settings, LogOut,
  Menu, Sun, Moon, Shield, ChevronRight,
} from 'lucide-react';

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  super_admin:     { label: 'Super Admin',     cls: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300' },
  admin:           { label: 'Admin',           cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
  finance_manager: { label: 'Finance Manager', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' },
};

const NAV = [
  { to: '/admin/dashboard',   label: 'Dashboard',        icon: LayoutDashboard, roles: ['super_admin','admin','finance_manager'] },
  { to: '/admin/bookings',    label: 'Bookings',         icon: CalendarDays,    roles: ['super_admin','admin'] },
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
    <div className="flex h-full flex-col bg-card border-r border-border">
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Shield size={16} className="text-primary-foreground" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none">Park Inn Admin</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Management Portal</p>
        </div>
      </div>

      {/* Profile */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={adminUser?.avatarUrl} alt={adminUser?.name} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
              {adminUser?.name?.[0]?.toUpperCase() ?? 'A'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate leading-none">{adminUser?.name}</p>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">{adminUser?.email}</p>
          </div>
        </div>
        {badge && (
          <span className={cn('mt-2 inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full', badge.cls)}>
            {badge.label}
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {allowed.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNav}
            className={({ isActive }) =>
              cn(
                'group flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150',
                isActive
                  ? 'bg-primary text-primary-foreground font-medium shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center gap-2.5">
                  <Icon size={16} />
                  {label}
                </span>
                {isActive && <ChevronRight size={14} className="opacity-70" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <Separator />
      <div className="p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={handleSignOut}
        >
          <LogOut size={16} />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

export function AdminLayout() {
  const { adminUser } = useAdmin();
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
  }, [isDark]);

  if (!adminUser) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:w-60 xl:w-64 shrink-0 flex-col">
        <SidebarNav role={adminUser.role} />
      </aside>

      {/* Body */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Top bar */}
        <header className="flex h-13 shrink-0 items-center justify-between border-b border-border bg-card px-4 py-2">
          <div className="flex items-center gap-3">
            {/* Mobile menu trigger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="lg:hidden h-8 w-8">
                  <Menu size={18} />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <SidebarNav role={adminUser.role} onNav={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="font-semibold text-sm hidden sm:inline">
              Dhanlakshmi Park Inn
            </span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsDark(d => !d)}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
          </Button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
