import { describe, it, expect } from 'vitest';
import { computeCorePower, computeDIMMPower, formatPower, calculateChipsPerDIMM } from './ddr5Calculator';
import type { MemSpec, Workload } from './types';

const mockMemspec: MemSpec = {
  memoryId: 'test_ddr5',
  memoryType: 'DDR5',
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

describe('ddr5Calculator', () => {
  describe('computeCorePower', () => {
    it('should calculate core power correctly', () => {
      const result = computeCorePower(mockMemspec, mockWorkload);

      expect(result).toHaveProperty('P_total_core');
      expect(result).toHaveProperty('P_VDD_core');
      expect(result).toHaveProperty('P_VPP_core');
      expect(result).toHaveProperty('P_PRE_STBY_core');
      expect(result).toHaveProperty('P_ACT_STBY_core');
      expect(result).toHaveProperty('P_RD_core');
      expect(result).toHaveProperty('P_WR_core');
      expect(result).toHaveProperty('P_REF_core');
      expect(result).toHaveProperty('P_ACT_PRE_core');

      // All power values should be non-negative
      expect(result.P_total_core).toBeGreaterThanOrEqual(0);
      expect(result.P_VDD_core).toBeGreaterThanOrEqual(0);
      expect(result.P_VPP_core).toBeGreaterThanOrEqual(0);
    });

    it('should calculate total core power as sum of VDD and VPP', () => {
      const result = computeCorePower(mockMemspec, mockWorkload);
      const calculatedTotal = result.P_VDD_core + result.P_VPP_core;
      
      expect(Math.abs(result.P_total_core - calculatedTotal)).toBeLessThan(0.0001);
    });

    it('should handle different workload configurations', () => {
      const readHeavyWorkload: Workload = {
        ...mockWorkload,
        RDsch_percent: 40.0,
        WRsch_percent: 10.0,
      };

      const writeHeavyWorkload: Workload = {
        ...mockWorkload,
        RDsch_percent: 10.0,
        WRsch_percent: 40.0,
      };

      const readResult = computeCorePower(mockMemspec, readHeavyWorkload);
      const writeResult = computeCorePower(mockMemspec, writeHeavyWorkload);

      expect(readResult.P_RD_core).toBeGreaterThan(writeResult.P_RD_core);
      expect(writeResult.P_WR_core).toBeGreaterThan(readResult.P_WR_core);
    });
  });

  describe('calculateChipsPerDIMM', () => {
    it('should calculate 8 chips for 16GB DIMM', () => {
      const arch = {
        ...mockMemspec.memarchitecturespec,
        nbrOfBanks: 16,
        nbrOfBankGroups: 8,
      };
      const chips = calculateChipsPerDIMM(arch, 16);
      expect(chips).toBe(8);
    });

    it('should calculate 16 chips for 32GB DIMM', () => {
      const arch = {
        ...mockMemspec.memarchitecturespec,
        nbrOfBanks: 32,
        nbrOfBankGroups: 8,
      };
      const chips = calculateChipsPerDIMM(arch, 32);
      expect(chips).toBe(16);
    });
  });

  describe('computeDIMMPower', () => {
    it('should calculate DIMM power including overhead', () => {
      const corePower = computeCorePower(mockMemspec, mockWorkload);
      const dimmPower = computeDIMMPower(corePower, mockMemspec);

      expect(dimmPower).toHaveProperty('P_total_DIMM');
      expect(dimmPower).toHaveProperty('P_core_DIMM');
      expect(dimmPower).toHaveProperty('P_interface_DIMM');
      expect(dimmPower).toHaveProperty('P_overhead_DIMM');
      expect(dimmPower).toHaveProperty('chipsPerDIMM');

      // DIMM power should be greater than core power (due to overhead)
      expect(dimmPower.P_total_DIMM).toBeGreaterThan(dimmPower.P_core_DIMM);
    });

    it('should calculate correct number of chips', () => {
      const corePower = computeCorePower(mockMemspec, mockWorkload);
      const dimmPower = computeDIMMPower(corePower, mockMemspec);

      expect(dimmPower.chipsPerDIMM).toBeGreaterThan(0);
      expect(dimmPower.P_core_DIMM).toBeCloseTo(
        corePower.P_total_core * dimmPower.chipsPerDIMM,
        3
      );
    });

    it('should include interface and overhead power', () => {
      const corePower = computeCorePower(mockMemspec, mockWorkload);
      const dimmPower = computeDIMMPower(corePower, mockMemspec);

      const expectedTotal = 
        dimmPower.P_core_DIMM + 
        dimmPower.P_interface_DIMM + 
        dimmPower.P_overhead_DIMM;

      expect(Math.abs(dimmPower.P_total_DIMM - expectedTotal)).toBeLessThan(0.001);
    });
  });

  describe('formatPower', () => {
    it('should format watts correctly', () => {
      expect(formatPower(1.5)).toBe('1.5000 W');
      expect(formatPower(0.5)).toBe('500.000 mW'); // precision-1 = 3 decimal places
    });

    it('should format milliwatts correctly', () => {
      expect(formatPower(0.001)).toBe('1.000 mW'); // precision-1 = 3 decimal places
      expect(formatPower(0.699)).toBe('699.000 mW');
    });
  });
});

