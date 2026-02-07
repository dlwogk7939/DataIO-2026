#!/usr/bin/env python3
"""
Clean and merge OSU energy datasets from local folders.

Inputs:
  advanced_core/*.csv
  advanced_bonus/*.csv

Outputs (in cleaned_data/):
  weather_daily_selected.csv
  building_metadata_selected.csv
  meter_premerge_selected.csv
  meter_building_weather_merged.csv
"""
import os
import sys
import glob
import pandas as pd
import numpy as np


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIRS = [os.path.join(BASE_DIR, "advanced_core"), os.path.join(BASE_DIR, "advanced_bonus")]
OUT_DIR = os.path.join(BASE_DIR, "cleaned_data")
OUTLIER_PERCENTILE = 0.999

METER_PATTERN = "meter-readings-*.csv"
WEATHER_FILE = "weather_data_hourly_2025.csv"
BUILDING_FILE = "building_metadata.csv"

WEATHER_FEATURE_COLS = [
    "temperature_2m",
    "shortwave_radiation",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
    "cloud_cover",
]

BUILDING_KEEP_COLS = [
    "buildingnumber",
    "buildingname",
    "campusname",
    "city",
    "latitude",
    "longitude",
]

METER_KEEP_COLS = [
    "simscode",
    "utility",
    "readingtime",
    "readingunits",
    "readingunitsdisplay",
    "readingwindowsum",
]


def clean_cols(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df.columns = (
        df.columns
        .str.strip()
        .str.lower()
        .str.replace(" ", "_")
        .str.replace("-", "_")
    )
    return df


def find_file(filename: str) -> str:
    for d in DATA_DIRS:
        path = os.path.join(d, filename)
        if os.path.exists(path):
            return path
    return ""


def find_meter_files() -> list:
    paths = []
    for d in DATA_DIRS:
        paths.extend(glob.glob(os.path.join(d, METER_PATTERN)))
    return sorted(paths)


def load_meter() -> pd.DataFrame:
    meter_files = find_meter_files()
    if not meter_files:
        raise FileNotFoundError(f"No meter files found with pattern {METER_PATTERN}")

    parts = []
    for path in meter_files:
        parts.append(pd.read_csv(path, encoding="latin1"))
    meter = pd.concat(parts, ignore_index=True)
    meter = clean_cols(meter)

    if "readingtime" not in meter.columns:
        meter = meter.rename(columns={"reading_time": "readingtime"})
    if "readingwindowsum" not in meter.columns:
        meter = meter.rename(columns={"reading_window_sum": "readingwindowsum"})
    if "simscode" not in meter.columns:
        meter = meter.rename(columns={"sims_code": "simscode"})

    meter["readingtime"] = pd.to_datetime(meter["readingtime"], errors="coerce")
    meter = meter.dropna(subset=["readingtime"])

    if "readingwindowsum" in meter.columns:
        meter["readingwindowsum"] = pd.to_numeric(meter["readingwindowsum"], errors="coerce")
        meter = meter.dropna(subset=["readingwindowsum"])

    meter["date"] = meter["readingtime"].dt.date
    meter["simscode"] = meter["simscode"].astype(str).str.strip()

    return meter


def drop_outliers(df: pd.DataFrame) -> pd.DataFrame:
    if "readingwindowsum" not in df.columns:
        return df

    if "utility" in df.columns:
        thresholds = df.groupby("utility")["readingwindowsum"].quantile(OUTLIER_PERCENTILE)
        mask = df["utility"].map(thresholds)
        before = len(df)
        df = df[df["readingwindowsum"] <= mask]
        after = len(df)
        print(f"Outlier filter (per utility, p{OUTLIER_PERCENTILE}): removed {before - after} rows")
        return df

    threshold = df["readingwindowsum"].quantile(OUTLIER_PERCENTILE)
    before = len(df)
    df = df[df["readingwindowsum"] <= threshold]
    after = len(df)
    print(f"Outlier filter (global, p{OUTLIER_PERCENTILE}): removed {before - after} rows")
    return df


def load_weather():
    weather_path = find_file(WEATHER_FILE)
    if not weather_path:
        raise FileNotFoundError(f"Missing {WEATHER_FILE} in {DATA_DIRS}")

    weather = pd.read_csv(weather_path, encoding="latin1")
    weather = clean_cols(weather)
    weather["date"] = pd.to_datetime(weather["date"], errors="coerce")
    weather = weather.dropna(subset=["date"])
    weather["date_only"] = weather["date"].dt.date

    num_cols = weather.select_dtypes(include=[np.number]).columns.tolist()
    agg_map = {c: "mean" for c in num_cols}
    if "precipitation" in agg_map:
        agg_map["precipitation"] = "sum"
    if "shortwave_radiation" in agg_map:
        agg_map["shortwave_radiation"] = "sum"

    weather_daily = (
        weather.groupby("date_only", as_index=False)
        .agg(agg_map)
        .rename(columns={"date_only": "date"})
    )

    keep = [c for c in WEATHER_FEATURE_COLS if c in weather_daily.columns]
    weather_daily_keyed = weather_daily[["date"] + keep]
    weather_daily_out = weather_daily[["date"] + keep]
    return weather_daily_keyed, weather_daily_out


def load_buildings() -> pd.DataFrame:
    building_path = find_file(BUILDING_FILE)
    if not building_path:
        raise FileNotFoundError(f"Missing {BUILDING_FILE} in {DATA_DIRS}")

    buildings = pd.read_csv(building_path, encoding="latin1")
    buildings = clean_cols(buildings)
    if "buildingnumber" not in buildings.columns:
        buildings = buildings.rename(columns={"building_number": "buildingnumber"})
    buildings["buildingnumber"] = buildings["buildingnumber"].astype(str).str.strip()
    keep = [c for c in BUILDING_KEEP_COLS if c in buildings.columns]
    return buildings[keep]


def main() -> int:
    try:
        os.makedirs(OUT_DIR, exist_ok=True)

        meter = load_meter()
        meter = drop_outliers(meter)
        weather_daily_keyed, weather_daily_out = load_weather()
        buildings = load_buildings()

        weather_daily_out.to_csv(os.path.join(OUT_DIR, "weather_daily_selected.csv"), index=False)
        buildings.to_csv(os.path.join(OUT_DIR, "building_metadata_selected.csv"), index=False)

        meter_premerge = meter[[c for c in METER_KEEP_COLS if c in meter.columns]].copy()
        meter_premerge.to_csv(os.path.join(OUT_DIR, "meter_premerge_selected.csv"), index=False)

        meter_building = meter_premerge.merge(
            buildings,
            left_on="simscode",
            right_on="buildingnumber",
            how="left",
        )

        if "date" not in meter_building.columns:
            meter_building["date"] = (
                pd.to_datetime(meter_building["readingtime"], errors="coerce").dt.date
            )

        meter_building_weather = meter_building.merge(
            weather_daily_keyed, on="date", how="left"
        )
        meter_building_weather.to_csv(
            os.path.join(OUT_DIR, "meter_building_weather_merged.csv"),
            index=False,
        )

        print("Wrote cleaned datasets to:", OUT_DIR)
        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
