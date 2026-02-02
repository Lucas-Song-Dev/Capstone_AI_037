"""
Unit tests for DDR5CorePowerModel.
"""

import pytest
import sys
from pathlib import Path

# Add core/src to path
core_src = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(core_src))

from core_model import DDR5CorePowerModel
from parser import load_memspec, load_workload


class TestDDR5CorePowerModel:
    """Test DDR5CorePowerModel."""
    
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
    
    def test_core_model_compute(self, sample_memspec_path, sample_workload_path):
        """Test core model power computation."""
        model = DDR5CorePowerModel()
        memspec = load_memspec(str(sample_memspec_path))
        workload = load_workload(str(sample_workload_path))
        
        result = model.compute(memspec, workload)
        
        assert result is not None
        assert isinstance(result, dict)
        assert "P_total_core" in result
        assert result["P_total_core"] > 0

