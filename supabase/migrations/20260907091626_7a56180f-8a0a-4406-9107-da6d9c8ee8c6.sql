CREATE TABLE public.doctors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  specialty text,
  image_url text,
  phone text,
  branch text,
  schedule text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.doctors TO anon, authenticated;
GRANT ALL ON public.doctors TO service_role;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "doctors public read" ON public.doctors FOR SELECT USING (true);
CREATE POLICY "doctors admin write" ON public.doctors FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER doctors_updated_at BEFORE UPDATE ON public.doctors FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.doctor_appointments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doctor_id uuid REFERENCES public.doctors(id) ON DELETE SET NULL,
  doctor_name text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.doctor_appointments TO service_role;
ALTER TABLE public.doctor_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "appointments no client access" ON public.doctor_appointments FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

CREATE TABLE public.bot_group_sessions (
  chat_id bigint NOT NULL PRIMARY KEY,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  chosen jsonb NOT NULL DEFAULT '[]'::jsonb,
  step text NOT NULL DEFAULT 'idle',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.bot_group_sessions TO service_role;
ALTER TABLE public.bot_group_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_group_sessions no client access" ON public.bot_group_sessions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER bot_group_sessions_updated_at BEFORE UPDATE ON public.bot_group_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP POLICY IF EXISTS "bot_shared_lists public read" ON public.bot_shared_lists;
REVOKE SELECT ON public.bot_shared_lists FROM anon, authenticated;
CREATE POLICY "bot_shared_lists no client access" ON public.bot_shared_lists FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);