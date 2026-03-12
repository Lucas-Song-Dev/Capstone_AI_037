from __future__ import annotations

import copy
import argparse
import json
import os
import re
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, List, Sequence

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

# Add src directory to import path (same pattern used in verif.py)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from dimm import DIMM


@dataclass
class PerturbationResult:
	field_path: str
	perturbation_percent: float
	original_value: float
	modified_value: float
	original_power: float
	perturbed_power: float
	delta_watts: float
	delta_percent: float


def resolve_json_path(path_text: str, argument_name: str) -> Path:
	"""Resolve and validate a JSON file path from CLI args."""
	path = Path(path_text).expanduser().resolve()

	if not path.exists():
		raise FileNotFoundError(f"{argument_name} file not found: {path}")
	if path.suffix.lower() != ".json":
		raise ValueError(f"{argument_name} must point to a .json file: {path}")

	return path


def parse_args() -> argparse.Namespace:
	parser = argparse.ArgumentParser(
		description="DDR5 memory specification sensitivity profiler"
	)
	parser.add_argument(
		"--memspec",
		required=True,
		help="Path to memory specification JSON file",
	)
	parser.add_argument(
		"--workload",
		required=True,
		help="Path to workload JSON file",
	)
	parser.add_argument(
		"--delta",
		type=float,
		default=10.0,
		help="Max percent for perturbation sweep range [-delta, +delta] (default: 10)",
	)
	parser.add_argument(
		"--sweep-points",
		type=int,
		default=21,
		help="Number of evenly spaced points in the sweep (default: 21)",
	)
	parser.add_argument(
		"--plot-dir",
		type=str,
		default=str(Path(__file__).resolve().parent / "profile_model"),
		help="Directory where per-parameter PNG plots are saved",
	)
	parser.add_argument(
		"--output-file",
		type=str,
		help="Optional path to save full untruncated perturbation results as JSON",
	)
	parser.add_argument(
		"--top-k",
        type=int,
        default=15,
        help="Number of top impactful fields to display in the ranking (default: 15)",
    )
	return parser.parse_args()


def run_model_total_power(memspec_path: Path, workload_path: Path) -> float:
	"""Run the DIMM model and return P_total."""
	dimm = DIMM.load_specs(str(memspec_path), str(workload_path))
	result = dimm.compute_all()
	if "P_total" not in result:
		raise KeyError("Model output does not include 'P_total'.")
	return float(result["P_total"])


def collect_numeric_leaf_paths(obj: Any, prefix: List[str] | None = None) -> List[List[str]]:
	"""Collect all paths to numeric leaf values in a nested dict/list structure."""
	if prefix is None:
		prefix = []

	paths: List[List[str]] = []

	if isinstance(obj, dict):
		for key, value in obj.items():
			paths.extend(collect_numeric_leaf_paths(value, prefix + [str(key)]))
	elif isinstance(obj, list):
		for idx, value in enumerate(obj):
			paths.extend(collect_numeric_leaf_paths(value, prefix + [str(idx)]))
	elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
		paths.append(prefix)

	return paths


def get_value_at_path(root: Any, path: Sequence[str]) -> Any:
	node = root
	for token in path:
		if isinstance(node, list):
			node = node[int(token)]
		else:
			node = node[token]
	return node


def set_value_at_path(root: Any, path: Sequence[str], value: Any) -> None:
	node = root
	for token in path[:-1]:
		if isinstance(node, list):
			node = node[int(token)]
		else:
			node = node[token]

	last = path[-1]
	if isinstance(node, list):
		node[int(last)] = value
	else:
		node[last] = value


def scaled_value(original: float | int, factor: float) -> float | int:
	"""Scale a value by factor while preserving integer fields as integers."""
	scaled = original * factor

	if isinstance(original, int) and not isinstance(original, bool):
		rounded = int(round(scaled))

		# Ensure integer fields actually change when possible.
		if original != 0 and rounded == original:
			rounded = original + (1 if factor > 1.0 else -1)

		if original > 0 and rounded < 1:
			rounded = 1

		return rounded

	return float(scaled)


def sanitize_for_filename(text: str) -> str:
	return re.sub(r"[^A-Za-z0-9_.-]+", "_", text)


def format_path(path: Sequence[str]) -> str:
	return ".".join(path)


def format_perturbation_label(perturbation_percent: float) -> str:
	return f"{perturbation_percent:+.3f}%"


