#!/usr/bin/env bash
# Milestone 3: launch template + Auto Scaling group + scaling policies.
# Usage: ./create-asg.sh <vpc-id> <subnet-id-1> <subnet-id-2> <sg-id> <target-group-arn>
set -euo pipefail

VPC_ID="${1:?vpc-id}"
SUBNET_1="${2:?subnet-1}"; SUBNET_2="${3:?subnet-2}"
SG_ID="${4:?security-group-id}"
TG_ARN="${5:?target-group-arn}"
APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

AMI_ID=$(aws ssm get-parameters --names \
  /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query 'Parameters[0].Value' --output text)

USER_DATA=$( { printf 'SERVER_PY_B64=%s\n' \
  "$(base64 -w0 "$APP_DIR/milestones-1-2/app/server.py")"; \
  cat "$APP_DIR/milestones-1-2/app/user-data.sh"; } | base64 -w0)

# 1. Launch template (reused for every scale-out event)
LT_ID=$(aws ec2 create-launch-template \
  --launch-template-name omnitrix-lt --version-description v1 \
  --launch-template-data "{
    \"ImageId\": \"$AMI_ID\",
    \"InstanceType\": \"t3.micro\",
    \"SecurityGroupIds\": [\"$SG_ID\"],
    \"UserData\": \"$USER_DATA\",
    \"Monitoring\": {\"Enabled\": true},
    \"TagSpecifications\": [{
      \"ResourceType\": \"instance\",
      \"Tags\": [{\"Key\": \"Name\", \"Value\": \"omnitrix-asg\"}]
    }]
  }" --query 'LaunchTemplate.LaunchTemplateId' --output text)

# 2. Auto Scaling group: min 2 / desired 2 / max 6 across two AZs,
#    attached to the ALB target group
ASG_NAME=omnitrix-asg
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name "$ASG_NAME" \
  --launch-template "LaunchTemplateId=$LT_ID,Version=1" \
  --min-size 2 --desired-capacity 2 --max-size 6 \
  --vpc-zone-identifier "$SUBNET_1,$SUBNET_2" \
  --target-group-arns "$TG_ARN" \
  --health-check-type ELB --health-check-grace-period 120 \
  --tags "Key=Name,Value=omnitrix-asg,PropagateAtLaunch=true"

# 3a. Target tracking on CPU (primary policy)
aws autoscaling put-scaling-policy \
  --auto-scaling-group-name "$ASG_NAME" \
  --policy-name cpu-target-tracking \
  --policy-type TargetTrackingScaling \
  --target-tracking-configuration '{
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ASGAverageCPUUtilization"
    },
    "TargetValue": 60,
    "ScaleOutCooldown": 120,
    "ScaleInCooldown": 300
  }' >/dev/null

# 3b. Step scaling on requests-per-target (secondary, burst protection):
#     create the policy first, then wire the CloudWatch alarm to it.
POLICY_ARN=$(aws autoscaling put-scaling-policy \
  --auto-scaling-group-name "$ASG_NAME" \
  --policy-name req-step-scaling --policy-type StepScaling \
  --adjustment-type ChangeInCapacity --metric-aggregation-type Average \
  --step-adjustments \
    "MetricIntervalLowerBound=0,MetricIntervalUpperBound=400,ScalingAdjustment=1" \
    "MetricIntervalLowerBound=400,ScalingAdjustment=2" \
  --query 'PolicyARN' --output text)

aws cloudwatch put-metric-alarm \
  --alarm-name omnitrix-req-per-target-high \
  --metric-name RequestCountPerTarget --namespace AWS/ApplicationELB \
  --statistic Sum --period 60 --evaluation-periods 2 --threshold 800 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --dimensions "Name=TargetGroup,Value=$(aws elbv2 describe-target-groups \
      --target-group-arns "$TG_ARN" --query 'TargetGroups[0].TargetGroupName' --output text)" \
  --alarm-actions "$POLICY_ARN" >/dev/null

echo "ASG '$ASG_NAME' created: min=2 desired=2 max=6, target CPU 60%."
echo "Scaling activities:"
echo "  aws autoscaling describe-scaling-activities --auto-scaling-group-name $ASG_NAME"
