# LPDDR5/LPDDR5X Support Documentation

## Overview
The power modeling framework supports both **DDR5** and **LPDDR5/LPDDR5X** memory types with unified architecture, JEDEC-compliant calculations, and automatic memory type detection.

---

## Architecture Design

### Core Principles
1. **Core-only devices**: Both DDR5 and LPDDR5 device classes (`DDR5`, `LPDDR5`) only compute per-device core power
2. **DIMM-level interface**: Interface/I/O power is computed once per DIMM (shared bus property)
3. **Symmetric structure**: Both memory types follow identical patterns for consistency
4. **Type-aware calculations**: Rail configurations and formulas adapt to memory type

### Class Hierarchy

```
DIMM (dimm.py)
├── Multiple Device Objects (DDR5 or LPDDR5)
│   └── Core Power Model (per device)
│       ├── DDR5CorePowerModel (VDD + VPP rails)
│       └── LPDDR5CorePowerModel (VDD1 + VDD2H + VDD2L + VDDQ rails)
└── Interface Power Model (once per DIMM)
    ├── DDR5InterfacePowerModel (resistive + CV²f)
    └── LPDDR5InterfacePowerModel (datasheet currents preferred)
```

---

## Key Components

### LPDDR5 Core Power Model
**File**: [lpddr5_core_model.py](lpddr5_core_model.py)  
**Class**: `LPDDR5CorePowerModel`

**Features**:
- **4-rail architecture**: VDD1 (1.8V), VDD2H/VDD2L (1.1V), VDDQ (0.5V)
- **Per-rail current tracking**: Uses `idd_by_rail_A` from datasheets
- **Scalar fallback**: Falls back to summed currents if per-rail data unavailable

**Power Components**:
```python
P_total = P_background + P_read + P_write + P_activate + P_refresh + P_self_refresh
```

### DIMM-Level Aggregation
**File**: [dimm.py](dimm.py)  
**Class**: `DIMM`

**Architecture**:
- Symmetric with `DDR5` class for architectural consistency
- Used by `DIMM` class to create per-rank device lists

**Key Methods**:
- `load_specs()`: Factory method with auto-type detection
- `compute_all()`: Aggregate core power from all devices + compute interface once
- `report_dimm_power()`: Unified report format for both DDR5 and LPDDR5

**Report Format** (memory-type aware):

```
======================================================================
DIMM POWER REPORT
======================================================================
Memory: [Device Name]
Type: DDR5 or LPDDR5/LPDDR5X

--- Core Power Breakdown (W) ---
  P_PRE_STBY_core              :     X.XXXXXX
  P_ACT_STBY_core              :     X.XXXXXX
  ...
  [DDR5: P_VDD_core, P_VPP_core]
  [LPDDR5: P_VDD1, P_VDD2H, P_VDD2L, P_VDDQ]
  P_total_core                 :     X.XXXXXX

--- Interface / I/O Power Breakdown (W) ---
  [DDR5: Termination + Dynamic breakdown]
  [LPDDR5: By signal type & rail]
  P_total_interface            :     X.XXXXXX

--- DIMM Total Power (W) ---
  P_total_core                 :     X.XXXXXX
  P_total_interface            :     X.XXXXXX
  P_TOTAL_DIMM                 :     X.XXXXXX
```

---

### Visualization Support
**File**: [visualizer.py](visualizer.py)

**Auto-Detection**: Intelligently detects DDR5 vs LPDDR5 from result dictionary keys

**Plot Functions**:
1. **`plot_core_components()`**: Bar chart of 6 core power components
2. **`plot_rail_breakdown()`**: Rail-specific power (2 rails for DDR5, 4 for LPDDR5)
3. **`plot_core_power_stacked()`**: Stacked bar showing component contributions
4. **`plot_dimm_total_breakdown()`**: Core vs Interface power split


---

## JEDEC Compliance & Validation

### Power Calculation Formulas

**Core Power** (both DDR5 and LPDDR5):
```
P = V × (IDD_active - IDD_baseline) × duty_cycle
```

**Interface Power**:
- **DDR5**: Resistive termination (I²R) + Dynamic switching (CV²f)
- **LPDDR5**: Datasheet currents (preferred) or theoretical I²R fallback

### Physical Validation

**Negative Power Guards**:
All power calculations use `max(0.0, ...)` to prevent physically impossible negative outputs from:
- Malformed datasheets where `IDD_active < IDD_baseline`
- Division by zero in termination calculations
- Incorrect voltage/current specifications

**JEDEC Alignment**: All formulas follow JESD79-5 (DDR5) and LPDDR5/LPDDR5X specifications

---

## File Organization

### Core Power Models
- `core_model.py` - DDR5 core power (VDD + VPP rails)
- `lpddr5_core_model.py` - LPDDR5 core power (4 rails)

### Interface Power Models
- `interface_model.py` - DDR5 interface (resistive + CV²f)
- `lpddr5_interface_model.py` - LPDDR5 interface (datasheet currents preferred)

### Device Wrappers
- `ddr5.py` - DDR5 device class (core-only)
- `lpddr5.py` - LPDDR5 device class (core-only)

### System Integration
- `dimm.py` - DIMM-level aggregation (core + interface)
- `parser.py` - Unified JSON parser (DDR5 + LPDDR5)
- `main.py` - CLI entry point with auto-detection
- `visualizer.py` - Plotting functions (both memory types)

---

## Usage Examples

### Basic Power Calculation

**DDR5**:
```bash
cd core
python src/main.py \
  --memspec workloads/micron_16gb_ddr5_6400_x8_spec.json \
  --workload workloads/workload.json
```

**LPDDR5**:
```bash
python src/main.py \
  --memspec Components/DRAMs_LP5/micron_y52p_lp5x_dram_x16_8533.json \
  --workload workloads/workload.json
```

### With Visualization

```bash
python src/main.py \
  --memspec <memspec_path> \
  --workload <workload_path> \
  --plot
```

---
## Testing & Verification

### Regression Tests
```bash
cd core
python test_regression.py
```

---
## Manual Verification Checklist
- [ ] DDR5 specs parse correctly
- [ ] LPDDR5 specs parse correctly
- [ ] LPDDR5X specs parse correctly
- [ ] Core power values are positive
- [ ] Interface power values are positive
- [ ] Parser warnings appear for suspicious currents
- [ ] Visualizations generate without errors
- [ ] Output format is consistent between DDR5 and LPDDR5

## Known Limitations
1. **Timing flexibility**: Some LPDDR5 specs provide timing in ns only; parser converts to cycles when needed
2. **Datasheet dependency**: Interface power accuracy depends on `idd_by_rail_A.idd4r.vddq_read` availability
3. **Temperature effects**: Current model assumes nominal operating temperature
4. **Manufacturing variation**: Uses typical values; does not model 3σ variations



## Future Enhancements

### Planned Features
- [ ] Per-bank power tracking
- [ ] Temperature-dependent power scaling
- [ ] Process voltage temperature (PVT) corner modeling
- [ ] ODT (On-Die Termination) configuration support
- [ ] Power state machine modeling (active/idle/power-down transitions)

### Contribution Guidelines
1. Maintain JEDEC compliance for all calculations
2. Add negative power guards to any new delta calculations
3. Update parser validation for new current fields
4. Ensure symmetric behavior between DDR5 and LPDDR5 classes
5. Test with both memory types before committing

---

*Last Updated: March 7, 2026*
*Architecture Version: 2.0 (Core-only devices, DIMM-level interface)*
