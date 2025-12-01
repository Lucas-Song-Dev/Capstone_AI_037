import json
from parser import parse_memspec_json, normalize_workload

class DDR5:
    def __init__(self):
        self.memspec = None
        self.workload = None

    def load_parameters(self, memspec_filepath: str, workload_filepath: str):
        with open(memspec_filepath) as f:
            memspec_root = json.load(f)
        self.memspec = memspec_root["memspec"]

        with open(workload_filepath) as f:
            workload_json = json.load(f)
        self.workload = normalize_workload(workload_json)
    
    def ddr5_core_power(self):
        
        if (self.memspec is None or self.workload is None):
            raise ValueError("Memory specification and workload must be loaded before calculating power.")

        memspec = self.memspec
        workload = self.workload

        p = memspec["mempowerspec"]
        t = memspec["memtimingspec"]

        vdd = p["vdd"]
        vpp = p["vpp"]

        tCK   = t["tCK"]
        tRAS  = t["RAS"] * tCK
        tRP   = t["RP"] * tCK
        tRC   = (t["RAS"] + t["RP"]) * tCK
        tRFC  = t["RFC1"] * tCK
        tREFI = t["REFI"] * tCK

        BNK_PRE      = workload["BNK_PRE"]
        CKE_LO_PRE   = workload["CKE_LO_PRE"]
        CKE_LO_ACT   = workload["CKE_LO_ACT"]
        RDsch        = workload["RDsch"]
        WRsch        = workload["WRsch"]
        tRRDsch      = workload["tRRDsch"]

        # ----- background VDD -----
        P_PRE_PDN  = p["idd2p"] * vdd
        P_PRE_STBY = p["idd2n"] * vdd
        P_ACT_PDN  = p["idd3p"] * vdd
        P_ACT_STBY = p["idd3n"] * vdd

        BNK_ACT = 1.0 - BNK_PRE

        P_bg_VDD = (
            P_PRE_PDN  * BNK_PRE * CKE_LO_PRE +
            P_PRE_STBY * BNK_PRE * (1 - CKE_LO_PRE) +
            P_ACT_PDN  * BNK_ACT * CKE_LO_ACT +
            P_ACT_STBY * BNK_ACT * (1 - CKE_LO_ACT)
        )

        # ----- background VPP -----
        P_PRE_PDN_vpp  = p["ipp2p"] * vpp
        P_PRE_STBY_vpp = p["ipp2n"] * vpp
        P_ACT_PDN_vpp  = p["ipp3p"] * vpp
        P_ACT_STBY_vpp = p["ipp3n"] * vpp

        P_bg_VPP = (
            P_PRE_PDN_vpp  * BNK_PRE * CKE_LO_PRE +
            P_PRE_STBY_vpp * BNK_PRE * (1 - CKE_LO_PRE) +
            P_ACT_PDN_vpp  * BNK_ACT * CKE_LO_ACT +
            P_ACT_STBY_vpp * BNK_ACT * (1 - CKE_LO_ACT)
        )

        # ----- ACT -----
        extra_idd_act = p["idd0"] - (p["idd3n"] * tRAS / tRC + p["idd2n"] * (tRC - tRAS) / tRC)
        if extra_idd_act < 0:
            extra_idd_act = 0.0

        P_ACT_ds = extra_idd_act * vdd
        P_ACT = P_ACT_ds * (tRC / tRRDsch)

        extra_ipp_act = p["ipp0"] - (p["ipp3n"] * tRAS / tRC + p["ipp2n"] * (tRC - tRAS) / tRC)
        if extra_ipp_act < 0:
            extra_ipp_act = 0.0

        P_ACT_VPP_ds = extra_ipp_act * vpp
        P_ACT_VPP = P_ACT_VPP_ds * (tRC / tRRDsch)

        # ----- RD/WR -----
        P_WR_ds = (p["idd4w"] - p["idd3n"]) * vdd
        P_RD_ds = (p["idd4r"] - p["idd3n"]) * vdd
        P_WR = P_WR_ds * WRsch
        P_RD = P_RD_ds * RDsch

        P_WR_VPP_ds = (p["ipp4w"] - p["ipp3n"]) * vpp
        P_RD_VPP_ds = (p["ipp4r"] - p["ipp3n"]) * vpp
        P_WR_VPP = P_WR_VPP_ds * WRsch
        P_RD_VPP = P_RD_VPP_ds * RDsch

        # ----- REF -----
        P_REF_ds = (p["idd5b"] - p["idd3n"]) * vdd
        P_REF = P_REF_ds * (tRFC / tREFI)

        P_REF_VPP_ds = (p["ipp5b"] - p["ipp3n"]) * vpp
        P_REF_VPP = P_REF_VPP_ds * (tRFC / tREFI)

        P_VDD_core = P_bg_VDD + P_ACT + P_WR + P_RD + P_REF
        P_VPP_core = P_bg_VPP + P_ACT_VPP + P_WR_VPP + P_RD_VPP + P_REF_VPP

        return {
            "P_VDD_core": P_VDD_core,
            "P_VPP_core": P_VPP_core,
            "P_total_core": P_VDD_core + P_VPP_core,
        }
