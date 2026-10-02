ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS old_price numeric, ADD COLUMN IF NOT EXISTS price_changed_at timestamptz;
CREATE INDEX IF NOT EXISTS medicines_lang_name_idx ON public.medicines (language, name);
CREATE INDEX IF NOT EXISTS medicines_price_changed_idx ON public.medicines (price_changed_at DESC) WHERE price_changed_at IS NOT NULL;
CREATE OR REPLACE FUNCTION public.track_medicine_price() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.price IS DISTINCT FROM OLD.price THEN
    NEW.old_price = OLD.price; NEW.price_changed_at = now();
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS medicines_track_price ON public.medicines;
CREATE TRIGGER medicines_track_price BEFORE UPDATE ON public.medicines FOR EACH ROW EXECUTE FUNCTION public.track_medicine_price();