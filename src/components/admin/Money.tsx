import { useMemo, useState } from 'react';
import { format, subMonths } from 'date-fns';
import { AlertCircle, Download, Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAdmin, useAdminAction, useAdminData } from '@/contexts/AdminContext';
import { ApiError, type MoneyEntry, type MoneyType } from '@/lib/api';
import { MONEY_CATEGORIES, eventTypeLabel } from '@/lib/booking';
import { exportToCSV, formatCurrency, formatDate } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';

const ALL = 'all';
const BOOKING_PAYMENT = 'Booking payment';
const ALL_CATEGORIES = [...MONEY_CATEGORIES.income, ...MONEY_CATEGORIES.expense];
const sum = (xs: MoneyEntry[]) => xs.reduce((a, m) => a + m.amount, 0);
const today = () => format(new Date(), 'yyyy-MM-dd');

function monthOptions() {
  return Array.from({ length: 24 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
  });
}

export function Money() {
  const { data, isLoading, isError, refetch } = useAdminData();
  const { isSuper } = useAdmin();
  const action = useAdminAction();
  const { toast } = useToast();

  const [month, setMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL);
  const [adding, setAdding] = useState<MoneyType | null>(null);
  const [deleting, setDeleting] = useState<MoneyEntry | null>(null);

  const months = useMemo(monthOptions, []);
  const bookings = useMemo(() => data?.bookings ?? [], [data]);
  const bookingName = (id: string) => bookings.find(b => b.id === id)?.name ?? '';

  const inPeriod = useMemo(
    () => (data?.money ?? []).filter(m => month === ALL || m.date.startsWith(month)),
    [data, month],
  );
  const filtered = useMemo(
    () => inPeriod
      .filter(m => (typeFilter === ALL || m.type === typeFilter) && (categoryFilter === ALL || m.category === categoryFilter))
      .sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt)),
    [inPeriod, typeFilter, categoryFilter],
  );

  const income = sum(inPeriod.filter(m => m.type === 'income'));
  const expense = sum(inPeriod.filter(m => m.type === 'expense'));
  const categoryTotals = ALL_CATEGORIES.map(c => ({ name: c, total: sum(inPeriod.filter(m => m.category === c)) }));
  const maxTotal = Math.max(1, ...categoryTotals.map(c => c.total));
  const incomeCats: readonly string[] = MONEY_CATEGORIES.income;

  const fail = (e: unknown) =>
    toast({ title: 'Could not save', description: e instanceof ApiError || e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });

  const remove = async () => {
    if (!deleting) return;
    try {
      await action.mutateAsync({ action: 'moneyDelete', payload: { id: deleting.id } });
      toast({ title: 'Entry deleted' });
      setDeleting(null);
    } catch (e) {
      fail(e);
    }
  };

  const download = () => {
    if (!filtered.length) {
      toast({ title: 'Nothing to download', description: 'There are no entries for this selection.' });
      return;
    }
    exportToCSV(
      filtered.map(m => ({
        Date: m.date,
        Type: m.type === 'income' ? 'Income' : 'Expense',
        Category: m.category,
        Amount: m.amount,
        'Linked booking': bookingName(m.bookingId),
        Description: m.description,
        'Recorded by': m.recordedBy,
      })),
      `money_${month}`,
    );
  };

  const categoryOptions = typeFilter === ALL ? ALL_CATEGORIES : MONEY_CATEGORIES[typeFilter as MoneyType];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">Accounts</p>
          <h1 className="mt-1 text-3xl font-semibold">Income &amp; expenses</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything here is also saved in the Money tab of your Google Sheet.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setAdding('income')} className="flex-1 sm:flex-none"><Plus size={16} /> Add income</Button>
          <Button variant="outline" onClick={() => setAdding('expense')} className="flex-1 sm:flex-none"><Minus size={16} /> Add expense</Button>
        </div>
      </div>

      {isError ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card p-8 text-center shadow-soft">
          <AlertCircle className="text-rose-500" />
          <p className="text-sm text-muted-foreground">We could not load your money records. Please try again.</p>
          <Button onClick={() => refetch()}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <div className="grid grid-cols-1 gap-3 sm:col-span-3 sm:grid-cols-4">
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger aria-label="Month"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All time</SelectItem>
                  {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setCategoryFilter(ALL); }}>
                <SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Income and expenses</SelectItem>
                  <SelectItem value="income">Income only</SelectItem>
                  <SelectItem value="expense">Expenses only</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger aria-label="Category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All categories</SelectItem>
                  {categoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={download}><Download size={15} /> Download CSV</Button>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-3">{[0, 1, 2].map(i => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                {[
                  { label: 'Total income', value: income, cls: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Total expenses', value: expense, cls: 'text-rose-600 dark:text-rose-400' },
                  { label: 'Profit', value: income - expense, cls: income - expense >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400' },
                ].map(c => (
                  <div key={c.label} className="rounded-2xl border border-border bg-card p-5 shadow-soft">
                    <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                    <p className={cn('mt-2 text-2xl font-semibold tabular-nums', c.cls)}>{formatCurrency(c.value)}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-soft sm:p-6">
                <h2 className="text-xl font-semibold">Where the money goes</h2>
                <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                  {categoryTotals.map(c => {
                    const isIncome = incomeCats.includes(c.name);
                    return (
                      <li key={c.name}>
                        <div className="flex justify-between gap-2 text-sm">
                          <span>{c.name}</span>
                          <span className="font-medium tabular-nums">{formatCurrency(c.total)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', isIncome ? 'bg-primary' : 'bg-rose-400')}
                            style={{ width: `${(c.total / maxTotal) * 100}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card shadow-soft">
                {filtered.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    No entries yet for this selection. Use “Add income” or “Add expense” to record one.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {filtered.map(m => {
                      const inc = m.type === 'income';
                      const linked = bookingName(m.bookingId);
                      return (
                        <li key={m.id} className="flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-2 text-sm">
                              <span className="font-medium">{m.category}</span>
                              <span className="text-xs text-muted-foreground">{formatDate(m.date)}</span>
                            </div>
                            {(m.description || linked) && (
                              <p className="break-words text-sm text-muted-foreground">
                                {linked && <>For {linked}{m.description && ' · '}</>}{m.description}
                              </p>
                            )}
                            {m.recordedBy && <p className="text-xs text-muted-foreground">Recorded by {m.recordedBy}</p>}
                          </div>
                          <p className={cn('shrink-0 text-right font-semibold tabular-nums', inc ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                            {inc ? '+' : '−'} {formatCurrency(m.amount)}
                          </p>
                          {isSuper && (
                            <Button variant="ghost" size="icon" aria-label={`Delete ${m.category} entry`} onClick={() => setDeleting(m)}>
                              <Trash2 size={16} />
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </>
      )}

      {adding && (
        <AddDialog
          key={adding}
          type={adding}
          onClose={() => setAdding(null)}
          bookings={bookings.filter(b => b.status === 'confirmed' || b.status === 'pending')}
          pending={action.isPending}
          onSave={async payload => {
            try {
              await action.mutateAsync({ action: 'moneyAdd', payload });
              toast({ title: adding === 'income' ? 'Income saved' : 'Expense saved' });
              setAdding(null);
            } catch (e) {
              fail(e);
            }
          }}
        />
      )}

      <Dialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this entry?</DialogTitle>
            <DialogDescription>
              {deleting && `${deleting.category} · ${formatCurrency(deleting.amount)} on ${formatDate(deleting.date)}. This cannot be undone.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button variant="destructive" disabled={action.isPending} onClick={remove}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface AddDialogProps {
  type: MoneyType;
  bookings: { id: string; date: string; name: string; eventType: string }[];
  pending: boolean;
  onClose: () => void;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
}

function AddDialog({ type, bookings, pending, onClose, onSave }: AddDialogProps) {
  const categories = MONEY_CATEGORIES[type];
  const [date, setDate] = useState(today());
  const [category, setCategory] = useState(categories[0]);
  const [amount, setAmount] = useState('');
  const [bookingId, setBookingId] = useState('none');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!date) return setError('Please choose a date.');
    if (!amount || !Number.isFinite(value) || value <= 0) return setError('Please enter an amount greater than 0.');
    setError('');
    const payload: Record<string, unknown> = { date, type, category, amount: value };
    if (category === BOOKING_PAYMENT && bookingId !== 'none') payload.bookingId = bookingId;
    if (description.trim()) payload.description = description.trim();
    void onSave(payload);
  };

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{type === 'income' ? 'Add income' : 'Add expense'}</DialogTitle>
          <DialogDescription>
            {type === 'income' ? 'Record money you received.' : 'Record a bill or cost you paid.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="money-date">Date</Label>
              <Input id="money-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="money-amount">Amount (₹)</Label>
              <Input id="money-amount" type="number" inputMode="decimal" min="0" step="any" placeholder="0"
                value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="money-category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger id="money-category"><SelectValue /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {category === BOOKING_PAYMENT && (
            <div className="space-y-1.5">
              <Label htmlFor="money-booking">Linked booking (optional)</Label>
              <Select value={bookingId} onValueChange={setBookingId}>
                <SelectTrigger id="money-booking"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not linked to a booking</SelectItem>
                  {bookings.map(b => (
                    <SelectItem key={b.id} value={b.id}>{formatDate(b.date)} · {b.name} · {eventTypeLabel(b.eventType)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="money-desc">Note (optional)</Label>
            <Textarea id="money-desc" rows={2} maxLength={300} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
