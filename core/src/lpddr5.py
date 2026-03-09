from typing import Dict, Optional
from parser import load_memspec, load_workload


class LPDDR5:
    """
    LPDDR5 memory system model with 4 voltage rails (VDD1, VDD2H, VDD2L, VDDQ).
    
    Similar structure to DDR5 but with:
    - No VPP rail (no wordline pump)
    - Multiple VDD rails for different power domains
    - Lower operating voltages optimized for mobile
    """
    
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

    @classmethod
    def load_spec(cls, memspec_path: str, workload_path: str, core_model=None):
        """Load LPDDR5 specification and workload from JSON files."""
        memspec = load_memspec(memspec_path)
        workload = load_workload(workload_path)
        return cls(memspec, workload, core_model=core_model)

    def compute_core(self) -> Dict[str, float]:
        """Compute core power for LPDDR5."""
        if self.core_model is None:
            raise ValueError("core_model is None")
        self.corepower = self.core_model.compute(self.memspec, self.workload)
        return self.corepower

    def report_power(self):
        """Print LPDDR5 core power report."""
        if self.corepower is None:
            raise RuntimeError("Must call compute_core() before report_power()")
        
        print("\n" + "="*60)
        print("LPDDR5 Device Core Power Report")
        print("="*60)

        arch = self.memspec.memarchitecturespec
        print("Memory:", self.memspec.memoryId)
        print("Type:", self.memspec.memoryType)
        print(f"Device width: x{arch.width}")
        print(f"Banks: {arch.nbrOfBanks}  |  Bank Groups: {arch.nbrOfBankGroups}")
        print(f"Rows: {arch.nbrOfRows}  |  Columns: {arch.nbrOfColumns}")
        print()
        
        # ---- Core power ----
        print("--- Core Power Breakdown (W) ---")
        # Display in consistent order
        for k in [
            "P_PRE_STBY_core",
            "P_ACT_STBY_core",
            "P_background",
            "P_ACT_PRE_core",
            "P_RD_core",
            "P_WR_core",
            "P_REF_core",
            "P_SELFREF",
            "P_VDD1",
            "P_VDD2H",
            "P_VDD2L",
            "P_VDDQ",
            "P_total_core",
        ]:
            if k in self.corepower:
                print(f"  {k:25s}: {self.corepower[k]:12.6f}")
        
        print("="*60 + "\n")
