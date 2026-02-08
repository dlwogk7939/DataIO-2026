import { useMemo, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

type BuildingOption = {
  name: string;
  number: string;
};

type PredictResponse = {
  building_name: string;
  building_number: string;
  predicted_electricity_usage: number;
  target_column: string;
};

const BUILDINGS: BuildingOption[] = [
  { name: "Thompson Library", number: "50" },
  { name: "RPAC", number: "246" },
  { name: "Knowlton Hall", number: "17" },
  { name: "Hitchcock Hall", number: "274" },
  { name: "Ohio Union", number: "161" },
];

const API_URL = import.meta.env.VITE_PREDICT_API_URL ?? "/api/predict";

const BuildingPredictionForm = () => {
  const [building, setBuilding] = useState<string>(BUILDINGS[0].number);
  const [temperature, setTemperature] = useState<string>("");
  const [precipitation, setPrecipitation] = useState<string>("");
  const [windSpeed, setWindSpeed] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictResponse | null>(null);

  const selectedBuilding = useMemo(
    () => BUILDINGS.find((b) => b.number === building) ?? BUILDINGS[0],
    [building]
  );

  const handlePredict = async () => {
    setError(null);
    setResult(null);

    const t = Number(temperature);
    const p = Number(precipitation);
    const w = Number(windSpeed);
    if (!Number.isFinite(t) || !Number.isFinite(p) || !Number.isFinite(w)) {
      setError("Temperature, precipitation, and wind speed must be valid numbers.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building,
          temperature: t,
          precipitation: p,
          wind_speed: w,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      const isJson = contentType.toLowerCase().includes("application/json");
      const body = isJson ? await res.json() : null;
      if (!res.ok) {
        throw new Error(
          (body as { error?: string } | null)?.error ??
            `Prediction request failed (HTTP ${res.status})`
        );
      }
      setResult(body as PredictResponse);
    } catch (err) {
      let message = err instanceof Error ? err.message : "Prediction request failed";
      if (err instanceof TypeError) {
        message =
          "Cannot connect to prediction API. Start it with: .venv/bin/python prediction/predict_api.py";
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">ML Electricity Prediction</h3>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs text-muted-foreground">
          Building
          <select
            value={building}
            onChange={(e) => setBuilding(e.target.value)}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground"
          >
            {BUILDINGS.map((b) => (
              <option key={b.number} value={b.number}>
                {b.name} ({b.number})
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-muted-foreground">
          Temperature (deg F)
          <input
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            placeholder="e.g. 72"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
        </label>

        <label className="text-xs text-muted-foreground">
          Precipitation (in)
          <input
            type="number"
            value={precipitation}
            onChange={(e) => setPrecipitation(e.target.value)}
            placeholder="e.g. 0.2"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
        </label>

        <label className="text-xs text-muted-foreground">
          Wind Speed (mph)
          <input
            type="number"
            value={windSpeed}
            onChange={(e) => setWindSpeed(e.target.value)}
            placeholder="e.g. 8.5"
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-2 text-sm text-foreground"
          />
        </label>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handlePredict}
          disabled={loading}
          className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold ${
            loading
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : "bg-primary text-primary-foreground hover:brightness-110"
          }`}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Predict Usage
        </button>
        <span className="text-xs text-muted-foreground">
          Model source: <code>prediction/energy_prediction.py</code>
        </span>
      </div>

      {error && (
        <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-md border border-primary/30 bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Predicted electricity usage (kWh/day)</p>
          <p className="mt-1 text-xl font-bold text-foreground">
            {result.predicted_electricity_usage.toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Building: {selectedBuilding.name} ({result.building_number}) · target:{" "}
            {result.target_column}
          </p>
        </div>
      )}
    </div>
  );
};

export default BuildingPredictionForm;
