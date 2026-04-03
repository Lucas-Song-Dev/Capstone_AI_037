"""
End-to-end tests that verify integration between core, API, and frontend.
"""

import pytest
import sys
from pathlib import Path
from fastapi.testclient import TestClient

from .api_payload import memspec_obj_to_api_dict, workload_obj_to_api_dict

# Add api to path (main.py is in api/)
project_root = Path(__file__).parent.parent.parent
api_path = project_root / "api"
sys.path.insert(0, str(api_path))


class TestFullStackIntegration:
    """Test full stack integration."""
    
    @pytest.fixture
    def api_client(self):
        """Create FastAPI test client."""
        from main import app
        return TestClient(app)
    
    @pytest.fixture
    def core_modules(self, core_package):
        """Get core package modules."""
        return core_package
    
    def test_core_package_imports(self, core_modules):
        """Test that core package can be imported."""
        assert core_modules["DDR5"] is not None
        assert core_modules["DDR5CorePowerModel"] is not None
        assert core_modules["DDR5InterfacePowerModel"] is not None
    
    def test_core_calculation_works(self, core_modules, sample_memspec_path, sample_workload_path):
        """Test that core package calculations work."""
        load_memspec = core_modules["load_memspec"]
        load_workload = core_modules["load_workload"]
        DDR5 = core_modules["DDR5"]
        DDR5CorePowerModel = core_modules["DDR5CorePowerModel"]
        
        memspec = load_memspec(str(sample_memspec_path))
        workload = load_workload(str(sample_workload_path))
        
        core_model = DDR5CorePowerModel()
        ddr5 = DDR5(memspec, workload, core_model=core_model)
        
        result = ddr5.compute_core()
        
        assert result is not None
        assert "P_total_core" in result
        assert result["P_total_core"] > 0
    
    def test_backend_api_uses_core(self, api_client, sample_memspec_path, sample_workload_path, core_modules):
        """Test that API correctly uses core package."""
        load_memspec = core_modules["load_memspec"]
        load_workload = core_modules["load_workload"]
        
        # Load data using core package
        memspec = load_memspec(str(sample_memspec_path))
        workload = load_workload(str(sample_workload_path))
        
        request_data = {
            "memspec": memspec_obj_to_api_dict(memspec),
            "workload": workload_obj_to_api_dict(workload),
        }
        
        # Test API endpoint
        response = api_client.post("/api/calculate/core", json=request_data)
        
        assert response.status_code == 200
        result = response.json()
        
        assert "P_total_core" in result
        assert result["P_total_core"] > 0
    
    def test_end_to_end_flow(self, core_modules, api_client, sample_memspec_path, sample_workload_path):
        """Test complete end-to-end flow: core -> API -> response."""
        # Step 1: Core package can load and compute
        load_memspec = core_modules["load_memspec"]
        load_workload = core_modules["load_workload"]
        DDR5 = core_modules["DDR5"]
        DDR5CorePowerModel = core_modules["DDR5CorePowerModel"]
        
        memspec = load_memspec(str(sample_memspec_path))
        workload = load_workload(str(sample_workload_path))
        
        core_model = DDR5CorePowerModel()
        ddr5 = DDR5(memspec, workload, core_model=core_model)
        core_result = ddr5.compute_core()
        
        request_data = {
            "memspec": memspec_obj_to_api_dict(memspec),
            "workload": workload_obj_to_api_dict(workload),
        }
        
        api_response = api_client.post("/api/calculate/core", json=request_data)
        assert api_response.status_code == 200
        api_result = api_response.json()
        
        # Step 3: Results should be similar (allowing for small floating point differences)
        core_total = core_result["P_total_core"]
        api_total = api_result["P_total_core"]
        
        # Allow 0.1% difference for floating point precision
        diff = abs(core_total - api_total) / core_total
        assert diff < 0.001, f"Core and API results differ by {diff*100:.2f}%"

