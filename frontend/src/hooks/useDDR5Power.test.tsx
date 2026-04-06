import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDDR5Power } from './useDDR5Power';
import type { MemSpec, Workload } from '@/lib/types';

const memspec: MemSpec = {
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

describe('useDDR5Power', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://127.0.0.1:9');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('keeps power results when API fails (fallback)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: 'bad' }),
    });

    const { result } = renderHook(() => useDDR5Power(memspec, workload, { debounceMs: 0 }));

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.powerResult?.P_total_core).toBeGreaterThan(0);
    expect(result.current.dimmPowerResult?.P_total_DIMM).toBeGreaterThan(0);
  });

  it('computes locally when API is disabled', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', '');

    const { result } = renderHook(() => useDDR5Power(memspec, workload, { debounceMs: 0 }));

    await waitFor(() => {
      expect(result.current.isCalculating).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.powerResult?.P_total_core).toBeGreaterThan(0);
  });
});
