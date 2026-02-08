// DDR5 Power Calculator Type Definitions

export interface MemArchitectureSpec {
  width: number;
  nbrOfBanks: number;
  nbrOfBankGroups: number;
  nbrOfRanks: number;
  nbrOfColumns: number;
  nbrOfRows: number;
  burstLength: number;
  dataRate: number;
}

export interface MemPowerSpec {
  // Voltages
  vdd: number;
  vpp: number;
  vddq: number;

  // Core IDD currents (mA)
  idd0: number;
  idd2n: number;
  idd3n: number;
  idd4r: number;
  idd4w: number;
  idd5b: number;
  idd6n: number;
  idd2p: number;
  idd3p: number;

  // VPP IPP currents (mA)
  ipp0: number;
  ipp2n: number;
  ipp3n: number;
  ipp4r: number;
  ipp4w: number;
  ipp5b: number;
  ipp6n: number;
  ipp2p: number;
  ipp3p: number;
}

export interface MemTimingSpec {
  tCK: number;    // clock period in seconds
  RAS: number;
  RCD: number;
  RP: number;
  RFC1: number;
  RFC2: number;
  RFCsb: number;
  REFI: number;
}

export interface MemSpec {
  memoryId: string;
  memoryType: string;
  memarchitecturespec: MemArchitectureSpec;
  mempowerspec: MemPowerSpec;
  memtimingspec: MemTimingSpec;
}

export interface Workload {
  BNK_PRE_percent: number;
  CKE_LO_PRE_percent: number;
  CKE_LO_ACT_percent: number;
  PageHit_percent: number;
  RDsch_percent: number;
  RD_Data_Low_percent: number;
  WRsch_percent: number;
  WR_Data_Low_percent: number;
  termRDsch_percent: number;
  termWRsch_percent: number;
  System_tRC_ns: number;
  tRRDsch_ns: number;
}

export interface PowerResult {
  P_PRE_STBY_core: number;
  P_ACT_STBY_core: number;
  P_ACT_PRE_core: number;
  P_RD_core: number;
  P_WR_core: number;
  P_REF_core: number;
  P_VDD_core: number;
  P_VPP_core: number;
  P_total_core: number;
}

export interface DIMMPowerResult {
  // Core power components (per chip)
  corePower: PowerResult;
  
  // DIMM-level calculations
  chipsPerDIMM: number;
  corePowerTotal: number;  // Core power × chips
  interfacePower: number;  // VDDQ IO power (~10-15% of core)
  pmicOverhead: number;   // PMIC efficiency loss (~3-5%)
  rcdPower?: number;       // RCD power for RDIMMs (~50-100mW)
  
  // Total DIMM power
  P_total_DIMM: number;
  
  // Breakdown by component
  P_core_DIMM: number;
  P_interface_DIMM: number;
  P_overhead_DIMM: number;
}

export interface MemoryPreset {
  id: string;
  name: string;
  manufacturer: string;
  speed: string;
  capacity: string;
  memspec: MemSpec;
}

export type PowerComponent = 
  | 'standby'
  | 'activate'
  | 'read'
  | 'write'
  | 'refresh'
  | 'vdd'
  | 'vpp';
