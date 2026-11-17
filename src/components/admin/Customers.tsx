import { useMemo, useState } from 'react';
import { Ban, Check, Clock, Search, ShieldCheck, UserPlus, UserX, X } from 'lucide-react';
import { useAdminAction, useAdminData } from '@/contexts/AdminContext';
import type { Customer } from '@/lib/api';
import { formatDateTime } from '@/lib/exportUtils';
import { isValidEmail } from '@/lib/security';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type Status = Customer['status'];

const TABS: { id: Status; label: string; icon: typeof Clock }[] = [
  { id: 'pending',  label: 'Requests', icon: Clock },
  { id: 'approved', label: 'Approved', icon: ShieldCheck },
  { id: 'rejected', label: 'Rejected', icon: UserX },
  { id: 'blocked',  label: 'Blocked',  icon: Ban },
];

export function Customers() {
  const { data, isLoading } = useAdminData();
  const action = useAdminAction();
  const { toast } = useToast();
  const [tab, setTab] = useState<Status>('pending');
  const [search, setSearch] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');

  const customers = useMemo(() => data?.customers ?? [], [data]);
  const bookingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.bookings ?? []).forEach((b) => { if (b.email) counts[b.email] = (counts[b.email] ?? 0) + 1; });
    return counts;
  }, [data]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = { pending: 0, approved: 0, rejected: 0, blocked: 0 };
    customers.forEach((r) => { if (r.status in c) c[r.status]++; });
    return c;
  }, [customers]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers
      .filter((r) => r.status === tab && (!q || [r.email, r.name, r.mobile].some((v) => String(v).toLowerCase().includes(q))))
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  }, [customers, tab, search]);

  const run = async (name: string, payload: Record<string, unknown>, success: string) => {
    try {
      await action.mutateAsync({ action: name, payload });
      toast({ title: success });
      return true;
    } catch (err) {
      toast({ title: 'Could not save', description: (err as Error).message, variant: 'destructive' });
      return false;
    }
  };

  const decide = (email: string, status: Status, message: string) => run('customerDecide', { email, status }, message);

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      toast({ title: 'Enter a valid email', variant: 'destructive' });
      return;
    }
    if (await run('customerAdd', { email, name: newName.trim() }, 'Customer approved')) {
      setNewEmail('');
      setNewName('');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Access control</p>
          <h1 className="mt-1 text-3xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only approved customers can send booking requests. Approved customers get an email.
          </p>
        </div>
        <form onSubmit={submitNew} className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
          <Input value={newName} maxLength={100} onChange={(e) => setNewName(e.target.value)} placeholder="Name (optional)" className="h-10 sm:w-40" />
          <Input type="email" value={newEmail} maxLength={254} onChange={(e) => setNewEmail(e.target.value)} placeholder="customer@gmail.com" className="h-10 sm:w-60" />
          <Button type="submit" className="h-10 gap-1.5" disabled={action.isPending}>
            <UserPlus size={15} /> Approve email
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all',
                tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon size={14} />
              {label}
              <span className={cn(
                'rounded-full px-1.5 text-[11px] tabular-nums',
                id === 'pending' && counts.pending > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/15',
              )}>{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, email, mobile…" className="h-9 pl-8" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium">{tab === 'pending' ? 'No pending requests' : `No ${tab} customers`}</p>
            {tab === 'pending' && (
              <p className="mt-1 text-sm text-muted-foreground">New requests appear here when customers ask to book.</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((r) => (
              <li key={r.email} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-serif text-lg text-accent-foreground">
                    {(r.name || r.email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name || '—'}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {r.email}{r.mobile ? ` · ${r.mobile}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground sm:w-60">
                  {r.status === 'pending'
                    ? <>Requested {r.requestedAt ? formatDateTime(r.requestedAt) : '—'}</>
                    : <>{r.status[0].toUpperCase() + r.status.slice(1)} by {r.decidedBy || '—'}{r.decidedAt ? ` · ${formatDateTime(r.decidedAt)}` : ''}</>}
                  <span className="block">{bookingCounts[r.email] ?? 0} booking{bookingCounts[r.email] === 1 ? '' : 's'}</span>
                  {r.note && <span className="block italic">{r.note}</span>}
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status !== 'approved' && r.status !== 'blocked' && (
                    <Button size="sm" className="gap-1.5" disabled={action.isPending} onClick={() => decide(r.email, 'approved', 'Customer approved')}>
                      <Check size={14} /> Approve
                    </Button>
                  )}
                  {r.status === 'pending' && (
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={action.isPending} onClick={() => decide(r.email, 'rejected', 'Request rejected')}>
                      <X size={14} /> Reject
                    </Button>
                  )}
                  {r.status === 'blocked' ? (
                    <Button size="sm" variant="outline" className="gap-1.5" disabled={action.isPending} onClick={() => decide(r.email, 'approved', 'Customer unblocked')}>
                      <ShieldCheck size={14} /> Unblock
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                      disabled={action.isPending}
                      onClick={() => decide(r.email, 'blocked', 'Customer blocked')}
                    >
                      <Ban size={14} /> Block
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
