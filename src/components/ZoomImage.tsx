import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

type ZoomImageProps = {
  src: string;
  alt?: string;
  /** classes for the clickable wrapper (size of the thumbnail) */
  className?: string;
  /** classes for the thumbnail <img> */
  imgClassName?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 4;

/** Thumbnail that opens fullscreen on click and can be zoomed in/out (wheel, click, +/-). */
export function ZoomImage({ src, alt = "", className, imgClassName }: ZoomImageProps) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(MIN_SCALE);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  const [broken, setBroken] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setScale(MIN_SCALE);
    setOrigin({ x: 50, y: 50 });
  }, []);

  const toggle = useCallback(() => {
    setScale((s) => (s > MIN_SCALE ? MIN_SCALE : 2.2));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "+" || e.key === "=") setScale((s) => Math.min(MAX_SCALE, s + 0.5));
      if (e.key === "-") setScale((s) => Math.max(MIN_SCALE, s - 0.5));
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  if (broken) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={alt ? `${alt} — rasmni kattalashtirish` : "Rasmni kattalashtirish"}
        className={cn("group relative block w-full cursor-zoom-in overflow-hidden bg-muted", className)}
      >
        <img
          src={src}
          alt={alt}
          onError={() => setBroken(true)}
          className={cn("h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]", imgClassName)}
        />
        <span className="absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
          <Maximize2 className="h-3.5 w-3.5" />
          Kattalashtirish
        </span>
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="medilife-zoom-overlay fixed inset-0 z-[110] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={alt || "Rasm"}
            onClick={close}
          >
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <p className="truncate text-sm font-medium text-white/80">{alt}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Yaqinlashtirish"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScale((s) => Math.min(MAX_SCALE, s + 0.5));
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 transition-colors hover:bg-white/15"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Uzoqlashtirish"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScale((s) => Math.max(MIN_SCALE, s - 0.5));
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 transition-colors hover:bg-white/15"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Yopish"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/90 transition-colors hover:bg-white/15"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              ref={stageRef}
              className="flex-1 overflow-hidden px-4 pb-6"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              onWheel={(e) => {
                e.stopPropagation();
                setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s + (e.deltaY < 0 ? 0.25 : -0.25))));
              }}
              onMouseMove={(e) => {
                const rect = stageRef.current?.getBoundingClientRect();
                if (!rect) return;
                setOrigin({
                  x: Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)),
                  y: Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)),
                });
              }}
            >
              <div className="flex h-full w-full items-center justify-center">
                <img
                  src={src}
                  alt={alt}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle();
                  }}
                  style={{ transform: `scale(${scale})`, transformOrigin: `${origin.x}% ${origin.y}%` }}
                  className={cn(
                    "medilife-zoom-image max-h-full max-w-full rounded-lg object-contain shadow-2xl",
                    scale > MIN_SCALE ? "cursor-zoom-out" : "cursor-zoom-in",
                  )}
                />
              </div>
            </div>

            <p className="px-4 pb-4 text-center text-xs text-white/45">
              {scale > MIN_SCALE ? "Uzoqlashtirish uchun bosing · g'ildirak bilan yaqinlashtiring" : "Yaqinlashtirish uchun bosing yoki g'ildirakni aylantiring"}
            </p>
          </div>,
          document.body,
        )}
    </>
  );
}
