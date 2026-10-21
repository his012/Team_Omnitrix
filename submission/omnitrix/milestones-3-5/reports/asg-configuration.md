# Milestone 3 — Auto Scaling Configuration Report

Applied by `scripts/create-asg.sh`.

## Launch template

- **AMI:** Amazon Linux 2023 (latest, resolved via SSM public parameter)
- **Instance type:** t3.micro (matches the baseline instance in M1)
- **User-data:** installs the same baseline app, so every scale-out instance is
  identical to the manually-launched one
- **Detailed monitoring:** enabled — 1-minute metrics, required for responsive
  target tracking (5-minute default is too coarse for scale-out decisions)

## Capacity limits

| Parameter | Value | Reasoning |
|---|---|---|
| Min size | 2 | Survives one instance/AZ failure; still cheap |
| Desired | 2 | Steady-state demand (~150 RPS handled comfortably) |
| Max size | 6 | ~3× headroom for peaks; hard cap on cost and blast radius |

## Scaling policies

1. **Primary — target tracking, `ASGAverageCPUUtilization`, target 60 %**
   - Scale-out cooldown **120 s**, scale-in cooldown **300 s**.
   - Asymmetric cooldowns: add capacity fast (protect latency), remove it
     slowly (avoid oscillation on traffic dips).
   - Target tracking self-corrects: it computes the needed instance count, so
     no manual step thresholds to tune.
2. **Secondary — step scaling on `RequestCountPerTarget` > 800/min**
   - +1 instance for 800–1200 req/target/min, +2 above that. Protects against
     request-driven spikes before CPU catches up.

## Additional ASG settings

- `--health-check-type ELB`: the ALB's health check result (not just EC2
  reachability) decides instance replacement — an app that crashed but pings
  fine still gets replaced.
- `--health-check-grace-period 120`: gives new instances time to install and
  start the app before health failures count.

## Instance warm-up note

Target tracking accounts for instance warm-up via the ASG's
`InstanceWarmup` setting. In this lab, app startup ≈ 60–90 s, so a 120 s
warm-up (equal to scale-out cooldown) prevents counting cold instances toward
the CPU average and over-provisioning.
