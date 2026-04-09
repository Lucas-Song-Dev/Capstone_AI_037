import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  normalizeMemspecForApi,
  ddr5MempowerspecUiMaToCoreAmps,
  tryApiThenLocalPower,
  coreApiResponseToPowerResult,
  dimmApiResponseToResult,
} from './api';
import type { MemSpec, Workload } from './types';

const workload: Workload = {
  BNK_PRE_percent: 50,
  CKE_LO_PRE_percent: 0,
  CKE_LO_ACT_percent: 0,
  PageHit_percent: 50,
  RDsch_percent: 25,
  RD_Data_Low_percent: 50,
  WRsch_percent: 25,
  WR_Data_Low_percent: 50,
  termRDsch_percent: 0,
  termWRsch_percent: 0,
  System_tRC_ns: 46,
  tRRDsch_ns: 5,
};

function lpddrMemspec(): MemSpec {
  const m = baseMemspec();
  return {
    ...m,
    memoryId: 'lpddr',
    memoryType: 'LPDDR5X',
    memarchitecturespec: {
      ...m.memarchitecturespec,
      width: 16,
      nbrOfBankGroups: 4,
      nbrOfColumns: 64,
      nbrOfRows: 49152,
      nbrOfDBs: 0,
    },
    mempowerspec: {
      ...m.mempowerspec,
      rails: {
        vdd1_range_V: [1.7, 1.95],
        vdd2h_range_V: [1.01, 1.12],
        vdd2l_range_V: [0.87, 0.97],
        vddq_range_V: [0.47, 0.57],
      },
      idd_by_rail_A: {
        idd2n: { vdd1: 0.001, vdd2h: 0.016, vdd2l: 0.0002, vddq: 0.0006 },
      },
    },
    memtimingspec: {
      ...m.memtimingspec,
      tCK: 1 / 3.75e9,
      RAS: 0,
      RCD: 0,
      RP: 0,
      RFC1: 0,
      REFI: 0,
      RFCab_ns: 280,
    },
  };
}

function baseMemspec(): MemSpec {
  return {
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
      idd0: 50,
      idd2n: 46,
      idd3n: 105,
      idd4r: 210,
      idd4w: 245,
      idd5b: 10500,
      idd6n: 46,
      idd2p: 43,
      idd3p: 102,
      ipp0: 5,
      ipp2n: 4.5,
      ipp3n: 10,
      ipp4r: 20,
      ipp4w: 25,
      ipp5b: 1000,
      ipp6n: 4.5,
      ipp2p: 4,
      ipp3p: 9.5,
    },
    memtimingspec: {
      tCK: 1e-9,
      RAS: 28,
      RCD: 28,
      RP: 14,
      RFC1: 350,
      RFC2: 260,
      RFCsb: 140,
      REFI: 7800,
    },
  };
}

const mockCoreJson = {
  P_PRE_STBY_core: 0.01,
  P_ACT_STBY_core: 0.02,
  P_ACT_PRE_core: 0.03,
  P_RD_core: 0.04,
  P_WR_core: 0.05,
  P_REF_core: 0.06,
  P_VDD_core: 0.5,
  P_VPP_core: 0.1,
  P_total_core: 0.81,
};

const mockDimmJson = {
  ...mockCoreJson,
  P_total_interface: 0.1,
  P_total: 0.91,
  'core.P_PRE_STBY_core': 0.01,
  'core.P_ACT_STBY_core': 0.02,
  'core.P_ACT_PRE_core': 0.03,
  'core.P_RD_core': 0.04,
  'core.P_WR_core': 0.05,
  'core.P_REF_core': 0.06,
  'core.P_VDD_core': 0.5,
  'core.P_VPP_core': 0.1,
};

