import json
from dataclasses import dataclass
from typing import Any, Dict


# ---------- Data classes ----------

@dataclass
class MemArchitectureSpec:
    width: int
    nbrOfBanks: int
    nbrOfBankGroups: int
    nbrOfRanks: int
    nbrOfColumns: int
    nbrOfRows: int
    burstLength: int
    dataRate: int


@dataclass
class MemPowerSpec:
    notes: str
    vdd: float
    vpp: float
    vddq: float
    idd0: float
    idd2n: float
    idd3n: float
    idd4r: float
    idd4w: float
    idd5b: float
    idd6n: float
    idd2p: float
    idd3p: float
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
    notes: str
    tCK: float
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


# ---------- Parsing helpers ----------

def _parse_mem_arch_spec(d: Dict[str, Any]) -> MemArchitectureSpec:
    return MemArchitectureSpec(
        width=int(d["width"]),
        nbrOfBanks=int(d["nbrOfBanks"]),
        nbrOfBankGroups=int(d["nbrOfBankGroups"]),
        nbrOfRanks=int(d["nbrOfRanks"]),
        nbrOfColumns=int(d["nbrOfColumns"]),
        nbrOfRows=int(d["nbrOfRows"]),
        burstLength=int(d["burstLength"]),
        dataRate=int(d["dataRate"]),
    )


def _parse_mem_power_spec(d: Dict[str, Any]) -> MemPowerSpec:
    return MemPowerSpec(
        notes=str(d.get("notes", "")),
        vdd=float(d["vdd"]),
        vpp=float(d["vpp"]),
        vddq=float(d["vddq"]),
        idd0=float(d["idd0"]),
        idd2n=float(d["idd2n"]),
        idd3n=float(d["idd3n"]),
        idd4r=float(d["idd4r"]),
        idd4w=float(d["idd4w"]),
        idd5b=float(d["idd5b"]),
        idd6n=float(d["idd6n"]),
        idd2p=float(d["idd2p"]),
        idd3p=float(d["idd3p"]),
        ipp0=float(d["ipp0"]),
        ipp2n=float(d["ipp2n"]),
        ipp3n=float(d["ipp3n"]),
        ipp4r=float(d["ipp4r"]),
        ipp4w=float(d["ipp4w"]),
        ipp5b=float(d["ipp5b"]),
        ipp6n=float(d["ipp6n"]),
        ipp2p=float(d["ipp2p"]),
        ipp3p=float(d["ipp3p"]),
    )


def _parse_mem_timing_spec(d: Dict[str, Any]) -> MemTimingSpec:
    return MemTimingSpec(
        notes=str(d.get("notes", "")),
        tCK=float(d["tCK"]),
        RAS=int(d["RAS"]),
        RCD=int(d["RCD"]),
        RP=int(d["RP"]),
        RFC1=int(d["RFC1"]),
        RFC2=int(d["RFC2"]),
        RFCsb=int(d["RFCsb"]),
        REFI=int(d["REFI"]),
    )


def parse_memspec_dict(d: Dict[str, Any]) -> MemSpec:
    """
    Parse a Python dict (already loaded from JSON) into a MemSpec object.
    Expects the outer structure to have key 'memspec' like in your example.
    """
    if "memspec" not in d:
        raise ValueError("Top-level JSON must contain key 'memspec'.")

    ms = d["memspec"]

    return MemSpec(
        memoryId=str(ms["memoryId"]),
        memoryType=str(ms["memoryType"]),
        memarchitecturespec=_parse_mem_arch_spec(ms["memarchitecturespec"]),
        mempowerspec=_parse_mem_power_spec(ms["mempowerspec"]),
        memtimingspec=_parse_mem_timing_spec(ms["memtimingspec"]),
    )


def parse_memspec_json(json_str: str) -> MemSpec:
    """
    Parse a JSON string into a MemSpec object.
    """
    data = json.loads(json_str)
    return parse_memspec_dict(data)
