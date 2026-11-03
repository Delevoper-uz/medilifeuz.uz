import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { Pencil, Plus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { YandexAddressPicker } from './YandexAddressPicker';
import { adminListBranches } from '@/lib/admin.functions';
import { adminListBranchLocations, adminResolveYandexLink, adminSaveBranchLocation } from '@/lib/branch-locations.functions';
import { isValidCoordinates } from '@/lib/branches';

const empty = { branch_id: null as string | null, name: '', latitude: '', longitude: '', telegram_chat_id: '', yandex_map_url: '' };

export function BranchCoordinatesAdmin() {
  const listBranches = useServerFn(adminListBranches);
  const listLocations = useServerFn(adminListBranchLocations);
  const resolveLink = useServerFn(adminResolveYandexLink);
  const saveLocation = useServerFn(adminSaveBranchLocation);
  const queryClient = useQueryClient();
  const { data: branches = [] } = useQuery({ queryKey: ['admin-branches'], queryFn: () => listBranches({ data: {} }) });
  const { data: locations = [] } = useQuery({ queryKey: ['admin-branch-locations'], queryFn: () => listLocations() });
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ready = form.latitude.trim() !== '' && form.longitude.trim() !== '' && isValidCoordinates(Number(form.latitude), Number(form.longitude));
  const errorMessage = (e: unknown) => e instanceof Error ? e.message : 'Xatolik yuz berdi';

  const readLink = async () => {
    setBusy(true);
    try {
      const result = await resolveLink({ data: { url: form.yandex_map_url.trim() } });
      setForm(f => ({ ...f, latitude: String(result.latitude), longitude: String(result.longitude) }));
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };

  const save = async () => {
    if (!ready || !form.name.trim()) return;
    setBusy(true);
    try {
      await saveLocation({ data: { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), telegram_chat_id: form.telegram_chat_id || null, yandex_map_url: form.yandex_map_url || null } });
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['admin-branches'] }), queryClient.invalidateQueries({ queryKey: ['admin-branch-locations'] }), queryClient.invalidateQueries({ queryKey: ['branches-all'] })]);
      toast.success('Filial joylashuvi saqlandi');
      setOpen(false);
    } catch (e) { toast.error(errorMessage(e)); }
    finally { setBusy(false); }
  };

  return <div className="space-y-4">
    <Button className="gap-2" onClick={() => { setForm(empty); setOpen(true); }}><Plus className="h-4 w-4" /> Joylashuv qo‘shish</Button>
    <div className="grid gap-3 md:grid-cols-2">
      {branches.map(b => {
        const location = locations.find(l => l.branch_id === b.id);
        return <Card key={b.id} className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0"><h3 className="font-semibold break-words">{b.name}</h3>
            <p className="text-sm text-muted-foreground">{location ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}` : 'Joylashuv kiritilmagan'}</p>
          </div>
          <Button variant="outline" size="icon" aria-label={`${b.name} joylashuvini tahrirlash`} onClick={() => {
            setForm({ branch_id: b.id, name: b.name, latitude: location ? String(location.latitude) : '', longitude: location ? String(location.longitude) : '', telegram_chat_id: location?.telegram_chat_id ?? '', yandex_map_url: location?.yandex_map_url ?? b.yandex_map_url ?? '' });
            setOpen(true);
          }}><Pencil className="h-4 w-4" /></Button>
        </Card>;
      })}
    </div>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Maps Coordinate</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Filial</Label><Select value={form.branch_id ?? 'new'} onValueChange={id => {
            const b = branches.find(b => b.id === id);
            const l = locations.find(l => l.branch_id === id);
            setForm(b ? { branch_id: b.id, name: b.name, latitude: l ? String(l.latitude) : '', longitude: l ? String(l.longitude) : '', telegram_chat_id: l?.telegram_chat_id ?? '', yandex_map_url: l?.yandex_map_url ?? b.yandex_map_url ?? '' } : empty);
          }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">Yangi filial</SelectItem>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="branch-map-link">Yandex Maps havolasi</Label><Input id="branch-map-link" value={form.yandex_map_url} onChange={e => setForm({ ...form, yandex_map_url: e.target.value })} placeholder="https://yandex.uz/maps/..." /><Button variant="outline" disabled={busy || !form.yandex_map_url.trim()} onClick={() => void readLink()}>Nuqtani olish</Button></div>
          <YandexAddressPicker onPick={(_address, url, coords) => { if (coords) setForm(f => ({ ...f, latitude: String(coords[0]), longitude: String(coords[1]), yandex_map_url: url ?? '' })); }} />
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="branch-lat">Kenglik (latitude)</Label><Input id="branch-lat" type="number" step="any" min={-90} max={90} value={form.latitude} onChange={e => setForm({ ...form, latitude: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="branch-lng">Uzunlik (longitude)</Label><Input id="branch-lng" type="number" step="any" min={-180} max={180} value={form.longitude} onChange={e => setForm({ ...form, longitude: e.target.value })} /></div>
          </div>
          {ready && <div className="space-y-2"><Label htmlFor="branch-location-name">Filial nomi</Label><Input id="branch-location-name" placeholder="4 filial" maxLength={180} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>}
          <div className="space-y-2"><Label htmlFor="branch-chat">Telegram guruh ID (ixtiyoriy)</Label><Input id="branch-chat" placeholder="-100..." value={form.telegram_chat_id} onChange={e => setForm({ ...form, telegram_chat_id: e.target.value })} /></div>
          <Button className="w-full" disabled={busy || !ready || !form.name.trim()} onClick={() => void save()}>{busy ? 'Saqlanmoqda…' : 'Saqlash'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}