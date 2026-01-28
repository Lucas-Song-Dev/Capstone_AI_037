from typing import Dict, Optional
from parser import load_memspec, load_workload, MemSpec, Workload

from interface_model import DDR5InterfacePowerModel
from core_model import DDR5CorePowerModel


class DDR5:
    def __init__(
        self,
        memspec,
        workload,
        core_model=None,
        interface_model=None,
    ):
        self.memspec = memspec
        self.workload = workload
        self.core_model = core_model
        self.interface_model = interface_model

        self.corepower: Optional[Dict[str, float]] = None
        self.interfacepower: Optional[Dict[str, float]] = None
        self.totalpower: Optional[Dict[str, float]] = None

    @classmethod
    def from_json_files(cls, memspec_path: str, workload_path: str, core_model=None, interface_model=None):
        memspec = load_memspec(memspec_path)
        workload = load_workload(workload_path)
        return cls(memspec, workload, core_model=core_model, interface_model=interface_model)

    def compute_core(self) -> Dict[str, float]:
        if self.core_model is None:
            raise ValueError("core_model is None")
        self.corepower = self.core_model.compute(self.memspec, self.workload)
        return self.corepower

    def compute_interface(self) -> Dict[str, float]:
        if self.interface_model is None:
            raise ValueError("interface_model is None")
        self.interfacepower = self.interface_model.compute(self.memspec, self.workload)
        return self.interfacepower

    def compute_all(self) -> Dict[str, float]:
        core = self.compute_core()
        interface = self.compute_interface()

        # Merge (namespace to avoid key collisions)
        merged = {}
        merged.update({f"core.{k}": v for k, v in core.items()})
        merged.update({f"if.{k}": v for k, v in interface.items()})

        # Optional totals if both models provide totals
        core_total = core.get("P_total_core", 0.0)
        if_total = interface.get("P_total_interface", 0.0)
        merged["P_total_core"] = core_total
        merged["P_total_interface"] = if_total
        merged["P_total"] = core_total + if_total

        self.totalpower = merged
        
        return merged
    
    def report_power(self):
        if self.corepower is None or self.interfacepower is None:
            raise RuntimeError("Must call compute_all() before report_power()")

        print("\n================ DDR5 POWER REPORT ================\n")

        # ---- MemSpec summary ----
        arch = self.memspec.memarchitecturespec
        print("Memory:", self.memspec.memoryId)
        print("Type:", self.memspec.memoryType)
        print(f"Device width: x{arch.width}")
        print(f"Banks: {arch.nbrOfBanks}  |  Bank Groups: {arch.nbrOfBankGroups}")
        print(f"Rows: {arch.nbrOfRows}  |  Columns: {arch.nbrOfColumns}")
        print()

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
