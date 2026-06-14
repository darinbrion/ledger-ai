from datetime import datetime

from airflow.decorators import dag, task


@dag(
    schedule=None,
    start_date=datetime(2026, 1, 1),
    catchup=False,
    tags=["ledger-ai", "medallion"],
)
def ledger_ai_pipeline():
    @task
    def ingest_bronze(source: str) -> str:
        from pathlib import Path
        from pipeline.medallion import bronze_ingest

        return str(bronze_ingest(Path(source), Path("/opt/airflow/data/bronze")))

    @task
    def transform_silver(bronze_path: str) -> str:
        from pathlib import Path
        from pipeline.medallion import silver_transform

        return str(
            silver_transform(Path(bronze_path), Path("/opt/airflow/data/silver"))
        )

    @task
    def aggregate_gold(silver_path: str) -> dict[str, str]:
        from pathlib import Path
        from pipeline.medallion import gold_aggregate

        return {
            name: str(path)
            for name, path in gold_aggregate(
                Path(silver_path), Path("/opt/airflow/data/gold")
            ).items()
        }

    aggregate_gold(transform_silver(ingest_bronze("/opt/airflow/data/incoming.csv")))


ledger_ai_pipeline()
