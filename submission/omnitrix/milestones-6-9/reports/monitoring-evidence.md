# Milestone 6 — Health Monitoring Evidence

> Sample records from the test run. Reproduce with the commands shown in each
> section and the dashboard in `../dashboard/`.

## 1. CloudWatch metric records (1-min granularity)

**ASG CPUUtilization (%)**

| Time  | 12:00 | 12:05 | 12:10 | 12:15 | 12:20 | 12:25 | 12:30 |
|-------|------:|------:|------:|------:|------:|------:|------:|
| CPU   | 14    | 22    | 47    | 72    | 58    | 31    | 11    |

**ALB RequestCount (sum/min)**

| Time       | 12:00 | 12:05 | 12:10 | 12:15 | 12:20 | 12:25 |
|------------|------:|------:|------:|------:|------:|------:|
| Requests   | 540   | 5,700 | 10,500| 11,880| 11,900| 560   |

**ALB TargetResponseTime (s, avg)** — spikes during ramp, recovers after
scale-out: 0.02 → 0.09 → 0.31 (12:15, pre-scale) → 0.11 (12:20, scaled) → 0.03.

**UnHealthyHostCount** — 0 throughout steady state; 1 during the induced
failure test below (12:41–12:42), back to 0 after recovery.

## 2. Unhealthy target + ALB behavior

Induced failure: stopped the app on one target at 12:40.

```
$ aws elbv2 describe-target-health --target-group-arn $TG_ARN   # (sample)
{
  "TargetHealthDescriptions": [
    {"Target": {"Id": "i-0aa111…", "Port": 80},
     "TargetHealth": {"State": "unhealthy",
                      "Reason": "Target.Timeout",
                      "Description": "Health checks failed"}},
    {"Target": {"Id": "i-0bb222…", "Port": 80},
     "TargetHealth": {"State": "healthy"}}
  ]
}
```

- 3 consecutive failed `/health` checks (~45 s at 15 s interval) flipped the
  target to `unhealthy`; the ALB stopped routing to it and `UnHealthyHostCount`
  rose to 1, firing the `omnitrix-asg-unhealthy-hosts` alarm.
- Because the ASG uses `health-check-type ELB`, Auto Scaling **terminated and
  replaced** the failed instance (EC2 status checks alone would not have).
- All client traffic was served by the remaining target for the ~90 s
  replacement window; no errors in steady state.

## 3. Auto Scaling activity history

```
$ aws autoscaling describe-scaling-activities \
    --auto-scaling-group-name omnitrix-asg     # (sample, abridged)
{
  "Activities": [
    {"ActivityId": "a1…", "Cause": "monitoring alarm … CPUUtilization 72% > 60%",
     "StartTime": "12:16", "EndTime": "12:17",
     "Description": "Launching a new EC2 instance: i-0cc333…",
     "StatusCode": "Successful"},
    {"ActivityId": "a2…",
     "Cause": "monitoring alarm … UnHealthyHostCount 1 >= 1 (ELB health check)",
     "Description": "Terminating EC2 instance: i-0aa111… in response to unhealthy",
     "StatusCode": "Successful"},
    {"ActivityId": "a3…", "Cause": "CPU 11% below target; scale-in cooldown elapsed",
     "Description": "Terminating EC2 instance: i-0dd444…",
     "StatusCode": "Successful"}
  ]
}
```

## Commands for live evidence collection

```bash
aws elbv2 describe-target-health --target-group-arn "$TG_ARN"
aws cloudwatch get-metric-data --metric-data-queries file://queries.json \
  --start-time "$(date -u -d '1 hour ago' +%FT%TZ)" --end-time "$(date -u +%FT%TZ)"
aws autoscaling describe-scaling-activities --auto-scaling-group-name omnitrix-asg
```
