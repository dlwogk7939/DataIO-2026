#!/usr/bin/env python3
"""
Train a simple daily electricity-usage model using cleaned_data outputs.
Defaults to a single building (Thompson Library) and uses these features:
  - precipitation
  - temperature_2m
  - wind_speed_10m

Prereqs:
  pip install pandas scikit-learn

Run:
  python3 energy_prediction.py
  python3 energy_prediction.py --building-name "Thompson Library"
  python3 energy_prediction.py --train-five-buildings
  python3 energy_prediction.py --all-buildings
  python3 energy_prediction.py --predict data/new_daily_weather.csv --out data/predictions.csv
"""
import argparse
import os
import sys
import pandas as pd
from typing import Optional

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FEATURE_PATH = os.path.join(BASE_DIR, "cleaned_data", "meter_building_weather_merged.csv")
BUILDING_METADATA_PATH = os.path.join(BASE_DIR, "cleaned_data", "building_metadata_selected.csv")
DEFAULT_BUILDING_NAME = "Thompson Library"
UTILITY_FILTER = "ELECTRICITY"
AGGREGATE_BY_DATE = True
AGGREGATE_TARGET_AS_MEAN = False
TEST_WINDOW_DAYS = 7
# Use core semester months for evaluation split to avoid break periods.
SEMESTER_TEST_MONTHS = {2, 3, 4, 9, 10}

FEATURE_COLS = [
    "precipitation",
    "temperature_2m",
    "wind_speed_10m",
]
BUILDING_COL = "buildingnumber"
TARGET_COL = "readingwindowsum"
TARGET_BUILDINGS = [
    ("Thompson Library", "50"),
    ("RPAC", "246"),
    ("Knowlton Hall", "17"),
    ("Hitchcock Hall", "274"),
    ("Ohio Union", "161"),
]
BUILDING_NAME_ALIASES = {
    "rpac": "Recreation and Physical Activity Center",
    "dreese lab": "Dreese Laboratories",
}


def normalize_simscode(value) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    if not text or text.lower() == "nan":
        return ""
    try:
        as_float = float(text)
        if as_float.is_integer():
            return str(int(as_float))
    except Exception:
        pass
    digits = "".join(ch for ch in text if ch.isdigit())
    if not digits:
        return ""
    try:
        return str(int(digits))
    except Exception:
        return digits


def canonicalize_building_name(building_name: str) -> str:
    normalized = building_name.strip()
    if not normalized:
        return normalized
    return BUILDING_NAME_ALIASES.get(normalized.lower(), normalized)


def resolve_building_numbers(building_name: str) -> list:
    if not building_name:
        return []
    if not os.path.exists(BUILDING_METADATA_PATH):
        raise FileNotFoundError(
            f"Missing {BUILDING_METADATA_PATH}. Build it with: python3 data_clean.py"
        )

    buildings = pd.read_csv(BUILDING_METADATA_PATH, usecols=["buildingnumber", "buildingname"])
    buildings["buildingname"] = buildings["buildingname"].astype(str)
    buildings["buildingnumber"] = buildings["buildingnumber"].astype(str).str.strip()
    buildings["buildingnumber_norm"] = buildings["buildingnumber"].map(normalize_simscode)

    canonical_name = canonicalize_building_name(building_name)
    name_lower = canonical_name.lower()
    matches = buildings[buildings["buildingname"].str.lower().str.contains(name_lower, na=False)]
    if matches.empty:
        raise ValueError(f"No building matches '{building_name}' in metadata.")

    if len(matches) > 1:
        starts = matches[matches["buildingname"].str.lower().str.startswith(name_lower)]
        if not starts.empty:
            matches = starts

    nums = sorted({n for n in matches["buildingnumber_norm"].tolist() if n})
    if not nums:
        raise ValueError(f"No building numbers found for '{building_name}'.")
    if len(nums) > 1:
        print(
            f"Multiple buildings match '{building_name}'. Using: {', '.join(nums)}",
            file=sys.stderr,
        )
    return nums


def normalize_building_numbers(building_numbers) -> list:
    return [n for n in (normalize_simscode(v) for v in building_numbers) if n]


def get_feature_cols(by_building: bool) -> list:
    cols = list(FEATURE_COLS)
    if by_building:
        cols.append(BUILDING_COL)
    return cols


