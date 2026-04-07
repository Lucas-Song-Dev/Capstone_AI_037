# parser.py

import json
from dataclasses import dataclass, field
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
    nbrOfDevices: int
    nbrOfDBs: int
    burstLength: int
    dataRate: int


# Field reference:
# - width: Per-device I/O width in bits (e.g., x4/x8/x16). Total bus width per subchannel = nbrOfDevices * width.
# - nbrOfBanks: Number of banks per bank group
# - nbrOfBankGroups: Number of bank groups.
# - nbrOfRanks: Number of ranks on the channel (ranks share the same DQ bus via chip-select).
# - nbrOfColumns: Number of column addresses per row
# - nbrOfRows: Number of row addresses per bank.
# - nbrOfDevices: Number of DRAM devices that make up the data bus for one subchannel (not per-rank).
# - burstLength: Number of data beats per burst (BL).
# - dataRate: Transfers per clock.

@dataclass
class MemPowerSpec:
    """JEDEC-like IDD/IPP currents and supply voltages."""
    memoryType: str = "DDR5"  # "DDR5", "LPDDR5", or "LPDDR5X"
    
    # Voltages (DDR5: vdd/vpp/vddq, LPDDR5: vdd1/vdd2h/vdd2l/vddq)
    vdd: float = 0.0
    vpp: float = 0.0
    vdd1: float = 0.0
    vdd2h: float = 0.0
    vdd2l: float = 0.0
    vddq: float = 0.0

    # Core IDD currents (A)
    idd0: float = 0.0
    idd2n: float = 0.0
    idd2p: float = 0.0
    idd3n: float = 0.0
    idd3p: float = 0.0
    idd4r: float = 0.0
    idd4w: float = 0.0
    idd5b: float = 0.0
    idd6n: float = 0.0
    idd7: float = 0.0

    # VPP IPP currents (A) - for DDR5 only
    ipp0: float = 0.0
    ipp2n: float = 0.0
    ipp2p: float = 0.0
    ipp3n: float = 0.0
    ipp3p: float = 0.0
    ipp4r: float = 0.0
    ipp4w: float = 0.0
    ipp5b: float = 0.0
    ipp6n: float = 0.0

    # Optional LPDDR5/LPDDR5X schema fields
    rails: Dict[str, Any] = field(default_factory=dict)
    idd_by_rail_A: Dict[str, Dict[str, float]] = field(default_factory=dict)


@dataclass
class MemTimingSpec:
    tCK: float = 0.0        # clock period in seconds
    RAS: int = 0
    RCD: int = 0
    RP: int = 0
    RFC1: int = 0
    RFC2: int = 0
    RFCsb: int = 0
    REFI: int = 0

    # Optional LPDDR5/LPDDR5X timing fields in ns
    RFCab_ns: float = 0.0
    RFCpb_ns: float = 0.0
    PBR2PBR_ns: float = 0.0
    PBR2ACT_ns: float = 0.0


@dataclass
class MemSpec:
    memoryId: str
    memoryType: str
    registered: bool
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


def _coerce_registered(val: Any) -> bool:
    """Coerce JSON/API registered field to bool (handles 'false' string)."""
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.strip().lower() in ("true", "1", "yes")
    return bool(val)


