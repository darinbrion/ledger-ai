from datetime import date

from app.analytics import analyze
from app.categorization import categorize
from app.schemas import Transaction


def test_categorization_rules():
    assert categorize("Blue Bottle Coffee") == "Social Life"
    assert categorize("United Airlines") == "Travel"
    assert categorize("Unknown Vendor") == "Other"


def test_analysis_builds_forecast_and_signals():
    transactions = [
        Transaction(
            transaction_id="1",
            date=date(2026, 4, 2),
            merchant="Rent",
            amount=-1000,
            category="Housing",
        ),
        Transaction(
            transaction_id="2",
            date=date(2026, 5, 2),
            merchant="Rent",
            amount=-1000,
            category="Housing",
        ),
        Transaction(
            transaction_id="3",
            date=date(2026, 6, 2),
            merchant="Rent",
            amount=-1000,
            category="Housing",
        ),
        Transaction(
            transaction_id="4",
            date=date(2026, 6, 8),
            merchant="Uber",
            amount=-250,
            category="Convenience",
        ),
        Transaction(
            transaction_id="5",
            date=date(2026, 6, 1),
            merchant="Payroll",
            amount=3000,
            category="Income",
        ),
    ]
    result = analyze(transactions, as_of=date(2026, 6, 14))
    assert result.monthly_forecast > 0
    assert result.forecast_high > result.forecast_low
    assert len(result.trajectories) == 3
