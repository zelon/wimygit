import { useRef, useState, useCallback, useEffect } from "react";

export type ImageDiffMode = "side-by-side" | "slider";

const CHECKER = "repeating-conic-gradient(#d1d5db 0% 25%, #ffffff 0% 50%) 0 0 / 12px 12px";

function base64ByteSize(dataUrl: string): number {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = (b64.match(/=+$/) ?? [""])[0].length;
  return Math.floor((b64.length * 3) / 4) - padding;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

interface ContainRect { x: number; y: number; w: number; h: number; }

function computeContainRect(natW: number, natH: number, cW: number, cH: number): ContainRect {
  const imageAspect = natW / natH;
  const containerAspect = cW / cH;
  let w: number, h: number;
  if (imageAspect >= containerAspect) {
    w = cW; h = cW / imageAspect;
  } else {
    h = cH; w = cH * imageAspect;
  }
  return { x: (cW - w) / 2, y: (cH - h) / 2, w, h };
}

interface ImageDiffViewerProps {
  beforeSrc: string;
  afterSrc: string;
  filename?: string;
  mode: ImageDiffMode;
}

export function ImageDiffViewer({ beforeSrc, afterSrc, filename, mode }: ImageDiffViewerProps) {
  const [sliderPct, setSliderPct] = useState(50);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [beforeNatural, setBeforeNatural] = useState<{ w: number; h: number } | null>(null);
  const [afterNatural, setAfterNatural] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  // Load natural dimensions via a detached Image object.
  // Using `new Image()` (not the rendered <img>) ensures the onload handler
  // is always attached before src is set, avoiding the cached-data-URL race
  // where the browser fires onload synchronously before React attaches listeners.
  useEffect(() => {
    setBeforeNatural(null);
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setBeforeNatural({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = beforeSrc;
    return () => { cancelled = true; };
  }, [beforeSrc]);

  useEffect(() => {
    setAfterNatural(null);
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setAfterNatural({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.src = afterSrc;
    return () => { cancelled = true; };
  }, [afterSrc]);

  // Track container size for letterbox calculation (slider mode only)
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [mode]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
  }, []);

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setSliderPct(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  const beforeSize = formatBytes(base64ByteSize(beforeSrc));
  const afterSize = formatBytes(base64ByteSize(afterSrc));

  // ── Info bar ──────────────────────────────────────────────────────────────
  const infoBar = (
    <div className="shrink-0 flex border-b border-gray-700 text-xs bg-gray-900 select-none">
      <div className="flex-1 flex items-center justify-center gap-2 px-2 py-1 border-r border-gray-700 min-w-0">
        <span className="inline-flex items-center overflow-hidden rounded shrink-0">
          <span className="px-1.5 py-0.5 font-semibold bg-blue-600 text-white leading-4">BEFORE</span>
        </span>
        <span className="text-gray-400 truncate">
          {beforeNatural ? `${beforeNatural.w}×${beforeNatural.h}` : "—"}
        </span>
        <span className="text-gray-500 shrink-0">{beforeSize}</span>
      </div>
      <div className="flex-1 flex items-center justify-center gap-2 px-2 py-1 min-w-0">
        <span className="inline-flex items-center overflow-hidden rounded shrink-0">
          <span className="px-1.5 py-0.5 font-semibold bg-green-600 text-white leading-4">AFTER</span>
        </span>
        <span className="text-gray-400 truncate">
          {afterNatural ? `${afterNatural.w}×${afterNatural.h}` : "—"}
        </span>
        <span className="text-gray-500 shrink-0">{afterSize}</span>
      </div>
    </div>
  );

  // ── Side by side ──────────────────────────────────────────────────────────
  if (mode === "side-by-side") {
    return (
      <div className="flex flex-col h-full">
        {infoBar}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 bg-black flex items-center justify-center overflow-auto p-2 border-r border-gray-600">
            <img
              src={beforeSrc}
              alt={`before: ${filename}`}
              className="max-w-full max-h-full block"
              style={{ background: CHECKER }}
            />
          </div>
          <div className="flex-1 bg-black flex items-center justify-center overflow-auto p-2">
            <img
              src={afterSrc}
              alt={`after: ${filename}`}
              className="max-w-full max-h-full block"
              style={{ background: CHECKER }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Slider ────────────────────────────────────────────────────────────────
  const lb = afterNatural && containerSize
    ? computeContainRect(afterNatural.w, afterNatural.h, containerSize.w, containerSize.h)
    : null;

  return (
    <div className="flex flex-col h-full">
      {infoBar}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-black cursor-col-resize select-none"
      >
        {/* After image */}
        <img
          src={afterSrc}
          alt={`after: ${filename}`}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ background: CHECKER }}
        />
        {/* Before image — clipped from the right */}
        <img
          src={beforeSrc}
          alt={`before: ${filename}`}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ background: CHECKER, clipPath: `inset(0 ${100 - sliderPct}% 0 0)` }}
        />

        {/* Black covers over letterbox areas */}
        {lb && lb.y > 0 && (
          <>
            <div className="absolute inset-x-0 bg-black" style={{ top: 0, height: lb.y }} />
            <div className="absolute inset-x-0 bg-black" style={{ bottom: 0, height: lb.y }} />
          </>
        )}
        {lb && lb.x > 0 && (
          <>
            <div className="absolute inset-y-0 bg-black" style={{ left: 0, width: lb.x }} />
            <div className="absolute inset-y-0 bg-black" style={{ right: 0, width: lb.x }} />
          </>
        )}

        {/* Divider */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-20"
          style={{ left: `calc(${sliderPct}% - 1px)` }}
          onMouseDown={onMouseDown}
        >
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white shadow-md border border-gray-300 flex items-center justify-center cursor-col-resize">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 2L1 5L3 8M7 2L9 5L7 8" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
