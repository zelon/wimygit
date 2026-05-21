import { useRef, useState, useCallback, useEffect } from "react";

export type ImageDiffMode = "side-by-side" | "slider";

const CHECKER = "repeating-conic-gradient(#d1d5db 0% 25%, #ffffff 0% 50%) 0 0 / 12px 12px";
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 16;
const ZOOM_FACTOR = 1.15;

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

function formatZoom(z: number): string {
  return `${Math.round(z * 100)}%`;
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
  const sliderDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);

  const [beforeNatural, setBeforeNatural] = useState<{ w: number; h: number } | null>(null);
  const [afterNatural, setAfterNatural] = useState<{ w: number; h: number } | null>(null);
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  // Zoom / pan state
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanDragging, setIsPanDragging] = useState(false);
  const panDragging = useRef(false);
  const panStart = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number } | null>(null);

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

  // Reset zoom/pan when images or mode change
  useEffect(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, [beforeSrc, afterSrc, mode]);

  // Zoom centered on cursor position within a panel rect.
  // transform-origin is "center" (50% 50%), so the coordinate system is:
  //   screen_x = (elem_x - W/2) * zoom + W/2 + panX
  // Keeping cursor element-point fixed gives:
  //   newPanX = (cx - W/2) - (cx - W/2 - prevPanX) * (newZoom / prevZoom)
  const applyWheelZoom = useCallback((e: WheelEvent, rect: DOMRect) => {
    e.preventDefault();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const hw = rect.width / 2;
    const hh = rect.height / 2;
    setZoom(prevZoom => {
      const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * factor));
      setPanOffset(prev => ({
        x: (cx - hw) - (cx - hw - prev.x) * (newZoom / prevZoom),
        y: (cy - hh) - (cy - hh - prev.y) * (newZoom / prevZoom),
      }));
      return newZoom;
    });
  }, []);

  // Attach wheel handler for slider mode
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mode !== "slider") return;
    const handler = (e: WheelEvent) => applyWheelZoom(e, el.getBoundingClientRect());
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [mode, applyWheelZoom]);

  // Attach wheel handlers for side-by-side panels (synchronized)
  useEffect(() => {
    if (mode !== "side-by-side") return;
    const attach = (el: HTMLDivElement | null) => {
      if (!el) return () => {};
      const handler = (e: WheelEvent) => applyWheelZoom(e, el.getBoundingClientRect());
      el.addEventListener("wheel", handler, { passive: false });
      return () => el.removeEventListener("wheel", handler);
    };
    const cleanL = attach(leftPanelRef.current);
    const cleanR = attach(rightPanelRef.current);
    return () => { cleanL(); cleanR(); };
  }, [mode, applyWheelZoom]);

  // Slider handle drag
  const onSliderPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    sliderDragging.current = true;
  }, []);

  // Pan drag
  const onPanPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    panDragging.current = true;
    setIsPanDragging(true);
    panStart.current = { mouseX: e.clientX, mouseY: e.clientY, panX: panOffset.x, panY: panOffset.y };
  }, [panOffset.x, panOffset.y]);

  const onPointerMove = useCallback((e: PointerEvent) => {
    if (sliderDragging.current && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setSliderPct(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
    }
    if (panDragging.current && panStart.current) {
      const dx = e.clientX - panStart.current.mouseX;
      const dy = e.clientY - panStart.current.mouseY;
      setPanOffset({ x: panStart.current.panX + dx, y: panStart.current.panY + dy });
    }
  }, []);

  const onPointerUp = useCallback(() => {
    sliderDragging.current = false;
    if (panDragging.current) {
      panDragging.current = false;
      setIsPanDragging(false);
      panStart.current = null;
    }
  }, []);

  useEffect(() => {
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Zoom centered on the image center (for button clicks).
  // With transform-origin: center, the image center is always at (W/2 + panX, H/2 + panY).
  // Changing only zoom leaves the image center position unchanged — no pan adjustment needed.
  const zoomBy = useCallback((factor: number) => {
    setZoom(prevZoom => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prevZoom * factor)));
  }, []);

  const setActualSize = useCallback(() => {
    const nat = afterNatural ?? beforeNatural;
    const cs = containerSize;
    if (!nat || !cs) { resetView(); return; }
    const fitted = computeContainRect(nat.w, nat.h, cs.w, cs.h);
    // With transform-origin: center, pan={0,0} always centers the image.
    // zoom = nat.w / fitted.w renders the image at 1:1 pixel size, centered.
    setZoom(nat.w / fitted.w);
    setPanOffset({ x: 0, y: 0 });
  }, [afterNatural, beforeNatural, containerSize, resetView]);

  // CSS transform applied to each image for zoom+pan.
  // transform-origin defaults to "50% 50%" (center), so scale always happens around
  // the element center. pan={0,0} keeps the image visually centered at any zoom level.
  const imgTransformStyle: React.CSSProperties = {
    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
  };

  // ── Zoom controls overlay ──────────────────────────────────────────────────
  const zoomControls = (
    <div
      className="absolute top-2 right-2 z-30 flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-1 select-none"
      onMouseDown={e => e.stopPropagation()}
    >
      <button
        onClick={() => zoomBy(1 / ZOOM_FACTOR)}
        className="text-gray-300 hover:text-white px-1 text-base leading-none font-bold"
        title="Zoom out (scroll down)"
      >−</button>
      <span className="text-gray-300 text-xs w-10 text-center tabular-nums">{formatZoom(zoom)}</span>
      <button
        onClick={() => zoomBy(ZOOM_FACTOR)}
        className="text-gray-300 hover:text-white px-1 text-base leading-none font-bold"
        title="Zoom in (scroll up)"
      >+</button>
      <div className="w-px h-3 bg-gray-600 mx-0.5" />
      <button
        onClick={setActualSize}
        className="text-gray-300 hover:text-white text-xs px-1"
        title="Actual size (1:1)"
      >1:1</button>
      <button
        onClick={resetView}
        className="text-gray-300 hover:text-white text-xs px-1"
        title="Fit to window"
      >Fit</button>
    </div>
  );

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
        <span className="text-gray-500 shrink-0">{formatBytes(base64ByteSize(beforeSrc))}</span>
      </div>
      <div className="flex-1 flex items-center justify-center gap-2 px-2 py-1 min-w-0">
        <span className="inline-flex items-center overflow-hidden rounded shrink-0">
          <span className="px-1.5 py-0.5 font-semibold bg-green-600 text-white leading-4">AFTER</span>
        </span>
        <span className="text-gray-400 truncate">
          {afterNatural ? `${afterNatural.w}×${afterNatural.h}` : "—"}
        </span>
        <span className="text-gray-500 shrink-0">{formatBytes(base64ByteSize(afterSrc))}</span>
      </div>
    </div>
  );

  // ── Side by side ──────────────────────────────────────────────────────────
  if (mode === "side-by-side") {
    const panelCursor = isPanDragging ? "cursor-grabbing" : "cursor-grab";
    return (
      <div className="flex flex-col h-full">
        {infoBar}
        <div className="flex flex-1 overflow-hidden relative">
          {zoomControls}
          {/* Before panel */}
          <div
            ref={leftPanelRef}
            className={`flex-1 bg-black overflow-hidden relative border-r border-gray-600 ${panelCursor}`}
            onPointerDown={onPanPointerDown}
            style={{ touchAction: "none" }}
          >
            <img
              src={beforeSrc}
              alt={`before: ${filename}`}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none block"
              style={{ background: CHECKER, ...imgTransformStyle }}
            />
          </div>
          {/* After panel */}
          <div
            ref={rightPanelRef}
            className={`flex-1 bg-black overflow-hidden relative ${panelCursor}`}
            onPointerDown={onPanPointerDown}
            style={{ touchAction: "none" }}
          >
            <img
              src={afterSrc}
              alt={`after: ${filename}`}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none block"
              style={{ background: CHECKER, ...imgTransformStyle }}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Slider ────────────────────────────────────────────────────────────────
  // Compute clip position in element-local space, accounting for zoom/pan.
  // With transform-origin center on a W-wide element:
  //   screen_x = (elem_x - W/2) * zoom + W/2 + panX
  //   elem_x   = (screen_x - W/2 - panX) / zoom + W/2
  // clipRight = (1 - elem_x / W) * 100
  //           = (0.5 - (sliderPct/100 - 0.5 - panX/W) / zoom) * 100
  const W = containerSize?.w ?? 0;
  const clipRight = containerSize
    ? Math.min(100, Math.max(0,
        (0.5 - (sliderPct / 100 - 0.5 - panOffset.x / W) / zoom) * 100
      ))
    : 100 - sliderPct;

  // Letterbox covers (only when not zoomed, to block checkerboard bleed)
  const lb = afterNatural && containerSize && zoom === 1 && panOffset.x === 0 && panOffset.y === 0
    ? computeContainRect(afterNatural.w, afterNatural.h, containerSize.w, containerSize.h)
    : null;

  const panelCursor = isPanDragging ? "cursor-grabbing" : "cursor-grab";

  return (
    <div className="flex flex-col h-full">
      {infoBar}
      <div
        ref={containerRef}
        className={`relative flex-1 overflow-hidden bg-black select-none ${panelCursor}`}
        onPointerDown={onPanPointerDown}
        style={{ touchAction: "none" }}
      >
        {zoomControls}

        {/* After image */}
        <img
          src={afterSrc}
          alt={`after: ${filename}`}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ background: CHECKER, ...imgTransformStyle }}
        />
        {/* Before image — clipped from the right at the divider position */}
        <img
          src={beforeSrc}
          alt={`before: ${filename}`}
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
          style={{ background: CHECKER, clipPath: `inset(0 ${clipRight}% 0 0)`, ...imgTransformStyle }}
        />

        {/* Black covers over letterbox areas (only at fit-to-window zoom) */}
        {lb && lb.y > 0 && (
          <>
            <div className="absolute inset-x-0 bg-black pointer-events-none" style={{ top: 0, height: lb.y }} />
            <div className="absolute inset-x-0 bg-black pointer-events-none" style={{ bottom: 0, height: lb.y }} />
          </>
        )}
        {lb && lb.x > 0 && (
          <>
            <div className="absolute inset-y-0 bg-black pointer-events-none" style={{ left: 0, width: lb.x }} />
            <div className="absolute inset-y-0 bg-black pointer-events-none" style={{ right: 0, width: lb.x }} />
          </>
        )}

        {/* Divider — always at sliderPct% of the container in screen space */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-20"
          style={{ left: `calc(${sliderPct}% - 1px)`, touchAction: "none" }}
          onPointerDown={onSliderPointerDown}
        >
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white shadow-md border border-gray-300 flex items-center justify-center cursor-col-resize"
            onPointerDown={onSliderPointerDown}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M3 2L1 5L3 8M7 2L9 5L7 8" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
