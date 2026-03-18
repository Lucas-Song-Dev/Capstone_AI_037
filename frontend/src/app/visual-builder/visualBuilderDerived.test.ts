/**
 * Tests for Visual Builder derived state: displayBanks, totalBankGroups,
 * deriveArchitectureFromBoard, MemSpec built from board state, and export / "Use this config".
 */
import { describe, it, expect } from 'vitest';
import {
  getInitialBoardState,
  createRank,
  createBankGroup,
  createBankSlot,
  deriveArchitectureFromBoard,
  type BoardState,
} from '@/lib/builderState';
import { getBaseMemspecBySpeed } from '@/lib/presets';
import { computeCorePower, computeDIMMPower } from '@/lib/ddr5Calculator';
import { defaultWorkload } from '@/lib/presets';
import type { MemSpec } from '@/lib/types';

/** Replicate page's displayBanks: total banks for 3D (sum over all BGs of holderCapacity ?? count) so holder 16/32 show up */
function displayBanks(state: BoardState): number {
  let total = 0;
  for (const rank of state.ranks) {
    for (const bg of rank.bankGroups) {
      total += bg.holderCapacity ?? bg.banks.length;
    }
  }
  return total;
}

/** Replicate page's totalBankGroups */
function totalBankGroups(state: BoardState): number {
  return state.ranks.reduce((s, r) => s + r.bankGroups.length, 0);
}

