import numpy as np
import matplotlib
matplotlib.use('Qt5Agg') # Or 'TkAgg', 'WxAgg', etc.
import matplotlib.pyplot as plt

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

    # plot time vs total power
    plt.plot(time_data, total_power_data)
    plt.xlabel('Time (s)')
    plt.ylabel('Total Power (mW)')
    plt.title('Time vs Total Power')
    plt.grid(True)
    plt.show()


if __name__ == "__main__":
    main()