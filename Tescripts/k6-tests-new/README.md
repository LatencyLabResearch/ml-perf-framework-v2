# k6 Test Suite — Web Application Performance Research
## Experiments A_01 → A_23

This directory contains one k6 script per experiment defined in the research
test plan.  All files follow the same naming convention, header structure, and
custom-header schema so that your backend, Prometheus, or any log-aggregation
pipeline can slice metrics by experiment, endpoint group, or traffic pattern.

---

## Directory layout

```
k6-tests/
├── Exp_A_01.js   L1 Steady   Isolated   50        10 min
├── Exp_A_02.js   L2 Steady   Isolated   50        10 min
├── Exp_A_03.js   M1 Steady   Isolated   50        10 min
├── Exp_A_04.js   M2 Steady   Isolated   50        10 min
├── Exp_A_05.js   H1 Steady   Isolated   50        10 min
├── Exp_A_06.js   H2 Steady   Isolated   50        10 min
├── Exp_A_07.js   L1 Peak     Isolated   50→300    10 min
├── Exp_A_08.js   L2 Peak     Isolated   50→300    10 min
├── Exp_A_09.js   M1 Peak     Isolated   50→300    10 min
├── Exp_A_10.js   M2 Peak     Isolated   50→300    10 min
├── Exp_A_11.js   H1 Peak     Isolated   50→300    10 min
├── Exp_A_12.js   H2 Peak     Isolated   50→300    10 min
├── Exp_A_13.js   L1 Burst    Isolated   50→500    5 min
├── Exp_A_14.js   L2 Burst    Isolated   50→500    5 min
├── Exp_A_15.js   M1 Burst    Isolated   50→500    5 min
├── Exp_A_16.js   M2 Burst    Isolated   50→500    5 min
├── Exp_A_17.js   H1 Burst    Isolated   50→500    5 min
├── Exp_A_18.js   H2 Burst    Isolated   50→500    5 min
├── Exp_A_19.js   All Steady  Combined   100       10 min
├── Exp_A_20.js   All Peak    Combined   100→500   10 min
├── Exp_A_21.js   All Burst   Combined   100→1000  5 min
├── Exp_A_22.js   All Mixed   Combined   50–700    15 min
├── Exp_A_23.js   All Stress  Combined   100–1200  15 min
├── run_all.sh
└── README.md
```

---

## Custom request headers

Every request carries these headers.  Your Express.js / FastAPI backend
should log them so each request record in the dataset is tagged with its
experimental context.

| Header                | Example value    | Purpose                                    |
|-----------------------|------------------|--------------------------------------------|
| x-experiment-id       | Exp-A-01         | Maps the request to a row in the test plan |
| x-traffic-pattern     | steady / peak / burst / mixed | Labels non-stationarity class |
| x-workload-type       | isolated / combined           | Single vs multi-endpoint run  |
| x-endpoint-group      | lightweight / medium / heavy  | Complexity tier of the target |
| x-concurrent-users    | 47               | VU index at time of request                |
| x-system-type         | system-a         | Reserved for multi-system comparisons      |
| x-test-tool           | k6               | Identifies the load-generator              |

---

## Threshold rationale

| Experiment type | p95 threshold | Error-rate threshold | Reason                              |
|-----------------|---------------|----------------------|-------------------------------------|
| Steady baseline | 500–2000 ms   | < 1 %                | Normal operation expectation        |
| Peak            | 1000–3000 ms  | < 5 %                | Degraded but functional             |
| Burst           | 2000–5000 ms  | < 10 %               | Spike stress; some errors expected  |
| Mixed / Stress  | 4000–8000 ms  | < 5–30 %             | Observation window; loose gates     |

Thresholds increase with endpoint weight (L < M < H) because the backend
joins / aggregations take longer under contention.

---

## Running a single experiment

```bash
# Make sure your Docker stack is up:
docker compose up -d

# Run one experiment:
k6 run Exp_A_01.js

# Export metrics to JSON for ML feature engineering:
k6 run --out json=results/Exp_A_01.json Exp_A_01.js
```

---

## Running the full suite

```bash
chmod +x run_all.sh
./run_all.sh
```

Results land in `results/` as JSON files named after each experiment.

---

## Connecting to Grafana / InfluxDB (recommended)

```bash
k6 run --out influxdb=http://localhost:8086/k6 Exp_A_01.js
```

Then import the k6 Grafana dashboard (ID 2587) to see live VU counts,
p95/p99 latency, and error rates per experiment.

---

## Notes for ML data collection

1. Your backend should write a log line **before** processing each request
   (pre-execution context) that includes: timestamp, endpoint, CPU %, memory %,
   active connections, payload size, and all x-* headers.
2. After processing, append the actual response time to the same record.
3. This gives you the ground-truth label (latency) alongside the pre-execution
   features the ML model will use at inference time.
4. The `x-concurrent-users` header gives a per-request snapshot of concurrent
   VUs, useful as an "active connections" proxy when your system metric
   sampling rate is coarser than the request rate.
