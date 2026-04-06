import { describe, it, expect } from 'vitest';
import { registeredToBoolean, computePowerLocal } from './powerCompute';
import type { MemSpec, Workload } from './types';

const baseArch = {
  width: 8,
  nbrOfBanks: 16,
  nbrOfBankGroups: 8,
  nbrOfRanks: 1,
  nbrOfColumns: 1024,
  nbrOfRows: 65536,
  burstLength: 16,
  dataRate: 2,
};

const baseMemspec = (over: Partial<MemSpec> = {}): MemSpec => ({
  memoryId: 't',
  memoryType: 'DDR5',
  registered: false,
  memarchitecturespec: { ...baseArch },
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
  ...over,
});

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

describe('registeredToBoolean', () => {
  it('maps booleans', () => {
    expect(registeredToBoolean(true)).toBe(true);
    expect(registeredToBoolean(false)).toBe(false);
  });

  it('maps common string forms to true', () => {
    expect(registeredToBoolean('true')).toBe(true);
    expect(registeredToBoolean('TRUE')).toBe(true);
    expect(registeredToBoolean('1')).toBe(true);
    expect(registeredToBoolean('yes')).toBe(true);
  });

  it('maps falsey strings to false', () => {
    expect(registeredToBoolean('false')).toBe(false);
    expect(registeredToBoolean('')).toBe(false);
    expect(registeredToBoolean('no')).toBe(false);
  });
});

describe('computePowerLocal', () => {
  it('returns core and DIMM results', () => {
    const { powerResult, dimmPowerResult } = computePowerLocal(baseMemspec(), workload);
    expect(powerResult.P_total_core).toBeGreaterThan(0);
    expect(dimmPowerResult.P_total_DIMM).toBeGreaterThan(0);
    expect(dimmPowerResult.corePower).toBe(powerResult);
  });

  it('sets RCD-related path when registered string is true', () => {
    const { dimmPowerResult } = computePowerLocal(
      baseMemspec({ registered: 'true' }),
      workload
    );
    expect(dimmPowerResult.rcdPower).toBeDefined();
  });
});
