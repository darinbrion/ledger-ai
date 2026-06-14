from __future__ import annotations

import math
from collections import defaultdict
from datetime import date
from statistics import fmean, pstdev

from .schemas import AnalysisResponse, ForecastPoint, Signal, Transaction


def _month_key(value: date) -> str:
    return value.strftime("%Y-%m")


def analyze(transactions: list[Transaction], as_of: date | None = None) -> AnalysisResponse:
    if not transactions:
        return AnalysisResponse(
            transaction_count=0,
            current_month_spending=0,
            monthly_forecast=0,
            forecast_low=0,
            forecast_high=0,
            category_totals={},
            signals=[],
            trajectories=[],
        )

    as_of = as_of or max(tx.date for tx in transactions)
    monthly: dict[str, dict] = defaultdict(
        lambda: {"spending": 0.0, "income": 0.0, "categories": defaultdict(float)}
    )
    for tx in transactions:
        bucket = monthly[_month_key(tx.date)]
        if tx.amount >= 0:
            bucket["income"] += tx.amount
        else:
            spend = abs(tx.amount)
            bucket["spending"] += spend
            bucket["categories"][tx.category] += spend

    current_key = _month_key(as_of)
    current = monthly[current_key]
    prior_keys = sorted(key for key in monthly if key < current_key)[-3:]
    prior = [monthly[key] for key in prior_keys]
    baseline = fmean(item["spending"] for item in prior) if prior else current["spending"]
    days_in_month = 31 if as_of.month in {1, 3, 5, 7, 8, 10, 12} else 30
    if as_of.month == 2:
        days_in_month = 29 if as_of.year % 4 == 0 else 28
    velocity = current["spending"] / max(as_of.day, 1) * days_in_month
    forecast = velocity * 0.62 + baseline * 0.38
    volatility = pstdev([item["spending"] for item in prior]) if len(prior) > 1 else 0
    spread = max(forecast * 0.07, volatility * 0.7, 100)

    category_totals = dict(current["categories"])
    signals = _build_signals(current, prior, forecast, baseline)
    monthly_income = fmean(item["income"] for item in prior) if prior else current["income"]
    monthly_net = monthly_income - forecast
    trajectories = [
        ForecastPoint(
            horizon_days=days,
            expected_balance_change=round(monthly_net * days / 30, 2),
            lower_bound=round(monthly_net * days / 30 - spread * math.sqrt(days / 30), 2),
            upper_bound=round(monthly_net * days / 30 + spread * math.sqrt(days / 30), 2),
        )
        for days in (30, 90, 180)
    ]
    return AnalysisResponse(
        transaction_count=len(transactions),
        current_month_spending=round(current["spending"], 2),
        monthly_forecast=round(forecast, 2),
        forecast_low=round(max(0, forecast - spread), 2),
        forecast_high=round(forecast + spread, 2),
        category_totals={key: round(value, 2) for key, value in category_totals.items()},
        signals=signals,
        trajectories=trajectories,
    )


def _build_signals(current: dict, prior: list[dict], forecast: float, baseline: float) -> list[Signal]:
    signals: list[Signal] = []
    categories = set(current["categories"])
    for item in prior:
        categories.update(item["categories"])
    for category in categories:
        history = [item["categories"].get(category, 0.0) for item in prior]
        category_baseline = fmean(history) if history else 0
        current_value = current["categories"].get(category, 0.0)
        if category_baseline > 20:
            change = (current_value - category_baseline) / category_baseline
            if change > 0.2:
                signals.append(
                    Signal(
                        signal_type="spending_shift",
                        category=category,
                        title=f"{category} is {change:.0%} above baseline.",
                        explanation="Recent category spending is materially above its three-month average.",
                        confidence=min(0.95, 0.65 + abs(change) * 0.2),
                        evidence={
                            "current": round(current_value, 2),
                            "baseline": round(category_baseline, 2),
                            "change_pct": round(change * 100, 1),
                        },
                    )
                )
    if baseline:
        change = (forecast - baseline) / baseline
        signals.append(
            Signal(
                signal_type="forecast_alert",
                title=f"Month-end spending is tracking {abs(change):.0%} {'above' if change >= 0 else 'below'} average.",
                explanation="The estimate blends current spending velocity with recent monthly history.",
                confidence=0.8 if len(prior) >= 3 else 0.62,
                evidence={
                    "forecast": round(forecast, 2),
                    "baseline": round(baseline, 2),
                    "change_pct": round(change * 100, 1),
                },
            )
        )
    return sorted(signals, key=lambda signal: signal.confidence, reverse=True)[:6]
