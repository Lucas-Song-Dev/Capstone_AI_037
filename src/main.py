from ddr5 import ddr5
from visualizer import plot_power

def main():
    memspec = "../workloads/micron_16gb_ddr5_6400_x8_spec.json"
    workload = "../workloads/workload.json"
    model = ddr5.from_json_files(memspec, workload)
    result = model.compute_corepower()
    model.report_power()
    plot_power(result)

if __name__ == "__main__":
    main()