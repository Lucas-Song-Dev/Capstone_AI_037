# Regression Testing Guide

## Overview

This project uses automated regression testing to ensure that changes to the code don't unexpectedly alter the output visualizations. The system compares the current output with a saved baseline to detect any differences.

## How It Works

### 1. **Baseline Creation**
   - The baseline is a snapshot of the "known good" output
   - Includes file hashes, sizes, and console output
   - Stored in `test_baseline/baseline_output.json`

### 2. **Regression Testing**
   - On every Pull Request, the script runs with the same input data
   - Outputs are compared against the baseline
   - Any differences trigger a test failure

### 3. **Baseline Updates**
   - When you push to `main` or `master`, the baseline is automatically updated
   - This ensures the baseline always reflects the current approved state

## Local Testing

### Run the visualization and create a baseline:
```bash
python test_regression.py --save-baseline
```

### Run the visualization and compare with baseline:
```bash
python test_regression.py --compare
```

### Just run the visualization (no comparison):
```bash
python test_regression.py
```

## GitHub Actions Workflow

The workflow automatically runs in these scenarios:

### On Pull Requests
- ✅ Runs the script with current code
- ✅ Compares output with baseline
- ✅ Comments on the PR with results
- ✅ Uploads generated images as artifacts

### On Push to Main/Master
- ✅ Runs the script
- ✅ Updates the baseline
- ✅ Commits the new baseline back to the repository

### Manual Trigger
You can manually trigger the workflow from the Actions tab:
- Choose whether to update the baseline
- Useful for creating initial baselines or resetting after intentional changes

## What Gets Compared?

1. **Exit Code**: Did the script complete successfully?
2. **Generated Files**: Were all expected PNG files created?
3. **File Hashes**: Did the content of the images change?
4. **File Sizes**: Significant size changes are flagged
5. **Console Output**: Changes in output messages (informational only)

## Expected Output Files

The test expects these files to be generated:
- `component_power_breakdown.png`
- `dram_power_breakdown.png`
- `voltage_rail_breakdown.png`
- `power_summary_dashboard.png`

## Handling Test Failures

### When a PR fails regression tests:

1. **Review the differences**
   - Check the workflow logs to see what changed
   - Download the artifacts to visually compare the images

2. **Determine if changes are intentional**
   - ✅ **Intentional changes**: This is expected (e.g., improving visualizations)
   - ❌ **Unintentional changes**: Fix the bug causing the difference

3. **For intentional changes**
   - Merge the PR after review
   - The baseline will auto-update when merged to main
   - Future PRs will compare against the new baseline

4. **For unintentional changes**
   - Fix the code
   - Push new commits to the PR
   - Tests will re-run automatically

## Best Practices

1. **Review visual outputs** - Download artifacts from the workflow to visually inspect the generated charts
2. **Keep baselines up-to-date** - Always merge to main after approving intentional changes
3. **Document intentional changes** - Add notes in PR descriptions when you expect output to change
4. **Test locally first** - Run `test_regression.py --compare` before pushing

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

