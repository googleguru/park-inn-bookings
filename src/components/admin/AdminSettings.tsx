import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatDateTime } from '@/lib/exportUtils';
import { isValidEmail } from '@/lib/security';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, RefreshCw, Shield, UserCog } from 'lucide-react';

type AdminRole = 'super_admin' | 'admin' | 'finance_manager';

const ROLE_STYLE: Record<AdminRole, string> = {
  super_admin:     'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
  admin:           'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  finance_manager: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: 'Super Admin', admin: 'Admin', finance_manager: 'Finance Manager',
};

const addSchema = z.object({
  email: z.string().email('Invalid email address'),
  role:  z.enum(['super_admin','admin','finance_manager']),
});

export function AdminSettings() {
  const { adminUser } = useAdmin();
  const { log } = useAuditLog();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);

  const { data: admins = [], isLoading, refetch } = useQuery({
    queryKey: ['admin-roles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_roles')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const form = useForm<z.infer<typeof addSchema>>({
    resolver: zodResolver(addSchema),
    defaultValues: { email: '', role: 'admin' },
  });

  const addMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addSchema>) => {
      const { error } = await supabase.from('admin_roles').insert({
        email:    data.email.toLowerCase(),
        role:     data.role,
        is_active: true,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await log({ action: 'ADD_ADMIN_ROLE', resourceType: 'admin_role', newValues: data });
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setAddOpen(false);
      form.reset();
      toast({ title: 'Admin user added' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('admin_roles').update({ is_active }).eq('id', id);
      if (error) throw error;
      return { id, is_active };
    },
    onSuccess: async ({ id, is_active }) => {
      await log({ action: 'UPDATE_ADMIN_ROLE', resourceType: 'admin_role', resourceId: id, newValues: { is_active } });
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      toast({ title: is_active ? 'Admin activated' : 'Admin deactivated' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_roles').delete().eq('id', id);
      if (error) throw error;
      return id;
    },
    onSuccess: async (id) => {
      await log({ action: 'REMOVE_ADMIN_ROLE', resourceType: 'admin_role', resourceId: id });
      queryClient.invalidateQueries({ queryKey: ['admin-roles'] });
      setRemoveTarget(null);
      toast({ title: 'Admin removed' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage admin roles and access control</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield size={18} className="text-primary" />
                Admin Roles
              </CardTitle>
              <CardDescription className="mt-1">Control who can access the admin panel and their permissions</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw size={14} className="mr-1.5" />Refresh
              </Button>
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus size={14} className="mr-1.5" />Add Admin
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4"><Skeleton className="h-12 w-full" /></div>
              ))
            ) : admins.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <UserCog size={28} className="mx-auto mb-2 opacity-30" />
                No admins configured
              </div>
            ) : (
              admins.map(a => {
                const isSelf = a.email === adminUser?.email;
                return (
                  <div key={a.id} className="flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-sm font-bold text-primary">{a.email[0].toUpperCase()}</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{a.email}</p>
                          {isSelf && <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">You</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge className={`text-[10px] border-0 ${ROLE_STYLE[a.role as AdminRole]}`}>
                            {ROLE_LABELS[a.role as AdminRole]}
                          </Badge>
                          {a.last_login && (
                            <span className="text-[10px] text-muted-foreground">
                              Last login: {formatDateTime(a.last_login)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{a.is_active ? 'Active' : 'Inactive'}</span>
                        <Switch
                          checked={a.is_active}
                          disabled={isSelf || toggleMutation.isPending}
                          onCheckedChange={v => toggleMutation.mutate({ id: a.id, is_active: v })}
                        />
                      </div>
                      {!isSelf && (
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setRemoveTarget(a.id)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Role permissions guide */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Permission Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 text-left font-semibold text-muted-foreground">Permission</th>
                  {(['super_admin','admin','finance_manager'] as AdminRole[]).map(r => (
                    <th key={r} className="pb-2 px-4 text-center font-semibold">
                      <Badge className={`${ROLE_STYLE[r]} border-0 text-[10px]`}>{ROLE_LABELS[r]}</Badge>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ['View Dashboard',    true, true, true],
                  ['Manage Bookings',   true, true, false],
                  ['View Ledger',       true, true, true],
                  ['Manage Ledger',     true, false, true],
                  ['Manage Users',      true, true, false],
                  ['View Audit Logs',   true, true, false],
                  ['Manage Events',     true, true, false],
                  ['Manage Settings',   true, false, false],
                ].map(([label, ...perms]) => (
                  <tr key={label as string}>
                    <td className="py-2 text-muted-foreground">{label as string}</td>
                    {(perms as boolean[]).map((p, i) => (
                      <td key={i} className="py-2 px-4 text-center">
                        {p
                          ? <span className="text-green-500">✓</span>
                          : <span className="text-muted-foreground/40">—</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add admin dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Admin User</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(data => addMutation.mutate(data))} className="space-y-4">
              <FormField control={form.control} name="email" render={({ field: f }) => (
                <FormItem>
                  <FormLabel>Email Address *</FormLabel>
                  <FormControl><Input type="email" placeholder="admin@example.com" {...f} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="role" render={({ field: f }) => (
                <FormItem>
                  <FormLabel>Role *</FormLabel>
                  <Select value={f.value} onValueChange={f.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {(['admin','finance_manager','super_admin'] as AdminRole[]).map(r => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <p className="text-xs text-muted-foreground bg-muted rounded-lg p-3">
                The user must sign in with this Google account. They'll be granted access on next login.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={addMutation.isPending}>
                  {addMutation.isPending ? 'Adding…' : 'Add Admin'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={!!removeTarget} onOpenChange={open => !open && setRemoveTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Admin?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This will revoke their admin access immediately.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={removeMutation.isPending}
              onClick={() => removeTarget && removeMutation.mutate(removeTarget)}>
              {removeMutation.isPending ? 'Removing…' : 'Remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
