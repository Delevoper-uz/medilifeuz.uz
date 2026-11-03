ALTER TABLE public.orders ADD COLUMN routed_branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;
ALTER TABLE public.orders ADD COLUMN routed_branch_distance_km double precision;
COMMENT ON COLUMN public.orders.routed_branch_id IS 'Nearest configured branch at order submission, separate from accepting branch';