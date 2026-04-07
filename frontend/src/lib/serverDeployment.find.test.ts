import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { MemSpec, Workload, PowerResult, DIMMPowerResult, MemoryPreset } from './types';

function makeDimm(pTotal: number): DIMMPowerResult {
  const core: PowerResult = {
    P_PRE_STBY_core: 0.1,
    P_ACT_STBY_core: 0.1,
    P_ACT_PRE_core: 0.1,
    P_RD_core: 0.1,
    P_WR_core: 0.1,
    P_REF_core: 0.1,
    P_VDD_core: 0.1,
    P_VPP_core: 0.1,
    P_total_core: 1,
  };
  return {
    corePower: core,
    chipsPerDIMM: 8,
    corePowerTotal: 1,
    interfacePower: 0.5,
    pmicOverhead: 0.5,
    P_total_DIMM: pTotal,
    P_core_DIMM: pTotal * 0.5,
    P_interface_DIMM: pTotal * 0.3,
    P_overhead_DIMM: pTotal * 0.2,
  };
}

const mockMemspec: MemSpec = {
  memoryId: 'test_ddr5',
  memoryType: 'DDR5',
  registered: false,
  memarchitecturespec: {
    width: 8,
    nbrOfBanks: 16,
    nbrOfBankGroups: 8,
    nbrOfRanks: 1,
    nbrOfColumns: 1024,
    nbrOfRows: 65536,
    burstLength: 16,
    dataRate: 2,
  },
  mempowerspec: {
    vdd: 1.1,
    vpp: 1.8,
    vddq: 1.1,
    idd0: 50.0,
    idd2n: 46.0,
    idd3n: 105.0,
    idd4r: 210.0,
    idd4w: 245.0,
    idd5b: 10500.0,
    idd6n: 46.0,
    idd2p: 43.0,
    idd3p: 102.0,
    ipp0: 8.5,
    ipp2n: 7.5,
    ipp3n: 7.5,
    ipp4r: 8.5,
    ipp4w: 20.0,
    ipp5b: 700.0,
    ipp6n: 7.5,
    ipp2p: 7.5,
    ipp3p: 7.5,
  },
  memtimingspec: {
    tCK: 1.79e-10,
    RAS: 224,
    RCD: 117,
    RP: 117,
    RFC1: 2240,
    RFC2: 1680,
    RFCsb: 840,
    REFI: 44800,
  },
};

const findCtx = vi.hoisted(() => ({
  memoryPresets: [] as MemoryPreset[],
  dimPower: (_pr: PowerResult, _spec: MemSpec) => makeDimm(5),
}));

vi.mock('./api', () => ({
  isApiAvailable: () => false,
  fetchBatchDIMMPower: vi.fn(),
}));

vi.mock('./presets', () => {
  const balancedWorkload: Workload = {
    BNK_PRE_percent: 50.0,
    CKE_LO_PRE_percent: 0.0,
    CKE_LO_ACT_percent: 0.0,
    PageHit_percent: 50.0,
    RDsch_percent: 25.0,
    RD_Data_Low_percent: 50.0,
    WRsch_percent: 25.0,
    WR_Data_Low_percent: 50.0,
    termRDsch_percent: 0.0,
    termWRsch_percent: 0.0,
    System_tRC_ns: 46.0,
    tRRDsch_ns: 5.0,
  };
  return {
    get memoryPresets() {
      return findCtx.memoryPresets;
    },
    workloadPresets: [
      { id: 'balanced', name: 'Balanced', description: '', workload: balancedWorkload },
    ],
  };
});

vi.mock('./ddr5Calculator', () => {
  const core: PowerResult = {
    P_PRE_STBY_core: 0.1,
    P_ACT_STBY_core: 0.1,
    P_ACT_PRE_core: 0.1,
    P_RD_core: 0.1,
    P_WR_core: 0.1,
    P_REF_core: 0.1,
    P_VDD_core: 0.1,
    P_VPP_core: 0.1,
    P_total_core: 1,
  };
  return {
    computeCorePower: vi.fn(() => core),
    computeDIMMPower: vi.fn((pr: PowerResult, spec: MemSpec) => findCtx.dimPower(pr, spec)),
    calculateDataRate: vi.fn(() => 6400),
  };
});

import { findServerConfigurations, type ServerRequirements } from './serverDeployment';

describe('findServerConfigurations', () => {
  beforeEach(() => {
    findCtx.dimPower = () => makeDimm(5);
    findCtx.memoryPresets = [];
  });

  it('optimize mode can yield multiple DIMM counts per preset', async () => {
    findCtx.memoryPresets = [
      {
        id: 'solo',
        name: 'Solo',
        manufacturer: 'T',
        speed: '6400',
        capacity: '64',
        memspec: { ...mockMemspec, memoryId: 'solo' },
      },
    ];
    const requirements: ServerRequirements = {
      powerBudgetPerServer: 200,
      minDataRate: 4800,
      totalCapacity: 128,
      workloadType: 'balanced',
      dimmsPerServer: 4,
      dimmSearchMode: 'optimize',
    };
    const { rankedConfigurations: results, totalMatched } = await findServerConfigurations(requirements);
    const dimmCounts = [...new Set(results.map((r) => r.dimmsPerServer))].sort((a, b) => a - b);
    expect(dimmCounts).toEqual([2, 3, 4]);
    expect(results.length).toBe(3);
    expect(totalMatched).toBe(3);
  });

  it('max_slots mode evaluates only full slot count per preset', async () => {
    findCtx.memoryPresets = [
      {
        id: 'solo',
        name: 'Solo',
        manufacturer: 'T',
        speed: '6400',
        capacity: '64',
        memspec: { ...mockMemspec, memoryId: 'solo' },
      },
    ];
    const requirements: ServerRequirements = {
      powerBudgetPerServer: 200,
      minDataRate: 4800,
      totalCapacity: 128,
      workloadType: 'balanced',
      dimmsPerServer: 4,
      dimmSearchMode: 'max_slots',
    };
    const { rankedConfigurations: results, totalMatched } = await findServerConfigurations(requirements);
    expect(results).toHaveLength(1);
    expect(results[0].dimmsPerServer).toBe(4);
    expect(totalMatched).toBe(1);
  });

  it('sorts by score so higher headroom ranks above lower (two presets)', async () => {
    // Both must satisfy power budget: P_total_DIMM × 8 ≤ 100 → use ≤12.5 W/DIMM here.
    findCtx.dimPower = (_pr, spec) =>
      spec.memoryId === 'low' ? makeDimm(2) : makeDimm(10);
    findCtx.memoryPresets = [
      {
        id: 'high',
        name: 'High W',
        manufacturer: 'T',
        speed: '6400',
        capacity: '64',
        memspec: { ...mockMemspec, memoryId: 'high' },
      },
      {
        id: 'low',
        name: 'Low W',
        manufacturer: 'T',
        speed: '6400',
        capacity: '64',
        memspec: { ...mockMemspec, memoryId: 'low' },
      },
    ];
    const requirements: ServerRequirements = {
      powerBudgetPerServer: 100,
      minDataRate: 4800,
      totalCapacity: 128,
      workloadType: 'balanced',
      dimmsPerServer: 8,
      dimmSearchMode: 'max_slots',
    };
    const { rankedConfigurations: results, totalMatched } = await findServerConfigurations(requirements);
    expect(results).toHaveLength(2);
    expect(results[0].preset.id).toBe('low');
    expect(results[1].preset.id).toBe('high');
    expect(totalMatched).toBe(2);
  });
});
