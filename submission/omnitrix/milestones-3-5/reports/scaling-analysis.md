# Milestone 5 — Scaling Behavior Analysis

## Before vs after scaling (vs Milestone 1 baseline)

| Metric | Single instance (M1) | ALB + ASG (M3/M4) |
|---|---:|---:|
| Sustained RPS at acceptable p95 | ~150 | ~1,000 (6 × ~170) |
| p95 at peak load | 1,400 ms, errors | 110–190 ms, no errors |
| Behavior at overload | latency collapse, credit exhaustion | adds capacity within ~2 min |
| Behavior at failure | full outage | ALB routes around unhealthy target |

## Where scaling was too early / too late / too frequent

- **Too late:** CPU-based scale-out triggered at T+5:40, but demand started
  exceeding capacity ~T+4:00. p95 briefly tripled. CPU is a *lagging* metric —
  by the time it crosses a threshold, latency is already degraded.
- **Too early (risk observed but mitigated):** the 20 % `/compute` mix makes
  CPU spiky; with a 50 % target the ASG would flap. A 60 % target plus
  asymmetric cooldowns prevented it.
- **Too frequent (scale-in):** initial 60 s scale-in cooldown (not shown in
  final config) caused two remove/add cycles during a lull. Fixed at 300 s.

## Recommendations

| Setting | Value | Why |
|---|---|---|
| CPU target | 60 % | Headroom above the p95 inflection (~72 %) without over-provisioning |
| Scale-out cooldown | 120 s | Fast protection; matched to ~80 s instance warm-up |
| Scale-in cooldown | 300 s | Hysteresis: survives traffic dips without thrash |
| Instance warm-up | 120 s | Cold instances don't count toward CPU average |
| Secondary signal | `RequestCountPerTarget` step policy | Reacts to demand *volume*, not CPU lag |
| Optional | Predictive scaling | If traffic has a daily pattern, pre-warm before the known peak instead of reacting |

## Closing assessment

The configuration scaled out twice during the ramp, held a stable CPU band
(50–65 %) at peak, and scaled back to the floor without oscillation. Remaining
tuning lever if latency matters more than cost: lower the target to 50 % and
add the step policy's lower band, accepting ~1 extra standing instance.
