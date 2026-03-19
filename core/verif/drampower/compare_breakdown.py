#!/usr/bin/env python3
"""
compare_breakdown.py

Parses:
  1) A DRAMPower summary text produced by `calculate_power.py`
  2) Our DIMM POWER REPORT text

Outputs:
  - Long-form CSV comparing overlapping buckets
  - A bar-plot PNG for quick visual inspection
"""

from __future__ import annotations

import argparse
import csv
import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


_NUM = r"[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?"

# Our DIMM report does not include BNK_PRE_percent, but DRAMPower's BG_PRE is a
# time-weighted average across the trace. To compare meaningfully, we apply a
# fixed bank-precharged fraction here.
#
# If you change the workload used to produce our DIMM report, update this value.
DEFAULT_BNK_PRE_FRAC = 0.048  # 4.8%


def _read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def parse_drampower_summary(path: Path) -> Dict[str, float]:
    """
    Parse the human-readable summary printed by `calculate_power.py`.
    Returns a flat dict of key -> power (W) plus timebase fields.
    """
    text = _read_text(path)
    out: Dict[str, float] = {}

    # Time base
    m = re.search(rf"^cycles\s*:\s*(\d+)\s*$", text, flags=re.M)
    if m:
        out["meta.cycles"] = float(m.group(1))
    m = re.search(rf"^tCK \(s\)\s*:\s*({_NUM})\s*$", text, flags=re.M)
    if m:
        out["meta.tCK_s"] = float(m.group(1))
    m = re.search(rf"^total time T \(s\)\s*:\s*({_NUM})\s*$", text, flags=re.M)
    if m:
        out["meta.T_s"] = float(m.group(1))

    # Totals
    for label, key in [
        ("Total power (W)", "P_total"),
        ("Core power (W)", "P_core"),
        ("Interface power (W)", "P_interface"),
    ]:
        m = re.search(rf"^{re.escape(label)}\s*:\s*({_NUM})\s*$", text, flags=re.M)
        if m:
            out[key] = float(m.group(1))

    # Interface breakdown
    for label, key in [
        ("controller.dynamic", "if.controller.dynamic"),
        ("controller.static", "if.controller.static"),
        ("dram.dynamic", "if.dram.dynamic"),
        ("dram.static", "if.dram.static"),
    ]:
        m = re.search(rf"^{re.escape(label)}\s*:\s*({_NUM})\s*$", text, flags=re.M)
        if m:
            out[key] = float(m.group(1))

    # Core bank-summed components
    bank_fields = [
        "ACT",
        "PRE",
        "RD",
        "WR",
        "BG_ACT",
        "BG_PRE",
        "REF_AB",
        "REF_PB",
        "REF_SB",
        "REF_2B",
    ]
    for f in bank_fields:
        m = re.search(rf"^{re.escape(f)}\s*:\s*({_NUM})\s*$", text, flags=re.M)
        if m:
            out[f"core.{f}"] = float(m.group(1))

    # Core shared components
    shared_fields = [
        "E_bg_act_shared",
        "E_PDNA",
        "E_PDNP",
        "E_refab",
        "E_sref",
        "E_dsm",
    ]
    for f in shared_fields:
        m = re.search(rf"^{re.escape(f)}\s*:\s*({_NUM})\s*$", text, flags=re.M)
        if m:
            out[f"core_shared.{f}"] = float(m.group(1))

    return out


@dataclass
class OurMeta:
    memory_id: Optional[str] = None
    device_width_bits: Optional[int] = None
    ranks: Optional[int] = None
    devices_modeled: Optional[int] = None


