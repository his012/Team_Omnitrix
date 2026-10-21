# KisanMandi 🌱
### Helping farmers make better selling decisions

Farmers often have to decide where and when to sell their crops without an easy way to compare mandi prices. We built **KisanMandi** as a simple web application where farmers in Sindh can explore sample market rates, compare nearby mandis and connect with buyers through produce listings.

This project was developed by **Team Omnitrix** as a hackathon submission. Our focus was to make the experience practical, easy to navigate and comfortable to use on both phones and laptops.

## What you can do

- **Explore crop prices:** Search crops, filter results and see how prices changed compared with the previous day.
- **Compare mandis:** Check prices across the sample regional markets and view a 14-day price chart.
- **Find a better selling option:** Enter your produce quantity and estimated transport costs to compare possible net returns.
- **Browse the marketplace:** Find produce listings and filter them by crop, district and grade.
- **Manage your produce:** Farmers can create and update listings, including marking items as sold.
- **Set price alerts:** Keep track of target prices for selected crops.
- **Save favourite crops:** Build a personal watchlist in the browser.
- **Use it your way:** Switch between light and dark themes; the interface adapts to smaller screens.
- **Export data:** Download a CSV of the displayed market prices.

## Technology we used

| Part | Technology |
| --- | --- |
| Frontend | HTML, CSS and JavaScript |
| Backend | Python and FastAPI |
| Database | SQLite |
| Testing | Python `unittest` and Node.js smoke tests |

## Run it locally

You'll need Python installed on your computer.

1. Open the `kisanmandi` project folder in VS Code.
2. Open a terminal in that folder.
3. Install the dependencies and start the app:

```powershell
py -m pip install -r requirements.txt
py app.py --port 8001
```

4. Visit **http://127.0.0.1:8001** in your browser.
5. Select **Try as Farmer** or **Try as Buyer** to explore the demo.

If port 8001 is already being used, run `py app.py --port 8002` and open `http://127.0.0.1:8002` instead.

## Run the tests

From the project folder:

```powershell
py -m unittest discover -s tests -p "test*.py" -v
node tests/ui_template_smoke.js
```

The Node.js command is optional and only needed for the frontend smoke test. The QA-ready release was checked with backend regression tests and responsive browser tests; you should still test the complete user flow on your own machine before presenting it.

## A quick demo idea

Start with the dashboard and show the crop prices. Compare a crop across different markets, then enter a transport cost in the Market Opportunity Finder to show why the highest price is not always the best deal. Finally, switch to the marketplace, create a farmer listing and demonstrate a price alert.

## Important note about the data

**KisanMandi is a working hackathon prototype, not a live mandi-price service.** Crop prices, accounts, contacts and initial listings are fictional demo records. The application serves this data through its own API and stores local changes in SQLite. Market comparisons are illustrative calculations, not guaranteed earnings or forecasts. A public deployment with reliable shared storage would need a production database and a verified live data source.

## Project structure

```text
kisanmandi/
├── app.py                 # FastAPI server and data handling
├── requirements.txt       # Python dependencies
├── static/                # Frontend and bundled images
├── tests/                 # Automated checks
├── run_windows.bat        # Windows launcher
└── README.md
```

---

**Built by Team Omnitrix** — with the goal of making everyday market decisions a little easier for farmers.
