"""Locust load profile: 80% cheap requests, 20% CPU-heavy compute.

Run:  locust -f locustfile.py --host http://<ALB-DNS> --users 200 \
        --spawn-rate 10 --run-time 10m --headless
"""
from locust import HttpUser, between, task


class OmnitrixUser(HttpUser):
    wait_time = between(0.5, 1.5)

    @task(8)
    def index(self):
        self.client.get("/")

    @task(2)
    def compute(self):
        self.client.get("/compute?n=25", timeout=10)
