import type { MemSpec, Workload, PowerResult, DIMMPowerResult } from './types';

/**
 * DDR5 Core Power Calculator
 * Ported from Python implementation
 */
export function computeCorePower(memspec: MemSpec, workload: Workload): PowerResult {
  const p = memspec.mempowerspec;
  const t = memspec.memtimingspec;

  // Voltages
  const vdd = p.vdd;
  const vpp = p.vpp;

  // Basic timing in seconds
  const tCK = t.tCK;
  const tRAS = t.RAS * tCK;
  const tRP = t.RP * tCK;
  const tRFC1_s = t.RFC1 * tCK;
  const tREFI_s = t.REFI * tCK;

  // Convert workload percentages to fractions (0–1)
  const BNK_PRE_frac = workload.BNK_PRE_percent / 100.0;
  const CKE_LO_PRE_frac = workload.CKE_LO_PRE_percent / 100.0;
  const CKE_LO_ACT_frac = workload.CKE_LO_ACT_percent / 100.0;
  const RD_frac = workload.RDsch_percent / 100.0;
  const WR_frac = workload.WRsch_percent / 100.0;

  // Convert mA to A for calculations
  const toAmps = (ma: number) => ma / 1000;

  // --------------------------------------------------------------------
  // 1) Background (standby) power (VDD)
  // --------------------------------------------------------------------
  // Precharged background: blend IDD2N and IDD2P based on CKE low
  const I_PRE_bg = (1.0 - CKE_LO_PRE_frac) * toAmps(p.idd2n) + CKE_LO_PRE_frac * toAmps(p.idd2p);
  const P_PRE_STBY_core = vdd * I_PRE_bg;

  // Active background: blend IDD3N and IDD3P based on CKE low
  const I_ACT_bg = (1.0 - CKE_LO_ACT_frac) * toAmps(p.idd3n) + CKE_LO_ACT_frac * toAmps(p.idd3p);
  const P_ACT_STBY_core = vdd * I_ACT_bg;

  // Mix precharged vs active background based on BNK_PRE fraction
  const P_background_vdd = BNK_PRE_frac * P_PRE_STBY_core + (1.0 - BNK_PRE_frac) * P_ACT_STBY_core;

  // --------------------------------------------------------------------
  // 2) Refresh power (VDD + VPP)
  // --------------------------------------------------------------------
  // Calculate fraction time required for one refresh / how often cells must be refreshed
  const duty_ref = tRFC1_s / tREFI_s;

  // Incremental over active standby for refresh
  const P_REF_vdd = vdd * (toAmps(p.idd5b) - toAmps(p.idd3n)) * duty_ref;
  const P_REF_vpp = vpp * (toAmps(p.ipp5b) - toAmps(p.ipp3n)) * duty_ref;
  const P_REF_core = P_REF_vdd + P_REF_vpp;

  // --------------------------------------------------------------------
  // 3) Read / Write incremental power (VDD)
  // --------------------------------------------------------------------
  const duty_rd = RD_frac;
  const duty_wr = WR_frac;

  const P_RD_core = vdd * (toAmps(p.idd4r) - toAmps(p.idd3n)) * duty_rd;
  const P_WR_core = vdd * (toAmps(p.idd4w) - toAmps(p.idd3n)) * duty_wr;

  // --------------------------------------------------------------------
  // 4) Activate / Precharge incremental power
  // --------------------------------------------------------------------
  const tRRDsch_s = workload.tRRDsch_ns * 1e-9;

  // Row cycle window
  const t_row_cycle = tRAS + tRP;

  // Fraction of time spent in ACT+PRE windows (for VDD)
  const duty_act_pre = Math.min(1.0, t_row_cycle / tRRDsch_s);

  // Fraction of time spent actually raising wordlines (for VPP)
  const duty_act_vpp = Math.min(1.0, tRAS / tRRDsch_s);

  // Incremental ACT+PRE current over active standby (VDD)
  const P_ACT_PRE_vdd = vdd * (toAmps(p.idd0) - toAmps(p.idd2n)) * duty_act_pre;

  // Incremental ACT VPP power over active standby
  const P_ACT_vpp = vpp * (toAmps(p.ipp0) - toAmps(p.ipp2n)) * duty_act_vpp;

  // Total ACT/PRE core power
  const P_ACT_PRE_core = P_ACT_PRE_vdd + P_ACT_vpp;

  // --------------------------------------------------------------------
  // 5) Aggregate VDD, VPP and total core power
  // --------------------------------------------------------------------
  const P_VDD_core = P_background_vdd + P_RD_core + P_WR_core + P_REF_vdd + P_ACT_PRE_vdd;
  const P_VPP_core = P_REF_vpp + P_ACT_vpp;
  const P_total_core = P_VDD_core + P_VPP_core;

  return {
    P_PRE_STBY_core,
    P_ACT_STBY_core,
    P_ACT_PRE_core,
    P_RD_core,
    P_WR_core,
    P_REF_core,
    P_VDD_core,
    P_VPP_core,
    P_total_core,
  };
}

