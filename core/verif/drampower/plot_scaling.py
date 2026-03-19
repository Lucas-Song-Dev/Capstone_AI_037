#!/usr/bin/env python3
"""
plot_scaling.py

Deliverable 2: generate scaling charts for core/interface power vs data rate.

Inputs (expected under ./out when run from core/verif/drampower):
  - out/ddr5.x8.{2600,3200,4800,6400}          (our tool DIMM report text)
  - out/output_trace_1_dual_{2800,3200,4800,6400} (DRAMPower summary from calculate_power.py)

Outputs (written under ./out):
  - out/scaling_our_tool.csv
  - out/scaling_drampower.csv
  - out/scaling_our_tool_core_interface.png
  - out/scaling_drampower_core_interface.png
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

from compare_breakdown import parse_drampower_summary, parse_our_dimm_report


@dataclass(frozen=True)
class Point:
    mtps: int
    p_core_w: float
    p_if_w: float
    p_total_w: float
    source_file: str


def _extract_suffix_int(name: str) -> int:
    m = re.search(r"(\d+)$", name)
    if not m:
        raise ValueError(f"Cannot extract MT/s suffix from filename: {name}")
    return int(m.group(1))


def collect_our_points(out_dir: Path) -> List[Point]:
    points: List[Point] = []
    for p in sorted(out_dir.glob("ddr5.x8.*")):
        mtps = _extract_suffix_int(p.name)
        parsed, _meta = parse_our_dimm_report(p)
        p_core = float(parsed.get("core.P_total_core", 0.0))
        p_if = float(parsed.get("P_interface", 0.0))
        p_total = float(parsed.get("P_total", p_core + p_if))
        points.append(Point(mtps=mtps, p_core_w=p_core, p_if_w=p_if, p_total_w=p_total, source_file=p.name))
    return points


def collect_drampower_points(out_dir: Path) -> List[Point]:
    points: List[Point] = []
    for p in sorted(out_dir.glob("output_trace_1_dual_*")):
        mtps = _extract_suffix_int(p.name)
        parsed = parse_drampower_summary(p)
        p_core = float(parsed.get("P_core", 0.0))
        p_if = float(parsed.get("P_interface", 0.0))
        p_total = float(parsed.get("P_total", p_core + p_if))
        points.append(Point(mtps=mtps, p_core_w=p_core, p_if_w=p_if, p_total_w=p_total, source_file=p.name))
    return points


def write_csv(path: Path, points: List[Point]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["mtps", "P_core_W", "P_interface_W", "P_total_W", "source_file"])
        for pt in sorted(points, key=lambda x: x.mtps):
            w.writerow([pt.mtps, f"{pt.p_core_w:.12f}", f"{pt.p_if_w:.12f}", f"{pt.p_total_w:.12f}", pt.source_file])


def plot(path: Path, points: List[Point], title: str) -> None:
    import os
    tmp = os.environ.get("TMPDIR") or "/tmp"
    os.environ.setdefault("MPLCONFIGDIR", os.path.join(tmp, "mplconfig"))
    os.environ.setdefault("XDG_CACHE_HOME", os.path.join(tmp, "xdg-cache"))
    os.environ.setdefault("FC_CACHEDIR", os.path.join(tmp, "fontconfig-cache"))

    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    pts = sorted(points, key=lambda x: x.mtps)
    x = [p.mtps for p in pts]
    y_core = [p.p_core_w for p in pts]
    y_if = [p.p_if_w for p in pts]
    y_total = [p.p_total_w for p in pts]

    fig, ax = plt.subplots(figsize=(9, 5.2))
    ax.plot(x, y_core, marker="o", linewidth=2, label="Core power (W)")
    ax.plot(x, y_if, marker="o", linewidth=2, label="Interface power (W)")
    ax.plot(x, y_total, marker="o", linewidth=2, linestyle="--", label="Total power (W)")

    ax.set_xlabel("Data rate (MT/s)")
    ax.set_ylabel("Average power (W)")
    ax.set_title(title)
    ax.grid(True, linestyle="--", alpha=0.4)
    ax.legend()

    fig.tight_layout()
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, dpi=160)
    plt.close(fig)


def main() -> int:
    base_dir = Path(__file__).resolve().parent
    out_dir = base_dir / "out"

    our_pts = collect_our_points(out_dir)
    dp_pts = collect_drampower_points(out_dir)

    write_csv(out_dir / "scaling_our_tool.csv", our_pts)
    write_csv(out_dir / "scaling_drampower.csv", dp_pts)

    plot(out_dir / "scaling_our_tool_core_interface.png", our_pts, "Our tool scaling (ddr5.x8.*)")
    plot(out_dir / "scaling_drampower_core_interface.png", dp_pts, "DRAMPower scaling (output_trace_1_dual_*)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

