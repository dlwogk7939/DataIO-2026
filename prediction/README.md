# Prediction Service

## Real-time API (used by dashboard form)

Runs the model logic from `prediction/energy_prediction.py` and exposes HTTP endpoints.

```bash
# from repo root
.venv/bin/python prediction/predict_api.py
```

Or run UI + API together:

```bash
npm run dev:ml
```

API:
- `GET /health`
- `GET /buildings`
- `POST /predict`

Example request:

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

## Frontend connection

The UI component uses this env var:

- `VITE_PREDICT_API_URL`

Default behavior:
- In local Vite dev, the app calls `/api/predict` and Vite proxies to `http://127.0.0.1:8001/predict`.
- You only need `VITE_PREDICT_API_URL` when overriding that default (for example, non-dev deployment).

If needed, create `.env.local`:

```bash
VITE_PREDICT_API_URL=http://127.0.0.1:8001/predict
```
