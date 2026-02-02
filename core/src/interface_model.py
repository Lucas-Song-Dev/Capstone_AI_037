from dataclasses import dataclass
from typing import Dict, Optional
from parser import MemSpec, Workload


class DDR5InterfacePowerModel:
    """
    DDR5 DRAM *interface* power model

    It models three pieces (per DRAM device):
      - READ:  active device driver power  (pdq_rd)
              + non-active device termination (pdq_rd_oth) scaled by #other devices
      - WRITE: target device receiver/termination power (pdq_wr)
              + non-active device termination (pdq_wr_oth) scaled by #other devices
    """

    def infer_pdq(self):
        # Table 26: Nominal I/O Termination Power Consumption
        pdq_rd_mw = 11.73     # mW per terminated signal (DRAM READ, driver)
        pdq_rd_oth_mw = 4.00  # mW per terminated signal (DRAM READ, other devices)
        pdq_wr_mw = 4.15      # mW per terminated signal (DRAM WRITE, receiver)
        pdq_wr_oth_mw = 6.44  # mW per terminated signal (DRAM WRITE, other devices)

        return pdq_rd_mw / 1000, pdq_rd_oth_mw / 1000, pdq_wr_mw / 1000, pdq_wr_oth_mw / 1000 



    def compute(self, memspec: MemSpec, workload: Workload) -> Dict[str, float]:
        duty_rd = workload.RDsch_percent / 100.0
        duty_wr = workload.WRsch_percent / 100.0

        dq = memspec.memarchitecturespec.width
        num_DQR = dq + dq / 4
        num_DQW = num_DQR + 1

        num_other = max(0, memspec.memarchitecturespec.nbrOfDevices - 1)

        pdq_rd, pdq_rd_oth, pdq_wr, pdq_wr_oth = self.infer_pdq()

        # JEDEC-style power equations
        P_driver_read = pdq_rd * num_DQR * duty_rd
        P_term_read_others = pdq_rd_oth * num_DQR * num_other * duty_rd

        P_receiver_write = pdq_wr * num_DQW * duty_wr
        P_term_write_others = pdq_wr_oth * num_DQW * num_other * duty_wr

        P_total_interface = (
            P_driver_read
            + P_term_read_others
            + P_receiver_write
            + P_term_write_others
        )

        return {
            # Inputs/derived
            "dq_per_device": float(dq),
            "num_dqr": float(num_DQR),
            "num_dqw": float(num_DQW),
            "num_other_devices": float(num_other),
            "duty_rd": float(duty_rd),
            "duty_wr": float(duty_wr),

            # Breakdown (W)
            "P_driver_read": P_driver_read,
            "P_term_read_others": P_term_read_others,
            "P_receiver_or_term_write": P_receiver_write,
            "P_term_write_others": P_term_write_others,
            "P_total_interface": P_total_interface,
        }
