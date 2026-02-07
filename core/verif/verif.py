"""
Verification test suite for DDR5 Power Model
Tests actual power calculations against requirements and empirical data
"""

import sys
import os
import csv
import time
import json
from pathlib import Path
import numpy as np
import matplotlib.pyplot as plt

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from interface_model import DDR5InterfacePowerModel
from dimm import DIMM
from ddr5 import DDR5
from core_model import DDR5CorePowerModel
from parser import load_memspec, load_workload


class TestResults:
    """Container for test results"""
    def __init__(self):
        self.tests_passed = 0
        self.tests_failed = 0
        self.test_details = []
        self.plot = False
    
    def add_pass(self, test_name, details=""):
        self.tests_passed += 1
        self.test_details.append({
            "test": test_name,
            "status": "PASS",
            "details": details
        })
        print(f"[PASS] {test_name}")
        if details:
            print(f"   {details}")
    
    def add_fail(self, test_name, details=""):
        self.tests_failed += 1
        self.test_details.append({
            "test": test_name,
            "status": "FAIL",
            "details": details
        })
        print(f"[FAIL] {test_name}")
        if details:
            print(f"   {details}")
    
    def print_summary(self):
        total = self.tests_passed + self.tests_failed
        print("\n" + "=" * 70)
        print("TEST SUMMARY")
        print("=" * 70)
        print(f"Total Tests: {total}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_failed}")
        print(f"Pass Rate: {100 * self.tests_passed / total if total > 0 else 0:.1f}%")
        print("=" * 70)
        return self.tests_failed == 0


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


def test_background_power_sensibility(results, model_output_map, empirical_data_path, testname):
    """
    Test NF-01: Background power sensibility test
    
    Requirement: The minimum power measured over empirical benchmarks should not 
    be greater than the model's background power output.
    
    This ensures the model provides at least a realistic baseline power estimate.

    Parameters:
    - results: TestResults object to record pass/fail
    - model_output_map: Map from memspec name to model output dict, which includes "core.P_PRE_STBY_core" for background power
    - empirical_data_path: Path to HWiNFO CSV file with empirical power measurements
    - testname: Name of the test scenario for labeling
    """
    print("\n" + "-" * 70)
    print(f"TEST: Background Power Sensibility (NF-01) - {testname}")
    print("-" * 70)

    time_data, power_data = load_empirical_data(empirical_data_path)
    
    if power_data is not None and len(power_data) > 0:
        min_empirical = np.min(power_data)
        max_empirical = np.max(power_data)
        mean_empirical = np.mean(power_data)
        
        print(f"\nEmpirical Data Statistics:")
        print(f"  Min Power: {min_empirical:.4f} W")
        print(f"  Max Power: {max_empirical:.4f} W")
        print(f"  Mean Power: {mean_empirical:.4f} W")
    else:
        print("[WARN] Could not parse empirical data")
        results.add_fail("NF-01: Background power sensibility", 
                    f"No empirical data found!")
        return
    
    memspec_names = []
    background_powers = []
    total_powers = []

    for memspec_name, model_output in model_output_map.items():
    
        model_background = model_output.get("core.P_PRE_STBY_core", 0.0)
        memspec_names.append(memspec_name)
        background_powers.append(model_background)
        model_total = model_output.get("core.P_total_core", 0.0)
        total_powers.append(model_total)
        
        print(f"Model Background Power ({memspec_name}): {model_background:.4f} W")
        print(f"Model Total Power ({memspec_name}): {model_total:.4f} W")
        
    # Test (a): Check empirical power is between min and max model background powers with some tolerance (since empirical data can be noisy and model is not expected to be exact)
    if (mean_empirical >= np.min(background_powers)*0.95) and (mean_empirical <= np.max(background_powers)*1.05):
        results.add_pass(
            "NF-01: Background power sensibility",
            f"Empirical mean ({mean_empirical:.4f} W) is between model background min ({np.min(background_powers):.4f} W) and max ({np.max(background_powers):.4f} W)"
        )
    else:
        results.add_fail(
            "NF-01: Background power sensibility",
            f"Empirical mean ({mean_empirical:.4f} W) is NOT between model background min ({np.min(background_powers):.4f} W) and max ({np.max(background_powers):.4f} W)"
        )

    # plot a bar chart for each entry in background_powers, and on the same figure plot the horizontal line for mean_empirical:
    if results.plot:
        fig, ax = plt.subplots()
        background_power_bars = ax.bar(memspec_names, background_powers, alpha=1, label="Model Background Power", zorder=2)
        # total_power_bars = ax.bar(memspec_names, total_powers, alpha=1, label="Model Total Power", zorder=0)
        ax.set(ylabel='Background Power (W)', title='Background Power by Memspec', ylim=(0, max(background_powers) * 1.2))
        ax.bar_label(background_power_bars, fmt='{:,.3f} W')
        # ax.bar_label(total_power_bars, fmt='{:,.3f} W')
        plt.axhline(mean_empirical, color='r', linestyle='--', linewidth=4, label=f"Empirical Mean ({mean_empirical:.3f} W)")
        plt.title(f"Model Background Power vs Empirical Mean Power ({testname} Scenario)")
        plt.legend()
        plt.show()

