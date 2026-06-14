import subprocess
import sys
import time
import urllib.request

print("Starting System A - Full Cluster (Docker)")
print("============================================\n")

# ── Step 1: Build & start all containers ──────────────────
print("Building and starting containers...")
result = subprocess.run(
    ["docker", "compose", "up", "--build", "-d"],
    capture_output=False
)

if result.returncode != 0:
    print("\nFailed to start Docker containers.")
    sys.exit(1)

# ── Step 2: Wait for Nginx to be reachable ─────────────────
print("\nWaiting for cluster to be ready...")

MAX_WAIT = 60
INTERVAL = 3
elapsed = 0

while elapsed < MAX_WAIT:
    try:
        # Assumes Nginx handles /lb-health or proxy passes to a valid node instance status path
        res = urllib.request.urlopen("http://localhost:3000/lb-health", timeout=2)
        if res.status == 200:
            print(f"Cluster is ready! ({elapsed}s)")
            break
    except Exception:
        pass

    time.sleep(INTERVAL)
    elapsed += INTERVAL
    print(f"  Still waiting... ({elapsed}s)")
else:
    print("\nCluster did not become ready in time.")
    print("Check logs with: docker compose logs")
    sys.exit(1)

# ── Step 3: Summary ────────────────────────────────────────
print("\nFull cluster launched!")
print("  Load Balancer   : http://localhost:3000")
print("  Health check    : http://localhost:3000/lb-health")
print("\n[Lightweight Endpoints - Tier 1]")
print("  L1 - GET Users  : http://localhost:3000/api/api/users/:id          (Range: 1 - 20)")
print("  L2 - GET Orders : http://localhost:3000/api/api/orders/:id         (Range: 1 - 200)")
print("\n[Moderate Endpoints - Tier 2]")
print("  M1 - POST Order : http://localhost:3000/api/api/orders")
print("  M2 - PATCH Stat : http://localhost:3000/api/api/orders/:id/status  (Range: 1 - 200)")
print("\n[Heavy Endpoints - Tier 3]")
print("  H1 - User Rep   : http://localhost:3000/api/api/reports/user-orders")
print("  H2 - Order Anal : http://localhost:3000/api/api/analytics/order-summary")

print("\nUseful commands:")
print("  docker compose logs -f            # live logs all containers")
print("  docker compose logs -f instance1  # logs for one instance")
print("  docker compose down               # stop everything")


# ── Helper: copy logs to host ──────────────────────────────
# Run this after your experiment: python scripts/start-all.py --collect-logs
if '--collect-logs' in sys.argv:
    import os
    os.makedirs("logging/raw", exist_ok=True)
    
    # Notice the volume mount updated to handle potential project directory prefix differences
    # automatically based on standard docker-compose volume naming conventions
    subprocess.run([
        "docker", "run", "--rm",
        "-v", "newfolder_shared_logs:/src",
        "-v", f"{os.getcwd()}/logging/raw:/dst",
        "alpine", "sh", "-c", "cp -r /src/. /dst/"
    ])
    print("\nLogs copied to ./logging/raw/")
    print("  request.csv  — full ML dataset")
    print("  request.log  — human-readable debug log")