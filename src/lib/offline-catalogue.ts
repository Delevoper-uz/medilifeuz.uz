import type { Medicine } from '@/components/MedicineCard';
type StoredMedicine = Medicine & { language?: string | null };
let opening: Promise<IDBDatabase> | undefined;
function database() {
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('medilife-offline', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('medicines', { keyPath: 'id' });
      request.result.createObjectStore('settings');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => { opening = undefined; reject(request.error); };
  });
  return opening;
}
export async function saveOfflineMedicines(rows: StoredMedicine[]) {
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('medicines', 'readwrite');
    for (const row of rows) tx.objectStore('medicines').put(row);
    tx.oncomplete = () => { window.dispatchEvent(new Event('medilife-catalogue-saved')); resolve(); };
    tx.onerror = () => reject(tx.error);
  });
}
export async function offlineMedicines(language: string, query: string, min: number, max: number, sort: string, page: number, size: number) {
  const db = await database();
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const rows = await new Promise<StoredMedicine[]>((resolve, reject) => {
    const found: StoredMedicine[] = [];
    const request = db.transaction('medicines').objectStore('medicines').openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(found); return; }
      const m = cursor.value as StoredMedicine;
      const name = `${m.name} ${m.name_cyrl ?? ''}`.toLowerCase();
      if ((!m.language || m.language === language) && words.every(w => name.includes(w)) && (!min || Number(m.price) >= min) && (!max || Number(m.price) <= max)) found.push(m);
      cursor.continue();
    };
  });
  if (sort === 'random') {
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rows[i], rows[j]] = [rows[j] as StoredMedicine, rows[i] as StoredMedicine];
    }
  } else rows.sort((a, b) => sort.startsWith('price') ? (Number(a.price) - Number(b.price)) * (sort === 'price-asc' ? 1 : -1) : (language === 'cyrillic' ? a.name_cyrl || a.name : a.name).localeCompare(language === 'cyrillic' ? b.name_cyrl || b.name : b.name) * (sort === 'az' ? 1 : -1));
  return { rows: rows.slice(page * size, (page + 1) * size), total: rows.length };
}
export async function saveOfflineImage(url: string) {
  const response = await fetch(url);
  if (!response.ok) return;
  const blob = await response.blob();
  const db = await database();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put(blob, 'medicine-image');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
  });
}
export async function readOfflineImage() {
  const db = await database();
  return new Promise<string | null>((resolve) => {
    const request = db.transaction('settings').objectStore('settings').get('medicine-image');
    request.onsuccess = () => resolve(request.result instanceof Blob ? URL.createObjectURL(request.result) : null);
    request.onerror = () => resolve(null);
  });
}