def select_test_dates(unique_dates: pd.DatetimeIndex) -> pd.DatetimeIndex:
    semester_dates = unique_dates[unique_dates.month.isin(sorted(SEMESTER_TEST_MONTHS))]
    if len(semester_dates) >= TEST_WINDOW_DAYS:
        return semester_dates[-TEST_WINDOW_DAYS:]
    if len(unique_dates) >= TEST_WINDOW_DAYS:
        return unique_dates[-TEST_WINDOW_DAYS:]
    return unique_dates[-1:]


def load_data(
    by_building: bool = False,
    building_name: Optional[str] = DEFAULT_BUILDING_NAME,
    building_numbers: Optional[list] = None,
):
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

    if "simscode" in df.columns:
        simscode_norm = df["simscode"].map(normalize_simscode)
        if building_numbers:
            requested_numbers = normalize_building_numbers(building_numbers)
        elif building_name:
            requested_numbers = resolve_building_numbers(building_name)
        else:
            requested_numbers = []
        if requested_numbers:
            building_mask = simscode_norm.isin(requested_numbers)
            df = df[building_mask].copy()
    elif building_name or building_numbers:
        raise ValueError("Missing simscode column required for building filtering.")

    if TARGET_COL in df.columns:
        df[TARGET_COL] = pd.to_numeric(df[TARGET_COL], errors="coerce")

    if by_building and BUILDING_COL in df.columns:
        df[BUILDING_COL] = df[BUILDING_COL].astype(str).str.strip()

    feature_cols = get_feature_cols(by_building)
    missing = [c for c in feature_cols + [TARGET_COL] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")

    df = df.dropna(subset=feature_cols + [TARGET_COL])

    if AGGREGATE_BY_DATE and "date" in df.columns:
        # Aggregate electricity usage per day. If requested, use per-meter mean (sum / count).
        raw_df = df
        group_keys = ["date"]
        if by_building:
            group_keys.append(BUILDING_COL)
        agg_map = {c: "mean" for c in FEATURE_COLS}
        agg_map[TARGET_COL] = "sum"
        df = raw_df.groupby(group_keys, as_index=False).agg(agg_map)
        if AGGREGATE_TARGET_AS_MEAN:
            counts = raw_df.groupby(group_keys).size().reset_index(name="_row_count")
            df = df.merge(counts, on=group_keys, how="left")
            df[TARGET_COL] = df[TARGET_COL] / df["_row_count"]
            df = df.drop(columns=["_row_count"])
        sort_cols = ["date"]
        if by_building:
            sort_cols.append(BUILDING_COL)
        df = df.sort_values(sort_cols)
    elif "date" in df.columns:
        sort_cols = ["date"]
        if by_building and BUILDING_COL in df.columns:
            sort_cols.append(BUILDING_COL)
        df = df.sort_values(sort_cols)

    X = df[feature_cols]
    y = df[TARGET_COL]

    # Time-based split: last semester-window dates as test
    if "date" in df.columns:
        unique_dates = pd.DatetimeIndex(df["date"].dropna().sort_values().unique())
        split_dates = select_test_dates(unique_dates)
        test_mask = df["date"].isin(split_dates)
        X_train = X[~test_mask]
        X_test = X[test_mask]
        y_train = y[~test_mask]
        y_test = y[test_mask]
    else:
        split_idx = max(len(df) - TEST_WINDOW_DAYS, 1)
        X_train = X.iloc[:split_idx]
        X_test = X.iloc[split_idx:]
        y_train = y.iloc[:split_idx]
        y_test = y.iloc[split_idx:]

    return X_train, X_test, y_train, y_test, df


def train_model(
    by_building: bool = False,
    building_name: Optional[str] = DEFAULT_BUILDING_NAME,
    building_numbers: Optional[list] = None,
):
    from sklearn.pipeline import Pipeline
    from sklearn.compose import ColumnTransformer
    from sklearn.preprocessing import StandardScaler
    from sklearn.preprocessing import OneHotEncoder
    from sklearn.linear_model import Ridge

    X_train, X_test, y_train, y_test, _ = load_data(
        by_building=by_building,
        building_name=building_name,
        building_numbers=building_numbers,
    )

    if by_building:
        numeric_features = list(FEATURE_COLS)
        categorical_features = [BUILDING_COL]
        preprocess = ColumnTransformer(
            [
                ("num", StandardScaler(), numeric_features),
                ("cat", OneHotEncoder(handle_unknown="ignore"), categorical_features),
            ],
            remainder="drop",
        )
        model = Pipeline(
            [
                ("preprocess", preprocess),
                ("reg", Ridge(alpha=1.0)),
            ]
        )
    else:
        model = Pipeline(
            [
                ("scaler", StandardScaler()),
                ("reg", Ridge(alpha=1.0)),
            ]
        )
    model.fit(X_train, y_train)
    return model, X_test, y_test


def compute_metrics(model, X_test, y_test):
    from sklearn.metrics import mean_absolute_error, root_mean_squared_error

    preds = model.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    rmse = root_mean_squared_error(y_test, preds)
    mean_target = y_test.mean()
    mae_pct = (mae / mean_target) * 100 if mean_target != 0 else float("nan")
    return mae, rmse, mae_pct


def evaluate_model(model, X_test, y_test):
    mae, rmse, mae_pct = compute_metrics(model, X_test, y_test)

    print("Test MAE:", round(mae, 3))
    print("Test RMSE:", round(rmse, 3))
    print("MAE % of mean target:", round(mae_pct, 3), "%")
    return mae, rmse, mae_pct


def resolve_path(path: str) -> str:
    if os.path.isabs(path):
        return path
    return os.path.join(BASE_DIR, path)


def predict_from_weather(model, weather_path, out_path, by_building: bool = False):
    weather_path = resolve_path(weather_path)
    out_path = resolve_path(out_path)
    if not os.path.exists(weather_path):
        raise FileNotFoundError(f"Missing {weather_path}")

    weather = pd.read_csv(weather_path)
    feature_cols = get_feature_cols(by_building)
    missing = [c for c in feature_cols if c not in weather.columns]
    if missing:
        raise ValueError(f"Missing required weather columns: {missing}")

    if by_building:
        weather[BUILDING_COL] = weather[BUILDING_COL].astype(str).str.strip()

    X_pred = weather[feature_cols]
    preds = model.predict(X_pred)

    if "date" in weather.columns:
        keep_cols = ["date"]
        if by_building and BUILDING_COL in weather.columns:
            keep_cols.append(BUILDING_COL)
        output = weather[keep_cols].copy()
    else:
        output = pd.DataFrame(index=weather.index)

    output[TARGET_COL] = preds
    output.to_csv(out_path, index=False)
    print(f"Wrote predictions to {out_path}")


def train_five_buildings():
    print("Training one model per building:")
    for idx, (building_name, building_number) in enumerate(TARGET_BUILDINGS, start=1):
        model, X_test, y_test = train_model(
            by_building=False,
            building_name=None,
            building_numbers=[building_number],
        )
        mae, rmse, mae_pct = compute_metrics(model, X_test, y_test)
        print(
            f"{idx}. {building_name} ({building_number}) | MAE: {mae:.3f} | RMSE: {rmse:.3f} | "
            f"MAE %: {mae_pct:.3f}%"
        )


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
    parser.add_argument(
        "--building-name",
        default=DEFAULT_BUILDING_NAME,
        help="Building name to filter (default: Thompson Library).",
    )
    parser.add_argument(
        "--all-buildings",
        action="store_true",
        help="Disable building filter and use all buildings.",
    )
    parser.add_argument(
        "--by-building",
        action="store_true",
        help="Train/predict per building (requires buildingnumber column).",
    )
    parser.add_argument(
        "--train-five-buildings",
        action="store_true",
        help="Train and evaluate separate models for 5 target buildings.",
    )
    args = parser.parse_args()

    try:
        if args.train_five_buildings:
            if args.predict_path:
                raise ValueError("--predict cannot be used with --train-five-buildings.")
            train_five_buildings()
            return

        building_name = None if args.all_buildings else args.building_name
        if building_name is not None:
            building_name = building_name.strip()
            if not building_name:
                building_name = None
        model, X_test, y_test = train_model(
            by_building=args.by_building,
            building_name=building_name,
        )
        if not args.no_eval:
            evaluate_model(model, X_test, y_test)
        if args.predict_path:
            predict_from_weather(
                model,
                args.predict_path,
                args.out_path,
                by_building=args.by_building,
            )
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
