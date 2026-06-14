#!/usr/bin/env bash
# ============================================================
# Pull images, start cluster, run k6/JMeter tests, collect logs
# Usage: ./scripts/run-tests.sh <dockerhub-username> <test-script>
# Example:
#   k6:     ./scripts/run-tests.sh johndoe k6 tests/exp_a_14.js
#   jmeter: ./scripts/run-tests.sh johndoe jmeter tests/exp_a_14.jmx
# ============================================================

set -e

DOCKERHUB_USER=${1:?"Usage: $0 <dockerhub-username> <k6|jmeter> <test-file>"}
TOOL=${2:?"Specify tool: k6 or jmeter"}
TEST_FILE=${3:?"Specify test file path"}

export DOCKERHUB_USER

echo "============================================"
echo " System A — Test Runner"
echo " Tool      : $TOOL"
echo " Test file : $TEST_FILE"
echo " Target    : http://localhost:3000"
echo "============================================"
echo ""

# ── Step 1: Pull latest images ─────────────────────────────
echo ">>> Pulling latest images from Docker Hub..."
docker compose pull

# ── Step 2: Start cluster ──────────────────────────────────
echo ""
echo ">>> Starting cluster..."
docker compose up -d

# ── Step 3: Wait for cluster to be healthy ─────────────────
echo ""
echo ">>> Waiting for cluster to be ready..."
MAX_WAIT=60
ELAPSED=0
until curl -sf http://localhost:3000/lb-health > /dev/null 2>&1; do
  if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo "Cluster not ready after ${MAX_WAIT}s. Check: docker compose logs"
    exit 1
  fi
  echo "  Still waiting... (${ELAPSED}s)"
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done
echo "Cluster is ready!"

# ── Step 4: Run tests ──────────────────────────────────────
echo ""
echo ">>> Running $TOOL tests..."
echo ""

if [ "$TOOL" = "k6" ]; then
  k6 run "$TEST_FILE"

elif [ "$TOOL" = "jmeter" ]; then
  RESULTS_DIR="./logging/jmeter-results"
  mkdir -p "$RESULTS_DIR"
  jmeter \
    -n \
    -t "$TEST_FILE" \
    -l "$RESULTS_DIR/results.jtl" \
    -e \
    -o "$RESULTS_DIR/report"
  echo "JMeter HTML report → $RESULTS_DIR/report/index.html"

else
  echo "Unknown tool: $TOOL. Use 'k6' or 'jmeter'"
  exit 1
fi

# ── Step 5: Collect CSV logs from shared volume ────────────
echo ""
echo ">>> Collecting logs from cluster..."
mkdir -p ./logging/raw

docker run --rm \
  -v "$(basename $(pwd))_shared_logs:/src" \
  -v "$(pwd)/logging/raw:/dst" \
  alpine sh -c "cp -r /src/. /dst/"

echo ""
echo "============================================"
echo " Test complete!"
echo " request.csv → ./logging/raw/request.csv"
if [ "$TOOL" = "jmeter" ]; then
  echo " JMeter report → ./logging/jmeter-results/report/index.html"
fi
echo ""
echo " Stop cluster : docker compose down"
echo " View logs    : docker compose logs -f"
echo "============================================"