/**
 * Hierarchical board state for drag-and-drop DDR5 builder.
 * DIMM → Ranks → Bank groups → Banks (or Bank holder with capacity).
 */

export type DragType = 'Rank' | 'BankGroup' | 'Bank' | 'BankHolder16' | 'BankHolder32';

export interface BankSlot {
  id: string;
  type: 'bank';
}

export interface BankGroup {
  id: string;
  banks: BankSlot[];
  /** If set, this group was filled via a holder (capacity 16 or 32) */
  holderCapacity?: 16 | 32;
}

export interface Rank {
  id: string;
  bankGroups: BankGroup[];
}

export interface BoardState {
  ranks: Rank[];
}

export const MAX_RANKS = 2;
export const MAX_BANK_GROUPS = 4;
export const MAX_BANKS_PER_GROUP = 32;

/**
 * UUID when available (browser / modern Node); fallback for Vitest/jsdom and older Node on CI.
 */
function newEntityId(prefix: string): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') {
    return `${prefix}-${c.randomUUID()}`;
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}

export function createBankSlot(): BankSlot {
  return { id: newEntityId('bank'), type: 'bank' };
}

export function createBankGroup(banks: BankSlot[] = [], holderCapacity?: 16 | 32): BankGroup {
  return {
    id: newEntityId('bg'),
    banks,
    holderCapacity,
  };
}

export function createRank(bankGroups: BankGroup[] = []): Rank {
  return { id: newEntityId('rank'), bankGroups };
}

/** Initial state: blank board (no ranks, no banks) */
export function getInitialBoardState(): BoardState {
  return { ranks: [] };
}

export function canAddRank(state: BoardState): boolean {
  return state.ranks.length < MAX_RANKS;
}

export function canAddBankGroup(rank: Rank): boolean {
  return rank.bankGroups.length < MAX_BANK_GROUPS;
}

export function canAddBank(bankGroup: BankGroup, isHolder: boolean, capacity?: 16 | 32): boolean {
  if (isHolder) {
    return bankGroup.banks.length === 0 && bankGroup.holderCapacity == null;
  }
  if (bankGroup.holderCapacity != null) {
    return bankGroup.banks.length < bankGroup.holderCapacity;
  }
  return bankGroup.banks.length < MAX_BANKS_PER_GROUP;
}

/**
 * Banks shown per group in the 3D builder (2×4 tiles). “Add Bank” fills each group to this
 * count in order, then continues 9→32 on each group so new banks stay visible on the chip.
 */
export const BUILDER_VISUAL_BANKS_PER_GROUP = 8;

/** Bank group that should receive the next single-bank add on this rank. */
export function findBankGroupIdForNextBank(rank: Rank): string | null {
  if (rank.bankGroups.length === 0) return null;
  for (const bg of rank.bankGroups) {
    if (bg.holderCapacity != null) {
      if (bg.banks.length < bg.holderCapacity) return bg.id;
      continue;
    }
    if (bg.banks.length < BUILDER_VISUAL_BANKS_PER_GROUP) return bg.id;
  }
  for (const bg of rank.bankGroups) {
    if (bg.holderCapacity != null) continue;
    if (bg.banks.length < MAX_BANKS_PER_GROUP) return bg.id;
  }
  return null;
}

/** Derive nbrOfRanks (1 or 2), nbrOfBankGroups (0–8), nbrOfBanks (16 or 32) for MemSpec */
export function deriveArchitectureFromBoard(state: BoardState): {
  nbrOfRanks: number;
  nbrOfBankGroups: number;
  nbrOfBanks: 16 | 32;
} {
  const nbrOfRanks = Math.min(state.ranks.length, MAX_RANKS);
  const firstRank = state.ranks[0];
  const nbrOfBankGroups = firstRank
    ? Math.min(firstRank.bankGroups.length, MAX_BANK_GROUPS)
    : 0;
  let bankCount = 0;
  if (firstRank?.bankGroups[0]) {
    const bg = firstRank.bankGroups[0];
    bankCount = bg.holderCapacity ?? bg.banks.length;
  }
  const nbrOfBanks: 16 | 32 = bankCount >= 32 ? 32 : 16;
  return { nbrOfRanks, nbrOfBankGroups, nbrOfBanks };
}
