'use client';

import { useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BuilderDIMMBoard } from '@/components/BuilderDIMMBoard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import {
  defaultWorkload,
  getBaseMemspecBySpeed,
  SPEED_OPTIONS,
} from '@/lib/presets';
import { useConfig } from '@/contexts/ConfigContext';
import { computeCorePower, computeDIMMPower, formatPower } from '@/lib/ddr5Calculator';
import type { MemSpec } from '@/lib/types';
import {
  deriveArchitectureFromBoard,
  canAddRank,
  findBankGroupIdForNextBank,
  createRank,
  createBankGroup,
  createBankSlot,
  MAX_BANKS_PER_GROUP,
  MAX_BANK_GROUPS,
  MAX_RANKS,
} from '@/lib/builderState';
import type { BoardState } from '@/lib/builderState';
import { cn } from '@/lib/utils';
import { CheckCircle2, ExternalLink } from 'lucide-react';

type WidthOption = 8 | 16;
const WIDTH_MIN = 8;
const WIDTH_MAX = 16;
const COLUMNS_OPTIONS = [512, 1024, 2048];
const BURST_LENGTH_OPTIONS = [16];
const DEVICES_OPTIONS = [2, 4, 8, 16] as const;
const NBR_ROWS_DEFAULT = 65536;
const DATA_RATE_DEFAULT = 2;

export interface VisualBuilderContentProps {
  /** When provided, "Use this config" calls this instead of setMemspec + navigate (e.g. when embedded in Config). */
  onApply?: (memspec: MemSpec) => void;
}

