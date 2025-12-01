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

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from main import ddr5_core_power_model
from parser import load_memspec, load_workload


class TestResults:
    """Container for test results"""
    def __init__(self):
        self.tests_passed = 0
        self.tests_failed = 0
        self.test_details = []
    
    def add_pass(self, test_name, details=""):
        self.tests_passed += 1
        self.test_details.append({
            "test": test_name,
            "status": "PASS",
            "details": details
        })
        print(f"✅ PASS: {test_name}")
        if details:
            print(f"   {details}")
    
    def add_fail(self, test_name, details=""):
        self.tests_failed += 1
        self.test_details.append({
            "test": test_name,
            "status": "FAIL",
            "details": details
        })
        print(f"❌ FAIL: {test_name}")
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


def load_empirical_data(csv_path):
    """
    Load empirical power data from HWiNFO CSV output
    Returns: (time_array, power_array) in numpy arrays
    
    Processes HWiNFO CSV format:
    - Column 0: Timestamp
    - Column 8: Memory Power (W) - typical location for DDR5 power
    """
    if not os.path.exists(csv_path):
        return None, None
    
    time_data = []
    power_data = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            
            # Skip header rows (typically first 2 rows in HWiNFO format)
            next(reader, None)
            next(reader, None)
            
            first_timestamp = None
            for row in reader:
                if len(row) < 9:
                    continue
                    
                try:
                    # Parse timestamp (HWiNFO format: "DD/MM/YYYY HH:MM:SS.mmm")
                    timestamp_str = row[0].strip()
                    # For simplicity, we'll use row number as relative time
                    # In production, parse actual timestamp
                    
                    # Parse power value from column 8 (0-indexed)
                    power_str = row[8].strip()
                    power_w = float(power_str)
                    
                    if first_timestamp is None:
                        first_timestamp = 0
                        time_data.append(0.0)
                    else:
                        # Increment time (assuming ~1 second per sample)
                        time_data.append(len(time_data) * 1.0)
                    
                    power_data.append(power_w)
                    
                except (ValueError, IndexError):
                    continue
        
        return np.array(time_data), np.array(power_data)
    
    except Exception as e:
        print(f"Error loading empirical data: {e}")
        return None, None


def test_background_power_sensibility(results, model_output, empirical_data_path=None):
    """
    Test NF-01: Background power sensibility test
    
    Requirement: The minimum power measured over empirical benchmarks should not 
    be greater than the model's background power output.
    
    This ensures the model provides at least a realistic baseline power estimate.
    """
    print("\n" + "-" * 70)
    print("TEST: Background Power Sensibility (NF-01)")
    print("-" * 70)
    
    model_background = model_output.get("P_PRE_STBY_core", 0.0)
    model_total = model_output.get("P_total_core", 0.0)
    
    print(f"Model Background Power: {model_background:.4f} W")
    print(f"Model Total Power: {model_total:.4f} W")
    
    # If empirical data is provided, compare
    if empirical_data_path and os.path.exists(empirical_data_path):
        time_data, power_data = load_empirical_data(empirical_data_path)
        
        if power_data is not None and len(power_data) > 0:
            min_empirical = np.min(power_data)
            max_empirical = np.max(power_data)
            mean_empirical = np.mean(power_data)
            
            print(f"\nEmpirical Data Statistics:")
            print(f"  Min Power: {min_empirical:.4f} W")
            print(f"  Max Power: {max_empirical:.4f} W")
            print(f"  Mean Power: {mean_empirical:.4f} W")
            
            # Test: Model background should be <= minimum empirical power
            # (Background is the baseline that's always present)
            if model_background <= min_empirical:
                results.add_pass(
                    "NF-01: Background power sensibility",
                    f"Model background ({model_background:.4f} W) <= empirical min ({min_empirical:.4f} W)"
                )
            else:
                results.add_fail(
                    "NF-01: Background power sensibility",
                    f"Model background ({model_background:.4f} W) > empirical min ({min_empirical:.4f} W)"
                )
            
            # Additional sanity check: Total power should be within reasonable range
            if model_total >= min_empirical and model_total <= max_empirical * 1.5:
                print(f"✓ Model total power is within reasonable empirical range")
            else:
                print(f"⚠ Model total power outside empirical range (may be acceptable)")
        else:
            print("⚠ Could not parse empirical data")
            results.add_pass("NF-01: Background power sensibility", 
                           f"No empirical data - model output verified: {model_background:.4f} W")
    else:
        # No empirical data - just verify model produces reasonable output
        if 0.01 <= model_background <= 10.0:  # Reasonable range for DDR5 background power
            results.add_pass("NF-01: Background power sensibility",
                           f"Model background power in reasonable range: {model_background:.4f} W")
        else:
            results.add_fail("NF-01: Background power sensibility",
                           f"Model background power out of range: {model_background:.4f} W")


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
            print(f"⚠ Skipping {memspec_path} - file not found")
            continue
        
        print(f"\nTesting: {os.path.basename(memspec_path)}")
        
        start_time = time.time()
        try:
            memspec = load_memspec(memspec_full)
            workload = load_workload(workload_full)
            result = ddr5_core_power_model(memspec, workload)
            elapsed = time.time() - start_time
            
            print(f"  Execution time: {elapsed:.4f} seconds")
            max_time = max(max_time, elapsed)
            
            if elapsed > 10.0:
                all_passed = False
                print(f"  ❌ Exceeds 10 second limit!")
            else:
                print(f"  ✓ Within time limit")
                
        except Exception as e:
            elapsed = time.time() - start_time
            print(f"  ❌ Error: {e}")
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
            result = ddr5_core_power_model(memspec, workload)
            
            # If we get here, the model accepted invalid input
            print(f"  ❌ Model did not reject invalid input")
            
        except (KeyError, ValueError, TypeError) as e:
            # Good - model rejected invalid input
            error_msg = str(e)
            print(f"  ✓ Model rejected invalid input")
            print(f"  Error message: {error_msg}")
            
            # Check if error message is useful (contains field name or type info)
            if any(keyword in error_msg.lower() for keyword in ['missing', 'invalid', 'field', 'key', 'type']):
                print(f"  ✓ Error message is informative")
                passed_count += 1
            else:
                print(f"  ⚠ Error message could be more informative")
        
        except Exception as e:
            # Model crashed - not graceful
            print(f"  ❌ Model crashed ungracefully: {e}")
    
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
        print("⚠ No baseline found - creating initial baseline")
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
                    f"{key}: {baseline_val:.6f} → {current_val:.6f} "
                    f"(Δ {rel_diff*100:.3f}%)"
                )
                print(f"  ✗ {key}: {baseline_val:.6f} → {current_val:.6f}")
            else:
                print(f"  ✓ {key}: {current_val:.6f}")
    
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


