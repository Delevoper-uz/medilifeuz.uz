import { useEffect, useRef } from 'react';
import {
  Pill, Tablets, Syringe, Stethoscope, HeartPulse, Cross, Ambulance,
  Truck, Package, PackageCheck, Bike, ShieldPlus, Thermometer,
  Bandage, Microscope, TestTube, FlaskConical, BriefcaseMedical,
  Hospital, ClipboardPlus,
} from 'lucide-react';
import { useRouterState } from '@tanstack/react-router';

const icons = [Pill, Tablets, Syringe, Stethoscope, HeartPulse, Cross, Ambulance,
  Truck, Package, PackageCheck, Bike, ShieldPlus, Thermometer, Bandage,
  Microscope, TestTube, FlaskConical, BriefcaseMedical, Hospital, ClipboardPlus];

/** Fixed-size, noninteractive scenery; particles recycle only outside the viewport. */
export function AmbientEffects() {
  const path = useRouterState({ select: state => state.location.pathname });
  const active = useRef(false);
  const hidden = path === '/admin' || path === '/login';

  useEffect(() => {
    if (hidden) return;
    let disposed = false;
    let frame = 0;
    let stop: (() => void) | undefined;
    const celebrate = async () => {
      if (active.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      active.current = true;
      try {
        const { default: confetti } = await import('canvas-confetti');
        if (disposed) return;
        const canvas = document.createElement('canvas');
        canvas.className = 'medilife-welcome-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
        const shoot = confetti.create(canvas, { resize: true, useWorker: true });
        const theme = getComputedStyle(document.documentElement);
        const colors = ['--celebration-green', '--celebration-coral', '--celebration-gold', '--celebration-cyan']
          .map(token => theme.getPropertyValue(token).trim());
        const start = performance.now();
        const finish = () => { shoot.reset(); canvas.remove(); };
        let timer: ReturnType<typeof setTimeout> | undefined;
        stop = () => { cancelAnimationFrame(frame); clearTimeout(timer); finish(); };
        let lastShot = -100;
        const burst = (now: number) => {
          if (disposed || document.hidden) { stop?.(); return; }
          if (now - start > 1600) { timer = setTimeout(finish, 3500); return; }
          if (now - lastShot > 120) {
            lastShot = now;
            const options = { particleCount: 12, spread: 58, startVelocity: 44, gravity: 0.85, ticks: 160, colors, disableForReducedMotion: true };
            void shoot({ ...options, angle: 58, origin: { x: 0, y: 0.72 } });
            void shoot({ ...options, angle: 122, origin: { x: 1, y: 0.72 } });
          }
          frame = requestAnimationFrame(burst);
        };
        frame = requestAnimationFrame(burst);
      } catch { /* Decorations must never block the catalogue. */ }
    };
    window.addEventListener('medilife:welcome', celebrate);
    return () => {
      disposed = true;
      window.removeEventListener('medilife:welcome', celebrate);
      stop?.();
    };
  }, [hidden]);

  if (hidden) return null;
  return <div className="medilife-icon-rain" aria-hidden="true">
    {Array.from({ length: 60 }, (_, index) => {
      const Icon = icons[index % icons.length];
      if (!Icon) return null;
      return <span key={index} className="medilife-rain-particle"><Icon strokeWidth={1.4} /></span>;
    })}
  </div>;
}