describe('normalizeMemspecForApi', () => {
  it('coerces boolean registered to string', () => {
    const m = baseMemspec();
    const out = normalizeMemspecForApi(m);
    expect(out.registered).toBe('false');
    expect(m.registered).toBe(false);
  });

  it('adds nbrOfDBs from nbrOfBankGroups when missing', () => {
    const m = baseMemspec();
    const out = normalizeMemspecForApi(m);
    expect(out.memarchitecturespec.nbrOfDBs).toBe(8);
  });

  it('preserves explicit nbrOfDBs', () => {
    const m = baseMemspec();
    m.memarchitecturespec.nbrOfDBs = 0;
    const out = normalizeMemspecForApi(m);
    expect(out.memarchitecturespec.nbrOfDBs).toBe(0);
  });

  it('defaults nbrOfDevices to 1', () => {
    const out = normalizeMemspecForApi(baseMemspec());
    expect(out.memarchitecturespec.nbrOfDevices).toBe(1);
  });

  it('is stable when called twice (mA→A only once)', () => {
    const once = normalizeMemspecForApi(baseMemspec());
    const twice = normalizeMemspecForApi(once);
    expect(twice).toEqual(once);
  });

  it('converts DDR5 IDD/IPP from mA to A for the Python core', () => {
    const out = normalizeMemspecForApi(baseMemspec());
    expect(out.mempowerspec.idd3n).toBeCloseTo(0.105, 6);
    expect(out.mempowerspec.idd5b).toBeCloseTo(10.5, 6);
    expect(out.mempowerspec.ipp2n).toBeCloseTo(0.0045, 6);
  });

  it('leaves LPDDR mempowerspec rails / idd_by_rail_A unchanged', () => {
    const out = normalizeMemspecForApi(lpddrMemspec());
    expect(out.mempowerspec.idd_by_rail_A?.idd2n?.vdd1).toBe(0.001);
  });
});

describe('ddr5MempowerspecUiMaToCoreAmps', () => {
  it('does not scale values already in amperes', () => {
    const p = baseMemspec().mempowerspec;
    const si = {
      ...p,
      idd0: 0.05,
      idd2n: 0.046,
      idd3n: 0.105,
      idd4r: 0.21,
      idd4w: 0.245,
      idd5b: 10.5,
      idd6n: 0.046,
      idd2p: 0.043,
      idd3p: 0.102,
      ipp0: 0.005,
      ipp2n: 0.0045,
      ipp3n: 0.01,
      ipp4r: 0.02,
      ipp4w: 0.025,
      ipp5b: 1.0,
      ipp6n: 0.0045,
      ipp2p: 0.004,
      ipp3p: 0.0095,
    };
    const out = ddr5MempowerspecUiMaToCoreAmps(si);
    expect(out.idd3n).toBe(0.105);
    expect(out.idd5b).toBe(10.5);
  });
});

describe('coreApiResponseToPowerResult', () => {
  it('maps DDR5 flat core response', () => {
    const r = coreApiResponseToPowerResult(mockCoreJson, false);
    expect(r.P_VDD_core).toBe(0.5);
    expect(r.P_VPP_core).toBe(0.1);
    expect(r.P_VDD1).toBeUndefined();
  });

  it('maps LPDDR rail keys and aggregates P_VDD_core', () => {
    const r = coreApiResponseToPowerResult(
      {
        ...mockCoreJson,
        P_VDD1: 0.01,
        P_VDD2H: 0.4,
        P_VDD2L: 0.02,
        P_VDDQ: 0.03,
        P_total_core: 0.9,
      },
      false
    );
    expect(r.P_VDD1).toBe(0.01);
    expect(r.P_VDD2H).toBe(0.4);
    expect(r.P_VDD_core).toBeCloseTo(0.46, 5);
    expect(r.P_VPP_core).toBe(0);
  });
});

