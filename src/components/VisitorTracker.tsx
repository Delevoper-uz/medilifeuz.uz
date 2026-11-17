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
    void record({ data: { path: path.data } }).catch(() => {});
  }, [pathname, record]);
  return null;
}