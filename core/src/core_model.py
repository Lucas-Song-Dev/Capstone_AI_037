from typing import Dict
from parser import MemSpec, Workload


class DDR5CorePowerModel:
    """
    Core DRAM power model: background + refresh + RD/WR core + ACT/PRE (VDD/VPP).
    Stateless: given memspec/workload, return a breakdown dictionary.
    """

    def compute(self, memspec: MemSpec, workload: Workload) -> Dict[str, float]:
        p = memspec.mempowerspec
        t = memspec.memtimingspec

        # Voltages
        vdd = p.vdd
        vpp = p.vpp

        # Basic timing in seconds
        tCK = t.tCK
        tRAS = t.RAS * tCK
        tRP = t.RP * tCK
        tRFC1_s = t.RFC1 * tCK
        tREFI_s = t.REFI * tCK

        # Convert workload percentages to fractions (0–1)
        BNK_PRE_frac    = workload.BNK_PRE_percent / 100.0
        CKE_LO_PRE_frac = workload.CKE_LO_PRE_percent / 100.0
        CKE_LO_ACT_frac = workload.CKE_LO_ACT_percent / 100.0

        RD_frac = workload.RDsch_percent / 100.0
        WR_frac = workload.WRsch_percent / 100.0

        # --------------------------------------------------------------------
        # 1) Background (standby) power (VDD)
        # --------------------------------------------------------------------
        I_PRE_bg = (1.0 - CKE_LO_PRE_frac) * p.idd2n + CKE_LO_PRE_frac * p.idd2p
        P_PRE_STBY_core = vdd * I_PRE_bg

        I_ACT_bg = (1.0 - CKE_LO_ACT_frac) * p.idd3n + CKE_LO_ACT_frac * p.idd3p
        P_ACT_STBY_core = vdd * I_ACT_bg

        P_background_vdd = BNK_PRE_frac * P_PRE_STBY_core + (1.0 - BNK_PRE_frac) * P_ACT_STBY_core

        # --------------------------------------------------------------------
        # 2) Refresh power (VDD + VPP)
        # --------------------------------------------------------------------
        duty_ref = tRFC1_s / tREFI_s

        P_REF_vdd = vdd * (p.idd5b - p.idd3n) * duty_ref
        P_REF_vpp = vpp * (p.ipp5b - p.ipp3n) * duty_ref
        P_REF_core = P_REF_vdd + P_REF_vpp

        # --------------------------------------------------------------------
        # 3) Read / Write incremental core power (VDD)
        # --------------------------------------------------------------------
        duty_rd = RD_frac
        duty_wr = WR_frac

        P_RD_core = vdd * (p.idd4r - p.idd3n) * duty_rd
        P_WR_core = vdd * (p.idd4w - p.idd3n) * duty_wr

        # --------------------------------------------------------------------
        # 4) Activate / Precharge incremental power (VDD + VPP)
        # --------------------------------------------------------------------
        tRRDsch_s = workload.tRRDsch_ns * 1e-9
        t_row_cycle = tRAS + tRP

        duty_act_pre = min(1.0, t_row_cycle / tRRDsch_s) if tRRDsch_s > 0 else 0.0
        duty_act_vpp = min(1.0, tRAS / tRRDsch_s) if tRRDsch_s > 0 else 0.0

        # NOTE: you had a TODO here. Keep it explicit.
        # If your baseline state is "precharged background", idd2n makes sense.
        P_ACT_PRE_vdd = vdd * (p.idd0 - p.idd2n) * duty_act_pre
        P_ACT_vpp     = vpp * (p.ipp0 - p.ipp2n) * duty_act_vpp

        P_ACT_PRE_core = P_ACT_PRE_vdd + P_ACT_vpp

        # --------------------------------------------------------------------
        # 5) Aggregate
        # --------------------------------------------------------------------
        P_VDD_core = P_background_vdd + P_RD_core + P_WR_core + P_REF_vdd + P_ACT_PRE_vdd
        P_VPP_core = P_REF_vpp + P_ACT_vpp
        P_total_core = P_VDD_core + P_VPP_core

        return {
            "P_PRE_STBY_core": P_PRE_STBY_core,
            "P_ACT_STBY_core": P_ACT_STBY_core,
            "P_ACT_PRE_core": P_ACT_PRE_core,
            "P_RD_core": P_RD_core,
            "P_WR_core": P_WR_core,
            "P_REF_core": P_REF_core,
            "P_VDD_core": P_VDD_core,
            "P_VPP_core": P_VPP_core,
            "P_total_core": P_total_core,
        }
