from typing import Dict, Optional
from parser import load_memspec, load_workload

class DDR5:
    def __init__(
        self,
        memspec,
        workload,
        core_model=None,
    ):
        self.memspec = memspec
        self.workload = workload
        self.core_model = core_model

        self.corepower: Optional[Dict[str, float]] = None
    
    def compute_core(self) -> Dict[str, float]:
        if self.core_model is None:
            raise ValueError("core_model is None")
        self.corepower = self.core_model.compute(self.memspec, self.workload)
        return self.corepower


    
    def report_power(self):
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