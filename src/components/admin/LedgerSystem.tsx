import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatCurrency, formatDateTime, exportToCSV } from '@/lib/exportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Download, RefreshCw, Plus, Search,
  ChevronLeft, ChevronRight, AlertCircle,
  TrendingUp, TrendingDown, DollarSign,
} from 'lucide-react';

type EntryType = 'booking' | 'payment' | 'advance' | 'refund' | 'adjustment';
type PaymentMethod = 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'online';

const ENTRY_STYLE: Record<EntryType, string> = {
  booking:    'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  payment:    'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  advance:    'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  refund:     'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  adjustment: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
};

const addSchema = z.object({
  entry_type:      z.enum(['booking','payment','advance','refund','adjustment']),
  description:     z.string().min(3, 'Description required'),
  user_email:      z.string().email('Invalid email').optional().or(z.literal('')),
  user_name:       z.string().optional(),
  event_type:      z.string().optional(),
  debit_amount:    z.coerce.number().min(0),
  credit_amount:   z.coerce.number().min(0),
  payment_method:  z.string().optional(),
  reference_number:z.string().optional(),
  notes:           z.string().optional(),
});
type AddForm = z.infer<typeof addSchema>;

const PAGE_SIZE = 15;

export function LedgerSystem() {
  const { adminUser, hasPermission } = useAdmin();
  const { log } = useAuditLog();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  const { data: rawEntries = [], isLoading, refetch } = useQuery({
    queryKey: ['ledger-entries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ledger_entries')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Compute running balance client-side (append-only ledger)
  const entries = useMemo(() => {
    let balance = 0;
    return rawEntries.map(e => {
      balance += e.debit_amount - e.credit_amount;
      return { ...e, running_balance: balance };
    });
  }, [rawEntries]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter(e => {
      const matchSearch =
        !q ||
        e.description.toLowerCase().includes(q) ||
        e.user_email?.toLowerCase().includes(q) ||
        e.user_name?.toLowerCase().includes(q) ||
        e.reference_number?.toLowerCase().includes(q);
      const matchType = typeFilter === 'all' || e.entry_type === typeFilter;
      const matchFrom = !dateFrom || e.created_at >= dateFrom;
      const matchTo   = !dateTo   || e.created_at.slice(0,10) <= dateTo;
      return matchSearch && matchType && matchFrom && matchTo;
    }).reverse(); // Most recent first for display
  }, [entries, search, typeFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalDebit  = entries.reduce((s, e) => s + e.debit_amount, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit_amount, 0);
  const netBalance  = totalDebit - totalCredit;

  const form = useForm<AddForm>({
    resolver: zodResolver(addSchema),
    defaultValues: {
      entry_type: 'payment', description: '',
      debit_amount: 0, credit_amount: 0,
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: AddForm) => {
      const balance = netBalance + data.debit_amount - data.credit_amount;
      const { error } = await supabase.from('ledger_entries').insert({
        entry_type:       data.entry_type,
        description:      data.description,
        user_email:       data.user_email || null,
        user_name:        data.user_name || null,
        event_type:       data.event_type || null,
        debit_amount:     data.debit_amount,
        credit_amount:    data.credit_amount,
        running_balance:  balance,
        payment_method:   (data.payment_method || null) as PaymentMethod | null,
        reference_number: data.reference_number || null,
        notes:            data.notes || null,
        created_by:       adminUser!.email,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await log({ action: 'ADD_LEDGER_ENTRY', resourceType: 'ledger_entry' });
      queryClient.invalidateQueries({ queryKey: ['ledger-entries'] });
      setAddOpen(false);
      form.reset();
      toast({ title: 'Ledger entry added' });
    },
    onError: (e: Error) => toast({ title: 'Failed to add entry', description: e.message, variant: 'destructive' }),
  });

  const handleExport = () => {
    exportToCSV(
      filtered.map(e => ({
        Date:             e.created_at,
        Type:             e.entry_type,
        Description:      e.description,
        User:             e.user_name ?? e.user_email ?? '',
        'Event Type':     e.event_type ?? '',
        'Event Date':     e.event_date ?? '',
        'Debit (Dr)':     e.debit_amount,
        'Credit (Cr)':    e.credit_amount,
        'Running Balance':e.running_balance,
        'Payment Method': e.payment_method ?? '',
        Reference:        e.reference_number ?? '',
        'Created By':     e.created_by,
      })),
      'ledger'
    );
  };

  const canManage = hasPermission('manage_ledger');

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Financial Ledger</h1>
          <p className="text-sm text-muted-foreground">Double-entry accounting record</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1.5" />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download size={14} className="mr-1.5" />Export CSV
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus size={14} className="mr-1.5" />Add Entry
            </Button>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Debits (Dr)', value: formatCurrency(totalDebit),  icon: TrendingUp,   color: 'text-emerald-600', bg: 'bg-emerald-100 dark:bg-emerald-900/30' },
          { label: 'Total Credits (Cr)', value: formatCurrency(totalCredit), icon: TrendingDown, color: 'text-red-500',     bg: 'bg-red-100 dark:bg-red-900/30' },
          { label: 'Net Balance',        value: formatCurrency(netBalance),  icon: DollarSign,   color: netBalance >= 0 ? 'text-blue-600' : 'text-red-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
        ].map(s => (
          <Card key={s.label} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`p-3 rounded-xl ${s.bg}`}>
                <s.icon size={20} className={s.color} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-xl font-bold mt-0.5">{isLoading ? '…' : s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search description, user, reference…"
            className="pl-8 h-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {(['booking','payment','advance','refund','adjustment'] as EntryType[]).map(t => (
              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" className="w-40 h-9" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type="date" className="w-40 h-9" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPage(1); }} />
      </div>

      {/* Ledger table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['Date & Time','Type','Description','User','Dr (↑)','Cr (↓)','Balance','Method','Ref'].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <AlertCircle size={28} className="mx-auto mb-2 opacity-30" />
                    No ledger entries found
                  </td>
                </tr>
              ) : (
                paged.map(e => (
                  <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-3 whitespace-nowrap text-xs">{formatDateTime(e.created_at)}</td>
                    <td className="px-3 py-3">
                      <Badge className={`text-[10px] border-0 capitalize ${ENTRY_STYLE[e.entry_type as EntryType] ?? ''}`}>
                        {e.entry_type}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium max-w-[160px] truncate">{e.description}</p>
                      {e.notes && <p className="text-xs text-muted-foreground truncate max-w-[160px]">{e.notes}</p>}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs truncate max-w-[120px]">{e.user_name ?? e.user_email ?? '—'}</p>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-emerald-600 whitespace-nowrap">
                      {e.debit_amount > 0 ? formatCurrency(e.debit_amount) : '—'}
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-red-500 whitespace-nowrap">
                      {e.credit_amount > 0 ? formatCurrency(e.credit_amount) : '—'}
                    </td>
                    <td className={`px-3 py-3 text-right font-bold whitespace-nowrap ${e.running_balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                      {formatCurrency(e.running_balance)}
                    </td>
                    <td className="px-3 py-3 text-xs capitalize text-muted-foreground whitespace-nowrap">
                      {e.payment_method ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {e.reference_number ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {!isLoading && paged.length > 0 && (
              <tfoot className="bg-muted/30 border-t-2 border-border">
                <tr>
                  <td colSpan={4} className="px-3 py-3 text-xs font-semibold text-muted-foreground uppercase">
                    Page Total ({filtered.length} entries)
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-emerald-600 whitespace-nowrap">
                    {formatCurrency(filtered.reduce((s, e) => s + e.debit_amount, 0))}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-red-500 whitespace-nowrap">
                    {formatCurrency(filtered.reduce((s, e) => s + e.credit_amount, 0))}
                  </td>
                  <td className={`px-3 py-3 text-right font-bold whitespace-nowrap ${netBalance >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                    {formatCurrency(netBalance)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages} · {filtered.length} entries
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

      {/* Add entry dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Ledger Entry</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(data => addMutation.mutate(data))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="entry_type" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Entry Type</FormLabel>
                    <Select value={f.value} onValueChange={f.onChange}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(['booking','payment','advance','refund','adjustment'] as EntryType[]).map(t => (
                          <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="payment_method" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select value={f.value} onValueChange={f.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {(['cash','card','upi','bank_transfer','cheque','online'] as PaymentMethod[]).map(m => (
                          <SelectItem key={m} value={m} className="capitalize">{m.replace('_',' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field: f }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Description *</FormLabel>
                    <FormControl><Input {...f} placeholder="e.g. Advance payment for wedding booking" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="debit_amount" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Debit Amount ₹ (Dr)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="credit_amount" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Credit Amount ₹ (Cr)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="user_name" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Customer Name</FormLabel>
                    <FormControl><Input {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="user_email" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Customer Email</FormLabel>
                    <FormControl><Input {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="reference_number" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Reference #</FormLabel>
                    <FormControl><Input {...f} placeholder="TXN/INV/CHQ number" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="event_type" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Event Type</FormLabel>
                    <Select value={f.value} onValueChange={f.onChange}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {['Wedding','Reception','Birthday','Corporate','Anniversary','Other'].map(e => (
                          <SelectItem key={e} value={e}>{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="notes" render={({ field: f }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea {...f} rows={2} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm flex justify-between">
                <span className="text-muted-foreground">New balance after entry:</span>
                <span className="font-bold">
                  {formatCurrency(netBalance + (form.watch('debit_amount') || 0) - (form.watch('credit_amount') || 0))}
                </span>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? 'Adding…' : 'Add Entry'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
