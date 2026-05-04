import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/contexts/AdminContext';

interface AuditPayload {
  action: string;
  resourceType: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  success?: boolean;
  errorMessage?: string;
}

export function useAuditLog() {
  const { adminUser } = useAdmin();

  const log = useCallback(async (payload: AuditPayload) => {
    if (!adminUser) return;
    try {
      await supabase.from('audit_logs').insert({
        admin_email: adminUser.email,
        admin_role: adminUser.role,
        action: payload.action,
        resource_type: payload.resourceType,
        resource_id: payload.resourceId ?? null,
        old_values: payload.oldValues ? (payload.oldValues as import('@/integrations/supabase/types').Json) : null,
        new_values: payload.newValues ? (payload.newValues as import('@/integrations/supabase/types').Json) : null,
        ip_address: null,
        user_agent: navigator.userAgent.slice(0, 255),
        success: payload.success ?? true,
        error_message: payload.errorMessage ?? null,
      });
    } catch {
      // Audit logging should never break the main flow
    }
  }, [adminUser]);

  return { log };
}
