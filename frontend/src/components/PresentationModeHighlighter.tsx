'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Hole = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const OVERLAY_Z = 500;
const CAPTURE_Z = 510;

const CURTAIN_CLASS =
  'fixed bg-zinc-100/45 dark:bg-zinc-950/45 backdrop-blur-lg pointer-events-auto';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function rectFromPoints(a: { x: number; y: number }, b: { x: number; y: number }, vw: number, vh: number): Hole {
  const ax = clamp(a.x, 0, vw);
  const ay = clamp(a.y, 0, vh);
  const bx = clamp(b.x, 0, vw);
  const by = clamp(b.y, 0, vh);

  const left = Math.min(ax, bx);
  const top = Math.min(ay, by);
  const width = Math.max(1, Math.abs(ax - bx));
  const height = Math.max(1, Math.abs(ay - by));

  return { left, top, width, height };
}

export type PresentationModeHighlighterProps = {
  active: boolean;
};

export function PresentationModeHighlighter({ active }: PresentationModeHighlighterProps) {
  const [hole, setHole] = useState<Hole | null>(null);
  const [dragging, setDragging] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

  const clear = useCallback(() => {
    setDragging(false);
    startRef.current = null;
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return;
      // Ignore non-left clicks
      if (typeof e.button === 'number' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      setDragging(true);
      startRef.current = { x: e.clientX, y: e.clientY };
      setHole({ left: e.clientX, top: e.clientY, width: 1, height: 1 });
    },
    [active],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return;
      if (!dragging) return;
      const start = startRef.current;
      if (!start) return;
      e.preventDefault();
      e.stopPropagation();
      setHole(rectFromPoints(start, { x: e.clientX, y: e.clientY }, vw, vh));
    },
    [active, dragging, vw, vh],
  );

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return;
      if (!dragging) return;
      e.preventDefault();
      e.stopPropagation();
      setDragging(false);
      // Keep `hole` as-is; next drag will replace it.
      startRef.current = null;
    },
    [active, dragging],
  );

  useEffect(() => {
    if (!active) {
      clear();
      setHole(null);
    }
  }, [active, clear]);

  // If the viewport changes while active, clamp/normalize the existing hole into view.
  useEffect(() => {
    if (!active) return;
    if (!hole) return;
    const left = clamp(hole.left, 0, Math.max(0, vw - 1));
    const top = clamp(hole.top, 0, Math.max(0, vh - 1));
    const width = clamp(hole.width, 1, Math.max(1, vw - left));
    const height = clamp(hole.height, 1, Math.max(1, vh - top));
    if (left !== hole.left || top !== hole.top || width !== hole.width || height !== hole.height) {
      setHole({ left, top, width, height });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, vw, vh]);

  const curtains = useMemo(() => {
    if (!active) return null;
    if (!hole || vw <= 0 || vh <= 0) {
      return (
        <div
          data-spotlight-curtain="full"
          className="fixed inset-0 bg-zinc-100/45 dark:bg-zinc-950/45 backdrop-blur-lg pointer-events-auto"
          style={{ zIndex: OVERLAY_Z }}
          aria-hidden
        />
      );
    }

    return (
      <>
        <div
          data-spotlight-curtain="top"
          className={CURTAIN_CLASS}
          style={{ zIndex: OVERLAY_Z, top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }}
          aria-hidden
        />
        <div
          data-spotlight-curtain="bottom"
          className={CURTAIN_CLASS}
          style={{
            zIndex: OVERLAY_Z,
            top: hole.top + hole.height,
            left: 0,
            right: 0,
            bottom: 0,
          }}
          aria-hidden
        />
        <div
          data-spotlight-curtain="left"
          className={CURTAIN_CLASS}
          style={{
            zIndex: OVERLAY_Z,
            top: hole.top,
            left: 0,
            width: Math.max(0, hole.left),
            height: hole.height,
          }}
          aria-hidden
        />
        <div
          data-spotlight-curtain="right"
          className={CURTAIN_CLASS}
          style={{
            zIndex: OVERLAY_Z,
            top: hole.top,
            left: hole.left + hole.width,
            right: 0,
            height: hole.height,
          }}
          aria-hidden
        />
      </>
    );
  }, [active, hole, vw, vh]);

  if (!active || typeof document === 'undefined') return null;

  const node = (
    <>
      {curtains}
      <div
        data-presentation-capture
        className="fixed inset-0 cursor-crosshair"
        style={{ zIndex: CAPTURE_Z }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        aria-hidden
      />
    </>
  );

  return createPortal(node, document.body);
}

