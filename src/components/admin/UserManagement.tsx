import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatDate, formatCurrency } from '@/lib/exportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Search, ShieldOff, ShieldCheck, Eye, AlertCircle, Users } from 'lucide-react';

const blockSchema = z.object({
  reason: z.string().min(5, 'Provide a reason for blocking'),
});

export function UserManagement() {
  const { adminUser, hasPermission } = useAdmin();
  const { log } = useAuditLog();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [blockTarget, setBlockTarget] = useState<{ email: string; name: string } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<string | null>(null);

  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ['admin-users-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id,name,email,mobile,booking_date,event_type,status,amount,payment_status,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: blocked = [], isLoading: loadingBlocked } = useQuery({
    queryKey: ['blocked-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data ?? [];
    },
  });

  const users = useMemo(() => {
    const map = new Map<string, {
      email: string; name: string; mobile: string;
      bookingCount: number; totalAmount: number;
      lastBooking: string; firstBooking: string;
    }>();
    for (const b of bookings) {
      if (!b.email) continue;
      const existing = map.get(b.email);
      if (existing) {
        existing.bookingCount++;
        existing.totalAmount += b.amount ?? 0;
        if (b.booking_date > existing.lastBooking) existing.lastBooking = b.booking_date;
        if (b.booking_date < existing.firstBooking) existing.firstBooking = b.booking_date;
      } else {
        map.set(b.email, {
          email: b.email,
          name: b.name ?? 'Unknown',
          mobile: b.mobile ?? '—',
          bookingCount: 1,
          totalAmount: b.amount ?? 0,
          lastBooking: b.booking_date,
          firstBooking: b.booking_date,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.bookingCount - a.bookingCount);
  }, [bookings]);

  const blockedEmails = new Set(blocked.map(b => b.email));

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.name.toLowerCase().includes(q) ||
      u.mobile.includes(q)
    );
  }, [users, search]);

  const form = useForm<z.infer<typeof blockSchema>>({
    resolver: zodResolver(blockSchema),
    defaultValues: { reason: '' },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ email, name, reason }: { email: string; name: string; reason: string }) => {
      const { error } = await supabase.from('blocked_users').upsert({
        email,
        name,
        reason,
        blocked_by: adminUser!.email,
        is_active: true,
        blocked_at: new Date().toISOString(),
        unblocked_at: null,
      }, { onConflict: 'email' });
      if (error) throw error;
    },
    onSuccess: async () => {
      await log({ action: 'BLOCK_USER', resourceType: 'user', resourceId: blockTarget?.email });
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      setBlockTarget(null);
      form.reset();
      toast({ title: 'User blocked' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const unblockMutation = useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase
        .from('blocked_users')
        .update({ is_active: false, unblocked_at: new Date().toISOString() })
        .eq('email', email);
      if (error) throw error;
      return email;
    },
    onSuccess: async (email) => {
      await log({ action: 'UNBLOCK_USER', resourceType: 'user', resourceId: email });
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      toast({ title: 'User unblocked' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const userHistory = useMemo(
    () => historyTarget ? bookings.filter(b => b.email === historyTarget) : [],
    [bookings, historyTarget]
  );

  const canManage = hasPermission('manage_users');
  const isLoading = loadingBookings || loadingBlocked;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} unique customers · {blocked.length} blocked</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search name, email, mobile…"
          className="pl-8 h-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['Customer','Mobile','Bookings','Total Spent','Last Booking','Status','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <Users size={28} className="mx-auto mb-2 opacity-30" />
                    No users found
                  </td>
                </tr>
              ) : (
                filtered.map(u => {
                  const isBlocked = blockedEmails.has(u.email);
                  return (
                    <tr key={u.email} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{u.mobile}</td>
                      <td className="px-4 py-3 text-center font-semibold">{u.bookingCount}</td>
                      <td className="px-4 py-3 font-medium">{formatCurrency(u.totalAmount)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(u.lastBooking)}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] border-0 ${isBlocked ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'}`}>
                          {isBlocked ? 'Blocked' : 'Active'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            title="View history"
                            onClick={() => setHistoryTarget(u.email)}
                          >
                            <Eye size={13} />
                          </Button>
                          {canManage && (
                            isBlocked ? (
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-green-600 hover:text-green-700"
                                title="Unblock user"
                                onClick={() => unblockMutation.mutate(u.email)}
                              >
                                <ShieldCheck size={13} />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                                title="Block user"
                                onClick={() => { setBlockTarget({ email: u.email, name: u.name }); form.reset(); }}
                              >
                                <ShieldOff size={13} />
                              </Button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Block dialog */}
      <Dialog open={!!blockTarget} onOpenChange={open => !open && setBlockTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block User</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Blocking <span className="font-medium text-foreground">{blockTarget?.email}</span> will prevent them from making new bookings.
          </p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(data => blockMutation.mutate({ email: blockTarget!.email, name: blockTarget!.name, reason: data.reason }))} className="space-y-4">
              <FormField control={form.control} name="reason" render={({ field: f }) => (
                <FormItem>
                  <FormLabel>Reason *</FormLabel>
                  <FormControl><Textarea {...f} rows={3} placeholder="Reason for blocking this user…" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setBlockTarget(null)}>Cancel</Button>
                <Button type="submit" variant="destructive" disabled={blockMutation.isPending}>
                  {blockMutation.isPending ? 'Blocking…' : 'Block User'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyTarget} onOpenChange={open => !open && setHistoryTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Booking History — {historyTarget}</DialogTitle>
          </DialogHeader>
          {userHistory.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <AlertCircle size={28} className="mx-auto mb-2 opacity-30" />
              No bookings found
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border">
                <tr>
                  {['Date','Event','Guests','Status','Amount'].map(h => (
                    <th key={h} className="py-2 px-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {userHistory.map(b => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="py-2 px-3 whitespace-nowrap">{formatDate(b.booking_date)}</td>
                    <td className="py-2 px-3">{b.event_type ?? '—'}</td>
                    <td className="py-2 px-3 text-center">—</td>
                    <td className="py-2 px-3">
                      <Badge className="text-[10px] border-0 bg-muted text-foreground capitalize">{b.status}</Badge>
                    </td>
                    <td className="py-2 px-3">{b.amount ? formatCurrency(b.amount) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