def test_runtime_performance(results):
    """
    Test NF-02: Runtime performance test
    
    Requirement: Model must produce output in less than 10 seconds for any test scenario.
    This ensures the tool is responsive and practical for interactive use.
    """
    print("\n" + "-" * 70)
    print("TEST: Runtime Performance (NF-02)")
    print("-" * 70)
    
    test_scenarios = [
        ("workloads/micron_16gb_ddr5_6400_x8_spec.json", "workloads/workload.json"),
        ("workloads/samsung_16gb_ddr5_4800_x8_spec.json", "workloads/workload.json"),
    ]
    
    all_passed = True
    max_time = 0.0
    
    for memspec_path, workload_path in test_scenarios:
        # Convert to absolute path
        memspec_full = os.path.join(os.path.dirname(__file__), "..", memspec_path)
        workload_full = os.path.join(os.path.dirname(__file__), "..", workload_path)
        
        if not os.path.exists(memspec_full):
            print(f"[SKIP] {memspec_path} - file not found")
            continue
        
        print(f"\nTesting: {os.path.basename(memspec_path)}")
        
        start_time = time.time()
        try:
            dimm = DIMM.load_specs(
                memspec_full,
                workload_full
            )

            result = dimm.compute_all()
            elapsed = time.time() - start_time
            
            print(f"  Execution time: {elapsed:.4f} seconds")
            max_time = max(max_time, elapsed)
            
            if elapsed > 1.0:
                all_passed = False
                print(f"  [FAIL] Exceeds 1 second limit!")
            else:
                print(f"  [OK] Within time limit")
                
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"  [ERROR] {e}")
            all_passed = False
    
    if all_passed:
        results.add_pass("NF-02: Runtime performance",
                        f"All scenarios completed in < 10s (max: {max_time:.4f}s)")
    else:
        results.add_fail("NF-02: Runtime performance",
                        f"One or more scenarios exceeded 10s limit")


