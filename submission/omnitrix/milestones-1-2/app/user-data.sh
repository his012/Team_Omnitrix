#!/bin/bash
# EC2 user-data: install and start the baseline web app on Amazon Linux 2023
dnf update -y
dnf install -y python3-pip
cd /opt
mkdir -p omnitrix-app && cd omnitrix-app
# deploy-ec2.sh prepends: SERVER_PY_B64=<base64 of app/server.py>
echo "$SERVER_PY_B64" | base64 -d > server.py
pip3 install flask gunicorn
cat > /etc/systemd/system/omnitrix-app.service <<'EOF'
[Unit]
Description=Omnitrix baseline web app
After=network.target

[Service]
WorkingDirectory=/opt/omnitrix-app
ExecStart=/usr/bin/gunicorn -b 0.0.0.0:80 -w 2 --threads 4 server:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF
systemctl enable --now omnitrix-app
