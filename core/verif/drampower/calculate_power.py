#!/usr/bin/env python3
"""
read_drampower_json.py

Reads DRAMPower output JSON and prints:
- Core power (W)
- Interface power (W)
- Total power (W)
- Per-state/component average power (W)

All values are printed in decimal (not scientific notation).
"""

import argparse
import json
from typing import Dict, Any

CORE_BANK_FIELDS = [
    "ACT", "PRE", "RD", "WR",
    "BG_ACT", "BG_PRE",
    "REF_AB", "REF_PB", "REF_SB", "REF_2B",
    "RDA", "WRA", "PRE_RDA", "PRE_WRA",
]

CORE_SHARED_FIELDS = [
    "E_bg_act_shared",
    "E_PDNA", "E_PDNP",
    "E_refab", "E_sref",
    "E_dsm",
]

def safe_get(d: Dict[str, Any], *keys, default=None):
    cur = d
    for k in keys:
        if not isinstance(cur, dict) or k not in cur:
            return default
        cur = cur[k]
    return cur

def sum_interface_energy_j(d: Dict[str, Any]) -> float:
    iface = d.get("InterfaceEnergy", {})
    ctrl = iface.get("controller", {})
    dram = iface.get("dram", {})
    return (
        float(ctrl.get("dynamicEnergy", 0.0)) +
        float(ctrl.get("staticEnergy", 0.0)) +
        float(dram.get("dynamicEnergy", 0.0)) +
        float(dram.get("staticEnergy", 0.0))
    )

def sum_core_bank_energies_j(d: Dict[str, Any]) -> Dict[str, float]:
    out = {k: 0.0 for k in CORE_BANK_FIELDS}
    bank_list = safe_get(d, "CoreEnergy", "BankEnergy", default=[])
    if not isinstance(bank_list, list):
        return out
    for b in bank_list:
        if not isinstance(b, dict):
            continue
        for k in CORE_BANK_FIELDS:
            out[k] += float(b.get(k, 0.0))
    return out

def sum_core_shared_energies_j(d: Dict[str, Any]) -> Dict[str, float]:
    out = {k: 0.0 for k in CORE_SHARED_FIELDS}
    core = d.get("CoreEnergy", {})
    for k in CORE_SHARED_FIELDS:
        out[k] = float(core.get(k, 0.0))
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", required=True)
    ap.add_argument("--cycles", type=int, required=True)
    ap.add_argument("--tck", type=float, default=None)
    ap.add_argument("--memspec_json", default=None)
    args = ap.parse_args()

    with open(args.json, "r") as f:
        out = json.load(f)

    # Determine tCK
    tCK = args.tck
    if tCK is None:
        # DRAMPower CLI output JSON typically does not include the memspec.
        # Keep a couple of fallbacks in case a different wrapper embeds it.
        tCK = safe_get(out, "memtimingspec", "tCK", default=None)
        if tCK is None:
            tCK = safe_get(out, "memspec", "memtimingspec", "tCK", default=None)
        if tCK is None and args.memspec_json:
            with open(args.memspec_json, "r") as mf:
                mem = json.load(mf)
            tCK = safe_get(mem, "memtimingspec", "tCK", default=None)
            if tCK is None:
                tCK = safe_get(mem, "memspec", "memtimingspec", "tCK", default=None)

    if tCK is None:
        raise RuntimeError("tCK not found")

    tCK = float(tCK)
    cycles = int(args.cycles)
    T = cycles * tCK
    if T <= 0:
        raise ValueError("Computed time T <= 0")

    # Energies
    E_total = float(out.get("TotalEnergy", 0.0))
    E_iface = sum_interface_energy_j(out)
    E_core = E_total - E_iface

    bank_E = sum_core_bank_energies_j(out)
    shared_E = sum_core_shared_energies_j(out)

    # Powers
    P_total = E_total / T
    P_iface = E_iface / T
    P_core = E_core / T

    print("=== Time base ===")
    print(f"cycles              : {cycles}")
    print(f"tCK (s)             : {tCK:.12e}")
    print(f"total time T (s)    : {T:.12e}")
    print()

    print("=== Total / Core / Interface (Average Power) ===")
    print(f"Total power (W)     : {P_total:.12f}")
    print(f"Core power (W)      : {P_core:.12f}")
    print(f"Interface power (W) : {P_iface:.12f}")
    print()

    iface = out.get("InterfaceEnergy", {})
    ctrl = iface.get("controller", {})
    dram = iface.get("dram", {})

    print("=== Interface breakdown (Average Power, W) ===")
    print(f"controller.dynamic  : {float(ctrl.get('dynamicEnergy',0.0))/T:.12f}")
    print(f"controller.static   : {float(ctrl.get('staticEnergy',0.0))/T:.12f}")
    print(f"dram.dynamic        : {float(dram.get('dynamicEnergy',0.0))/T:.12f}")
    print(f"dram.static         : {float(dram.get('staticEnergy',0.0))/T:.12f}")
    print()

    print("=== Core breakdown (Bank-summed components, Average Power, W) ===")
    for k in CORE_BANK_FIELDS:
        Pk = bank_E[k] / T
        if abs(Pk) > 0:
            print(f"{k:10s}: {Pk:.12f}")
    print()

    print("=== Core shared components (Average Power, W) ===")
    for k in CORE_SHARED_FIELDS:
        Pk = shared_E[k] / T
        if abs(Pk) > 0:
            print(f"{k:14s}: {Pk:.12f}")
    print()

    E_core_recon = sum(bank_E.values()) + sum(shared_E.values())
    print("=== Sanity checks ===")
    print(f"E_total (J)         : {E_total:.12e}")
    print(f"E_iface (J)         : {E_iface:.12e}")
    print(f"E_core (J)          : {E_core:.12e}")
    print(f"E_core_recon (J)    : {E_core_recon:.12e}")
    print(f"core recon error (J): {(E_core_recon - E_core):.12e}")

if __name__ == "__main__":
    main()
