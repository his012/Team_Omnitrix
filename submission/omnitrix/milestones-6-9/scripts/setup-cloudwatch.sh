#!/usr/bin/env bash
# Milestone 6: CloudWatch alarms + detailed monitoring for the stack.
# Usage: ./setup-cloudwatch.sh <target-group-arn> <target-group-name> <asg-name>
set -euo pipefail

TG_ARN="${1:?target-group-arn}"
TG_NAME="${2:?target-group-name}"
ASG_NAME="${3:?asg-name}"
TG_DIM="Name=TargetGroup,Value=$TG_NAME"
LB_DIM_PREFIX="Name=LoadBalancer,Value="

# ALB name is embedded in its ARN: app/<name>/<id>
LB_FULL=$(aws elbv2 describe-target-groups \
  --target-group-arns "$TG_ARN" \
  --query 'TargetGroups[0].LoadBalancerArns[0]' --output text)
LB_SUFFIX="${LB_FULL#app/}"
LB_NAME="${LB_SUFFIX%%/*}"
LB_DIM="$LB_DIM_PREFIX$LB_FULL"

alarm() { aws cloudwatch put-metric-alarm "$@" >/dev/null; }

# ASG CPU high / low
alarm --alarm-name "$ASG_NAME-cpu-high" \
  --dimensions "Name=AutoScalingGroupName,Value=$ASG_NAME" \
  --metric-name CPUUtilization --namespace AWS/EC2 \
  --statistic Average --period 60 --evaluation-periods 3 --threshold 75 \
  --comparison-operator GreaterThanThreshold

alarm --alarm-name "$ASG_NAME-cpu-low" \
  --dimensions "Name=AutoScalingGroupName,Value=$ASG_NAME" \
  --metric-name CPUUtilization --namespace AWS/EC2 \
  --statistic Average --period 300 --evaluation-periods 3 --threshold 20 \
  --comparison-operator LessThanThreshold

# ALB errors + latency
alarm --alarm-name "$ASG_NAME-alb-5xx" \
  --dimensions "$LB_DIM" \
  --metric-name HTTPCode_Target_5XX_Count --namespace AWS/ApplicationELB \
  --statistic Sum --period 60 --evaluation-periods 2 --threshold 10 \
  --comparison-operator GreaterThanThreshold

alarm --alarm-name "$ASG_NAME-response-time-high" \
  --dimensions "$TG_DIM" \
  --metric-name TargetResponseTime --namespace AWS/ApplicationELB \
  --statistic Average --period 60 --evaluation-periods 3 --threshold 1 \
  --comparison-operator GreaterThanThreshold

# Unhealthy hosts (feeding Milestone 6 health evidence)
alarm --alarm-name "$ASG_NAME-unhealthy-hosts" \
  --dimensions "$TG_DIM" \
  --metric-name UnHealthyHostCount --namespace AWS/ApplicationELB \
  --statistic Maximum --period 60 --evaluation-periods 2 --threshold 0 \
  --comparison-operator GreaterThanThreshold

echo "Alarms created. View: aws cloudwatch describe-alarms --alarm-name-prefix $ASG_NAME"
