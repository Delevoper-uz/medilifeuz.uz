CREATE TABLE public.price_sync_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  source_url text,
  http_method text NOT NULL DEFAULT 'GET',
  keys jsonb NOT NULL DEFAULT '[]'::jsonb,
  name_column text,
  name_col_index integer,
  stock_column text,
  stock_col_index integer,
  price_column text,
  price_col_index integer,
  header_row integer NOT NULL DEFAULT 1,
  interval_minutes integer NOT NULL DEFAULT 1440,
  enabled boolean NOT NULL DEFAULT false,
  last_run_at timestamptz,
  last_status text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.price_sync_settings TO service_role;
ALTER TABLE public.price_sync_settings ENABLE ROW LEVEL SECURITY;