from typing import Dict
from parser import load_memspec, load_workload, MemSpec, Workload

class ddr5: 
    def __init__(self, memspec: MemSpec, workload: Workload) -> None:
        self.memspec = memspec
        self.workload = workload
        self.corepower = None
        self.interfacepower = None

    @classmethod
    def from_json_files(cls, memspec_path: str, workload_path: str):
        """Convenience constructor: load MemSpec + Workload from JSON files."""
        memspec = load_memspec(memspec_path)
        workload = load_workload(workload_path)
        return cls(memspec, workload)

    def compute_corepower(self) -> Dict[str, float]:
        workload = self.workload
        p = self.memspec.mempowerspec
        t = self.memspec.memtimingspec

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
        # Precharged background: blend IDD2N and IDD2P based on CKE low
        I_PRE_bg = (1.0 - CKE_LO_PRE_frac) * p.idd2n + CKE_LO_PRE_frac * p.idd2p
        P_PRE_STBY_core = vdd * I_PRE_bg

        # Active background: blend IDD3N and IDD3P based on CKE low
        I_ACT_bg = (1.0 - CKE_LO_ACT_frac) * p.idd3n + CKE_LO_ACT_frac * p.idd3p
        P_ACT_STBY_core = vdd * I_ACT_bg

        # Mix precharged vs active background based on BNK_PRE fraction
        P_background_vdd = BNK_PRE_frac * P_PRE_STBY_core + (1.0 - BNK_PRE_frac) * P_ACT_STBY_core

        # --------------------------------------------------------------------
        # 2) Refresh power (VDD + VPP)
        # --------------------------------------------------------------------
        # Calculate fraction time require for one refresh / how often cells must be refreshed
        duty_ref = tRFC1_s / tREFI_s

        # Incremental over active standby for refresh
        # Vdd x extra current x fraction of time spent in refresh
        P_REF_vdd = vdd * (p.idd5b - p.idd3n) * duty_ref
        P_REF_vpp = vpp * (p.ipp5b - p.ipp3n) * duty_ref
        P_REF_core = P_REF_vdd + P_REF_vpp

        # --------------------------------------------------------------------
        # 3) Read / Write incremental power (VDD)
        # --------------------------------------------------------------------
        # Treat RDsch_percent / WRsch_percent as duty cycles of "read" or "write" activity
        duty_rd = RD_frac
        duty_wr = WR_frac

        P_RD_core = vdd * (p.idd4r - p.idd3n) * duty_rd
        P_WR_core = vdd * (p.idd4w - p.idd3n) * duty_wr

        # --------------------------------------------------------------------
        # 4) Activate / Precharge incremental power
        # --------------------------------------------------------------------
        P_ACT_PRE_core = 0.0
        tRRDsch_s = workload.tRRDsch_ns * 1e-9

        # Row cycle window (precharged -> ACT command -> active state -> PRE Command -> precharged)
        t_row_cycle = tRAS + tRP

        # Fraction of time spent in ACT+PRE windows (for VDD)
        # time for 1 cycle / how often this happens
        duty_act_pre = min(1.0, t_row_cycle / tRRDsch_s)

        # Fraction of time spent actually raising wordlines (for VPP)
        # vpp only used during ACT, not PRE command
        duty_act_vpp = min(1.0, tRAS / tRRDsch_s)

        ## todo: need to decide idd2n or idd3n
        # Incremental ACT+PRE current over active standby (VDD)
        P_ACT_PRE_vdd = vdd * (p.idd0 - p.idd2n) * duty_act_pre

        # Incremental ACT VPP power over active standby
        P_ACT_vpp = vpp * (p.ipp0 - p.ipp2n) * duty_act_vpp

        # Total ACT/PRE core power (just for reporting)
        P_ACT_PRE_core = P_ACT_PRE_vdd + P_ACT_vpp

        # --------------------------------------------------------------------
        # 5) Aggregate VDD, VPP and total core power
        # --------------------------------------------------------------------
        P_VDD_core = P_background_vdd + P_RD_core + P_WR_core + P_REF_vdd + P_ACT_PRE_vdd
        P_VPP_core = P_REF_vpp + P_ACT_vpp
        P_total_core = P_VDD_core + P_VPP_core

        result = {
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
        self.corepower = result

        return result


    def ddr5_core_power_model(self) -> Dict[str, float]:
        result = None
        self.interfacepower = result
        return result
        

    def report_power(self):
        result = self.corepower

        print("=== MemSpec ===")
        print("Memory ID:", self.memspec.memoryId)
        print("Type:", self.memspec.memoryType)
        print("Width (bits):", self.memspec.memarchitecturespec.width)
        print("Banks:", self.memspec.memarchitecturespec.nbrOfBanks)
        print()

        print("=== Core Power Breakdown ===")
        print("P_PRE_STBY_core (W):", f"{result['P_PRE_STBY_core']:.4f}")
        print("P_ACT_STBY_core (W):", f"{result['P_ACT_STBY_core']:.4f}")
        print("P_ACT_PRE_core (W):", f"{result['P_ACT_PRE_core']:.4f}")
        print("P_RD_core (W):",       f"{result['P_RD_core']:.4f}")
        print("P_WR_core (W):",       f"{result['P_WR_core']:.4f}")
        print("P_REF_core (W):",      f"{result['P_REF_core']:.4f}")
        print("P_VDD_core (W):",      f"{result['P_VDD_core']:.4f}")
        print("P_VPP_core (W):",      f"{result['P_VPP_core']:.4f}")
        print("P_total_core (W):",    f"{result['P_total_core']:.4f}")
