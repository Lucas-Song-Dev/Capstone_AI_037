"""
DDR5 Power Calculator Package

A JEDEC-compliant DDR5 power modeling and calculation library.
"""

from .ddr5 import DDR5
from .dimm import DIMM
from .core_model import DDR5CorePowerModel
from .interface_model import DDR5InterfacePowerModel
from .parser import (
    load_memspec,
    load_workload,
    MemSpec,
    Workload,
    MemArchitectureSpec,
    MemPowerSpec,
    MemTimingSpec,
)

__version__ = "0.1.0"
__all__ = [
    "DDR5",
    "DIMM",
    "DDR5CorePowerModel",
    "DDR5InterfacePowerModel",
    "load_memspec",
    "load_workload",
    "MemSpec",
    "Workload",
    "MemArchitectureSpec",
    "MemPowerSpec",
    "MemTimingSpec",
]

