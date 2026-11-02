CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS medicines_name_search_gin ON public.medicines USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS medicines_cyrl_search_gin ON public.medicines USING gin (name_cyrl gin_trgm_ops);
CREATE TABLE public.operator_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 secret_hash text NOT NULL,
 status text NOT NULL DEFAULT 'pending',
 operator_id bigint,
 chat_id bigint NOT NULL,
 message_id bigint,
 prompt_id bigint,
 candidates jsonb NOT NULL DEFAULT '[]',
 selected jsonb NOT NULL DEFAULT '[]',
 removed jsonb NOT NULL DEFAULT '[]',
 step text NOT NULL DEFAULT 'idle',
 last_update_id bigint,
 created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz
);
GRANT ALL ON public.operator_requests TO service_role;
ALTER TABLE public.operator_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "operator requests server only" ON public.operator_requests FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE INDEX operator_requests_prompt ON public.operator_requests(chat_id, prompt_id);
CREATE OR REPLACE FUNCTION public.operator_request_action(p_id uuid, p_operator bigint, p_action text, p_value jsonb DEFAULT 'null', p_update bigint DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r public.operator_requests; idx integer; entry jsonb;
BEGIN
 SELECT * INTO r FROM public.operator_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
 IF r.status='sent' THEN RETURN to_jsonb(r); END IF;
 IF r.operator_id IS NOT NULL AND r.operator_id<>p_operator THEN RAISE EXCEPTION 'Already claimed'; END IF;
 IF p_update IS NOT NULL AND r.last_update_id=p_update THEN RETURN to_jsonb(r); END IF;
 IF p_action='claim' THEN r.operator_id:=p_operator; r.status:='claimed';
 ELSIF r.operator_id IS NULL THEN RAISE EXCEPTION 'Claim first';
 ELSIF p_action='add' THEN r.step:='search';
 ELSIF p_action='candidates' THEN r.candidates:=p_value; r.step:='choose';
 ELSIF p_action='pick' THEN
  idx:=(p_value #>> '{}')::integer-1; entry:=r.candidates->idx;
  IF idx<0 OR entry IS NULL THEN RAISE EXCEPTION 'Invalid number'; END IF;
  IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(r.selected) x WHERE x->>'id'=entry->>'id') THEN r.selected:=r.selected || jsonb_build_array(entry); END IF;
  r.step:='idle';
 ELSIF p_action='remove' THEN r.step:='remove';
 ELSIF p_action='delete' THEN
  idx:=(p_value #>> '{}')::integer-1; entry:=r.selected->idx;
  IF idx<0 OR entry IS NULL THEN RAISE EXCEPTION 'Invalid number'; END IF;
  r.removed:=r.removed || jsonb_build_array(jsonb_build_object('index',idx,'item',entry)); r.selected:=r.selected-idx; r.step:='idle';
 ELSIF p_action='undo' AND jsonb_array_length(r.removed)>0 THEN
  entry:=r.removed->(jsonb_array_length(r.removed)-1); idx:=(entry->>'index')::integer;
  SELECT COALESCE(jsonb_agg(item ORDER BY pos),'[]'::jsonb) INTO r.selected FROM (
   SELECT value AS item, CASE WHEN ordinality-1>=idx THEN ordinality ELSE ordinality-1 END AS pos FROM jsonb_array_elements(r.selected) WITH ORDINALITY
   UNION ALL SELECT entry->'item',idx) restored;
  r.removed:=r.removed-(jsonb_array_length(r.removed)-1); r.step:='idle';
 ELSIF p_action='preview' THEN r.step:='preview';
 ELSIF p_action='send' THEN
  IF jsonb_array_length(r.selected)=0 THEN RAISE EXCEPTION 'Empty list'; END IF;
  r.status:='sent'; r.delivered_at:=now(); r.step:='done';
 END IF;
 UPDATE public.operator_requests SET status=r.status,operator_id=r.operator_id,candidates=r.candidates,selected=r.selected,removed=r.removed,step=r.step,last_update_id=COALESCE(p_update,r.last_update_id),delivered_at=r.delivered_at WHERE id=p_id RETURNING * INTO r;
 RETURN to_jsonb(r);
END $$;
REVOKE ALL ON FUNCTION public.operator_request_action(uuid,bigint,text,jsonb,bigint) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.operator_request_action(uuid,bigint,text,jsonb,bigint) TO service_role;