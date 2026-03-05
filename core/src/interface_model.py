from dataclasses import dataclass
from typing import Dict, Optional
from parser import MemSpec, Workload

# =========================================================
# Assumptions and Modelling Scope
# =========================================================
#
# This interface power model is a first-order, resistive-based
# approximation intended for architectural and comparative
# power analysis of DDR5 memory interfaces.
#
# Returns power in Watts (W) for each component and total interface power. 
# SCOPE: the power is for one DIMM rank(only one is active), not per subchannel or per chip. 
# It is the total power for the entire interface as seen at the DRAM side and Host side.
#
# Key assumptions:
#
# 1. Resistive I/O Model
#    Each signal wire is modelled as a simple series path consisting
#    of an output driver resistance (Ron) and a termination resistance
#    (RTT). Transmission line effects such as reflections, impedance
#    mismatch, and frequency-dependent losses are not modelled.
#    Current I = VDDQ / (Ron + Rtt).
#
# 2. Pseudo Open Drain (POD) Signalling
#    DDR5 I/O signalling is treated as POD-based. Power consumption
#    is assumed to occur primarily when a signal is driven to the
#    logical '0' level. This behaviour is approximated using a
#    probability factor (prob_*_zero) to represent the fraction of
#    time a wire is actively sinking current.
#
# 3. Termination and Driver Power Attribution
#    - For write operations (Host drives, DRAM receives), power dissipation 
#      is attributed to the receiver-side termination (DRAM ODT).
#    - For read operations (DRAM drives, Host receives), power dissipation 
#      is attributed to the transmitter-side output driver resistance (DRAM Ron).
#    This separation allows precise estimation of heat generated on the DRAM die.
#
# 4. Differential Signalling Approximation
#    Differential signals (CK, WCK, DQS) are modelled on a per-wire
#    basis. Each wire is assumed to spend approximately 50% of time
#    at logic low, represented using a toggle probability of 0.5.
#    Correlation effects between differential pairs are not modelled.
#
# 5. Activity and Utilization Factors
#    Signal activity is represented using average utilization and
#    duty-cycle parameters (e.g., rd_duty, wr_duty, ca_util, cs_util).
#    These parameters abstract detailed timing behaviour into
#    steady-state averages suitable for system-level analysis.
#
# 6. Static Impedance Settings
#    Driver and termination resistances (Ron, RTT) are assumed to be
#    static and pre-calibrated (e.g., via ZQ calibration) and do not
#    vary dynamically with voltage, temperature, or frequency.
#    Values are sourced from JEDEC JESD79-5 Mode Registers (MR).
#
# 7. Scope Limitations
#    This model does not attempt to be cycle-accurate. It is intended
#    to support relative comparisons between memory configurations,
#    workloads, and architectural trade-offs rather than absolute
#    silicon-accurate power prediction.
#
# 8. Only one DRAM rank is modelled. 
#    Even if a DIMM has 2 ranks and each rank has 2 subchannels, the physical
#    bus nets are shared on the module; ranks are selected by CS.
#
# =========================================================

# ==========================================
# Core Physics Helpers
# ==========================================

def calc_power_drop_across_term(voltage: float, r_source: float, r_term: float) -> float:
    """
    Calculates power dissipated at the Termination Resistor (Receiver side).
    Used for: DQ Write (DRAM side), CA (DRAM side), CK (DRAM side).
    
    Formula: P = I^2 * R_term
    Where I = Voltage / (R_source + R_term)
    """
    if (r_source + r_term) == 0:
        return 0.0
    current = voltage / (r_source + r_term)
    return (current ** 2) * r_term

def calc_power_drop_across_driver(voltage: float, r_source: float, r_term: float) -> float:
    """
    Calculates power dissipated at the Output Driver (Transmitter side).
    Used for: DQ Read (DRAM side driving data).
    
    Formula: P = I^2 * R_source
    Where I = Voltage / (R_source + R_term)
    """
    if (r_source + r_term) == 0:
        return 0.0
    current = voltage / (r_source + r_term)
    return (current ** 2) * r_source

# ==========================================
# Data Classes
# ==========================================

