import { describe, it, expect } from 'vitest';
import { splitSentences } from './DescriptionTooltip';

describe('splitSentences', () => {
  it('returns one chunk when no sentence end', () => {
    expect(splitSentences('Hello world')).toEqual(['Hello world']);
  });

  it('splits on period-space boundaries', () => {
    const s = 'First. Second. Third.';
    expect(splitSentences(s)).toEqual(['First.', 'Second.', 'Third.']);
  });

  it('matches visual builder intro (three sentences)', () => {
    const t =
      'Configure one DDR5 DIMM: set Banks, Bank groups, Ranks, Width, Burst length, Columns, and devices. The board shows your single DIMM (position doesn’t matter). Core and DIMM power update live.';
    expect(splitSentences(t)).toHaveLength(3);
  });
});
