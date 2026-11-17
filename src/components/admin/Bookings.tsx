import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Ban, CalendarPlus, Check, Download, Edit2, IndianRupee, Loader2, Lock, Plus, RefreshCw, Search, Trash2, Unlock, X,
} from 'lucide-react';
import { useAdmin, useAdminAction, useAdminData } from '@/contexts/AdminContext';
import type { Booking, BookingStatus, MoneyEntry } from '@/lib/api';
import { BOOKING_STATUS, EVENT_TYPES, TIME_SLOTS, eventTypeLabel, slotLabel } from '@/lib/booking';
import { exportToCSV, formatCurrency, formatDate } from '@/lib/exportUtils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

type Tab = 'requests' | 'upcoming' | 'past' | 'closed' | 'all';

const today = () => format(new Date(), 'yyyy-MM-dd');

const TABS: { id: Tab; label: string; match: (b: Booking, t: string) => boolean }[] = [
  { id: 'requests', label: 'Requests', match: (b) => b.status === 'pending' },
  { id: 'upcoming', label: 'Upcoming', match: (b, t) => b.status === 'confirmed' && b.date >= t },
  { id: 'past',     label: 'Past',     match: (b, t) => b.status === 'confirmed' && b.date < t },
  { id: 'closed',   label: 'Rejected / cancelled', match: (b) => b.status === 'rejected' || b.status === 'cancelled' },
  { id: 'all',      label: 'All',      match: () => true },
];

interface FormState {
  date: string; slot: string; eventType: string; guests: string; name: string; email: string;
  mobile: string; notes: string; status: BookingStatus; amount: string; adminNote: string;
}

const toForm = (b?: Booking): FormState => ({
  date: b?.date ?? today(), slot: b?.slot ?? 'fullday', eventType: b?.eventType ?? 'wedding',
  guests: b?.guests ? String(b.guests) : '', name: b?.name ?? '', email: b?.email ?? '', mobile: b?.mobile ?? '',
  notes: b?.notes ?? '', status: b?.status ?? 'pending', amount: b?.amount === '' || b?.amount === undefined ? '' : String(b.amount),
  adminNote: b?.adminNote ?? '',
});

function paidFor(money: MoneyEntry[], bookingId: string) {
  return money
    .filter((m) => m.bookingId === bookingId && m.type === 'income' && m.category === 'Booking payment')
    .reduce((sum, m) => sum + Number(m.amount || 0), 0);
}

