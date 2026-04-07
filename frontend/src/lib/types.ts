// DDR5 Power Calculator Type Definitions
//
// Core alignment (read-only reference: core/src/parser.py):
// - MemSpec matches nested JSON from load_memspec: memoryId, memoryType, memarchitecturespec,
//   mempowerspec, memtimingspec. API Pydantic models in api/main.py mirror the same shape.
// - Workload matches root JSON from load_workload: BNK_PRE_percent, CKE_LO_PRE_percent,
//   CKE_LO_ACT_percent, PageHit_percent, RDsch_percent, RD_Data_Low_percent, WRsch_percent,
//   WR_Data_Low_percent, termRDsch_percent, termWRsch_percent, System_tRC_ns, tRRDsch_ns.
// - MemPowerSpec IDD/IPP fields are stored in milliamps in this app; the frontend calculator
//   converts to amps where the core model expects electrical current in SI base units.

export interface MemArchitectureSpec {
  width: number;
  nbrOfBanks: number;
  nbrOfBankGroups: number;
  nbrOfRanks: number;
  nbrOfColumns: number;
  nbrOfRows: number;
  /** Number of DRAM devices per subchannel (e.g. 4 for x8 32-bit). Backend/core use this for DIMM and interface models. */
  nbrOfDevices?: number;
  /** Data buffers per subchannel (RDIMM); required by FastAPI; defaults from nbrOfBankGroups when omitted. */
  nbrOfDBs?: number;
  burstLength: number;
  dataRate: number;
}

/** Per-operation currents by rail (SI amperes), LPDDR5/LPDDR5X Micron-style. */
export type IddByRailA = Record<string, Record<string, number>>;

export interface MemPowerSpec {
  // Voltages (DDR5 primary rails)
  vdd: number;
  vpp: number;
  vddq: number;

  // Core IDD currents (mA for DDR5 presets; may be 0 when using idd_by_rail_A)
  idd0: number;
  idd2n: number;
  idd3n: number;
  idd4r: number;
  idd4w: number;
  idd5b: number;
  idd6n: number;
  idd2p: number;
  idd3p: number;

  // VPP IPP currents (mA) — not used for LPDDR5/LPDDR5X
  ipp0: number;
  ipp2n: number;
  ipp3n: number;
  ipp4r: number;
  ipp4w: number;
  ipp5b: number;
  ipp6n: number;
  ipp2p: number;
  ipp3p: number;

  /** LPDDR5/LPDDR5X: optional explicit rail voltages (V); else parser uses rails range midpoints. */
  vdd1?: number;
  vdd2h?: number;
  vdd2l?: number;
  /** LPDDR: JEDEC-style supply range tuples or scalars for parse_memspec_dict. */
  rails?: Record<string, [number, number] | number>;
  /** LPDDR: IDD broken down by rail (amperes in JSON aligned with core). */
  idd_by_rail_A?: IddByRailA;
  idd7?: number;
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
  /** LPDDR5X-style refresh / bank timing (nanoseconds). */
  RFCab_ns?: number;
  RFCpb_ns?: number;
  PBR2PBR_ns?: number;
  PBR2ACT_ns?: number;
}

export interface MemSpec {
  memoryId: string;
  memoryType: string;
  registered: string | boolean;
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
  /** LPDDR5/LPDDR5X core rail totals (when returned by API). */
  P_VDD1?: number;
  P_VDD2H?: number;
  P_VDD2L?: number;
  P_VDDQ?: number;
  P_background?: number;
  P_SELFREF?: number;
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
  /** Preset family for UI filtering (DDR5 vs LPDDR). */
  family?: 'DDR5' | 'LPDDR';
}

export type PowerComponent = 
  | 'standby'
  | 'activate'
  | 'read'
  | 'write'
  | 'refresh'
  | 'vdd'
  | 'vpp';