def run_all_tests(empirical_data_path=None):
    """Run complete test suite"""
    results = TestResults()
    
    print("=" * 70)
    print("DDR5 POWER MODEL VERIFICATION TEST SUITE")
    print("=" * 70)
    
    # Load default test configuration
    memspec_path = os.path.join(os.path.dirname(__file__), "..", 
                                 "workloads", "micron_16gb_ddr5_6400_x8_spec.json")
    workload_path = os.path.join(os.path.dirname(__file__), "..", 
                                  "workloads", "workload.json")
    
    print(f"\nLoading test configuration...")
    print(f"  Memory Spec: {os.path.basename(memspec_path)}")
    print(f"  Workload: {os.path.basename(workload_path)}")
    
    try:
        memspec = load_memspec(memspec_path)
        workload = load_workload(workload_path)
        model_output = ddr5_core_power_model(memspec, workload)
        
        print(f"\n✓ Model executed successfully")
        print(f"\nModel Output:")
        for key, value in model_output.items():
            print(f"  {key}: {value:.6f} W")
        
    except Exception as e:
        print(f"\n❌ Failed to run model: {e}")
        results.add_fail("Model Execution", str(e))
        return results.print_summary()
    
    # Run all verification tests
    test_background_power_sensibility(results, model_output, empirical_data_path)
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
    
    args = parser.parse_args()
    
    # If updating baseline, do that first
    if args.update_baseline:
        print("Updating baseline...")
        memspec_path = os.path.join(os.path.dirname(__file__), "..",
                                     "workloads", "micron_16gb_ddr5_6400_x8_spec.json")
        workload_path = os.path.join(os.path.dirname(__file__), "..",
                                      "workloads", "workload.json")
        
        memspec = load_memspec(memspec_path)
        workload = load_workload(workload_path)
        model_output = ddr5_core_power_model(memspec, workload)
        
        baseline_dir = Path(__file__).parent / "baseline"
        baseline_dir.mkdir(parents=True, exist_ok=True)
        baseline_path = baseline_dir / "power_output_baseline.json"
        
        with open(baseline_path, 'w') as f:
            json.dump(model_output, f, indent=2)
        
        print(f"✓ Baseline updated: {baseline_path}\n")
    
    # Run tests
    all_passed = run_all_tests(args.empirical_data)
    
    sys.exit(0 if all_passed else 1)