@dataclass
class InterfacePowerInputs:
    # --- Voltage Rails ---
    vdd:  float = 1.1
    vddq: float = 1.1               # DDR5 IO Voltage

    # --- Topology Info ---
    num_subchannels: int = 2        # DDR5 DIMM: typically 2 subchannels per rank
    device_width_bits: int = 8      # x8 devices
    devices_per_rank: int = 8       # 8 chips for 64-bit width
    num_ranks: int = 1

    # --- Signal counts ---
    # Source: JEDEC JESD308B (DDR5 UDIMM Common Standard) - Pin Assignments
    # Standard UDIMMs define distinct CS pins (e.g., Pin 150 CS0_n_A, Pin 151 CS1_n_A) 
    # to support up to 2 physical ranks per subchannel.
    # Therefore, active CS lines typically equal the number of physical ranks.
    num_cs: Optional[int] = None    

    # --- Impedance Settings (DDR5 Typical) ---
    # Source: JEDEC JESD79-5 (DDR5 SDRAM)
    
    # Host (CPU/MC) Driver Impedance
    # Defined in MR5: RZQ/7 = 240/7 ≈ 34 ohm
    r_on_host: float = 34.0
    # Host (CPU/MC) Termination (for Reads)
    r_tt_host: float = 40.0
    
    # DRAM Output Driver (for Reads) 
    # Defined in MR5: RZQ/7 = 240/7 ≈ 34 ohm
    r_on_dram: float = 34.0
    
    # DRAM Write Termination (Target ODT) 
    # Defined in MR34: RZQ/5 = 48 ohm or RZQ/6 = 40 ohm
    r_tt_dram_wr: float = 48.0      
    
    # DRAM CA/CS Termination - MR33
    r_tt_ca: float = 80.0
    # DRAM Clock Termination
    r_tt_ck: float = 40.0

    # --- Activity / Duty Cycles (0.0 to 1.0) ---
    rd_duty: float = 0.0            # % of time reading
    wr_duty: float = 0.0            # % of time writing
    
    # Utilization factors (Active time when CKE is high)
    ca_util: float = 0.2           # Command bus utilization
    cs_util: float = 0.1           # Chip Select utilization
    ck_util: float = 1.0           # Clock is typically always running if CKE is High

    # --- Signal Probabilities (0.0 to 1.0) ---
    # Probability of signal being '0' (Low).
    # Since DDR5 is POD (Pseudo Open Drain), power is only consumed when signal is Low.
    # With DBI (Data Bus Inversion), '0' count is minimized, typically <= 0.5.
    prob_data_zero: float = 0.5     # For random data
    prob_cmd_zero: float = 0.5      # For random commands
    prob_clock_toggle: float = 0.5  # Clocks are 50% duty cycle

    data_rate_hz: float = 0.0       # Data rate in Hz (e.g., 4800 MT/s => 2.4 GHz clock, 4.8 GHz data rate)


