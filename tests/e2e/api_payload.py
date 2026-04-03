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
        "mempowerspec": {
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
        },
        "memtimingspec": {
            "tCK": t.tCK,
            "RAS": t.RAS,
            "RCD": t.RCD,
            "RP": t.RP,
            "RFC1": t.RFC1,
            "RFC2": t.RFC2,
            "RFCsb": t.RFCsb,
            "REFI": t.REFI,
        },
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
