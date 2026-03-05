# DDR5 Power Model - Testing and Verification Guide

## Test Status Summary

**Last Updated:** 2025-01-XX

| Component | Tests | Status | Pass Rate |
|-----------|-------|--------|-----------|
| **Core Package** | 10/10 | ✅ All Passing | 100% |
| **Backend API** | 7/7 | ✅ All Passing | 100% |
| **Frontend** | 28/28 | ✅ All Passing | 100% |
| **Total** | **45/45** | ✅ **All Passing** | **100%** |

All test suites are passing successfully. The core package tests were fixed by adding the missing `nbrOfDevices` field to JSON spec files.

## Overview

This project uses automated verification and regression testing to ensure that the DDR5 power model produces accurate, consistent results. The system validates model outputs against requirements (NF-01, NF-02, C-03, F-02) and empirical measurements.

The repository is organized into three main components, each with its own test suite:
- **Core Package** (`core/`) - Python package for DDR5 power calculations
- **Backend API** (`backend/`) - FastAPI REST API
- **Frontend** (`frontend/`) - Next.js React application
- **End-to-End Tests** (`tests/e2e/`) - Full stack integration tests

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

## Repository Structure

```
.
├── core/                    # Python package (core calculations)
│   ├── src/                 # Package source code
│   ├── tests/               # Unit tests
│   ├── verif/               # Verification tests
│   └── workloads/           # Test data
├── backend/                 # FastAPI API
│   ├── src/                 # API source code
│   └── tests/                # API tests
├── frontend/                # Next.js frontend
│   ├── src/                 # Frontend source
│   └── tests/                # Frontend tests
└── tests/                    # End-to-end tests
    └── e2e/                  # Full stack integration tests
```

## Local Testing

### Core Package Tests

**Prerequisites (using virtual environment):**
```bash
# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows PowerShell
# or: source venv/bin/activate  # Linux/Mac

# Install dependencies
cd core
pip install -r requirements.txt
pip install pytest pytest-cov

# Set PYTHONPATH to include core/src
$env:PYTHONPATH="C:\path\to\core\src"  # Windows PowerShell
# or: export PYTHONPATH="$(pwd)/src"  # Linux/Mac
```

**Run unit tests:**
```bash
cd core
# With PYTHONPATH set
pytest tests/ -v
```

**Run regression tests:**
```bash
cd core
python test_regression.py
```

**Actual Test Results (2025-01-XX):**
- ✅ **10 tests passing** (100% pass rate):
  - `test_core_model_compute` - Core power model computation
  - `test_ddr5_initialization` - DDR5 class initialization
  - `test_ddr5_load_spec` - Loading specs from JSON files
  - `test_compute_core` - Core power calculation
  - `test_compute_interface` - Interface power calculation
  - `test_compute_all` - Complete power calculation
  - `test_load_memspec` - Memory spec loading
  - `test_load_workload` - Workload loading
  - `test_load_memspec_invalid_path` - Invalid path handling
  - `test_load_workload_invalid_path` - Invalid path handling
- **Fix Applied**: Added missing `nbrOfDevices` field to all JSON spec files:
  - `micron_16gb_ddr5_4800_x8_spec.json` - Added `nbrOfDevices: 4`
  - `skhynix_16gb_ddr5_4800_x8_spec.json` - Added `nbrOfDevices: 4`
  - `skhynix_32gb_ddr5_4800_x8_spec.json` - Added `nbrOfDevices: 8`
  - `skhynix_8gb_ddr5_4800_x16_spec.json` - Added `nbrOfDevices: 2`

**Test Coverage:**
- `test_core_model.py` - Tests DDR5CorePowerModel
- `test_ddr5.py` - Tests DDR5 class initialization and computation
- `test_parser.py` - Tests JSON parsing and validation

### Backend API Tests

**Prerequisites (using virtual environment):**
```bash
# Activate virtual environment (if not already active)
.\venv\Scripts\Activate.ps1  # Windows PowerShell

# Install backend dependencies
cd backend
pip install -r requirements.txt
pip install pytest pytest-cov httpx

# Set PYTHONPATH to include both core/src and backend/src
$env:PYTHONPATH="C:\path\to\core\src;C:\path\to\backend\src"  # Windows PowerShell
```

**Run backend tests:**
```bash
cd backend
# With PYTHONPATH set
pytest tests/ -v
```

**Actual Test Results (2025-01-XX):**
- ✅ **7 tests passing** (100% pass rate):
  - `test_health_endpoint` - Health check endpoint works
  - `test_health_check_endpoint` - `/health` endpoint works
  - `test_calculate_core_power` - Core power calculation endpoint
  - `test_calculate_core_power_invalid_data` - Invalid data handling
  - `test_calculate_all_power` - Complete power calculation
  - `test_calculate_interface_power` - Interface power calculation
  - `test_calculate_dimm_power` - DIMM power calculation
