import { useInfiniteQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { AppLoading } from '@/components/AppLoading';
import { MedicineCard, type Medicine } from '@/components/MedicineCard';
import { Button } from '@/components/ui/button';
import { Plus, RotateCw } from 'lucide-react';
import { pickMedicineBatch, RANDOM_BATCH_SIZE } from '@/lib/random-medicines';

export function RandomMedicines() {
  const { i18n, t } = useTranslation();
  const cyrillic = i18n.language === 'uz_cyrl';
  const language = cyrillic ? 'cyrillic' : 'latin';
  const catalogue = useInfiniteQuery({
    queryKey: ['random-medicine-batches', language],
    initialPageParam: [] as Medicine[],
    staleTime: Infinity,
    gcTime: 0,
    queryFn: async ({ pageParam }) => {
      let batch: Medicine[] = [];
      for (let attempt = 0; attempt < 4 && batch.length < RANDOM_BATCH_SIZE; attempt++) {
        const pivot = crypto.randomUUID();
        // Indexed UUID seek avoids exact counts and expensive deep offsets.
        const result = await supabase.from('medicines').select('*').eq('language', language)
          .gte('id', pivot).order('id').limit(200);
        if (result.error) throw new Error(result.error.message);
        let pool = (result.data ?? []) as Medicine[];
        if (pool.length < 200) {
          const wrapped = await supabase.from('medicines').select('*').eq('language', language)
            .lt('id', pivot).order('id').limit(200 - pool.length);
          if (wrapped.error) throw new Error(wrapped.error.message);
          pool = [...pool, ...(wrapped.data ?? []) as Medicine[]];
        }
        batch = [...batch, ...pickMedicineBatch(pool, [...pageParam, ...batch])].slice(0, RANDOM_BATCH_SIZE);
      }
      return batch;
    },
    getNextPageParam: (lastPage, pages) => lastPage.length === RANDOM_BATCH_SIZE ? pages.flat() : undefined,
  });
  const medicines = catalogue.data?.pages.flat() ?? [];
  if (catalogue.isPending) return <AppLoading />;
  if (catalogue.isError && !medicines.length) return (
    <Button variant="outline" onClick={() => catalogue.refetch()}><RotateCw className="h-4 w-4" />{cyrillic ? 'Қайта юклаш' : 'Qayta yuklash'}</Button>
  );
  if (!medicines.length) return <p className="text-muted-foreground">{t('medicines.empty')}</p>;
  return <>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="random-medicines">
      {medicines.map(m => <MedicineCard key={m.id} m={m} />)}
    </div>
    {catalogue.hasNextPage && <div className="flex justify-center mt-6">
      <Button variant="outline" disabled={catalogue.isFetchingNextPage} onClick={() => catalogue.fetchNextPage()}>
        <Plus className="h-4 w-4" />{catalogue.isFetchingNextPage ? t('common.loading') : cyrillic ? 'Яна 20 та кўрсатиш' : 'Yana 20 ta ko‘rsatish'}
      </Button>
    </div>}
    {catalogue.isFetchNextPageError && <p role="alert" className="text-center text-muted-foreground mt-2">{cyrillic ? 'Юкланмади. Қайта уриниб кўринг.' : 'Yuklanmadi. Qayta urinib ko‘ring.'}</p>}
  </>;
}