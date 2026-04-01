#!/usr/bin/env python3
"""
Smoke test a deployed (or local) FastAPI instance.

Checks GET /api/health (or /health) and POST /api/calculate/core with the same
sample payload shape as api/tests/conftest.py.

Usage:
  set API_URL=https://your-deployment.vercel.app
  python api/scripts/smoke_deploy.py

Local uvicorn (from api/):
  set API_URL=http://127.0.0.1:8000
  python scripts/smoke_deploy.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request

SAMPLE_MEMSPEC = {
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

SAMPLE_WORKLOAD = {
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


def _get(url: str, timeout: float = 30.0) -> tuple[int, str]:
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode()
        return resp.status, body


def _post_json(url: str, payload: dict, timeout: float = 60.0) -> tuple[int, str]:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = resp.read().decode()
        return resp.status, body


def main() -> int:
    base = os.environ.get("API_URL", "http://127.0.0.1:8000").rstrip("/")

    health_ok = False
    for path in ("/api/health", "/health"):
        url = f"{base}{path}"
        try:
            status, body = _get(url)
            if status == 200 and "healthy" in body:
                print(f"OK GET {path} -> {body.strip()}")
                health_ok = True
                break
        except urllib.error.HTTPError as e:
            print(f"FAIL GET {path}: HTTP {e.code}")
        except urllib.error.URLError as e:
            print(f"FAIL GET {path}: {e.reason}")

    if not health_ok:
        print("Smoke test failed: no working health endpoint.", file=sys.stderr)
        return 1

    calc_url = f"{base}/api/calculate/core"
    try:
        status, body = _post_json(
            calc_url,
            {"memspec": SAMPLE_MEMSPEC, "workload": SAMPLE_WORKLOAD},
        )
        if status != 200:
            print(f"FAIL POST /api/calculate/core: HTTP {status}\n{body}", file=sys.stderr)
            return 1
        out = json.loads(body)
        if "P_total_core" not in out:
            print(f"FAIL: missing P_total_core in response: {body[:500]}", file=sys.stderr)
            return 1
        print(f"OK POST /api/calculate/core -> P_total_core={out['P_total_core']}")
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        print(f"FAIL POST /api/calculate/core: HTTP {e.code}\n{err_body}", file=sys.stderr)
        return 1
    except urllib.error.URLError as e:
        print(f"FAIL POST /api/calculate/core: {e.reason}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
