import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SpotlightTutorial } from './SpotlightTutorial';

const PADDING = 10;
const VIEW_W = 800;
const VIEW_H = 600;

/** Target rect used by mocked getBoundingClientRect (jsdom has no layout). */
const MOCK_TARGET_RECT = {
  left: 100,
  top: 100,
  width: 120,
  height: 40,
  right: 220,
  bottom: 140,
  x: 100,
  y: 100,
  toJSON: () => ({}),
} as DOMRect;

const expectedHole = {
  left: MOCK_TARGET_RECT.left - PADDING,
  top: MOCK_TARGET_RECT.top - PADDING,
  width: MOCK_TARGET_RECT.width + PADDING * 2,
  height: MOCK_TARGET_RECT.height + PADDING * 2,
};

function targetCenter() {
  return {
    x: MOCK_TARGET_RECT.left + MOCK_TARGET_RECT.width / 2,
    y: MOCK_TARGET_RECT.top + MOCK_TARGET_RECT.height / 2,
  };
}

/** True if (px, py) lies inside the dimmed “curtain” regions around the hole. */
function isPointInGreyZone(px: number, py: number, vw: number, vh: number) {
  const { left: hl, top: ht, width: hw, height: hh } = expectedHole;
  if (py >= 0 && py < ht && px >= 0 && px <= vw) return true;
  if (py > ht + hh && py <= vh && px >= 0 && px <= vw) return true;
  if (py >= ht && py <= ht + hh && px >= 0 && px < hl) return true;
  if (py >= ht && py <= ht + hh && px > hl + hw && px <= vw) return true;
  return false;
}

describe('SpotlightTutorial', () => {
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEW_W });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW_H });
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this.getAttribute('data-testid') === 'spotlight-test-target') {
        return { ...MOCK_TARGET_RECT } as DOMRect;
      }
      return {
        left: 0,
        top: 0,
        width: 0,
        height: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      } as DOMRect;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not mount the tour when onboarding is already complete', () => {
    localStorage.setItem('spotlight-test-key', '1');
    render(
      <>
        <button type="button" data-testid="spotlight-test-target">
          Target
        </button>
        <SpotlightTutorial
          storageKey="spotlight-test-key"
          steps={[{ selector: '[data-testid="spotlight-test-target"]', title: 'A', body: 'B' }]}
        />
      </>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.querySelector('[data-spotlight-curtain]')).toBeNull();
  });

  it('renders four grey curtains with a cutout matching the padded target rect', async () => {
    render(
      <>
        <button type="button" data-testid="spotlight-test-target">
          Target
        </button>
        <SpotlightTutorial
          storageKey="spotlight-test-key"
          steps={[{ selector: '[data-testid="spotlight-test-target"]', title: 'Step', body: 'Description' }]}
        />
      </>,
    );

    await waitFor(() => {
      expect(document.querySelectorAll('[data-spotlight-curtain]')).toHaveLength(4);
    });

    const top = document.querySelector('[data-spotlight-curtain="top"]') as HTMLElement;
    const left = document.querySelector('[data-spotlight-curtain="left"]') as HTMLElement;
    const right = document.querySelector('[data-spotlight-curtain="right"]') as HTMLElement;
    const bottom = document.querySelector('[data-spotlight-curtain="bottom"]') as HTMLElement;

    expect(document.querySelector('[data-spotlight-frame]')).toBeNull();
    expect(top).toHaveClass('bg-black/90', 'backdrop-blur-md', 'pointer-events-auto');
    expect(top.style.height).toBe(`${expectedHole.top}px`);
    expect(left.style.width).toBe(`${expectedHole.left}px`);
    expect(left.style.top).toBe(`${expectedHole.top}px`);
    expect(left.style.height).toBe(`${expectedHole.height}px`);
    expect(right.style.left).toBe(`${expectedHole.left + expectedHole.width}px`);
    expect(right.style.top).toBe(`${expectedHole.top}px`);
    expect(bottom.style.top).toBe(`${expectedHole.top + expectedHole.height}px`);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveStyle({ overflowY: 'auto' });
    expect(Number.parseFloat(dialog.style.maxHeight)).toBeGreaterThan(0);
  });

  it('keeps the target above the grey overlay (z-index) and leaves its interior out of the grey zone', async () => {
    render(
      <>
        <button type="button" data-testid="spotlight-test-target">
          Target
        </button>
        <SpotlightTutorial
          storageKey="spotlight-test-key"
          steps={[{ selector: '[data-testid="spotlight-test-target"]', title: 'Step', body: 'Description' }]}
        />
      </>,
    );

    const target = screen.getByTestId('spotlight-test-target');
    await waitFor(() => {
      expect(target).toHaveStyle({ zIndex: '115' });
    });
    const curtains = document.querySelectorAll('[data-spotlight-curtain]');
    curtains.forEach((c) => {
      expect(c).toHaveStyle({ zIndex: '110' });
    });
    expect(Number.parseInt(target.style.zIndex, 10)).toBeGreaterThan(110);

    const { x, y } = targetCenter();
    expect(isPointInGreyZone(x, y, VIEW_W, VIEW_H)).toBe(false);

    expect(isPointInGreyZone(50, 50, VIEW_W, VIEW_H)).toBe(true);
    expect(isPointInGreyZone(400, 500, VIEW_W, VIEW_H)).toBe(true);
    expect(isPointInGreyZone(50, 120, VIEW_W, VIEW_H)).toBe(true);
    expect(isPointInGreyZone(400, 120, VIEW_W, VIEW_H)).toBe(true);
  });

  it('persists skip to localStorage and unmounts the overlay', async () => {
    render(
      <>
        <button type="button" data-testid="spotlight-test-target">
          Target
        </button>
        <SpotlightTutorial
          storageKey="spotlight-test-key"
          steps={[{ selector: '[data-testid="spotlight-test-target"]', title: 'Step', body: 'Description' }]}
        />
      </>,
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(localStorage.getItem('spotlight-test-key')).toBe('1');
    expect(document.querySelector('[data-spotlight-curtain]')).toBeNull();
  });
});
