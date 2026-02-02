"""
Pytest fixtures for e2e tests.
"""

import pytest
import sys
from pathlib import Path

# Add core/src to path
project_root = Path(__file__).parent.parent.parent
core_src = project_root / "core" / "src"
sys.path.insert(0, str(core_src))

# Add backend/src to path
backend_src = project_root / "backend" / "src"
sys.path.insert(0, str(backend_src))


@pytest.fixture
def core_package():
    """Import core package modules."""
    from ddr5 import DDR5
    from core_model import DDR5CorePowerModel
    from interface_model import DDR5InterfacePowerModel
    from parser import load_memspec, load_workload
    
    return {
        "DDR5": DDR5,
        "DDR5CorePowerModel": DDR5CorePowerModel,
        "DDR5InterfacePowerModel": DDR5InterfacePowerModel,
        "load_memspec": load_memspec,
        "load_workload": load_workload,
    }


@pytest.fixture
def sample_memspec_path():
    """Path to sample memspec file."""
    workloads_dir = project_root / "core" / "workloads"
    return workloads_dir / "micron_16gb_ddr5_4800_x8_spec.json"


@pytest.fixture
def sample_workload_path():
    """Path to sample workload file."""
    workloads_dir = project_root / "core" / "workloads"
    return workloads_dir / "workload.json"

