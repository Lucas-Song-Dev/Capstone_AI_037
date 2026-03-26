import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { PresentationModeHighlighter } from './PresentationModeHighlighter';

const VIEW_W = 800;
const VIEW_H = 600;

describe('PresentationModeHighlighter', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEW_W });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: VIEW_H });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render when inactive', () => {
    render(<PresentationModeHighlighter active={false} />);
    expect(document.querySelector('[data-presentation-capture]')).toBeNull();
    expect(document.querySelector('[data-spotlight-curtain]')).toBeNull();
  });

  it('renders full haze until a selection is made', () => {
    render(<PresentationModeHighlighter active />);
    expect(document.querySelector('[data-spotlight-curtain="full"]')).toBeInTheDocument();
  });

  it('creates a cutout matching the drag rectangle', async () => {
    render(<PresentationModeHighlighter active />);

    const capture = document.querySelector('[data-presentation-capture]') as HTMLElement;
    expect(capture).toBeTruthy();

    fireEvent.mouseDown(capture, { clientX: 100, clientY: 120, button: 0 });
    fireEvent.mouseMove(capture, { clientX: 260, clientY: 200, button: 0 });
    fireEvent.mouseUp(capture, { clientX: 260, clientY: 200, button: 0 });

    await waitFor(() => {
      expect(document.querySelectorAll('[data-spotlight-curtain="top"]').length).toBe(1);
      expect(document.querySelectorAll('[data-spotlight-curtain="bottom"]').length).toBe(1);
      expect(document.querySelectorAll('[data-spotlight-curtain="left"]').length).toBe(1);
      expect(document.querySelectorAll('[data-spotlight-curtain="right"]').length).toBe(1);
    });

    const top = document.querySelector('[data-spotlight-curtain="top"]') as HTMLElement;
    const bottom = document.querySelector('[data-spotlight-curtain="bottom"]') as HTMLElement;
    const left = document.querySelector('[data-spotlight-curtain="left"]') as HTMLElement;
    const right = document.querySelector('[data-spotlight-curtain="right"]') as HTMLElement;

    // Expected rect is exactly the min/max between points, clamped to viewport.
    const expected = { left: 100, top: 120, width: 160, height: 80 };

    expect(top.style.height).toBe(`${expected.top}px`);
    expect(bottom.style.top).toBe(`${expected.top + expected.height}px`);

    expect(left.style.width).toBe(`${expected.left}px`);
    expect(left.style.top).toBe(`${expected.top}px`);
    expect(left.style.height).toBe(`${expected.height}px`);

    expect(right.style.left).toBe(`${expected.left + expected.width}px`);
    expect(right.style.top).toBe(`${expected.top}px`);
    expect(right.style.height).toBe(`${expected.height}px`);
  });
});

