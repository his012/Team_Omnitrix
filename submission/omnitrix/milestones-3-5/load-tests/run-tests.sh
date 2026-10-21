#!/usr/bin/env bash
# Milestone 4: run the repeatable load test suite against the ALB.
# Usage: ./run-tests.sh <alb-dns> [locust|k6]
set -euo pipefail

HOST_URL="${1:?usage: run-tests.sh http://<alb-dns> [locust|k6]}"
TOOL="${2:-locust}"
DIR="$(cd "$(dirname "$0")" && pwd)"
STAMP=$(date +%Y%m%d-%H%M%S)

# baseline single-request sanity + timing
curl -s -o /dev/null -w "sanity: %{http_code} %{time_total}s\n" "$HOST_URL/health"

case "$TOOL" in
  locust)
    locust -f "$DIR/locustfile.py" --host "$HOST_URL" \
      --users 200 --spawn-rate 10 --run-time 13m --headless \
      --html "results-locust-$STAMP.html" --csv "results-locust-$STAMP"
    ;;
  k6)
    HOST="$HOST_URL" k6 run "$DIR/k6-script.js" \
      --summary-export "results-k6-$STAMP.json"
    ;;
  *)
    echo "unknown tool: $TOOL (use locust or k6)" >&2; exit 1 ;;
esac

# capture scaling activity + instance count right after the run
aws autoscaling describe-scaling-activities \
  --auto-scaling-group-name omnitrix-asg --max-items 10 \
  > "scaling-activities-$STAMP.json"
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names omnitrix-asg \
  --query 'AutoScalingGroups[0].[DesiredCapacity,Instances[].InstanceId]' \
  >> "scaling-activities-$STAMP.json"

echo "Results saved with stamp $STAMP."
