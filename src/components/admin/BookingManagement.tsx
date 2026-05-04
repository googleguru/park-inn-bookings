import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatCurrency, formatDate, formatDateTime, exportToCSV } from '@/lib/exportUtils';
import { sanitizeInput } from '@/lib/security';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Search, Download, RefreshCw, Edit2, Trash2,
  ChevronLeft, ChevronRight, AlertCircle, Plus,
} from 'lucide-react';

type BookingStatus = 'pending' | 'approved' | 'rejected' | 'booked';
type PaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded' | 'cancelled';

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending:  'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  booked:   'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  pending:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  paid:      'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
  partial:   'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  refunded:  'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const editSchema = z.object({
  name:           z.string().min(2, 'Name required'),
  email:          z.string().email('Invalid email'),
  mobile:         z.string().min(10, 'Invalid mobile'),
  event_type:     z.string().min(1, 'Event type required'),
  guest_count:    z.coerce.number().min(1),
  time_slot:      z.string().min(1, 'Time slot required'),
  notes:          z.string().optional(),
  status:         z.enum(['pending','approved','rejected','booked']),
  payment_status: z.enum(['pending','paid','partial','refunded','cancelled']),
  amount:         z.coerce.number().min(0),
  advance_paid:   z.coerce.number().min(0),
});
type EditForm = z.infer<typeof editSchema>;

const PAGE_SIZE = 10;

export function BookingManagement() {
  const { hasPermission } = useAdmin();
  const { log } = useAuditLog();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: bookings = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return bookings.filter(b => {
      const matchSearch =
        !q ||
        b.name?.toLowerCase().includes(q) ||
        b.email?.toLowerCase().includes(q) ||
        b.mobile?.includes(q) ||
        b.event_type?.toLowerCase().includes(q) ||
        b.booking_date.includes(q);
      const matchStatus = statusFilter === 'all' || b.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [bookings, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const editTarget_ = bookings.find(b => b.id === editTarget);

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    values: editTarget_
      ? {
          name:           editTarget_.name ?? '',
          email:          editTarget_.email ?? '',
          mobile:         editTarget_.mobile ?? '',
          event_type:     editTarget_.event_type ?? '',
          guest_count:    editTarget_.guest_count ?? 0,
          time_slot:      editTarget_.time_slot ?? '',
          notes:          editTarget_.notes ?? '',
          status:         editTarget_.status,
          payment_status: (editTarget_.payment_status ?? 'pending') as PaymentStatus,
          amount:         editTarget_.amount ?? 0,
          advance_paid:   editTarget_.advance_paid ?? 0,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EditForm & { id: string }) => {
      const { id, ...rest } = data;
      const clean = {
        name:           sanitizeInput(rest.name),
        email:          rest.email,
        mobile:         rest.mobile,
        event_type:     rest.event_type,
        guest_count:    rest.guest_count,
        time_slot:      rest.time_slot,
        notes:          rest.notes ? sanitizeInput(rest.notes) : null,
        status:         rest.status,
        payment_status: rest.payment_status,
        amount:         rest.amount,
        advance_paid:   rest.advance_paid,
      };
      const { error } = await supabase.from('bookings').update(clean).eq('id', id);
      if (error) throw error;
      return { id, ...clean };
    },
    onSuccess: async (result) => {
      await log({ action: 'UPDATE_BOOKING', resourceType: 'booking', resourceId: result.id, newValues: result });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings-summary'] });
      setEditTarget(null);
      toast({ title: 'Booking updated' });
    },
    onError: (e: Error) => toast({ title: 'Update failed', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      await log({ action: 'DELETE_BOOKING', resourceType: 'booking', resourceId: id });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings'] });
      queryClient.invalidateQueries({ queryKey: ['admin-bookings-summary'] });
      setDeleteTarget(null);
      toast({ title: 'Booking deleted' });
    },
    onError: (e: Error) => toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }),
  });

  const handleExport = () => {
    exportToCSV(
      filtered.map(b => ({
        ID: b.id,
        Date: b.booking_date,
        Name: b.name,
        Email: b.email,
        Mobile: b.mobile,
        'Event Type': b.event_type,
        Guests: b.guest_count,
        'Time Slot': b.time_slot,
        Status: b.status,
        'Payment Status': b.payment_status,
        Amount: b.amount,
        'Advance Paid': b.advance_paid,
        Notes: b.notes,
        Created: b.created_at,
      })),
      'bookings'
    );
  };

  const canManage = hasPermission('manage_bookings');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} records</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1.5" />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download size={14} className="mr-1.5" />Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, email, mobile, event…"
            className="pl-8 h-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="booked">Booked</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['Date','Guest Name','Event','Guests','Status','Payment','Amount','Actions'].map(h => (
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
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    <AlertCircle size={28} className="mx-auto mb-2 opacity-30" />
                    No bookings found
                  </td>
                </tr>
              ) : (
                paged.map(b => (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap font-medium">{formatDate(b.booking_date)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-[140px]">{b.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[140px]">{b.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="whitespace-nowrap">{b.event_type ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{b.time_slot}</p>
                    </td>
                    <td className="px-4 py-3 text-center">{b.guest_count ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] border-0 ${STATUS_STYLE[b.status as BookingStatus] ?? ''}`}>
                        {b.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] border-0 ${PAYMENT_STYLE[(b.payment_status ?? 'pending') as PaymentStatus]}`}>
                        {b.payment_status ?? 'pending'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {b.amount ? formatCurrency(b.amount) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canManage && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setEditTarget(b.id)}
                            >
                              <Edit2 size={13} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => setDeleteTarget(b.id)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {filtered.length} results
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Booking</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(data => updateMutation.mutate({ id: editTarget!, ...data }))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                {(['name','email','mobile'] as const).map(field => (
                  <FormField key={field} control={form.control} name={field} render={({ field: f }) => (
                    <FormItem className={field === 'name' ? 'col-span-2 sm:col-span-1' : ''}>
                      <FormLabel className="capitalize">{field}</FormLabel>
                      <FormControl><Input {...f} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                ))}
                <FormField control={form.control} name="event_type" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Event Type</FormLabel>
                    <Select value={f.value} onValueChange={f.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {['Wedding','Reception','Birthday','Corporate','Anniversary','Other'].map(e => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="guest_count" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Guest Count</FormLabel>
                    <FormControl><Input type="number" {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="time_slot" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Time Slot</FormLabel>
                    <Select value={f.value} onValueChange={f.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {['Morning','Afternoon','Evening','Night','Full Day'].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Booking Status</FormLabel>
                    <Select value={f.value} onValueChange={f.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(['pending','approved','rejected','booked'] as const).map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="payment_status" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Payment Status</FormLabel>
                    <Select value={f.value} onValueChange={f.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(['pending','paid','partial','refunded','cancelled'] as const).map(s => (
                          <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Total Amount (₹)</FormLabel>
                    <FormControl><Input type="number" {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="advance_paid" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Advance Paid (₹)</FormLabel>
                    <FormControl><Input type="number" {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field: f }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea {...f} rows={3} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Booking?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This action cannot be undone. The booking record will be permanently removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget)}
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
