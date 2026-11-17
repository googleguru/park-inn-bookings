import { useMemo, useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAdminData } from '@/contexts/AdminContext';
import { formatDateTime } from '@/lib/exportUtils';

export function Activity() {
  const { data, isLoading, isError, refetch } = useAdminData();
  const [search, setSearch] = useState('');
  const [who, setWho] = useState('all');

  const entries = useMemo(() => data?.activity ?? [], [data]);
  const people = useMemo(() => [...new Set(entries.map(e => e.who).filter(Boolean))].sort(), [entries]);
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter(e =>
      (who === 'all' || e.who === who) &&
      (!q || `${e.who} ${e.action} ${e.details}`.toLowerCase().includes(q)));
  }, [entries, search, who]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary">History</p>
        <h1 className="mt-1 text-3xl font-semibold">Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          A record of sign-ins and changes. Also kept in the Activity tab of your Google Sheet.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search activity…"
            aria-label="Search activity" className="pl-9" />
        </div>
        <Select value={who} onValueChange={setWho}>
          <SelectTrigger className="sm:w-64" aria-label="Filter by person"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            {people.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-soft">
        {isError ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="text-rose-500" />
            <p className="text-sm text-muted-foreground">We could not load the activity. Please try again.</p>
            <Button onClick={() => refetch()}>Try again</Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-3 p-4">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : visible.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {entries.length === 0 ? 'Nothing has been recorded yet.' : 'No activity matches your search.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((e, i) => (
              <li key={`${e.time}-${i}`} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[11rem_14rem_10rem_1fr] md:gap-4">
                <span className="text-xs text-muted-foreground md:text-sm">{formatDateTime(e.time)}</span>
                <span className="break-all font-medium md:truncate md:break-normal">{e.who}</span>
                <span className="font-medium text-primary">{e.action}</span>
                <span className="break-words text-muted-foreground">{e.details}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!isLoading && !isError && entries.length > 0 && (
        <p className="text-xs text-muted-foreground">Showing {visible.length} of {entries.length} most recent entries.</p>
      )}
    </div>
  );
}