def parse_our_dimm_report(path: Path) -> Tuple[Dict[str, float], OurMeta]:
    """
    Parse the DIMM POWER REPORT output text.
    Returns (flat dict of key->power W, meta).
    """
    text = _read_text(path)
    out: Dict[str, float] = {}
    meta = OurMeta()

    m = re.search(r"^Memory:\s*(.+?)\s*$", text, flags=re.M)
    if m:
        meta.memory_id = m.group(1).strip()
    m = re.search(r"^Device width:\s*x(\d+)\s*$", text, flags=re.M)
    if m:
        meta.device_width_bits = int(m.group(1))
    m = re.search(r"^Ranks:\s*(\d+)\s*\|\s*# of DRAM devices \(modeled\):\s*(\d+)\s*$", text, flags=re.M)
    if m:
        meta.ranks = int(m.group(1))
        meta.devices_modeled = int(m.group(2))

    # Core breakdown
    for k in [
        "P_PRE_STBY_core",
        "P_ACT_STBY_core",
        "P_ACT_PRE_core",
        "P_RD_core",
        "P_WR_core",
        "P_REF_core",
        "P_VDD_core",
        "P_VPP_core",
        "P_total_core",
    ]:
        m = re.search(rf"^\s*{re.escape(k)}\s*:\s*({_NUM})\s*$", text, flags=re.M)
        if m:
            out[f"core.{k}"] = float(m.group(1))

    # Interface breakdown (termination)
    for k in [
        "P_DQ_WRITE",
        "P_DQ_READ",
        "P_CA",
        "P_CK",
        "P_WCK",
        "P_DQS",
        "P_CS",
        "P_total_interface_term",
    ]:
        m = re.search(rf"^\s*{re.escape(k)}\s*:\s*({_NUM})\s*$", text, flags=re.M)
        if m:
            out[f"if_term.{k}"] = float(m.group(1))

    # Interface breakdown (dynamic)
    for k in [
        "P_dyn_dq_W",
        "P_dyn_ca_W",
        "P_dyn_cs_W",
        "P_dyn_ck_W",
        "P_dyn_dqs_W",
        "P_dyn_wck_W",
        "P_total_interface_dyn",
    ]:
        m = re.search(rf"^\s*{re.escape(k)}\s*:\s*({_NUM})\s*$", text, flags=re.M)
        if m:
            out[f"if_dyn.{k}"] = float(m.group(1))

    # Totals
    for k, out_key in [
        ("P_total_interface", "P_interface"),
        ("P_TOTAL_DIMM", "P_total"),
    ]:
        m = re.search(rf"^\s*{re.escape(k)}\s*:\s*({_NUM})\s*$", text, flags=re.M)
        if m:
            out[out_key] = float(m.group(1))

    # Convenience rollups
    if "if_term.P_total_interface_term" in out and "if_dyn.P_total_interface_dyn" in out:
        out["P_interface_recon"] = out["if_term.P_total_interface_term"] + out["if_dyn.P_total_interface_dyn"]

    if "core.P_total_core" in out and "P_interface" in out:
        out["P_total_recon"] = out["core.P_total_core"] + out["P_interface"]

    return out, meta


@dataclass
class CompareRow:
    bucket: str
    drampower_w: Optional[float]
    our_w: Optional[float]
    abs_err_w: Optional[float]
    pct_err: Optional[float]
    comparable: bool


def _err(drampower_w: Optional[float], our_w: Optional[float], comparable: bool) -> Tuple[Optional[float], Optional[float]]:
    if not comparable or drampower_w is None or our_w is None:
        return None, None
    abs_err = our_w - drampower_w
    pct = (abs_err / drampower_w * 100.0) if drampower_w != 0 else None
    return abs_err, pct