def test_input_format_validation(results):
    """
    Test C-03: Input format specification test
    
    Requirement: Model must gracefully reject malformed inputs and provide
    useful error messages specifying which fields are missing or invalid.
    """
    print("\n" + "-" * 70)
    print("TEST: Input Format Validation (C-03)")
    print("-" * 70)
    
    test_dir = Path(__file__).parent / "test_inputs"
    test_dir.mkdir(exist_ok=True)
    
    # Create test cases with malformed JSON
    malformed_cases = [
        {
            "name": "missing_vdd",
            "content": {
                "memspec": {
                    "memoryId": "test",
                    "memoryType": "DDR5",
                    "memarchitecturespec": {
                        "width": 8, "nbrOfBanks": 16, "nbrOfBankGroups": 2,
                        "nbrOfRanks": 1, "nbrOfColumns": 1024, "nbrOfRows": 65536,
                        "burstLength": 8, "dataRate": 2
                    },
                    "mempowerspec": {
                        # Missing "vdd" field
                        "vpp": 1.8, "vddq": 1.1,
                        "idd0": 53.0, "idd2n": 49.0, "idd3n": 111.0,
                        "idd4r": 226.0, "idd4w": 262.0, "idd5b": 11539.0,
                        "idd6n": 50.0, "idd2p": 47.0, "idd3p": 110.0,
                        "ipp0": 9.0, "ipp2n": 8.0, "ipp3n": 8.0,
                        "ipp4r": 9.0, "ipp4w": 22.0, "ipp5b": 758.0,
                        "ipp6n": 8.0, "ipp2p": 8.0, "ipp3p": 8.0
                    },
                    "memtimingspec": {
                        "tCK": 0.000000156, "RAS": 260, "RCD": 136,
                        "RP": 136, "RFC1": 2560, "RFC2": 1920,
                        "RFCsb": 960, "REFI": 51200
                    }
                }
            }
        },
        {
            "name": "invalid_timing_value",
            "content": {
                "memspec": {
                    "memoryId": "test",
                    "memoryType": "DDR5",
                    "memarchitecturespec": {
                        "width": 8, "nbrOfBanks": 16, "nbrOfBankGroups": 2,
                        "nbrOfRanks": 1, "nbrOfColumns": 1024, "nbrOfRows": 65536,
                        "burstLength": 8, "dataRate": 2
                    },
                    "mempowerspec": {
                        "vdd": 1.1, "vpp": 1.8, "vddq": 1.1,
                        "idd0": 53.0, "idd2n": 49.0, "idd3n": 111.0,
                        "idd4r": 226.0, "idd4w": 262.0, "idd5b": 11539.0,
                        "idd6n": 50.0, "idd2p": 47.0, "idd3p": 110.0,
                        "ipp0": 9.0, "ipp2n": 8.0, "ipp3n": 8.0,
                        "ipp4r": 9.0, "ipp4w": 22.0, "ipp5b": 758.0,
                        "ipp6n": 8.0, "ipp2p": 8.0, "ipp3p": 8.0
                    },
                    "memtimingspec": {
                        "tCK": "invalid",  # Should be float
                        "RAS": 260, "RCD": 136, "RP": 136,
                        "RFC1": 2560, "RFC2": 1920, "RFCsb": 960, "REFI": 51200
                    }
                }
            }
        }
    ]
    
    passed_count = 0
    total_count = len(malformed_cases)
    
    for case in malformed_cases:
        test_file = test_dir / f"{case['name']}.json"
        
        # Write malformed JSON
        with open(test_file, 'w') as f:
            json.dump(case['content'], f, indent=2)
        
        print(f"\nTesting: {case['name']}")
        
        try:
            # Attempt to load and use the malformed spec
            memspec = load_memspec(str(test_file))
            workload_path = Path(__file__).parent / ".." / "workloads" / "workload.json"
            workload = load_workload(str(workload_path))
            core_model = DDR5CorePowerModel()
            result = DDR5(memspec, workload, core_model=core_model).compute_core()
            
            # If we get here, the model accepted invalid input
            print(f"  [FAIL] Model did not reject invalid input")
            
        except (KeyError, ValueError, TypeError) as e:
            # Good - model rejected invalid input
            error_msg = str(e)
            print(f"  [OK] Model rejected invalid input")
            print(f"  Error message: {error_msg}")
            
            # Check if error message is useful (contains field name or type info)
            if any(keyword in error_msg.lower() for keyword in ['missing', 'invalid', 'field', 'key', 'type']):
                print(f"  [OK] Error message is informative")
                passed_count += 1
            else:
                print(f"  [WARN] Error message could be more informative")
        
        except Exception as e:
            # Model crashed - not graceful
            print(f"  [ERROR] Model crashed ungracefully: {e}")
    
    if passed_count == total_count:
        results.add_pass("C-03: Input format validation",
                        f"All {total_count} malformed inputs handled gracefully")
    elif passed_count > 0:
        results.add_fail("C-03: Input format validation",
                        f"Only {passed_count}/{total_count} malformed inputs handled correctly")
    else:
        results.add_fail("C-03: Input format validation",
                        "Model did not gracefully handle malformed inputs")


