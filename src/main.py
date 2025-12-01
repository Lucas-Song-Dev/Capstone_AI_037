from parser import load_memspec, load_workload
from ddr5 import ddr5


def main():
    # load memspec dataclass, workload dataclass
    memspec = "../workloads/micron_16gb_ddr5_6400_x8_spec.json"
    workload = "../workloads/workload.json"
    model = ddr5.from_json_files(memspec, workload)
    result = model.compute_corepower()
    model.report_power()


if __name__ == "__main__":
    main()
