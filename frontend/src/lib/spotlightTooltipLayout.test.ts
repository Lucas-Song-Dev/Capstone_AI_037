import { describe, it, expect } from 'vitest';
import {
  computeSpotlightTooltipLayout,
  computeSpotlightTooltipCenterStyle,
  SPOTLIGHT_TOP_UI_RESERVE,
} from './spotlightTooltipLayout';

const margin = 16;
const estH = 240;

describe('computeSpotlightTooltipLayout', () => {
  it('places below when default preference and plenty of space under the hole', () => {
    const hole = { left: 100, top: 200, width: 120, height: 60 };
    const vh = 800;
    const vw = 900;
    const { placement, style } = computeSpotlightTooltipLayout(hole, vw, vh, {
      placement: 'bottom',
      estimatedContentHeight: estH,
      margin,
    });
    expect(placement).toBe('below');
    const holeBottom = hole.top + hole.height;
    const topWhenBelow = holeBottom + margin;
    expect(style.top).toBe(topWhenBelow);
    expect(style.bottom).toBeUndefined();
    const usableBelow = vh - margin - topWhenBelow;
    expect(Number(style.maxHeight)).toBeLessThanOrEqual(usableBelow);
    expect(style.overflowY).toBe('auto');
  });

  it('flips above when not enough space below the hole for estimated height', () => {
    const vh = 500;
    const holeBottom = vh - 40;
    const hole = { left: 50, top: holeBottom - 50, width: 100, height: 50 };
    const { placement, style } = computeSpotlightTooltipLayout(hole, 800, vh, {
      placement: 'bottom',
      estimatedContentHeight: estH,
      margin,
    });
    expect(placement).toBe('above');
    expect(style.bottom).toBe(vh - hole.top + margin);
    expect(style.top).toBeUndefined();
    const usableAbove = hole.top - margin - SPOTLIGHT_TOP_UI_RESERVE;
    expect(Number(style.maxHeight)).toBeLessThanOrEqual(Math.max(1, usableAbove));
  });

  it('respects placement top: prefers above, flips below if above is too tight', () => {
    const vh = 700;
    const hole = { left: 40, top: 12, width: 80, height: 40 };
    const usableAbove = hole.top - margin - SPOTLIGHT_TOP_UI_RESERVE;
    expect(usableAbove).toBeLessThan(estH);
    const { placement, style } = computeSpotlightTooltipLayout(hole, 400, vh, {
      placement: 'top',
      estimatedContentHeight: estH,
      margin,
    });
    expect(placement).toBe('below');
    expect(style.top).toBe(hole.top + hole.height + margin);
  });

  it('caps maxHeight to remaining viewport when below so tooltip does not extend past screen', () => {
    const vh = 300;
    const hole = { left: 20, top: 120, width: 200, height: 30 };
    const holeBottom = hole.top + hole.height;
    const topWhenBelow = holeBottom + margin;
    const usableBelow = vh - margin - topWhenBelow;
    const { placement, style } = computeSpotlightTooltipLayout(hole, 360, vh, {
      placement: 'bottom',
      estimatedContentHeight: estH,
      margin,
    });
    expect(placement).toBe('below');
    expect(Number(style.maxHeight)).toBe(usableBelow);
    const topPx = Number(style.top);
    expect(topPx + Number(style.maxHeight)).toBeLessThanOrEqual(vh - margin + 0.5);
  });

  it('chooses the side with more usable space when neither fits estimated height', () => {
    const vh = 400;
    const hole = { left: 100, top: 180, width: 100, height: 40 };
    const holeBottom = hole.top + hole.height;
    const usableBelow = vh - margin - (holeBottom + margin);
    const usableAbove = hole.top - margin - SPOTLIGHT_TOP_UI_RESERVE;
    const { placement } = computeSpotlightTooltipLayout(hole, 500, vh, {
      placement: 'bottom',
      estimatedContentHeight: 500,
      margin,
    });
    expect(placement).toBe(usableBelow >= usableAbove ? 'below' : 'above');
  });

  it('clamps horizontal position on narrow viewports', () => {
    const vw = 280;
    const hole = { left: vw / 2 - 20, top: 100, width: 40, height: 40 };
    const { style } = computeSpotlightTooltipLayout(hole, vw, 600, { margin });
    const left = Number(style.left);
    const contentW = Math.min(320, vw - margin * 2);
    expect(left).toBeGreaterThanOrEqual(margin);
    expect(left + contentW).toBeLessThanOrEqual(vw - margin + 1);
  });

  it('forces above when below has no room but above does', () => {
    const vh = 200;
    const hole = { left: 10, top: 150, width: 50, height: 40 };
    const { placement } = computeSpotlightTooltipLayout(hole, 320, vh, {
      placement: 'bottom',
      margin,
      estimatedContentHeight: 80,
    });
    expect(placement).toBe('above');
  });
});

describe('computeSpotlightTooltipCenterStyle', () => {
  it('limits maxHeight to viewport minus margins', () => {
    const s = computeSpotlightTooltipCenterStyle(400, 300, 16);
    expect(s.maxHeight).toBe(300 - 32);
    expect(s.overflowY).toBe('auto');
  });
});
