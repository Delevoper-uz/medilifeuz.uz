import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AppLoading } from '@/components/AppLoading';
import { adminVisitorGroups, adminVisitorHistory } from '@/lib/visitors.functions';
import type { VisitorGroup } from '@/lib/request-metadata';

const time = (value: string) => new Date(value).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' });

function Pager({ page, total, change }: { page: number; total: number; change: (page: number) => void }) {
  return <div className="flex items-center justify-end gap-3 py-3">
    <span className="text-sm text-muted-foreground">{total} ta · {page + 1}-sahifa</span>
    <Button variant="outline" size="icon" title="Oldingi sahifa" aria-label="Oldingi sahifa" disabled={page === 0} onClick={() => change(page - 1)}><ChevronLeft className="h-4 w-4" /></Button>
    <Button variant="outline" size="icon" title="Keyingi sahifa" aria-label="Keyingi sahifa" disabled={(page + 1) * 50 >= total} onClick={() => change(page + 1)}><ChevronRight className="h-4 w-4" /></Button>
  </div>;
}

function History({ group }: { group: VisitorGroup }) {
  const [page, setPage] = useState(0);
  const history = useServerFn(adminVisitorHistory);
  const query = useQuery({ queryKey: ['admin-visitor-history', group.ip_address, page], queryFn: () => history({ data: { ip: group.ip_address, page } }) });
  if (query.isPending) return <AppLoading />;
  if (query.isError) return <p className="text-destructive">Kirish tarixi olinmadi.</p>;
  return <>
    <div className="max-h-[55vh] overflow-auto divide-y divide-border">
      {query.data.rows.map(row => <div key={row.id} className="py-3 space-y-1">
        <p className="font-medium">{row.path} <span className="text-xs font-normal text-muted-foreground">· {time(row.created_at)}</span></p>
        <p className="text-sm break-words text-muted-foreground">{row.device} · {row.os} · {row.browser}</p>
      </div>)}
      {!query.data.rows.length && <p className="py-6 text-muted-foreground">Kirishlar yo‘q.</p>}
    </div>
    <Pager page={page} total={query.data.total} change={setPage} />
  </>;
}

export function VisitorsAdmin() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<VisitorGroup | null>(null);
  const groups = useServerFn(adminVisitorGroups);
  const query = useQuery({ queryKey: ['admin-visitor-groups', search, page], queryFn: () => groups({ data: { search, page } }) });
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-xl font-semibold">Kirishlar</h2>
      <div className="flex items-center gap-2">
        <Input className="w-full sm:w-64" aria-label="IP qidirish" placeholder="IP qidirish" value={search} maxLength={64} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        <Button variant="outline" size="icon" title="Yangilash" aria-label="Yangilash" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw className="h-4 w-4" /></Button>
      </div>
    </div>
    <p className="text-sm text-muted-foreground">Bir IP orqali bir nechta odam kirishi mumkin. Qurilma turi brauzer ma’lumotiga asoslangan.</p>
    {query.isPending ? <AppLoading /> : query.isError ? <p className="text-destructive">Kirishlar olinmadi.</p> : <>
      <div className="overflow-x-auto border-y border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted text-muted-foreground"><tr>{['IP manzil', 'Qurilma / brauzer', 'Kirishlar', 'Oxirgi kirish'].map(title => <th key={title} className="p-3 font-medium whitespace-nowrap">{title}</th>)}</tr></thead>
          <tbody className="divide-y divide-border">{query.data.rows.map(group => <tr key={group.ip_address ?? 'unknown'}>
            <td className="p-3"><Button variant="link" className="h-auto p-0 text-left whitespace-normal break-all" onClick={() => setSelected(group)}>{group.ip_address ?? 'IP aniqlanmadi'}</Button></td>
            <td className="p-3"><p>{group.device}</p><p className="text-xs text-muted-foreground">{group.os} · {group.browser}</p></td>
            <td className="p-3 tabular-nums">{group.visits}</td><td className="p-3 whitespace-nowrap">{time(group.last_seen)}</td>
          </tr>)}</tbody>
        </table>
        {!query.data.rows.length && <p className="py-8 text-center text-muted-foreground">Kirishlar topilmadi.</p>}
      </div>
      <Pager page={page} total={query.data.total} change={setPage} />
    </>}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open) setSelected(null); }}>
      <DialogContent className="sm:max-w-2xl min-w-0">
        <DialogHeader><DialogTitle className="break-all">{selected?.ip_address ?? 'IP aniqlanmadi'} · Kirish tarixi</DialogTitle></DialogHeader>
        {selected && <History key={selected.ip_address ?? 'unknown'} group={selected} />}
      </DialogContent>
    </Dialog>
  </section>;
}