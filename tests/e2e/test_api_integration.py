"""
Tests for API integration with core package.
"""

import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add backend/src to path
project_root = Path(__file__).parent.parent.parent
backend_src = project_root / "backend" / "src"
sys.path.insert(0, str(backend_src))

# Import will be done in test functions


class TestAPIIntegration:
    """Test API integration with core package."""
    
    @pytest.fixture
    def client(self):
        """Create test client."""
        from main import app
        return TestClient(app)
    
    def test_api_health(self, client):
        """Test API health endpoints."""
        response = client.get("/")
        assert response.status_code == 200
        
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"
    
    def test_all_endpoints_exist(self, client):
        """Test that all API endpoints are accessible."""
        # Use minimal valid data
        minimal_request = {
            "memspec": {
                "memoryId": "test",
                "memoryType": "DDR5",
                "memarchitecturespec": {
                    "width": 8,
                    "nbrOfBanks": 16,
                    "nbrOfBankGroups": 8,
                    "nbrOfRanks": 1,
                    "nbrOfColumns": 1024,
                    "nbrOfRows": 65536,
                    "nbrOfDevices": 1,
                    "burstLength": 16,
                    "dataRate": 2
                },
                "mempowerspec": {
                    "vdd": 1.1, "vpp": 1.8, "vddq": 1.1,
                    "idd0": 50.0, "idd2n": 46.0, "idd3n": 105.0,
                    "idd4r": 210.0, "idd4w": 245.0, "idd5b": 10500.0,
                    "idd6n": 46.0, "idd2p": 43.0, "idd3p": 102.0,
                    "ipp0": 5.0, "ipp2n": 4.5, "ipp3n": 10.0,
                    "ipp4r": 20.0, "ipp4w": 25.0, "ipp5b": 1000.0,
                    "ipp6n": 4.5, "ipp2p": 4.0, "ipp3p": 9.5
                },
                "memtimingspec": {
                    "tCK": 0.416e-9, "RAS": 28, "RCD": 28, "RP": 14,
                    "RFC1": 350, "RFC2": 260, "RFCsb": 140, "REFI": 7800
                }
            },
            "workload": {
                "BNK_PRE_percent": 50.0,
                "CKE_LO_PRE_percent": 0.0,
                "CKE_LO_ACT_percent": 0.0,
                "PageHit_percent": 50.0,
                "RDsch_percent": 50.0,
                "RD_Data_Low_percent": 25.0,
                "WRsch_percent": 50.0,
                "WR_Data_Low_percent": 25.0,
                "termRDsch_percent": 50.0,
                "termWRsch_percent": 50.0,
                "System_tRC_ns": 46.0,
                "tRRDsch_ns": 4.0
            }
        }
        
        endpoints = [
            "/api/calculate/core",
            "/api/calculate/interface",
            "/api/calculate/all",
            "/api/calculate/dimm"
        ]
        
        for endpoint in endpoints:
            response = client.post(endpoint, json=minimal_request)
            assert response.status_code == 200, f"Endpoint {endpoint} failed"
            assert response.json() is not None

