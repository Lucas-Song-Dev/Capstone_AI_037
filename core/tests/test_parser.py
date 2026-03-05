"""
Unit tests for parser module.
"""

import pytest
import sys
from pathlib import Path

# Add core/src to path
core_src = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(core_src))

from parser import load_memspec, load_workload, MemSpec, Workload


class TestParser:
    """Test parser functions."""
    
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
    
    def test_load_memspec(self, sample_memspec_path):
        """Test loading memspec from file."""
        memspec = load_memspec(str(sample_memspec_path))
        
        assert isinstance(memspec, MemSpec)
        assert memspec.memoryId is not None
        assert memspec.memarchitecturespec is not None
        assert memspec.mempowerspec is not None
        assert memspec.memtimingspec is not None
    
    def test_load_workload(self, sample_workload_path):
        """Test loading workload from file."""
        workload = load_workload(str(sample_workload_path))
        
        assert isinstance(workload, Workload)
        assert hasattr(workload, "RDsch_percent")
        assert hasattr(workload, "WRsch_percent")
    
    def test_load_memspec_invalid_path(self):
        """Test loading memspec with invalid path raises error."""
        with pytest.raises(FileNotFoundError):
            load_memspec("nonexistent_file.json")
    
    def test_load_workload_invalid_path(self):
        """Test loading workload with invalid path raises error."""
        with pytest.raises(FileNotFoundError):
            load_workload("nonexistent_file.json")

