#!/usr/bin/env python3
"""
Build a small, daily dataset for January 2025 by merging:
- Electricity meter daily totals (readingwindowsum)
- Daily weather aggregates from hourly weather

Outputs: data/daily_electricity_jan_2025.csv
"""
import csv
import os
from collections import Counter
from datetime import datetime

METER_PATH = "advanced_core/meter-readings-jan-2025.csv"
WEATHER_PATH = "advanced_core/weather_data_hourly_2025.csv"
OUTPUT_PATH = "data/daily_electricity_jan_2025.csv"
MONTH_PREFIX = "2025-01"


def pick_electricity_meter_id(path: str) -> str:
    counts = Counter()
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("utility") != "ELECTRICITY":
                continue
            meterid = row.get("meterid")
            if meterid:
                counts[meterid] += 1
    if not counts:
        raise RuntimeError("No ELECTRICITY rows found in meter data.")
    # pick the meter with the most rows (likely full month)
    return counts.most_common(1)[0][0]


def load_daily_electricity(path: str, meterid: str):
    daily = {}
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("utility") != "ELECTRICITY":
                continue
            if row.get("meterid") != meterid:
                continue
            window_start = row.get("readingwindowstart") or row.get("readingtime")
            if not window_start:
                continue
            date_str = window_start[:10]
            if not date_str.startswith(MONTH_PREFIX):
                continue
            try:
                val = float(row.get("readingwindowsum") or "0")
            except ValueError:
                continue
            # If duplicates exist for a date, sum them
            daily[date_str] = daily.get(date_str, 0.0) + val
    return daily


def load_daily_weather(path: str):
    # aggregates per date
    weather = {}
    with open(path, newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            dt = row.get("date")
            if not dt:
                continue
            date_str = dt[:10]
            if not date_str.startswith(MONTH_PREFIX):
                continue

            w = weather.get(date_str)
            if w is None:
                w = {
                    "count": 0,
                    "temp_sum": 0.0,
                    "temp_min": None,
                    "temp_max": None,
                    "shortwave_sum": 0.0,
                    "humidity_sum": 0.0,
                    "precip_sum": 0.0,
                    "wind_sum": 0.0,
                    "cloud_sum": 0.0,
                }
                weather[date_str] = w

            def fval(key):
                try:
                    return float(row.get(key) or 0.0)
                except ValueError:
                    return 0.0

            temp = fval("temperature_2m")
            w["count"] += 1
            w["temp_sum"] += temp
            w["shortwave_sum"] += fval("shortwave_radiation")
            w["humidity_sum"] += fval("relative_humidity_2m")
            w["precip_sum"] += fval("precipitation")
            w["wind_sum"] += fval("wind_speed_10m")
            w["cloud_sum"] += fval("cloud_cover")

            if w["temp_min"] is None or temp < w["temp_min"]:
                w["temp_min"] = temp
            if w["temp_max"] is None or temp > w["temp_max"]:
                w["temp_max"] = temp

    # finalize means
    daily = {}
    for date_str, w in weather.items():
        if w["count"] == 0:
            continue
        daily[date_str] = {
            "temperature_2m_min": w["temp_min"],
            "temperature_2m_mean": w["temp_sum"] / w["count"],
            "temperature_2m_max": w["temp_max"],
            "shortwave_radiation_sum": w["shortwave_sum"],
            "relative_humidity_2m_mean": w["humidity_sum"] / w["count"],
            "precipitation_sum": w["precip_sum"],
            "wind_speed_10m_mean": w["wind_sum"] / w["count"],
            "cloud_cover_mean": w["cloud_sum"] / w["count"],
        }
    return daily


def main():
    if not os.path.exists(METER_PATH):
        raise SystemExit(f"Missing {METER_PATH}")
    if not os.path.exists(WEATHER_PATH):
        raise SystemExit(f"Missing {WEATHER_PATH}")

    meterid = pick_electricity_meter_id(METER_PATH)
    daily_elec = load_daily_electricity(METER_PATH, meterid)
    daily_weather = load_daily_weather(WEATHER_PATH)

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

    fieldnames = [
        "date",
        "weekday",
        "meterid",
        "temperature_2m_min",
        "temperature_2m_mean",
        "temperature_2m_max",
        "shortwave_radiation_sum",
        "relative_humidity_2m_mean",
        "precipitation_sum",
        "wind_speed_10m_mean",
        "cloud_cover_mean",
        "readingwindowsum",
    ]

    rows = []
    for date_str in sorted(daily_elec.keys()):
        w = daily_weather.get(date_str)
        if not w:
            continue
        weekday = datetime.strptime(date_str, "%Y-%m-%d").weekday()
        row = {
            "date": date_str,
            "weekday": weekday,
            "meterid": meterid,
            **w,
            "readingwindowsum": daily_elec[date_str],
        }
        rows.append(row)

    with open(OUTPUT_PATH, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {OUTPUT_PATH} (meterid={meterid})")


if __name__ == "__main__":
    main()
