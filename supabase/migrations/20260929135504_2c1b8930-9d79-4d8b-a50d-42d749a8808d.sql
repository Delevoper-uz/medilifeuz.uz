DROP POLICY IF EXISTS "doctors public read" ON public.doctors;
REVOKE SELECT ON public.doctors FROM anon;