#!/usr/bin/env bash
# Milestone 2: create an Application Load Balancer, target group with health
# checks, register instances, and attach a listener.
# Usage: ./configure-alb.sh <vpc-id> <subnet-id-1> <subnet-id-2> <instance-id>...
set -euo pipefail

VPC_ID="${1:?vpc-id}"; shift
SUBNET_1="${1:?subnet-id-1}"; shift
SUBNET_2="${1:?subnet-id-2}"; shift
INSTANCES=("$@")

# 1. Target group: HTTP :80, health check on /health
TG_ARN=$(aws elbv2 create-target-group \
  --name omnitrix-tg --protocol HTTP --port 80 --vpc-id "$VPC_ID" \
  --health-check-protocol HTTP --health-check-path /health \
  --health-check-interval-seconds 15 --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --query 'TargetGroups[0].TargetGroupArn' --output text)

# 2. Register application instances as targets
for iid in "${INSTANCES[@]}"; do
  aws elbv2 register-targets --target-group-arn "$TG_ARN" \
    --targets Id="$iid",Port=80
done

# 3. Security group for the ALB (HTTP ingress from anywhere)
ALB_SG_ID=$(aws ec2 create-security-group \
  --group-name omnitrix-alb-sg --description "Omnitrix ALB" \
  --vpc-id "$VPC_ID" --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$ALB_SG_ID" \
  --protocol tcp --port 80 --cidr 0.0.0.0/0

# 4. Internet-facing ALB across two AZs
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name omnitrix-alb --type application --scheme internet-facing \
  --subnets "$SUBNET_1" "$SUBNET_2" --security-groups "$ALB_SG_ID" \
  --query 'LoadBalancers[0].LoadBalancerArn' --output text)

# 5. Listener :80 -> forward to target group
aws elbv2 create-listener --load-balancer-arn "$ALB_ARN" \
  --protocol HTTP --port 80 \
  --default-actions Type=forward,TargetGroupArn="$TG_ARN" >/dev/null

aws elbv2 wait load-balancers-available --load-balancer-arns "$ALB_ARN"
DNS=$(aws elbv2 describe-load-balancers --load-balancer-arns "$ALB_ARN" \
  --query 'LoadBalancers[0].DNSName' --output text)
echo "ALB ready: http://$DNS"
echo "Target group: $TG_ARN"
echo "Check target health:"
echo "  aws elbv2 describe-target-health --target-group-arn $TG_ARN"
