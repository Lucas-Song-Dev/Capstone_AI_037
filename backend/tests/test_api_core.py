"""
Tests for core power calculation API endpoints.
"""

import pytest
# conftest fixtures are automatically available to pytest


def test_health_endpoint(client):
    """Test health check endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_health_check_endpoint(client):
    """Test /health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_calculate_core_power(client, sample_memspec, sample_workload):
    """Test core power calculation endpoint."""
    request_data = {
        "memspec": sample_memspec,
        "workload": sample_workload
    }
    
    response = client.post("/api/calculate/core", json=request_data)
    
    assert response.status_code == 200
    result = response.json()
    
    assert "P_total_core" in result
    assert isinstance(result["P_total_core"], float)
    assert result["P_total_core"] > 0


def test_calculate_core_power_invalid_data(client):
    """Test core power calculation with invalid data."""
    response = client.post("/api/calculate/core", json={"invalid": "data"})
    assert response.status_code == 422  # Validation error


def test_calculate_all_power(client, sample_memspec, sample_workload):
    """Test complete power calculation endpoint."""
    request_data = {
        "memspec": sample_memspec,
        "workload": sample_workload
    }
    
    response = client.post("/api/calculate/all", json=request_data)
    
    assert response.status_code == 200
    result = response.json()
    
    assert "P_total_core" in result
    assert "P_total_interface" in result
    assert "P_total" in result

