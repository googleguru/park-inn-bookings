import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDateTime, exportToCSV } from '@/lib/exportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Download, RefreshCw, Search, ChevronLeft, ChevronRight, AlertCircle, Eye } from 'lucide-react';

const ACTION_STYLE: Record<string, string> = {
  UPDATE_BOOKING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  DELETE_BOOKING: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  BLOCK_USER:     'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  UNBLOCK_USER:   'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  ADD_LEDGER_ENTRY:     'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  UPDATE_PRICING: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  ADD_ADMIN_ROLE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  UPDATE_ADMIN_ROLE: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  REMOVE_ADMIN_ROLE: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const PAGE_SIZE = 20;

export function AuditLogs() {
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<string | null>(null);

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const actions = useMemo(() => Array.from(new Set(logs.map(l => l.action))).sort(), [logs]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return logs.filter(l => {
      const matchSearch =
        !q ||
        l.admin_email.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.resource_type.toLowerCase().includes(q) ||
        l.resource_id?.toLowerCase().includes(q);
      const matchAction = actionFilter === 'all' || l.action === actionFilter;
      const matchFrom = !dateFrom || l.created_at >= dateFrom;
      const matchTo   = !dateTo   || l.created_at.slice(0,10) <= dateTo;
      return matchSearch && matchAction && matchFrom && matchTo;
    });
  }, [logs, search, actionFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const detailLog = logs.find(l => l.id === detail);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} records · read-only</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw size={14} className="mr-1.5" />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportToCSV(
            filtered.map(l => ({
              Timestamp: l.created_at,
              Admin: l.admin_email,
              Role: l.admin_role,
              Action: l.action,
              Resource: l.resource_type,
              'Resource ID': l.resource_id,
              Success: l.success,
              'User Agent': l.user_agent,
            })),
            'audit_logs'
          )}>
            <Download size={14} className="mr-1.5" />Export
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search admin, action, resource…"
            className="pl-8 h-9"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={actionFilter} onValueChange={v => { setActionFilter(v); setPage(1); }}>
          <SelectTrigger className="w-48 h-9">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            {actions.map(a => <SelectItem key={a} value={a}>{a.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input type="date" className="w-40 h-9" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
        <Input type="date" className="w-40 h-9" value={dateTo}   onChange={e => { setDateTo(e.target.value);   setPage(1); }} />
      </div>

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {['Timestamp','Admin','Role','Action','Resource','Status','Details'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <AlertCircle size={28} className="mx-auto mb-2 opacity-30" />
                    No audit logs found
                  </td>
                </tr>
              ) : (
                paged.map(l => (
                  <tr key={l.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs truncate max-w-[160px]">{l.admin_email}</p>
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-muted-foreground whitespace-nowrap">
                      {l.admin_role?.replace('_', ' ') ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] border-0 whitespace-nowrap ${ACTION_STYLE[l.action] ?? 'bg-muted text-foreground'}`}>
                        {l.action.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs capitalize">{l.resource_type}</p>
                      {l.resource_id && (
                        <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[80px]">{l.resource_id.slice(0, 8)}…</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-[10px] border-0 ${l.success ? 'bg-green-100 text-green-800 dark:bg-green-900/40' : 'bg-red-100 text-red-800 dark:bg-red-900/40'}`}>
                        {l.success ? 'Success' : 'Failed'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      {(l.old_values || l.new_values) && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setDetail(l.id)}
                        >
                          <Eye size={13} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">Page {page} of {totalPages} · {filtered.length} results</span>
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

      {/* Detail dialog */}
      <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Change Details</DialogTitle>
          </DialogHeader>
          {detailLog && (
            <div className="space-y-4 text-sm">
              {detailLog.old_values && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Before</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto">
                    {JSON.stringify(detailLog.old_values, null, 2)}
                  </pre>
                </div>
              )}
              {detailLog.new_values && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">After</p>
                  <pre className="bg-muted rounded-lg p-3 text-xs overflow-auto">
                    {JSON.stringify(detailLog.new_values, null, 2)}
                  </pre>
                </div>
              )}
              {detailLog.error_message && (
                <div>
                  <p className="text-xs font-semibold text-red-500 uppercase mb-1">Error</p>
                  <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">{detailLog.error_message}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
