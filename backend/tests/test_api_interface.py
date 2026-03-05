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

