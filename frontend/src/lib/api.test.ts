import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { normalizeMemspecForApi, tryApiThenLocalPower } from './api';
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

  it('is stable when called twice', () => {
    const once = normalizeMemspecForApi(baseMemspec());
    const twice = normalizeMemspecForApi(once);
    expect(twice).toEqual(once);
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
});
