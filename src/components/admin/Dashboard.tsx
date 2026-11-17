import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, subMonths } from 'date-fns';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, CalendarCheck, CalendarClock, Inbox, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminData } from '@/contexts/AdminContext';
import { eventTypeLabel } from '@/lib/booking';
import { formatCurrency, formatDate } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';

const BOOKING_PAYMENT = 'Booking payment';
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-2xl border border-border bg-card shadow-soft', className)}>{children}</div>;
}

function Kpi({ icon: Icon, label, value, hint, tone }: {
  icon: typeof Wallet; label: string; value: string; hint: string; tone?: 'good' | 'bad';
}) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><Icon size={14} /></span>
        {label}
      </div>
      <p className={cn('mt-3 text-2xl font-semibold tabular-nums',
        tone === 'good' && 'text-emerald-600 dark:text-emerald-400', tone === 'bad' && 'text-rose-600 dark:text-rose-400')}>
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </Card>
  );
}

export function Dashboard() {
  const { data, isLoading, isError, refetch } = useAdminData();

  const stats = useMemo(() => {
    if (!data) return null;
    const today = format(new Date(), 'yyyy-MM-dd');
    const thisMonth = today.slice(0, 7);
    const lastMonth = format(subMonths(new Date(), 1), 'yyyy-MM');
    const byId = new Map(data.bookings.map(b => [b.id, b]));
    const total = (month: string, type: 'income' | 'expense') =>
      sum(data.money.filter(m => m.type === type && m.date.startsWith(month)).map(m => m.amount));

    const income = total(thisMonth, 'income');
    const expense = total(thisMonth, 'expense');
    const lastProfit = total(lastMonth, 'income') - total(lastMonth, 'expense');

    const months = Array.from({ length: 6 }, (_, i) => {
      const d = subMonths(new Date(), 5 - i);
      const key = format(d, 'yyyy-MM');
      return { month: format(d, 'MMM'), Income: total(key, 'income'), Expenses: total(key, 'expense') };
    });

    const bookingPayments = data.money.filter(m => m.type === 'income' && m.category === BOOKING_PAYMENT);
    const paidFor = (id: string) => sum(bookingPayments.filter(m => m.bookingId === id).map(m => m.amount));

    const confirmed = data.bookings.filter(b => b.status === 'confirmed');
    const upcoming = confirmed.filter(b => b.date >= today).sort((a, b) => a.date.localeCompare(b.date));

    const types = new Map<string, { count: number; income: number }>();
    confirmed.forEach(b => {
      const t = types.get(b.eventType) ?? { count: 0, income: 0 };
      t.count += 1;
      t.income += paidFor(b.id);
      types.set(b.eventType, t);
    });

    const customers = new Map<string, { name: string; total: number; events: number }>();
    bookingPayments.forEach(m => {
      const b = byId.get(m.bookingId);
      if (!b) return;
      const key = b.email.toLowerCase();
      const c = customers.get(key) ?? {
        name: b.name || b.email,
        total: 0,
        events: confirmed.filter(x => x.email.toLowerCase() === key).length,
      };
      c.total += m.amount;
      customers.set(key, c);
    });

    return {
      upcoming, paidFor, months, income, expense, profit: income - expense, lastProfit,
      pendingBookings: data.bookings.filter(b => b.status === 'pending').length,
      pendingCustomers: data.customers.filter(c => c.status === 'pending').length,
      topTypes: [...types.entries()].sort((a, b) => b[1].count - a[1].count || b[1].income - a[1].income).slice(0, 5),
      topCustomers: [...customers.values()].sort((a, b) => b.total - a.total).slice(0, 5),
    };
  }, [data]);

  const header = (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Overview</p>
      <h1 className="mt-1 text-3xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your bookings and money at a glance.</p>
    </div>
  );

  if (isError) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <AlertCircle className="text-rose-500" />
          <p className="text-sm text-muted-foreground">We could not load your data. Please check your internet and try again.</p>
          <Button onClick={() => refetch()}>Try again</Button>
        </Card>
      </div>
    );
  }

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const next = stats.upcoming[0];
  const diff = stats.profit - stats.lastProfit;
  const attention = [
    stats.pendingBookings > 0 && {
      to: '/admin/bookings', icon: Inbox, cta: 'Review',
      text: `${stats.pendingBookings} booking request${stats.pendingBookings > 1 ? 's' : ''} waiting for your reply`,
    },
    stats.pendingCustomers > 0 && {
      to: '/admin/customers', icon: CalendarClock, cta: 'Review',
      text: `${stats.pendingCustomers} customer${stats.pendingCustomers > 1 ? 's' : ''} waiting for approval`,
    },
  ].filter(Boolean) as { to: string; icon: typeof Inbox; text: string; cta: string }[];

  return (
    <div className="space-y-6">
      {header}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={CalendarCheck} label="Upcoming events" value={String(stats.upcoming.length)}
          hint={next ? `Next: ${formatDate(next.date)} · ${next.name}` : 'Nothing booked yet'} />
        <Kpi icon={Inbox} label="Requests waiting" value={String(stats.pendingBookings)}
          hint={`${stats.pendingCustomers} customer${stats.pendingCustomers === 1 ? '' : 's'} awaiting approval`} />
        <Kpi icon={TrendingUp} label="Income this month" value={formatCurrency(stats.income)} hint="Money received" />
        <Kpi icon={TrendingDown} label="Expenses this month" value={formatCurrency(stats.expense)} hint="Bills and costs" />
        <Kpi icon={Wallet} label="Profit this month" value={formatCurrency(stats.profit)}
          tone={stats.profit >= 0 ? 'good' : 'bad'}
          hint={`${diff >= 0 ? '▲' : '▼'} ${formatCurrency(Math.abs(diff))} ${diff >= 0 ? 'more' : 'less'} than last month`} />
      </div>

      <Card className="p-4 sm:p-6">
        <h2 className="text-xl font-semibold">Income and expenses</h2>
        <p className="text-sm text-muted-foreground">Last 6 months</p>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.months} margin={{ left: -10, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={56}
                tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} cursor={{ fill: 'hsl(var(--accent))' }}
                contentStyle={{ borderRadius: 12, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
              <Bar dataKey="Income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="hsl(0 60% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-4 sm:p-6 lg:col-span-3">
          <h2 className="text-xl font-semibold">Upcoming events</h2>
          {stats.upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No confirmed events coming up.</p>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {stats.upcoming.slice(0, 6).map(b => {
                const paid = stats.paidFor(b.id);
                const amount = typeof b.amount === 'number' ? b.amount : 0;
                return (
                  <li key={b.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{b.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(b.date)} · {eventTypeLabel(b.eventType)}{b.guests !== '' && ` · ${b.guests} guests`}
                      </p>
                    </div>
                    <div className="text-sm sm:text-right">
                      {amount > 0 ? (
                        <>
                          <p>Paid {formatCurrency(paid)} of {formatCurrency(amount)}</p>
                          <p className={cn('text-xs', paid >= amount ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')}>
                            {paid >= amount ? 'Fully paid' : `Balance ${formatCurrency(amount - paid)}`}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted-foreground">No amount set</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-4 sm:p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold">Needs your attention</h2>
          {attention.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">You are all caught up. Nothing is waiting for you.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {attention.map(a => (
                <li key={a.to}>
                  <Link to={a.to} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-accent/40 p-3 text-sm transition-colors hover:bg-accent">
                    <span className="flex items-center gap-2"><a.icon size={16} className="shrink-0 text-primary" />{a.text}</span>
                    <span className="font-medium text-primary">{a.cta}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold">Popular event types</h2>
          <p className="text-sm text-muted-foreground">By confirmed bookings</p>
          {stats.topTypes.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No confirmed bookings yet.</p> : (
            <ol className="mt-3 space-y-3">
              {stats.topTypes.map(([type, t], i) => (
                <li key={type} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-semibold">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{eventTypeLabel(type)}</p>
                    <p className="text-xs text-muted-foreground">{t.count} booking{t.count > 1 ? 's' : ''}</p>
                  </div>
                  <p className="text-sm tabular-nums">{formatCurrency(t.income)}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card className="p-4 sm:p-6">
          <h2 className="text-xl font-semibold">Top customers</h2>
          <p className="text-sm text-muted-foreground">By booking payments received</p>
          {stats.topCustomers.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No booking payments recorded yet.</p> : (
            <ol className="mt-3 space-y-3">
              {stats.topCustomers.map((c, i) => (
                <li key={c.name + i} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-semibold">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.events} confirmed event{c.events === 1 ? '' : 's'}</p>
                  </div>
                  <p className="text-sm tabular-nums">{formatCurrency(c.total)}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
