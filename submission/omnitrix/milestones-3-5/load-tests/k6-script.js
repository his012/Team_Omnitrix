// k6 equivalent: ramp 10 -> 200 -> 10 users to exercise scale-out and scale-in.
// Run: k6 run k6-script.js   (set HOST env var)
import http from "k6/http";
import { sleep } from "k6";

const HOST = __ENV.HOST || "http://localhost";

export const options = {
  stages: [
    { duration: "2m", target: 10 },   // below capacity
    { duration: "3m", target: 200 },  // ramp up -> force scale-out
    { duration: "5m", target: 200 },  // hold peak
    { duration: "3m", target: 10 },   // ramp down -> allow scale-in
  ],
  thresholds: {
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const r = Math.random();
  if (r < 0.8) {
    http.get(`${HOST}/`);
  } else {
    http.get(`${HOST}/compute?n=25`);
  }
  sleep(1);
}
