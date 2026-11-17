CREATE TABLE public.order_request_metadata (
 order_id uuid PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
 ip_address inet,
 device text NOT NULL DEFAULT 'Noma’lum',
 browser text NOT NULL DEFAULT 'Noma’lum',
 os text NOT NULL DEFAULT 'Noma’lum'
);
GRANT ALL ON public.order_request_metadata TO service_role;
ALTER TABLE public.order_request_metadata ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order metadata server only" ON public.order_request_metadata FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TABLE public.visitor_access_logs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ip_address inet,
 device text NOT NULL DEFAULT 'Noma’lum',
 browser text NOT NULL DEFAULT 'Noma’lum',
 os text NOT NULL DEFAULT 'Noma’lum',
 path text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.visitor_access_logs TO service_role;
ALTER TABLE public.visitor_access_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitor logs server only" ON public.visitor_access_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX visitor_access_logs_ip_time ON public.visitor_access_logs(ip_address, created_at DESC, id DESC);
CREATE INDEX visitor_access_logs_time ON public.visitor_access_logs(created_at DESC);
CREATE OR REPLACE FUNCTION public.admin_visitor_ip_groups(p_search text DEFAULT '', p_page integer DEFAULT 0)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
 WITH grouped AS (
 SELECT host(ip_address) AS ip_address, count(*) AS visits, min(created_at) AS first_seen, max(created_at) AS last_seen,
 (array_agg(device ORDER BY created_at DESC, id DESC))[1] AS device,
 (array_agg(browser ORDER BY created_at DESC, id DESC))[1] AS browser,
 (array_agg(os ORDER BY created_at DESC, id DESC))[1] AS os
 FROM public.visitor_access_logs
 WHERE p_search = '' OR host(ip_address) ILIKE '%' || p_search || '%'
 GROUP BY ip_address
 ), page_rows AS (SELECT * FROM grouped ORDER BY last_seen DESC, ip_address NULLS LAST LIMIT 50 OFFSET greatest(0, least(p_page, 100000)) * 50)
 SELECT jsonb_build_object('rows', coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page_rows p), '[]'::jsonb), 'total', (SELECT count(*) FROM grouped));
$$;
REVOKE ALL ON FUNCTION public.admin_visitor_ip_groups(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_visitor_ip_groups(text, integer) TO service_role;