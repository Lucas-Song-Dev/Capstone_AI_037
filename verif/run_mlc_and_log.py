import subprocess
import re
import sys
import time
import keyboard
import os

def run_mlc_test(workload_id=5, duration=30, buffer_size="128m"):
    """
    Triggers Intel MLC and returns the bandwidth in MB/s.
    workload_id: 6 (only writes), 5 (1:1 Mix of reads and writes)
    duration: Seconds to run (allow HWiNFO to stabilize)
    """
    
    # Path to mlc executable
    # located in mlc_v3.12/Linux/mlc:
    mlc_path = os.getcwd() 
    mlc_path = os.path.join(mlc_path, "mlc_v3.12", "Linux")
    mlc_bin = "mlc" if sys.platform != "win32" else "mlc.exe"
    
    mlc_bin = os.path.join(mlc_path, mlc_bin)

    # -d0: zero delay (maximum saturation)
    # -e: do not modify prefetcher settings
    # -r: random accesses to beat prefetchers

    cmd = [
        "sudo",
        mlc_bin, 
        "--loaded_latency", 
        f"-W{workload_id}", 
        f"-t{duration}", 
        f"-b{buffer_size}",
        "-d0",
        "-e",
        "-r"
    ]

    print("Running MLC command: " + " ".join(cmd))
    
    try:
        # Run command and capture output
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        output = result.stdout

        # Regex to find the total bandwidth. 
        # ^\s*00000    -> Start of line, optional whitespace, followed by '00000'
        # \s+[\d\.]+   -> Whitespace followed by the latency number (e.g., 620.34)
        # \s+          -> Whitespace separating latency and bandwidth
        # ([\d\.]+)    -> Capturing group for the bandwidth number
        pattern = r"00000\s+[\d\.]+\s+([\d\.]+)"

        match = re.search(pattern, output)

        if match:
            bandwidth = float(match.group(1))
            print(f"Extracted Bandwidth: {bandwidth} MB/s")
        else:
            print("Bandwidth not found.")
        
        if match:
            bandwidth_mbs = float(match.group(1))
            return bandwidth_mbs
        else:
            print("Could not parse bandwidth. Output was:\n", output)
            return None

    except subprocess.CalledProcessError as e:
        print(f"Error: MLC failed. Did you run as Admin/Sudo?\n{e.stderr}")
        return None
    except FileNotFoundError:
        print(f"Error: {mlc_bin} not found in path.")
        return None

def get_ideal_max_bandwidth(mt_s, channels=2, bus_width_bits=64):
    # max bandwidth is MT/s * (bus width in bytes) * number of channels
    return mt_s * (bus_width_bits / 8) * channels

def analyze_system_utilization(ram_mt_s, channels=2):
    theo_max = get_ideal_max_bandwidth(ram_mt_s, channels)
    print(f"Theoretical Max Bandwidth: {theo_max:,.2f} MB/s")
    print("-" * 50)

    # Test reads and writes
    rw_bw = run_mlc_test(workload_id=5, duration=20)
    if rw_bw:
        util = (rw_bw / theo_max) * 100
        print(f"READ  Utilization: {util:.2f}% ({rw_bw:,.2f} MB/s)")
        print(f"--> Use this % as input RDsch_percent in workload.json.")

    time.sleep(5) # Brief cool down

    # Test Writes (I_DD4W)
    w_bw = run_mlc_test(workload_id=6, duration=20)
    if w_bw:
        util = (w_bw / theo_max) * 100
        print(f"WRITE Utilization: {util:.2f}% ({w_bw:,.2f} MB/s)")
        print(f"--> Use this % as input WRsch_percent in workload.json.")

if __name__ == "__main__":
    print("Please start HWInfo logging now (shortcut: Ctrl+Shift+L).")
    input("\n>>> Press ENTER once HWInfo logging has started...")
    print("\nRunning MLC tests:")
    analyze_system_utilization(ram_mt_s=5600, channels=2)
    print("\nPlease stop HWInfo logging now (shortcut: Ctrl+Shift+L).")
    input("\n>>> Press ENTER once HWInfo logging has stopped...")

