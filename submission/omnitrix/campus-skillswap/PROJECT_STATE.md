# PROJECT_STATE — Campus Gig & SkillSwap Portal

- Official problem: https://github.com/AWSCloudClubMuet/HacktoberFest-3.0/issues/12
- Team: Omnitrix
- Status: MVP implemented locally as a standalone folder; not pushed to GitHub, not deployed.
- Stack: React/Vite frontend + Node/Express HTTP mock API + JSON persistence.
- Files: `client/src/main.jsx` UI, `client/src/style.css` styles, `server/index.js` API, `server/rules.js` policy logic, `server/seed.json` fixture.
- Commands: `npm install`, `npm run dev`, `npm test`, `npm run build`, `npm start`.
- API: documented in README.md.
- Dataset: 12 users, 25 gigs, 20 applications, 8 reviews.
- Need to verify on local laptop: install dependencies, start API/web, run manual flows, submit via leader's fork and approved branch.
- Known limits: demo user switch not actual authentication; JSON file data not suitable for concurrent production deployments; free cloud service may lose runtime writes.
- Current blocker: local verification on user's Windows machine + team-leader-managed Git integration.
- Demo: Explore -> Post -> Switch Demo User -> Apply -> Switch Owner -> Manage -> Accept -> Complete -> Mutual Reviews.
