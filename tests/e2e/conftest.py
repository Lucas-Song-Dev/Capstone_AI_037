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

# Add api to path (main.py is in api/)
api_path = project_root / "api"
sys.path.insert(0, str(api_path))


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


@pytest.fixture
def api_compatible_memspec():
    """Payload for calculate routes; includes fields required on main (registered, nbrOfDBs)."""
    return {
        "memoryId": "test_ddr5",
        "memoryType": "DDR5",
        "registered": "false",
        "memarchitecturespec": {
            "width": 8,
            "nbrOfBanks": 16,
            "nbrOfBankGroups": 8,
            "nbrOfRanks": 1,
            "nbrOfColumns": 1024,
            "nbrOfRows": 65536,
            "nbrOfDevices": 1,
            "nbrOfDBs": 8,
            "burstLength": 16,
            "dataRate": 2,
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
            "ipp3p": 9.5,
        },
        "memtimingspec": {
            "tCK": 0.416e-9,
            "RAS": 28,
            "RCD": 28,
            "RP": 14,
            "RFC1": 350,
            "RFC2": 260,
            "RFCsb": 140,
            "REFI": 7800,
        },
    }


@pytest.fixture
def api_compatible_lpddr_memspec():
    """LPDDR5X-style payload for calculate routes (matches api/tests sample_lpddr_memspec)."""
    t_ck = 1.0 / 3.75e9
    return {
        "memoryId": "test_lpddr5x",
        "memoryType": "LPDDR5X",
        "registered": "false",
        "memarchitecturespec": {
            "width": 16,
            "nbrOfBanks": 16,
            "nbrOfBankGroups": 4,
            "nbrOfRanks": 1,
            "nbrOfColumns": 64,
            "nbrOfRows": 49152,
            "nbrOfDevices": 1,
            "nbrOfDBs": 0,
            "burstLength": 16,
            "dataRate": 2,
        },
        "mempowerspec": {
            "rails": {
                "vdd1_range_V": [1.70, 1.95],
                "vdd2h_range_V": [1.01, 1.12],
                "vdd2l_range_V": [0.87, 0.97],
                "vddq_range_V": [0.47, 0.57],
            },
            "idd_by_rail_A": {
                "idd0": {"vdd1": 0.01, "vdd2h": 0.05, "vdd2l": 0.001, "vddq": 0.001},
                "idd2n": {"vdd1": 1.5e-3, "vdd2h": 16.0e-3, "vdd2l": 0.2e-3, "vddq": 0.6e-3},
                "idd2p": {"vdd1": 1.0e-3, "vdd2h": 10.0e-3, "vdd2l": 0.2e-3, "vddq": 0.5e-3},
                "idd3n": {"vdd1": 1.7e-3, "vdd2h": 21.0e-3, "vdd2l": 0.2e-3, "vddq": 0.6e-3},
                "idd3p": {"vdd1": 1.0e-3, "vdd2h": 12.0e-3, "vdd2l": 0.2e-3, "vddq": 0.5e-3},
                "idd4r": {"vdd1": 12.0e-3, "vdd2h": 475.0e-3, "vdd2l": 0.2e-3, "vddq_read": 126.0e-3},
                "idd4w": {"vdd1": 11.0e-3, "vdd2h": 310.0e-3, "vdd2l": 0.2e-3, "vddq": 0.6e-3},
                "idd5b_allbank": {"vdd1": 2.5e-3, "vdd2h": 24.0e-3, "vdd2l": 0.2e-3, "vddq": 0.6e-3},
                "idd6n": {"vdd1": 1.0e-3, "vdd2h": 8.0e-3, "vdd2l": 0.2e-3, "vddq": 0.5e-3},
            },
        },
        "memtimingspec": {
            "tCK": t_ck,
            "RAS": 0,
            "RCD": 0,
            "RP": 0,
            "RFC1": 0,
            "RFC2": 0,
            "RFCsb": 0,
            "REFI": 0,
            "RFCab_ns": 280.0,
            "RFCpb_ns": 140.0,
            "PBR2PBR_ns": 90.0,
            "PBR2ACT_ns": 7.5,
        },
    }


@pytest.fixture
def api_compatible_workload():
    """Same shape as api/tests/conftest sample_workload."""
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
        "tRRDsch_ns": 4.0,
    }

