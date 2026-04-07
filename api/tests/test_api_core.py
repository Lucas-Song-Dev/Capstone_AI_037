"""
Tests for core power calculation API endpoints.
"""

import pytest

from main import _registered_str_to_bool, memspec_api_model_to_obj, MemSpecRequestModel

# conftest fixtures are automatically available to pytest


def test_registered_str_to_bool():
    assert _registered_str_to_bool("false") is False
    assert _registered_str_to_bool("true") is True
    assert _registered_str_to_bool("TRUE") is True
    assert _registered_str_to_bool("1") is True
    assert _registered_str_to_bool("0") is False
    assert _registered_str_to_bool("no") is False


def test_memspec_api_model_to_obj_registered_is_bool(sample_memspec):
    model = MemSpecRequestModel(**sample_memspec)
    obj = memspec_api_model_to_obj(model)
    assert obj.registered is False
    assert isinstance(obj.registered, bool)


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


def test_health_under_api_prefix_matches_health(client):
    """GET /api/health matches /health (used when requests are under /api/* on Vercel)."""
    r1 = client.get("/health")
    r2 = client.get("/api/health")
    assert r2.status_code == 200
    assert r1.json() == r2.json()


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


def test_calculate_core_accepts_float_timing_cycles(client, sample_memspec, sample_workload):
    """Frontend/JSON may send cycle counts as floats; API coerces to int like core/parser."""
    data = {"memspec": dict(sample_memspec), "workload": sample_workload}
    t = dict(data["memspec"]["memtimingspec"])
    t["RAS"] = 76.923
    t["RCD"] = 28.4
    data["memspec"]["memtimingspec"] = t
    response = client.post("/api/calculate/core", json=data)
    assert response.status_code == 200
    assert response.json()["P_total_core"] > 0


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


def test_calculate_dimm_batch(client, sample_memspec, sample_workload):
    """Batch DIMM endpoint returns one result per memspec in order."""
    request_data = {
        "workload": sample_workload,
        "memspecs": [sample_memspec, sample_memspec],
    }
    response = client.post("/api/calculate/dimm/batch", json=request_data)
    assert response.status_code == 200
    body = response.json()
    assert "results" in body
    assert len(body["results"]) == 2
    for row in body["results"]:
        assert "P_total_core" in row
        assert "P_total" in row
        assert row["P_total_core"] > 0


def test_calculate_dimm_batch_empty(client, sample_workload):
    response = client.post(
        "/api/calculate/dimm/batch",
        json={"workload": sample_workload, "memspecs": []},
    )
    assert response.status_code == 200
    assert response.json() == {"results": []}
