CREATE TABLE public.visitor_welcome_ips (
 ip_address inet PRIMARY KEY,
 welcomed_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.visitor_welcome_ips TO service_role;
ALTER TABLE public.visitor_welcome_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "welcome IPs server only" ON public.visitor_welcome_ips FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE OR REPLACE FUNCTION public.claim_visitor_welcome(p_ip inet)
RETURNS boolean LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path = public AS $$
 WITH claimed AS (
  INSERT INTO public.visitor_welcome_ips(ip_address)
  SELECT p_ip WHERE p_ip IS NOT NULL
  ON CONFLICT (ip_address) DO NOTHING
  RETURNING ip_address
 ) SELECT EXISTS(SELECT 1 FROM claimed);
$$;
REVOKE ALL ON FUNCTION public.claim_visitor_welcome(inet) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_visitor_welcome(inet) TO service_role;
REVOKE ALL ON public.visitor_welcome_ips FROM anon, authenticated;