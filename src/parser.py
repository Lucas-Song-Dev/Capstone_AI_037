# parser.py

import json
from dataclasses import dataclass
from typing import Any, Dict


# ---------- Data classes ----------

@dataclass
class MemArchitectureSpec:
    """Static DRAM geometry parameters."""
    width: int
    nbrOfBanks: int
    nbrOfBankGroups: int
    nbrOfRanks: int
    nbrOfColumns: int
    nbrOfRows: int
    burstLength: int
    dataRate: 2

@dataclass
class MemPowerSpec:
    """JEDEC-like IDD/IPP currents and supply voltages."""
    # Voltages
    vdd: float
    vpp: float
    vddq: float

    # Core IDD currents (A)
    idd0: float
    idd2n: float
    idd3n: float
    idd4r: float
    idd4w: float
    idd5b: float
    idd6n: float
    idd2p: float
    idd3p: float

    # VPP IPP currents (A)
    ipp0: float
    ipp2n: float
    ipp3n: float
    ipp4r: float
    ipp4w: float
    ipp5b: float
    ipp6n: float
    ipp2p: float
    ipp3p: float


@dataclass
class MemTimingSpec:
    tCK: float        # clock period in seconds
    RAS: int
    RCD: int
    RP: int
    RFC1: int
    RFC2: int
    RFCsb: int
    REFI: int


@dataclass
class MemSpec:
    memoryId: str
    memoryType: str
    memarchitecturespec: MemArchitectureSpec
    mempowerspec: MemPowerSpec
    memtimingspec: MemTimingSpec


''' workload dataclass '''
@dataclass
class Workload:
    BNK_PRE_percent: float
    CKE_LO_PRE_percent: float
    CKE_LO_ACT_percent: float
    PageHit_percent: float
    RDsch_percent: float
    RD_Data_Low_percent: float
    WRsch_percent: float
    WR_Data_Low_percent: float
    termRDsch_percent: float
    termWRsch_percent: float
    System_tRC_ns: float
    tRRDsch_ns: float

# ---------- Memspec parsing ----------

def load_memspec(path: str) -> MemSpec:
    with open(path, "r") as f:
        raw = json.load(f)
    raw = raw["memspec"]
    arch_raw = raw["memarchitecturespec"]
    p_raw = raw["mempowerspec"]
    t_raw = raw["memtimingspec"]

    arch = MemArchitectureSpec(
        width           = int(arch_raw["width"]),
        nbrOfBanks      = int(arch_raw["nbrOfBanks"]),
        nbrOfBankGroups = int(arch_raw["nbrOfBankGroups"]),
        nbrOfRanks      = int(arch_raw["nbrOfRanks"]),
        nbrOfColumns    = int(arch_raw["nbrOfColumns"]),
        nbrOfRows       = int(arch_raw["nbrOfRows"]),
        burstLength     = int(arch_raw["burstLength"]),
        dataRate     = int(arch_raw["dataRate"]),
    )

    power = MemPowerSpec(
        vdd   = float(p_raw["vdd"]),
        vpp   = float(p_raw["vpp"]),
        vddq  = float(p_raw["vddq"]),

        idd0  = float(p_raw["idd0"]),
        idd2n = float(p_raw["idd2n"]),
        idd3n = float(p_raw["idd3n"]),
        idd4r = float(p_raw["idd4r"]),
        idd4w = float(p_raw["idd4w"]),
        idd5b = float(p_raw["idd5b"]),
        idd6n = float(p_raw["idd6n"]),
        idd2p = float(p_raw["idd2p"]),
        idd3p = float(p_raw["idd3p"]),

        ipp0  = float(p_raw["ipp0"]),
        ipp2n = float(p_raw["ipp2n"]),
        ipp3n = float(p_raw["ipp3n"]),
        ipp4r = float(p_raw["ipp4r"]),
        ipp4w = float(p_raw["ipp4w"]),
        ipp5b = float(p_raw["ipp5b"]),
        ipp6n = float(p_raw["ipp6n"]),
        ipp2p = float(p_raw["ipp2p"]),
        ipp3p = float(p_raw["ipp3p"]),
    )

    timing = MemTimingSpec(
        tCK  = float(t_raw["tCK"]),
        RAS  = int(t_raw["RAS"]),
        RCD  = int(t_raw["RCD"]),
        RP   = int(t_raw["RP"]),
        RFC1 = int(t_raw["RFC1"]),
        RFC2 = int(t_raw["RFC2"]),
        RFCsb = int(t_raw["RFCsb"]),
        REFI = int(t_raw["REFI"]),
    )

    return MemSpec(
        memoryId           = str(raw.get("memoryId", "")),
        memoryType         = str(raw.get("memoryType", "")),
        memarchitecturespec = arch,
        mempowerspec        = power,
        memtimingspec       = timing,
    )


# Workload parsing #
def load_workload(path: str) -> Workload:
    with open(path, "r") as f:
        raw = json.load(f)

    return Workload(
        BNK_PRE_percent     = float(raw["BNK_PRE_percent"]),
        CKE_LO_PRE_percent  = float(raw["CKE_LO_PRE_percent"]),
        CKE_LO_ACT_percent  = float(raw["CKE_LO_ACT_percent"]),

        PageHit_percent     = float(raw["PageHit_percent"]),

        RDsch_percent       = float(raw["RDsch_percent"]),
        RD_Data_Low_percent = float(raw["RD_Data_Low_percent"]),

        WRsch_percent       = float(raw["WRsch_percent"]),
        WR_Data_Low_percent = float(raw["WR_Data_Low_percent"]),

        termRDsch_percent   = float(raw["termRDsch_percent"]),
        termWRsch_percent   = float(raw["termWRsch_percent"]),

        System_tRC_ns       = float(raw["System_tRC_ns"]),
        tRRDsch_ns          = float(raw["tRRDsch_ns"]),
    )
    """
    JEDEC/Micron-style DRAM power parameters.

    Voltages:
      vdd      DRAM core supply (array logic + sense amps).
      vpp      Wordline pump voltage used for ACT and REF operations.
      vddq     I/O supply for DQ/DQS bus.

    Core IDD currents:
      idd0     Current during a full ACT → ACTIVE → PRE row cycle.
      idd2n    Precharged standby current (CKE HIGH).
      idd3n    Active standby current (one or more banks active).
      idd4r    Current during read bursts (core internal read activation).
      idd4w    Current during write bursts.
      idd5b    Refresh current (per-bank refresh).
      idd6n    Self-refresh current (CKE LOW, autonomous refresh).
      idd2p    Precharged power-down current (CKE LOW).
      idd3p    Active power-down current (CKE LOW).

    VPP IPP currents:
      ipp0     VPP current during ACTIVATE (wordline driver energy).
      ipp2n    Precharged VPP standby current.
      ipp3n    Active VPP standby current.
      ipp4r    Additional VPP current during reads.
      ipp4w    Additional VPP current during writes.
      ipp5b    VPP current during refresh (wordline energization).
      ipp6n    Self-refresh VPP current.
      ipp2p    Precharged power-down VPP current.
      ipp3p    Active power-down VPP current.
    """
