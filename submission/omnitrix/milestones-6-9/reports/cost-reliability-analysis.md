# Milestone 7 — Cost & Reliability Analysis

## Cost model (sample, us-east-1 on-demand, no free tier)

| Component | Unit cost | Standing cost (min=2) | Peak cost (max=6) |
|---|---:|---:|---:|
| t3.micro instance | $0.0104/hr | $0.0208/hr | $0.0624/hr |
| ALB | ~$0.0225/hr + LCU | ~$0.0225/hr | same |
| EBS 8 GB gp3 | $0.0064/GB-mo | ~$0.05/mo per volume | ~$0.32/mo |

- 24/7 month at min=2: **(2 × $0.0104 + $0.0225) × 730 ≈ $31.8/mo** (+ data/LCU).
- Auto Scaling is only "cheaper" relative to statically sizing for peak:
  running max=6 24/7 would cost ~$45.7/mo + more LCU for capacity that is used
  maybe 10 % of the time.
- Burstable (t3) caveat: sustained high CPU depletes CPU credits; at constant
  heavy load, t3.small or a non-burstable family may be cheaper than credit
  overage charges.

## Effect of min / max capacity

| Setting | Availability effect | Cost effect |
|---|---|---|
| Min = 2 | Survives one instance/AZ failure with no cold start; also gives ALB an instant second target | Doubles the floor cost vs min=1, but min=1 means a single failure = full outage |
| Max = 6 | Caps worst-case latency protection at ~3× steady capacity | Hard ceiling on spend; also limits blast radius of a runaway scale loop |
| Min = 0 (not used) | Cheap but total cold-start outage on first request | Only acceptable for dev/batch |

## Avoiding unnecessary scaling

1. **Asymmetric cooldowns** (120 s out / 300 s in) — the biggest thrash killer.
2. **Hysteresis via target tracking** — the controller itself avoids setpoint
   oscillation better than hand-tuned step thresholds.
3. **Instance warm-up** — cold instances inflating the CPU average is the main
   cause of premature multi-scale-out.
4. **Scheduled scaling** for known peaks (e.g., business hours) instead of
   waiting for alarms; predictive scaling if traffic follows a daily curve.
5. **Right-size before scaling** — 2 × t3.small at 45 % CPU may be cheaper and
   calmer than 4 × t3.micro at 85 %.

## Protecting the application from excessive load

- **Max-size cap** is the first line: overload degrades gracefully rather than
  spawning unbounded instances.
- **ALB-level throttling**: WAF rate-based rules or path-level 429s for abusive
  clients.
- **Queue buffering** (SQS) for work that doesn't need synchronous response.
- **Graceful degradation** in the app: shed non-critical work (return cached or
  simplified responses) when saturated.
- **Read-only failover path**: static error page from the ALB (fixed-response
  listener rule) if all targets go unhealthy.

## Safe cleanup after testing

`scripts/cleanup.sh` tears the stack down in dependency order and requires an
explicit `YES` confirmation. Order matters — resources that reference each
other (ASG → TG → ALB → SG) must be deleted leaf-first, and **the ASG must be
scaled/deleted before the target group**, or it will re-register instances.
Estimated post-cleanup recurring cost: $0. (EBS snapshots and CloudWatch
dashboards/alarms deleted too; log groups optionally retained.)
