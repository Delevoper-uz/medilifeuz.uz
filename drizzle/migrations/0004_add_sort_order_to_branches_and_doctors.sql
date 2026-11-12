ALTER TABLE public.branches ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.doctors ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.branches.sort_order IS 'Admin panelda belgilangan ko''rsatish tartibi (1-chi, 2-chi...)';
COMMENT ON COLUMN public.doctors.sort_order IS 'Admin panelda belgilangan ko''rsatish tartibi (1-chi, 2-chi...)';
CREATE INDEX branches_sort_order_idx ON public.branches (sort_order, created_at);
CREATE INDEX doctors_sort_order_idx ON public.doctors (sort_order, created_at);