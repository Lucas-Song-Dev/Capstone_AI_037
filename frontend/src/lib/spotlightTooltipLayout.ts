import type { CSSProperties } from 'react';

export type SpotlightHole = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type TooltipPlacementPreference = 'top' | 'bottom' | 'left' | 'right';

const DEFAULT_TOOLTIP_MAX_WIDTH = 320;
const DEFAULT_MARGIN = 16;
/** Reserve space under fixed Skip control + safe inset */
export const SPOTLIGHT_TOP_UI_RESERVE = 56;
const DEFAULT_ESTIMATED_HEIGHT = 240;
const MAX_TOOLTIP_HEIGHT = 420;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** Never claim more vertical space than exists between hole and viewport edge */
function heightCapForSpace(usablePx: number) {
  const u = Math.floor(usablePx);
  if (u <= 0) return 1;
  return Math.min(MAX_TOOLTIP_HEIGHT, u);
}

export type ComputedTooltipPlacement = 'above' | 'below';

export type ComputeSpotlightTooltipLayoutResult = {
  placement: ComputedTooltipPlacement;
  style: CSSProperties;
};

/**
 * Picks above vs below the spotlight hole and sets maxHeight so the dialog stays inside the viewport.
 * Exported for unit tests (viewport / hole geometry).
 */
export function computeSpotlightTooltipLayout(
  hole: SpotlightHole,
  vw: number,
  vh: number,
  options: {
    placement?: TooltipPlacementPreference;
    margin?: number;
    tooltipMaxWidth?: number;
    /** Used to decide flip when neither side fits ideally */
    estimatedContentHeight?: number;
    topUiReserve?: number;
  } = {},
): ComputeSpotlightTooltipLayoutResult {
  const margin = options.margin ?? DEFAULT_MARGIN;
  const tooltipMaxW = options.tooltipMaxWidth ?? DEFAULT_TOOLTIP_MAX_WIDTH;
  const topReserve = options.topUiReserve ?? SPOTLIGHT_TOP_UI_RESERVE;
  const estH = options.estimatedContentHeight ?? DEFAULT_ESTIMATED_HEIGHT;
  const pref = options.placement ?? 'bottom';

  const holeBottom = hole.top + hole.height;
  const topWhenBelow = holeBottom + margin;
  /** Pixels available below the tooltip when anchored under the hole (includes gap under hole). */
  const usableBelow = vh - margin - topWhenBelow;
  /** Pixels available above the hole bottom edge for an above-anchored tooltip (below Skip reserve). */
  const usableAbove = hole.top - margin - topReserve;

  const fitsBelow = usableBelow >= estH;
  const fitsAbove = usableAbove >= estH;

  let placement: ComputedTooltipPlacement;

  if (pref === 'top') {
    if (fitsAbove) placement = 'above';
    else if (fitsBelow) placement = 'below';
    else placement = usableAbove >= usableBelow ? 'above' : 'below';
  } else {
    if (fitsBelow) placement = 'below';
    else if (fitsAbove) placement = 'above';
    else placement = usableBelow >= usableAbove ? 'below' : 'above';
  }

  if (placement === 'below' && usableBelow <= 0 && usableAbove > usableBelow) {
    placement = 'above';
  }
  if (placement === 'above' && usableAbove <= 0 && usableBelow > usableAbove) {
    placement = 'below';
  }

  const maxHeightBelow = heightCapForSpace(usableBelow);
  const maxHeightAbove = heightCapForSpace(usableAbove);

  const maxHeight = placement === 'below' ? maxHeightBelow : maxHeightAbove;

  const contentW = Math.min(tooltipMaxW, vw - margin * 2);
  const cx = hole.left + hole.width / 2;
  const left = clamp(cx - contentW / 2, margin, vw - contentW - margin);

  if (placement === 'below') {
    const top = topWhenBelow;
    return {
      placement: 'below',
      style: {
        position: 'fixed',
        left,
        top,
        zIndex: 120,
        maxWidth: tooltipMaxW,
        width: `min(${tooltipMaxW}px, calc(100vw - ${margin * 2}px))`,
        maxHeight,
        overflowY: 'auto',
      },
    };
  }

  const bottom = vh - hole.top + margin;
  return {
    placement: 'above',
    style: {
      position: 'fixed',
      left,
      bottom,
      zIndex: 120,
      maxWidth: tooltipMaxW,
      width: `min(${tooltipMaxW}px, calc(100vw - ${margin * 2}px))`,
      maxHeight,
      overflowY: 'auto',
    },
  };
}

/** Centered fallback when hole is not yet measured */
export function computeSpotlightTooltipCenterStyle(
  vw: number,
  vh: number,
  margin = DEFAULT_MARGIN,
): CSSProperties {
  return {
    position: 'fixed',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 120,
    maxWidth: DEFAULT_TOOLTIP_MAX_WIDTH,
    width: `min(${DEFAULT_TOOLTIP_MAX_WIDTH}px, calc(100vw - ${margin * 2}px))`,
    maxHeight: Math.max(1, vh - margin * 2),
    overflowY: 'auto',
  };
}
