from ddr5 import DDR5
from dimm import DIMM
from interface_model import DDR5InterfacePowerModel
from core_model import DDR5CorePowerModel

from visualizer import plot_power

def main():
    memspec_path = "../workloads/micron_16gb_ddr5_6400_x8_spec.json"
    workload_path = "../workloads/workload.json"

    # @TODO option for LPDDR5CorePowerModel()
    core_model = DDR5CorePowerModel()
    interface_model = DDR5InterfacePowerModel()

    dimm = DIMM.load_specs(
        memspec_path,
        workload_path
    )

    dimm.compute_all()
    dimm.report_dimm_power()

    # Calculate just one DRAM chip
    # sys = DDR5.load_spec(
    #     memspec_path,
    #     workload_path,
    #     core_model=core_model,
    #     interface_model=interface_model,
    # )

    # sys.compute_all()
    # sys.report_power()


if __name__ == "__main__":
    main()