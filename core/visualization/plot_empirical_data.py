import os
import csv
import numpy as np
import matplotlib.pyplot as plt

labels_list = []
time_data_list = []
power_data_list = []

def load_empirical_data(csv_path, plot=False):
    """
    Load empirical power data from HWiNFO CSV output
    Returns: (time_array, power_array) in numpy arrays
    
    Processes HWiNFO CSV format:
    - Column 0: Timestamp
    - Column 8: Memory Power (W) - column for "Total Power"
    """
    if not os.path.exists(csv_path):
        return None, None
    
    time_data = []
    power_data = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            
            # Skip header row
            next(reader, None)
            
            first_timestamp = None
            for row in reader:
                if len(row) < 9:
                    continue
                    
                try:
                    # Parse timestamp (HWiNFO format: "DD/MM/YYYY HH:MM:SS.mmm")
                    timestamp_str = row[0].strip()
                    
                    # Parse power value from column 8 (0-indexed)
                    power_str = row[8].strip()
                    power_w = float(power_str)
                    
                    if first_timestamp is None:
                        first_timestamp = 0
                        time_data.append(0.0)
                    else:
                        # Increment time (HWiNFO samples every 2 seconds)
                        time_data.append(len(time_data) * 2.0)
                    
                    power_data.append(power_w)
                    
                except (ValueError, IndexError):
                    continue
        
        if (plot):
            # plot the data to verify it looks correct in a bar chart:
            plt.figure(figsize=(10, 5))
            plt.plot(time_data, power_data, label="Empirical Power (W)")
            plt.xlabel("Time (s)")
            plt.ylabel("Power (W)")
            plt.title("Empirical Power Data from HWiNFO")
            plt.legend()
            plt.grid(True)
            plt.show()

        return np.array(time_data), np.array(power_data)
    
    except Exception as e:
        print(f"Error loading empirical data: {e}")
        return None, None
    
if __name__ == "__main__":
    # Example usage
    csvs = []

    import argparse
    
    parser = argparse.ArgumentParser(description="Plot empirical power data from HWiNFO CSV output")
    parser.add_argument("--empirical-data", nargs="+", type=str,
                       help="Path(s) to HWiNFO CSV file with empirical power measurements")
    
    args = parser.parse_args()
    
    if not args.empirical_data:
        print("Error: Please provide paths to at least one empirical data .csv file using the --empirical-data argument.")
        exit(1)

    for csv_path in args.empirical_data:
        time_data, power_data = load_empirical_data(csv_path)
        labels_list.append(os.path.basename(csv_path))
        if time_data is not None and power_data is not None:
            time_data_list.append(time_data)
            power_data_list.append(power_data)
        else:
            print(f"Failed to load data from {csv_path}")

    # plot all loaded datasets together 
    plt.figure(figsize=(10, 5))
    for time_data, power_data, label in zip(time_data_list, power_data_list, labels_list):
        plt.plot(time_data, power_data, label=label)
    plt.xlabel("Time (s)")
    plt.xticks(np.arange(0, 20, 2))
    plt.ylabel("Power (W)")
    plt.title("Empirical Power Data from HWiNFO")
    plt.legend()
    plt.grid(True)
    plt.show()