def test_output_regression(results, model_output, baseline_path):
    """
    Test F-02: Regression validation test
    
    Requirement: Automated system should detect when code changes cause
    deviations in model output from baseline.
    """
    print("\n" + "-" * 70)
    print("TEST: Output Regression Validation (F-02)")
    print("-" * 70)
    
    baseline_file = Path(baseline_path)
    
    if not baseline_file.exists():
        print("[WARN] No baseline found - creating initial baseline")
        baseline_file.parent.mkdir(parents=True, exist_ok=True)
        with open(baseline_file, 'w') as f:
            json.dump(model_output, f, indent=2)
        results.add_pass("F-02: Regression validation",
                        "Baseline created - future runs will compare against this")
        return
    
    # Load baseline
    with open(baseline_file, 'r') as f:
        baseline = json.load(f)
    
    print("\nComparing with baseline:")
    differences = []
    tolerance = 0.0001  # 0.01% tolerance for floating point comparison
    
    for key in model_output.keys():
        current_val = model_output[key]
        baseline_val = baseline.get(key, None)
        
        if baseline_val is None:
            differences.append(f"New field: {key} = {current_val:.6f}")
            print(f"  + {key}: {current_val:.6f} (new)")
        else:
            rel_diff = abs(current_val - baseline_val) / (abs(baseline_val) + 1e-10)
            if rel_diff > tolerance:
                differences.append(
                    f"{key}: {baseline_val:.6f} -> {current_val:.6f} "
                    f"(Delta {rel_diff*100:.3f}%)"
                )
                print(f"  [DIFF] {key}: {baseline_val:.6f} -> {current_val:.6f}")
            else:
                print(f"  [OK] {key}: {current_val:.6f}")
    
    # Check for removed fields
    for key in baseline.keys():
        if key not in model_output:
            differences.append(f"Removed field: {key}")
            print(f"  - {key} (removed)")
    
    if differences:
        results.add_fail("F-02: Regression validation",
                        f"{len(differences)} difference(s) from baseline:\n" + 
                        "\n".join(f"    - {d}" for d in differences))
    else:
        results.add_pass("F-02: Regression validation",
                        "All outputs match baseline within tolerance")

# take a list of model outputs and compare against empirical data
# this will be used for the 50/50 rw, 100 r, and idle tests all the same
def test_total_power(results, model_output_map, empirical_data_path, testname):
    """
    Test NF-01: Total power sensibility test
    Requirement: The mean power measured over empirical benchmarks should be between the minimum and maximum model total power outputs across all memspecs.
    
    Parameters:
    - results: TestResults object to record pass/fail
    - model_output_map: Map from memspec name to model output dict, which includes "core.P_PRE_STBY_core" for background power
    - empirical_data_path: Path to HWiNFO CSV file with empirical power measurements
    """
    print("\n" + "-" * 70)
    print(f"TEST: Total Power Sensibility (NF-01) - {testname}")
    print("-" * 70)

    time_data, power_data = load_empirical_data(empirical_data_path)
    
    if power_data is not None and len(power_data) > 0:
        min_empirical = np.min(power_data)
        max_empirical = np.max(power_data)
        mean_empirical = np.mean(power_data)
        
        print(f"\nEmpirical Data Statistics:")
        print(f"  Min Power: {min_empirical:.4f} W")
        print(f"  Max Power: {max_empirical:.4f} W")
        print(f"  Mean Power: {mean_empirical:.4f} W")
    else:
        print("[WARN] Could not parse empirical data")
        results.add_fail("NF-01: Total power sensibility", 
                    f"No empirical data found!")
        return
    
    memspec_names = []
    total_powers = []

    for memspec_name, model_output in model_output_map.items():
    
        memspec_names.append(memspec_name)
        model_total = model_output.get("P_total", 0.0)
        total_powers.append(model_total)
        
        print(f"Model Total Power ({memspec_name}): {model_total:.4f} W")
        
    # Test (a): Check empirical power is between min and max model total powers, with some tolerance (since empirical data can be noisy and model is not expected to be exact)
    if (mean_empirical >= np.min(total_powers)*0.95) and (mean_empirical <= np.max(total_powers)*1.05):
        results.add_pass(
            "NF-01: Total power sensibility",
            f"Empirical mean ({mean_empirical:.4f} W) is between model total power min ({np.min(total_powers):.4f} W) and max ({np.max(total_powers):.4f} W)"
        )
    else:
        results.add_fail(
            "NF-01: Total power sensibility",
            f"Empirical mean ({mean_empirical:.4f} W) is NOT between model total power min ({np.min(total_powers):.4f} W) and max ({np.max(total_powers):.4f} W)"
        )

    # plot a bar chart for each entry in background_powers, and on the same figure plot the horizontal line for mean_empirical:
    if results.plot:
        fig, ax = plt.subplots()
        total_power_bars = ax.bar(memspec_names, total_powers, alpha=1, label="Model Total Power", zorder=0)
        ax.set(ylabel='Total Power (W)', title='Total Power by Memspec', ylim=(0, max(total_powers) * 1.2))
        ax.bar_label(total_power_bars, fmt='{:,.3f} W')
        plt.axhline(mean_empirical, color='r', linestyle='--', linewidth=4, label=f"Empirical Mean ({mean_empirical:.3f} W)")
        plt.title(f"Model Total Power vs Empirical Mean Power ({testname} Scenario)")
        plt.legend()
        plt.show()

