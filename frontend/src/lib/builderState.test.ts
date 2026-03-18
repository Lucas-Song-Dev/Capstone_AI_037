import { describe, it, expect, beforeEach } from 'vitest';
import {
  getInitialBoardState,
  createRank,
  createBankGroup,
  createBankSlot,
  deriveArchitectureFromBoard,
  canAddRank,
  canAddBankGroup,
  canAddBank,
  findBankGroupIdForNextBank,
  BUILDER_VISUAL_BANKS_PER_GROUP,
  MAX_RANKS,
  MAX_BANK_GROUPS,
  MAX_BANKS_PER_GROUP,
  type BoardState,
  type Rank,
} from './builderState';

describe('builderState', () => {
  describe('constants', () => {
    it('MAX_RANKS is 2', () => expect(MAX_RANKS).toBe(2));
    it('MAX_BANK_GROUPS is 4', () => expect(MAX_BANK_GROUPS).toBe(4));
    it('MAX_BANKS_PER_GROUP is 32', () => expect(MAX_BANKS_PER_GROUP).toBe(32));
    it('BUILDER_VISUAL_BANKS_PER_GROUP is 8', () =>
      expect(BUILDER_VISUAL_BANKS_PER_GROUP).toBe(8));
  });

  function rankWithBankCounts(...counts: number[]) {
    const groups = counts.map((n) =>
      createBankGroup(Array.from({ length: n }, () => createBankSlot()))
    );
    return createRank(groups);
  }

  describe('findBankGroupIdForNextBank', () => {
    it('returns null for rank with no bank groups', () => {
      expect(findBankGroupIdForNextBank(createRank([]))).toBeNull();
    });
    it('targets first group when it has room under 8', () => {
      const r = rankWithBankCounts(0, 0);
      expect(findBankGroupIdForNextBank(r)).toBe(r.bankGroups[0].id);
    });
    it('after first group has 8, targets second group', () => {
      const r = rankWithBankCounts(8, 0);
      expect(findBankGroupIdForNextBank(r)).toBe(r.bankGroups[1].id);
    });
    it('after first two groups have 8, targets third', () => {
      const r = rankWithBankCounts(8, 8, 0);
      expect(findBankGroupIdForNextBank(r)).toBe(r.bankGroups[2].id);
    });
    it('when all groups have 8, targets first for banks 9–32', () => {
      const r = rankWithBankCounts(8, 8, 8, 8);
      expect(findBankGroupIdForNextBank(r)).toBe(r.bankGroups[0].id);
    });
    it('when first group full at 32, targets next with room', () => {
      const r = rankWithBankCounts(32, 8, 0);
      expect(findBankGroupIdForNextBank(r)).toBe(r.bankGroups[2].id);
    });
    it('holder group fills before advancing past holder capacity', () => {
      const h = createBankGroup(
        Array.from({ length: 15 }, () => createBankSlot()),
        16
      );
      const r = createRank([h, createBankGroup()]);
      expect(findBankGroupIdForNextBank(r)).toBe(h.id);
    });
  });

  describe('getInitialBoardState', () => {
    it('returns empty ranks', () => {
      const state = getInitialBoardState();
      expect(state.ranks).toEqual([]);
    });
  });

  describe('createRank / createBankGroup / createBankSlot', () => {
    it('createRank returns rank with id and bankGroups array', () => {
      const rank = createRank();
      expect(rank.id).toMatch(/^rank-/);
      expect(rank.bankGroups).toEqual([]);
    });
    it('createBankGroup returns bank group with id and banks', () => {
      const bg = createBankGroup();
      expect(bg.id).toMatch(/^bg-/);
      expect(bg.banks).toEqual([]);
      expect(bg.holderCapacity).toBeUndefined();
    });
    it('createBankSlot returns slot with id and type bank', () => {
      const slot = createBankSlot();
      expect(slot.id).toMatch(/^bank-/);
      expect(slot.type).toBe('bank');
    });
  });

  describe('canAddRank', () => {
    it('allows add when 0 ranks', () => {
      expect(canAddRank({ ranks: [] })).toBe(true);
    });
    it('allows add when 1 rank', () => {
      expect(canAddRank({ ranks: [createRank()] })).toBe(true);
    });
    it('disallows add when 2 ranks', () => {
      const state: BoardState = { ranks: [createRank(), createRank()] };
      expect(canAddRank(state)).toBe(false);
    });
  });

  describe('canAddBankGroup', () => {
    it('allows add when rank has 0 BGs', () => {
      expect(canAddBankGroup(createRank())).toBe(true);
    });
    it('allows add when rank has 3 BGs', () => {
      const rank = createRank([
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      expect(canAddBankGroup(rank)).toBe(true);
    });
    it('disallows add when rank has 4 BGs', () => {
      const rank = createRank([
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      expect(canAddBankGroup(rank)).toBe(false);
    });
  });

  describe('canAddBank', () => {
    it('allows add when group has no holder and under 32 banks', () => {
      const bg = createBankGroup(Array.from({ length: 10 }, () => createBankSlot()));
      expect(canAddBank(bg, false)).toBe(true);
    });
    it('disallows add when group has 32 banks (no holder)', () => {
      const bg = createBankGroup(Array.from({ length: 32 }, () => createBankSlot()));
      expect(canAddBank(bg, false)).toBe(false);
    });
    it('allows add when holder capacity 16 and has 10 banks', () => {
      const bg = createBankGroup(
        Array.from({ length: 10 }, () => createBankSlot()),
        16
      );
      expect(canAddBank(bg, false, 16)).toBe(true);
    });
    it('disallows add when holder capacity 16 and has 16 banks', () => {
      const bg = createBankGroup(
        Array.from({ length: 16 }, () => createBankSlot()),
        16
      );
      expect(canAddBank(bg, false, 16)).toBe(false);
    });
    it('allows holder when group empty and no holderCapacity', () => {
      const bg = createBankGroup();
      expect(canAddBank(bg, true)).toBe(true);
    });
    it('disallows holder when group has banks', () => {
      const bg = createBankGroup([createBankSlot()]);
      expect(canAddBank(bg, true)).toBe(false);
    });
    it('disallows holder when group already has holderCapacity', () => {
      const bg = createBankGroup([], 16);
      expect(canAddBank(bg, true, 16)).toBe(false);
    });
  });

  describe('deriveArchitectureFromBoard', () => {
    it('0 ranks → nbrOfRanks 0, nbrOfBankGroups 0, nbrOfBanks 16', () => {
      const state = getInitialBoardState();
      const out = deriveArchitectureFromBoard(state);
      expect(out.nbrOfRanks).toBe(0);
      expect(out.nbrOfBankGroups).toBe(0);
      expect(out.nbrOfBanks).toBe(16);
    });

    it('1 rank, 0 BGs → nbrOfRanks 1, nbrOfBankGroups 0, nbrOfBanks 16', () => {
      const state: BoardState = { ranks: [createRank()] };
      const out = deriveArchitectureFromBoard(state);
      expect(out.nbrOfRanks).toBe(1);
      expect(out.nbrOfBankGroups).toBe(0);
      expect(out.nbrOfBanks).toBe(16);
    });

    it('1 rank, 4 BGs, no banks → nbrOfBankGroups 4, nbrOfBanks 16', () => {
      const rank = createRank([
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      const state: BoardState = { ranks: [rank] };
      const out = deriveArchitectureFromBoard(state);
      expect(out.nbrOfRanks).toBe(1);
      expect(out.nbrOfBankGroups).toBe(4);
      expect(out.nbrOfBanks).toBe(16);
    });

    it('1 rank, 1 BG with 32 banks → nbrOfBanks 32', () => {
      const banks = Array.from({ length: 32 }, () => createBankSlot());
      const bg = createBankGroup(banks);
      const rank = createRank([bg]);
      const state: BoardState = { ranks: [rank] };
      const out = deriveArchitectureFromBoard(state);
      expect(out.nbrOfBanks).toBe(32);
    });

    it('2 ranks, 4 BGs each → nbrOfRanks 2, nbrOfBankGroups 4 (first rank only for MemSpec)', () => {
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
      const out = deriveArchitectureFromBoard(state);
      expect(out.nbrOfRanks).toBe(2);
      expect(out.nbrOfBankGroups).toBe(4);
    });
  });
});

describe('builder scenarios (3D display)', () => {
  /** Total bank groups across ranks (for 3D layout: 2 rows × 4). */
  function totalBankGroups(state: BoardState): number {
    return state.ranks.reduce((s, r) => s + r.bankGroups.length, 0);
  }

  it('0 ranks: totalBankGroups 0', () => {
    expect(totalBankGroups(getInitialBoardState())).toBe(0);
  });

  it('1 rank, 4 BGs: totalBankGroups 4 (one row of 4)', () => {
    const rank = createRank([
      createBankGroup(),
      createBankGroup(),
      createBankGroup(),
      createBankGroup(),
    ]);
    expect(totalBankGroups({ ranks: [rank] })).toBe(4);
  });

  it('2 ranks, 4 BGs each: totalBankGroups 8 (two rows of 4)', () => {
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

  it('2 ranks, 4 BGs each: deriveArchitecture still uses first rank BG count', () => {
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
    const out = deriveArchitectureFromBoard({ ranks: [r1, r2] });
    expect(out.nbrOfBankGroups).toBe(4);
    expect(out.nbrOfRanks).toBe(2);
  });
});
