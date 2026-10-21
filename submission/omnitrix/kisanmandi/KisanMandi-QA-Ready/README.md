# KisanMandi — QA-Ready Hackathon Edition (v4)

A responsive web app for fictional Sindh mandi price discovery, produce listings and farmer planning. This upgrade preserves the Python/FastAPI + SQLite data layer and replaces the previous premium UI with a better-labeled, two-row responsive **top navbar** and a persistent **light/dark** theme, now with expanded regression testing.

## Quick start — Windows 11 + VS Code

1. Unzip and open the **inner `KisanMandi-Ultimate` folder** in VS Code; `app.py` and `requirements.txt` must be visible at the top level.
2. In VS Code Terminal (PowerShell):

   ```powershell
   py -m pip install -r requirements.txt
   py app.py --port 8001
   ```

3. Open **http://127.0.0.1:8001** in Chrome, or double-click `run_windows.bat`.
4. Use **Try as Farmer** or **Try as Buyer**, or create a new local demo profile.

**Already running another KisanMandi version on 8001?** Stop only its terminal using `Ctrl+C`, or use `py app.py --port 8002` and visit `http://127.0.0.1:8002`.

**Upgrading from an older copy with your own listings?** Back up the old `kisanmandi.db` before replacing files, and copy your old database into the new folder if you want to keep your profiles, alerts and listings. Never overwrite a database you want to retain without a backup.

## New in v3

- **Navbar fixed**: all six Farmer tabs remain labeled on desktop, tablet and mobile; no icons-only breakpoint; no duplicate bottom navbar or unused hamburger menu.
- **Dark mode**: the moon/sun button in the header changes the complete app (forms, cards, modals, listings, alerts), with preference stored in this browser.
- **Improved labels**: visible field names for crop, district, grade, sorting, market and filters, plus linked labels on create/edit forms.
- **Crop watchlist**: tap the ☆ button on a crop photo and choose **My Watchlist** to view saved crops; local to this browser.
- **Market Opportunity Finder**: compare the estimated net harvest revenue for the same crop and quantity at three mandis after entering your own freight costs per 40kg for each route. Demo calculation, not a forecast.
- **Download CSV**: on Prices, export today's eight crop prices for the selected market, including yesterday and percentage change.
- **Better crop sorting**: sort by crop name, highest/lowest rate, or largest day-on-day increase.
- **Marketplace filters**: fully labeled crop, district, grade and sort controls plus a one-click reset.
- **Existing features retained**: role-based navigation, 14-day historical trends, refreshed API collections, listing CRUD and sold status, price alerts, profit simulator, photo assets and responsive hero.

## What is demo vs real?

Every account, contact, listing and price is **fictional seed data**. The interface gets its records from a **real local HTTP API** persisted in **SQLite**, not from a live Sindh mandi service. The Opportunity Finder is an illustrative deterministic calculation based on the fictional market rates and freight costs **you enter**; no AI model or live market/weather feed is implied.

## Architecture

- `app.py` — FastAPI REST endpoints for six collections (`/api/users`, `/api/crops`, `/api/markets`, `/api/prices`, `/api/listings`, `/api/alerts`) and signed demo sessions.
- `kisanmandi.db` — local SQLite persistence; schema and seeding handled in `app.py`.
- `static/index.html` — accessible header, main container and dialogs.
- `static/app.js` — state, fetch, UI rendering, favorites, opportunity calculator, CSV export and handlers.
- `static/styles.css` + `static/premium.css` + `static/ultimate.css` — base components, photo layout, dark mode and responsive refinements.
- `static/assets/` — bundled photos (local/offline), not evidence of real produce stock.
- `tests/test_api.py` and `tests/ui_template_smoke.js` — backend integration and frontend template tests.
- `progress.txt`, `tests.json` — task tracking and honest test status.

## Run tests

```powershell
py -m unittest discover -s tests -p test_api.py -v
node tests/ui_template_smoke.js
```

Node.js is needed only for the optional frontend smoke test; Python is sufficient to run the app.

## Judge demo (roughly 2 minutes)

1. Show the dark-mode button and six labeled navbar tabs, then save a crop ☆ to the local watchlist.
2. Open Price Discovery, search/filter/sort, inspect the 14-day chart and export a price CSV.
3. Use the Market Opportunity Finder with different manually entered freight costs to explain the best **net** market, not just the highest gross price.
4. Visit the marketplace, filter produce, open details. As Farmer, create a listing, mark one sold and create a price alert.
5. State clearly that current rates and phone numbers are fabricated for the hackathon demo; API, role enforcement and SQLite persistence are functional locally.

## Verification limitations

25 Python integration/regression tests and a Node client runtime/template smoke pass. Chromium render-only checks using local mock fixture data were observed at 1440px, 989px and 390px with all six navbar labels present, light/dark modes rendering, no page-width overflow or JS exceptions. Actual browser navigation against the local API was blocked by builder browser restrictions (`ERR_BLOCKED_BY_ADMINISTRATOR`) and remains a manual Windows Chrome test.

## v4 QA release notes (21 October 2026)

- Fixed a real Opportunity Finder click bug: changing freight/quantity and immediately clicking **View best market** could lose the click because a blur handler replaced the clicked button.
- New daily fictional-price rollover: if an existing local SQLite file is opened on a later day, the rolling 14-day window refreshes while the user's profiles, listings and alerts remain.
- Added 5 regression cases (for a total of **25 passing**): forged session cookie rejection, HttpOnly/SameSite cookie, next-day price rollover, database persistence after reopening, and bundled crop image HTTP responses.
- Browser mock-data click-through passed in Chromium at 1440, 989 and 390 widths, both light and dark, with no captured JavaScript page errors or horizontal overflow; direct local-API browser navigation was blocked by environment policy and remains a Windows Chrome manual test.
- `render.yaml` and `DEPLOYMENT.md` are **optional** for hosting a disposable fake-data demo. No public deployment has been performed. Render's free instance loses SQLite edits on restart or idle sleep.
- `kisanmandi.db` is intentionally **not shipped** in this ZIP; starting the app automatically creates the current fictional demo dataset, and `.gitignore` keeps local databases out of the GitHub submission.

For official submission, follow the event repository's **fork → team branch → submission/team-name → Pull Request into submission** workflow; a hosted public URL was not specified as mandatory in its accessible README.
