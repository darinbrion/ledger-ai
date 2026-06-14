from datetime import date

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .analytics import analyze
from .categorization import categorize, category_vocabulary
from .schemas import AnalystRequest, AnalystResponse, AnalysisResponse, Transaction


app = FastAPI(
    title="Ledger AI API",
    description="Financial intelligence, forecasting, and behavioral signal service.",
    version="0.1.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000", "http://127.0.0.1:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "ledger-ai"}


@app.get("/categories")
def categories() -> dict[str, list[str]]:
    return {"categories": list(category_vocabulary())}


@app.post("/categorize", response_model=list[Transaction])
def categorize_transactions(transactions: list[Transaction]) -> list[Transaction]:
    return [
        tx.model_copy(
            update={
                "category": tx.category
                if tx.category and tx.category != "Other"
                else categorize(tx.merchant, tx.description)
            }
        )
        for tx in transactions
    ]


@app.post("/analyze", response_model=AnalysisResponse)
def analyze_transactions(
    transactions: list[Transaction],
    as_of: date | None = None,
) -> AnalysisResponse:
    if len(transactions) > 100_000:
        raise HTTPException(status_code=413, detail="MVP supports up to 100,000 transactions.")
    return analyze(transactions, as_of=as_of)


@app.post("/ask", response_model=AnalystResponse)
def ask_analyst(request: AnalystRequest) -> AnalystResponse:
    result = analyze(request.transactions)
    question = request.question.lower()
    top_category = max(result.category_totals, key=result.category_totals.get, default="spending")
    if any(word in question for word in ("why", "increase", "more", "change")):
        answer = (
            f"Your current month is forecast at ${result.monthly_forecast:,.0f}. "
            f"{top_category} is the largest observed category at "
            f"${result.category_totals.get(top_category, 0):,.0f}."
        )
    elif any(word in question for word in ("afford", "trip", "vacation", "buy")):
        net = result.trajectories[0].expected_balance_change if result.trajectories else 0
        answer = (
            f"Your current 30-day trajectory implies a ${net:,.0f} balance change. "
            "Treat that as a directional estimate and preserve a buffer for transactions "
            "not represented in the uploaded data."
        )
    else:
        answer = (
            f"Ledger AI analyzed {result.transaction_count} transactions. "
            f"Expected month-end spending is ${result.monthly_forecast:,.0f}, with an "
            f"80% range of ${result.forecast_low:,.0f} to ${result.forecast_high:,.0f}."
        )
    evidence = [signal.title for signal in result.signals[:3]]
    return AnalystResponse(answer=answer, evidence=evidence)
