from typing import Dict
from parser import MemSpec, Workload


class LPDDR5CorePowerModel:
    """
    LPDDR5 Core DRAM power model with 4 voltage rails: VDD1, VDD2H, VDD2L, VDDQ.
    
    LPDDR5 differences from DDR5:
    - No VPP rail (no separate wordline pump voltage)
    - Multiple VDD rails for different power domains
    - Lower operating voltages optimized for mobile/low-power
    - Different timing and power parameters
    """

    def compute(self, memspec: MemSpec, workload: Workload) -> Dict[str, float]:
        p = memspec.mempowerspec
        t = memspec.memtimingspec

        # LPDDR5/LPDDR5X Voltages (4 rails)
        vdd1 = p.vdd1
        vdd2h = p.vdd2h
        vdd2l = p.vdd2l
        vddq = p.vddq

        def _op_currents(op_key: str) -> Dict[str, float]:
            by_rail = p.idd_by_rail_A.get(op_key, {}) if isinstance(p.idd_by_rail_A, dict) else {}
            if by_rail:
                return {
                    "vdd1": float(by_rail.get("vdd1", 0.0)),
                    "vdd2h": float(by_rail.get("vdd2h", 0.0)),
                    "vdd2l": float(by_rail.get("vdd2l", 0.0)),
                    "vddq": float(by_rail.get("vddq", by_rail.get("vddq_read", 0.0))),
                }

            scalar_map = {
                "idd0": p.idd0,
                "idd2n": p.idd2n,
                "idd2p": p.idd2p,
                "idd3n": p.idd3n,
                "idd3p": p.idd3p,
                "idd4r": p.idd4r,
                "idd4w": p.idd4w,
                "idd5b_allbank": p.idd5b,
                "idd5pb_perbank": p.idd5b,
                "idd6n": p.idd6n,
                "idd7": p.idd7,
            }
            return {
                "vdd1": float(scalar_map.get(op_key, 0.0)),
                "vdd2h": 0.0,
                "vdd2l": 0.0,
                "vddq": 0.0,
            }

        def _blend(a: Dict[str, float], b: Dict[str, float], alpha: float) -> Dict[str, float]:
            keys = set(a.keys()) | set(b.keys())
            return {k: (1.0 - alpha) * a.get(k, 0.0) + alpha * b.get(k, 0.0) for k in keys}

        def _sub(a: Dict[str, float], b: Dict[str, float]) -> Dict[str, float]:
            keys = set(a.keys()) | set(b.keys())
            return {k: max(0.0, a.get(k, 0.0) - b.get(k, 0.0)) for k in keys}

        def _scale(a: Dict[str, float], s: float) -> Dict[str, float]:
            return {k: v * s for k, v in a.items()}

        def _power(a: Dict[str, float]) -> float:
            return (
                vdd1 * a.get("vdd1", 0.0)
                + vdd2h * a.get("vdd2h", 0.0)
                + vdd2l * a.get("vdd2l", 0.0)
                + vddq * a.get("vddq", 0.0)
            )

        def _rail_power(a: Dict[str, float]) -> Dict[str, float]:
            return {
                "P_VDD1": vdd1 * a.get("vdd1", 0.0),
                "P_VDD2H": vdd2h * a.get("vdd2h", 0.0),
                "P_VDD2L": vdd2l * a.get("vdd2l", 0.0),
                "P_VDDQ": vddq * a.get("vddq", 0.0),
            }

        # Basic timing in seconds, with LPDDR5X ns fallbacks
        tCK = float(t.tCK)
        tRAS = (t.RAS * tCK) if (tCK > 0.0 and t.RAS > 0) else 0.0
        tRP = (t.RP * tCK) if (tCK > 0.0 and t.RP > 0) else 0.0
        tRFC1_s = (t.RFC1 * tCK) if (tCK > 0.0 and t.RFC1 > 0) else (t.RFCab_ns * 1e-9 if t.RFCab_ns > 0 else 0.0)
        tREFI_s = (t.REFI * tCK) if (tCK > 0.0 and t.REFI > 0) else 3.9e-6

        # Convert workload percentages to fractions (0–1)
        BNK_PRE_frac    = workload.BNK_PRE_percent / 100.0
        CKE_LO_PRE_frac = workload.CKE_LO_PRE_percent / 100.0
        CKE_LO_ACT_frac = workload.CKE_LO_ACT_percent / 100.0

        RD_frac = workload.RDsch_percent / 100.0
        WR_frac = workload.WRsch_percent / 100.0

        # ====================================================================
        # 1) Background (standby) power
        # ====================================================================
        # Precharged standby: blend IDD2N and IDD2P
        i2n = _op_currents("idd2n")
        i2p = _op_currents("idd2p")
        i3n = _op_currents("idd3n")
        i3p = _op_currents("idd3p")

        i_pre_bg = _blend(i2n, i2p, CKE_LO_PRE_frac)
        i_act_bg = _blend(i3n, i3p, CKE_LO_ACT_frac)
        i_bg = _blend(i_act_bg, i_pre_bg, BNK_PRE_frac)

        P_PRE_STBY_core = _power(i_pre_bg)
        P_ACT_STBY_core = _power(i_act_bg)
        P_background = _power(i_bg)

        bg_rails = _rail_power(i_bg)

        # ====================================================================
        # 2) Refresh power
        # ====================================================================
        duty_ref = tRFC1_s / tREFI_s

        i5 = _op_currents("idd5b_allbank")
        if _power(i5) == 0.0:
            i5 = _op_currents("idd5pb_perbank")
        i_ref_inc = _scale(_sub(i5, i3n), duty_ref)
        P_REF_core = _power(i_ref_inc)
        ref_rails = _rail_power(i_ref_inc)

        # ====================================================================
        # 3) Read / Write incremental core power
        # ====================================================================
        duty_rd = RD_frac
        duty_wr = WR_frac

        i4r = _op_currents("idd4r")
        i4w = _op_currents("idd4w")

        i_rd_inc = _scale(_sub(i4r, i3n), duty_rd)
        i_wr_inc = _scale(_sub(i4w, i3n), duty_wr)

        P_RD_core = _power(i_rd_inc)
        P_WR_core = _power(i_wr_inc)

        rd_rails = _rail_power(i_rd_inc)
        wr_rails = _rail_power(i_wr_inc)

        # ====================================================================
        # 4) Activate / Precharge incremental power
        # ====================================================================
        # LPDDR5: No VPP, so activation power comes from VDD rails
        tRRDsch_s = workload.tRRDsch_ns * 1e-9
        t_row_cycle = tRAS + tRP
        if t_row_cycle <= 0.0 and workload.System_tRC_ns > 0:
            t_row_cycle = workload.System_tRC_ns * 1e-9

        duty_act_pre = min(1.0, t_row_cycle / tRRDsch_s) if tRRDsch_s > 0 else 0.0

        # Activation incremental current (IDD0 - IDD2N)
        i0 = _op_currents("idd0")
        i_act_inc = _scale(_sub(i0, i2n), duty_act_pre)
        P_ACT_PRE_core = _power(i_act_inc)
        act_rails = _rail_power(i_act_inc)

        # ====================================================================
        # 5) Self-refresh power (optional, if workload includes self-refresh)
        # ====================================================================
        i_self = _op_currents("idd6n")
        P_SELFREF = _power(i_self)

        # ====================================================================
        # 6) Aggregate all power components
        # ====================================================================
        P_total_vdd1 = bg_rails["P_VDD1"] + rd_rails["P_VDD1"] + wr_rails["P_VDD1"] + ref_rails["P_VDD1"] + act_rails["P_VDD1"]
        P_total_vdd2h = bg_rails["P_VDD2H"] + rd_rails["P_VDD2H"] + wr_rails["P_VDD2H"] + ref_rails["P_VDD2H"] + act_rails["P_VDD2H"]
        P_total_vdd2l = bg_rails["P_VDD2L"] + rd_rails["P_VDD2L"] + wr_rails["P_VDD2L"] + ref_rails["P_VDD2L"] + act_rails["P_VDD2L"]
        P_total_vddq = bg_rails["P_VDDQ"] + rd_rails["P_VDDQ"] + wr_rails["P_VDDQ"] + ref_rails["P_VDDQ"] + act_rails["P_VDDQ"]
        P_total_core = P_total_vdd1 + P_total_vdd2h + P_total_vdd2l + P_total_vddq

        return {
            "P_PRE_STBY_core": P_PRE_STBY_core,
            "P_ACT_STBY_core": P_ACT_STBY_core,
            "P_background": P_background,
            "P_ACT_PRE_core": P_ACT_PRE_core,
            "P_RD_core": P_RD_core,
            "P_WR_core": P_WR_core,
            "P_REF_core": P_REF_core,
            "P_SELFREF": P_SELFREF,
            "P_VDD1": P_total_vdd1,
            "P_VDD2H": P_total_vdd2h,
            "P_VDD2L": P_total_vdd2l,
            "P_VDDQ": P_total_vddq,
            "P_total_core": P_total_core,
        }
