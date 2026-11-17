import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { z } from 'zod';
import { requireAdminPanel } from './admin-middleware';
import { requestMetadata, VisitSchema, type VisitorGroup } from './request-metadata';

export const adminOrdersWithMetadata = createServerFn({ method: 'POST' })
  .middleware([requireAdminPanel])
  .handler(async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.from('orders')
      .select('*, order_items(*), order_request_metadata(ip_address, device, browser, os)')
      .order('created_at', { ascending: false });
    if (error) throw new Error('Buyurtmalar olinmadi');
    return data ?? [];
  });

export const recordVisit = createServerFn({ method: 'POST' })
  .inputValidator((input) => VisitSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const metadata = requestMetadata(getRequest().headers, import.meta.env.PROD);
    const { error } = await supabaseAdmin.from('visitor_access_logs').insert({ ...metadata, path: data.path });
    if (error) throw new Error('Tashrif saqlanmadi');
    return { ok: true };
  });

export const adminVisitorGroups = createServerFn({ method: 'POST' })
  .middleware([requireAdminPanel])
  .inputValidator((input) => z.object({ search: z.string().max(64).default(''), page: z.number().int().min(0).max(100000).default(0) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data: result, error } = await supabaseAdmin.rpc('admin_visitor_ip_groups', { p_search: data.search, p_page: data.page });
    if (error) throw new Error('Kirishlar ro‘yxati olinmadi');
    return result as unknown as { rows: VisitorGroup[]; total: number };
  });

export const adminVisitorHistory = createServerFn({ method: 'POST' })
  .middleware([requireAdminPanel])
  .inputValidator((input) => z.object({ ip: z.string().ip().nullable(), page: z.number().int().min(0).max(100000).default(0) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    let query = supabaseAdmin.from('visitor_access_logs').select('id, path, device, browser, os, created_at', { count: 'exact' })
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(data.page * 50, data.page * 50 + 49);
    query = data.ip === null ? query.is('ip_address', null) : query.eq('ip_address', data.ip);
    const { data: rows, error, count } = await query;
    if (error) throw new Error('Kirish tarixi olinmadi');
    return { rows: rows ?? [], total: count ?? 0 };
  });