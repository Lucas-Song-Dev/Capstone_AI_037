"""
Regression test runner for power visualization tool.
Runs the visualization script and captures outputs for comparison.
"""
import subprocess
import sys
import os
import json
import hashlib
from pathlib import Path

def calculate_file_hash(filepath):
    """Calculate SHA256 hash of a file."""
    sha256_hash = hashlib.sha256()
    with open(filepath, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

def run_visualization():
    """Run the visualization script and capture outputs."""
    print("=" * 70)
    print("Running Power Visualization Script")
    print("=" * 70)
    
    # Run the script
    result = subprocess.run(
        [sys.executable, "visualize_power.py"],
        capture_output=True,
        text=True
    )
    
    print("\n--- STDOUT ---")
    print(result.stdout)
    
    if result.stderr:
        print("\n--- STDERR ---")
        print(result.stderr)
    
    print("\n--- Exit Code ---")
    print(f"Exit code: {result.returncode}")
    
    if result.returncode != 0:
        print("\n❌ Script execution failed!")
        return None
    
    # Collect information about generated files
    expected_outputs = [
        "component_power_breakdown.png",
        "dram_power_breakdown.png",
        "voltage_rail_breakdown.png",
        "power_summary_dashboard.png"
    ]
    
    file_info = {}
    all_exist = True
    
    print("\n" + "=" * 70)
    print("Generated Files Analysis")
    print("=" * 70)
    
    for filename in expected_outputs:
        if os.path.exists(filename):
            file_size = os.path.getsize(filename)
            file_hash = calculate_file_hash(filename)
            file_info[filename] = {
                "exists": True,
                "size": file_size,
                "hash": file_hash
            }
            print(f"✓ {filename}")
            print(f"  Size: {file_size:,} bytes")
            print(f"  Hash: {file_hash[:16]}...")
        else:
            file_info[filename] = {"exists": False}
            all_exist = False
            print(f"✗ {filename} - NOT FOUND")
    
    return {
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "files": file_info,
        "all_files_exist": all_exist
    }

def save_baseline(output_data):
    """Save the output data as baseline."""
    baseline_dir = Path("test_baseline")
    baseline_dir.mkdir(exist_ok=True)
    
    baseline_file = baseline_dir / "baseline_output.json"
    
    with open(baseline_file, "w") as f:
        json.dump(output_data, f, indent=2)
    
    print("\n" + "=" * 70)
    print(f"✓ Baseline saved to {baseline_file}")
    print("=" * 70)

def compare_with_baseline(current_data):
    """Compare current output with baseline."""
    baseline_file = Path("test_baseline") / "baseline_output.json"
    
    if not baseline_file.exists():
        print("\n⚠️  No baseline found. Run with --save-baseline first.")
        return False
    
    with open(baseline_file, "r") as f:
        baseline_data = json.load(f)
    
    print("\n" + "=" * 70)
    print("Comparing with Baseline")
    print("=" * 70)
    
    differences = []
    
    # Compare exit codes
    if current_data["exit_code"] != baseline_data["exit_code"]:
        differences.append(f"Exit code changed: {baseline_data['exit_code']} -> {current_data['exit_code']}")
    
    # Compare file existence and hashes
    for filename in current_data["files"]:
        current_file = current_data["files"][filename]
        baseline_file_data = baseline_data["files"].get(filename, {})
        
        if current_file["exists"] != baseline_file_data.get("exists", False):
            differences.append(f"{filename}: existence changed")
        elif current_file["exists"]:
            if current_file["hash"] != baseline_file_data.get("hash"):
                differences.append(f"{filename}: content changed (hash mismatch)")
                print(f"  {filename}:")
                print(f"    Baseline hash: {baseline_file_data.get('hash', 'N/A')[:16]}...")
                print(f"    Current hash:  {current_file['hash'][:16]}...")
            if abs(current_file["size"] - baseline_file_data.get("size", 0)) > 1000:
                differences.append(f"{filename}: significant size change")
                print(f"  {filename}:")
                print(f"    Baseline size: {baseline_file_data.get('size', 0):,} bytes")
                print(f"    Current size:  {current_file['size']:,} bytes")
    
    # Compare stdout (ignore whitespace differences and timestamps)
    baseline_lines = [line.strip() for line in baseline_data["stdout"].split('\n') if line.strip()]
    current_lines = [line.strip() for line in current_data["stdout"].split('\n') if line.strip()]
    
    if baseline_lines != current_lines:
        print("\n⚠️  Console output differs from baseline")
        # This is informational, not necessarily a failure
    
    if differences:
        print("\n❌ REGRESSION TEST FAILED")
        print("=" * 70)
        print("Differences found:")
        for diff in differences:
            print(f"  • {diff}")
        print("=" * 70)
        return False
    else:
        print("\n✅ REGRESSION TEST PASSED")
        print("=" * 70)
        print("All outputs match the baseline!")
        print("=" * 70)
        return True

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Regression testing for power visualization")
    parser.add_argument("--save-baseline", action="store_true", 
                       help="Save current output as baseline")
    parser.add_argument("--compare", action="store_true",
                       help="Compare current output with baseline")
    
    args = parser.parse_args()
    
    # Run the visualization
    output_data = run_visualization()
    
    if output_data is None:
        print("\n❌ Test failed: Script execution error")
        sys.exit(1)
    
    if not output_data["all_files_exist"]:
        print("\n❌ Test failed: Not all expected files were generated")
        sys.exit(1)
    
    if args.save_baseline:
        save_baseline(output_data)
        print("\n✓ Baseline created successfully")
    elif args.compare:
        if not compare_with_baseline(output_data):
            sys.exit(1)
    else:
        # Default: just run and report
        print("\n✓ Script executed successfully")
        print("\nTip: Use --save-baseline to create a baseline")
        print("     Use --compare to compare with baseline")
    
    sys.exit(0)

if __name__ == "__main__":
    main()