def parse_memspec_dict(raw: Dict[str, Any]) -> MemSpec:
    """
    Parse a memspec object dict (same shape as the JSON `memspec` value, not the file wrapper).

    Used by load_memspec and by the HTTP API for DDR5 / LPDDR5 / LPDDR5X.
    """
    if "memarchitecturespec" not in raw:
        raise ValueError("Missing required section 'memarchitecturespec' in memspec")
    if "mempowerspec" not in raw:
        raise ValueError("Missing required section 'mempowerspec' in memspec")
    if "memtimingspec" not in raw:
        raise ValueError("Missing required section 'memtimingspec' in memspec")

    register = _coerce_registered(raw.get("registered", False))
    
    arch_raw = raw["memarchitecturespec"]
    p_raw = raw["mempowerspec"]
    t_raw = raw["memtimingspec"]

    # Parse architecture with error handling
    try:
        arch = MemArchitectureSpec(
            width           = int(arch_raw["width"]),
            nbrOfBanks      = int(arch_raw["nbrOfBanks"]),
            nbrOfBankGroups = int(arch_raw["nbrOfBankGroups"]),
            nbrOfRanks      = int(arch_raw["nbrOfRanks"]),
            nbrOfColumns    = int(arch_raw["nbrOfColumns"]),
            nbrOfRows       = int(arch_raw["nbrOfRows"]),
            nbrOfDevices       = int(arch_raw["nbrOfDevices"]),
            nbrOfDBs        = int(arch_raw["nbrOfDBs"]),
            burstLength     = int(arch_raw["burstLength"]),
            dataRate        = int(arch_raw["dataRate"]),
        )
    except KeyError as e:
        raise ValueError(f"Missing required field {e} in memarchitecturespec")
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid value in memarchitecturespec: {e}")

    # Parse power spec with detailed error handling - support DDR5/LPDDR5/LPDDR5X
    memory_type = str(raw.get("memoryType", p_raw.get("memoryType", "DDR5"))).upper()

    def _mean_range(val: Any, default: float = 0.0) -> float:
        if isinstance(val, (list, tuple)) and len(val) == 2:
            return (float(val[0]) + float(val[1])) / 2.0
        try:
            return float(val)
        except (TypeError, ValueError):
            return default

    def _sum_rails(op_key: str) -> float:
        by_rail = p_raw.get("idd_by_rail_A", {}).get(op_key, {})
        if not isinstance(by_rail, dict):
            return 0.0
        return float(sum(float(v) for v in by_rail.values() if isinstance(v, (int, float))))
    
    try:
        if memory_type in ("LPDDR5", "LPDDR5X"):
            # LPDDR5/LPDDR5X: 4 voltage rails (VDD1, VDD2H, VDD2L, VDDQ)
            rails = p_raw.get("rails", {}) if isinstance(p_raw.get("rails", {}), dict) else {}

            # Prefer explicit scalar voltages, fallback to range midpoint
            vdd1 = float(p_raw.get("vdd1", _mean_range(rails.get("vdd1_range_V"), 0.0)))
            vdd2h = float(p_raw.get("vdd2h", _mean_range(rails.get("vdd2h_range_V"), 0.0)))
            vdd2l = float(p_raw.get("vdd2l", _mean_range(rails.get("vdd2l_range_V"), 0.0)))
            vddq = float(p_raw.get("vddq", _mean_range(rails.get("vddq_range_V"), 0.0)))

            # Support both scalar IDD fields and idd_by_rail_A nested fields
            power = MemPowerSpec(
                memoryType=memory_type,
                vdd1=vdd1,
                vdd2h=vdd2h,
                vdd2l=vdd2l,
                vddq=vddq,

                idd0=float(p_raw.get("idd0", _sum_rails("idd0"))),
                idd2n=float(p_raw.get("idd2n", _sum_rails("idd2n"))),
                idd2p=float(p_raw.get("idd2p", _sum_rails("idd2p"))),
                idd3n=float(p_raw.get("idd3n", _sum_rails("idd3n"))),
                idd3p=float(p_raw.get("idd3p", _sum_rails("idd3p"))),
                idd4r=float(p_raw.get("idd4r", _sum_rails("idd4r"))),
                idd4w=float(p_raw.get("idd4w", _sum_rails("idd4w"))),
                idd5b=float(p_raw.get("idd5b", _sum_rails("idd5b_allbank") or _sum_rails("idd5pb_perbank"))),
                idd6n=float(p_raw.get("idd6n", _sum_rails("idd6n"))),
                idd7=float(p_raw.get("idd7", _sum_rails("idd7"))),

                rails=rails,
                idd_by_rail_A=p_raw.get("idd_by_rail_A", {}) if isinstance(p_raw.get("idd_by_rail_A", {}), dict) else {},
            )
        else:  # DDR5
            # DDR5: 3 voltage rails (VDD, VPP, VDDQ)
            required_ddr5_fields = [
                "vdd", "vpp", "vddq",
                "idd0", "idd2n", "idd3n", "idd4r", "idd4w", "idd5b", "idd6n", "idd2p", "idd3p",
                "ipp0", "ipp2n", "ipp3n", "ipp4r", "ipp4w", "ipp5b", "ipp6n", "ipp2p", "ipp3p"
            ]
            
            missing_fields = [field for field in required_ddr5_fields if field not in p_raw]
            if missing_fields:
                raise ValueError(f"Missing required power spec field(s): {', '.join(missing_fields)}")
            
            power = MemPowerSpec(
                memoryType=memory_type,
                vdd   = float(p_raw["vdd"]),
                vpp   = float(p_raw["vpp"]),
                vddq  = float(p_raw["vddq"]),

                idd0  = float(p_raw["idd0"]),
                idd2n = float(p_raw["idd2n"]),
                idd2p = float(p_raw["idd2p"]),
                idd3n = float(p_raw["idd3n"]),
                idd3p = float(p_raw["idd3p"]),
                idd4r = float(p_raw["idd4r"]),
                idd4w = float(p_raw["idd4w"]),
                idd5b = float(p_raw["idd5b"]),
                idd6n = float(p_raw["idd6n"]),

                ipp0  = float(p_raw["ipp0"]),
                ipp2n = float(p_raw["ipp2n"]),
                ipp2p = float(p_raw["ipp2p"]),
                ipp3n = float(p_raw["ipp3n"]),
                ipp3p = float(p_raw["ipp3p"]),
                ipp4r = float(p_raw["ipp4r"]),
                ipp4w = float(p_raw["ipp4w"]),
                ipp5b = float(p_raw["ipp5b"]),
                ipp6n = float(p_raw["ipp6n"]),
            )
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid value in mempowerspec: {e}")

    # Parse timing with error handling
    try:
        # LPDDR5X files may not provide cycle-based timing. Keep compatibility with defaults.
        tck = float(t_raw.get("tCK", 0.0))
        rfc1_cycles = int(t_raw.get("RFC1", 0))
        if rfc1_cycles == 0 and tck > 0.0 and "RFCab_ns" in t_raw:
            rfc1_cycles = int(round((float(t_raw["RFCab_ns"]) * 1e-9) / tck))

        timing = MemTimingSpec(
            tCK=tck,
            RAS=int(t_raw.get("RAS", 0)),
            RCD=int(t_raw.get("RCD", 0)),
            RP=int(t_raw.get("RP", 0)),
            RFC1=rfc1_cycles,
            RFC2=int(t_raw.get("RFC2", 0)),
            RFCsb=int(t_raw.get("RFCsb", 0)),
            REFI=int(t_raw.get("REFI", 0)),

            RFCab_ns=float(t_raw.get("RFCab_ns", 0.0)),
            RFCpb_ns=float(t_raw.get("RFCpb_ns", 0.0)),
            PBR2PBR_ns=float(t_raw.get("PBR2PBR_ns", 0.0)),
            PBR2ACT_ns=float(t_raw.get("PBR2ACT_ns", 0.0)),
        )
    except KeyError as e:
        raise ValueError(f"Missing required field {e} in memtimingspec")
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid value in memtimingspec: {e}")

    return MemSpec(
        memoryId           = str(raw.get("memoryId", "")),
        memoryType         = memory_type,
        registered          = register,
        memarchitecturespec = arch,
        mempowerspec        = power,
        memtimingspec       = timing,
    )


