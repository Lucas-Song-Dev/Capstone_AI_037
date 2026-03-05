# LPDDR5/LPDDR5X Support Summary

## Overview
The framework now supports both DDR5 and LPDDR5-class specs (LPDDR5 + LPDDR5X) using one parser and memory-type-based model selection.

## What Was Added

### LPDDR5(X) memspec
- **File**: [core/workloads/micron_lpddr5_8gb_7500_x16_spec.json](core/workloads/micron_lpddr5_8gb_7500_x16_spec.json)
- Uses 4 rails (`vdd1`, `vdd2h`, `vdd2l`, `vddq`) and `idd_by_rail_A`.
- Includes LPDDR5-style timing fallback fields (`RFCab_ns`, `RFCpb_ns`, etc.) for cases where cycle timings are not provided.

### LPDDR5 core model
- **File**: [core/src/lpddr5_core_model.py](core/src/lpddr5_core_model.py)
- **Class**: `LPDDR5CorePowerModel`
- Computes rail-aware core power from `idd_by_rail_A` (or scalar fallback), including standby, read/write, activate/precharge, refresh, and self-refresh terms.

### LPDDR5 interface model
- **File**: [core/src/lpddr5_interface_model.py](core/src/lpddr5_interface_model.py)
- **Class**: `LPDDR5InterfacePowerModel`
- Computes CA/CK on VDD1, DQ/DQS on VDDQ, and termination on VDD2L.
- Uses datasheet VDDQ currents (`idd3n`, `idd4r`, `idd4w`) when available; falls back to theoretical resistive estimates otherwise.

### LPDDR5 system wrapper
- **File**: [core/src/lpddr5.py](core/src/lpddr5.py)
- **Class**: `LPDDR5`
- Provides `compute_core`, `compute_interface`, `compute_all`, and report output.

## What Was Updated

### Parser
- **File**: [core/src/parser.py](core/src/parser.py)
- `MemPowerSpec` now carries both DDR5 and LPDDR5(X) fields.
- Detects memory type (`DDR5`, `LPDDR5`, `LPDDR5X`) and parses the correct schema.
- Supports LPDDR5(X) rail ranges (`rails`) and per-rail currents (`idd_by_rail_A`).
- Keeps DDR5 validation strict for required VDD/IPP fields.

### Runtime selection
- **File**: [core/src/main.py](core/src/main.py)
- Auto-selects DDR5 vs LPDDR5 model stack based on parsed memory type.

## Behavior Notes
- LPDDR5X specs are supported by the LPDDR5 model classes.
- Parser output is backward compatible with existing DDR5 JSON files.
- Interface power now reflects datasheet currents when present, improving realism versus fixed-R assumptions.

## Usage

Run from the `core/src` directory:

```bash
python main.py --memspec ../workloads/micron_lpddr5_8gb_7500_x16_spec.json --workload ../workloads/workload.json
```

**Requirements:**
- Python 3.7+ must be installed and `python` must resolve to the actual Python executable (not the Windows Store stub).
- To verify: `python --version` should display a version number.

The tool auto-detects memory type from the memspec JSON and instantiates the matching model path (DDR5 or LPDDR5(X)).

