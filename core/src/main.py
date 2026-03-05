import os
from ddr5 import DDR5
from lpddr5 import LPDDR5
from dimm import DIMM
from interface_model import DDR5InterfacePowerModel
from core_model import DDR5CorePowerModel
from lpddr5_core_model import LPDDR5CorePowerModel
from lpddr5_interface_model import LPDDR5InterfacePowerModel

from visualizer import plot_power

def main():
    # get paths to memspec and workload
    import argparse
    from parser import load_memspec
    
    parser = argparse.ArgumentParser(description="DDR5/LPDDR5 Power Model")
    parser.add_argument("--memspec", type=str,
                       help="Path to memspec JSON file with IDD values and architectural parameters")
    parser.add_argument("--workload", type=str,
                       help="Path to workload JSON file with activity breakdowns")
    
    args = parser.parse_args()

    memspec_path = (os.path.abspath(args.memspec) if args.memspec else "../workloads/micron_16gb_ddr5_6400_x8_spec.json")
    workload_path = (os.path.abspath(args.workload) if args.workload else "../workloads/workload.json")

    # Auto-detect memory type from spec file
    try:
        memspec = load_memspec(memspec_path)
        memory_type = memspec.mempowerspec.memoryType
    except:
        memory_type = "DDR5"  # Default to DDR5 if detection fails

    # Instantiate appropriate model based on memory type
    if memory_type in ("LPDDR5", "LPDDR5X"):
        print(f"Detected {memory_type} memory type")
        core_model = LPDDR5CorePowerModel()
        interface_model = LPDDR5InterfacePowerModel()
        dimm = DIMM.load_specs(
            memspec_path,
            workload_path,
            core_model=core_model,
            interface_model=interface_model,
            dram_cls=LPDDR5,
        )
    else:
        print(f"Detected DDR5 memory type")
        core_model = DDR5CorePowerModel()
        interface_model = DDR5InterfacePowerModel()
        dimm = DIMM.load_specs(
            memspec_path,
            workload_path,
            core_model=core_model,
            interface_model=interface_model
        )

    dimm.compute_all()
    dimm.report_dimm_power()


if __name__ == "__main__":
    main()