def load_memspec(path: str) -> MemSpec:
    """
    Load memory specification from JSON file with validation.

    Expects top-level key ``memspec`` wrapping the object passed to :func:`parse_memspec_dict`.
    """
    try:
        with open(path, "r") as f:
            raw = json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Memory specification file not found: {path}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in memory specification file: {e}")

    if "memspec" not in raw:
        raise ValueError("Missing required field 'memspec' in JSON file")

    return parse_memspec_dict(raw["memspec"])


# Workload parsing #
def load_workload(path: str) -> Workload:
    """
    Load workload specification from JSON file with validation.
    
    Raises:
        ValueError: If required fields are missing or have invalid values
        FileNotFoundError: If the workload file doesn't exist
    """
    try:
        with open(path, "r") as f:
            raw = json.load(f)
    except FileNotFoundError:
        raise FileNotFoundError(f"Workload file not found: {path}")
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in workload file: {e}")
    
    # Validate required fields
    required_fields = [
        "BNK_PRE_percent", "CKE_LO_PRE_percent", "CKE_LO_ACT_percent",
        "PageHit_percent", "RDsch_percent", "RD_Data_Low_percent",
        "WRsch_percent", "WR_Data_Low_percent", "termRDsch_percent",
        "termWRsch_percent", "System_tRC_ns", "tRRDsch_ns"
    ]
    
    missing_fields = [field for field in required_fields if field not in raw]
    if missing_fields:
        raise ValueError(f"Missing required workload field(s): {', '.join(missing_fields)}")
    
    try:
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
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid value in workload specification: {e}")
