"""
Build JSON bodies for FastAPI calculate routes.

PR CI runs against a merge with ``main``, where ``MemSpecModel`` includes ``registered`` (str) and
``MemArchitectureSpecModel`` includes ``nbrOfDBs``. This module supplies those fields while staying
compatible with the feature branch when attributes are missing (defaults).
"""


def memspec_obj_to_api_dict(memspec) -> dict:
    arch = memspec.memarchitecturespec
    p = memspec.mempowerspec
    t = memspec.memtimingspec
    nbr_dbs = getattr(arch, "nbrOfDBs", None)
    if nbr_dbs is None:
        nbr_dbs = getattr(arch, "nbrOfBankGroups", 8)
    reg = getattr(memspec, "registered", False)
    if isinstance(reg, bool):
        reg_s = "true" if reg else "false"
    else:
        reg_s = str(reg)

    mt = str(getattr(memspec, "memoryType", "DDR5")).strip().upper()
    memtimingspec = {
        "tCK": t.tCK,
        "RAS": t.RAS,
        "RCD": t.RCD,
        "RP": t.RP,
        "RFC1": t.RFC1,
        "RFC2": t.RFC2,
        "RFCsb": t.RFCsb,
        "REFI": t.REFI,
    }
    for opt in ("RFCab_ns", "RFCpb_ns", "PBR2PBR_ns", "PBR2ACT_ns"):
        if hasattr(t, opt):
            memtimingspec[opt] = float(getattr(t, opt, 0.0))

    if mt in ("LPDDR5", "LPDDR5X"):
        mempowerspec = {
            "memoryType": getattr(p, "memoryType", mt),
            "vdd": getattr(p, "vdd", 0.0),
            "vpp": getattr(p, "vpp", 0.0),
            "vddq": getattr(p, "vddq", 0.0),
            "vdd1": getattr(p, "vdd1", 0.0),
            "vdd2h": getattr(p, "vdd2h", 0.0),
            "vdd2l": getattr(p, "vdd2l", 0.0),
            "idd0": p.idd0,
            "idd2n": p.idd2n,
            "idd3n": p.idd3n,
            "idd4r": p.idd4r,
            "idd4w": p.idd4w,
            "idd5b": p.idd5b,
            "idd6n": p.idd6n,
            "idd2p": p.idd2p,
            "idd3p": p.idd3p,
            "idd7": getattr(p, "idd7", 0.0),
        }
        rails = getattr(p, "rails", None) or {}
        idd_by = getattr(p, "idd_by_rail_A", None) or {}
        if rails:
            mempowerspec["rails"] = rails
        if idd_by:
            mempowerspec["idd_by_rail_A"] = idd_by
    else:
        mempowerspec = {
            "memoryType": getattr(p, "memoryType", mt),
            "vdd": p.vdd,
            "vpp": p.vpp,
            "vddq": p.vddq,
            "idd0": p.idd0,
            "idd2n": p.idd2n,
            "idd3n": p.idd3n,
            "idd4r": p.idd4r,
            "idd4w": p.idd4w,
            "idd5b": p.idd5b,
            "idd6n": p.idd6n,
            "idd2p": p.idd2p,
            "idd3p": p.idd3p,
            "ipp0": p.ipp0,
            "ipp2n": p.ipp2n,
            "ipp3n": p.ipp3n,
            "ipp4r": p.ipp4r,
            "ipp4w": p.ipp4w,
            "ipp5b": p.ipp5b,
            "ipp6n": p.ipp6n,
            "ipp2p": p.ipp2p,
            "ipp3p": p.ipp3p,
        }

    return {
        "memoryId": memspec.memoryId,
        "memoryType": memspec.memoryType,
        "registered": reg_s,
        "memarchitecturespec": {
            "width": arch.width,
            "nbrOfBanks": arch.nbrOfBanks,
            "nbrOfBankGroups": arch.nbrOfBankGroups,
            "nbrOfRanks": arch.nbrOfRanks,
            "nbrOfColumns": arch.nbrOfColumns,
            "nbrOfRows": arch.nbrOfRows,
            "nbrOfDevices": arch.nbrOfDevices,
            "nbrOfDBs": int(nbr_dbs),
            "burstLength": arch.burstLength,
            "dataRate": arch.dataRate,
        },
        "mempowerspec": mempowerspec,
        "memtimingspec": memtimingspec,
    }


def workload_obj_to_api_dict(workload) -> dict:
    return {
        "BNK_PRE_percent": workload.BNK_PRE_percent,
        "CKE_LO_PRE_percent": workload.CKE_LO_PRE_percent,
        "CKE_LO_ACT_percent": workload.CKE_LO_ACT_percent,
        "PageHit_percent": workload.PageHit_percent,
        "RDsch_percent": workload.RDsch_percent,
        "RD_Data_Low_percent": workload.RD_Data_Low_percent,
        "WRsch_percent": workload.WRsch_percent,
        "WR_Data_Low_percent": workload.WR_Data_Low_percent,
        "termRDsch_percent": workload.termRDsch_percent,
        "termWRsch_percent": workload.termWRsch_percent,
        "System_tRC_ns": workload.System_tRC_ns,
        "tRRDsch_ns": workload.tRRDsch_ns,
    }
