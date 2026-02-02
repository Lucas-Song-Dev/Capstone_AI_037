"""
Unit tests for DDR5 class.
"""

import pytest
import sys
import os
from pathlib import Path

# Add core/src to path
core_src = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(core_src))

from ddr5 import DDR5
from core_model import DDR5CorePowerModel
from interface_model import DDR5InterfacePowerModel
from parser import load_memspec, load_workload


class TestDDR5:
    """Test DDR5 power calculation class."""
    
    @pytest.fixture
    def sample_memspec_path(self):
        """Path to sample memspec file."""
        workloads_dir = Path(__file__).parent.parent / "workloads"
        return workloads_dir / "micron_16gb_ddr5_4800_x8_spec.json"
    
    @pytest.fixture
    def sample_workload_path(self):
        """Path to sample workload file."""
        workloads_dir = Path(__file__).parent.parent / "workloads"
        return workloads_dir / "workload.json"
    
    def test_ddr5_initialization(self, sample_memspec_path, sample_workload_path):
        """Test DDR5 can be initialized from files."""
        memspec = load_memspec(str(sample_memspec_path))
        workload = load_workload(str(sample_workload_path))
        
        ddr5 = DDR5(memspec, workload)
        assert ddr5.memspec is not None
        assert ddr5.workload is not None
    
    def test_ddr5_load_spec(self, sample_memspec_path, sample_workload_path):
        """Test DDR5.load_spec class method."""
        core_model = DDR5CorePowerModel()
        interface_model = DDR5InterfacePowerModel()
        
        ddr5 = DDR5.load_spec(
            str(sample_memspec_path),
            str(sample_workload_path),
            core_model=core_model,
            interface_model=interface_model
        )
        
        assert ddr5.memspec is not None
        assert ddr5.workload is not None
        assert ddr5.core_model is not None
        assert ddr5.interface_model is not None
    
    def test_compute_core(self, sample_memspec_path, sample_workload_path):
        """Test core power computation."""
        core_model = DDR5CorePowerModel()
        memspec = load_memspec(str(sample_memspec_path))
        workload = load_workload(str(sample_workload_path))
        
        ddr5 = DDR5(memspec, workload, core_model=core_model)
        result = ddr5.compute_core()
        
        assert result is not None
        assert "P_total_core" in result
        assert isinstance(result["P_total_core"], float)
        assert result["P_total_core"] > 0
    
    def test_compute_interface(self, sample_memspec_path, sample_workload_path):
        """Test interface power computation."""
        interface_model = DDR5InterfacePowerModel()
        memspec = load_memspec(str(sample_memspec_path))
        workload = load_workload(str(sample_workload_path))
        
        ddr5 = DDR5(memspec, workload, interface_model=interface_model)
        result = ddr5.compute_interface()
        
        assert result is not None
        assert "P_total_interface" in result
    
    def test_compute_all(self, sample_memspec_path, sample_workload_path):
        """Test complete power computation."""
        core_model = DDR5CorePowerModel()
        interface_model = DDR5InterfacePowerModel()
        memspec = load_memspec(str(sample_memspec_path))
        workload = load_workload(str(sample_workload_path))
        
        ddr5 = DDR5(memspec, workload, core_model=core_model, interface_model=interface_model)
        result = ddr5.compute_all()
        
        assert result is not None
        assert "P_total_core" in result
        assert "P_total_interface" in result
        assert "P_total" in result

