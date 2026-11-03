CREATE OR REPLACE FUNCTION public.save_branch_location(p_branch_id uuid DEFAULT NULL, p_name text DEFAULT NULL, p_latitude double precision DEFAULT NULL, p_longitude double precision DEFAULT NULL, p_chat_id text DEFAULT NULL, p_map_url text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
 IF p_name IS NULL OR length(trim(p_name))=0 OR p_latitude IS NULL OR p_longitude IS NULL THEN RAISE EXCEPTION 'Filial nomi va koordinatalari kerak'; END IF;
 IF p_branch_id IS NULL THEN
 INSERT INTO public.branches(name,map_type,yandex_map_url) VALUES(p_name,'yandex',p_map_url) RETURNING id INTO v_id;
 ELSE
 UPDATE public.branches SET name=p_name,map_type='yandex',yandex_map_url=p_map_url WHERE id=p_branch_id RETURNING id INTO v_id;
 IF v_id IS NULL THEN RAISE EXCEPTION 'Filial topilmadi'; END IF;
 END IF;
 INSERT INTO public.branch_locations(branch_id,latitude,longitude,telegram_chat_id,yandex_map_url) VALUES(v_id,p_latitude,p_longitude,NULLIF(p_chat_id,''),p_map_url)
 ON CONFLICT(branch_id) DO UPDATE SET latitude=excluded.latitude,longitude=excluded.longitude,telegram_chat_id=excluded.telegram_chat_id,yandex_map_url=excluded.yandex_map_url,updated_at=now();
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.save_branch_location(uuid,text,double precision,double precision,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_branch_location(uuid,text,double precision,double precision,text,text) TO service_role;