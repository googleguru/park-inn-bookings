import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuditLog } from '@/hooks/useAuditLog';
import { formatCurrency } from '@/lib/exportUtils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Edit2, RefreshCw, TrendingUp, Users, DollarSign } from 'lucide-react';
import { useState } from 'react';

const pricingSchema = z.object({
  base_price:      z.coerce.number().min(0),
  per_guest_price: z.coerce.number().min(0),
  minimum_guests:  z.coerce.number().min(1),
  description:     z.string().optional(),
  is_active:       z.boolean(),
});
type PricingForm = z.infer<typeof pricingSchema>;

export function EventManagement() {
  const { log } = useAuditLog();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);

  const { data: pricing = [], isLoading, refetch } = useQuery({
    queryKey: ['event-pricing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('event_pricing')
        .select('*')
        .order('event_type');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['admin-bookings-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('event_type,amount,status');
      if (error) throw error;
      return data ?? [];
    },
  });

  const editTarget = pricing.find(p => p.id === editId);

  const form = useForm<PricingForm>({
    resolver: zodResolver(pricingSchema),
    values: editTarget
      ? {
          base_price:      editTarget.base_price,
          per_guest_price: editTarget.per_guest_price,
          minimum_guests:  editTarget.minimum_guests,
          description:     editTarget.description ?? '',
          is_active:       editTarget.is_active,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: PricingForm & { id: string }) => {
      const { id, ...rest } = data;
      const { error } = await supabase.from('event_pricing').update(rest).eq('id', id);
      if (error) throw error;
      return { id, ...rest };
    },
    onSuccess: async (result) => {
      await log({ action: 'UPDATE_PRICING', resourceType: 'event_pricing', resourceId: result.id, newValues: result });
      queryClient.invalidateQueries({ queryKey: ['event-pricing'] });
      setEditId(null);
      toast({ title: 'Pricing updated' });
    },
    onError: (e: Error) => toast({ title: 'Failed', description: e.message, variant: 'destructive' }),
  });

  const getStats = (eventType: string) => {
    const typeBookings = bookings.filter(b => b.event_type === eventType);
    const total = typeBookings.length;
    const revenue = typeBookings.reduce((s, b) => s + (b.amount ?? 0), 0);
    return { total, revenue };
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events & Pricing</h1>
          <p className="text-sm text-muted-foreground">Manage pricing configuration for each event type</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw size={14} className="mr-1.5" />Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)
          : pricing.map(p => {
              const stats = getStats(p.event_type);
              return (
                <Card key={p.id} className={`hover:shadow-md transition-shadow ${!p.is_active ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{p.event_type}</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/40' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={() => setEditId(p.id)}
                        >
                          <Edit2 size={13} />
                        </Button>
                      </div>
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-xs text-muted-foreground">Base Price</p>
                        <p className="font-bold text-primary mt-0.5">{formatCurrency(p.base_price)}</p>
                      </div>
                      <div className="bg-muted/50 rounded-lg p-2.5">
                        <p className="text-xs text-muted-foreground">Per Guest</p>
                        <p className="font-bold mt-0.5">{formatCurrency(p.per_guest_price)}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Min. {p.minimum_guests} guests
                    </div>
                    <div className="border-t border-border pt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users size={12} />
                        <span>{stats.total} bookings</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <DollarSign size={12} />
                        <span>{formatCurrency(stats.revenue)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editId} onOpenChange={open => !open && setEditId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Pricing — {editTarget?.event_type}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(data => updateMutation.mutate({ id: editId!, ...data }))} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="base_price" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Base Price (₹)</FormLabel>
                    <FormControl><Input type="number" {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="per_guest_price" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Per Guest (₹)</FormLabel>
                    <FormControl><Input type="number" {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="minimum_guests" render={({ field: f }) => (
                  <FormItem>
                    <FormLabel>Minimum Guests</FormLabel>
                    <FormControl><Input type="number" {...f} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="is_active" render={({ field: f }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border border-border p-3">
                    <FormLabel className="cursor-pointer">Active</FormLabel>
                    <FormControl>
                      <Switch checked={f.value} onCheckedChange={f.onChange} />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field: f }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea {...f} rows={2} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              {form.watch('base_price') > 0 && (
                <div className="rounded-lg bg-muted p-3 text-sm">
                  <p className="text-muted-foreground text-xs mb-1">Estimated pricing preview</p>
                  <p className="font-medium">
                    {form.watch('minimum_guests')} guests: {formatCurrency(
                      (form.watch('base_price') || 0) +
                      (form.watch('per_guest_price') || 0) * (form.watch('minimum_guests') || 0)
                    )}
                  </p>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving…' : 'Save Pricing'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
