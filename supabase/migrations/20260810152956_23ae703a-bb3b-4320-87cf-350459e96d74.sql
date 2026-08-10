CREATE TABLE public.user_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone_number text,
  full_name text,
  activity text NOT NULL DEFAULT '',
  path text NOT NULL DEFAULT '',
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.user_presence TO authenticated;
GRANT ALL ON public.user_presence TO service_role;

ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "presence self upsert" ON public.user_presence FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presence self update" ON public.user_presence FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "presence self select" ON public.user_presence FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "presence admin select" ON public.user_presence FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER user_presence_updated_at BEFORE UPDATE ON public.user_presence FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_user_presence_last_seen ON public.user_presence (last_seen_at DESC);