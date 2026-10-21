#!/usr/bin/env bash
# Milestone 1: launch a baseline EC2 instance running the web app.
# Usage: ./deploy-ec2.sh <key-pair-name>
set -euo pipefail

KEY_NAME="${1:?usage: deploy-ec2.sh <key-pair-name>}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# 1. Security group: HTTP for traffic + ALB health checks, SSH for admin
SG_ID=$(aws ec2 create-security-group \
  --group-name omnitrix-app-sg --description "Omnitrix baseline web app" \
  --query 'GroupId' --output text)
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
  --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id "$SG_ID" \
  --protocol tcp --port 22 --cidr 0.0.0.0/0

# 2. User-data = base64 app source as a variable + bootstrap script
USER_DATA=$( { printf 'SERVER_PY_B64=%s\n' "$(base64 -w0 "$APP_DIR/app/server.py")"; \
  cat "$APP_DIR/app/user-data.sh"; } | base64 -w0)

# 3. Launch the instance (Amazon Linux 2023, t3.micro)
AMI_ID=$(aws ssm get-parameters --names \
  /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query 'Parameters[0].Value' --output text)

INSTANCE_ID=$(aws ec2 run-instances \
  --image-id "$AMI_ID" --instance-type t3.micro \
  --key-name "$KEY_NAME" --security-group-ids "$SG_ID" \
  --user-data "$USER_DATA" \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=omnitrix-baseline}]' \
  --count 1 \
  --query 'Instances[0].InstanceId' --output text)

aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
echo "Instance running: $INSTANCE_ID (security group: $SG_ID)"
echo "Baseline app will be reachable on port 80 once user-data finishes."
