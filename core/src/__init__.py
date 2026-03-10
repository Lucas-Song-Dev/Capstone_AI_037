"""
DDR5/LPDDR5 Power Calculator Package

A JEDEC-compliant DDR5 and LPDDR5/LPDDR5X power modeling and calculation library.

Architecture:
- DDR5 and LPDDR5 device classes model per-device core power.
- DIMM model aggregates device core power and computes shared interface power.
"""

from .ddr5 import DDR5
from .lpddr5 import LPDDR5
from .dimm import DIMM
from .core_model import DDR5CorePowerModel
from .interface_model import DDR5InterfacePowerModel
from .lpddr5_core_model import LPDDR5CorePowerModel
from .lpddr5_interface_model import LPDDR5InterfacePowerModel
from .parser import (
    load_memspec,
    load_workload,
    MemSpec,
    Workload,
    MemArchitectureSpec,
    MemPowerSpec,
    MemTimingSpec,
)

__version__ = "0.2.0"
__all__ = [
    "DDR5",
    "LPDDR5",
    "DIMM",
    "DDR5CorePowerModel",
    "DDR5InterfacePowerModel",
    "LPDDR5CorePowerModel",
    "LPDDR5InterfacePowerModel",
    "load_memspec",
    "load_workload",
    "MemSpec",
    "Workload",
    "MemArchitectureSpec",
    "MemPowerSpec",
    "MemTimingSpec",
]

