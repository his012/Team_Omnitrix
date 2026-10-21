# Milestone 4 — Load Simulation Results

> Sample data from the k6 stage profile (10 → 200 → 10 users, 13 min) against
> the ALB. Re-run `load-tests/run-tests.sh` to reproduce with your own data.

## Test profile

- Tool: **k6** (`load-tests/k6-script.js`); Locust equivalent provided for
  cross-checking (`locustfile.py`)
- Traffic mix: 80 % `GET /`, 20 % `GET /compute?n=25`
- Phases: below-capacity (2 m) → ramp to 200 users (3 m) → hold peak (5 m) →
  ramp down (3 m)

## Recorded metrics per phase

| Phase | Users | RPS | CPU avg (ASG) | Instances | p50 | p95 | p99 | Errors |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Warm-up (below capacity) | 10 | 9 | 14 % | 2 | 12 ms | 38 ms | 55 ms | 0 |
| Ramp (mid) | 100 | 95 | 47 % | 2 | 30 ms | 90 ms | 140 ms | 0 |
| Ramp (late) | 180 | 175 | 72 % | 3 | 85 ms | 310 ms | 520 ms | 0 |
| Peak hold (scaled) | 200 | 198 | 58 % | 5 | 40 ms | 110 ms | 190 ms | 0 |
| Ramp down | 10 | 9 | 11 % | 4 → 2 | 11 ms | 35 ms | 60 ms | 0 |

## Scaling timeline observed

| T+ | Event |
|---|---|
| 0:00 | 2 instances in service |
| 5:40 | CPU alarm crosses 60 % → target tracking requests +1 → instance 3 launching |
| 6:30 | Instance 3 healthy in target group (warm-up ~80 s) |
| 7:10 | CPU still > 60 % → +1 → instance 4 |
| 7:55 | Peak load holding; CPU steady ~58 % at 5 instances |
| 12:30 | Load dropped; scale-in cooldown (300 s) elapses → −1 |
| 15:10 | Second scale-in → 2 instances (floor reached) |

## Observations

- **Response time degradation preceded scaling**: p95 peaked at ~310 ms during
  the ramp *before* new instances joined — expected, CPU is a lagging signal.
- After scale-out completed, p95 recovered to ~110 ms at *higher* traffic than
  caused the initial degradation.
- Scale-in took ~2 cooldown cycles to shed 3 instances; no oscillation was
  observed (CPU stayed below target during scale-in).
- Error rate stayed at 0 once the ALB + ASG were in place; single-instance
  baseline (M1) dropped requests at comparable load.
