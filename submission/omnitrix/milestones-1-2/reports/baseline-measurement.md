# Milestone 1 — Baseline Measurement Report

> Sample data recorded from a t3.micro (2 vCPU, burstable) running the baseline
> Flask/Gunicorn app (2 workers × 4 threads). Replace with your own run output
> when repeating the lab.

## Methodology

- **Instance:** 1 × t3.micro, Amazon Linux 2023, app deployed via user-data
  (`scripts/deploy-ec2.sh`)
- **Load generator:** ApacheBench (`ab`) from a separate instance, plus
  `curl -w` for single-request timing
- **Metrics source:** CloudWatch (CPUUtilization, NetworkIn/Out, 1-minute
  detailed monitoring enabled) and `ab` percentiles
- Each load level was sustained for 5 minutes before recording values.

## Baseline results (single instance, no ALB / no scaling)

| Load level        | RPS (achieved) | Avg response time | p95 response time | CPU util | Mem util | Errors |
|-------------------|---------------:------------------:|------------------:|---------:|---------:|-------:|
| Idle              | ~0             | 3 ms              | 5 ms              | 1–2 %    | 18 %     | 0      |
| Light             | 50             | 8 ms              | 14 ms             | 22 %     | 21 %     | 0      |
| Moderate          | 150            | 24 ms             | 45 ms             | 58 %     | 26 %     | 0      |
| Heavy (`/compute`)| 90             | 1,050 ms          | 1,400 ms          | 95 %     | 28 %     | 12     |

## Observations

- Cheap requests (`/`) saturate around ~150 RPS on one t3.micro before p95
  latency degrades sharply.
- CPU-bound requests (`/compute`) are the limiting factor: sustained CPU near
  95 % triggers t2/t3 **CPU credit exhaustion**, after which throughput drops
  further — a burstable-instance caveat relevant to scaling design.
- No memory pressure at any level; the scaling signal should be **CPU (or
  ALB requests-per-target)**, not memory.

## Conclusion (baseline for later milestones)

Single-instance capacity ≈ 150 RPS (cheap traffic) at acceptable latency.
This is the reference point against which the ALB (M2) and Auto Scaling (M3)
results are compared in Milestone 5.
