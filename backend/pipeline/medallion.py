from __future__ import annotations

import hashlib
from pathlib import Path

import pandas as pd

from app.categorization import categorize
from pipeline.quality import validate_transactions


def bronze_ingest(source: Path, bronze_dir: Path) -> Path:
    """Copy raw CSV records into an immutable, ingestion-dated Bronze partition."""
    raw = source.read_bytes()
    digest = hashlib.sha256(raw).hexdigest()[:12]
    destination = bronze_dir / f"{source.stem}-{digest}.csv"
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        destination.write_bytes(raw)
    return destination


def silver_transform(bronze_path: Path, silver_dir: Path) -> Path:
    """Normalize schema, deduplicate records, validate values, and add categories."""
    frame = pd.read_csv(bronze_path)
    frame.columns = [
        column.strip().lower().replace(" ", "_") for column in frame.columns
    ]
    if "description" not in frame:
        frame["description"] = frame.get("merchant", "")
    if "merchant" not in frame:
        frame["merchant"] = frame["description"]
    frame["date"] = pd.to_datetime(frame["date"], errors="coerce")
    frame["amount"] = pd.to_numeric(frame["amount"], errors="coerce")
    frame = frame.dropna(subset=["date", "amount"]).copy()
    if "transaction_id" not in frame:
        frame["transaction_id"] = [
            hashlib.sha1(
                f"{row.date}|{row.merchant}|{row.amount}|{index}".encode()
            ).hexdigest()[:16]
            for index, row in frame.iterrows()
        ]
    frame = frame.drop_duplicates("transaction_id")
    if "category" not in frame:
        frame["category"] = [
            categorize(merchant, description)
            for merchant, description in zip(frame["merchant"], frame["description"])
        ]
    report = validate_transactions(frame)
    if not report.passed:
        raise ValueError(f"Silver data quality failed: {report.checks}")
    destination = silver_dir / f"{bronze_path.stem}.parquet"
    destination.parent.mkdir(parents=True, exist_ok=True)
    frame.to_parquet(destination, index=False)
    return destination


def gold_aggregate(silver_path: Path, gold_dir: Path) -> dict[str, Path]:
    """Produce business-ready monthly and category analytical datasets."""
    frame = pd.read_parquet(silver_path)
    frame["month"] = frame["date"].dt.to_period("M").astype(str)
    expenses = frame[frame["amount"] < 0].copy()
    expenses["spending"] = expenses["amount"].abs()
    monthly = expenses.groupby("month", as_index=False)["spending"].sum()
    categories = (
        expenses.groupby(["month", "category"], as_index=False)["spending"].sum()
    )
    gold_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "monthly_spending": gold_dir / "monthly_spending.parquet",
        "category_trends": gold_dir / "category_trends.parquet",
    }
    monthly.to_parquet(outputs["monthly_spending"], index=False)
    categories.to_parquet(outputs["category_trends"], index=False)
    return outputs
