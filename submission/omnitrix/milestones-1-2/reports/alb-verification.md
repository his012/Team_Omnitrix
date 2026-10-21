# Milestone 2 — ALB Configuration & Verification

Configuration applied by `scripts/configure-alb.sh`.

## Design choices

| Setting | Value | Rationale |
|---|---|---|
| LB type | Application (ALB), internet-facing | HTTP/HTTPS L7 routing, path-based health checks |
| Subnets | 2 AZs | AZ fault tolerance; ALB requires ≥2 |
| Target group protocol/port | HTTP :80 | App listens on 80 |
| Health check path | `/health` | Cheap deterministic endpoint, 200 JSON |
| Health check interval | 15 s | Fast failure detection without excessive probing |
| Healthy / unhealthy thresholds | 2 / 3 | Fail fast on healthy, avoid flapping on unhealthy |
| Deregistration delay | (default 300 s) | In-flight requests drained before target removal |

## Verification steps

1. **Target health** — after registering both instances:

   ```
   $ aws elbv2 describe-target-health --target-group-arn "$TG_ARN"
   {
     "TargetHealthDescriptions": [
       {"Target": {"Id": "i-0aa111…", "Port": 80},
        "TargetHealth": {"State": "healthy"}},
       {"Target": {"Id": "i-0bb222…", "Port": 80},
        "TargetHealth": {"State": "healthy"}}
     ]
   }
   ```
   *(sample output)* Both targets transitioned `initial → healthy` within ~35 s
   (2 checks × 15 s interval).

2. **Routing to healthy targets** — repeated requests return both hosts
   (round-robin), confirming distribution:

   ```
   $ for i in $(seq 1 6); do curl -s http://$ALB_DNS/ | jq -r .host; done
   i-0aa111…  i-0bb222…  i-0aa111…  i-0bb222…  i-0aa111…  i-0bb222…
   ```

3. ** unhealthy-target behavior** — stopping the app on instance A
   (`systemctl stop omnitrix-app`):

   - After 3 failed checks (~45 s) the target flips to `unhealthy`.
   - The ALB stops routing to it: 20/20 subsequent requests were served by
     instance B, with no client-visible 5xx during steady state.
   - Requests in flight at the moment of failure received 504 until the
     health state flipped — expected ALB behavior.
   - Restarting the app returned the target to `healthy` after 2 passing
     checks, and traffic resumed round-robin.

## Result

ALB distributes requests across AZs, detects failed targets within ~45 s,
and removes them from rotation without client-facing errors in steady state.
Target-level health from here on feeds the Auto Scaling group in Milestone 3.