describe('visual-builder derived state', () => {
  describe('displayBanks', () => {
    it('0 ranks → 0', () => {
      expect(displayBanks(getInitialBoardState())).toBe(0);
    });
    it('1 rank 0 BGs → 0', () => {
      expect(displayBanks({ ranks: [createRank()] })).toBe(0);
    });
    it('1 rank 1 empty BG → 0', () => {
      const rank = createRank([createBankGroup()]);
      expect(displayBanks({ ranks: [rank] })).toBe(0);
    });
    it('1 rank 1 BG with 8 banks → 8', () => {
      const bg = createBankGroup(Array.from({ length: 8 }, () => createBankSlot()));
      const rank = createRank([bg]);
      expect(displayBanks({ ranks: [rank] })).toBe(8);
    });
    it('1 rank 1 BG with holderCapacity 32 → 32', () => {
      const bg = createBankGroup([], 32);
      const rank = createRank([bg]);
      expect(displayBanks({ ranks: [rank] })).toBe(32);
    });
    it('1 rank 2 BGs, first BG has 16 banks → 16', () => {
      const bg1 = createBankGroup(Array.from({ length: 16 }, () => createBankSlot()));
      const bg2 = createBankGroup();
      const rank = createRank([bg1, bg2]);
      expect(displayBanks({ ranks: [rank] })).toBe(16);
    });
    it('2 ranks, rank2 first BG has holder 32 → total 32 (holder shows in 3D)', () => {
      const r1 = createRank([createBankGroup()]);
      const r2 = createRank([createBankGroup(Array.from({ length: 32 }, () => createBankSlot()), 32)]);
      expect(displayBanks({ ranks: [r1, r2] })).toBe(32);
    });
  });

  describe('totalBankGroups', () => {
    it('0 ranks → 0', () => expect(totalBankGroups(getInitialBoardState())).toBe(0));
    it('1 rank 4 BGs → 4', () => {
      const rank = createRank([
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      expect(totalBankGroups({ ranks: [rank] })).toBe(4);
    });
    it('2 ranks 4 BGs each → 8', () => {
      const r1 = createRank([
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      const r2 = createRank([
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      expect(totalBankGroups({ ranks: [r1, r2] })).toBe(8);
    });
  });

  describe('deriveArchitectureFromBoard + MemSpec', () => {
    it('derived arch matches board: 2 ranks, 4 BGs, 32 banks', () => {
      const banks32 = Array.from({ length: 32 }, () => createBankSlot());
      const r1 = createRank([
        createBankGroup([...banks32]),
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      const r2 = createRank([
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      const state: BoardState = { ranks: [r1, r2] };
      const { nbrOfRanks, nbrOfBankGroups, nbrOfBanks } = deriveArchitectureFromBoard(state);
      expect(nbrOfRanks).toBe(2);
      expect(nbrOfBankGroups).toBe(4);
      expect(nbrOfBanks).toBe(32);
    });

    it('getBaseMemspecBySpeed returns valid MemSpec', () => {
      const base = getBaseMemspecBySpeed(5600);
      expect(base.memoryType).toBe('DDR5');
      expect(base.memarchitecturespec.width).toBe(8);
      expect(base.memarchitecturespec.nbrOfColumns).toBeGreaterThan(0);
      expect(base.mempowerspec.vdd).toBeGreaterThan(0);
      expect(base.memtimingspec.tCK).toBeGreaterThan(0);
    });

    it('builder-style MemSpec produces finite power', () => {
      const base = getBaseMemspecBySpeed(5600);
      const arch = {
        ...base.memarchitecturespec,
        nbrOfRanks: 2,
        nbrOfBankGroups: 4,
        nbrOfBanks: 16,
      };
      const memspec = {
        ...base,
        memarchitecturespec: arch,
      };
      const core = computeCorePower(memspec, defaultWorkload);
      const dimm = computeDIMMPower(core, memspec);
      expect(core.P_total_core).toBeGreaterThan(0);
      expect(Number.isFinite(core.P_total_core)).toBe(true);
      expect(dimm.P_total_DIMM).toBeGreaterThan(0);
      expect(Number.isFinite(dimm.P_total_DIMM)).toBe(true);
    });
  });
});

/** Build derived MemSpec the same way VisualBuilderContent does (for export / Use this config tests). */
function buildDerivedMemspec(
  boardState: BoardState,
  opts: { width?: number; nbrOfColumns?: number; nbrOfDevices?: number; speed?: number } = {}
): MemSpec {
  const { nbrOfRanks, nbrOfBankGroups, nbrOfBanks } = deriveArchitectureFromBoard(boardState);
  const width = opts.width ?? 8;
  const nbrOfColumns = opts.nbrOfColumns ?? 1024;
  const nbrOfDevices = opts.nbrOfDevices ?? 8;
  const speed = opts.speed ?? 5600;
  const base = getBaseMemspecBySpeed(speed);
  const arch = {
    ...base.memarchitecturespec,
    width,
    nbrOfBanks,
    nbrOfBankGroups,
    nbrOfRanks,
    nbrOfColumns,
    nbrOfRows: 65536,
    nbrOfDevices,
    burstLength: 16,
    dataRate: 2,
  };
  return {
    ...base,
    memoryId: `builder_${nbrOfDevices}d_${nbrOfRanks}r_x${width}_${speed}`,
    memarchitecturespec: arch,
  };
}

describe('builder export / Use this config', () => {
  it('built MemSpec has all required top-level keys', () => {
    const state: BoardState = { ranks: [createRank([createBankGroup()])] };
    const spec = buildDerivedMemspec(state);
    expect(spec).toHaveProperty('memoryId');
    expect(spec).toHaveProperty('memoryType', 'DDR5');
    expect(spec).toHaveProperty('memarchitecturespec');
    expect(spec).toHaveProperty('mempowerspec');
    expect(spec).toHaveProperty('memtimingspec');
    expect(typeof spec.memoryId).toBe('string');
    expect(spec.memoryId.length).toBeGreaterThan(0);
  });

  it('built MemSpec memarchitecturespec matches board-derived values', () => {
    const r1 = createRank([
      createBankGroup(Array.from({ length: 32 }, () => createBankSlot()), 32),
      createBankGroup(),
      createBankGroup(),
      createBankGroup(),
    ]);
    const state: BoardState = { ranks: [r1] };
    const spec = buildDerivedMemspec(state);
    const { nbrOfRanks, nbrOfBankGroups, nbrOfBanks } = deriveArchitectureFromBoard(state);
    expect(spec.memarchitecturespec.nbrOfRanks).toBe(nbrOfRanks);
    expect(spec.memarchitecturespec.nbrOfBankGroups).toBe(nbrOfBankGroups);
    expect(spec.memarchitecturespec.nbrOfBanks).toBe(nbrOfBanks);
    expect(spec.memarchitecturespec.width).toBe(8);
    expect(spec.memarchitecturespec.nbrOfColumns).toBe(1024);
    expect(spec.memarchitecturespec.nbrOfDevices).toBe(8);
  });

  it('built MemSpec is valid for computeCorePower and computeDIMMPower', () => {
    const state: BoardState = {
      ranks: [
        createRank([
          createBankGroup(),
          createBankGroup(),
          createBankGroup(),
          createBankGroup(),
        ]),
      ],
    };
    const spec = buildDerivedMemspec(state);
    const core = computeCorePower(spec, defaultWorkload);
    const dimm = computeDIMMPower(core, spec);
    expect(Number.isFinite(core.P_total_core)).toBe(true);
    expect(Number.isFinite(dimm.P_total_DIMM)).toBe(true);
    expect(core.P_total_core).toBeGreaterThan(0);
    expect(dimm.P_total_DIMM).toBeGreaterThan(0);
  });

  it('onApply receives a MemSpec that setMemspec would accept (no preset match → custom)', () => {
    const state: BoardState = { ranks: [createRank(), createRank()] };
    const spec = buildDerivedMemspec(state);
    expect(spec.memoryId).toMatch(/^builder_/);
    const applied: MemSpec[] = [];
    const setMemspec = (m: MemSpec) => { applied.push(m); };
    setMemspec(spec);
    expect(applied).toHaveLength(1);
    expect(applied[0].memoryId).toBe(spec.memoryId);
    expect(applied[0].memarchitecturespec.nbrOfRanks).toBe(2);
  });

  it('built MemSpec with 2 ranks and 4 BGs has correct arch', () => {
    const r1 = createRank([
      createBankGroup(),
      createBankGroup(),
      createBankGroup(),
      createBankGroup(),
    ]);
    const r2 = createRank([
      createBankGroup(),
      createBankGroup(),
      createBankGroup(),
      createBankGroup(),
    ]);
    const state: BoardState = { ranks: [r1, r2] };
    const spec = buildDerivedMemspec(state);
    expect(spec.memarchitecturespec.nbrOfRanks).toBe(2);
    expect(spec.memarchitecturespec.nbrOfBankGroups).toBe(4);
    expect(spec.memoryId).toContain('2r');
  });
});
