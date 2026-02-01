from typing import Dict, Optional
from parser import load_memspec, load_workload
from collections import Counter

from interface_model import InterfacePowerModel, InterfacePowerInputs
from core_model import DDR5CorePowerModel
from ddr5 import DDR5

"""
using this hypothetical config for now
Density	        16 GB
Organization	1Rx8
DRAM Count	    8 Chips
Die Density	    16 Gb (Gigabit)
Voltage (VDD/VDDQ)	1.1V
Speed/Frequency	    4800 - 5600 MT/s
"""

class DIMM:
    def __init__(
        self,
        memspec,
        workload,
        dram_list,
        interface_model,
        interface_input
    ):
        self.memspec = memspec
        self.workload = workload

        self.corepower: Optional[Dict[str, float]] = None
        self.interfacepower: Optional[Dict[str, float]] = None
        self.totalpower: Optional[Dict[str, float]] = None
        self.interface_model: InterfacePowerModel = interface_model
        self.interface_input: InterfacePowerInputs = interface_input
        self.dram_list: list[DDR5] = dram_list


    @classmethod
    def load_specs(cls, memspec_path: str, workload_path: str):
        memspec = load_memspec(memspec_path)
        workload = load_workload(workload_path)
        dram_list = []
        print("DIMM.load_spec memspec_path =", memspec_path)
        ## FIXME: need to read from spec
        interface_input = InterfacePowerInputs(
            vdd=1.1,
            vddq=1.1,
            num_ca=14*2,
            num_cs=1,
            rd_duty=0.15, # from workload
            wr_duty=0.07, # from workload
            ca_util=0.15, # FIXME: invenetd, wr+rd
            cs_util=0.22, # FIXME: invenetd
        )

        core_model = DDR5CorePowerModel()
        interface_model = InterfacePowerModel()

        ## FIXME: need to make sure number of device is actually the number device
        for i in range(0, memspec.memarchitecturespec.nbrOfDevices):
            dram = DDR5(memspec, workload, core_model=core_model)
            dram_list.append(dram)
            print(dram_list)

        return cls(memspec, workload, dram_list=dram_list, interface_model=interface_model, interface_input=interface_input)
    
    def compute_all(self) -> Dict[str, float]:
        if self.dram_list is not None:
            for dram in self.dram_list:
                # Counter allows dicts to be added together
                self.corepower = dict(Counter(self.corepower) + Counter(dram.compute_core()))
        else:
            raise ValueError("No DRAM devices")
        
        self.interfacepower = self.interface_model.compute_all(self.interface_input)
        total = Counter(self.corepower) + Counter(self.interfacepower)
        total["P_total"] = self.corepower["P_total_core"] + self.interfacepower["P_total_interface"]
        self.totalpower = dict(total)
        return self.totalpower

    
    def report_dram_power(self, index):
        self.dram_list[index].report_power()
    
    def report_dimm_power(self):
        if self.corepower is None or self.interfacepower is None:
            raise RuntimeError("Must call compute_all() before report_power()")

        print("\n================ DIMM POWER REPORT ================\n")

        # ---- MemSpec summary ----
        arch = self.memspec.memarchitecturespec
        print("Memory:", self.memspec.memoryId)
        print("Type:", self.memspec.memoryType)
        print(f"Device width: x{arch.width}")
        print(f"Banks: {arch.nbrOfBanks}  |  Bank Groups: {arch.nbrOfBankGroups}")
        print(f"Rows: {arch.nbrOfRows}  |  Columns: {arch.nbrOfColumns}")
        print(f"Ranks: {arch.nbrOfRanks}  |  # of Chips: {arch.nbrOfDevices}")

        # ---- Core power ----
        print("---- Core Power Breakdown (W) ----")
        for k in [
            "P_PRE_STBY_core",
            "P_ACT_STBY_core",
            "P_ACT_PRE_core",
            "P_RD_core",
            "P_WR_core",
            "P_REF_core",
            "P_VDD_core",
            "P_VPP_core",
            "P_total_core",
        ]:
            if k in self.corepower:
                print(f"{k:22s}: {self.corepower[k]:.4f}")
        print()

        # ---- Interface power ----
        print("---- Interface / I/O Power Breakdown (W) ----")
        for k in [
            "P_driver_read",
            "P_term_read_others",
            "P_receiver_write",
            "P_term_write_others",
            "P_total_interface",
        ]:
            if k in self.interfacepower:
                print(f"{k:22s}: {self.interfacepower[k]:.4f}")
        print()

        # ---- Totals ----
        print("---- Total ----")
        print(f"P_total_core      (W): {self.totalpower['P_total_core']:.4f}")
        print(f"P_total_interface (W): {self.totalpower['P_total_interface']:.4f}")
        print(f"P_TOTAL           (W): {self.totalpower['P_total']:.4f}")
        print("\n===================================================\n")