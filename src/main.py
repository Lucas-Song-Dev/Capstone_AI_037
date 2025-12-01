from parser import parse_memspec_json, normalize_workload
import json
from DDR5 import DDR5

def main() -> None:
    ddr5 = DDR5()

    memspec_json = "../workloads/micron_16gb_ddr5_6400_x8_spec.json"
    workload_json = "../workloads/workload.json"

    ddr5.load_parameters(memspec_json, workload_json)

    result = ddr5.ddr5_core_power()

    print("P_VDD_core (W):", result["P_VDD_core"])
    print("P_VPP_core (W):", result["P_VPP_core"])
    print("P_total_core (W):", result["P_total_core"])

if __name__ == "__main__":
    main()
