CREATE TABLE public.price_bot_sessions (
  chat_id bigint PRIMARY KEY,
  lang text NOT NULL DEFAULT 'latin',
  step text NOT NULL DEFAULT 'lang',
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.price_bot_sessions TO service_role;
ALTER TABLE public.price_bot_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "price_bot_sessions no client access" ON public.price_bot_sessions FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE TRIGGER price_bot_sessions_updated_at BEFORE UPDATE ON public.price_bot_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.bot_shared_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id bigint,
  names text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bot_shared_lists TO anon;
GRANT SELECT ON public.bot_shared_lists TO authenticated;
GRANT ALL ON public.bot_shared_lists TO service_role;
ALTER TABLE public.bot_shared_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bot_shared_lists public read" ON public.bot_shared_lists FOR SELECT TO anon, authenticated USING (true);