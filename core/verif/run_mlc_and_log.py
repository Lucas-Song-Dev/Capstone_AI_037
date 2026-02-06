import subprocess
import re
import sys
import time
import keyboard
import os

def run_mlc_test(mlc_path, workload_argument="-W5", duration=30, buffer_size="128m"):
    """
    Triggers Intel MLC and returns the bandwidth in MB/s.
    workload_argument: -W5 (1:1 Mix of reads and writes), -R (100% read traffic)
    duration: Seconds to run (allow HWiNFO to stabilize)
    """
    
    # Path to mlc executable
    mlc_path = os.path.abspath(mlc_path)

    # -d0: zero delay (maximum saturation)
    # -e: don't change prefetcher settings
    # -r: random accesses to beat prefetchers

    cmd = [
        "sudo", mlc_path, "--loaded_latency", f"-t{duration}", f"-b{buffer_size}", "-d0", "-e", "-r"
    ]

    cmd.append(f"{workload_argument}")

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
        print(f"Error: {mlc_path} not found in path.")
        return None

def get_ideal_max_bandwidth(mt_s, channels=2, bus_width_bits=64):
    # max bandwidth is MT/s * (bus width in bytes) * number of channels
    return mt_s * (bus_width_bits / 8) * channels

def analyze_system_utilization(mlc_path, ram_mt_s, channels=2):
    theo_max = get_ideal_max_bandwidth(ram_mt_s, channels)
    print(f"Theoretical Max Bandwidth: {theo_max:,.2f} MB/s")
    print("-" * 50)

    # Test reads and writes
    rw_bw = run_mlc_test(mlc_path=mlc_path, workload_argument="-W5", duration=20)
    if rw_bw:
        util = (rw_bw / theo_max) * 100
        print(f"RD/WR Bandwidth as percentage: {util:.2f}% ({rw_bw:,.2f} MB/s)")
        print(f"--> Use this % as input RDsch_percent and/or WRsch_percent in workload.json.")

    time.sleep(10) # wait before next test to allow HWiNFO to stabilize

    r_bw = run_mlc_test(mlc_path=mlc_path, workload_argument="-R", duration=20)
    if r_bw:
        util = (r_bw / theo_max) * 100
        print(f"RD Bandwidth as percentage: {util:.2f}% ({r_bw:,.2f} MB/s)")
        print(f"--> Use this % as input RDsch_percent in workload.json, set WRsch_percent to 0.")

    time.sleep(10) # wait before next test to allow HWiNFO to stabilize

    # idle test, just run for 20 seconds with no stimulus
    print("Running idle test for 20 seconds. Please do not interact with the system during this time.")
    time.sleep(20)
    print("Idle test complete. You can now interact with the system.")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Run Intel MLC and log with HWiNFO.")
    parser.add_argument("--mlc-path", type=str,
                       help="Path to the MLC binary, relative to current directory when running.")
    args = parser.parse_args()

    if not args.mlc_path:
        print("Error: Please provide --mlc-path argument.")
        exit(1)

    print("Please start HWInfo logging now (shortcut: Ctrl+Shift+L).")
    input("\n>>> Press ENTER once HWInfo logging has started...")
    print("\nRunning MLC tests:")
    analyze_system_utilization(mlc_path=args.mlc_path, ram_mt_s=5600, channels=2)
    print("\nPlease stop HWInfo logging now (shortcut: Ctrl+Shift+L).")
    input("\n>>> Press ENTER once HWInfo logging has stopped...")