def print_top_impacts(results: List[PerturbationResult], top_k: int = 15) -> None:
	"""Print ranking of fields by maximum absolute percent impact."""
	grouped: dict[str, List[PerturbationResult]] = {}
	for item in results:
		grouped.setdefault(item.field_path, []).append(item)

	ranked = []
	for field_path, items in grouped.items():
		max_item = max(items, key=lambda x: abs(x.delta_percent))
		ranked.append((field_path, max_item, items))

	ranked.sort(key=lambda x: abs(x[1].delta_percent), reverse=True)

	print("\n" + "=" * 170)
	print("FIELD IMPACT RANKING (sorted by max absolute % change in P_total)")
	print("=" * 170)
	print(
		f"{'Rank':<6} {'Field':<45} {'Perturbation':<20} {'Delta (%)':>10} {'Original':>14} {'Perturbed':>14} {'Original Power (W)':>18} {'Perturbed Power (W)':>20}"
	)
	print("-" * 170)

	for idx, (field_path, max_item, _) in enumerate(ranked[:top_k], start=1):
		perturbation_label = format_perturbation_label(max_item.perturbation_percent)
		print(
			f"{idx:<6} {field_path:<45} {perturbation_label:<20} {max_item.delta_percent:>10.4f} "
			f"{max_item.original_value:>14.6g} {max_item.modified_value:>14.6g} "
			f"{max_item.original_power:>18.6f} {max_item.perturbed_power:>20.6f}"
		)


def save_parameter_plot(
	output_dir: Path,
	field_name: str,
	baseline_total: float,
	field_results: List[PerturbationResult],
) -> Path:
	"""Save a per-parameter perturbation curve as a PNG."""
	sorted_results = sorted(field_results, key=lambda item: item.perturbation_percent)
	x_values = [item.perturbation_percent for item in sorted_results]
	y_values = [item.perturbed_power for item in sorted_results]

	plt.figure(figsize=(9, 5))
	plt.plot(x_values, y_values, marker="o", linewidth=1.5)
	plt.axhline(baseline_total, color="gray", linestyle="--", linewidth=1.0)
	plt.axvline(0.0, color="gray", linestyle=":", linewidth=1.0)
	plt.grid(True, linestyle=":", linewidth=0.8, alpha=0.7)
	plt.xlabel("Perturbation (%)")
	plt.ylabel("P_total (W)")
	plt.title(f"P_total sensitivity: {field_name}\\nBaseline P_total = {baseline_total:.6f} W")
	plt.tight_layout()

	filename = sanitize_for_filename(f"{field_name}.png")
	output_path = output_dir / filename
	plt.savefig(output_path, dpi=180)
	plt.close()
	return output_path


def has_power_variation(field_results: List[PerturbationResult], tolerance: float = 1e-12) -> bool:
	"""Return True when P_total changes across perturbation points."""
	if not field_results:
		return False
	powers = [item.perturbed_power for item in field_results]
	return (max(powers) - min(powers)) > tolerance


def save_full_results(
	output_path: Path,
	memspec_path: Path,
	workload_path: Path,
	baseline_total: float,
	max_perturbation_percent: float,
	sweep_points: int,
	results: List[PerturbationResult],
	skipped_fields: List[str],
) -> None:
	"""Save all perturbation results without truncation."""
	# sort by absolute percent change, largest impact first
	sorted_results = sorted(results, key=lambda item: abs(item.delta_percent), reverse=True)
	output_path.parent.mkdir(parents=True, exist_ok=True)
	payload = {
		"memspec_path": str(memspec_path),
		"workload_path": str(workload_path),
		"baseline_total": baseline_total,
		"max_perturbation_percent": max_perturbation_percent,
		"sweep_points": sweep_points,
		"result_count": len(results),
		"results": [
			{
				**item.__dict__
			}
			for item in sorted_results
		],
		"skipped_fields": skipped_fields,
	}
	with open(output_path, "w", encoding="utf-8") as f:
		json.dump(payload, f, indent=2)


