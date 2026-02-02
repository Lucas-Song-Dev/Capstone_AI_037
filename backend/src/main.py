"""
FastAPI backend for DDR5 Power Calculator.

This API provides endpoints for DDR5 power calculations that can be called
from the Next.js frontend deployed on Vercel.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Optional, List
import sys
import os
from pathlib import Path

# Add core/src directory to path to import the package
# Get the project root (three levels up from backend/src/)
project_root = Path(__file__).parent.parent.parent
core_src_path = project_root / "core" / "src"
sys.path.insert(0, str(core_src_path))

from ddr5 import DDR5
from dimm import DIMM
from core_model import DDR5CorePowerModel
from interface_model import DDR5InterfacePowerModel
from parser import MemSpec, Workload

app = FastAPI(
    title="DDR5 Power Calculator API",
    description="JEDEC-compliant DDR5 power modeling API",
    version="0.1.0",
)

# CORS middleware for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your Vercel domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request/response
class MemArchitectureSpecModel(BaseModel):
    width: int
    nbrOfBanks: int
    nbrOfBankGroups: int
    nbrOfRanks: int
    nbrOfColumns: int
    nbrOfRows: int
    nbrOfDevices: int
    burstLength: int
    dataRate: int


class MemPowerSpecModel(BaseModel):
    vdd: float
    vpp: float
    vddq: float
    idd0: float
    idd2n: float
    idd3n: float
    idd4r: float
    idd4w: float
    idd5b: float
    idd6n: float
    idd2p: float
    idd3p: float
    ipp0: float
    ipp2n: float
    ipp3n: float
    ipp4r: float
    ipp4w: float
    ipp5b: float
    ipp6n: float
    ipp2p: float
    ipp3p: float


class MemTimingSpecModel(BaseModel):
    tCK: float
    RAS: int
    RCD: int
    RP: int
    RFC1: int
    RFC2: int
    RFCsb: int
    REFI: int


class MemSpecModel(BaseModel):
    memoryId: str
    memoryType: str
    memarchitecturespec: MemArchitectureSpecModel
    mempowerspec: MemPowerSpecModel
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
    memspec: MemSpecModel
    workload: WorkloadModel


def memspec_model_to_obj(memspec_model: MemSpecModel) -> MemSpec:
    """Convert Pydantic model to MemSpec object."""
    from parser import MemArchitectureSpec, MemPowerSpec, MemTimingSpec
    
    arch = MemArchitectureSpec(
        width=memspec_model.memarchitecturespec.width,
        nbrOfBanks=memspec_model.memarchitecturespec.nbrOfBanks,
        nbrOfBankGroups=memspec_model.memarchitecturespec.nbrOfBankGroups,
        nbrOfRanks=memspec_model.memarchitecturespec.nbrOfRanks,
        nbrOfColumns=memspec_model.memarchitecturespec.nbrOfColumns,
        nbrOfRows=memspec_model.memarchitecturespec.nbrOfRows,
        nbrOfDevices=memspec_model.memarchitecturespec.nbrOfDevices,
        burstLength=memspec_model.memarchitecturespec.burstLength,
        dataRate=memspec_model.memarchitecturespec.dataRate,
    )
    
    power = MemPowerSpec(
        vdd=memspec_model.mempowerspec.vdd,
        vpp=memspec_model.mempowerspec.vpp,
        vddq=memspec_model.mempowerspec.vddq,
        idd0=memspec_model.mempowerspec.idd0,
        idd2n=memspec_model.mempowerspec.idd2n,
        idd3n=memspec_model.mempowerspec.idd3n,
        idd4r=memspec_model.mempowerspec.idd4r,
        idd4w=memspec_model.mempowerspec.idd4w,
        idd5b=memspec_model.mempowerspec.idd5b,
        idd6n=memspec_model.mempowerspec.idd6n,
        idd2p=memspec_model.mempowerspec.idd2p,
        idd3p=memspec_model.mempowerspec.idd3p,
        ipp0=memspec_model.mempowerspec.ipp0,
        ipp2n=memspec_model.mempowerspec.ipp2n,
        ipp3n=memspec_model.mempowerspec.ipp3n,
        ipp4r=memspec_model.mempowerspec.ipp4r,
        ipp4w=memspec_model.mempowerspec.ipp4w,
        ipp5b=memspec_model.mempowerspec.ipp5b,
        ipp6n=memspec_model.mempowerspec.ipp6n,
        ipp2p=memspec_model.mempowerspec.ipp2p,
        ipp3p=memspec_model.mempowerspec.ipp3p,
    )
    
    timing = MemTimingSpec(
        tCK=memspec_model.memtimingspec.tCK,
        RAS=memspec_model.memtimingspec.RAS,
        RCD=memspec_model.memtimingspec.RCD,
        RP=memspec_model.memtimingspec.RP,
        RFC1=memspec_model.memtimingspec.RFC1,
        RFC2=memspec_model.memtimingspec.RFC2,
        RFCsb=memspec_model.memtimingspec.RFCsb,
        REFI=memspec_model.memtimingspec.REFI,
    )
    
    return MemSpec(
        memoryId=memspec_model.memoryId,
        memoryType=memspec_model.memoryType,
        memarchitecturespec=arch,
        mempowerspec=power,
        memtimingspec=timing,
    )


def workload_model_to_obj(workload_model: WorkloadModel) -> Workload:
    """Convert Pydantic model to Workload object."""
    from parser import Workload
    
    return Workload(
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


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "DDR5 Power Calculator API"}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/api/calculate/core", response_model=Dict[str, float])
async def calculate_core_power(request: PowerCalculationRequest):
    """
    Calculate DDR5 core power consumption.
    
    Returns a dictionary with power breakdown values in Watts.
    """
    try:
        memspec = memspec_model_to_obj(request.memspec)
        workload = workload_model_to_obj(request.workload)
        
        core_model = DDR5CorePowerModel()
        ddr5 = DDR5(memspec, workload, core_model=core_model)
        
        result = ddr5.compute_core()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calculate/interface", response_model=Dict[str, float])
async def calculate_interface_power(request: PowerCalculationRequest):
    """
    Calculate DDR5 interface power consumption.
    
    Returns a dictionary with interface power breakdown values in Watts.
    """
    try:
        memspec = memspec_model_to_obj(request.memspec)
        workload = workload_model_to_obj(request.workload)
        
        interface_model = DDR5InterfacePowerModel()
        ddr5 = DDR5(memspec, workload, interface_model=interface_model)
        
        result = ddr5.compute_interface()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calculate/all", response_model=Dict[str, float])
async def calculate_all_power(request: PowerCalculationRequest):
    """
    Calculate both core and interface power consumption.
    
    Returns a dictionary with complete power breakdown values in Watts.
    """
    try:
        memspec = memspec_model_to_obj(request.memspec)
        workload = workload_model_to_obj(request.workload)
        
        core_model = DDR5CorePowerModel()
        interface_model = DDR5InterfacePowerModel()
        ddr5 = DDR5(memspec, workload, core_model=core_model, interface_model=interface_model)
        
        result = ddr5.compute_all()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calculate/dimm", response_model=Dict[str, float])
async def calculate_dimm_power(request: PowerCalculationRequest):
    """
    Calculate DIMM-level power consumption.
    
    Returns a dictionary with DIMM power breakdown values in Watts.
    """
    try:
        memspec = memspec_model_to_obj(request.memspec)
        workload = workload_model_to_obj(request.workload)
        
        # Create DIMM with multiple DRAM devices
        core_model = DDR5CorePowerModel()
        interface_model = DDR5InterfacePowerModel()
        
        nbr_of_devices = memspec.memarchitecturespec.nbrOfDevices or 1
        dram_list = []
        
        for _ in range(nbr_of_devices):
            dram = DDR5(memspec, workload, core_model=core_model, interface_model=interface_model)
            dram_list.append(dram)
        
        dimm = DIMM(memspec, workload, dram_list)
        result = dimm.compute_all()
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

