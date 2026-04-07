"""
Tests for interface power calculation API endpoints.
"""

import pytest
# conftest fixtures are automatically available to pytest


def test_calculate_interface_power(client, sample_memspec, sample_workload):
    """Test interface power calculation endpoint."""
    request_data = {
        "memspec": sample_memspec,
        "workload": sample_workload
    }
    
    response = client.post("/api/calculate/interface", json=request_data)
    
    assert response.status_code == 200
    result = response.json()
    
    assert "P_total_interface" in result
    assert isinstance(result["P_total_interface"], float)


def test_calculate_dimm_power(client, sample_memspec, sample_workload):
    """Test DIMM power calculation endpoint."""
    request_data = {
        "memspec": sample_memspec,
        "workload": sample_workload
    }
    
    response = client.post("/api/calculate/dimm", json=request_data)
    
    assert response.status_code == 200
    result = response.json()
    
    assert result is not None
    assert isinstance(result, dict)


def test_calculate_core_lpddr5x(client, sample_lpddr_memspec, sample_workload):
    response = client.post(
        "/api/calculate/core",
        json={"memspec": sample_lpddr_memspec, "workload": sample_workload},
    )
    assert response.status_code == 200
    r = response.json()
    assert "P_total_core" in r
    assert r["P_total_core"] > 0
    assert "P_VDD1" in r or "P_VDD2H" in r


def test_calculate_dimm_lpddr5x(client, sample_lpddr_memspec, sample_workload):
    response = client.post(
        "/api/calculate/dimm",
        json={"memspec": sample_lpddr_memspec, "workload": sample_workload},
    )
    assert response.status_code == 200
    r = response.json()
    assert "P_total_core" in r
    assert "P_total" in r