def launch_empirical_test(results, memspecs, workload, empirical_data_path, test_function, testname):
    """
    Docstring for launch_empirical_test
    
    :param results: TestResults object to record pass/fail
    :param memspecs: A list of paths to each memspec file. This can be simply read from the memspec_paths.txt file generated at the start of run_all_tests.
    :param workload: The workload.json file corresponding to this empirical test
    :param empirical_data_path: The .csv file containing the time series data for this empirical test
    :param test_function: The function that will be called with this empirical data and workload/memspec to generate the pass/fail
    """
    # for this workload and corresponding empirical data path, generate the results from all memspec files (idd files)

    model_output_list = []
    model_memspec_list = []

    for memspec_path in memspecs:
        print(f"\nGetting model prediction for memspec: {os.path.basename(memspec_path)}")
        try:
            dimm = DIMM.load_specs(
                memspec_path,
                workload
            )

            model_output = dimm.compute_all()
            model_output_list.append(model_output)
            model_memspec_list.append(os.path.basename(memspec_path))
        except Exception as e:
            print(f"\n[ERROR] Failed to run model: {e}")
            results.add_fail("Model Execution", str(e))
            return results.print_summary()
    
    # once we have all the model outputs, launch the corresponding test function
    model_output_map = {memspec: output for memspec, output in zip(model_memspec_list, model_output_list)}

    test_function(results, model_output_map, empirical_data_path, testname)
        

