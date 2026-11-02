import { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { WifiOff, Wifi } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { registerOfflineWorker } from '@/lib/offline-worker';
import { blockOfflineRefresh } from '@/lib/offline-policy';
import { saveOfflineMedicines, saveOfflineImage, readOfflineImage } from '@/lib/offline-catalogue';
import medicineImage from '@/assets/medicine-offline.jpg.asset.json';
import type { Medicine } from './MedicineCard';

const OfflineContext = createContext({ offline: false, image: medicineImage.url, enter: () => {} });
export const useOfflineMode = () => useContext(OfflineContext);
export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [offline, setOffline] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [image, setImage] = useState(medicineImage.url);
  const [revision, setRevision] = useState(0);
  const { i18n } = useTranslation();
  const cyrl = i18n.language === 'uz_cyrl';
  const navigate = useNavigate();
  const pathname = useRouterState({ select: s => s.location.pathname });
  useEffect(() => {
    void registerOfflineWorker().catch(() => undefined);
    let disposed = false;
    let imageUrl: string | null = null;
    void readOfflineImage().then(url => { if (disposed) { if (url) URL.revokeObjectURL(url); return; } if (url) { imageUrl = url; setImage(url); } }).catch(() => undefined);
    const connection = (navigator as Navigator & { connection?: EventTarget & { effectiveType?: string } }).connection;
    const check = () => setUnavailable(!navigator.onLine || ['slow-2g', '2g'].includes(connection?.effectiveType ?? ''));
    if (!navigator.onLine) setOffline(true);
    const failed = () => setUnavailable(true);
    check();
    window.addEventListener('online', check); window.addEventListener('offline', check);
    window.addEventListener('medilife-network-failed', failed); connection?.addEventListener('change', check);
    return () => { disposed = true; if (imageUrl) URL.revokeObjectURL(imageUrl); window.removeEventListener('online', check); window.removeEventListener('offline', check); window.removeEventListener('medilife-network-failed', failed); connection?.removeEventListener('change', check); };
  }, []);
  useEffect(() => {
    if (offline || !navigator.onLine) return;
    let cancelled = false;
    const controller = new AbortController();
    const stop = () => controller.abort();
    window.addEventListener('offline', stop);
    // Save the public catalogue in small batches; never cache private orders, OTPs or admin data.
    void (async () => {
      await saveOfflineImage(medicineImage.url).catch(() => undefined);
      const storedImage = await readOfflineImage().catch(() => null);
      if (storedImage) {
        if (cancelled) URL.revokeObjectURL(storedImage);
        else setImage(previous => { if (previous.startsWith('blob:')) URL.revokeObjectURL(previous); return storedImage; });
      }
      let lastId: string | undefined;
      for (; !cancelled && !controller.signal.aborted;) {
        let batch = supabase.from('medicines').select('id,name,name_cyrl,price,unit,stock,description,image_url,language').order('id').limit(500);
        if (lastId) batch = batch.gt('id', lastId);
        const { data, error } = await batch.abortSignal(controller.signal);
        if (error || !data?.length || cancelled) break;
        await saveOfflineMedicines(data as Medicine[]);
        lastId = data[data.length - 1]?.id;
        if (data.length < 500 || !lastId) break;
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    })().catch(() => undefined);
    return () => { cancelled = true; controller.abort(); window.removeEventListener('offline', stop); };
  }, [offline, revision]);
  useEffect(() => {
    if (!offline) return;
    if (pathname !== '/dorilar') void navigate({ to: '/dorilar', replace: true });
    const key = (e: KeyboardEvent) => { if (blockOfflineRefresh(e.key, e.code, e.ctrlKey, e.metaKey)) e.preventDefault(); };
    const link = (e: MouseEvent) => {
      const a = e.target instanceof Element ? e.target.closest('a') : null;
      if (a && new URL(a.href, location.href).origin === location.origin && new URL(a.href, location.href).pathname !== '/dorilar') e.preventDefault();
    };
    let start = 0;
    const touchStart = (e: TouchEvent) => { start = e.touches[0]?.clientY ?? 0; };
    const touchMove = (e: TouchEvent) => { if (window.scrollY <= 0 && (e.touches[0]?.clientY ?? 0) > start) e.preventDefault(); };
    document.documentElement.classList.add('medilife-offline');
    window.addEventListener('keydown', key, { capture: true }); document.addEventListener('click', link, true);
    document.addEventListener('touchstart', touchStart, { passive: true }); document.addEventListener('touchmove', touchMove, { passive: false });
    return () => { document.documentElement.classList.remove('medilife-offline'); window.removeEventListener('keydown', key, true); document.removeEventListener('click', link, true); document.removeEventListener('touchstart', touchStart); document.removeEventListener('touchmove', touchMove); };
  }, [offline, pathname, navigate]);
  return <OfflineContext.Provider value={{ offline, image, enter: () => setOffline(true) }}>
    {(unavailable || offline) && <div className="border-b bg-muted px-4 py-3 flex flex-wrap items-center justify-center gap-3" role="status">
      <WifiOff className="h-5 w-5 text-primary" /><span>{offline ? (cyrl ? 'Офлайн режим' : 'Offlayn rejim') : (cyrl ? 'Интернет алоқаси суст ёки узилган' : 'Internet aloqasi sust yoki uzilgan')}</span>
      {offline ? <Button variant="outline" disabled={!navigator.onLine} onClick={() => { setOffline(false); setUnavailable(false); setRevision(v => v + 1); }}><Wifi className="h-4 w-4" />{cyrl ? 'Онлайнга қайтиш' : 'Onlaynga qaytish'}</Button> : <Button onClick={() => setOffline(true)}><WifiOff className="h-4 w-4" />{cyrl ? 'Офлайн режимга ўтиш' : 'Offlayn rejimga o‘tish'}</Button>}
    </div>}
    {children}
  </OfflineContext.Provider>;
}