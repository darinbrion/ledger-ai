import argparse
from pathlib import Path

from pipeline.medallion import bronze_ingest, gold_aggregate, silver_transform


def run(source: Path, lakehouse: Path) -> None:
    bronze = bronze_ingest(source, lakehouse / "bronze")
    silver = silver_transform(bronze, lakehouse / "silver")
    outputs = gold_aggregate(silver, lakehouse / "gold")
    print(f"Bronze: {bronze}")
    print(f"Silver: {silver}")
    for name, path in outputs.items():
        print(f"Gold ({name}): {path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Ledger AI medallion pipeline.")
    parser.add_argument("source", type=Path)
    parser.add_argument("--lakehouse", type=Path, default=Path("data/lakehouse"))
    args = parser.parse_args()
    run(args.source, args.lakehouse)
