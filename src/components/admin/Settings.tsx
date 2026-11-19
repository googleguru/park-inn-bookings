import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays, Clock, Crown, ExternalLink, FileSpreadsheet, Loader2, Mail, RefreshCw, ScrollText,
  ShieldCheck, Smartphone, Trash2, Upload, UserPlus,
} from 'lucide-react';
import { useAdmin, useAdminAction, useAdminData } from '@/contexts/AdminContext';
import type { AdminRole } from '@/lib/api';
import { formatDateTime } from '@/lib/exportUtils';
import { isValidEmail } from '@/lib/security';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

/** Minimal CSV parser (quoted fields, commas and newlines inside quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

// Column names accepted from the old admin panel's CSV export or a hand-made sheet.
const IMPORT_COLUMNS: Record<string, string[]> = {
  date: ['date', 'event date', 'booking_date', 'booking date'],
  name: ['name', 'customer', 'customer name'],
  email: ['email'],
  mobile: ['mobile', 'phone', 'mobile number'],
  eventType: ['event type', 'event_type', 'event'],
  guests: ['guests', 'guest_count', 'guest count'],
  slot: ['time slot', 'time_slot', 'slot'],
  status: ['status'],
  amount: ['amount', 'total amount'],
  notes: ['notes'],
};

function toImportRows(table: string[][]) {
  const [header, ...body] = table;
  const index: Record<string, number> = {};
  header.forEach((h, i) => {
    const key = Object.keys(IMPORT_COLUMNS).find((k) => IMPORT_COLUMNS[k].includes(h.trim().toLowerCase()));
    if (key && !(key in index)) index[key] = i;
  });
  if (!('date' in index)) throw new Error('The file needs a "Date" column.');
  return body.map((r) => Object.fromEntries(Object.entries(index).map(([k, i]) => [k, (r[i] ?? '').trim()])));
}

export function Settings() {
  const { data, isLoading } = useAdminData();
  const action = useAdminAction<{ imported: number; skipped: string[] }>();
  const { isSuper, adminUser } = useAdmin();
  const reportAction = useAdminAction<{ url: string; month: string }>();
  const [reportMonth, setReportMonth] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit' }).format(new Date()).slice(0, 7));
  const [reportUrl, setReportUrl] = useState('');
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [venueName, setVenueName] = useState('');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [newAdmin, setNewAdmin] = useState({ email: '', role: 'admin' as AdminRole });
  const [importRows, setImportRows] = useState<Record<string, string>[] | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: string[] } | null>(null);

  useEffect(() => {
    if (!data) return;
    setVenueName(data.settings.venueName);
    setNotifyEmail(data.settings.notifyEmail);
  }, [data]);

  const admins = useMemo(() => {
    const owner = data?.settings.ownerEmail;
    return [...(data?.admins ?? [])].sort((a, b) => (a.email === owner ? -1 : b.email === owner ? 1 : a.email.localeCompare(b.email)));
  }, [data]);

  const run = async (name: string, payload: Record<string, unknown>, success: string) => {
    try {
      const res = await action.mutateAsync({ action: name, payload });
      toast({ title: success });
      return res ?? true;
    } catch (err) {
      toast({ title: 'Could not save', description: (err as Error).message, variant: 'destructive' });
      return null;
    }
  };

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidEmail(notifyEmail.trim())) {
      toast({ title: 'Enter a valid notification email', variant: 'destructive' });
      return;
    }
    await run('settingsSave', { venueName: venueName.trim(), notifyEmail: notifyEmail.trim() }, 'Settings saved');
  };

  const addAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newAdmin.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      toast({ title: 'Enter a valid Gmail address', variant: 'destructive' });
      return;
    }
    if (await run('adminAdd', { email, role: newAdmin.role }, 'Admin added — they can now sign in with a code')) {
      setNewAdmin({ email: '', role: 'admin' });
    }
  };

  const pickFile = async (file: File | undefined) => {
    setImportResult(null);
    if (!file) return;
    try {
      const rows = toImportRows(parseCsv(await file.text()));
      if (!rows.length) throw new Error('The file has no rows.');
      setImportRows(rows);
    } catch (err) {
      toast({ title: 'Could not read the file', description: (err as Error).message, variant: 'destructive' });
      setImportRows(null);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const runImport = async () => {
    if (!importRows) return;
    const res = await run('importBookings', { rows: importRows }, 'Import finished');
    if (res && typeof res === 'object') setImportResult(res);
    setImportRows(null);
  };

  if (isLoading || !data) {
    return <div className="space-y-4">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Settings</p>
        <h1 className="mt-1 text-3xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isSuper ? 'Changes save straight to the Settings tab of your Google Sheet.' : 'Only the owner (super admin) can change these settings.'}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Online booking */}
        <Panel title="Online booking" icon={CalendarDays}>
          <div className="flex items-center justify-between gap-4 rounded-xl bg-muted/50 p-4">
            <div>
              <p className="font-medium">{data.settings.bookingEnabled ? 'Booking is open' : 'Booking is closed'}</p>
              <p className="text-sm text-muted-foreground">
                {data.settings.bookingEnabled
                  ? 'Customers can pick dates and send requests.'
                  : 'The website asks customers to call you instead.'}
              </p>
            </div>
            <Switch
              checked={data.settings.bookingEnabled}
              disabled={!isSuper || action.isPending}
              onCheckedChange={(on) => run('settingsSave', { bookingEnabled: on }, on ? 'Online booking opened' : 'Online booking closed')}
              aria-label="Online booking"
            />
          </div>
          <form onSubmit={saveDetails} className="mt-4 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Venue name (used in emails)</span>
              <Input value={venueName} maxLength={80} disabled={!isSuper} onChange={(e) => setVenueName(e.target.value)} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Email me new requests at</span>
              <Input type="email" value={notifyEmail} maxLength={254} disabled={!isSuper} onChange={(e) => setNotifyEmail(e.target.value)} />
            </label>
            {isSuper && <Button type="submit" disabled={action.isPending}>Save</Button>}
          </form>
        </Panel>

        {/* Google account */}
        <Panel title="Your Google account" icon={FileSpreadsheet}>
          <p className="text-sm text-muted-foreground">
            Everything — bookings, customers, income, expenses and the activity log — is stored in your own Google
            Sheet. Confirmed bookings appear in the <b>Park Inn Bookings</b> Google Calendar. Add an event there to
            block a date on the website.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="justify-between">
              <a href={data.links.sheet} target="_blank" rel="noreferrer">Open Google Sheet <ExternalLink size={14} /></a>
            </Button>
            <Button asChild variant="outline" className="justify-between" disabled={!data.links.calendar}>
              <a href={data.links.calendar || '#'} target="_blank" rel="noreferrer">Open Google Calendar <ExternalLink size={14} /></a>
            </Button>
          </div>
          <Button
            variant="ghost"
            className="mt-2 w-full gap-2"
            disabled={action.isPending}
            onClick={() => run('calendarSync', {}, 'Google Calendar is in sync')}
          >
            <RefreshCw size={14} className={cn(action.isPending && 'animate-spin')} /> Sync with Google Calendar now
          </Button>
          <p className="mt-1 text-center text-xs text-muted-foreground">{data.automation?.calendarScheduled ? 'Automatic sync is installed. Updated setup checks every 15 minutes.' : 'Run the updated setup in Apps Script to install automatic sync.'}</p>
        </Panel>

        <Panel title="Monthly PDF archive" icon={ScrollText}>
          <p className="text-sm text-muted-foreground">A private PDF of the previous month is saved in the owner's Google Drive. The daily job retries missed runs. Reports include booking details, statuses, income and expenses.</p>
          <p className="mt-3 text-sm font-medium">{data.automation?.reportsScheduled ? 'Automatic monthly reports are installed' : 'Activation needed: run the updated Apps Script setup'}</p>
          <p className="mt-2 text-sm text-muted-foreground">Last archived month: {data.automation?.lastReport || 'None yet'}</p>
          {data.automation?.lastSync && <p className="mt-2 text-sm text-muted-foreground">Last calendar sync: {formatDateTime(data.automation.lastSync)}</p>}
          {data.automation?.reportsFolder && <Button asChild variant="outline" className="mt-3"><a href={data.automation.reportsFolder} target="_blank" rel="noreferrer">Open private report folder <ExternalLink size={14} className="ml-2" /></a></Button>}
          {isSuper && <form className="mt-4 space-y-3" onSubmit={async (e) => {
            e.preventDefault(); setReportUrl('');
            try {
              const result = await reportAction.mutateAsync({ action: 'monthlyReport', payload: { month: reportMonth } });
              setReportUrl(result.url); toast({ title: 'PDF saved to Google Drive' });
            } catch (err) { toast({ title: 'Could not export PDF', description: (err as Error).message, variant: 'destructive' }); }
          }}>
            <label className="block text-sm font-medium">Report month<Input type="month" required min="2000-01" value={reportMonth} onChange={(e) => { setReportMonth(e.target.value); setReportUrl(''); }} /></label>
            <Button disabled={reportAction.isPending || !data.automation}>{reportAction.isPending ? 'Generating PDF…' : 'Generate monthly PDF'}</Button>
            {reportUrl && <p role="status"><a className="text-primary underline" href={reportUrl} target="_blank" rel="noreferrer">Open generated PDF</a></p>}
          </form>}
          <p className="mt-3 text-sm text-muted-foreground">Google account access is required to open files. Regenerating a month replaces its previous PDF. Free Google storage and service quotas apply.</p>
        </Panel>

        {/* Admins */}
        <Panel title="Admins" icon={ShieldCheck}>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {admins.map((a) => {
              const isOwner = a.email === data.settings.ownerEmail;
              return (
                <li key={a.email} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {isOwner && <Crown size={13} className="shrink-0 text-gold" aria-label="Owner" />}
                      {a.email}
                      {a.email === adminUser?.email && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isOwner ? 'Owner · super admin' : a.role === 'super_admin' ? 'Super admin' : 'Admin'}
                      {a.addedAt && !isOwner ? ` · added ${formatDateTime(a.addedAt)}` : ''}
                    </p>
                  </div>
                  {isSuper && !isOwner && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      aria-label={`Remove ${a.email}`}
                      disabled={action.isPending}
                      onClick={() => run('adminRemove', { email: a.email }, 'Admin removed')}
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
          {isSuper && (
            <form onSubmit={addAdmin} className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Input
                type="email"
                value={newAdmin.email}
                maxLength={254}
                onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                placeholder="staff@gmail.com"
                className="sm:flex-1"
              />
              <Select value={newAdmin.role} onValueChange={(v) => setNewAdmin({ ...newAdmin, role: v as AdminRole })}>
                <SelectTrigger className="sm:w-36" aria-label="Role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Super admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" className="gap-1.5" disabled={action.isPending}><UserPlus size={15} /> Add</Button>
            </form>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Admins can manage bookings, customers and money. Only super admins can unlock bookings, delete money
            entries and change settings. The owner can never be removed.
          </p>
        </Panel>

        {/* Security */}
        <Panel title="Security" icon={ShieldCheck}>
          <ul className="space-y-3 text-sm">
            {[
              { icon: Mail, text: 'Admins sign in with a one-time code sent to their Gmail.' },
              { icon: Smartphone, text: 'Each admin can be signed in on one device at a time.' },
              { icon: Clock, text: 'The admin panel locks after 15 minutes without activity.' },
              { icon: ScrollText, text: 'Every sign-in and change is saved in the Activity tab.' },
              { icon: ShieldCheck, text: 'Confirmed bookings lock automatically; only super admins can unlock them.' },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex gap-3">
                <Icon size={16} className="mt-0.5 shrink-0 text-primary" />
                <span className="text-muted-foreground">{text}</span>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Import */}
        {isSuper && (
          <Panel title="Import old bookings" icon={Upload} className="lg:col-span-2">
            <p className="text-sm text-muted-foreground">
              Upload a CSV file (for example the export from the old admin panel, or a sheet saved as CSV) with columns
              like Date, Name, Email, Mobile, Event Type, Guests, Time Slot, Status, Amount and Notes. Confirmed bookings
              are locked and added to Google Calendar.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <Button variant="outline" className="gap-2" onClick={() => fileRef.current?.click()}>
                <Upload size={15} /> Choose CSV file
              </Button>
              {importRows && (
                <>
                  <span className="text-sm">{importRows.length} rows ready</span>
                  <Button onClick={runImport} disabled={action.isPending} className="gap-2">
                    {action.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Import {importRows.length} bookings
                  </Button>
                  <Button variant="ghost" onClick={() => setImportRows(null)}>Cancel</Button>
                </>
              )}
            </div>
            {importResult && (
              <div className="mt-4 rounded-xl bg-muted/50 p-4 text-sm">
                <p className="font-medium">{importResult.imported} bookings imported, {importResult.skipped.length} skipped.</p>
                {importResult.skipped.length > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                    {importResult.skipped.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                )}
              </div>
            )}
          </Panel>
        )}
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, className, children }: {
  title: string; icon: typeof Mail; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={cn('rounded-2xl border border-border bg-card p-6 shadow-soft', className)}>
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
          <Icon size={15} className="text-primary" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
