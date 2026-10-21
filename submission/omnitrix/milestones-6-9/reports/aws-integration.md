# Milestone 9 — AWS Integration: How the Components Work Together

## Architecture

```
                       ┌──────────────────────────────┐
                       │            Route 53/DNS      │ (optional)
                       └──────────────┬───────────────┘
                                      │
                             ┌────────▼────────┐
              Users ───────► │   ALB (public)  │  health checks ──┐
                             │  listener :80   │◄─────────────────┘
                             └───────┬─────────┘
                          forwards   │   target group omnitrix-tg
                    ┌────────────────┼────────────────┐
              ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
              │ EC2 t3.micro│   │ EC2 t3.micro│   │  EC2 …    │  ← Auto Scaling group
              │ (AZ-a)     │    │ (AZ-b)     │    │ (scaled)  │     min 2 / desired 2 / max 6
              └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
                    └────────────────┼────────────────┘
                                     │ publish metrics (1-min)
                          ┌──────────▼───────────┐
                          │      CloudWatch      │ alarms, dashboards
                          └──────────┬───────────┘
                                     │ CPU > 60% → scale-out; low → scale-in
                          ┌──────────▼───────────┐
                          │  EC2 Auto Scaling    │ uses launch template omnitrix-lt
                          └──────────────────────┘
```

## The feedback loop

1. **ALB** receives all traffic, health-checks every target on `/health` every
   15 s, and forwards only to healthy instances in both AZs.
2. Each **EC2** instance runs the baseline app and reports `CPUUtilization` to
   **CloudWatch** at 1-minute granularity (detailed monitoring).
3. **CloudWatch** feeds the ASG's target-tracking policy: when average CPU
   crosses 60 %, the policy computes the required instance count.
4. **Auto Scaling** launches instances from the launch template, waits out the
   120 s warm-up, then the ALB's target group automatically registers and
   health-checks them — no manual registration.
5. When demand falls and the 300 s scale-in cooldown passes, the ASG
   terminates surplus instances; the ALB drains their connections first
   (deregistration delay) and deregisters them.

## Controlled scale-out demonstration (performed)

- Load ramp from 10 → 200 users (`k6-script.js`).
- CPU alarm breached at 12:16 (72 %) → ASG activity
  `Launching a new EC2 instance: i-0cc333…` → healthy in TG at 12:17:30.
- Two further events brought the fleet to 5 instances; p95 recovered from
  310 ms to 110 ms while peak traffic continued.
- Evidence: `../reports/monitoring-evidence.md` (scaling activities),
  `../reports/load-test-results.md` (metrics timeline).

## Scale-in demonstration

- After ramp-down, first scale-in at 12:30 (300 s cooldown), second at 12:38;
  fleet returned to the min of 2. Requests were drained via deregistration
  delay before termination; no client errors.

## Deliverables map

| Milestone | Artifact |
|---|---|
| M1 app + baseline | `../../milestones-1-2/app/`, `../../milestones-1-2/reports/baseline-measurement.md` |
| M2 ALB | `../../milestones-1-2/scripts/configure-alb.sh`, `alb-verification.md` |
| M3 ASG | `../../milestones-3-5/scripts/create-asg.sh`, `asg-configuration.md` |
| M4 load tests | `../../milestones-3-5/load-tests/`, `load-test-results.md` |
| M5 analysis | `../../milestones-3-5/reports/scaling-analysis.md` |
| M6 monitoring | `../scripts/setup-cloudwatch.sh`, `monitoring-evidence.md` |
| M7 cost & cleanup | `cost-reliability-analysis.md`, `../scripts/cleanup.sh` |
| M8 dashboard | `../dashboard/`, `final-report.md` |
