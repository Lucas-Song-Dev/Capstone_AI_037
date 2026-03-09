from typing import Dict
from parser import MemSpec, Workload


class DDR5ComponentPowerModel:
    """
    Core DRAM power model: background + refresh + RD/WR core + ACT/PRE (VDD/VPP).
    Stateless: given memspec/workload, return a breakdown dictionary.
    """

    def compute(self, memspec: MemSpec, workload: Workload, nbrOfDBs: int) -> Dict[str, float]:
        p = memspec.mempowerspec
        t = memspec.memtimingspec

        # NOTE: RCD and data buffers use different IDD values than DRAM. However, unable
        # to find any datasheets with these IDD values, so will use the almost equivalent DRAM IDD
        # values for now.

        # Voltages
        vdd = p.vdd

        # Convert workload percentages to fractions (0–1)
        BNK_PRE_frac    = workload.BNK_PRE_percent / 100.0
        CKE_LO_PRE_frac = workload.CKE_LO_PRE_percent / 100.0
        CKE_LO_ACT_frac = workload.CKE_LO_ACT_percent / 100.0

        RD_frac = workload.RDsch_percent / 100.0
        WR_frac = workload.WRsch_percent / 100.0

        # --------------------------------------------------------------------
        # 1) Register Clock Driver Power
        # --------------------------------------------------------------------
        if not memspec.registered:
            P_RCD = 0
        else:
            P_RCD = (((1 - CKE_LO_ACT_frac) * p.idd3n) + 
                           ((p.idd4w - p.idd3n) * WR_frac) + 
                           (p.idd4r - p.idd3n) * RD_frac) * vdd

        # --------------------------------------------------------------------
        # 2) Data Buffer Power
        # --------------------------------------------------------------------
        P_DB = nbrOfDBs * (((1 - CKE_LO_ACT_frac) * p.idd3n) + 
                           ((p.idd4w - p.idd3n) * WR_frac) + 
                           (p.idd4r - p.idd3n) * RD_frac) * vdd

        # --------------------------------------------------------------------
        # 5) Aggregate
        # --------------------------------------------------------------------
        P_total_cmp = P_RCD + P_DB

        return {
            "P_RCD": P_RCD,
            "P_DB": P_DB,
            "P_total_component": P_total_cmp,
        }
