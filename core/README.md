# Core Package - DDR5 Power Calculator

JEDEC-compliant DDR5 power modeling and calculation library.

## Structure

```
core/
├── src/              # Package source code
├── tests/            # Unit tests
├── verif/            # Verification tests
├── workloads/        # Test data and specifications
└── requirements.txt  # Dependencies
```

## Installation

```bash
# Install in development mode
cd core
pip install -e .

# Or install from source
pip install .
```

## Usage

```python
from ddr5 import DDR5
from core_model import DDR5CorePowerModel
from parser import load_memspec, load_workload

# Load specifications
memspec = load_memspec("workloads/micron_16gb_ddr5_4800_x8_spec.json")
workload = load_workload("workloads/workload.json")

# Create model and compute
core_model = DDR5CorePowerModel()
ddr5 = DDR5(memspec, workload, core_model=core_model)
result = ddr5.compute_core()

print(f"Total core power: {result['P_total_core']} W")
```

## Testing

```bash
# Run unit tests
cd core
pytest tests/ -v

# Run regression tests
python test_regression.py

# Update baseline
python test_regression.py --save-baseline
```

## Dependencies

- pandas>=2.0.0
- matplotlib>=3.7.0
- numpy>=1.24.0

