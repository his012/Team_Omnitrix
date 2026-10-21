#!/usr/bin/env bash
# Milestone 8: publish the CloudWatch dashboard.
set -euo pipefail
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
aws cloudwatch put-dashboard \
  --dashboard-name OmnitrixDashboard \
  --dashboard-body "file://$(dirname "$0")/CloudWatch-dashboard.json"
echo "Dashboard: https://${REGION}.console.aws.amazon.com/cloudwatch/home?region=${REGION}#dashboards:name=OmnitrixDashboard"
