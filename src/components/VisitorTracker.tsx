import { useEffect, useRef } from 'react';
import { useRouterState } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { recordVisit } from '@/lib/visitors.functions';
import { VisitSchema } from '@/lib/request-metadata';

export function VisitorTracker() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const record = useServerFn(recordVisit);
  const last = useRef<string | null>(null);
  useEffect(() => {
    const path = VisitSchema.shape.path.safeParse(pathname);
    if (!path.success || last.current === pathname) return;
    last.current = pathname;
    void record({ data: { path: path.data } }).then(result => {
      if (pathname === '/admin' || pathname === '/login') return;
      let welcome = result.welcome === true;
      // Preview has no trustworthy edge IP: use a browser-only fallback, never a fake IP.
      if (result.welcome === null) {
        try {
          welcome = localStorage.getItem('medilife-welcomed') !== '1';
          if (welcome) localStorage.setItem('medilife-welcomed', '1');
        } catch { welcome = false; }
      }
      if (welcome && pathname !== '/admin' && pathname !== '/login') {
        window.dispatchEvent(new Event('medilife:welcome'));
      }
    }).catch(() => {});
  }, [pathname, record]);
  return null;
}