import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent.parent / "src"))

print("Python sys.path:", sys.path)

import numpy as np
import matplotlib
matplotlib.use('Qt5Agg') # make plt.show() work in wsl/vscode
import matplotlib.pyplot as plt
from DDR5 import DDR5

def get_column_from_csv(file_path, column_index):
    """
    Load a specific column from a CSV file into a NumPy array.

    Parameters:
    - file_path: str, path to the CSV file
    - column_index: int, index of the column to load (0-based)

    Returns:
    - numpy.ndarray containing the data from the specified column
    """
    column_data = np.genfromtxt(file_path, delimiter=',', usecols=column_index, dtype=None, skip_header=1)
    return column_data

def get_baseline_power(file_path):
    power_data = get_column_from_csv(file_path, 9)  # Assuming total power is in column index 9
    baseline_power = np.min(power_data)
    return baseline_power

def main():
    csv_file_path = 'memory.csv'

    time_column = 1
    total_power_column = 9 

    time_data = get_column_from_csv(csv_file_path, time_column)
    print(time_data)

    # the time data increments in 2 seconds, so create a new array with length equal to time_data
    time_data = np.arange(0, len(time_data) * 2, 2)
    print(time_data)

    total_power_data = get_column_from_csv(csv_file_path, total_power_column)
    print(total_power_data)

    baseline_power = get_baseline_power(csv_file_path)
    print(f"Baseline Power: {baseline_power} W")

    # plot time vs total power
    plt.plot(time_data, total_power_data)
    plt.xlabel('Time (s)')
    plt.ylabel('Total Power (W)')
    plt.title('Time vs Total Power')
    plt.grid(True)
    # plt.show()

    # get estimate from our tool
    ddr5 = DDR5()

    memspec_json = "../workloads/micron_16gb_ddr5_6400_x8_spec.json"
    workload_json = "../workloads/workload.json"
    
    ddr5.load_parameters(memspec_json, workload_json)

    result = ddr5.ddr5_core_power()

    print("P_VDD_core (W):", result["P_VDD_core"])
    print("P_VPP_core (W):", result["P_VPP_core"])
    print("P_total_core (W):", result["P_total_core"])

    print ("Estimated Total Power (W):", result["P_total_core"])
    print ("Difference from Baseline (W):", result["P_total_core"] - baseline_power)

    if (baseline_power <= result["P_total_core"]):
        print("PASS: Estimated power is greater than or equal to baseline power.")
    else:
        print("FAIL: Estimated power is less than baseline power.")

if __name__ == "__main__":
    main()