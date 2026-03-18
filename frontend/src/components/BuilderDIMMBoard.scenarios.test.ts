/**
 * Scenario tests for Visual Builder 3D: add zones (left/right), caps, and display.
 * Tests the logic that drives which components show up without rendering Three.js.
 */
import { describe, it, expect } from 'vitest';
import {
  getInitialBoardState,
  createRank,
  createBankGroup,
  createBankSlot,
  MAX_BANK_GROUPS,
  MAX_BANKS_PER_GROUP,
  type BoardState,
  type DragType,
} from '@/lib/builderState';

const MAX_BANKS = MAX_BANKS_PER_GROUP;

/** Replicate add-zone logic from BuilderDIMMBoard for testing. */
function getAddZoneState(
  boardState: BoardState,
  selectedPlacementType: DragType | null
): { left: boolean; right: boolean } {
  if (!selectedPlacementType) return { left: false, right: false };
  const rank0 = boardState.ranks[0] ?? null;
  const rank1 = boardState.ranks[1] ?? null;

  let firstSlotLeft: { rankId: string; bankGroupId: string } | null = null;
  let firstHolderSlotLeft: { rankId: string; bankGroupId: string } | null = null;
  if (rank0) {
    for (const bg of rank0.bankGroups) {
      const underBank =
        bg.holderCapacity != null
          ? bg.banks.length < bg.holderCapacity
          : bg.banks.length < MAX_BANKS;
      if (underBank) firstSlotLeft ??= { rankId: rank0.id, bankGroupId: bg.id };
      if (bg.banks.length === 0 && bg.holderCapacity == null)
        firstHolderSlotLeft ??= { rankId: rank0.id, bankGroupId: bg.id };
    }
  }
  let firstSlotRight: { rankId: string; bankGroupId: string } | null = null;
  let firstHolderSlotRight: { rankId: string; bankGroupId: string } | null = null;
  if (rank1) {
    for (const bg of rank1.bankGroups) {
      const underBank =
        bg.holderCapacity != null
          ? bg.banks.length < bg.holderCapacity
          : bg.banks.length < MAX_BANKS;
      if (underBank) firstSlotRight ??= { rankId: rank1.id, bankGroupId: bg.id };
      if (bg.banks.length === 0 && bg.holderCapacity == null)
        firstHolderSlotRight ??= { rankId: rank1.id, bankGroupId: bg.id };
    }
  }

  const canAddRankOnLeft = selectedPlacementType === 'Rank' && boardState.ranks.length === 0;
  const canAddBankGroupOnLeft =
    selectedPlacementType === 'BankGroup' &&
    rank0 != null &&
    rank0.bankGroups.length < MAX_BANK_GROUPS;
  const canAddBankOnLeft = selectedPlacementType === 'Bank' && firstSlotLeft != null;
  const canAddHolderOnLeft =
    (selectedPlacementType === 'BankHolder16' || selectedPlacementType === 'BankHolder32') &&
    firstHolderSlotLeft != null;
  const canAddAnythingLeft =
    canAddRankOnLeft || canAddBankGroupOnLeft || canAddBankOnLeft || canAddHolderOnLeft;

  const canAddRankOnRight = selectedPlacementType === 'Rank' && boardState.ranks.length === 1;
  const canAddBankGroupOnRight =
    selectedPlacementType === 'BankGroup' &&
    rank1 != null &&
    rank1.bankGroups.length < MAX_BANK_GROUPS;
  const canAddBankOnRight = selectedPlacementType === 'Bank' && firstSlotRight != null;
  const canAddHolderOnRight =
    (selectedPlacementType === 'BankHolder16' || selectedPlacementType === 'BankHolder32') &&
    firstHolderSlotRight != null;
  const canAddAnythingRight =
    canAddRankOnRight || canAddBankGroupOnRight || canAddBankOnRight || canAddHolderOnRight;

  return { left: canAddAnythingLeft, right: canAddAnythingRight };
}

/** When should rank cap (full) show: rank has 4 BGs. */
function getCapState(boardState: BoardState): { left: boolean; right: boolean } {
  const rank0 = boardState.ranks[0] ?? null;
  const rank1 = boardState.ranks[1] ?? null;
  return {
    left: rank0 != null && rank0.bankGroups.length >= MAX_BANK_GROUPS,
    right: rank1 != null && rank1.bankGroups.length >= MAX_BANK_GROUPS,
  };
}

