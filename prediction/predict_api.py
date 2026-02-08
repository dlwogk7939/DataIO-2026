#!/usr/bin/env python3
"""
Tiny HTTP API for real-time building electricity prediction.

Uses energy_prediction.py model logic directly.

Run:
  python3 prediction/predict_api.py

Endpoints:
  GET  /health
  GET  /buildings
  POST /predict
"""

import json
import math
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Lock
from typing import Dict, Tuple

import pandas as pd

try:
    import energy_prediction as ep
except ModuleNotFoundError:
    sys.path.append(os.path.dirname(os.path.abspath(__file__)))
    import energy_prediction as ep

HOST = "127.0.0.1"
PORT = 8001

BUILDINGS: Tuple[Tuple[str, str], ...] = tuple(ep.TARGET_BUILDINGS)
BUILDING_NAME_TO_NUM = {name.lower(): number for name, number in BUILDINGS}
BUILDING_NUM_TO_NAME = {number: name for name, number in BUILDINGS}

MODEL_CACHE: Dict[str, object] = {}
MODEL_LOCK = Lock()


def _json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Allow-Headers", "Content-Type")
    handler.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
    handler.end_headers()
    handler.wfile.write(body)


def _to_float(value, field_name: str) -> float:
    try:
        number = float(value)
    except Exception as exc:
        raise ValueError(f"{field_name} must be a number") from exc

    if math.isnan(number) or math.isinf(number):
        raise ValueError(f"{field_name} must be a finite number")
    return number


def _resolve_building_number(payload: dict) -> str:
    raw = payload.get("building")
    if raw is None:
        raw = payload.get("building_name")
    if raw is None:
        raw = payload.get("building_number")
    if raw is None:
        raise ValueError("building is required")

    text = str(raw).strip()
    if not text:
        raise ValueError("building is required")

    if text in BUILDING_NUM_TO_NAME:
        return text

    lowered = text.lower()
    if lowered in BUILDING_NAME_TO_NUM:
        return BUILDING_NAME_TO_NUM[lowered]

    raise ValueError(
        "building must be one of: "
        + ", ".join([f"{name} ({number})" for name, number in BUILDINGS])
    )


def _get_or_train_model(building_number: str):
    with MODEL_LOCK:
        if building_number in MODEL_CACHE:
            return MODEL_CACHE[building_number]

        model, _, _ = ep.train_model(
            by_building=False,
            building_name=None,
            building_numbers=[building_number],
        )
        MODEL_CACHE[building_number] = model
        return model


class PredictHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):  # noqa: N802
        _json_response(self, 200, {"ok": True})

    def do_GET(self):  # noqa: N802
        if self.path == "/health":
            _json_response(self, 200, {"ok": True, "service": "energy-predict-api"})
            return
        if self.path == "/buildings":
            _json_response(
                self,
                200,
                {
                    "buildings": [
                        {"name": name, "building_number": number} for name, number in BUILDINGS
                    ]
                },
            )
            return
        _json_response(self, 404, {"error": "Not found"})

    def do_POST(self):  # noqa: N802
        if self.path != "/predict":
            _json_response(self, 404, {"error": "Not found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
            raw_body = self.rfile.read(content_length) if content_length > 0 else b""
            payload = json.loads(raw_body.decode("utf-8") if raw_body else "{}")
            if not isinstance(payload, dict):
                raise ValueError("JSON body must be an object")

            building_number = _resolve_building_number(payload)
            building_name = BUILDING_NUM_TO_NAME[building_number]
            temperature = _to_float(payload.get("temperature"), "temperature")
            precipitation = _to_float(payload.get("precipitation"), "precipitation")
            wind_speed = _to_float(payload.get("wind_speed"), "wind_speed")

            model = _get_or_train_model(building_number)
            X = pd.DataFrame(
                [
                    {
                        "precipitation": precipitation,
                        "temperature_2m": temperature,
                        "wind_speed_10m": wind_speed,
                    }
                ]
            )
            prediction = float(model.predict(X)[0])

            _json_response(
                self,
                200,
                {
                    "building_name": building_name,
                    "building_number": building_number,
                    "predicted_electricity_usage": prediction,
                    "target_column": ep.TARGET_COL,
                },
            )
        except ValueError as exc:
            _json_response(self, 400, {"error": str(exc)})
        except Exception as exc:
            _json_response(self, 500, {"error": f"Prediction failed: {exc}"})

    def log_message(self, fmt, *args):  # noqa: D401
        # Keep API logs quiet in dev.
        return


def main() -> int:
    server = ThreadingHTTPServer((HOST, PORT), PredictHandler)
    print(f"Energy prediction API listening on http://{HOST}:{PORT}")
    print("Endpoints: GET /health, GET /buildings, POST /predict")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
