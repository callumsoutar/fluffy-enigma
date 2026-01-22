/**
 * Cancellation categories classify reasons for booking cancellations.
 * 
 * Supports hybrid model:
 * - Global categories (is_global=true, tenant_id=null): Available to all tenants
 * - Tenant-specific categories (is_global=false, tenant_id set): Custom categories per tenant
 */
export interface CancellationCategory {
  id: string;
  name: string;
  description: string | null;
  is_global: boolean;
  tenant_id: string | null;
  created_at?: string;
  updated_at?: string;
  voided_at?: string | null;
}
