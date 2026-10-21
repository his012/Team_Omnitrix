#!/usr/bin/env bash
# Milestone 7: safe teardown of the entire test stack, in dependency order.
# Usage: ./cleanup.sh <asg-name> <target-group-arn> <alb-arn> <launch-template-id> <security-group-ids...>
set -euo pipefail

ASG_NAME="${1:?asg-name}"; TG_ARN="${2:?target-group-arn}"
ALB_ARN="${3:?alb-arn}";   LT_ID="${4:?launch-template-id}"
shift 4; SGS=("$@")

echo "This will DELETE: ASG '$ASG_NAME', its instances, target group, ALB,"
echo "launch template, alarms, dashboard, and security groups: ${SGS[*]}"
read -r -p "Type YES to confirm: " CONFIRM
[ "$CONFIRM" = "YES" ] || { echo "aborted."; exit 1; }

# 1. Alarms + dashboard (cheap to leave but pointless to keep)
for a in $(aws cloudwatch describe-alarms \
    --alarm-name-prefix omnitrix --query 'MetricAlarms[].AlarmName' --output text); do
  aws cloudwatch delete-alarms --alarm-names "$a"
done
aws cloudwatch delete-dashboards --dashboard-names OmnitrixDashboard 2>/dev/null || true

# 2. ASG first — it re-creates instances that would block everything else
aws autoscaling delete-auto-scaling-group --auto-scaling-group-name "$ASG_NAME" \
  --force-delete
echo "waiting for ASG deletion…"
while aws autoscaling describe-auto-scaling-groups \
    --auto-scaling-group-names "$ASG_NAME" \
    --query 'AutoScalingGroups[0]' --output text 2>/dev/null | grep -qiv "^None"; do
  sleep 10
done

# 3. Listener(s), then ALB
for l in $(aws elbv2 describe-listeners --load-balancer-arn "$ALB_ARN" \
    --query 'Listeners[].ListenerArn' --output text); do
  aws elbv2 delete-listener --listener-arn "$l"
done
aws elbv2 delete-load-balancer --load-balancer-arn "$ALB_ARN"

# 4. Target group (must outlive the ALB deletion, then go)
aws elbv2 delete-target-group --target-group-arn "$TG_ARN"

# 5. Launch template, then security groups (after ENIs are released)
aws ec2 delete-launch-template --launch-template-id "$LT_ID"
sleep 30  # allow ALB ENIs to detach
for sg in "${SGS[@]}"; do
  aws ec2 delete-security-group --group-id "$sg" 2>/dev/null \
    || echo "SG $sg still in use — retry after ENIs release."
done

echo "Cleanup complete. Verify: aws ec2 describe-instances --filters Name=tag:Name,Values=omnitrix*"