- **Note**: Fixed import issue in test files (removed `from conftest import` - pytest auto-loads conftest)

**Test Coverage:**
- `test_api_core.py` - Tests `/api/calculate/core` endpoint
- `test_api_interface.py` - Tests `/api/calculate/interface` endpoint
- `conftest.py` - Provides test fixtures and FastAPI test client

### Frontend Tests

**Prerequisites:**
```bash
cd frontend
npm install
```

**Run frontend tests:**
```bash
cd frontend
npm test
```

**Run tests in watch mode:**
```bash
cd frontend
npm run test:watch
```

**Actual Test Results (2025-01-XX):**
- ✅ **28 tests passing** (100% pass rate):
  - `tests/unit/example.test.ts` - 1 test
  - `src/lib/ddr5Calculator.test.ts` - 10 tests
  - `src/lib/inverseDDR5.test.ts` - 1 test
  - `src/app/page.test.tsx` - 4 tests
  - `src/components/PresetSelector.test.tsx` - 4 tests
  - `src/components/Header.test.tsx` - 3 tests
  - `src/contexts/ConfigContext.test.tsx` - 5 tests
- **Fixes Applied**:
  - Renamed `setup.ts` to `setup.tsx` for JSX support
  - Fixed import paths (changed from `@/tests/unit/next-test-utils` to relative paths)
  - Updated Next.js navigation mocks to include `usePathname`
  - Fixed test assertions to handle multiple elements with same text

**Test Coverage:**
- `tests/unit/` - Unit tests for components and utilities
- `src/app/page.test.tsx` - Home page tests
- `src/components/Header.test.tsx` - Header component tests
- `src/components/PresetSelector.test.tsx` - Preset selector tests
- `src/contexts/ConfigContext.test.tsx` - Configuration context tests

**Test Setup:**
- Uses Vitest for test runner
- React Testing Library for component testing
- Mocks Next.js navigation and browser APIs
- Custom test utilities in `tests/unit/next-test-utils.tsx`

### End-to-End Tests

**Prerequisites:**
```bash
# Install core package
cd core
pip install -e .
pip install -r requirements.txt

# Install backend dependencies
cd ../backend
pip install -r requirements.txt
pip install pytest pytest-cov fastapi[all]

# Install frontend dependencies
cd ../frontend
npm install
npm run build
```

**Run e2e tests:**
```bash
# From project root
pytest tests/e2e/ -v
```

**Test Coverage:**
- `test_full_stack.py` - Tests complete flow from core → backend → API
- `test_api_integration.py` - Tests API endpoints and health checks
- `conftest.py` - Provides fixtures for core package and API client

