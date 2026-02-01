from dataclasses import dataclass
from typing import Dict, Optional

def solve_power(v: float, R: float) -> float:
    return (v * v) / R

@dataclass
class InterfacePowerInputs:
    # Rails
    vdd: float                      # core / CA / CK rail
    vddq: float                     # IO rail for DQ/DQS/WCK

    # Topology
    num_subchannels: int = 2        # DDR5 DIMM: typically 2 subchannels per channel
    subchannel_width_bits: int = 32 # DDR5 subchannel data width (non-ECC)

    device_width_bits: int = 8      # x8 default
    num_ranks: int = 1              # ranks per DIMM/channel

    # Signal counts
    num_ca: Optional[int] = None    # total CA lines (per channel)
    num_cs: Optional[int] = None    # CS lines per channel (usually = num_ranks)

    # Fractions of time / utilization (0..1)
    rd_duty: float = 0.0
    wr_duty: float = 0.0
    ca_util: float = 0.15           # time CA is actively driven (time-based)
    cs_util: float = 0.15           # time CA is actively driven (time-based)

    # Toggle probabilities (0..1) — only use for dynamic/CV^2 f terms, not V^2/R termination
    toggle_data: float = 0.50
    toggle_ca: float = 0.50
    toggle_clk: float = 0.50
    toggle_dqs: float = 0.50

    # Ohms (RTT: effective termination resistance)
    r_ca: float = 80.0
    r_cs: float = 80.0
    r_ck: float = 50.0
    r_dq: float = 80.0
    r_dqs: float = 80.0
    r_wck: float = 50.0
    r_rdqs: float = 80.0


class InterfacePowerModel:
    """
    DDR5 DRAM *interface* power model: calculate two things: static termination power and dynamic switching power

    ***** PART 1 *****
    It models static on die termination power and driver power (read on the controller side) on the following lines:
    Power is found by P = V^2 / R * the number of pins * utility
    V: either vddq or vdd
    R: ODT resistance, detailed below
    Utility: the percentage of time the bus is active

    1. CA (Command/Address Bus)
        Number: each 32-bit subchannel has 14 CA pins and 2 CS pins. Times 2 for 2 subchannels.
        Resistance: ~80Ω parallel (pull-up/down to VDD/GND)
        Voltage: VDD 
        Activity: ~10-20% of bus bandwidth (only active during command phases)

    2. CS (Chip Select)
        Number: each 32-bit subchannel has 14 CA pins and 2 CS pins. Times 2 for 2 subchannels.
        For one rank dimm(1Rx8), only cs0 toggles. For 2 ranks(2Rx8), both toggles.
        Resistance: ~80-100Ω pull-up to VDD
        Voltage: VDD
        Activity: Pulsed during read/write operations (~6-8 out of 8 cycles when transaction active)
        Duty cycle: ~10-15% bus utilization

    3. CK (Clock)
        Number: 1 pair for each subchannel.
        Resistance: ~50Ω differential (series resistor on each line to virtual ground plane)
        Voltage: VDD
        Activity: 100% (always on when clock is running)

    4. DQ (Data)
        Number: the width of rank, 64 without ECC, 72 with ECC, 80 with RDIMM. 
        Resistance: ~80Ω parallel (pull-up/down to VDDQ or mid-supply)
        Voltage: VDDQ
        Activity: RD% + WR% of workload
        Power typical: 30-100 mW (depends on read/write activity)

    5. DQS (Data Strobe)
        Number: 1 dqs pair for every 8 DQ pins. 8x2 for 64 DQ pins.
        Resistance: ~80Ω parallel (typically on controller side)
        Voltage: VDDQ
        Activity: Toggling at 50% during READ or WRITE
        Power typical: 10-20 mW
    
    6. DM (data mask)
        Number: one DM pin for every 8 bits of data. 8 DM for 64 DIMM
    """

    def compute_termination(self, input: InterfacePowerInputs) -> Dict[str, float]:

        ## find the number of device and the device needs termination
        rank_bus_width_bits = input.num_subchannels * input.subchannel_width_bits
        devices_per_rank = rank_bus_width_bits // input.device_width_bits
        num_other_devices = devices_per_rank - 1

        # Per-device signal counts
        dq_bits_per_device = input.device_width_bits
        # FIXME: not sure if should treat as 1 or 1 pair, because only 1 is active.
        dqs_per_device = input.device_width_bits // 8 * 2 

        # CA (Command/Address)
        P_CA = input.num_ca * solve_power(input.vdd, input.r_ca) * input.ca_util

        # CS (Chip Select)
        P_CS = input.num_cs * solve_power(input.vdd, input.r_cs) * input.cs_util

        # FIXME: not sure if should treat as 1 or 1 pair, because only 1 is active. Do I need 2 separate pair for 2 subchannel
        # CK (Clock): 2 lines, always toggling when clock running.
        P_CK = 2.0 * solve_power(input.vdd, input.r_ck)
        # DQ (Data)
        P_DQ_READ_target = dq_bits_per_device * solve_power(input.vddq, input.r_dq) * input.rd_duty
        P_DQ_READ_others = dq_bits_per_device * num_other_devices * solve_power(input.vddq, input.r_dq) * input.rd_duty

        # WRITE: all devices (including target) terminate/receive during write (simple model)
        P_DQ_WRITE = dq_bits_per_device * devices_per_rank * solve_power(input.vddq, input.r_dq) * input.wr_duty

        # DQS
        P_DQS = dqs_per_device * solve_power(input.vddq, input.r_dqs) * (input.rd_duty + input.wr_duty)

        P_total = (P_CA + P_CS + P_CK + P_DQ_READ_target + P_DQ_READ_others + P_DQ_WRITE + P_DQS)

        return {
            "devices_per_rank": float(devices_per_rank),
            "num_other_devices": float(num_other_devices),
            "dq_bits_per_device": float(dq_bits_per_device),
            "dqs_per_device": float(dqs_per_device),

            # Per-interface powers (W)
            "P_CA": P_CA,
            "P_CS": P_CS,
            "P_CK": P_CK,
            "P_DQ_READ_target": P_DQ_READ_target,
            "P_DQ_READ_others": P_DQ_READ_others,
            "P_DQ_WRITE_all": P_DQ_WRITE,
            "P_DQS": P_DQS,

            "P_total_interface": P_total,
        }
    

    '''
    ***** PART 2 *****    
    Dynamic power based on switching activity: toggling on transmission lines.

    Formula: P = N * (C_total * V^2 * f * a)
    N: number of pins
    C: total input capacitance
    f: signal clock freqency, some signals are sent at different data rate, like only on rising edge
    a: activity factor, how often it actually toggles.
    
    ***** Note on PMIC ***** 
    In DDR5, the PMIC is on the DIMM chip, it takes 5V from mother board and step down to 1.1V required by the chip.

    Total DIMM power = sum of all internal power(dram+interface+dimm) / PMIC efficiency. 
    '''


    def compute_dynamic(self, input: InterfacePowerInputs) -> Dict[str, float]:
        return None
    
    def compute_all(self, input: InterfacePowerInputs) -> Dict[str, float]:
        termination = self.compute_termination(input)
        dynamic = self.compute_dynamic(input)

        return termination
