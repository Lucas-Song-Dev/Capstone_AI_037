"""
FastAPI API for DDR5 / LPDDR5 / LPDDR5X power calculator (core package).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, field_validator
from typing import Dict, Optional, List, Any
import sys
import os
from pathlib import Path

# Add core/src directory to path to import the package
project_root = Path(__file__).parent.parent
core_src_path = project_root / "core" / "src"
sys.path.insert(0, str(core_src_path))

from ddr5 import DDR5
from lpddr5 import LPDDR5
from dimm import DIMM
from core_model import DDR5CorePowerModel
from interface_model import DDR5InterfacePowerModel
from lpddr5_core_model import LPDDR5CorePowerModel
from lpddr5_interface_model import LPDDR5InterfacePowerModel
from parser import MemSpec, Workload, parse_memspec_dict

app = FastAPI(
    title="DDR5 / LPDDR5 Power Calculator API",
    description="JEDEC-aligned DDR5 and LPDDR5/LPDDR5X power modeling (core package)",
    version="0.1.0",
)

# CORS: use CORS_ORIGINS env (e.g. https://your-app.vercel.app) in production; "*" for dev
_cors_origins = os.environ.get("CORS_ORIGINS", "*")
_cors_origins_list = [o.strip() for o in _cors_origins.split(",")] if _cors_origins != "*" else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MemArchitectureSpecModel(BaseModel):
    width: int
    nbrOfBanks: int
    nbrOfBankGroups: int
    nbrOfRanks: int
    nbrOfColumns: int
    nbrOfRows: int
    nbrOfDevices: int
    nbrOfDBs: int
    burstLength: int
    dataRate: int

    @field_validator(
        "width",
        "nbrOfBanks",
        "nbrOfBankGroups",
        "nbrOfRanks",
        "nbrOfColumns",
        "nbrOfRows",
        "nbrOfDevices",
        "nbrOfDBs",
        "burstLength",
        "dataRate",
        mode="before",
    )
    @classmethod
    def _coerce_arch_ints(cls, v):
        if isinstance(v, float):
            return int(round(v))
        return v


class MemTimingSpecModel(BaseModel):
    tCK: float = 0.0
    RAS: int = 0
    RCD: int = 0
    RP: int = 0
    RFC1: int = 0
    RFC2: int = 0
    RFCsb: int = 0
    REFI: int = 0
    RFCab_ns: float = 0.0
    RFCpb_ns: float = 0.0
    PBR2PBR_ns: float = 0.0
    PBR2ACT_ns: float = 0.0

    @field_validator(
        "RAS",
        "RCD",
        "RP",
        "RFC1",
        "RFC2",
        "RFCsb",
        "REFI",
        mode="before",
    )
    @classmethod
    def _coerce_timing_cycles(cls, v):
        if isinstance(v, float):
            return int(round(v))
        return v


class MemSpecRequestModel(BaseModel):
    """Mempowerspec is a free-form dict (DDR5 scalars or LPDDR rails / idd_by_rail_A). Parsed by core ``parse_memspec_dict``."""

    memoryId: str
    memoryType: str
    registered: Any
    memarchitecturespec: MemArchitectureSpecModel
    mempowerspec: Dict[str, Any]
    memtimingspec: MemTimingSpecModel


class WorkloadModel(BaseModel):
    BNK_PRE_percent: float
    CKE_LO_PRE_percent: float
    CKE_LO_ACT_percent: float
    PageHit_percent: float
    RDsch_percent: float
    RD_Data_Low_percent: float
    WRsch_percent: float
    WR_Data_Low_percent: float
    termRDsch_percent: float
    termWRsch_percent: float
    System_tRC_ns: float
    tRRDsch_ns: float


class PowerCalculationRequest(BaseModel):
    memspec: MemSpecRequestModel
    workload: WorkloadModel


class BatchDimmPowerRequest(BaseModel):
    workload: WorkloadModel
    memspecs: List[MemSpecRequestModel]


MAX_DIMM_BATCH = 512


def _registered_str_to_bool(s: str) -> bool:
    """API / tests: string registered field to bool ('false', '0', 'no' -> False)."""
    t = str(s).strip().lower()
    return t in ("true", "1", "yes")


def memspec_api_model_to_obj(m: MemSpecRequestModel) -> MemSpec:
    raw = {
        "memoryId": m.memoryId,
        "memoryType": m.memoryType,
        "registered": m.registered,
        "memarchitecturespec": m.memarchitecturespec.model_dump(),
        "mempowerspec": dict(m.mempowerspec),
        "memtimingspec": m.memtimingspec.model_dump(),
    }
    return parse_memspec_dict(raw)


def workload_model_to_obj(workload_model: WorkloadModel) -> Workload:
    from parser import Workload as W

    return W(
        BNK_PRE_percent=workload_model.BNK_PRE_percent,
        CKE_LO_PRE_percent=workload_model.CKE_LO_PRE_percent,
        CKE_LO_ACT_percent=workload_model.CKE_LO_ACT_percent,
        PageHit_percent=workload_model.PageHit_percent,
        RDsch_percent=workload_model.RDsch_percent,
        RD_Data_Low_percent=workload_model.RD_Data_Low_percent,
        WRsch_percent=workload_model.WRsch_percent,
        WR_Data_Low_percent=workload_model.WR_Data_Low_percent,
        termRDsch_percent=workload_model.termRDsch_percent,
        termWRsch_percent=workload_model.termWRsch_percent,
        System_tRC_ns=workload_model.System_tRC_ns,
        tRRDsch_ns=workload_model.tRRDsch_ns,
    )


def _is_lpddr(memspec: MemSpec) -> bool:
    return memspec.mempowerspec.memoryType.upper() in ("LPDDR5", "LPDDR5X")


def compute_core_result(memspec: MemSpec, workload: Workload) -> Dict[str, float]:
    if _is_lpddr(memspec):
        core_model = LPDDR5CorePowerModel()
        dram = LPDDR5(memspec, workload, core_model=core_model)
        return dram.compute_core()
    core_model = DDR5CorePowerModel()
    dram = DDR5(memspec, workload, core_model=core_model)
    return dram.compute_core()


def compute_interface_result(memspec: MemSpec, workload: Workload) -> Dict[str, float]:
    if _is_lpddr(memspec):
        interface_model = LPDDR5InterfacePowerModel()
        return interface_model.compute(memspec, workload)
    interface_model = DDR5InterfacePowerModel()
    return interface_model.compute(memspec, workload)


def compute_dimm_result(memspec: MemSpec, workload: Workload) -> Dict[str, float]:
    if _is_lpddr(memspec):
        dimm = DIMM.from_memspec(
            memspec,
            workload,
            core_model=LPDDR5CorePowerModel(),
            interface_model=LPDDR5InterfacePowerModel(),
            dram_cls=LPDDR5,
        )
        return dimm.compute_all()
    dimm = DIMM.from_memspec(
        memspec,
        workload,
        core_model=DDR5CorePowerModel(),
        interface_model=DDR5InterfacePowerModel(),
    )
    return dimm.compute_all()


def _parse_request_memspec(m: MemSpecRequestModel) -> MemSpec:
    try:
        return memspec_api_model_to_obj(m)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@app.get("/")
async def root():
    return {"status": "ok", "message": "DDR5 / LPDDR5 Power Calculator API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/health")
async def health_under_api_prefix():
    return await health()


@app.post("/api/calculate/core", response_model=Dict[str, float])
async def calculate_core_power(request: PowerCalculationRequest):
    try:
        memspec = _parse_request_memspec(request.memspec)
        workload = workload_model_to_obj(request.workload)
        return compute_core_result(memspec, workload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/calculate/interface", response_model=Dict[str, float])
async def calculate_interface_power(request: PowerCalculationRequest):
    try:
        memspec = _parse_request_memspec(request.memspec)
        workload = workload_model_to_obj(request.workload)
        return compute_interface_result(memspec, workload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/calculate/all", response_model=Dict[str, float])
async def calculate_all_power(request: PowerCalculationRequest):
    try:
        memspec = _parse_request_memspec(request.memspec)
        workload = workload_model_to_obj(request.workload)
        core_result = compute_core_result(memspec, workload)
        interface_result = compute_interface_result(memspec, workload)
        result = dict(core_result)
        result.update(interface_result)
        result["P_total_interface"] = interface_result.get("P_total_interface", 0.0)
        result["P_total"] = core_result.get("P_total_core", 0.0) + result["P_total_interface"]
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/calculate/dimm", response_model=Dict[str, float])
async def calculate_dimm_power(request: PowerCalculationRequest):
    try:
        memspec = _parse_request_memspec(request.memspec)
        workload = workload_model_to_obj(request.workload)
        return compute_dimm_result(memspec, workload)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.post("/api/calculate/dimm/batch")
async def calculate_dimm_power_batch(request: BatchDimmPowerRequest):
    if len(request.memspecs) == 0:
        return {"results": []}
    if len(request.memspecs) > MAX_DIMM_BATCH:
        raise HTTPException(
            status_code=400,
            detail=f"At most {MAX_DIMM_BATCH} memspecs per batch",
        )
    try:
        workload = workload_model_to_obj(request.workload)
        results: List[Dict[str, float]] = []
        for m_model in request.memspecs:
            memspec = _parse_request_memspec(m_model)
            results.append(compute_dimm_result(memspec, workload))
        return {"results": results}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
