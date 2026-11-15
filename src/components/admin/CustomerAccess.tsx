import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatDateTime } from '@/lib/exportUtils';
import { isValidEmail } from '@/lib/security';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Check, Clock, Search, ShieldCheck, UserPlus, UserX, X } from 'lucide-react';

type Status = 'pending' | 'approved' | 'rejected';

const TABS: { id: Status; label: string; icon: typeof Clock }[] = [
  { id: 'pending',  label: 'Requests', icon: Clock },
  { id: 'approved', label: 'Approved', icon: ShieldCheck },
  { id: 'rejected', label: 'Rejected', icon: UserX },
];

export function CustomerAccess() {
  const { adminUser, hasPermission } = useAdmin();
  const { log } = useAuditLog();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<Status>('pending');
  const [search, setSearch] = useState('');
  const [newEmail, setNewEmail] = useState('');

  const canManage = hasPermission('manage_users');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['customer-access'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_access')
        .select('*')
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const counts = useMemo(() => {
    const c: Record<Status, number> = { pending: 0, approved: 0, rejected: 0 };
    rows.forEach(r => { c[r.status as Status]++; });
    return c;
  }, [rows]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r =>
      r.status === tab &&
      (!q || r.email.includes(q) || (r.name ?? '').toLowerCase().includes(q))
    );
  }, [rows, tab, search]);

  const decide = useMutation({
    mutationFn: async ({ email, status }: { email: string; status: Status }) => {
      const { error } = await supabase
        .from('customer_access')
        .update({ status, decided_by: adminUser!.email, decided_at: new Date().toISOString() })
        .eq('email', email);
      if (error) throw error;
      return { email, status };
    },
    onSuccess: async ({ email, status }) => {
      await log({ action: `CUSTOMER_${status.toUpperCase()}`, resourceType: 'customer_access', resourceId: email });
      queryClient.invalidateQueries({ queryKey: ['customer-access'] });
      toast({ title: status === 'approved' ? 'Customer approved' : status === 'rejected' ? 'Request rejected' : 'Moved back to requests' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const preApprove = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.from('customer_access').upsert({
        email,
        status: 'approved',
        note: 'Added by admin',
        decided_by: adminUser!.email,
        decided_at: new Date().toISOString(),
      }, { onConflict: 'email' });
      if (error) throw error;
      return email;
    },
    onSuccess: async (email) => {
      await log({ action: 'CUSTOMER_APPROVED', resourceType: 'customer_access', resourceId: email });
      queryClient.invalidateQueries({ queryKey: ['customer-access'] });
      setNewEmail('');
      toast({ title: 'Customer approved', description: email });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const submitNew = (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      toast({ title: 'Enter a valid email', variant: 'destructive' });
      return;
    }
    preApprove.mutate(email);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Access control</p>
          <h1 className="mt-1 text-3xl font-semibold">Customer approvals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only approved customers can submit booking requests.
          </p>
        </div>
        {canManage && (
          <form onSubmit={submitNew} className="flex w-full gap-2 md:w-auto">
            <Input
              type="email"
              value={newEmail}
              maxLength={254}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="customer@gmail.com"
              className="h-10 md:w-64"
            />
            <Button type="submit" className="h-10 gap-1.5" disabled={preApprove.isPending}>
              <UserPlus size={15} /> Approve email
            </Button>
          </form>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-xl border border-border bg-muted/50 p-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all',
                tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon size={14} />
              {label}
              <span className={cn(
                'rounded-full px-1.5 text-[11px] tabular-nums',
                id === 'pending' && counts.pending > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/15'
              )}>
                {counts[id]}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name or email…"
            className="h-9 pl-8"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ShieldCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium">
              {tab === 'pending' ? 'No pending requests' : `No ${tab} customers`}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {tab === 'pending' && 'New requests appear here when customers ask to book.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map(r => (
              <li key={r.email} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent font-serif text-lg text-accent-foreground">
                    {(r.name || r.email)[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.name || '—'}</p>
                    <p className="truncate text-sm text-muted-foreground">{r.email}</p>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground sm:w-56">
                  {r.status === 'pending'
                    ? <>Requested {formatDateTime(r.requested_at)}</>
                    : <>{r.status === 'approved' ? 'Approved' : 'Rejected'} by {r.decided_by ?? '—'}<br />{r.decided_at ? formatDateTime(r.decided_at) : ''}</>}
                  {r.note && <span className="mt-0.5 block italic">{r.note}</span>}
                </div>
                {canManage && (
                  <div className="flex gap-2">
                    {r.status !== 'approved' && (
                      <Button
                        size="sm"
                        className="gap-1.5"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ email: r.email, status: 'approved' })}
                      >
                        <Check size={14} /> Approve
                      </Button>
                    )}
                    {r.status !== 'rejected' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                        disabled={decide.isPending}
                        onClick={() => decide.mutate({ email: r.email, status: 'rejected' })}
                      >
                        <X size={14} /> {r.status === 'approved' ? 'Revoke' : 'Reject'}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