describe('dimmApiResponseToResult DDR5 aggregate → per-device corePower', () => {
  it('divides summed core.* by modeled device count when n > 1', () => {
    const m = {
      ...baseMemspec(),
      memarchitecturespec: {
        ...baseMemspec().memarchitecturespec,
        width: 8,
        nbrOfRanks: 1,
        nbrOfDevices: 2,
      },
    };
    const raw = {
      P_total_core: 1.6,
      P_total_interface: 0.1,
      P_total: 1.7,
      'core.P_PRE_STBY_core': 0.2,
      'core.P_ACT_STBY_core': 0.2,
      'core.P_ACT_PRE_core': 0.2,
      'core.P_RD_core': 0.2,
      'core.P_WR_core': 0.2,
      'core.P_REF_core': 0.2,
      'core.P_VDD_core': 1.0,
      'core.P_VPP_core': 0.6,
      'core.P_total_core': 1.6,
    };
    const d = dimmApiResponseToResult(raw, m);
    expect(d.corePower.P_total_core).toBeCloseTo(0.8, 5);
    expect(d.corePower.P_VDD_core).toBeCloseTo(0.5, 5);
    expect(d.corePowerTotal).toBe(1.6);
    expect(d.P_core_DIMM).toBe(1.6);
  });
});

describe('dimmApiResponseToResult LPDDR', () => {
  it('reads core.P_VDD* rails', () => {
    const raw = {
      P_total_core: 1,
      P_total_interface: 0.05,
      P_total: 1.05,
      'core.P_VDD1': 0.02,
      'core.P_VDD2H': 0.5,
      'core.P_VDD2L': 0.03,
      'core.P_VDDQ': 0.04,
      'core.P_PRE_STBY_core': 0,
      'core.P_ACT_STBY_core': 0,
      'core.P_ACT_PRE_core': 0,
      'core.P_RD_core': 0,
      'core.P_WR_core': 0,
      'core.P_REF_core': 0,
    };
    const d = dimmApiResponseToResult(raw, baseMemspec());
    expect(d.corePower.P_VDD2H).toBe(0.5);
    expect(d.corePower.P_VDD_core).toBeCloseTo(0.59, 5);
  });
});

describe('tryApiThenLocalPower', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:9');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('uses local path when API URL is empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    const { powerResult, usedFallback } = await tryApiThenLocalPower(baseMemspec(), workload);
    expect(powerResult.P_total_core).toBeGreaterThan(0);
    expect(usedFallback).toBe(false);
  });

  it('uses API when fetch succeeds', async () => {
    global.fetch = vi.fn().mockImplementation((url: string | URL) => {
      const u = String(url);
      if (u.includes('/api/calculate/core')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockCoreJson),
        });
      }
      if (u.includes('/api/calculate/dimm')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDimmJson),
        });
      }
      return Promise.reject(new Error(`unexpected ${u}`));
    });

    const { powerResult, dimmPowerResult, usedFallback } = await tryApiThenLocalPower(
      baseMemspec(),
      workload
    );
    expect(usedFallback).toBe(false);
    expect(powerResult.P_total_core).toBe(0.81);
    expect(dimmPowerResult.P_total_DIMM).toBe(0.91);
    expect(global.fetch).toHaveBeenCalled();
  });

  it('falls back to local when API returns 422', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: [] }),
    });

    const { powerResult, usedFallback } = await tryApiThenLocalPower(baseMemspec(), workload);
    expect(usedFallback).toBe(true);
    expect(powerResult.P_total_core).toBeGreaterThan(0);
  });

  it('falls back when fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network'));

    const { powerResult, usedFallback } = await tryApiThenLocalPower(baseMemspec(), workload);
    expect(usedFallback).toBe(true);
    expect(powerResult.P_total_core).toBeGreaterThan(0);
  });

  it('throws when LPDDR and API URL is empty', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');
    await expect(tryApiThenLocalPower(lpddrMemspec(), workload)).rejects.toThrow(/LPDDR5\/LPDDR5X/);
  });

  it('rethrows on API failure for LPDDR (no DDR5 local fallback)', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:9');
    global.fetch = vi.fn().mockRejectedValue(new Error('network'));
    await expect(tryApiThenLocalPower(lpddrMemspec(), workload)).rejects.toThrow('network');
  });
});
