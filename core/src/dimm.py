from typing import Dict, Optional
from parser import load_memspec, load_workload

from interface_model import DDR5InterfacePowerModel
from core_model import DDR5CorePowerModel
from ddr5 import DDR5

class DIMM:
    def __init__(
        self,
        memspec,
        workload,
        dram_list,
        interface_model: Optional[DDR5InterfacePowerModel] = None,
    ):
        self.memspec = memspec
        self.workload = workload

        self.corepower: Optional[Dict[str, float]] = None
        self.interfacepower: Optional[Dict[str, float]] = None
        self.totalpower: Optional[Dict[str, float]] = None

        self.dram_list = dram_list
        self.interface_model = interface_model

    @classmethod
    def load_specs(cls, memspec_path: str, workload_path: str, core_model=None, interface_model=None, dram_cls=DDR5):
        memspec = load_memspec(memspec_path)
        workload = load_workload(workload_path)

        if core_model is None:
            core_model = DDR5CorePowerModel()
        if interface_model is None:
            interface_model = DDR5InterfacePowerModel()

        dimm = cls.from_memspec(
            memspec,
            workload,
            core_model=core_model,
            interface_model=interface_model,
            dram_cls=dram_cls,
        )
        return dimm

    def _infer_devices_per_rank(device_width_bits: int, nbr_of_devices_field: int, num_subchannels: int) -> int:
        """
        Infer devices-per-rank for a full DDR5 DIMM.

        Many of the provided JSON specs set `nbrOfDevices` to the number of devices needed to make a 32-bit subchannel (e.g., x8 => 4 devices). 
        In that case, the full DIMM (two subchannels) has `nbrOfDevices * num_subchannels` devices per rank.

        Returns the inferred number of devices per RANK
        """
        expected_per_subch = 32 // device_width_bits
        if nbr_of_devices_field == expected_per_subch:
            return nbr_of_devices_field * num_subchannels
        if nbr_of_devices_field == expected_per_subch * num_subchannels:
            return nbr_of_devices_field

        return nbr_of_devices_field


    @classmethod
    def from_memspec(
        cls,
        memspec,
        workload,
        core_model: Optional[DDR5CorePowerModel] = None,
        interface_model: Optional[DDR5InterfacePowerModel] = None,
        dram_cls=DDR5,
        num_subchannels: int = 2,
    ):
        core_model = core_model or DDR5CorePowerModel()
        interface_model = interface_model or DDR5InterfacePowerModel()

        arch = memspec.memarchitecturespec
        devices_per_rank = cls._infer_devices_per_rank(
            device_width_bits=arch.width,
            nbr_of_devices_field=arch.nbrOfDevices,
            num_subchannels=int(num_subchannels),
        )
        num_ranks = arch.nbrOfRanks
        total_devices = devices_per_rank * num_ranks

        # generate a list of DRAM devices for the DIMM
        # if some device are running at different frequencies, we could extend this to take a list of memspecs and workloads per device
        dram_list = [dram_cls(memspec, workload, 
                      core_model=core_model,
                      interface_model=interface_model) for _ in range(total_devices)]

        # Note that interface power is computed once per DIMM, not per device, since it's a shared bus property.
        return cls(memspec, workload, dram_list, interface_model=interface_model)
    
    def compute_all(self) -> Dict[str, float]:
        if self.dram_list is None:
            raise ValueError("No DRAM devices")
        if self.interface_model is None:
            raise ValueError("interface_model is None")

        def add_dicts(d1, d2):
            keys = set(d1.keys()) | set(d2.keys())
            return {k: d1.get(k, 0.0) + d2.get(k, 0.0) for k in keys}

        # Core power is per-DRAM-device; aggregate over devices on the DIMM.
        for dram in self.dram_list:
            self.corepower = add_dicts(self.corepower or {}, dram.compute_core())

        # Interface power is a shared bus/topology property; compute once per DIMM.
        self.interfacepower = self.interface_model.compute(self.memspec, self.workload)

        core_total = float((self.corepower or {}).get("P_total_core", 0.0))
        if_total = float((self.interfacepower or {}).get("P_total_interface", 0.0))

        merged: Dict[str, float] = {}
        merged.update({f"core.{k}": v for k, v in (self.corepower or {}).items()})
        merged.update({f"if.{k}": v for k, v in (self.interfacepower or {}).items()})
        merged["P_total_core"] = core_total
        merged["P_total_interface"] = if_total
        merged["P_total"] = core_total + if_total

        self.totalpower = merged
        return merged
    
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
        print(f"Ranks: {arch.nbrOfRanks}  |  # of DRAM devices (modeled): {len(self.dram_list)}")

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
        print("  [Static / Termination]")
        for k in [
            "P_DQ_WRITE",
            "P_DQ_READ",
            "P_CA",
            "P_CK",
            "P_WCK",
            "P_DQS",
            "P_CS",
        ]:
            if k in self.interfacepower:
                print(f"{k:22s}: {self.interfacepower[k]:.4f}")
        if "P_total_interface_term" in self.interfacepower:
            print(f"{'P_total_interface_term':22s}: {self.interfacepower['P_total_interface_term']:.4f}")
        print()

        print("  [Dynamic / CV^2 f]")
        for k in [
            "P_dyn_dq_W",
            "P_dyn_ca_W",
            "P_dyn_cs_W",
            "P_dyn_ck_W",
            "P_dyn_dqs_W",
            "P_dyn_wck_W",
        ]:
            if k in self.interfacepower:
                print(f"{k:22s}: {self.interfacepower[k]:.4f}")
        if "P_total_interface_dyn" in self.interfacepower:
            print(f"{'P_total_interface_dyn':22s}: {self.interfacepower['P_total_interface_dyn']:.4f}")
        print()

        if "P_total_interface" in self.interfacepower:
            print(f"{'P_total_interface':22s}: {self.interfacepower['P_total_interface']:.4f}")
        print()

        # ---- Totals ----
        print("---- Total(W) ---- ")
        print(f"P_total_core          : {self.totalpower['P_total_core']:.4f}")
        print(f"P_total_interface     : {self.totalpower['P_total_interface']:.4f}")
        print(f"P_TOTAL               : {self.totalpower['P_total']:.4f}")
        print("\n===================================================\n")