export function VisualBuilderContent({ onApply }: VisualBuilderContentProps) {
  const router = useRouter();
  const { setMemspec, visualBuilderDraft, setVisualBuilderDraft } = useConfig();
  const { boardState, width, nbrOfColumns, nbrOfDevices, speed } = visualBuilderDraft;
  const burstLength = 16;

  const setBoardState = useCallback(
    (u: BoardState | ((prev: BoardState) => BoardState)) => {
      setVisualBuilderDraft((prev) => ({
        ...prev,
        boardState: typeof u === 'function' ? u(prev.boardState) : u,
      }));
    },
    [setVisualBuilderDraft]
  );

  const setWidth = useCallback(
    (w: WidthOption) => setVisualBuilderDraft((prev) => ({ ...prev, width: w })),
    [setVisualBuilderDraft]
  );
  const setNbrOfColumns = useCallback(
    (c: number) => setVisualBuilderDraft((prev) => ({ ...prev, nbrOfColumns: c })),
    [setVisualBuilderDraft]
  );
  const setNbrOfDevices = useCallback(
    (d: number) => setVisualBuilderDraft((prev) => ({ ...prev, nbrOfDevices: d })),
    [setVisualBuilderDraft]
  );
  const setSpeed = useCallback(
    (s: number) => setVisualBuilderDraft((prev) => ({ ...prev, speed: s })),
    [setVisualBuilderDraft]
  );

  const { nbrOfRanks, nbrOfBankGroups, nbrOfBanks } = useMemo(
    () => deriveArchitectureFromBoard(boardState),
    [boardState]
  );

  const displayBanks = useMemo(() => {
    let total = 0;
    for (const rank of boardState.ranks) {
      for (const bg of rank.bankGroups) {
        total += bg.holderCapacity ?? bg.banks.length;
      }
    }
    return total;
  }, [boardState]);

  const totalBankGroups = useMemo(
    () => boardState.ranks.reduce((s, r) => s + r.bankGroups.length, 0),
    [boardState]
  );

  /** Real bank count per BG in rank order — drives 3D so Rank 1 adds stay on Rank 1’s groups. */
  const banksPerGroupExact = useMemo(() => {
    const out: number[] = [];
    for (const rank of boardState.ranks) {
      for (const bg of rank.bankGroups) {
        out.push(bg.banks.length);
      }
    }
    return out;
  }, [boardState]);

  const firstRankWithRoomForBg = useMemo(
    () => boardState.ranks.find((r) => r.bankGroups.length < MAX_BANK_GROUPS) ?? null,
    [boardState]
  );

  const firstSlotForBankByRank = useMemo(() => {
    return boardState.ranks.map((rank) => {
      const bankGroupId = findBankGroupIdForNextBank(rank);
      return bankGroupId ? { rankId: rank.id, bankGroupId } : null;
    });
  }, [boardState]);
  const firstSlotForBank = firstSlotForBankByRank[0] ?? firstSlotForBankByRank[1] ?? null;

  const firstSlotForHolder = useMemo(() => {
    for (const rank of boardState.ranks) {
      for (const bg of rank.bankGroups) {
        if (bg.banks.length === 0 && bg.holderCapacity == null)
          return { rankId: rank.id, bankGroupId: bg.id };
      }
    }
    return null;
  }, [boardState]);

  const lastAddRankRef = useRef(0);
  const addRankLockRef = useRef(false);
  const handleAddRank = useCallback(() => {
    if (addRankLockRef.current) return;
    addRankLockRef.current = true;
    setTimeout(() => { addRankLockRef.current = false; }, 1200);
    const now = Date.now();
    if (now - lastAddRankRef.current < 1000) return;
    lastAddRankRef.current = now;
    if (!canAddRank(boardState)) return;
    setBoardState((prev) => {
      if (prev.ranks.length >= MAX_RANKS) return prev;
      return { ...prev, ranks: [...prev.ranks, createRank()] };
    });
  }, [boardState]);

  const handleAddBankGroup = useCallback((rankId: string) => {
    setBoardState((prev) => ({
      ...prev,
      ranks: prev.ranks.map((r) =>
        r.id === rankId && r.bankGroups.length < MAX_BANK_GROUPS
          ? { ...r, bankGroups: [...r.bankGroups, createBankGroup()] }
          : r
      ),
    }));
  }, []);

  const lastAddBankRef = useRef(0);
  const addBankLockRef = useRef(false);
  const handleAddBank = useCallback((rankId: string, bankGroupId: string) => {
    if (addBankLockRef.current) return;
    const now = Date.now();
    if (now - lastAddBankRef.current < 900) return;
    addBankLockRef.current = true;
    lastAddBankRef.current = now;
    setTimeout(() => { addBankLockRef.current = false; }, 900);
    setBoardState((prev) => {
      let added = false;
      return {
        ...prev,
        ranks: prev.ranks.map((r) => {
          if (r.id !== rankId) return r;
          return {
            ...r,
            bankGroups: r.bankGroups.map((bg) => {
              if (bg.id !== bankGroupId || added) return bg;
              const atCapacity =
                (bg.holderCapacity != null && bg.banks.length >= bg.holderCapacity) ||
                (bg.holderCapacity == null && bg.banks.length >= MAX_BANKS_PER_GROUP);
              if (atCapacity) return bg;
              added = true;
              return { ...bg, banks: [...bg.banks, createBankSlot()] };
            }),
          };
        }),
      };
    });
  }, []);

  const handleAddBankHolder = useCallback((rankId: string, bankGroupId: string, capacity: 16 | 32) => {
    setBoardState((prev) => ({
      ...prev,
      ranks: prev.ranks.map((r) => {
        if (r.id !== rankId) return r;
        return {
          ...r,
          bankGroups: r.bankGroups.map((bg) => {
            if (bg.id !== bankGroupId || bg.banks.length !== 0 || bg.holderCapacity != null)
              return bg;
            const banks = Array.from({ length: capacity }, createBankSlot);
            return { ...createBankGroup(banks, capacity), id: bg.id };
          }),
        };
      }),
    }));
  }, []);

  const derivedMemspec: MemSpec = useMemo(() => {
    const base = getBaseMemspecBySpeed(speed);
    const arch = {
      width,
      nbrOfBanks,
      nbrOfBankGroups,
      nbrOfRanks,
      nbrOfColumns,
      nbrOfRows: NBR_ROWS_DEFAULT,
      nbrOfDevices,
      burstLength,
      dataRate: DATA_RATE_DEFAULT,
    };
    return {
      ...base,
      memoryId: `builder_${nbrOfDevices}d_${nbrOfRanks}r_x${width}_${speed}`,
      memarchitecturespec: arch,
    };
  }, [nbrOfDevices, nbrOfRanks, width, nbrOfBanks, nbrOfBankGroups, nbrOfColumns, burstLength, speed]);

  const powerResult = useMemo(() => {
    const core = computeCorePower(derivedMemspec, defaultWorkload);
    const dimm = computeDIMMPower(core, derivedMemspec, {});
    return { core, dimm };
  }, [derivedMemspec]);

  const handleUseConfig = () => {
    if (onApply) {
      onApply(derivedMemspec);
    } else {
      setMemspec(derivedMemspec);
      router.push('/configuration');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Add components
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-col gap-2">
              <Button variant="outline" size="sm" className="w-full justify-start" disabled={!canAddRank(boardState)} onClick={() => handleAddRank()}>
                Add Rank
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start" disabled={!firstRankWithRoomForBg} onClick={() => firstRankWithRoomForBg && handleAddBankGroup(firstRankWithRoomForBg.id)}>
                Add Bank group
              </Button>
              {boardState.ranks.length >= 2 ? (
                <>
                  <Button variant="outline" size="sm" className="w-full justify-start" disabled={!firstSlotForBankByRank[0]} onClick={() => firstSlotForBankByRank[0] && handleAddBank(firstSlotForBankByRank[0].rankId, firstSlotForBankByRank[0].bankGroupId)}>
                    Add Bank — Rank 1
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start" disabled={!firstSlotForBankByRank[1]} onClick={() => firstSlotForBankByRank[1] && handleAddBank(firstSlotForBankByRank[1].rankId, firstSlotForBankByRank[1].bankGroupId)}>
                    Add Bank — Rank 2
                  </Button>
                </>
              ) : (
                <Button variant="outline" size="sm" className="w-full justify-start" disabled={!firstSlotForBank} onClick={() => firstSlotForBank && handleAddBank(firstSlotForBank.rankId, firstSlotForBank.bankGroupId)}>
                  Add Bank
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">DIMM settings (sidebar)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Device width (I/O)</label>
              <div className="flex items-center gap-2 mb-1 max-w-xs">
                <span className="text-[10px] text-muted-foreground w-9 shrink-0">8-bit</span>
                <Slider
                  value={[width]}
                  onValueChange={([v]) => setWidth(v as WidthOption)}
                  min={WIDTH_MIN}
                  max={WIDTH_MAX}
                  step={8}
                  className="flex-1"
                />
                <span className="text-[10px] text-muted-foreground w-9 shrink-0 text-right">16-bit</span>
              </div>
              <p className="text-xs text-muted-foreground tabular-nums">Selected: {width}-bit</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Burst length</label>
              <div className="flex flex-wrap gap-2">
                {BURST_LENGTH_OPTIONS.map((bl) => (
                  <button key={bl} type="button" className="px-3 py-1.5 rounded-md text-sm border border-primary bg-primary/10">{bl}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Columns</label>
              <div className="flex flex-wrap gap-2">
                {COLUMNS_OPTIONS.map((c) => (
                  <button key={c} type="button" onClick={() => setNbrOfColumns(c)} className={cn('px-3 py-1.5 rounded-md text-sm border transition-colors', nbrOfColumns === c ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50')}>{c.toLocaleString()}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Devices on DIMM</label>
              <div className="flex flex-wrap gap-2">
                {DEVICES_OPTIONS.map((d) => (
                  <button key={d} type="button" onClick={() => setNbrOfDevices(d)} className={cn('px-3 py-1.5 rounded-md text-sm border transition-colors', nbrOfDevices === d ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50')}>{d}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-2">Speed (MT/s)</label>
              <div className="flex flex-wrap gap-2">
                {SPEED_OPTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => setSpeed(s)} className={cn('px-3 py-1.5 rounded-md text-sm border transition-colors', speed === s ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50')}>{s}</button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">DDR5 components → config</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">memarchitecturespec (geometry)</p>
            <ul className="list-disc pl-4 space-y-1">
              <li><strong className="text-foreground">Devices on DIMM</strong> → <code className="bg-muted px-1 rounded">nbrOfDevices</code></li>
              <li><strong className="text-foreground">Ranks</strong> → <code className="bg-muted px-1 rounded">nbrOfRanks</code> (1 or 2)</li>
              <li><strong className="text-foreground">Width (slider)</strong> → <code className="bg-muted px-1 rounded">width</code> (8 or 16 bits)</li>
              <li><strong className="text-foreground">Banks</strong> → <code className="bg-muted px-1 rounded">nbrOfBanks</code> (16 or 32)</li>
              <li><strong className="text-foreground">Bank groups</strong> → <code className="bg-muted px-1 rounded">nbrOfBankGroups</code></li>
              <li><strong className="text-foreground">Columns</strong> → <code className="bg-muted px-1 rounded">nbrOfColumns</code>; <code className="bg-muted px-1 rounded">nbrOfRows</code>, <code className="bg-muted px-1 rounded">burstLength</code>, <code className="bg-muted px-1 rounded">dataRate</code></li>
            </ul>
            <p className="font-medium text-foreground pt-1">mempowerspec / memtimingspec</p>
            <p><strong className="text-foreground">Speed</strong> selects preset for vdd, vpp, IDD/IPP, tCK, RAS, RFC, REFI.</p>
            <p className="pt-2 border-t border-border">
              <a href="https://www.jedec.org/standards-documents/docs/jesd79-5" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">JEDEC DDR5 (JESD79-5) <ExternalLink className="w-3 h-3" /></a>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-3 space-y-4">
        <BuilderDIMMBoard
          boardState={boardState}
          nbrOfBanks={nbrOfBanks}
          nbrOfBankGroups={nbrOfBankGroups}
          nbrOfRanks={nbrOfRanks}
          totalBankGroups={totalBankGroups}
          displayBanks={displayBanks}
          banksPerGroupExact={banksPerGroupExact}
          width={width}
          nbrOfColumns={nbrOfColumns}
          burstLength={burstLength}
          nbrOfDevices={nbrOfDevices}
        />
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Components on board</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Ranks</span><span className="font-mono font-medium tabular-nums">{boardState.ranks.length}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Bank groups</span><span className="font-mono font-medium tabular-nums">{boardState.ranks.reduce((sum, r) => sum + r.bankGroups.length, 0)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Banks</span><span className="font-mono font-medium tabular-nums">{boardState.ranks.reduce((s, r) => s + r.bankGroups.reduce((a, bg) => a + bg.banks.length, 0), 0)}</span></div>
            {boardState.ranks.length > 0 && (
              <div className="pt-2 border-t border-border text-xs text-muted-foreground">
                {boardState.ranks.map((r, i) => (
                  <div key={r.id}>Rank {i + 1}: {r.bankGroups.length} BG, {r.bankGroups.reduce((s, bg) => s + bg.banks.length, 0)} banks</div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Live power</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 text-sm">
                <div>Core total: {formatPower(powerResult.core.P_total_core)}</div>
                <div>DIMM total: {formatPower(powerResult.dimm.P_total_DIMM)}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Apply to app</CardTitle>
            </CardHeader>
            <CardContent>
              <Button onClick={handleUseConfig} className="w-full sm:w-auto">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Use this config
              </Button>
              <p className="text-xs text-muted-foreground mt-2">Pushes this derived MemSpec to Configuration for calculations.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