def build_comparison(dr: Dict[str, float], ours: Dict[str, float]) -> List[CompareRow]:
    """
    Build a comparison table focused on:
      - Total combined power
      - Total core power
      - Total interface power (total only; no interface breakdown yet)
      - Core breakdown buckets where available
    """
    dr_core_ref = sum(dr.get(f"core.{k}", 0.0) for k in ["REF_AB", "REF_PB", "REF_SB", "REF_2B"] if f"core.{k}" in dr) or (dr.get("core.REF_AB") if "core.REF_AB" in dr else None)
    dr_core_bg_act_total = None
    if "core.BG_ACT" in dr or "core_shared.E_bg_act_shared" in dr:
        dr_core_bg_act_total = dr.get("core.BG_ACT", 0.0) + dr.get("core_shared.E_bg_act_shared", 0.0)
    dr_core_act_pre = None
    if "core.ACT" in dr or "core.PRE" in dr:
        dr_core_act_pre = dr.get("core.ACT", 0.0) + dr.get("core.PRE", 0.0)

    our_bg_pre_weighted = None
    if "core.P_PRE_STBY_core" in ours:
        our_bg_pre_weighted = float(DEFAULT_BNK_PRE_FRAC) * float(ours["core.P_PRE_STBY_core"])

    rows: List[Tuple[str, Optional[float], Optional[float], bool]] = [
        # Totals
        ("total.P_total", dr.get("P_total"), ours.get("P_total"), True),
        ("total.P_core", dr.get("P_core"), ours.get("core.P_total_core"), True),
        ("total.P_interface", dr.get("P_interface"), ours.get("P_interface"), True),

        # Core buckets
        ("core.rd", dr.get("core.RD"), ours.get("core.P_RD_core"), True),
        ("core.wr", dr.get("core.WR"), ours.get("core.P_WR_core"), True),
        ("core.ref", dr_core_ref, ours.get("core.P_REF_core"), True),

        ("core.bg_pre", dr.get("core.BG_PRE"), our_bg_pre_weighted, our_bg_pre_weighted is not None),
        ("core.bg_act_total", dr_core_bg_act_total, ours.get("core.P_ACT_STBY_core"), True),
        # DRAMPower reports ACT and PRE separately; our model reports a combined ACT/PRE bucket.
        ("core.act_pre", dr_core_act_pre, ours.get("core.P_ACT_PRE_core"), True),
        ("core.act", dr.get("core.ACT"), None, False),
        ("core.pre", dr.get("core.PRE"), None, False),
    ]

    out_rows: List[CompareRow] = []
    for bucket, dval, oval, comparable in rows:
        d = float(dval) if dval is not None else None
        o = float(oval) if oval is not None else None
        abs_err, pct = _err(d, o, comparable)
        out_rows.append(
            CompareRow(
                bucket=bucket,
                drampower_w=d,
                our_w=o,
                abs_err_w=abs_err,
                pct_err=pct,
                comparable=comparable,
            )
        )
    return out_rows


