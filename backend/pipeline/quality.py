from dataclasses import dataclass, field

import pandas as pd


@dataclass
class QualityReport:
    passed: bool = True
    checks: dict[str, bool] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)


def validate_transactions(frame: pd.DataFrame) -> QualityReport:
    report = QualityReport()
    required = {"transaction_id", "date", "merchant", "amount"}
    report.checks["required_columns"] = required.issubset(frame.columns)
    report.checks["non_empty"] = not frame.empty
    report.checks["unique_ids"] = (
        "transaction_id" in frame and frame["transaction_id"].is_unique
    )
    report.checks["valid_amounts"] = (
        "amount" in frame and pd.to_numeric(frame["amount"], errors="coerce").notna().all()
    )
    report.checks["valid_dates"] = (
        "date" in frame and pd.to_datetime(frame["date"], errors="coerce").notna().all()
    )
    if "merchant" in frame:
        missing_share = frame["merchant"].isna().mean()
        report.checks["merchant_completeness"] = missing_share < 0.01
        if missing_share:
            report.warnings.append(f"{missing_share:.1%} of merchants are missing.")
    report.passed = all(report.checks.values())
    return report