# ==========================================
# Main Calculation Logic
# ==========================================
class DDR5InterfacePowerModel:
    def _derive_pin_counts_per_subchannel(self, inputs: InterfacePowerInputs, ca_bits_per_subch: int = 14) -> Dict[str, int]:
        """
        Derive per-subchannel pin counts using the same conventions as calculate_termination_power().

        Returns integer counts per subchannel:
          - num_dq_bits: DQ single-ended wires
          - dqs_pairs:  DQS differential pairs (1 per byte lane)
          - wck_pairs:  WCK differential pairs (approx: 1 per byte lane)
          - num_ca_bits: CA single-ended wires (default 14)
          - num_cs_bits: CS single-ended wires (default: num_ranks)
          - ck_pairs: CK differential pairs (default 1)
        """
        if int(inputs.num_subchannels) <= 0:
            raise ValueError("num_subchannels must be > 0")

        total_data_bits_per_rank = int(inputs.devices_per_rank) * int(inputs.device_width_bits)
        if total_data_bits_per_rank <= 0:
            raise ValueError("devices_per_rank * device_width_bits must be > 0")

        num_dq = total_data_bits_per_rank // int(inputs.num_subchannels)
        dqs_pairs = max(1, (num_dq + 7) // 8)
        wck_pairs = dqs_pairs

        num_cs = int(inputs.num_cs) if inputs.num_cs is not None else int(inputs.num_ranks)
        ck_pairs = 1

        return {
            "num_dq_bits": int(num_dq),
            "dqs_pairs": int(dqs_pairs),
            "wck_pairs": int(wck_pairs),
            "num_ca_bits": int(ca_bits_per_subch),
            "num_cs_bits": int(num_cs),
            "ck_pairs": int(ck_pairs),
        }

    def calculate_termination_power(self, inputs: InterfacePowerInputs) -> Dict[str, float]:
        """
        Calculates termination power components for DDR5 based on JEDEC principles.
        Returns power in Watts (W).
        """

        # ---------------------------------------------------
        # 1. Derive Pin Counts (per Sub-channel)
        # ---------------------------------------------------
        pins = self._derive_pin_counts_per_subchannel(inputs, ca_bits_per_subch=14)
        num_dq = pins["num_dq_bits"]
        num_ca = pins["num_ca_bits"]
        num_cs = pins["num_cs_bits"]
        num_ck = pins["ck_pairs"] * 2
        num_dqs = pins["dqs_pairs"] * 2
        num_wck = pins["wck_pairs"] * 2

        # ---------------------------------------------------
        # 2. Calculate Power Components
        # ---------------------------------------------------

        # --- A. DQ Write Power (Termination Power) ---
        # Path: Host Driver -> PCB -> DRAM ODT (Heat in DRAM)
        p_pin_dq_wr = calc_power_drop_across_term(inputs.vddq, inputs.r_on_host, inputs.r_tt_dram_wr)
        # Logic: Power * DutyCycle * Prob(0) * PinCount
        total_dq_write = (
            p_pin_dq_wr 
            * inputs.wr_duty 
            * inputs.prob_data_zero 
            * num_dq 
            * inputs.num_subchannels
        )

        # --- B. DQ Read Power (Driver Power) ---
        # Path: DRAM Driver -> PCB -> Host ODT (Heat in DRAM is from Driver Ron)
        p_pin_dq_rd = calc_power_drop_across_driver(inputs.vddq, inputs.r_on_dram, inputs.r_tt_host)
        total_dq_read = (
            p_pin_dq_rd 
            * inputs.rd_duty 
            * inputs.prob_data_zero 
            * num_dq 
            * inputs.num_subchannels
        )

        # --- C. CA (Command/Address) Power ---
        # Path: Host Driver -> DRAM ODT
        p_pin_ca = calc_power_drop_across_term(inputs.vddq, inputs.r_on_host, inputs.r_tt_ca)
        total_ca = (
            p_pin_ca 
            * inputs.ca_util 
            * inputs.prob_cmd_zero 
            * num_ca 
            * inputs.num_subchannels
        )

        # --- D. CK (System Clock) Power ---
        # Path: Host Driver -> DRAM ODT. Always running (unless Power Down).
        # Differential signal: effectively 50% are '0' and 50% are '1' at any time.
        p_pin_ck = calc_power_drop_across_term(inputs.vddq, inputs.r_on_host, inputs.r_tt_ck)
        total_ck = (
            p_pin_ck 
            * inputs.ck_util 
            * inputs.prob_clock_toggle 
            * num_ck 
            * inputs.num_subchannels
        )

        # --- E. WCK (Write Clock) Power ---
        # DDR5 Specific. Active primarily during Write operations.
        # Differential signal.
        p_pin_wck = calc_power_drop_across_term(inputs.vddq, inputs.r_on_host, inputs.r_tt_ck) # Use CK Rtt for WCK
        total_wck = (
            p_pin_wck 
            * inputs.wr_duty 
            * inputs.prob_clock_toggle 
            * num_wck 
            * inputs.num_subchannels
        )

        # --- F. DQS (Data Strobe) Power ---
        # Read: Driven by DRAM (Driver Power)
        # Write: Driven by Host (Termination Power)
        
        # DQS Write Part
        p_pin_dqs_wr = calc_power_drop_across_term(inputs.vddq, inputs.r_on_host, inputs.r_tt_dram_wr)
        total_dqs_wr = (
            p_pin_dqs_wr * inputs.wr_duty * inputs.prob_clock_toggle * num_dqs * inputs.num_subchannels
        )
        
        # DQS Read Part
        p_pin_dqs_rd = calc_power_drop_across_driver(inputs.vddq, inputs.r_on_dram, inputs.r_tt_host)
        total_dqs_rd = (
            p_pin_dqs_rd * inputs.rd_duty * inputs.prob_clock_toggle * num_dqs * inputs.num_subchannels
        )

        total_dqs = total_dqs_wr + total_dqs_rd

        # --- G. CS (Chip Select) Power ---
        # Low duty cycle, active low usually.
        p_pin_cs = calc_power_drop_across_term(inputs.vddq, inputs.r_on_host, inputs.r_tt_ca)
        total_cs = (
            p_pin_cs 
            * inputs.cs_util 
            * inputs.prob_cmd_zero 
            * num_cs 
            * inputs.num_subchannels
        )

        # ---------------------------------------------------
        # 3. Aggregation
        # ---------------------------------------------------
        total_power = (
            total_dq_write + 
            total_dq_read + 
            total_ca + 
            total_ck + 
            total_wck + 
            total_dqs + 
            total_cs
        )

        return {
            "P_DQ_WRITE": total_dq_write,
            "P_DQ_READ": total_dq_read,
            "P_CA": total_ca,
            "P_CK": total_ck,
            "P_WCK": total_wck,
            "P_DQS": total_dqs,
            "P_CS": total_cs,
            "P_total_interface": total_power
        }



    # ***** PART 2 *****    
    # Estimates DDR5 interface dynamic (switching) power using a simple capacitive model per wire/group

    # Formula: P = N * (C_total * V^2 * f * a)
    # N: number of pins/wires
    # C: effective capacitance per net
    # f: signal clock freqency, some signals are sent at different data rate, like only on rising edge
    # alpha: expected toggle probability
    # V: voltage swing, for POD it may be Vddq/2, for full swing it may be Vddq.

    # returns breakdown of dynamic power per signal group and total dynamic power for the interface.


    def calc_interface_dynamic_power_swing(
        self,
        inputs: InterfacePowerInputs,
        # Capacitance defaults taken from the paper's example:
        # C_TX=1pF, C_RX=1pF, C_TL=2pF  => C_eq=4pF per net
        c_eq_f_per_net: float = 4e-12,
        # Voltage swing assumptions: For POD-style lines start with vddq/2; for full-swing use vddq.
        v_swing_data: Optional[float] = None,
        v_swing_cmd: Optional[float] = None,
        v_swing_ck:  Optional[float] = None,
        v_swing_dqs: Optional[float] = None,
        v_swing_wck: Optional[float] = None,
        # CA width assumption for DDR5 UDIMM per subchannel
        ca_bits_per_subch: int = 14,
    ) -> Dict[str, float]:

        # Default swings
        if v_swing_data is None: v_swing_data = inputs.vddq / 2.0
        if v_swing_cmd  is None: v_swing_cmd  = inputs.vddq / 2.0
        if v_swing_ck   is None: v_swing_ck   = inputs.vddq
        if v_swing_dqs  is None: v_swing_dqs  = inputs.vddq / 2.0
        if v_swing_wck  is None: v_swing_wck  = v_swing_ck

        # --- Derive per-subchannel pin counts (match calculate_termination_power()) ---
        pins = self._derive_pin_counts_per_subchannel(inputs, ca_bits_per_subch=ca_bits_per_subch)
        dq_bits_per_subch = pins["num_dq_bits"]
        ca_bits_per_subch = pins["num_ca_bits"]
        cs_bits_per_subch = pins["num_cs_bits"]
        ck_pairs_per_subch = pins["ck_pairs"]
        dqs_pairs_per_subch = pins["dqs_pairs"]
        wck_pairs_per_subch = pins["wck_pairs"]

        # --- Signal counts (wires) ---
        n_dq_wires_subch = dq_bits_per_subch
        n_ca_wires_subch = ca_bits_per_subch
        n_cs_wires_subch = cs_bits_per_subch
        n_ck_wires_subch = ck_pairs_per_subch * 2
        n_dqs_wires_subch = dqs_pairs_per_subch * 2
        n_wck_wires_subch = wck_pairs_per_subch * 2

        n_dq_wires = inputs.num_subchannels * n_dq_wires_subch
        n_ca_wires = inputs.num_subchannels * n_ca_wires_subch
        n_cs_wires = inputs.num_subchannels * n_cs_wires_subch
        n_ck_wires = inputs.num_subchannels * n_ck_wires_subch
        n_dqs_wires = inputs.num_subchannels * n_dqs_wires_subch
        n_wck_wires = inputs.num_subchannels * n_wck_wires_subch

        # --- Opportunity frequencies ---
        # DQ opportunity rate = data_rate_hz (UI rate)
        data_rate_hz = inputs.data_rate_hz
        f_dq  = data_rate_hz

        # CA typically transfers at CK rate (1 per CK edge/cycle depending on encoding).
        # A common quick approximation: f_ca = f_ck = data_rate_hz/2 for DDR.
        f_ck = data_rate_hz / 2.0
        f_ca = f_ck
        f_cs = f_ck
        f_wck = f_ck

        # DQS toggles with burst traffic; treat opportunity like DQ but gated by rd/wr duty.
        f_dqs = data_rate_hz

        # --- Toggle probabilities (alpha) ---
        # TODO: explain assumption here
        alpha_data = 0.5
        alpha_cmd  = 0.5

        # Ideal clock: toggles every half-period. In CV^2 f form we already used f_ck (cycles/sec),
        # so alpha_ck should represent toggles per cycle. A square wave has 2 toggles/cycle.
        alpha_ck = 2.0

        # DQS is like a strobe; in bursts it’s square-like. Same convention as CK:
        alpha_dqs = 2.0
        alpha_wck = 2.0

        # --- Power calculations ---
        # Utilization multipliers (use inputs directly; no clamping/min/max).
        util_rd = inputs.rd_duty
        util_wr = inputs.wr_duty
        util_dq = util_rd + util_wr
        util_dqs = util_dq
        util_wck = util_wr
        util_ca = inputs.ca_util
        util_cs = inputs.cs_util
        util_ck = inputs.ck_util

        def p_group(n_wires: int, util: float, alpha: float, f: float, v_swing: float) -> float:
            return float(n_wires) * util * alpha * f * c_eq_f_per_net * (v_swing ** 2)

        p_dq_subch = p_group(n_dq_wires_subch, util_dq, alpha_data, f_dq, v_swing_data)
        p_ca_subch = p_group(n_ca_wires_subch, util_ca, alpha_cmd, f_ca, v_swing_cmd)
        p_cs_subch = p_group(n_cs_wires_subch, util_cs, alpha_cmd, f_cs, v_swing_cmd)
        p_ck_subch = p_group(n_ck_wires_subch, util_ck, alpha_ck, f_ck, v_swing_ck)
        p_dqs_subch = p_group(n_dqs_wires_subch, util_dqs, alpha_dqs, f_dqs, v_swing_dqs)
        p_wck_subch = p_group(n_wck_wires_subch, util_wck, alpha_wck, f_wck, v_swing_wck)

        p_dq = p_dq_subch * inputs.num_subchannels
        p_ca = p_ca_subch * inputs.num_subchannels
        p_cs = p_cs_subch * inputs.num_subchannels
        p_ck = p_ck_subch * inputs.num_subchannels
        p_dqs = p_dqs_subch * inputs.num_subchannels
        p_wck = p_wck_subch * inputs.num_subchannels

        p_total = p_dq + p_ca + p_cs + p_ck + p_dqs + p_wck

        out: Dict[str, float] = {
            "P_dyn_total_W": p_total,
            "P_dyn_dq_W": p_dq,
            "P_dyn_ca_W": p_ca,
            "P_dyn_cs_W": p_cs,
            "P_dyn_ck_W": p_ck,
            "P_dyn_dqs_W": p_dqs,
            "P_dyn_wck_W": p_wck,
            "P_dyn_total_interface": p_total,
            "P_dyn_total_subch_W": (p_dq_subch + p_ca_subch + p_cs_subch + p_ck_subch + p_dqs_subch + p_wck_subch),
        }
        return out
    
    
    def compute(self, memspec: MemSpec, workload: Workload) -> Dict[str, float]:
        arch = memspec.memarchitecturespec
        num_subchannels = 2

        # Many provided specs use `nbrOfDevices` as devices-per-subchannel for x{width}.
        # Infer full devices-per-rank accordingly (so x8: 4 per subch => 8 per rank).
        device_width_bits = arch.width
        nbr_of_devices_field = arch.nbrOfDevices
        expected_per_subch = 32 // device_width_bits
        if nbr_of_devices_field == expected_per_subch:
            devices_per_rank = nbr_of_devices_field * num_subchannels
        else:
            devices_per_rank = nbr_of_devices_field

        inputs = InterfacePowerInputs(
            vdd=memspec.mempowerspec.vdd,
            vddq=memspec.mempowerspec.vddq,
            num_subchannels=num_subchannels,
            device_width_bits=arch.width,
            devices_per_rank=devices_per_rank,
            num_ranks=arch.nbrOfRanks,
            rd_duty=workload.RDsch_percent / 100.0,
            wr_duty=workload.WRsch_percent / 100.0,
            data_rate_hz = (1.0 / memspec.memtimingspec.tCK) * 2.0,  # DDR: data rate is 2x clock rate
        )

        termination = self.calculate_termination_power(inputs)
        dynamic = self.calc_interface_dynamic_power_swing(inputs)

        p_term = float(termination.get("P_total_interface", 0.0))
        p_dyn = float(dynamic.get("P_dyn_total_interface", dynamic.get("P_dyn_total_W", 0.0)))

        merged: Dict[str, float] = {}
        merged.update(termination)
        merged.update(dynamic)
        merged["P_total_interface_term"] = p_term
        merged["P_total_interface_dyn"] = p_dyn
        merged["P_total_interface"] = p_term + p_dyn
        return merged