/**
 * Format power value for display
 */
export function formatPower(watts: number, precision: number = 4): string {
  if (watts >= 1) {
    return `${watts.toFixed(precision)} W`;
  } else {
    return `${(watts * 1000).toFixed(precision - 1)} mW`;
  }
}

/**
 * Calculate memory capacity in GB
 */
export function calculateCapacity(arch: MemSpec['memarchitecturespec']): number {
  const bits = arch.width * arch.nbrOfBanks * arch.nbrOfColumns * arch.nbrOfRows * arch.nbrOfRanks;
  const bytes = bits / 8;
  const gb = bytes / (1024 * 1024 * 1024);
  return gb;
}

/**
 * Calculate effective data rate (MT/s)
 */
export function calculateDataRate(timing: MemSpec['memtimingspec']): number {
  const freqHz = 1 / timing.tCK;
  const dataRate = (freqHz / 1e6) * 2; // DDR = double data rate
  return Math.round(dataRate);
}

/**
 * Calculate number of chips per DIMM based on capacity and chip density
 * Based on JEDEC DDR5 standard configurations
 */
export function calculateChipsPerDIMM(arch: MemSpec['memarchitecturespec'], capacityGB?: number): number {
  // Calculate chip capacity in Gb
  const chipCapacityGb = (arch.width * arch.nbrOfBanks * arch.nbrOfColumns * arch.nbrOfRows) / (1024 * 1024 * 1024 / 8);
  
  // If capacity is provided, use it; otherwise calculate from architecture
  const dimmCapacityGb = capacityGB ? capacityGB * 8 : chipCapacityGb * arch.nbrOfRanks;
  
  // Standard DDR5 chip densities: 16Gb, 24Gb, 32Gb
  // For x8 width, typical configurations:
  // - 16GB DIMM: 8 chips × 16Gb = 128Gb = 16GB
  // - 32GB DIMM: 16 chips × 16Gb = 256Gb = 32GB OR 8 chips × 32Gb = 256Gb = 32GB
  
  if (dimmCapacityGb <= 128) {
    // 16GB or less: typically 8 chips
    return 8;
  } else if (dimmCapacityGb <= 256) {
    // 32GB: typically 16 chips (16Gb each) or 8 chips (32Gb each)
    // For x8 width, more common is 16 chips
    return arch.width === 8 ? 16 : 8;
  } else {
    // 64GB+: scale accordingly
    return Math.ceil(dimmCapacityGb / 16);
  }
}

/**
 * Calculate total DIMM power including all components
 * Based on JEDEC DDR5 specifications and industry standards
 */
export function computeDIMMPower(
  corePower: PowerResult,
  memspec: MemSpec,
  options: {
    isRDIMM?: boolean;
    interfacePowerPercent?: number;
    pmicOverheadPercent?: number;
    rcdPower?: number;
  } = {}
): DIMMPowerResult {
  const {
    isRDIMM = false,
    interfacePowerPercent = 12, // Typical 10-15% for VDDQ IO power
    pmicOverheadPercent = 4,    // Typical 3-5% PMIC efficiency loss
    rcdPower = 0.075,            // ~75mW for RCD in RDIMMs
  } = options;

  // Calculate chips per DIMM
  const chipsPerDIMM = calculateChipsPerDIMM(memspec.memarchitecturespec);
  
  // Core power for entire DIMM (all chips)
  const P_core_DIMM = corePower.P_total_core * chipsPerDIMM;
  
  // Interface/IO power (VDDQ power for data lines)
  // Based on JEDEC specs, interface power scales with activity
  const interfaceActivityFactor = (corePower.P_RD_core + corePower.P_WR_core) / corePower.P_total_core || 0.5;
  const P_interface_DIMM = P_core_DIMM * (interfacePowerPercent / 100) * (0.5 + interfaceActivityFactor);
  
  // PMIC overhead (power management IC efficiency loss)
  const P_overhead_DIMM = P_core_DIMM * (pmicOverheadPercent / 100);
  
  // RCD power (Register Clock Driver) for RDIMMs only
  const P_rcd_DIMM = isRDIMM ? rcdPower : 0;
  
  // Total DIMM power
  const P_total_DIMM = P_core_DIMM + P_interface_DIMM + P_overhead_DIMM + P_rcd_DIMM;
  
  return {
    corePower,
    chipsPerDIMM,
    corePowerTotal: P_core_DIMM,
    interfacePower: P_interface_DIMM,
    pmicOverhead: P_overhead_DIMM,
    rcdPower: isRDIMM ? P_rcd_DIMM : undefined,
    P_total_DIMM,
    P_core_DIMM,
    P_interface_DIMM,
    P_overhead_DIMM: P_overhead_DIMM + P_rcd_DIMM,
  };
}
