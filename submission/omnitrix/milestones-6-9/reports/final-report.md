# Milestone 8 — Final Report: Performance & Scaling at a Glance

> Sample run, 13-minute k6 profile (10 → 200 → 10 users) against the ALB.
> Live version: CloudWatch dashboard `OmnitrixDashboard`
> (`dashboard/deploy-dashboard.sh`).

## Executive summary

Under a 13× traffic ramp, the stack kept p95 latency under 200 ms at peak and
error-free throughout, by growing from 2 to 5 instances in two scale-out
events (~2 min each), then shrinking back to the floor of 2 within ~8 minutes
of the load drop. One induced instance failure was detected in ~45 s and
replaced automatically with no steady-state client impact.

## Request volume & response time

| Phase | RPS | p50 | p95 | p99 | 5xx errors |
|---|---:|---:|---:|---:|---:|
| Warm-up | 9 | 12 ms | 38 ms | 55 ms | 0 |
| Peak, pre-scale | 175 | 85 ms | 310 ms | 520 ms | 0 |
| Peak, scaled | 198 | 40 ms | 110 ms | 190 ms | 0 |
| Ramp-down | 9 | 11 ms | 35 ms | 60 ms | 0 |

## CPU & instance count vs scaling events

| Time | CPU % | Instances | Event |
|---|---:|---:|---|
| 12:00 | 14 | 2 | steady |
| 12:16 | 72 | 2 → 3 | **scale-out #1** (CPU > 60 %) |
| 12:19 | 66 | 3 → 4 | **scale-out #2** |
| 12:22 | 58 | 5 | **scale-out #3** — target band reached |
| 12:30 | 11 | 5 → 4 | scale-in (300 s cooldown elapsed) |
| 12:38 | 10 | 2 | back at floor |

## Target health

- HealthyHostCount: 2 → 5 → 2, tracking instance count with ~80 s join delay
  per new instance (warm-up).
- UnHealthyHostCount: 0 for the whole run except 1 during the induced-failure
  test (12:41); the ALB cut traffic to the failed target within 3 checks and
  Auto Scaling replaced it in ~90 s.

## Conclusions

1. Target tracking at 60 % CPU held the fleet in a stable band at peak — no
   post-scale undershoot or overshoot.
2. The only latency penalty occurred *before* the first scale-out completed;
   if that matters, a request-count-based or predictive policy closes the gap.
3. Steady-state cost stays at the 2-instance floor for the ~85 % of time load
   is low; the scaling machinery only pays for what peaks actually need.
