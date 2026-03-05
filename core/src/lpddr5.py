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
    def load_spec(cls, memspec_path: str, workload_path: str, core_model=None, interface_model=None):
        """Load LPDDR5 specification and workload from JSON files."""
        memspec = load_memspec(memspec_path)
        workload = load_workload(workload_path)
        return cls(memspec, workload, core_model=core_model, interface_model=interface_model)

    def compute_core(self) -> Dict[str, float]:
        """Compute core power for LPDDR5."""
        if self.core_model is None:
            raise ValueError("core_model is None")
        self.corepower = self.core_model.compute(self.memspec, self.workload)
        return self.corepower

    def compute_interface(self) -> Dict[str, float]:
        """Compute interface power for LPDDR5."""
        if self.interface_model is None:
            raise ValueError("interface_model is None")
        self.interfacepower = self.interface_model.compute(self.memspec, self.workload)
        return self.interfacepower

    def compute_all(self) -> Dict[str, float]:
        """Compute total power (core + interface)."""
        core = self.compute_core()
        interface = self.compute_interface()

        # Merge with namespace to avoid key collisions
        merged = {}
        merged.update({f"core.{k}": v for k, v in core.items()})
        merged.update({f"if.{k}": v for k, v in interface.items()})

        # Optional totals if both models provide totals
        core_total = core.get("P_total_core", 0.0)
        if_total = interface.get("P_total_interface", 0.0)
        merged["P_total_system"] = core_total + if_total

        self.totalpower = merged
        return merged

    def report_power(self):
        """Print power report."""
        if self.totalpower is None:
            self.compute_all()
        
        print("\n" + "="*60)
        print("LPDDR5 Power Report")
        print("="*60)
        
        if self.corepower:
            print("\n--- Core Power ---")
            for key, val in self.corepower.items():
                print(f"  {key:25s}: {val:12.6f} W")
        
        if self.interfacepower:
            print("\n--- Interface Power ---")
            for key, val in self.interfacepower.items():
                print(f"  {key:25s}: {val:12.6f} W")
        
        if self.totalpower:
            print("\n--- Total Power ---")
            for key, val in self.totalpower.items():
                print(f"  {key:25s}: {val:12.6f} W")
        
        print("="*60 + "\n")
