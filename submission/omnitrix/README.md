# Omnitrix — Intelligent Auto Scaling & Load Management for Web Applications

Team Omnitrix's submission for *Intelligent Auto Scaling and Load Management
for Web Applications*. Each milestone's deliverables live in its folder:

| Milestone | Deliverables | Location |
|---|---|---|
| 1 — Application setup | Flask baseline app, EC2 deploy script, baseline report | [`milestones-1-2/app/`](milestones-1-2/app/), [`scripts/deploy-ec2.sh`](milestones-1-2/scripts/deploy-ec2.sh), [`reports/baseline-measurement.md`](milestones-1-2/reports/baseline-measurement.md) |
| 2 — Load balancer | ALB + target group + health checks script, verification report | [`milestones-1-2/scripts/configure-alb.sh`](milestones-1-2/scripts/configure-alb.sh), [`reports/alb-verification.md`](milestones-1-2/reports/alb-verification.md) |
| 3 — Auto scaling | Launch template + ASG + scaling policies, config report | [`milestones-3-5/scripts/create-asg.sh`](milestones-3-5/scripts/create-asg.sh), [`reports/asg-configuration.md`](milestones-3-5/reports/asg-configuration.md) |
| 4 — Load simulation | Locust + k6 load profiles, runner, results report | [`milestones-3-5/load-tests/`](milestones-3-5/load-tests/), [`reports/load-test-results.md`](milestones-3-5/reports/load-test-results.md) |
| 5 — Scaling analysis | Before/after comparison, threshold & cooldown recommendations | [`milestones-3-5/reports/scaling-analysis.md`](milestones-3-5/reports/scaling-analysis.md) |
| 6 — Health monitoring | CloudWatch alarms script, monitoring evidence | [`milestones-6-9/scripts/setup-cloudwatch.sh`](milestones-6-9/scripts/setup-cloudwatch.sh), [`reports/monitoring-evidence.md`](milestones-6-9/reports/monitoring-evidence.md) |
| 7 — Cost & reliability | Cost/availability analysis, safe cleanup script | [`milestones-6-9/reports/cost-reliability-analysis.md`](milestones-6-9/reports/cost-reliability-analysis.md), [`scripts/cleanup.sh`](milestones-6-9/scripts/cleanup.sh) |
| 8 — Visualization | CloudWatch dashboard JSON + deploy script, final report | [`milestones-6-9/dashboard/`](milestones-6-9/dashboard/), [`reports/final-report.md`](milestones-6-9/reports/final-report.md) |
| 9 — AWS integration | Architecture explanation + scale-out/in demo walkthrough | [`milestones-6-9/reports/aws-integration.md`](milestones-6-9/reports/aws-integration.md) |

## Architecture

```
Users → ALB (health checks on /health) → target group → EC2 t3.micro fleet
                                            ↑                ↓ 1-min metrics
                                       register/deregister  CloudWatch
                                            └── Auto Scaling (min 2 / max 6,
                                                 CPU target-tracking 60%)
```

## Quick start

```bash
# 1. baseline instance
./milestones-1-2/scripts/deploy-ec2.sh <keypair>
# 2. ALB + target group
./milestones-1-2/scripts/configure-alb.sh <vpc> <subnet-a> <subnet-b> <instance-id>
# 3. launch template + ASG + scaling policies
./milestones-3-5/scripts/create-asg.sh <vpc> <subnet-a> <subnet-b> <sg> <tg-arn>
# 4. alarms + dashboard
./milestones-6-9/scripts/setup-cloudwatch.sh <tg-arn> <tg-name> omnitrix-asg
./milestones-6-9/dashboard/deploy-dashboard.sh
# 5. load test
./milestones-3-5/load-tests/run-tests.sh http://<alb-dns> k6
# 6. tear everything down
./milestones-6-9/scripts/cleanup.sh omnitrix-asg <tg-arn> <alb-arn> <lt-id> <sg-ids...>
```

Reports contain sample measurement data from a representative run (labeled as
such); re-run the scripts and load profiles to reproduce with live numbers.

## Team

| Teammate | Contribution |
|---|---|
| Farhan ([his012](https://github.com/his012)) | Milestones 1–2: baseline app, EC2 deployment, ALB configuration |
| Zain Arshad ([zain-arshad-arain](https://github.com/zain-arshad-arain)) | Milestones 3–5: Auto Scaling, load simulation, scaling analysis |
| Huzaifa Abbasi ([HuzaifaAbbasi6901](https://github.com/HuzaifaAbbasi6901)) | Milestones 6–9: monitoring, cost analysis, dashboard, AWS integration write-up |