### Run the complete verification test suite (Core):
```bash
cd core
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

## GitHub Actions Workflows

The repository has separate workflows for each component:

### Core Package Tests (`.github/workflows/core-test.yml`)
- Runs on changes to `core/**`
- Installs core dependencies
- Runs unit tests with pytest
- Runs regression tests
- Uploads test results as artifacts

### Backend API Tests (`.github/workflows/backend-test.yml`)
- Runs on changes to `backend/**` or `core/**`
- Installs core package first
- Installs backend dependencies
- Runs API tests with pytest
- Uploads test results as artifacts

### Frontend Tests (`.github/workflows/frontend-test.yml`)
- Runs on changes to `frontend/**`
- Installs Node.js dependencies
- Runs frontend unit tests
- Runs linting
- Uploads test results as artifacts

### End-to-End Tests (`.github/workflows/e2e-test.yml`)
- Runs on changes to any component
- Installs all dependencies (core, backend, frontend)
- Builds frontend
- Runs full stack integration tests
- Uploads test results as artifacts

### Regression Tests (`.github/workflows/regression-test.yml`)

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

### Core Tests

**"Missing required field 'nbrOfDevices' in memarchitecturespec"**
- **Issue**: JSON spec files don't include `nbrOfDevices` field
- **Fix Option 1**: Add `nbrOfDevices` to all JSON files in `core/workloads/`
- **Fix Option 2**: Make `nbrOfDevices` optional in `core/src/parser.py`:
  ```python
  nbrOfDevices = int(arch_raw.get("nbrOfDevices", 1)),  # Default to 1 if missing
  ```

**"ModuleNotFoundError: No module named 'pytest'"**
- Install pytest: `pip install pytest pytest-cov`
- Ensure you're in a virtual environment with dependencies installed

### Backend Tests

**"ModuleNotFoundError: No module named 'fastapi'"**
- Install backend dependencies: `cd backend && pip install -r requirements.txt`
- Ensure core package is installed first: `cd core && pip install -e .`

**"ImportError: cannot import name 'app' from 'main'"**
- Check that `backend/src/main.py` exists and exports `app`
- Verify Python path includes `backend/src`

### Frontend Tests

**"Cannot find module '@vitejs/plugin-react-swc'"**
- Install dependencies: `cd frontend && npm install`
- This package should be in `devDependencies` in `package.json`

**"SyntaxError: Unexpected token 'export'" in postcss.config.js**
- Ensure `postcss.config.js` uses CommonJS syntax: `module.exports = {...}`
- Next.js requires CommonJS for config files

**Tests fail with "useRouter is not a function"**
- Ensure test setup mocks Next.js navigation properly
- Check `tests/unit/setup.ts` includes Next.js mocks

### E2E Tests

**"ModuleNotFoundError" when importing core modules**
- Ensure core package is installed: `cd core && pip install -e .`
- Check that `tests/e2e/conftest.py` correctly adds `core/src` to Python path

**"FastAPI app not found"**
- Ensure backend dependencies are installed
- Check that `backend/src/main.py` exists and is importable

### Regression Tests

**"No baseline found"**
- The workflow will automatically create one on the first run
- Or manually run: `cd core && python test_regression.py --save-baseline`

**"Script execution failed"**
- Check that all CSV input files exist
- Verify dependencies are installed: `pip install -r core/requirements.txt`
- Review error messages in the workflow logs

**"File hash mismatch"**
- This means the generated image content changed
- Download both the baseline and current artifacts to compare visually
- Determine if the change is intentional

**Baseline not updating after merge**
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

## Running All Tests

To run all test suites in sequence:

```bash
# 1. Core tests
cd core
pip install -e . && pip install -r requirements.txt && pip install pytest
pytest tests/ -v
python test_regression.py

# 2. Backend tests
cd ../backend
pip install -r requirements.txt && pip install pytest fastapi[all]
pytest tests/ -v

# 3. Frontend tests
cd ../frontend
npm install
npm test

# 4. E2E tests (from root)
cd ..
pytest tests/e2e/ -v
```

## Test Summary

| Component | Test Framework | Status | Notes |
|-----------|---------------|--------|-------|
| Core | pytest | ⚠️ Partial | 3/10 passing (30%) - JSON spec files need `nbrOfDevices` field |
| Backend | pytest | ✅ Passing | 7/7 passing (100%) - All API endpoints working |
| Frontend | Vitest | ✅ Passing | 28/28 passing (100%) - All tests passing |
| E2E | pytest | ⚠️ Not Run | Requires all components to be working |

## Test Execution Summary

**Core Tests:**
- Total: 10 tests
- Passing: 3 (30%)
- Failing: 7 (70%) - All due to missing `nbrOfDevices` in JSON files
- Execution time: ~0.25s
- **Issue**: JSON spec files in `core/workloads/` are missing the `nbrOfDevices` field
- **Fix Options**:
  1. Add `nbrOfDevices` to all JSON spec files
  2. Make `nbrOfDevices` optional in `core/src/parser.py` with a default value

**Backend Tests:**
- Total: 7 tests
- Passing: 7 (100%)
- Failing: 0
- Execution time: ~0.07s
- All API endpoints tested and working correctly
- **Fixes Applied**: Removed incorrect `from conftest import` statements (pytest auto-loads conftest)

**Frontend Tests:**
- Total: 28 tests
- Passing: 28 (100%)
- Failing: 0
- Execution time: ~2.05s
- All component and utility tests passing
- **Fixes Applied**:
  - Renamed `setup.ts` to `setup.tsx` for JSX support
  - Fixed import paths (changed from alias to relative paths)
  - Updated Next.js navigation mocks to include all required exports
  - Fixed test assertions to handle multiple elements with same text using `getAllByText`

## Next Steps

1. **Fix Core Tests**: Add `nbrOfDevices` field to JSON spec files or make it optional in parser
   - Option 1: Add `"nbrOfDevices": 1` to all JSON files in `core/workloads/`
   - Option 2: Update `core/src/parser.py` line 136 to: `nbrOfDevices = int(arch_raw.get("nbrOfDevices", 1))`
2. **Run E2E Tests**: After fixing core tests, verify full stack integration
   ```bash
   # From project root with venv activated
   pytest tests/e2e/ -v
   ```

## Known Issues

1. **Core Tests - Missing `nbrOfDevices`**: 
   - 7 tests failing because JSON spec files don't include this field
   - This is a data issue, not a code issue
   - Easy fix: add field to JSON files or make it optional in parser

2. **Frontend Tests - All Passing**: 
   - All 28 tests now pass after fixing setup file and import paths
   - No known issues

3. **Backend Tests - All Passing**: 
   - All 7 tests pass
   - No known issues

---

**Note**: This testing system focuses on output consistency, not correctness. Always review the actual visualizations to ensure they're accurate and meaningful!

