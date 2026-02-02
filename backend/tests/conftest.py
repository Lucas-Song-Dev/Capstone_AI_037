"""
Pytest fixtures for backend API tests.
"""

import pytest
import sys
from pathlib import Path

# Add core/src to path for imports
project_root = Path(__file__).parent.parent.parent
core_src = project_root / "core" / "src"
sys.path.insert(0, str(core_src))

from fastapi.testclient import TestClient

# Add backend/src to path
backend_src = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(backend_src))

from main import app


@pytest.fixture
def client():
    """Create a test client for the FastAPI app."""
    return TestClient(app)


@pytest.fixture
def sample_memspec():
    """Sample memspec data for testing."""
    return {
        "memoryId": "test_ddr5",
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
            "vdd": 1.1,
            "vpp": 1.8,
            "vddq": 1.1,
            "idd0": 50.0,
            "idd2n": 46.0,
            "idd3n": 105.0,
            "idd4r": 210.0,
            "idd4w": 245.0,
            "idd5b": 10500.0,
            "idd6n": 46.0,
            "idd2p": 43.0,
            "idd3p": 102.0,
            "ipp0": 5.0,
            "ipp2n": 4.5,
            "ipp3n": 10.0,
            "ipp4r": 20.0,
            "ipp4w": 25.0,
            "ipp5b": 1000.0,
            "ipp6n": 4.5,
            "ipp2p": 4.0,
            "ipp3p": 9.5
        },
        "memtimingspec": {
            "tCK": 0.416e-9,
            "RAS": 28,
            "RCD": 28,
            "RP": 14,
            "RFC1": 350,
            "RFC2": 260,
            "RFCsb": 140,
            "REFI": 7800
        }
    }


@pytest.fixture
def sample_workload():
    """Sample workload data for testing."""
    return {
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

