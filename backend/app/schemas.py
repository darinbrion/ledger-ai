from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class Transaction(BaseModel):
    transaction_id: str
    date: date
    merchant: str
    description: str = ""
    amount: float
    category: str = "Other"


class ForecastPoint(BaseModel):
    horizon_days: int
    expected_balance_change: float
    lower_bound: float
    upper_bound: float


class Signal(BaseModel):
    signal_type: Literal[
        "spending_shift",
        "behavioral_drift",
        "recurring_cost",
        "forecast_alert",
    ]
    category: str | None = None
    title: str
    explanation: str
    confidence: float = Field(ge=0, le=1)
    evidence: dict[str, float | str]


class AnalysisResponse(BaseModel):
    transaction_count: int
    current_month_spending: float
    monthly_forecast: float
    forecast_low: float
    forecast_high: float
    category_totals: dict[str, float]
    signals: list[Signal]
    trajectories: list[ForecastPoint]


class AnalystRequest(BaseModel):
    question: str = Field(min_length=2, max_length=500)
    transactions: list[Transaction]


class AnalystResponse(BaseModel):
    answer: str
    evidence: list[str]
