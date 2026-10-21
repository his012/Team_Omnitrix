"""Baseline web application for load-balancing / auto-scaling labs.

Endpoints:
  /                -> simple JSON hello (cheap request)
  /health          -> 200 OK health check for ALB target group
  /compute?n=25    -> burns CPU for ~n * 50ms to simulate work (load testing)
"""
import json
import time

from flask import Flask, request

app = Flask(__name__)


@app.get("/")
def index():
    return {"status": "ok", "app": "omnitrix-baseline", "host": request.host}


@app.get("/health")
def health():
    return {"status": "healthy"}, 200


@app.get("/compute")
def compute():
    n = max(1, min(int(request.args.get("n", 25)), 100))
    # deliberate CPU burn: repeated hashing approximates n * ~50ms of work
    target = time.time() + n * 0.05
    x = 0
    while time.time() < target:
        x = (x * 31 + 7) % 1_000_003
    return {"status": "done", "n": n, "x": x}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=80, threaded=True)
