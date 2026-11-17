import { UAParser } from 'ua-parser-js';
import { z } from 'zod';

export function requestMetadata(headers: Headers, trustedEdge: boolean) {
  // Forwarded headers from arbitrary clients must never become visitor identities.
  const candidate = trustedEdge && !headers.has('cf-worker')
    ? (headers.get('cf-connecting-ipv6') || headers.get('cf-connecting-ip')) : null;
  const parsed = z.string().ip().safeParse(candidate);
  const ua = new UAParser((headers.get('user-agent') ?? '').slice(0, 1000)).getResult();
  const kind = ua.device.type === 'mobile' ? 'Telefon' : ua.device.type === 'tablet' ? 'Planshet' : 'Kompyuter';
  const model = [ua.device.vendor, ua.device.model].filter(Boolean).join(' ');
  return {
    ip_address: parsed.success ? parsed.data : null,
    device: ua.ua ? (model ? `${kind} · ${model}` : kind) : 'Noma’lum',
    browser: [ua.browser.name, ua.browser.version].filter(Boolean).join(' ') || 'Noma’lum',
    os: [ua.os.name, ua.os.version].filter(Boolean).join(' ') || 'Noma’lum',
  };
}

export const VisitSchema = z.object({
  path: z.enum(['/', '/dorilar', '/filiallar', '/yangiliklar', '/savatcha', '/doktor-korigi', '/login', '/admin']),
});

export type VisitorGroup = {
  ip_address: string | null; visits: number; first_seen: string; last_seen: string;
  device: string; browser: string; os: string;
};