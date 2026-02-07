#!/usr/bin/env python3
"""
Train a simple daily electricity-usage model using cleaned_data outputs.
Aggregates electricity usage across all buildings per day.

Prereqs:
  pip install pandas scikit-learn

Run:
  python3 energy_prediction.py
  python3 energy_prediction.py --predict data/new_daily_weather.csv --out data/predictions.csv
"""
import argparse
import os
import sys
import pandas as pd

FEATURE_PATH = "cleaned_data/meter_building_weather_merged.csv"
UTILITY_FILTER = "ELECTRICITY"
AGGREGATE_BY_DATE = True
AGGREGATE_TARGET_AS_MEAN = True
EXCLUDE_SIMSCODES = {"79"}  # OSU Electric Substation (buildingnumber 079)

FEATURE_COLS = [
    "temperature_2m",
    "shortwave_radiation",
    "relative_humidity_2m",
    "precipitation",
    "wind_speed_10m",
    "cloud_cover",
]
TARGET_COL = "readingwindowsum"


def load_data():
    if not os.path.exists(FEATURE_PATH):
        raise FileNotFoundError(
            f"Missing {FEATURE_PATH}. Build it with: python3 data_clean.py"
        )

    df = pd.read_csv(FEATURE_PATH)
    if "date" not in df.columns and "readingtime" in df.columns:
        df["date"] = pd.to_datetime(df["readingtime"], errors="coerce").dt.date
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"], errors="coerce")

    if "utility" in df.columns:
        df = df[df["utility"].astype(str).str.upper() == UTILITY_FILTER]

    if "simscode" in df.columns and EXCLUDE_SIMSCODES:
        def normalize_simscode(value: str) -> str:
            digits = "".join(ch for ch in str(value).strip() if ch.isdigit())
            if not digits:
                return ""
            digits = digits.lstrip("0") or "0"
            return digits

        simscode_norm = df["simscode"].map(normalize_simscode)
        df = df[~simscode_norm.isin(EXCLUDE_SIMSCODES)]

    if TARGET_COL in df.columns:
        df[TARGET_COL] = pd.to_numeric(df[TARGET_COL], errors="coerce")

    missing = [c for c in FEATURE_COLS + [TARGET_COL] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = df.dropna(subset=FEATURE_COLS + [TARGET_COL])

    if AGGREGATE_BY_DATE and "date" in df.columns:
        # Aggregate electricity usage per day. If requested, use per-meter mean (sum / count).
        raw_df = df
        agg_map = {c: "mean" for c in FEATURE_COLS}
        agg_map[TARGET_COL] = "sum"
        df = raw_df.groupby("date", as_index=False).agg(agg_map)
        if AGGREGATE_TARGET_AS_MEAN:
            counts = raw_df.groupby("date").size().reset_index(name="_row_count")
            df = df.merge(counts, on="date", how="left")
            df[TARGET_COL] = df[TARGET_COL] / df["_row_count"]
            df = df.drop(columns=["_row_count"])
        df = df.sort_values("date")
    elif "date" in df.columns:
        df = df.sort_values("date")

    X = df[FEATURE_COLS]
    y = df[TARGET_COL]

    # Time-based split: last 7 unique dates as test
    if "date" in df.columns:
        unique_dates = df["date"].dropna().sort_values().unique()
        split_dates = unique_dates[-7:] if len(unique_dates) > 7 else unique_dates[-1:]
        test_mask = df["date"].isin(split_dates)
        X_train = X[~test_mask]
        X_test = X[test_mask]
        y_train = y[~test_mask]
        y_test = y[test_mask]
    else:
        split_idx = max(len(df) - 7, 1)
        X_train = X.iloc[:split_idx]
        X_test = X.iloc[split_idx:]
        y_train = y.iloc[:split_idx]
        y_test = y.iloc[split_idx:]

    return X_train, X_test, y_train, y_test, df


def train_model():
    from sklearn.pipeline import Pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.linear_model import Ridge

    X_train, X_test, y_train, y_test, _ = load_data()

    model = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("reg", Ridge(alpha=1.0)),
        ]
    )
    model.fit(X_train, y_train)
    return model, X_test, y_test


def evaluate_model(model, X_test, y_test):
    from sklearn.metrics import mean_absolute_error, root_mean_squared_error

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    rmse = root_mean_squared_error(y_test, preds)
    mean_target = y_test.mean()
    mae_pct = (mae / mean_target) * 100 if mean_target != 0 else float("nan")

    print("Test MAE:", round(mae, 3))
    print("Test RMSE:", round(rmse, 3))
    print("MAE % of mean target:", round(mae_pct, 3), "%")


def predict_from_weather(model, weather_path, out_path):
    if not os.path.exists(weather_path):
        raise FileNotFoundError(f"Missing {weather_path}")

    weather = pd.read_csv(weather_path)
    missing = [c for c in FEATURE_COLS if c not in weather.columns]
    if missing:
        raise ValueError(f"Missing required weather columns: {missing}")

    X_pred = weather[FEATURE_COLS]
    preds = model.predict(X_pred)

    if "date" in weather.columns:
        output = weather[["date"]].copy()
    else:
        output = pd.DataFrame(index=weather.index)

    output[TARGET_COL] = preds
    output.to_csv(out_path, index=False)
    print(f"Wrote predictions to {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Daily electricity usage model")
    parser.add_argument(
        "--predict",
        dest="predict_path",
        help="CSV with daily weather features for prediction",
    )
    parser.add_argument(
        "--out",
        dest="out_path",
        default="data/predictions.csv",
        help="Output CSV for predictions",
    )
    parser.add_argument(
        "--no-eval",
        action="store_true",
        help="Skip evaluation printout",
    )
    args = parser.parse_args()

    try:
        model, X_test, y_test = train_model()
        if not args.no_eval:
            evaluate_model(model, X_test, y_test)
        if args.predict_path:
            predict_from_weather(model, args.predict_path, args.out_path)
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
