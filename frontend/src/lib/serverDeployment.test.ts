import { describe, it, expect } from 'vitest';
import type { MemSpec, Workload, PowerResult, DIMMPowerResult, MemoryPreset } from './types';
import {
  dimmCountsForSearchMode,
  buildServerConfiguration,
  pickDiverseRankedConfigurations,
  SERVER_DEPLOYMENT_RANK_MAX,
  SERVER_DEPLOYMENT_RANK_TARGET,
  type ServerRequirements,
  type ServerConfiguration,
} from './serverDeployment';
import { fleetMemoryPowerKw, fleetMemoryCapacityTb } from './serverDeploymentMetrics';

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

const mockWorkload: Workload = {
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

const mockCore: PowerResult = {
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

function makeDimm(pTotal: number): DIMMPowerResult {
  return {
    corePower: mockCore,
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

describe('dimmCountsForSearchMode', () => {
  it('returns 1..max for optimize', () => {
    expect(dimmCountsForSearchMode(4, 'optimize')).toEqual([1, 2, 3, 4]);
  });

  it('returns only max for max_slots', () => {
    expect(dimmCountsForSearchMode(8, 'max_slots')).toEqual([8]);
  });

  it('floors and clamps max to at least 1', () => {
    expect(dimmCountsForSearchMode(0, 'optimize')).toEqual([1]);
    expect(dimmCountsForSearchMode(2.7, 'max_slots')).toEqual([2]);
  });
});

describe('buildServerConfiguration', () => {
  const preset: MemoryPreset = {
    id: 'p1',
    name: 'Test 64GB',
    manufacturer: 'T',
    speed: '6400',
    capacity: '64',
    memspec: mockMemspec,
  };

  const baseReq: ServerRequirements = {
    powerBudgetPerServer: 100,
    minDataRate: 4800,
    totalCapacity: 128,
    workloadType: 'balanced',
    dimmsPerServer: 8,
  };

  it('scales powerPerServer linearly with DIMM count', () => {
    const dimm = makeDimm(5);
    const c2 = buildServerConfiguration(preset, baseReq, 2, mockWorkload, mockCore, dimm);
    const c4 = buildServerConfiguration(preset, baseReq, 4, mockWorkload, mockCore, dimm);
    expect(c2.powerPerServer).toBe(10);
    expect(c4.powerPerServer).toBe(20);
    expect(c2.powerPerDIMM).toBe(5);
  });

  it('keeps powerPerServer = powerPerDIMM × dimmsPerServer (memory watts)', () => {
    const dimm = makeDimm(3.75);
    const c = buildServerConfiguration(preset, baseReq, 6, mockWorkload, mockCore, dimm);
    expect(c.powerPerDIMM).toBeCloseTo(3.75, 10);
    expect(c.powerPerServer).toBeCloseTo(3.75 * 6, 10);
    expect(c.powerPerServer).toBeCloseTo(c.powerPerDIMM * c.dimmsPerServer, 10);
  });

  it('totalCapacity is GB per DIMM × DIMM count', () => {
    const dimm = makeDimm(1);
    const c = buildServerConfiguration(preset, baseReq, 4, mockWorkload, mockCore, dimm);
    expect(c.totalCapacity).toBe(64 * 4);
  });

  it('fleet kW matches N × powerPerServer / 1000', () => {
    const dimm = makeDimm(12);
    const c = buildServerConfiguration(preset, baseReq, 4, mockWorkload, mockCore, dimm);
    const n = 250;
    expect(fleetMemoryPowerKw(n, c.powerPerServer)).toBeCloseTo((n * c.powerPerServer) / 1000, 10);
    expect(fleetMemoryPowerKw(n, c.powerPerServer)).toBeCloseTo(12, 10); // 250 * 48 / 1000
  });

  it('fleet TB matches UI formula (N × GB/server ÷ 1024)', () => {
    const dimm = makeDimm(1);
    const c = buildServerConfiguration(preset, baseReq, 8, mockWorkload, mockCore, dimm);
    const n = 128;
    expect(fleetMemoryCapacityTb(n, c.totalCapacity)).toBeCloseTo((n * c.totalCapacity) / 1024, 10);
  });

  it('marks power requirement false when server power exceeds budget', () => {
    const dimm = makeDimm(10);
    const req = { ...baseReq, powerBudgetPerServer: 25 };
    const c = buildServerConfiguration(preset, req, 4, mockWorkload, mockCore, dimm);
    expect(c.powerPerServer).toBe(40);
    expect(c.meetsRequirements.power).toBe(false);
  });

  it('marks power true when within budget', () => {
    const dimm = makeDimm(5);
    const c = buildServerConfiguration(preset, baseReq, 4, mockWorkload, mockCore, dimm);
    expect(c.meetsRequirements.power).toBe(true);
  });
});

describe('pickDiverseRankedConfigurations', () => {
  const baseReq: ServerRequirements = {
    powerBudgetPerServer: 200,
    minDataRate: 4800,
    totalCapacity: 64,
    workloadType: 'balanced',
    dimmsPerServer: 8,
  };

  function cfg(id: string, dimms: number, score: number): ServerConfiguration {
    const preset: MemoryPreset = {
      id,
      name: id,
      manufacturer: 'T',
      speed: '6400',
      capacity: '64',
      memspec: { ...mockMemspec, memoryId: id },
    };
    const built = buildServerConfiguration(preset, baseReq, dimms, mockWorkload, mockCore, makeDimm(3));
    return { ...built, score };
  }

  it('returns all rows when count is at or below target', () => {
    const list = [cfg('a', 8, 3), cfg('b', 8, 2), cfg('c', 8, 1)];
    const out = pickDiverseRankedConfigurations(list);
    expect(out).toHaveLength(3);
    expect(out.map((c) => c.preset.id)).toEqual(['a', 'b', 'c']);
  });

  it('caps long lists at SERVER_DEPLOYMENT_RANK_MAX with variety', () => {
    const list: ServerConfiguration[] = [];
    for (let i = 0; i < 30; i++) {
      list.push(cfg(`p${i}`, 8, 30 - i));
    }
    const out = pickDiverseRankedConfigurations(list);
    expect(out.length).toBeLessThanOrEqual(SERVER_DEPLOYMENT_RANK_MAX);
    expect(out.length).toBeGreaterThanOrEqual(SERVER_DEPLOYMENT_RANK_TARGET);
    const ids = new Set(out.map((c) => c.preset.id));
    expect(ids.size).toBe(out.length);
  });

  it('keeps distinct DIMM counts when one preset has many valid counts', () => {
    const list: ServerConfiguration[] = [];
    for (let d = 8; d >= 1; d--) {
      list.push(cfg('only', d, d));
    }
    const out = pickDiverseRankedConfigurations(list);
    expect(out.length).toBeLessThanOrEqual(SERVER_DEPLOYMENT_RANK_MAX);
    expect(out.length).toBeGreaterThanOrEqual(3);
    const dimSet = new Set(out.map((c) => c.dimmsPerServer));
    expect(dimSet.size).toBe(out.length);
  });
});
