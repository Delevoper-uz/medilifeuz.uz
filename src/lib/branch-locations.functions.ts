import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireAdminPanel } from './admin-middleware';
import { coordinatesFromYandexUrl, isYandexMapUrl } from './branches';

const LocationSchema = z.object({
  branch_id: z.string().uuid().nullable(),
  name: z.string().trim().min(1).max(180),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  telegram_chat_id: z.string().trim().max(100).nullable(),
  yandex_map_url: z.string().max(1500).nullable(),
});

export const adminListBranchLocations = createServerFn({ method: 'POST' })
  .middleware([requireAdminPanel])
  .handler(async () => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const { data, error } = await supabaseAdmin.from('branch_locations').select('*');
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminSaveBranchLocation = createServerFn({ method: 'POST' })
  .middleware([requireAdminPanel])
  .inputValidator((i) => LocationSchema.parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const mapUrl = `https://yandex.uz/maps/?pt=${data.longitude},${data.latitude}&ll=${data.longitude},${data.latitude}&z=17`;
    const { data: id, error } = await supabaseAdmin.rpc('save_branch_location', {
      p_branch_id: data.branch_id ?? undefined, p_name: data.name, p_latitude: data.latitude,
      p_longitude: data.longitude, p_chat_id: data.telegram_chat_id || '', p_map_url: mapUrl,
    });
    if (error) throw new Error(error.message);
    return { id };
  });

export const adminResolveYandexLink = createServerFn({ method: 'POST' })
  .middleware([requireAdminPanel])
  .inputValidator((i) => z.object({ url: z.string().max(1500) }).parse(i))
  .handler(async ({ data }) => {
    let url = data.url;
    for (let n = 0; n < 5; n++) {
      if (!isYandexMapUrl(url)) throw new Error('Yandex Maps havolasini kiriting');
      const coords = coordinatesFromYandexUrl(url);
      if (coords) return { latitude: coords[0], longitude: coords[1] };
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (response.status >= 300 && response.status < 400 && location) {
        url = new URL(location, url).href;
      } else break;
    }
    throw new Error('Havolada nuqta topilmadi. Xaritadan nuqta tanlang yoki koordinatalarni kiriting.');
  });