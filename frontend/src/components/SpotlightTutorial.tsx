'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { isOnboardingComplete, setOnboardingComplete } from '@/lib/onboarding-storage';
import {
  computeSpotlightTooltipCenterStyle,
  computeSpotlightTooltipLayout,
} from '@/lib/spotlightTooltipLayout';
import { cn } from '@/lib/utils';

const PADDING = 10;
const OVERLAY_Z = 110;
const TARGET_Z = 115;
const UI_Z = 120;

const CURTAIN_CLASS =
  'fixed bg-black/90 backdrop-blur-md pointer-events-auto';

export type SpotlightStep = {
  selector: string;
  title: string;
  body: string;
  placement?: 'top' | 'bottom' | 'left' | 'right';
};

type SpotlightTutorialProps = {
  /** One localStorage key per page (e.g. `ONBOARDING_*_KEY` from onboarding-storage). */
  storageKey: string;
  steps: SpotlightStep[];
  onComplete?: () => void;
};

type Hole = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function restoreTargetStyles(
  el: HTMLElement | null,
  backup: { position: string; zIndex: string } | null,
) {
  if (el && backup) {
    el.style.position = backup.position;
    el.style.zIndex = backup.zIndex;
  }
}

export function SpotlightTutorial({ storageKey, steps, onComplete }: SpotlightTutorialProps) {
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [hole, setHole] = useState<Hole | null>(null);
  const targetRef = useRef<HTMLElement | null>(null);
  const styleBackupRef = useRef<{ position: string; zIndex: string } | null>(null);

  useEffect(() => {
    if (steps.length === 0) return;
    if (!isOnboardingComplete(storageKey)) {
      setRun(true);
    }
  }, [storageKey, steps.length]);

  const finish = useCallback(() => {
    setOnboardingComplete(storageKey);
    setRun(false);
    onComplete?.();
  }, [storageKey, onComplete]);

  const resolveTarget = useCallback((): HTMLElement | null => {
    if (stepIndex < 0 || stepIndex >= steps.length) return null;
    return document.querySelector(steps[stepIndex].selector);
  }, [stepIndex, steps]);

  const updateHole = useCallback(() => {
    const el = targetRef.current;
    if (!el || !run) {
      setHole(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const left = r.left - PADDING;
    const top = r.top - PADDING;
    const width = r.width + PADDING * 2;
    const height = r.height + PADDING * 2;
    setHole({ left, top, width, height });
  }, [run, stepIndex, steps]);

  // Restore target stacking on unmount
  useLayoutEffect(() => {
    return () => {
      restoreTargetStyles(targetRef.current, styleBackupRef.current);
      targetRef.current = null;
      styleBackupRef.current = null;
    };
  }, []);

  // Bind target for current step, scroll into view, apply z-index
  useLayoutEffect(() => {
    if (!run) {
      restoreTargetStyles(targetRef.current, styleBackupRef.current);
      targetRef.current = null;
      styleBackupRef.current = null;
      setHole(null);
      return;
    }

    const prev = targetRef.current;
    const prevBackup = styleBackupRef.current;
    if (prev && prevBackup) {
      prev.style.position = prevBackup.position;
      prev.style.zIndex = prevBackup.zIndex;
    }

    const el = resolveTarget();
    targetRef.current = el;
    if (el) {
      styleBackupRef.current = { position: el.style.position, zIndex: el.style.zIndex };
      const computed = getComputedStyle(el);
      if (computed.position === 'static') {
        el.style.position = 'relative';
      }
      el.style.zIndex = String(TARGET_Z);
      el.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
    } else {
      styleBackupRef.current = null;
    }

    const id = requestAnimationFrame(() => {
      updateHole();
    });
    return () => cancelAnimationFrame(id);
  }, [run, stepIndex, resolveTarget, updateHole]);

  // Skip missing targets
  useEffect(() => {
    if (!run) return;
    const id = requestAnimationFrame(() => {
      if (!resolveTarget() && steps.length > 0) {
        if (stepIndex >= steps.length - 1) {
          finish();
        } else {
          setStepIndex((i) => i + 1);
        }
      }
    });
    return () => cancelAnimationFrame(id);
  }, [run, stepIndex, steps.length, resolveTarget, finish]);

  useEffect(() => {
    if (!run) return;
    updateHole();
    const onScrollOrResize = () => updateHole();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [run, updateHole]);

  useEffect(() => {
    if (!run) return;
    const el = targetRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => updateHole());
    ro.observe(el);
    return () => ro.disconnect();
  }, [run, stepIndex, updateHole]);

  const goNext = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finish();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [stepIndex, steps.length, finish]);

  if (steps.length === 0 || !run || typeof document === 'undefined') {
    return null;
  }

  const vw = typeof window !== 'undefined' ? window.innerWidth : 0;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 0;

  const step = steps[stepIndex];
  const isLast = stepIndex >= steps.length - 1;

  const tooltipStyle: CSSProperties = (() => {
    if (!hole) {
      return { ...computeSpotlightTooltipCenterStyle(vw, vh), zIndex: UI_Z };
    }
    const { style } = computeSpotlightTooltipLayout(hole, vw, vh, {
      placement: steps[stepIndex]?.placement ?? 'bottom',
    });
    return { ...style, zIndex: UI_Z };
  })();

  const curtains =
    hole && vw > 0 && vh > 0 ? (
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
    ) : run ? (
      <div
        className="fixed inset-0 bg-black/90 backdrop-blur-md pointer-events-auto"
        style={{ zIndex: OVERLAY_Z }}
        aria-hidden
      />
    ) : null;

  const node = (
    <>
      {curtains}
      <div
        className="fixed top-4 right-4 md:right-6 z-[120] pointer-events-auto"
        style={{ zIndex: UI_Z }}
      >
        <Button type="button" variant="outline" size="sm" className="bg-card/95 shadow-md" onClick={finish}>
          Skip
        </Button>
      </div>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-tutorial-title"
        className={cn(
          'rounded-lg border border-border bg-card text-card-foreground shadow-lg p-4 pointer-events-auto',
        )}
        style={tooltipStyle}
      >
        {step ? (
          <>
            <h2 id="spotlight-tutorial-title" className="font-semibold text-base mb-1">
              {step.title}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">{step.body}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {stepIndex + 1} / {steps.length}
              </span>
              <Button type="button" size="sm" onClick={goNext}>
                {isLast ? 'Done' : 'Next'}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </>
  );

  return createPortal(node, document.body);
}
