# Campus Gig & SkillSwap Portal

**Team Omnitrix · HacktoberFest 3.0 · [Challenge #12](https://github.com/AWSCloudClubMuet/HacktoberFest-3.0/issues/12)**

A campus marketplace for students who need a hand with a short project or want to offer a skill. A gig can be paid, free, or based on a skill exchange. Students can find an opportunity, apply, work with one selected applicant, and review each other when the gig is finished.

## What works

- **Student profiles:** major, semester, skills, posted/completed gigs and average rating.
- **Post and browse gigs:** Offering or Requesting posts across Programming, Design, Writing and Tutoring, with search and filters for category, payment, status and budget.
- **Apply for a gig:** a short application message and a visible application status. Applying twice to the same gig, or applying to your own gig, is blocked.
- **Manage applicants:** gig owners can accept one applicant. Other pending applications are rejected and the gig moves to **In Progress**.
- **Finish and review:** the owner marks the work **Completed**; both participants can leave a single review. The profile rating is calculated from stored reviews.
- **Mock API and starter data:** HTTP endpoints backed by a local JSON store, preloaded with 12 students, 25 gigs, 20 applications and 8 reviews.

## Run locally

Requirements: **Node.js 20 or newer** and npm.

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. The Express mock API runs on port **3001**; Vite forwards requests beginning with `/api` to that server. The development command starts both servers together.

## Check the project

```bash
npm test
npm run build
```

During our local verification, all **five** business-rule tests passed and the production build completed successfully. These are useful checks, but they don't replace clicking through the app before presenting.

## Demo walkthrough

1. Select a demo student in the **View as** menu and post a gig.
2. Switch to a different student, find that gig and apply with a message.
3. Return to the gig owner, open **My Gigs**, and accept the applicant.
4. Mark the gig **Completed**.
5. Submit a review from each participant, then open their profiles to see the received feedback.

We used this flow to check gig creation, application, selection, completion and mutual reviews in the browser.

## How it's built

| Part | Technology | Role |
| --- | --- | --- |
| Interface | React + Vite | Pages, forms, filtering and user flow |
| Mock backend | Node.js + Express | HTTP API and validation of business rules |
| Data | Local JSON files | Demo records and saved changes |
| Tests | Node.js test runner | Application rules and edge cases |

The UI talks to the backend over HTTP rather than changing mock data directly. Important checks, such as who can accept an applicant and when a review is allowed, are enforced by the server.

**Limitations:** Account switching is a demo feature, not secure authentication. JSON-file persistence is suitable for this single-instance prototype, not concurrent production use. No real payments or external messaging are processed.

## Project scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and backend for local development |
| `npm test` | Run business-rule tests |
| `npm run build` | Generate the production frontend in `dist/` |
| `npm start` | Serve the built app from Express |
| `npm run seed` | Reset demo records to the supplied starter dataset; use only when a reset is intended |

## Notes for reviewers

This submission addresses the required workflow in [Problem #12](https://github.com/AWSCloudClubMuet/HacktoberFest-3.0/issues/12). The initial data uses fictional student records. For a clean demo, keep the backend running and make sure the selected account matches the action you're testing.

**Team:** Omnitrix
