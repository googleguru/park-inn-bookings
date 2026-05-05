import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency, formatDate } from '@/lib/exportUtils';
import {
  CalendarDays, DollarSign, Clock, CheckCircle,
  TrendingUp, Users, AlertCircle, XCircle,
} from 'lucide-react';

interface Metric {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300' },
  approved: { label: 'Approved', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' },
  booked:   { label: 'Booked',   color: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' },
};

export function DashboardOverview() {
  const { data: bookings, isLoading: loadingBookings } = useQuery({
    queryKey: ['admin-bookings-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id,status,booking_date,event_type,name,email,amount,payment_status,created_at,updated_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: ledger, isLoading: loadingLedger } = useQuery({
    queryKey: ['admin-ledger-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('debit_amount,credit_amount,entry_type,created_at');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const today = new Date().toISOString().slice(0, 10);
  const nextMonth = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);

  const totalBookings = bookings?.length ?? 0;
  const pendingCount  = bookings?.filter(b => b.status === 'pending').length ?? 0;
  const approvedCount = bookings?.filter(b => b.status === 'approved').length ?? 0;
  const upcoming      = bookings?.filter(b => b.booking_date >= today && b.booking_date <= nextMonth).length ?? 0;

  const totalRevenue  = ledger?.reduce((s, e) => s + (e.debit_amount - e.credit_amount), 0) ?? 0;
  const totalPaid     = ledger?.filter(e => e.entry_type === 'payment').reduce((s, e) => s + e.debit_amount, 0) ?? 0;

  const metrics: Metric[] = [
    { label: 'Total Bookings', value: String(totalBookings), sub: `${pendingCount} pending`, icon: CalendarDays, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
    { label: 'Net Revenue',    value: formatCurrency(totalRevenue), sub: `${formatCurrency(totalPaid)} collected`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
    { label: 'Upcoming (30d)', value: String(upcoming), sub: 'Events this month', icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
    { label: 'Approved',       value: String(approvedCount), sub: 'Confirmed bookings', icon: CheckCircle, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  const recentBookings = bookings?.slice(0, 8) ?? [];

  const statusCounts = {
    pending:  bookings?.filter(b => b.status === 'pending').length  ?? 0,
    approved: bookings?.filter(b => b.status === 'approved').length ?? 0,
    booked:   bookings?.filter(b => b.status === 'booked').length   ?? 0,
    rejected: bookings?.filter(b => b.status === 'rejected').length ?? 0,
  };

  const isLoading = loadingBookings || loadingLedger;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of bookings and revenue</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-20 w-full" /></CardContent></Card>
            ))
          : metrics.map(m => (
              <Card key={m.label} className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{m.label}</p>
                      <p className="text-2xl font-bold mt-1">{m.value}</p>
                      {m.sub && <p className="text-xs text-muted-foreground mt-0.5">{m.sub}</p>}
                    </div>
                    <div className={`p-2.5 rounded-xl ${m.bg}`}>
                      <m.icon size={20} className={m.color} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Status breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users size={15} />
              Booking Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              Object.entries(statusCounts).map(([status, count]) => {
                const pct = totalBookings > 0 ? Math.round((count / totalBookings) * 100) : 0;
                const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
                const barColor = {
                  pending: 'bg-yellow-400', approved: 'bg-blue-500',
                  booked: 'bg-emerald-500', rejected: 'bg-red-400',
                }[status] ?? 'bg-gray-400';
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-muted-foreground text-xs">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Recent bookings */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock size={15} />
              Recent Bookings
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : recentBookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                <AlertCircle size={32} className="opacity-30" />
                <p className="text-sm">No bookings yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {recentBookings.map(b => {
                  const cfg = STATUS_CONFIG[b.status as keyof typeof STATUS_CONFIG];
                  return (
                    <div key={b.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{b.name ?? 'N/A'}</p>
                        <p className="text-xs text-muted-foreground">
                          {b.event_type} · {formatDate(b.booking_date)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-3 shrink-0">
                        {b.amount ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatCurrency(b.amount)}
                          </span>
                        ) : null}
                        <Badge className={`text-[10px] font-semibold border-0 ${cfg?.color ?? ''}`}>
                          {cfg?.label ?? b.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Pending Review', value: pendingCount, icon: Clock, color: 'text-yellow-600' },
          { label: 'Approved Today', value: bookings?.filter(b => b.status === 'approved' && b.updated_at?.slice(0,10) === today).length ?? 0, icon: CheckCircle, color: 'text-blue-600' },
          { label: 'Rejected', value: statusCounts.rejected, icon: XCircle, color: 'text-red-500' },
          { label: 'Fully Booked', value: statusCounts.booked, icon: CalendarDays, color: 'text-emerald-600' },
        ].map(s => (
          <Card key={s.label} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon size={20} className={s.color} />
              <div>
                <p className="text-lg font-bold">{isLoading ? '—' : s.value}</p>
                <p className="text-[11px] text-muted-foreground leading-tight">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