def main() -> None:
	args = parse_args()

	print("=" * 70)
	print("DDR5 MEMORY SPEC SENSITIVITY PROFILER")
	print("=" * 70)

	memspec_path = resolve_json_path(args.memspec, "--memspec")
	workload_path = resolve_json_path(args.workload, "--workload")

	if args.delta <= 0:
		raise ValueError("--delta must be > 0.")
	if args.sweep_points < 2:
		raise ValueError("--sweep-points must be >= 2.")

	perturbation_percent = args.delta
	plot_dir = Path(args.plot_dir).expanduser().resolve()
	plot_dir.mkdir(parents=True, exist_ok=True)

	step_count = args.sweep_points - 1
	step_size = (2.0 * perturbation_percent) / step_count
	perturbation_values = [
		(-perturbation_percent + (idx * step_size))
		for idx in range(args.sweep_points)
	]

	print("\n[INFO] Running baseline model...")
	print(f"[INFO] Perturbation sweep: {perturbation_values[0]:+.3f}% to {perturbation_values[-1]:+.3f}%")
	print(f"[INFO] Sweep points: {args.sweep_points}")
	print(f"[INFO] Plot output directory: {plot_dir}")
	baseline_total = run_model_total_power(memspec_path, workload_path)
	print(f"[INFO] Baseline P_total: {baseline_total:.6f} W")

	with open(memspec_path, "r", encoding="utf-8") as f:
		memspec_raw = json.load(f)

	if "memspec" not in memspec_raw:
		raise ValueError("Input memory JSON must contain a top-level 'memspec' object.")

	numeric_paths = collect_numeric_leaf_paths(memspec_raw["memspec"])
	print(f"[INFO] Found {len(numeric_paths)} numeric memspec fields to profile.")

	results: List[PerturbationResult] = []
	skipped_fields: List[str] = []

	with tempfile.TemporaryDirectory(prefix="profile_model_") as temp_dir:
		temp_dir_path = Path(temp_dir)

		for idx, path_tokens in enumerate(numeric_paths, start=1):
			field_name = format_path(path_tokens)
			original_value = get_value_at_path(memspec_raw["memspec"], path_tokens)
			field_results: List[PerturbationResult] = []

			print(f"\n[{idx}/{len(numeric_paths)}] Profiling field: {field_name}")

			for perturbation_value in perturbation_values:
				factor = 1.0 + (perturbation_value / 100.0)
				modified = copy.deepcopy(memspec_raw)
				modified_value = scaled_value(original_value, factor)
				set_value_at_path(modified["memspec"], path_tokens, modified_value)

				label = format_perturbation_label(perturbation_value)
				temp_name = sanitize_for_filename(f"{field_name}_{label}.json")
				temp_path = temp_dir_path / temp_name
				with open(temp_path, "w", encoding="utf-8") as f:
					json.dump(modified, f, indent=2)

				try:
					new_total = run_model_total_power(temp_path, workload_path)
				except Exception as exc:
					skipped_fields.append(f"{field_name} ({label}): {exc}")
					print(f"  [SKIP] {label} failed: {exc}")
					continue

				delta_watts = new_total - baseline_total
				delta_percent = (delta_watts / baseline_total * 100.0) if baseline_total != 0 else 0.0

				point_result = PerturbationResult(
					field_path=field_name,
					perturbation_percent=perturbation_value,
					original_value=float(original_value),
					modified_value=float(modified_value),
					original_power=baseline_total,
					perturbed_power=new_total,
					delta_watts=delta_watts,
					delta_percent=delta_percent,
				)
				results.append(point_result)
				field_results.append(point_result)

				print(
					f"  {label:<8} -> Base={baseline_total:.6f} W, Perturbed={new_total:.6f} W "
					f"(Delta {delta_watts:+.6f} W, {delta_percent:+.4f}%)"
				)

			if field_results:
				if has_power_variation(field_results):
					plot_path = save_parameter_plot(
						output_dir=plot_dir,
						field_name=field_name,
						baseline_total=baseline_total,
						field_results=field_results,
					)
					print(f"  [PLOT] Saved: {plot_path}")
				else:
					print("  [PLOT] Skipped: no power change across perturbation range.")
			else:
				print("  [PLOT] Skipped: no successful perturbation points for this field.")

	if results:
		print_top_impacts(results, top_k=args.top_k)
	else:
		print("\n[WARN] No successful perturbation runs were completed.")

	if skipped_fields:
		print("\n[WARN] Some fields were skipped:")
		for skipped in skipped_fields:
			print(f"  - {skipped}")

	if args.output_file:
		output_path = Path(args.output_file).expanduser().resolve()
		save_full_results(
			output_path=output_path,
			memspec_path=memspec_path,
			workload_path=workload_path,
			baseline_total=baseline_total,
			max_perturbation_percent=perturbation_percent,
			sweep_points=args.sweep_points,
			results=results,
			skipped_fields=skipped_fields,
		)
		print(f"\n[INFO] Full results saved to: {output_path}")

	print("\n[DONE] Sensitivity profiling complete.")


if __name__ == "__main__":
	main()