export function Bookings() {
  const { data, isLoading, isError, refetch } = useAdminData();
  const action = useAdminAction();
  const { isSuper } = useAdmin();
  const { toast } = useToast();

  const [tab, setTab] = useState<Tab>('requests');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Booking | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(toForm());
  const [paying, setPaying] = useState<Booking | null>(null);
  const [payment, setPayment] = useState({ amount: '', date: today(), description: '' });
  const [deleting, setDeleting] = useState<Booking | null>(null);

  const bookings = useMemo(() => data?.bookings ?? [], [data]);
  const money = useMemo(() => data?.money ?? [], [data]);
  const t = today();

  const counts = useMemo(
    () => Object.fromEntries(TABS.map(({ id, match }) => [id, bookings.filter((b) => match(b, t)).length])) as Record<Tab, number>,
    [bookings, t],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = TABS.find((x) => x.id === tab)!.match;
    return bookings
      .filter((b) => match(b, t))
      .filter((b) => !q || [b.name, b.email, b.mobile, b.id, b.date, eventTypeLabel(b.eventType)].some((v) => String(v).toLowerCase().includes(q)))
      .sort((a, b) => (tab === 'past' || tab === 'closed' || tab === 'all' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)));
  }, [bookings, tab, search, t]);

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

  const openEdit = (b: Booking | 'new') => {
    setForm(toForm(b === 'new' ? undefined : b));
    setEditing(b);
  };

  const saveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const fields = {
      date: form.date, slot: form.slot, eventType: form.eventType, guests: Number(form.guests), name: form.name.trim(),
      email: form.email.trim(), mobile: form.mobile.trim(), notes: form.notes.trim(),
    };
    const ok = editing === 'new'
      ? await run('bookingCreate', { ...fields, status: form.status, amount: form.amount, adminNote: form.adminNote }, 'Booking added')
      : await run('bookingUpdate', {
          id: editing.id,
          changes: coreLocked
            ? { amount: form.amount, adminNote: form.adminNote }
            : { ...fields, status: form.status, amount: form.amount, adminNote: form.adminNote },
        }, 'Booking updated');
    if (ok) setEditing(null);
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paying) return;
    const amount = Number(payment.amount);
    if (!(amount > 0)) {
      toast({ title: 'Enter the amount received', variant: 'destructive' });
      return;
    }
    const ok = await run('moneyAdd', {
      type: 'income', category: 'Booking payment', amount, date: payment.date, bookingId: paying.id,
      description: payment.description.trim() || `Payment from ${paying.name}`,
    }, 'Payment recorded');
    if (ok) setPaying(null);
  };

  const exportCsv = () => exportToCSV(visible.map((b) => ({
    'Booking ID': b.id, 'Event date': b.date, 'Time slot': slotLabel(b.slot), 'Event type': eventTypeLabel(b.eventType),
    Guests: b.guests, Name: b.name, Email: b.email, Mobile: b.mobile, Status: BOOKING_STATUS[b.status]?.label ?? b.status,
    Locked: b.locked ? 'Yes' : 'No', 'Total amount': b.amount, Paid: paidFor(money, b.id), Notes: b.notes, 'Admin note': b.adminNote,
  })), 'bookings');

  const editingBooking = editing && editing !== 'new' ? editing : null;
  const coreLocked = !!editingBooking?.locked && !isSuper;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Bookings</p>
          <h1 className="mt-1 text-3xl font-semibold">Bookings & requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirming a booking locks the date and adds it to your Google Calendar.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-1.5" onClick={() => openEdit('new')}><Plus size={15} /> Add booking</Button>
          <Button
            variant="outline"
            className="gap-1.5"
            disabled={action.isPending}
            onClick={() => run('calendarSync', {}, 'Google Calendar is in sync')}
          >
            <RefreshCw size={15} className={cn(action.isPending && 'animate-spin')} /> Sync calendar
          </Button>
          <Button variant="outline" className="gap-1.5" onClick={exportCsv} disabled={!visible.length}>
            <Download size={15} /> CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-muted/50 p-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all',
                tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
              <span className={cn(
                'rounded-full px-1.5 text-[11px] tabular-nums',
                id === 'requests' && counts.requests > 0 ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/15',
              )}>{counts[id]}</span>
            </button>
          ))}
        </div>
        <div className="relative lg:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, mobile, date…" className="h-9 pl-8" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {isLoading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : isError ? (
          <div className="px-6 py-16 text-center">
            <p className="font-medium">Could not load bookings.</p>
            <Button variant="outline" className="mt-4" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <CalendarPlus className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
            <p className="font-medium">{tab === 'requests' ? 'No requests waiting' : 'Nothing here yet'}</p>
            <p className="mt-1 text-sm text-muted-foreground">New booking requests from the website appear under Requests.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((b) => {
              const paid = paidFor(money, b.id);
              const total = b.amount === '' ? null : Number(b.amount);
              const canDelete = !b.locked || isSuper;
              return (
                <li key={b.id} className="grid gap-3 px-5 py-4 transition-colors hover:bg-muted/30 md:grid-cols-[120px_1fr_180px_auto] md:items-center">
                  <div>
                    <p className="font-serif text-lg leading-tight">{formatDate(b.date)}</p>
                    <p className="text-xs text-muted-foreground">{slotLabel(b.slot)}</p>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium">{b.name}</p>
                      <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', BOOKING_STATUS[b.status]?.cls)}>
                        {BOOKING_STATUS[b.status]?.label ?? b.status}
                      </span>
                      {b.locked && (
                        <span title={`Locked by ${b.lockedBy || 'system'}`} className="inline-flex items-center gap-1 text-[11px] text-primary">
                          <Lock size={11} /> Locked
                        </span>
                      )}
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {eventTypeLabel(b.eventType)}{b.guests ? ` · ${b.guests} guests` : ''} · {b.mobile}{b.email ? ` · ${b.email}` : ''}
                    </p>
                    {(b.notes || b.adminNote) && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground/80">{b.adminNote || b.notes}</p>
                    )}
                  </div>
                  <div className="text-sm">
                    {total === null ? (
                      <span className="text-muted-foreground">{paid ? `Paid ${formatCurrency(paid)}` : 'No amount set'}</span>
                    ) : (
                      <>
                        <p className="font-medium tabular-nums">{formatCurrency(total)}</p>
                        <p className={cn('text-xs tabular-nums', total - paid > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300')}>
                          {total - paid > 0 ? `Balance ${formatCurrency(total - paid)}` : 'Fully paid'}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 md:justify-end">
                    {b.status === 'pending' && (
                      <>
                        <Button size="sm" className="gap-1" disabled={action.isPending}
                          onClick={() => run('bookingUpdate', { id: b.id, changes: { status: 'confirmed' } }, 'Booking confirmed and added to Google Calendar')}>
                          <Check size={14} /> Confirm
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1" disabled={action.isPending}
                          onClick={() => run('bookingUpdate', { id: b.id, changes: { status: 'rejected' } }, 'Request rejected')}>
                          <X size={14} /> Reject
                        </Button>
                      </>
                    )}
                    {b.status !== 'rejected' && b.status !== 'cancelled' && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" title="Record payment" aria-label="Record payment"
                        onClick={() => { setPayment({ amount: '', date: today(), description: '' }); setPaying(b); }}>
                        <IndianRupee size={15} />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit" aria-label="Edit booking" onClick={() => openEdit(b)}>
                      <Edit2 size={15} />
                    </Button>
                    {isSuper && b.status === 'confirmed' && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" disabled={action.isPending}
                        title={b.locked ? 'Unlock booking' : 'Lock booking'} aria-label={b.locked ? 'Unlock booking' : 'Lock booking'}
                        onClick={() => run('bookingLock', { id: b.id, locked: !b.locked }, b.locked ? 'Booking unlocked' : 'Booking locked')}>
                        {b.locked ? <Unlock size={15} /> : <Lock size={15} />}
                      </Button>
                    )}
                    {canDelete && (
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete" aria-label="Delete booking"
                        onClick={() => setDeleting(b)}>
                        <Trash2 size={15} />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Add / edit */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add a booking' : 'Edit booking'}</DialogTitle>
            <DialogDescription>
              {editing === 'new' ? 'For bookings taken by phone or in person.' : editingBooking?.id}
            </DialogDescription>
          </DialogHeader>
          {coreLocked && (
            <div className="flex items-start gap-3 rounded-xl border border-primary/25 bg-accent/40 p-3 text-sm">
              <Lock size={15} className="mt-0.5 shrink-0 text-primary" />
              <p>This booking is locked. You can update the amount and admin note; other changes need the owner to unlock it.</p>
            </div>
          )}
          <form onSubmit={saveForm} className="grid gap-4 sm:grid-cols-2">
            <Field label="Event date">
              <Input type="date" required disabled={coreLocked} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Time slot">
              <Select value={form.slot} onValueChange={(v) => setForm({ ...form, slot: v })} disabled={coreLocked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIME_SLOTS.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Event type">
              <Select value={form.eventType} onValueChange={(v) => setForm({ ...form, eventType: v })} disabled={coreLocked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EVENT_TYPES.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Guests">
              <Input type="number" min={1} max={5000} required disabled={coreLocked} value={form.guests} onChange={(e) => setForm({ ...form, guests: e.target.value })} />
            </Field>
            <Field label="Customer name">
              <Input required maxLength={100} disabled={coreLocked} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Mobile">
              <Input type="tel" required maxLength={16} disabled={coreLocked} value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
            </Field>
            <Field label="Email (optional)">
              <Input type="email" maxLength={254} disabled={coreLocked} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="Status">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as BookingStatus })} disabled={coreLocked}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(BOOKING_STATUS) as BookingStatus[])
                    .filter((s) => editing !== 'new' || s === 'pending' || s === 'confirmed')
                    .map((s) => <SelectItem key={s} value={s}>{BOOKING_STATUS[s].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Total amount (₹)">
              <Input type="number" min={0} step="1" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="e.g. 150000" />
            </Field>
            <Field label="Admin note" className="sm:col-span-2">
              <Input maxLength={500} value={form.adminNote} onChange={(e) => setForm({ ...form, adminNote: e.target.value })} placeholder="Only admins see this" />
            </Field>
            <Field label="Customer notes" className="sm:col-span-2">
              <Textarea rows={3} maxLength={1000} disabled={coreLocked} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </Field>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" disabled={action.isPending} className="gap-2">
                {action.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {editing === 'new' ? 'Add booking' : 'Save changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record payment */}
      <Dialog open={!!paying} onOpenChange={(open) => !open && setPaying(null)}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {paying && `${paying.name} · ${formatDate(paying.date)} — saved as booking income.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={savePayment} className="space-y-4">
            <Field label="Amount received (₹)">
              <Input type="number" min={1} step="1" required autoFocus value={payment.amount} onChange={(e) => setPayment({ ...payment, amount: e.target.value })} />
            </Field>
            <Field label="Date received">
              <Input type="date" required value={payment.date} onChange={(e) => setPayment({ ...payment, date: e.target.value })} />
            </Field>
            <Field label="Note (optional)">
              <Input maxLength={300} value={payment.description} onChange={(e) => setPayment({ ...payment, description: e.target.value })} placeholder="e.g. Advance by UPI" />
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPaying(null)}>Cancel</Button>
              <Button type="submit" disabled={action.isPending}>Save payment</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Ban size={18} className="text-destructive" /> Delete this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting && `${deleting.name} · ${formatDate(deleting.date)}. `}
              It is removed from the sheet and Google Calendar. To keep a record, set the status to Cancelled instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async (e) => {
                e.preventDefault();
                if (deleting && await run('bookingDelete', { id: deleting.id }, 'Booking deleted')) setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
