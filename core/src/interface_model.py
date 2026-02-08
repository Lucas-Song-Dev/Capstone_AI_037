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
    num_subchannels: int = 2        # DDR5 DIMM: typically 2 subchannels per channel
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
    ca_util: float = 0.15           # Command bus utilization
    cs_util: float = 0.05           # Chip Select utilization
    ck_util: float = 1.00           # Clock is typically always running if CKE is High

    # --- Signal Probabilities (0.0 to 1.0) ---
    # Probability of signal being '0' (Low).
    # Since DDR5 is POD (Pseudo Open Drain), power is only consumed when signal is Low.
    # With DBI (Data Bus Inversion), '0' count is minimized, typically <= 0.5.
    prob_data_zero: float = 0.5     # For random data
    prob_cmd_zero: float = 0.5      # For random commands
    prob_clock_toggle: float = 0.5  # Clocks are 50% duty cycle

# ==========================================
# Main Calculation Logic
# ==========================================
class DDR5InterfacePowerModel:
    def calculate_termination_power(self, inputs: InterfacePowerInputs) -> Dict[str, float]:
        """
        Calculates termination power components for DDR5 based on JEDEC principles.
        Returns power in Watts (W).
        """

        # ---------------------------------------------------
        # 1. Derive Pin Counts (per Sub-channel)
        # ---------------------------------------------------
        # DQ: Data lines (e.g., 32 bits per subchannel)
        num_dq = 32 
        
        # DQS: Data Strobe (Differential pairs). 1 pair per byte (8 bits)
        # x8 device needs 1 DQS pair. Total 4 pairs for 32 bits.
        # 4 pairs * 2 wires = 8 pins
        num_dqs = (num_dq // 8) * 2 
        
        # CA: Command/Address. DDR5 is 14 pins (7 pins x 2 for DDR) or similar depending on mode.
        # Assuming 14 pins per subchannel for simplicity.
        num_ca = 14
        
        # CS: Chip Select. Default to num_ranks if not provided.
        # Based on JESD308B logic where each rank has a dedicated CS pin.
        if inputs.num_cs is None:
            num_cs = inputs.num_ranks
        else:
            num_cs = inputs.num_cs
        
        # CK: System Clock (Differential). 1 pair per subchannel = 2 pins.
        num_ck = 2

        # WCK: Write Clock (DDR5 specific). Differential.
        # Typically 1 pair per nibble or byte depending on frequency/mode.
        # Assuming 1 pair per byte -> 4 pairs -> 8 pins.
        num_wck = (num_dq // 8) * 2

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
    # Dynamic power based on switching activity: toggling on transmission lines.

    # Formula: P = N * (C_total * V^2 * f * a)
    # N: number of pins
    # C: total input capacitance
    # f: signal clock freqency, some signals are sent at different data rate, like only on rising edge
    # a: activity factor, how often it actually toggles.
    
    # ***** Note on PMIC ***** 
    # In DDR5, the PMIC is on the DIMM chip, it takes 5V from mother board and step down to 1.1V required by the chip.

    # Total DIMM power = sum of all internal power(dram+interface+dimm) / PMIC efficiency. 
    # '''


    def compute_dynamic(self, input: InterfacePowerInputs) -> Dict[str, float]:

        ## temporary capacitance for dimm
        c_dq  = 3.5e-12    # 3.5 pF (Pin + Trace)
        c_ca  = 8.0e-12    
        c_ck  = 12.0e-12   
        c_dqs = 3.5e-12    

        # f_clock = Data Rate / 2 (e.g., 4800 MT/s -> 2.4 GHz), 
        # FIXME: maybe front side and back side have different clock frequency
        f_clock = (4800 / 2) * 1e6 
        # CA bus in DDR5 runs at 1/2 clock speed (1.2 GHz)
        f_ca = f_clock / 2 
        
        v2 = input.vddq ** 2
        
        # DQ: Toggle probability = 0.5. Active during Read + Write
        num_dq = 32
        P_DQ_dyn = (num_dq * c_dq * v2 * f_clock) * 0.5 * (input.rd_duty + input.wr_duty)
        
        # CA: Toggle probability = 0.5. Active based on CA utilization
        num_ca = 14
        P_CA_dyn = (num_ca * c_ca * v2 * f_ca) * 0.5 * input.ca_util
        
        # CK (Clock): Differential (2 wires), Toggles every cycle (alpha=1.0)
        # Always running as long as the DIMM is powered.
        num_ck = 2
        P_CK_dyn = (num_ck * 2) * (c_ck * v2 * f_clock) * 1.0
        
        # DQS (Strobe): Differential (2 wires), Toggles every cycle during data bursts.
        num_dqs = (num_dq // 8) * 2 
        P_DQS_dyn = (num_dqs * 2) * (c_dqs * v2 * f_clock) * (input.rd_duty + input.wr_duty)
        
        total = P_DQ_dyn + P_CA_dyn + P_CK_dyn + P_DQS_dyn

        return {
            "P_DQ_dyn": P_DQ_dyn,
            "P_CA_dyn": P_CA_dyn,
            "P_CK_dyn": P_CK_dyn,
            "P_DQS_dyn": P_DQS_dyn,
            "P_Total_Dynamic": total
        }

    def compute(self, memspec: MemSpec, workload: Workload) -> Dict[str, float]:

        input = InterfacePowerInputs(
            vddq=memspec.mempowerspec.vddq,
            rd_duty=workload.RDsch_percent/100,
            wr_duty=workload.WRsch_percent/100,
            ca_util=0.15,
            cs_util=0.22,
        )
        termination = self.calculate_termination_power(input)
        dynamic = self.compute_dynamic(input)

        return termination
