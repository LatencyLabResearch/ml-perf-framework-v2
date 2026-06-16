#!/usr/bin/env bash
# run_all.sh — Execute all 23 k6 experiments sequentially.
#
# Usage:
#   chmod +x run_all.sh
#   ./run_all.sh
#
# Results are written to ./results/<experiment>.json
# A summary pass/fail line is printed after every run.
# The script continues even if a threshold breach occurs (k6 exits 99).

set -euo pipefail

RESULTS_DIR="./results"
mkdir -p "$RESULTS_DIR"

EXPERIMENTS=(
  Exp_A_01 Exp_A_02 Exp_A_03 Exp_A_04 Exp_A_05 Exp_A_06
  Exp_A_07 Exp_A_08 Exp_A_09 Exp_A_10 Exp_A_11 Exp_A_12
  Exp_A_13 Exp_A_14 Exp_A_15 Exp_A_16 Exp_A_17 Exp_A_18
  Exp_A_19 Exp_A_20 Exp_A_21 Exp_A_22 Exp_A_23
)

PASS=0
FAIL=0
SKIP=0

echo "======================================================"
echo "  k6 Full Experiment Suite"
echo "  $(date)"
echo "======================================================"

for EXP in "${EXPERIMENTS[@]}"; do
  SCRIPT="${EXP}.js"

  if [[ ! -f "$SCRIPT" ]]; then
    echo "[SKIP] $SCRIPT not found"
    (( SKIP++ )) || true
    continue
  fi

  echo ""
  echo "------ Starting $EXP ------"

  # k6 exits 0 on success, 99 on threshold breach, non-zero on error.
  # We capture the exit code but do not abort the suite on threshold breach.
  set +e
  k6 run \
    --out "json=${RESULTS_DIR}/${EXP}.json" \
    "$SCRIPT"
  EXIT_CODE=$?
  set -e

  if [[ $EXIT_CODE -eq 0 ]]; then
    echo "[PASS] $EXP completed — thresholds met"
    (( PASS++ )) || true
  elif [[ $EXIT_CODE -eq 99 ]]; then
    echo "[WARN] $EXP completed — one or more thresholds breached (exit 99)"
    (( FAIL++ )) || true
  else
    echo "[ERROR] $EXP exited with code $EXIT_CODE"
    (( FAIL++ )) || true
  fi

  # Brief pause between experiments to let the system recover
  echo "Cooling down for 30 seconds..."
  sleep 30
done

echo ""
echo "======================================================"
echo "  Suite complete: PASS=$PASS  WARN/FAIL=$FAIL  SKIP=$SKIP"
echo "  $(date)"
echo "======================================================"
