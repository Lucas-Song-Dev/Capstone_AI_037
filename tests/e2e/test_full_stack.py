"""
End-to-end tests that verify integration between core, backend, and frontend.
"""

import pytest
import sys
from pathlib import Path
from fastapi.testclient import TestClient

# Add backend/src to path
project_root = Path(__file__).parent.parent.parent
backend_src = project_root / "backend" / "src"
sys.path.insert(0, str(backend_src))


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
        """Test that backend API correctly uses core package."""
        import json
        
        load_memspec = core_modules["load_memspec"]
        load_workload = core_modules["load_workload"]
        
        # Load data using core package
        memspec = load_memspec(str(sample_memspec_path))
        workload = load_workload(str(sample_workload_path))
        
        # Convert to API format
        request_data = {
            "memspec": {
                "memoryId": memspec.memoryId,
                "memoryType": memspec.memoryType,
                "memarchitecturespec": {
                    "width": memspec.memarchitecturespec.width,
                    "nbrOfBanks": memspec.memarchitecturespec.nbrOfBanks,
                    "nbrOfBankGroups": memspec.memarchitecturespec.nbrOfBankGroups,
                    "nbrOfRanks": memspec.memarchitecturespec.nbrOfRanks,
                    "nbrOfColumns": memspec.memarchitecturespec.nbrOfColumns,
                    "nbrOfRows": memspec.memarchitecturespec.nbrOfRows,
                    "nbrOfDevices": memspec.memarchitecturespec.nbrOfDevices,
                    "burstLength": memspec.memarchitecturespec.burstLength,
                    "dataRate": memspec.memarchitecturespec.dataRate,
                },
                "mempowerspec": {
                    "vdd": memspec.mempowerspec.vdd,
                    "vpp": memspec.mempowerspec.vpp,
                    "vddq": memspec.mempowerspec.vddq,
                    "idd0": memspec.mempowerspec.idd0,
                    "idd2n": memspec.mempowerspec.idd2n,
                    "idd3n": memspec.mempowerspec.idd3n,
                    "idd4r": memspec.mempowerspec.idd4r,
                    "idd4w": memspec.mempowerspec.idd4w,
                    "idd5b": memspec.mempowerspec.idd5b,
                    "idd6n": memspec.mempowerspec.idd6n,
                    "idd2p": memspec.mempowerspec.idd2p,
                    "idd3p": memspec.mempowerspec.idd3p,
                    "ipp0": memspec.mempowerspec.ipp0,
                    "ipp2n": memspec.mempowerspec.ipp2n,
                    "ipp3n": memspec.mempowerspec.ipp3n,
                    "ipp4r": memspec.mempowerspec.ipp4r,
                    "ipp4w": memspec.mempowerspec.ipp4w,
                    "ipp5b": memspec.mempowerspec.ipp5b,
                    "ipp6n": memspec.mempowerspec.ipp6n,
                    "ipp2p": memspec.mempowerspec.ipp2p,
                    "ipp3p": memspec.mempowerspec.ipp3p,
                },
                "memtimingspec": {
                    "tCK": memspec.memtimingspec.tCK,
                    "RAS": memspec.memtimingspec.RAS,
                    "RCD": memspec.memtimingspec.RCD,
                    "RP": memspec.memtimingspec.RP,
                    "RFC1": memspec.memtimingspec.RFC1,
                    "RFC2": memspec.memtimingspec.RFC2,
                    "RFCsb": memspec.memtimingspec.RFCsb,
                    "REFI": memspec.memtimingspec.REFI,
                }
            },
            "workload": {
                "BNK_PRE_percent": workload.BNK_PRE_percent,
                "CKE_LO_PRE_percent": workload.CKE_LO_PRE_percent,
                "CKE_LO_ACT_percent": workload.CKE_LO_ACT_percent,
                "PageHit_percent": workload.PageHit_percent,
                "RDsch_percent": workload.RDsch_percent,
                "RD_Data_Low_percent": workload.RD_Data_Low_percent,
                "WRsch_percent": workload.WRsch_percent,
                "WR_Data_Low_percent": workload.WR_Data_Low_percent,
                "termRDsch_percent": workload.termRDsch_percent,
                "termWRsch_percent": workload.termWRsch_percent,
                "System_tRC_ns": workload.System_tRC_ns,
                "tRRDsch_ns": workload.tRRDsch_ns,
            }
        }
        
        # Test API endpoint
        response = api_client.post("/api/calculate/core", json=request_data)
        
        assert response.status_code == 200
        result = response.json()
        
        assert "P_total_core" in result
        assert result["P_total_core"] > 0
    
    def test_end_to_end_flow(self, core_modules, api_client, sample_memspec_path, sample_workload_path):
        """Test complete end-to-end flow: core -> backend -> response."""
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
        
        # Step 2: Backend API can compute same thing
        request_data = {
            "memspec": {
                "memoryId": memspec.memoryId,
                "memoryType": memspec.memoryType,
                "memarchitecturespec": {
                    "width": memspec.memarchitecturespec.width,
                    "nbrOfBanks": memspec.memarchitecturespec.nbrOfBanks,
                    "nbrOfBankGroups": memspec.memarchitecturespec.nbrOfBankGroups,
                    "nbrOfRanks": memspec.memarchitecturespec.nbrOfRanks,
                    "nbrOfColumns": memspec.memarchitecturespec.nbrOfColumns,
                    "nbrOfRows": memspec.memarchitecturespec.nbrOfRows,
                    "nbrOfDevices": memspec.memarchitecturespec.nbrOfDevices,
                    "burstLength": memspec.memarchitecturespec.burstLength,
                    "dataRate": memspec.memarchitecturespec.dataRate,
                },
                "mempowerspec": {
                    "vdd": memspec.mempowerspec.vdd,
                    "vpp": memspec.mempowerspec.vpp,
                    "vddq": memspec.mempowerspec.vddq,
                    "idd0": memspec.mempowerspec.idd0,
                    "idd2n": memspec.mempowerspec.idd2n,
                    "idd3n": memspec.mempowerspec.idd3n,
                    "idd4r": memspec.mempowerspec.idd4r,
                    "idd4w": memspec.mempowerspec.idd4w,
                    "idd5b": memspec.mempowerspec.idd5b,
                    "idd6n": memspec.mempowerspec.idd6n,
                    "idd2p": memspec.mempowerspec.idd2p,
                    "idd3p": memspec.mempowerspec.idd3p,
                    "ipp0": memspec.mempowerspec.ipp0,
                    "ipp2n": memspec.mempowerspec.ipp2n,
                    "ipp3n": memspec.mempowerspec.ipp3n,
                    "ipp4r": memspec.mempowerspec.ipp4r,
                    "ipp4w": memspec.mempowerspec.ipp4w,
                    "ipp5b": memspec.mempowerspec.ipp5b,
                    "ipp6n": memspec.mempowerspec.ipp6n,
                    "ipp2p": memspec.mempowerspec.ipp2p,
                    "ipp3p": memspec.mempowerspec.ipp3p,
                },
                "memtimingspec": {
                    "tCK": memspec.memtimingspec.tCK,
                    "RAS": memspec.memtimingspec.RAS,
                    "RCD": memspec.memtimingspec.RCD,
                    "RP": memspec.memtimingspec.RP,
                    "RFC1": memspec.memtimingspec.RFC1,
                    "RFC2": memspec.memtimingspec.RFC2,
                    "RFCsb": memspec.memtimingspec.RFCsb,
                    "REFI": memspec.memtimingspec.REFI,
                }
            },
            "workload": {
                "BNK_PRE_percent": workload.BNK_PRE_percent,
                "CKE_LO_PRE_percent": workload.CKE_LO_PRE_percent,
                "CKE_LO_ACT_percent": workload.CKE_LO_ACT_percent,
                "PageHit_percent": workload.PageHit_percent,
                "RDsch_percent": workload.RDsch_percent,
                "RD_Data_Low_percent": workload.RD_Data_Low_percent,
                "WRsch_percent": workload.WRsch_percent,
                "WR_Data_Low_percent": workload.WR_Data_Low_percent,
                "termRDsch_percent": workload.termRDsch_percent,
                "termWRsch_percent": workload.termWRsch_percent,
                "System_tRC_ns": workload.System_tRC_ns,
                "tRRDsch_ns": workload.tRRDsch_ns,
            }
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