def write_csv(path: Path, rows: List[CompareRow], meta: Dict[str, str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        for k, v in meta.items():
            w.writerow([f"# {k}", v])
        w.writerow(["bucket", "drampower_W", "our_W", "abs_err_W(our-dr)", "pct_err_%", "comparable"])
        for r in rows:
            w.writerow(
                [
                    r.bucket,
                    "" if r.drampower_w is None else f"{r.drampower_w:.12f}",
                    "" if r.our_w is None else f"{r.our_w:.12f}",
                    "" if r.abs_err_w is None else f"{r.abs_err_w:.12f}",
                    "" if r.pct_err is None else f"{r.pct_err:.6f}",
                    "1" if r.comparable else "0",
                ]
            )


def plot_png(path: Path, rows: List[CompareRow], title: str) -> None:
    # Import matplotlib lazily so CSV generation still works without it.
    #
    # In some environments, the default matplotlib/fontconfig cache directories
    # may not be writable. Force caches into a writable temp directory and use
    # a non-interactive backend.
    import os
    tmp = os.environ.get("TMPDIR") or "/tmp"
    os.environ.setdefault("MPLCONFIGDIR", os.path.join(tmp, "mplconfig"))
    os.environ.setdefault("XDG_CACHE_HOME", os.path.join(tmp, "xdg-cache"))
    os.environ.setdefault("FC_CACHEDIR", os.path.join(tmp, "fontconfig-cache"))

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    # Choose buckets to visualize (avoid buckets with None on both sides).
    buckets = [r for r in rows if (r.drampower_w is not None or r.our_w is not None)]

    labels = [r.bucket for r in buckets]
    dr_vals = [0.0 if r.drampower_w is None else r.drampower_w for r in buckets]
    our_vals = [0.0 if r.our_w is None else r.our_w for r in buckets]

    x = list(range(len(labels)))
    width = 0.42

    fig_h = max(4.5, 0.28 * len(labels))
    fig, ax = plt.subplots(figsize=(12, fig_h))
    ax.barh([i - width / 2 for i in x], dr_vals, height=width, label="DRAMPower (W)")
    ax.barh([i + width / 2 for i in x], our_vals, height=width, label="Our tool (W)")

    ax.set_yticks(x, labels)
    ax.set_xlabel("Average power (W)")
    ax.set_title(title)
    ax.grid(axis="x", linestyle="--", alpha=0.4)
    ax.legend(loc="lower right")

    # Highlight which rows are considered quantitatively comparable
    for i, r in enumerate(buckets):
        if r.comparable:
            ax.get_yticklabels()[i].set_fontweight("bold")

    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=160)
    plt.close(fig)

def plot_pct_png(path: Path, rows: List[CompareRow], title: str) -> None:
    # Percent difference plot for rows where both tools report a value.
    import os
    tmp = os.environ.get("TMPDIR") or "/tmp"
    os.environ.setdefault("MPLCONFIGDIR", os.path.join(tmp, "mplconfig"))
    os.environ.setdefault("XDG_CACHE_HOME", os.path.join(tmp, "xdg-cache"))
    os.environ.setdefault("FC_CACHEDIR", os.path.join(tmp, "fontconfig-cache"))

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    buckets = [r for r in rows if r.drampower_w is not None and r.our_w is not None and r.drampower_w != 0]
    labels = [r.bucket for r in buckets]
    pct_vals = [((r.our_w - r.drampower_w) / r.drampower_w) * 100.0 for r in buckets]

    x = list(range(len(labels)))
    fig_h = max(4.5, 0.28 * len(labels))
    fig, ax = plt.subplots(figsize=(12, fig_h))
    ax.barh(x, pct_vals, color="#4C78A8")
    ax.axvline(0.0, color="black", linewidth=1)
    ax.set_yticks(x, labels)
    ax.set_xlabel("Percent difference (%)   (Our - DRAMPower) / DRAMPower")
    ax.set_title(title)
    ax.grid(axis="x", linestyle="--", alpha=0.4)

    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=160)
    plt.close(fig)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--drampower", required=True, help="Path to DRAMPower summary text (calculate_power.py output)")
    ap.add_argument("--ours", required=True, help="Path to our DIMM POWER REPORT text")
    ap.add_argument("--out_csv", required=True, help="Output CSV path")
    ap.add_argument("--out_png", required=True, help="Output plot PNG path")
    ap.add_argument("--out_pct_png", required=True, help="Output percent-difference plot PNG path")
    ap.add_argument("--title", default=None, help="Plot title override")
    args = ap.parse_args()

    # Support running from within `core/verif/drampower/` by resolving relative
    # paths against this script's directory (not against CWD).
    base_dir = Path(__file__).resolve().parent
    dr_path = (base_dir / args.drampower).resolve() if not os.path.isabs(args.drampower) else Path(args.drampower)
    our_path = (base_dir / args.ours).resolve() if not os.path.isabs(args.ours) else Path(args.ours)
    out_csv = (base_dir / args.out_csv).resolve() if not os.path.isabs(args.out_csv) else Path(args.out_csv)
    out_png = (base_dir / args.out_png).resolve() if not os.path.isabs(args.out_png) else Path(args.out_png)
    out_pct_png = (base_dir / args.out_pct_png).resolve() if not os.path.isabs(args.out_pct_png) else Path(args.out_pct_png)

    dr = parse_drampower_summary(dr_path)
    ours, meta = parse_our_dimm_report(our_path)

    compare = build_comparison(dr, ours)

    meta_lines = {
        "drampower_file": str(dr_path),
        "ours_file": str(our_path),
        "memory_id": meta.memory_id or "",
        "device_width_bits": "" if meta.device_width_bits is None else str(meta.device_width_bits),
        "ranks": "" if meta.ranks is None else str(meta.ranks),
        "devices_modeled": "" if meta.devices_modeled is None else str(meta.devices_modeled),
        "cycles": "" if "meta.cycles" not in dr else str(int(dr["meta.cycles"])),
        "tCK_s": "" if "meta.tCK_s" not in dr else f"{dr['meta.tCK_s']:.12e}",
        "BNK_PRE_frac": f"{DEFAULT_BNK_PRE_FRAC:.6f}",
    }
    write_csv(out_csv, compare, meta_lines)

    title = args.title or f"DRAMPower vs Our Tool Breakdown\n{os.path.basename(str(dr_path))} vs {os.path.basename(str(our_path))}"
    plot_png(out_png, compare, title=title)
    plot_pct_png(out_pct_png, compare, title=title.replace("Breakdown", "Percent Difference"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
