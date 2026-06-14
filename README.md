# Ledger AI

Ledger AI is a financial intelligence platform that transforms transaction history into forecasts, behavioral signals, and plain-language explanations.

The project was built to demonstrate an end-to-end learning workflow across data engineering, machine learning, and product development. The hosted demo uses entirely synthetic transactions.

## Demo

The demo opens with six months of *fake financial activity*, allowing every workflow to be demonstrated *without uploading personal information.*

**Live demo:** https://ledger-ai-rosy.vercel.app

Key flows:

- Review an insight-first financial overview
- Explore categorized spending and merchant behavior
- Inspect month-end and 30/90/180-day forecasts
- Verify behavioral signals against supporting evidence
- Follow inferred life events on a financial timeline
- Ask dataset-grounded financial questions
- Import a sample CSV and edit generated categories

## Skills

### 1. Data Engineering 

**Medallion architecture**

- Designed explicit Bronze, Silver, and Gold data contracts.
- Bronze preserves immutable source records.
- Silver normalizes schemas, removes duplicates, validates fields, and standardizes merchants.
- Gold produces business-ready monthly spending and category trend datasets.

**ETL and data quality**

- Built reusable CSV ingestion and transformation modules.
- Added checks for required columns, unique IDs, valid dates, numeric amounts, and merchant completeness.
- Separated raw ingestion from analytical transformations to make failures traceable.
- Designed idempotent file naming with content hashes for repeatable ingestion.

**Spark, Delta Lake, and Airflow**

- Implemented a Spark/Delta reference job mirroring the local pandas pipeline.
- Created an Airflow DAG for Bronze ingestion, Silver transformation, and Gold aggregation.
- Preserved a lightweight pandas execution path so the MVP remains runnable on a laptop.
- Documented the tradeoff between production-oriented infrastructure and personal-scale data.

**Backend and Data Services**

- Built typed FastAPI endpoints for categorization, analysis, forecasting, and financial questions.
- Defined Pydantic request and response contracts.
- Added API limits and CORS boundaries for the MVP.

### 2. Machine Learning 

**Feature Engineering**

- Derived spending velocity, category shares, recurring obligations, historical baselines, and monthly volatility.
- Separated fixed expenses from variable spending to prevent rent and subscriptions from being incorrectly extrapolated.
- Created category-level forecast features and behavioral-change metrics.

**Forecasting**

- Built an interpretable blended baseline using current-month velocity and a three-month historical average.
- Generated uncertainty intervals from historical volatility.
- Produced monthly spending, category, savings, and 30/90/180-day cash trajectory forecasts.
- Structured the forecasting interface for later comparison with Exponential Smoothing, Prophet, DeepAR, and Temporal Fusion Transformers.

**Behavioral and anomaly detection**

- Measured category changes against rolling historical baselines.
- Detected category-share drift and unusual spending acceleration.
- Generated evidence-backed signals instead of unsupported recommendations.
- Inferred possible financial timeline events from clustered category changes.

**Evaluation and responsible AI**

- Kept the initial model transparent enough to diagnose errors.
- Corrected date-boundary and recurring-expense extrapolation issues discovered during browser testing.
- Displayed forecast ranges and evidence rather than presenting estimates as certainty.
- Grounded Ask AI responses in computed transaction metrics instead of sending data to a general chatbot.

### 3. Product Skills

**Product discovery and scope**

- Translated a broad PRD into a focused, testable MVP.
- Prioritized financial intelligence over traditional budgeting features.
- Defined synthetic recruiter and private personal-use workflows.

**Information architecture and UX**

- Designed six focused views: Home, Spending, Forecasts, Signals, Timeline, and Ask AI.
- Presented conclusions before charts to reduce cognitive load.
- Used progressive detail so every signal includes supporting evidence.
- Built responsive desktop, tablet, and mobile layouts.

**Trust and privacy**

- Processes CSVs locally in the browser.
- Uses session-only storage by default.
- Requires explicit opt-in before persisting transactions in browser storage.
- Includes one-click deletion of saved transactions and category preferences.
- Adds restrictive production security headers for the hosted static demo.

**Testing and iteration**

- Tested navigation, mobile behavior, forecasts, transaction tables, and Ask AI in a real browser.
- Used observed product errors to improve date handling and forecasting logic.
- Kept the demo dependency-free so recruiters can evaluate it immediately.

## Full List of Current Features

- Local CSV ingestion
- Intelligent merchant categorization
- Editable categories remembered by merchant
- Monthly and category spending analysis
- Behavioral drift and spending-change signals
- Month-end forecast with an 80% confidence range
- 30/90/180-day balance trajectory
- Inferred financial timeline
- Dataset-grounded Ask AI
- FastAPI analytics service
- Bronze/Silver/Gold pipeline
- Data-quality monitoring
- Airflow and Spark/Delta reference implementations

## Run the Frontend

No frontend dependencies are required:

```bash
cd ledger-ai
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Secure Personal Use

For real financial data, run Ledger AI locally rather than uploading the CSV to a hosted deployment:

```bash
cd ledger-ai
python3 -m http.server 8000 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8000`.

Recommended workflow:

1. Export only transaction history, not full bank statements.
2. Remove account numbers, balances, addresses, and unnecessary memo fields.
3. Keep “Remember this CSV” unchecked so data remains session-only.
4. Close the tab when finished.
5. Use “Clear local data” if persistence was previously enabled.
6. Never commit personal CSV, Parquet, database, `.env`, or lakehouse output files.

The static frontend does not call the FastAPI service, OpenAI, Vercel functions, or another external API. Imported transaction values remain in the current browser unless persistence is explicitly enabled.

## CSV Format

At minimum, provide date, merchant or description, and amount:

```csv
date,merchant,description,amount,category
2026-06-01,Payroll,Direct deposit,3150,Income
2026-06-02,Blue Bottle Coffee,Coffee,-8.50,
```

`category` is optional. Debit and credit columns are accepted in place of `amount`.

## Run the API

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

API documentation is available at `http://localhost:8001/docs`.

## Run the Medallion Pipeline

```bash
cd backend
PYTHONPATH=. python -m pipeline.run_pipeline ../your-transactions.csv
```

Outputs:

- `data/lakehouse/bronze`: immutable raw CSV
- `data/lakehouse/silver`: cleaned and deduplicated Parquet
- `data/lakehouse/gold`: monthly and category analytical tables

## Architecture

```text
CSV / future Plaid
       |
       v
Bronze: immutable raw transactions
       |
       v
Silver: normalization, deduplication, validation, categorization
       |
       v
Gold: monthly spending, category trends, forecast features
       |
       +--> Forecasting and drift detection
       +--> FastAPI intelligence endpoints
       +--> Ledger AI web experience
```

## Security Boundary

The hosted version is a static recruiter demo and contains synthetic data. Browser CSV processing is local, but a shared or managed computer is still not an appropriate place for personal financial information.

A production Plaid version would additionally require encrypted server-side storage, secrets management, token isolation, user authentication, audit logging, retention controls, privacy disclosures, threat modeling, and an independent security review.