def run_all_tests(empirical_data_path=None, plot=False):
    """Run complete test suite"""
    results = TestResults()
    results.plot = plot
    
    print("=" * 70)
    print("DDR5 POWER MODEL VERIFICATION TEST SUITE")
    print("=" * 70)

    test_inputs_dir = Path(os.path.dirname(__file__)) / "test_inputs"
    # read memspec_paths.txt into a list to pass to test launching helper function:
    with open(test_inputs_dir / "memspec_paths.txt", 'r') as f:
        memspec_paths = [line.strip() for line in f if line.strip()]

    assert(memspec_paths), "No memspec files found - cannot run tests"

    # helper function to get the workload.json and empirical_data_paths from each test folder:
    def get_workload_and_empirical(test_folder_name):
        test_dir = Path(os.path.dirname(__file__)) / "test_inputs" / test_folder_name
        # the file ending with *workload.json will be the workload file, and the .csv file will be the empirical data file
        workload_file = list(test_dir.glob("*workload.json"))
        empirical_file = list(test_dir.glob("*.csv"))
        return workload_file[0] if workload_file else None, empirical_file[0] if empirical_file else None

    # run background power sensibility test (use idle workload.json)
    workload_file, empirical_data_path = get_workload_and_empirical("idle_test")
    launch_empirical_test(results, memspec_paths, workload_file, empirical_data_path, test_background_power_sensibility, "IDLE")

    # run 50/50 read/write testcase
    workload_file, empirical_data_path = get_workload_and_empirical("50_50_rw_test")
    launch_empirical_test(results, memspec_paths, workload_file, empirical_data_path, test_total_power, "50/50 Read/Write")
    # run 100% read testcase
    workload_file, empirical_data_path = get_workload_and_empirical("100_read_test")
    launch_empirical_test(results, memspec_paths, workload_file, empirical_data_path, test_total_power, "100% Read")
    
    # Load default test configuration for the regression test to baseline
    memspec_path = os.path.join(os.path.dirname(__file__), "..", 
                                 "workloads", "micron_16gb_ddr5_6400_x8_spec.json")
    workload_path = os.path.join(os.path.dirname(__file__), "..", 
                                  "workloads", "workload.json")
    
    print(f"\nLoading test configuration for remaining tests...")
    print(f"  Memory Spec: {os.path.basename(memspec_path)}")
    print(f"  Workload: {os.path.basename(workload_path)}")
    
    try:
        dimm = DIMM.load_specs(
            memspec_path,
            workload_path
        )

        model_output = dimm.compute_all()
        
        print(f"\n[OK] Model executed successfully")
        print(f"\nModel Output:")
        for key, value in model_output.items():
            print(f"  {key}: {value:.6f} W")
        
    except Exception as e:
        print(f"\n[ERROR] Failed to run model: {e}")
        results.add_fail("Model Execution", str(e))
        return results.print_summary()
    
    # Run all other verification tests
    test_runtime_performance(results)
    test_input_format_validation(results)
    
    # Regression test against baseline
    baseline_dir = Path(__file__).parent / "baseline"
    baseline_path = baseline_dir / "power_output_baseline.json"
    test_output_regression(results, model_output, baseline_path)
    
    # Print summary
    return results.print_summary()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="DDR5 Power Model Verification Suite")
    parser.add_argument("--empirical-data", type=str,
                       help="Path to HWiNFO CSV file with empirical power measurements")
    parser.add_argument("--update-baseline", action="store_true",
                       help="Update the baseline with current model output")
    parser.add_argument("--update-memspec-paths", action="store_true",
                       help="Regenerate memspec_paths.txt with current memspec files in workloads directory")
    parser.add_argument("--plot", action="store_true",
                       help="Show plots for empirical data and model comparisons")
    
    args = parser.parse_args()
    
    # If updating baseline, do that first
    if args.update_baseline:
        print("Updating baseline...")
        memspec_path = os.path.join(os.path.dirname(__file__), "..",
                                     "workloads", "micron_16gb_ddr5_6400_x8_spec.json")
        workload_path = os.path.join(os.path.dirname(__file__), "..",
                                      "workloads", "workload.json")
        
        dimm = DIMM.load_specs(
            memspec_path,
            workload_path
        )

        model_output = dimm.compute_all()
        
        baseline_dir = Path(__file__).parent / "baseline"
        baseline_dir.mkdir(parents=True, exist_ok=True)
        baseline_path = baseline_dir / "power_output_baseline.json"
        
        with open(baseline_path, 'w') as f:
            json.dump(model_output, f, indent=2)
        
        print(f"[OK] Baseline updated: {baseline_path}\n")

    # Run tests
    if args.update_memspec_paths:
        print("Updating memspec_paths.txt with current memspec files in workloads directory...")
        # find all *spec.json files in workloads directory
        workloads_dir = Path(os.path.dirname(__file__)).parent / "workloads"
        test_inputs_dir = Path(os.path.dirname(__file__)) / "test_inputs"
        spec_files = list(workloads_dir.glob("*spec.json"))

        with open(test_inputs_dir / "memspec_paths.txt", 'w') as f:
            for spec in spec_files:
                f.write(str(spec.resolve()) + "\n")
        print("[OK] memspec_paths.txt updated.\n")

    all_passed = run_all_tests(args.empirical_data, args.plot)
    
    sys.exit(0 if all_passed else 1)
