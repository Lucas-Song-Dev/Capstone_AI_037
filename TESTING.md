# DDR5 Power Model - Testing and Verification Guide

## Overview

This project uses automated verification and regression testing to ensure that the DDR5 power model produces accurate, consistent results. The system validates model outputs against requirements (NF-01, NF-02, C-03, F-02) and empirical measurements.

## How It Works

### 1. **Verification Tests**
   The verification suite (`verif/verif.py`) tests the actual power model calculations:
   - **NF-01:** Background power sensibility - compares model output with empirical data
   - **NF-02:** Runtime performance - ensures model runs in < 10 seconds
   - **C-03:** Input validation - tests graceful handling of malformed inputs
   - **F-02:** Regression validation - detects unintended changes to model outputs

### 2. **Baseline Management**
   - The baseline is a snapshot of the "known good" power output values
   - Stored as JSON in `verif/baseline/power_output_baseline.json`
   - Contains numerical power values (in Watts) for all model components

### 3. **Automated CI/CD**
   - On every Pull Request, GitHub Actions runs the full verification suite
   - On push to `main`/`master`, the baseline is automatically updated
   - This ensures code changes don't break the power model

## Local Testing

### Run the complete verification test suite:
```bash
python test_regression.py
```

This runs all verification tests (NF-01, NF-02, C-03, F-02) and checks against the baseline.

### Quick regression check (compare outputs only):
```bash
python test_regression.py --compare
```

This quickly checks if model outputs have changed from baseline without running the full test suite.

### Update the baseline:
```bash
python test_regression.py --save-baseline
```

Use this when you've intentionally changed the power model and want to update the baseline.

### Run tests with empirical data:
```bash
python test_regression.py --empirical-data path/to/hwinfo_log.csv
```

This compares model outputs against real DDR5 power measurements collected with HWiNFO.

## GitHub Actions Workflow

The workflow (`regression-test.yml`) automatically runs in these scenarios:

### On Pull Requests
- ✅ Runs the complete verification test suite
- ✅ Tests NF-01, NF-02, C-03, F-02 requirements
- ✅ Compares power outputs with baseline
- ✅ Comments on the PR with test results and power values
- ✅ Uploads test results as artifacts

### On Push to Main/Master
- ✅ Runs the verification suite
- ✅ Updates the baseline with current outputs
- ✅ Commits the new baseline back to the repository

### Manual Trigger
You can manually trigger the workflow from the Actions tab:
- Choose whether to update the baseline
- Useful for creating initial baselines or resetting after intentional changes

## What Gets Tested?

### 1. **Background Power Sensibility (NF-01)**
   - Verifies model background power is reasonable
   - If empirical data provided, checks that model baseline ≤ minimum measured power
   - Ensures model produces realistic power estimates

### 2. **Runtime Performance (NF-02)**
   - Tests that model completes in < 10 seconds for all test scenarios
   - Ensures tool remains responsive for interactive use

### 3. **Input Format Validation (C-03)**
   - Tests graceful handling of malformed JSON inputs
   - Verifies useful error messages are provided
   - Ensures model doesn't crash on invalid input

### 4. **Regression Validation (F-02)**
   - Compares current power outputs with baseline
   - Detects unintended changes to model calculations
   - Uses 0.01% tolerance for floating-point comparison

## Model Output Values

The test suite validates these power components (all in Watts):
- `P_total_core` - Total DDR5 chip power
- `P_VDD_core` - Core voltage rail power
- `P_VPP_core` - Wordline pump voltage power
- `P_ACT_STBY_core` - Active standby power
- `P_PRE_STBY_core` - Precharged standby power
- `P_RD_core` - Read operation power
- `P_WR_core` - Write operation power
- `P_REF_core` - Refresh operation power
- `P_ACT_PRE_core` - Activate/Precharge power

## Handling Test Failures

### When a PR fails verification tests:

1. **Identify which test failed**
   - **NF-01 failure**: Model output doesn't match expected power ranges
   - **NF-02 failure**: Model takes too long to execute
   - **C-03 failure**: Model doesn't handle invalid inputs gracefully
   - **F-02 failure**: Model outputs have changed from baseline

2. **For NF-01 failures (Power Sensibility)**
   - Review the power calculations in `src/main.py`
   - Check that IDD/IPP current values are correct
   - Verify voltage values (VDD, VPP, VDDQ)
   - If empirical data shows issues, review the workload parameters

3. **For NF-02 failures (Runtime)**
   - Profile the code to find performance bottlenecks
   - Optimize slow calculations
   - Ensure no unnecessary file I/O or heavy computations

4. **For C-03 failures (Input Validation)**
   - Add better error handling in `src/parser.py`
   - Provide clear error messages indicating which fields are missing/invalid
   - Use try-except blocks to catch parsing errors gracefully

5. **For F-02 failures (Regression)**
   - **If changes are intentional** (e.g., bug fix, formula improvement):
     - Document the change in PR description
     - Update baseline: `python test_regression.py --save-baseline`
     - Commit the updated baseline with your PR
   - **If changes are unintentional**:
     - Review your code changes
     - Fix the bug causing the difference
     - Re-run tests to verify

## Best Practices

1. **Test locally before pushing** - Run `python test_regression.py` before creating a PR
2. **Document power model changes** - Explain why outputs changed in PR descriptions
3. **Compare with empirical data** - When available, validate against real DDR5 measurements
4. **Keep baselines current** - Update baseline when merging intentional changes to main
5. **Review numerical outputs** - Check that power values are physically reasonable

## Troubleshooting

### "No baseline found"
- The workflow will automatically create one on the first run
- Or manually run: `python test_regression.py --save-baseline`

### "Script execution failed"
- Check that all CSV input files exist
- Verify dependencies are installed: `pip install -r requirements.txt`
- Review error messages in the workflow logs

### "File hash mismatch"
- This means the generated image content changed
- Download both the baseline and current artifacts to compare visually
- Determine if the change is intentional

### Baseline not updating after merge
- Check that the workflow has write permissions
- Verify the baseline was committed (look for "chore: update regression test baseline" commit)

## Configuration

### Modify expected output files
Edit `test_regression.py` and update the `expected_outputs` list:
```python
expected_outputs = [
    "your_file_1.png",
    "your_file_2.png",
]
```

### Change size tolerance
Edit the size comparison threshold in `test_regression.py`:
```python
if abs(current_file["size"] - baseline_file_data.get("size", 0)) > 1000:  # Change 1000 to your threshold
```

### Adjust workflow triggers
Edit `.github/workflows/regression-test.yml` to change when tests run.

## Example Workflow

1. Developer creates a feature branch
2. Makes changes to `visualize_power.py`
3. Opens a Pull Request
4. GitHub Actions automatically:
   - Runs the visualization script
   - Compares output with baseline
   - Comments on the PR with results
5. Reviewer downloads artifacts to visually inspect changes
6. If approved, PR is merged to main
7. Baseline automatically updates
8. Future PRs compare against the new baseline

---

**Note**: This testing system focuses on output consistency, not correctness. Always review the actual visualizations to ensure they're accurate and meaningful!

