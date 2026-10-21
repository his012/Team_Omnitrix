# KisanMandi submission and optional deployment

## What is required for the AWS Cloud Club MUET HacktoberFest 3.0 submission?

The public official repository README describes a fork -> team branch -> `submission/<team-name>/` -> Pull Request targeting the `submission` branch workflow. The accessible README does **not** state that a hosted URL is mandatory. Confirm any extra requirement given by judges on event day before submission.

Main event repository: https://github.com/AWSCloudClubMuet/HacktoberFest-3.0

**Recommended:** Submit code and a clear README before spending time on hosting. Do not commit local SQLite (`kisanmandi.db`) or secrets; the app automatically creates fictional seed data at startup.

## Optional public demo via Render

This repo includes `render.yaml` for a Python web service. Push the project folder to a GitHub repository, then in Render choose New > Blueprint and select the repository; confirm the app root directory is this project folder. The blueprint installs `requirements.txt`, starts `uvicorn app:app --host 0.0.0.0 --port $PORT`, configures health checking at `/api/health`, and creates a random secret for signed demo profile cookies. Verify that your Render plan supports the service before deploying.

**Important demo limitations:** this is not a production application. It intentionally permits public demo-profile selection; anyone with access can alter fictional demo listings/alerts. The Render example keeps SQLite under `/tmp`, so new profiles and edits **will not persist across service restarts or redeployments**. Only fake names, phone numbers, and crop prices should be used. Do not enter real customer or farmer information, and do not represent the rates as live mandi prices.

No account has been connected here and no public URL has been created; the supplied files only prepare optional deployment. For a persistent multi-user production platform, add proper account authentication, a managed database, backups, and an authorization/security review.

## Local verification

```
py -m pip install -r requirements.txt
py -m unittest discover -s tests -v
node tests/ui_template_smoke.js
py app.py --port 8001
```

Visit http://127.0.0.1:8001 and manually check all menus and forms in Chrome before judging. The Node test is optional; the app itself needs only Python.