describe('BuilderDIMMBoard scenarios', () => {
  describe('add zones: Rank', () => {
    it('0 ranks, Rank selected: only LEFT zone (add first rank)', () => {
      const state = getInitialBoardState();
      const zones = getAddZoneState(state, 'Rank');
      expect(zones.left).toBe(true);
      expect(zones.right).toBe(false);
    });
    it('1 rank, Rank selected: only RIGHT zone (add second rank)', () => {
      const state: BoardState = { ranks: [createRank()] };
      const zones = getAddZoneState(state, 'Rank');
      expect(zones.left).toBe(false);
      expect(zones.right).toBe(true);
    });
    it('2 ranks, Rank selected: no zones', () => {
      const state: BoardState = { ranks: [createRank(), createRank()] };
      const zones = getAddZoneState(state, 'Rank');
      expect(zones.left).toBe(false);
      expect(zones.right).toBe(false);
    });
  });

  describe('add zones: BankGroup', () => {
    it('1 rank 0 BGs, BankGroup selected: only LEFT zone', () => {
      const state: BoardState = { ranks: [createRank()] };
      const zones = getAddZoneState(state, 'BankGroup');
      expect(zones.left).toBe(true);
      expect(zones.right).toBe(false);
    });
    it('1 rank 4 BGs, BankGroup selected: no left zone (capped)', () => {
      const rank = createRank([
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      const state: BoardState = { ranks: [rank] };
      const zones = getAddZoneState(state, 'BankGroup');
      expect(zones.left).toBe(false);
      expect(zones.right).toBe(false);
    });
    it('2 ranks, rank2 has 2 BGs, BankGroup selected: only RIGHT zone', () => {
      const r1 = createRank([
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      const r2 = createRank([createBankGroup(), createBankGroup()]);
      const state: BoardState = { ranks: [r1, r2] };
      const zones = getAddZoneState(state, 'BankGroup');
      expect(zones.left).toBe(false);
      expect(zones.right).toBe(true);
    });
  });

  describe('add zones: Bank', () => {
    it('1 rank 1 BG with room, Bank selected: only LEFT zone', () => {
      const bg = createBankGroup([createBankSlot()]);
      const rank = createRank([bg]);
      const state: BoardState = { ranks: [rank] };
      const zones = getAddZoneState(state, 'Bank');
      expect(zones.left).toBe(true);
      expect(zones.right).toBe(false);
    });
    it('2 ranks, each with 1 BG with room: both LEFT and RIGHT zones', () => {
      const r1 = createRank([createBankGroup([createBankSlot()])]);
      const r2 = createRank([createBankGroup([createBankSlot()])]);
      const state: BoardState = { ranks: [r1, r2] };
      const zones = getAddZoneState(state, 'Bank');
      expect(zones.left).toBe(true);
      expect(zones.right).toBe(true);
    });
    it('1 rank 1 BG full (32 banks): no Bank zone', () => {
      const banks = Array.from({ length: 32 }, () => createBankSlot());
      const bg = createBankGroup(banks);
      const rank = createRank([bg]);
      const state: BoardState = { ranks: [rank] };
      const zones = getAddZoneState(state, 'Bank');
      expect(zones.left).toBe(false);
      expect(zones.right).toBe(false);
    });
  });

  describe('add zones: BankHolder', () => {
    it('1 rank 1 empty BG, BankHolder16 selected: only LEFT zone', () => {
      const rank = createRank([createBankGroup()]);
      const state: BoardState = { ranks: [rank] };
      expect(getAddZoneState(state, 'BankHolder16').left).toBe(true);
      expect(getAddZoneState(state, 'BankHolder16').right).toBe(false);
      expect(getAddZoneState(state, 'BankHolder32').left).toBe(true);
    });
    it('1 rank 1 BG with banks (no holder): no holder slot', () => {
      const bg = createBankGroup([createBankSlot()]);
      const state: BoardState = { ranks: [createRank([bg])] };
      const z16 = getAddZoneState(state, 'BankHolder16');
      const z32 = getAddZoneState(state, 'BankHolder32');
      expect(z16.left).toBe(false);
      expect(z32.left).toBe(false);
    });
    it('2 ranks, rank1 BGs all have banks, rank2 has empty BG: BankHolder32 right zone only', () => {
      const r1 = createRank([
        createBankGroup([createBankSlot()]),
        createBankGroup([createBankSlot()]),
        createBankGroup([createBankSlot()]),
        createBankGroup([createBankSlot()]),
      ]);
      const r2 = createRank([createBankGroup()]);
      const state: BoardState = { ranks: [r1, r2] };
      const zones = getAddZoneState(state, 'BankHolder32');
      expect(zones.left).toBe(false);
      expect(zones.right).toBe(true);
    });
  });

  describe('add zones: no selection', () => {
    it('null selection: no zones', () => {
      const state: BoardState = { ranks: [createRank()] };
      const zones = getAddZoneState(state, null);
      expect(zones.left).toBe(false);
      expect(zones.right).toBe(false);
    });
  });

  describe('caps', () => {
    it('0 ranks: no caps', () => {
      const caps = getCapState(getInitialBoardState());
      expect(caps.left).toBe(false);
      expect(caps.right).toBe(false);
    });
    it('1 rank with 4 BGs: left cap only', () => {
      const rank = createRank([
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
        createBankGroup(),
      ]);
      const caps = getCapState({ ranks: [rank] });
      expect(caps.left).toBe(true);
      expect(caps.right).toBe(false);
    });
    it('2 ranks each with 4 BGs: both caps', () => {
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
      const caps = getCapState({ ranks: [r1, r2] });
      expect(caps.left).toBe(true);
      expect(caps.right).toBe(true);
    });
  });

  describe('totalBankGroups for 3D layout', () => {
    it('2 ranks × 4 BG = 8 total (two rows of 4)', () => {
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
      const total = (state: BoardState) =>
        state.ranks.reduce((s, r) => s + r.bankGroups.length, 0);
      expect(total({ ranks: [r1, r2] })).toBe(8);
    });
  });
});
