"""Spark/Delta implementation of the Ledger AI Bronze -> Silver -> Gold flow."""

import argparse

from pyspark.sql import SparkSession, functions as F
from pyspark.sql.types import DoubleType


def run(source: str, lakehouse: str) -> None:
    spark = (
        SparkSession.builder.appName("ledger-ai-medallion")
        .config("spark.sql.extensions", "io.delta.sql.DeltaSparkSessionExtension")
        .config(
            "spark.sql.catalog.spark_catalog",
            "org.apache.spark.sql.delta.catalog.DeltaCatalog",
        )
        .getOrCreate()
    )
    bronze_path = f"{lakehouse}/bronze/transactions"
    silver_path = f"{lakehouse}/silver/transactions"
    gold_path = f"{lakehouse}/gold/monthly_spending"

    raw = spark.read.option("header", True).csv(source)
    raw.withColumn("_ingested_at", F.current_timestamp()).write.format("delta").mode(
        "append"
    ).save(bronze_path)

    silver = (
        raw.withColumn("date", F.to_date("date"))
        .withColumn("amount", F.regexp_replace("amount", "[$,]", "").cast(DoubleType()))
        .withColumn("merchant", F.trim(F.coalesce("merchant", "description")))
        .dropna(subset=["date", "amount", "merchant"])
        .dropDuplicates(["date", "merchant", "amount"])
    )
    silver.write.format("delta").mode("overwrite").option(
        "overwriteSchema", True
    ).save(silver_path)

    monthly = (
        silver.filter(F.col("amount") < 0)
        .withColumn("month", F.date_format("date", "yyyy-MM"))
        .groupBy("month")
        .agg(F.sum(F.abs("amount")).alias("spending"))
    )
    monthly.write.format("delta").mode("overwrite").save(gold_path)
    spark.stop()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("--lakehouse", default="data/lakehouse")
    args = parser.parse_args()
    run(args.source, args.lakehouse)
