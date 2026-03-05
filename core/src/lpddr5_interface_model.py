from typing import Dict
from parser import MemSpec, Workload


class LPDDR5InterfacePowerModel:
    """
    LPDDR5 Interface power model with 4 voltage rails: VDD1, VDD2H, VDD2L, VDDQ.
    
    LPDDR5 interface is different from DDR5:
    - Lower I/O voltage (VDDQ = 0.5V vs DDR5's 1.1V)
    - Lower termination voltages (VDD2L = 1.1V vs DDR5's VPP = 1.8V)
    - Simpler signal structure optimized for mobile
    - DQS strobe-based architecture
    
    Power includes:
    - Address/Command bus (CA) on VDD1
    - Data bus (DQ/DQS) on VDDQ
    - Clock (CK/CK_n) on VDD1
    - Termination on VDD2L
    """

    def compute(self, memspec: MemSpec, workload: Workload) -> Dict[str, float]:
        """
        Compute LPDDR5 interface power breakdown by voltage rail.
        
        Returns:
            Dictionary with power values (W) for different voltage rails
            and signal groups.
        """
        p = memspec.mempowerspec
        arch = memspec.memarchitecturespec

        # LPDDR5 Voltages
        vdd1 = p.vdd1    # Command/Address: 1.8V
        vdd2h = p.vdd2h  # Core High: 1.1V
        vdd2l = p.vdd2l  # Core Low: 1.1V
        vddq = p.vddq    # I/O: 0.5V

        # Convert workload percentages to fractions
        rd_duty = workload.RDsch_percent / 100.0
        wr_duty = workload.WRsch_percent / 100.0
        ca_activity = 0.3  # Assume command/address is ~30% active
        
        # LPDDR5 bus characteristics
        ca_width = 10      # Command/Address: ~10 bits (reduced vs DDR5)
        dq_width = arch.width  # Data width (x8, x16, etc.)
        dqs_width = dq_width // 8  # DQS strobes (1 per 8 DQs)
        ck_lines = 2   # CK and CK_n
        
        # I/O Driver and Termination Resistances (JEDEC typical values)
        # LPDDR5 values are generally lower than DDR5
        ron_dq = 40.0      # Ohms, output driver resistance for DQ
        ron_ca = 40.0      # Ohms, output driver resistance for CA
        ron_ck = 40.0      # Ohms, output driver resistance for Clock
        
        # RTT: derived from RZQ (240 Ω)
        rtt_dq = 60.0      # Ohms, termination for DQ
        rtt_ca = 80.0      # Ohms, termination for CA
        rtt_ck = 60.0      # Ohms, termination for Clock
        
        # ====================================================================
        # 1) Command/Address bus power (VDD1)
        # ====================================================================
        # CA bus: active during command phases
        i_ca_driver = vdd1 / (ron_ca + rtt_ca)  # Driver current
        i_ca_term = vdd1 / rtt_ca                 # Termination current
        p_ca_driver = i_ca_driver ** 2 * ron_ca * ca_activity
        p_ca_term = i_ca_term ** 2 * rtt_ca * ca_activity
        p_ca_vdd1 = p_ca_driver + p_ca_term
        
        # ====================================================================
        # 2) Clock distribution power (VDD1)
        # ====================================================================
        # CK/CK_n: continuous toggling at data rate
        # Toggle probability for differential pair: ~0.5 (assuming 50% toggle)
        toggle_prob_ck = 0.5
        i_ck_driver = vdd1 / (ron_ck + rtt_ck)
        i_ck_term = vdd1 / rtt_ck
        p_ck_driver = i_ck_driver ** 2 * ron_ck * ck_lines * toggle_prob_ck
        p_ck_term = i_ck_term ** 2 * rtt_ck * ck_lines * toggle_prob_ck
        p_ck_vdd1 = p_ck_driver + p_ck_term
        
        # ====================================================================
        # 3) Data bus power (VDDQ - 0.5V)
        # ====================================================================
        # DQ lines: active during read/write operations
        i_dq_driver_rd = vddq / (ron_dq + rtt_dq)
        i_dq_term_rd = vddq / rtt_dq
        p_dq_rd_driver = i_dq_driver_rd ** 2 * ron_dq * dq_width * rd_duty
        p_dq_rd_term = i_dq_term_rd ** 2 * rtt_dq * dq_width * rd_duty
        
        i_dq_driver_wr = vddq / (ron_dq + rtt_dq)
        i_dq_term_wr = vddq / rtt_dq
        p_dq_wr_driver = i_dq_driver_wr ** 2 * ron_dq * dq_width * wr_duty
        p_dq_wr_term = i_dq_term_wr ** 2 * rtt_dq * dq_width * wr_duty
        
        p_dq_vddq = p_dq_rd_driver + p_dq_rd_term + p_dq_wr_driver + p_dq_wr_term
        
        # ====================================================================
        # 4) DQS strobe power (VDDQ) - Theoretical fallback
        # ====================================================================
        # DQS: toggling during read/write operations
        toggle_prob_dqs = 0.5
        i_dqs_driver = vddq / (ron_dq + rtt_dq)
        i_dqs_term = vddq / rtt_dq
        p_dqs_driver = i_dqs_driver ** 2 * ron_dq * dqs_width * toggle_prob_dqs * (rd_duty + wr_duty)
        p_dqs_term = i_dqs_term ** 2 * rtt_dq * dqs_width * toggle_prob_dqs * (rd_duty + wr_duty)
        p_dqs_vddq_theoretical = p_dqs_driver + p_dqs_term
        
        # ====================================================================
        # 4b) VDDQ interface power from datasheet IDD currents (preferred)
        # ====================================================================
        # Use actual datasheet currents when available - more accurate than
        # theoretical I²R calculations with hardcoded RON/RTT values.
        #
        # IDD4RQ = total VDDQ current during continuous reads
        # IDD4WQ = total VDDQ current during continuous writes  
        # IDD3NQ = background VDDQ current (active standby)
        # Delta current = activity-specific contribution
        
        def _iddq(op_key: str) -> float:
            """Extract VDDQ current for given operation from idd_by_rail_A."""
            by_rail = getattr(p, "idd_by_rail_A", {}) or {}
            op_data = by_rail.get(op_key, {})
            if not isinstance(op_data, dict):
                return 0.0
            # Handle both "vddq" and "vddq_read" keys (IDD4R uses vddq_read)
            return float(op_data.get("vddq", op_data.get("vddq_read", 0.0)))

        idd3nq = _iddq("idd3n")   # Background I/O current on VDDQ
        idd4rq = _iddq("idd4r")   # Read burst VDDQ current
        idd4wq = _iddq("idd4w")   # Write burst VDDQ current

        # Check if datasheet currents are available
        use_datasheet = (idd4rq > 0.0) or (idd4wq > 0.0)

        if use_datasheet:
            # Datasheet-based: P = V * I_delta * duty_cycle
            # IDD4RQ/IDD4WQ already include DQ + DQS power
            p_dq_vddq = vddq * max(0.0, (idd4rq - idd3nq)) * rd_duty \
                      + vddq * max(0.0, (idd4wq - idd3nq)) * wr_duty
            p_dqs_vddq = 0.0  # Included in IDD4RQ/IDD4WQ measurement
        else:
            # Fallback to theoretical calculation
            p_dq_vddq = p_dq_rd_driver + p_dq_rd_term + p_dq_wr_driver + p_dq_wr_term
            p_dqs_vddq = p_dqs_vddq_theoretical

        # ====================================================================
        # 5) Termination power on VDD2L (for DQ/DQS pulls)
        # ====================================================================
        # LPDDR5 uses VDD2L for some termination schemes
        p_term_vdd2l = (rd_duty + wr_duty) * dq_width * 0.5 * vdd2l * vdd2l / rtt_dq
        
        # ====================================================================
        # 6) Total interface power by rail
        # ====================================================================
        p_total_vdd1 = p_ca_vdd1 + p_ck_vdd1
        p_total_vddq = p_dq_vddq + p_dqs_vddq
        p_total_vdd2l = p_term_vdd2l
        p_total_interface = p_total_vdd1 + p_total_vddq + p_total_vdd2l
        
        return {
            "P_CA_VDD1": p_ca_vdd1,
            "P_CK_VDD1": p_ck_vdd1,
            "P_DQ_VDDQ": p_dq_vddq,
            "P_DQS_VDDQ": p_dqs_vddq,
            "P_TERM_VDD2L": p_term_vdd2l,
            "P_VDD1": p_total_vdd1,
            "P_VDDQ": p_total_vddq,
            "P_VDD2L": p_total_vdd2l,
            "P_total_interface": p_total_interface,
            "_used_datasheet_currents": use_datasheet,  # Debug flag
        }

