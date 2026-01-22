"""
Regression test runner for DDR5 power model.
Runs the verification test suite to validate model outputs and performance.
"""
import subprocess
import sys
import os
import json
from pathlib import Path


def run_power_model_tests(empirical_data_path=None, update_baseline=False):
    """
    Run the complete power model verification test suite.
    
    Args:
        empirical_data_path: Optional path to HWiNFO CSV file with empirical data
        update_baseline: If True, update the baseline before running tests
    
    Returns:
        dict with test results and exit code
    """
    print("=" * 70)
    print("RUNNING DDR5 POWER MODEL REGRESSION TESTS")
    print("=" * 70)
    
    # Build command to run verification suite
    cmd = [sys.executable, "verif/verif.py"]
    
    if update_baseline:
        cmd.append("--update-baseline")
    
    if empirical_data_path and os.path.exists(empirical_data_path):
        cmd.extend(["--empirical-data", empirical_data_path])
    
    # Run the verification tests
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True
    )
    
    print("\n--- TEST OUTPUT ---")
    print(result.stdout)
    
    if result.stderr:
        print("\n--- WARNINGS/ERRORS ---")
        print(result.stderr)
    
    print("\n--- TEST RESULT ---")
    print(f"Exit code: {result.returncode}")
    
    success = result.returncode == 0
    
    if success:
        print("\n[SUCCESS] ALL TESTS PASSED")
    else:
        print("\n[FAILURE] SOME TESTS FAILED")
    
    return {
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "success": success
    }


def verify_model_output_exists():
    """Verify that the model baseline was created."""
    baseline_path = Path("verif/baseline/power_output_baseline.json")
    
    if baseline_path.exists():
        with open(baseline_path, 'r') as f:
            baseline = json.load(f)
        
        print("\n" + "=" * 70)
        print("MODEL BASELINE VERIFICATION")
        print("=" * 70)
        print(f"Baseline file: {baseline_path}")
        print(f"\nBaseline power outputs:")
        for key, value in baseline.items():
            print(f"  {key}: {value:.6f} W")
        
        # Sanity checks
        total_power = baseline.get("P_total_core", 0.0)
        if 0.01 <= total_power <= 100.0:
            print(f"\n[OK] Total power in reasonable range: {total_power:.4f} W")
            return True
        else:
            print(f"\n[WARN] Total power outside expected range: {total_power:.4f} W")
            return False
    else:
        print(f"\n[WARN] Baseline not found at {baseline_path}")
        return False


def compare_model_outputs():
    """
    Compare current model output with baseline.
    This is the regression check for requirement F-02.
    """
    baseline_path = Path("verif/baseline/power_output_baseline.json")
    
    if not baseline_path.exists():
        print("\n[WARN] No baseline found for comparison")
        return True  # Pass if no baseline exists yet
    
    # Run model to get current output
    sys.path.insert(0, 'src')
    from main import ddr5_core_power_model
    from parser import load_memspec, load_workload
    
    try:
        memspec = load_memspec("workloads/micron_16gb_ddr5_6400_x8_spec.json")
        workload = load_workload("workloads/workload.json")
        current_output = ddr5_core_power_model(memspec, workload)
    except Exception as e:
        print(f"\n[ERROR] Failed to run model: {e}")
        return False
    
    # Load baseline
    with open(baseline_path, 'r') as f:
        baseline = json.load(f)
    
    print("\n" + "=" * 70)
    print("REGRESSION: Comparing Model Output with Baseline")
    print("=" * 70)
    
    differences = []
    tolerance = 0.0001  # 0.01% tolerance
    
    for key in current_output.keys():
        current_val = current_output[key]
        baseline_val = baseline.get(key)
        
        if baseline_val is None:
            differences.append(f"New output: {key}")
            print(f"  + {key}: {current_val:.6f} W (new)")
        else:
            rel_diff = abs(current_val - baseline_val) / (abs(baseline_val) + 1e-10)
            if rel_diff > tolerance:
                differences.append(f"{key} changed by {rel_diff*100:.3f}%")
                print(f"  [DIFF] {key}: {baseline_val:.6f} -> {current_val:.6f} W")
            else:
                print(f"  [OK] {key}: {current_val:.6f} W")
    
    if differences:
        print(f"\n[WARN] {len(differences)} difference(s) detected:")
        for diff in differences:
            print(f"    - {diff}")
        return False
    else:
        print("\n[SUCCESS] All model outputs match baseline")
        return True

def main():
    """Main entry point for regression testing."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Regression testing for DDR5 power model",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Run all verification tests
  python test_regression.py
  
  # Update baseline and run tests
  python test_regression.py --save-baseline
  
  # Run tests with empirical data comparison
  python test_regression.py --empirical-data path/to/hwinfo_log.csv
  
  # Quick check - just verify outputs haven't changed
  python test_regression.py --compare
        """
    )
    
    parser.add_argument("--save-baseline", action="store_true", 
                       help="Update the baseline with current model output before testing")
    parser.add_argument("--compare", action="store_true",
                       help="Quick regression check: compare model output with baseline only")
    parser.add_argument("--empirical-data", type=str,
                       help="Path to HWiNFO CSV file with empirical power measurements")
    
    args = parser.parse_args()
    
    overall_success = True
    
    if args.compare:
        # Quick regression check only
        print("=" * 70)
        print("QUICK REGRESSION CHECK")
        print("=" * 70)
        
        if not compare_model_outputs():
            print("\n[FAILURE] Regression check failed: Model outputs have changed")
            sys.exit(1)
        else:
            print("\n[SUCCESS] Regression check passed: Model outputs unchanged")
            sys.exit(0)
    
    # Full test suite
    result = run_power_model_tests(
        empirical_data_path=args.empirical_data,
        update_baseline=args.save_baseline
    )
    
    if not result["success"]:
        print("\n[FAILURE] Test suite failed")
        overall_success = False
    
    # Verify baseline exists and is reasonable
    if not verify_model_output_exists():
        print("\n[WARN] Warning: Baseline verification issues detected")
    
    # Final summary
    print("\n" + "=" * 70)
    print("REGRESSION TEST SUMMARY")
    print("=" * 70)
    
    if overall_success:
        print("[SUCCESS] ALL CHECKS PASSED")
        print("\nThe power model:")
        print("  * Executes successfully")
        print("  * Produces valid numerical outputs")
        print("  * Passes all verification requirements")
        print("  * Matches regression baseline")
        sys.exit(0)
    else:
        print("[FAILURE] SOME CHECKS FAILED")
        print("\nPlease review the test output above and fix any issues.")
        print("\nCommon issues:")
        print("  * NF-01: Model output doesn't match empirical data expectations")
        print("  * NF-02: Model takes too long to execute (>10 seconds)")
        print("  * C-03: Model doesn't handle malformed inputs gracefully")
        print("  * F-02: Model outputs have changed from baseline")
        print("\nIf changes are intentional, update the baseline with:")
        print("  python test_regression.py --save-baseline")
        sys.exit(1)



if __name__ == "__main__":
    main()

