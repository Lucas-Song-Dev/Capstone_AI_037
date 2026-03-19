#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 5 ]]; then
  echo "Usage: $0 <trace.csv> <memspec.json> <cycles> <tck_seconds> <out_prefix> [trace2.csv] [config.json]" >&2
  echo "Examples:" >&2
  echo "  $0 trace_1.csv tests/tests_drampower/resources/ddr5.json 2919445 0.312e-9 out/output_trace_1_base_6400" >&2
  echo "  $0 ch0.csv tests/tests_drampower/resources/ddr5.json 2919445 0.312e-9 out/out_prefix ch1.csv build/bin/config.json" >&2
  exit 2
fi

TRACE_CSV="$1"
MEMSPEC_JSON="$2"
CYCLES="$3"
TCK="$4"
OUT_PREFIX="$5"

TRACE2_CSV=""
CONFIG_JSON="build/bin/config.json"
if [[ $# -ge 6 ]]; then
  if [[ "${6}" == *.csv ]]; then
    TRACE2_CSV="$6"
    CONFIG_JSON="${7:-build/bin/config.json}"
  else
    CONFIG_JSON="$6"
  fi
fi

OUT_DIR="$(dirname "$OUT_PREFIX")"
mkdir -p "$OUT_DIR"

POWER_TXT="${OUT_PREFIX}"

if [[ -n "$TRACE2_CSV" ]]; then
  DRAMPOWER_JSON0="${OUT_PREFIX}.ch0.json"
  DRAMPOWER_JSON1="${OUT_PREFIX}.ch1.json"
  ./build/bin/cli -c "$CONFIG_JSON" -m "$MEMSPEC_JSON" -t "$TRACE_CSV" -j "$DRAMPOWER_JSON0"
  ./build/bin/cli -c "$CONFIG_JSON" -m "$MEMSPEC_JSON" -t "$TRACE2_CSV" -j "$DRAMPOWER_JSON1"
  python3 calculate_power.py --json "$DRAMPOWER_JSON0" "$DRAMPOWER_JSON1" --cycles "$CYCLES" --tck "$TCK" --memspec_json "$MEMSPEC_JSON" > "$POWER_TXT"
  echo "Wrote: $DRAMPOWER_JSON0"
  echo "Wrote: $DRAMPOWER_JSON1"
  echo "Wrote: $POWER_TXT"
else
  DRAMPOWER_JSON="${OUT_PREFIX}.json"
  ./build/bin/cli -c "$CONFIG_JSON" -m "$MEMSPEC_JSON" -t "$TRACE_CSV" -j "$DRAMPOWER_JSON"
  python3 calculate_power.py --json "$DRAMPOWER_JSON" --cycles "$CYCLES" --tck "$TCK" --memspec_json "$MEMSPEC_JSON" > "$POWER_TXT"
  echo "Wrote: $DRAMPOWER_JSON"
  echo "Wrote: $POWER_TXT"
fi
