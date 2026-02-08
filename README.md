# Campus Energy Insights

Campus building energy analytics dashboard with weather-driven ML prediction.

This project provides:
- Interactive analytics dashboards from uploaded CSV datasets
- Building-level weather sensitivity analysis
- Real-time electricity usage prediction API (Python + scikit-learn)

## Project Overview

The app is split into two parts:
- Frontend (`React + TypeScript + Vite`): CSV upload, analytics charts, and prediction form
- Prediction service (`Python`): data cleaning, model training, and REST-like inference endpoint

Core prediction input features:
- `precipitation`
- `temperature_2m`
- `wind_speed_10m`

Target:
- `readingwindowsum` (electricity usage)

## Tech Stack

- Frontend: `React`, `TypeScript`, `Vite`, `Tailwind CSS`, `shadcn/ui`, `Recharts`
- Data parsing/state: `PapaParse`, `React Router`, `TanStack Query`
- ML/data: `Python`, `pandas`, `numpy`, `scikit-learn`
- Tooling: `ESLint`, `Vitest`, `Testing Library`

## Repository Structure

```text
src/                          Frontend app (dashboard + charts + upload + prediction form)
prediction/
  data_clean.py               Build cleaned datasets from raw CSVs
  energy_prediction.py        Train/evaluate/predict with ML models
  predict_api.py              HTTP prediction API used by frontend
  cleaned_data/               Cleaned CSV outputs
  advanced_core/              Raw source CSVs (input)
  advanced_bonus/             Raw source CSVs (input)
```

## Prerequisites

- `Node.js` 18+ and `npm`
- `Python` 3.9+ (project uses local `.venv`)

## Setup

```bash
# 1) Install frontend dependencies
npm install

# 2) Create/activate virtual environment (if needed)
python3 -m venv .venv
source .venv/bin/activate

# 3) Install Python dependencies
pip install -r requirements.txt
```

## Run (Recommended)

Run frontend + prediction API together:

```bash
npm run dev:ml
```

- Frontend: `http://localhost:8080`
- Prediction API: `http://127.0.0.1:8001`

## Run Separately

Frontend only:

```bash
npm run dev
```

Prediction API only:

```bash
.venv/bin/python prediction/predict_api.py
```

## API Endpoints

- `GET /health`
- `GET /buildings`
- `POST /predict`

Example:

```bash
curl -X POST http://127.0.0.1:8001/predict \
  -H "Content-Type: application/json" \
  -d '{
    "building": "50",
    "temperature": 72,
    "precipitation": 0.1,
    "wind_speed": 9
  }'
```

## Data Pipeline

If you need to rebuild cleaned datasets:

1. Put raw CSV files under:
- `prediction/advanced_core/`
- `prediction/advanced_bonus/`

2. Run:

```bash
.venv/bin/python prediction/data_clean.py
```

This generates:
- `prediction/cleaned_data/weather_daily_selected.csv`
- `prediction/cleaned_data/building_metadata_selected.csv`
- `prediction/cleaned_data/meter_premerge_selected.csv`
- `prediction/cleaned_data/meter_building_weather_merged.csv`

## Model Training / Evaluation

Default (single building, Thompson):

```bash
.venv/bin/python prediction/energy_prediction.py
```

Train/evaluate five target buildings:

```bash
.venv/bin/python prediction/energy_prediction.py --train-five-buildings
```

Train one building by name:

```bash
.venv/bin/python prediction/energy_prediction.py --building-name "Thompson Library"
```

Batch prediction from input weather CSV to output CSV:

```bash
.venv/bin/python prediction/energy_prediction.py \
  --input-csv prediction/data/new_daily_weather.csv \
  --output-csv prediction/data/predictions.csv
```

## Useful Scripts

- `npm run dev`: start frontend dev server
- `npm run dev:ml`: start frontend + Python prediction API together
- `npm run build`: production build
- `npm run test`: run tests
- `npm run lint`: run lint checks

## Notes

- In local dev, frontend calls `/api/predict` and Vite proxies to `http://127.0.0.1:8001/predict`.
- If you need custom API URL, set `VITE_PREDICT_API_URL` in `.env.local`.
