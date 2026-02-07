import Papa from "papaparse";

// ── Flexible column name resolution ──────────────────────────────────────────

type ColumnAliases = Record<string, string[]>;

function resolveColumns(headers: string[], aliases: ColumnAliases): Record<string, string> {
  const resolved: Record<string, string> = {};
  const lowerHeaders = headers.map((h) => h.trim().toLowerCase().replace(/[\s_-]+/g, "_"));

  for (const [canonical, candidates] of Object.entries(aliases)) {
    const idx = lowerHeaders.findIndex((h) =>
      candidates.some((c) => h === c || h.includes(c))
    );
    if (idx !== -1) {
      resolved[canonical] = headers[idx];
    }
  }
  return resolved;
}

function getVal(row: Record<string, unknown>, resolved: Record<string, string>, key: string): string {
  const col = resolved[key];
  return col ? String(row[col] ?? "").trim() : "";
}

function getNum(row: Record<string, unknown>, resolved: Record<string, string>, key: string): number {
  const v = parseFloat(getVal(row, resolved, key));
  return isNaN(v) ? 0 : v;
}

// ── Public types ─────────────────────────────────────────────────────────────

export interface Building {
  id: string;
  name: string;
  sqft: number;
  type: string;
}

export interface HourlyEntry {
  timestamp: string;
  hour: number;
  day: number;
  totalKwh: number;
  temperature: number;
  buildingId?: string;
}

export interface DailyEntry {
  date: string;
  label: string;
  totalKwh: number;
  avgTemperature: number;
}

export interface BuildingConsumption extends Building {
  avgHourlyKwh: number;
  totalMonthlyKwh: number;
  intensityKwhPerSqft: number;
}

export interface TempVsElectricity {
  temperature: number;
  electricity: number;
  date: string;
}

export interface SummaryMetrics {
  totalMonthlyMwh: number;
  buildingsMonitored: number;
  avgIntensity: number;
  peakDemandKw: number;
  weatherCorrelation: number;
}

export interface BuildingMoMChange {
  name: string;
  prevMonthKwh: number;
  currMonthKwh: number;
  changeKwh: number;
  changePct: number;
  prevMonthLabel: string;
  currMonthLabel: string;
}

export interface ParsedData {
  buildings: Building[];
  hourlyData: HourlyEntry[];
  dailyData: DailyEntry[];
  buildingConsumption: BuildingConsumption[];
  tempVsElectricity: TempVsElectricity[];
  summaryMetrics: SummaryMetrics;
  buildingMoMChanges: BuildingMoMChange[];
}

// ── CSV file parsing ─────────────────────────────────────────────────────────

function parseCSV(file: File): Promise<Record<string, unknown>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => resolve(results.data as Record<string, unknown>[]),
      error: (err) => reject(err),
    });
  });
}

// ── Building metadata ────────────────────────────────────────────────────────

const buildingAliases: ColumnAliases = {
  id: ["building_id", "buildingid", "id", "bldg_id", "building"],
  name: ["building_name", "buildingname", "name", "bldg_name"],
  sqft: ["sqft", "gross_square_feet", "square_feet", "grosssquarefeet", "sq_ft", "area", "gross_square_footage"],
  type: ["type", "building_type", "buildingtype", "category", "use_type", "facility_type"],
};

export function parseBuildings(rows: Record<string, unknown>[], headers: string[]): Building[] {
  const cols = resolveColumns(headers, buildingAliases);
  return rows.map((row) => ({
    id: getVal(row, cols, "id"),
    name: getVal(row, cols, "name"),
    sqft: getNum(row, cols, "sqft"),
    type: getVal(row, cols, "type") || "Unknown",
  })).filter((b) => b.id && b.name);
}

// ── Meter readings ───────────────────────────────────────────────────────────

const meterAliases: ColumnAliases = {
  timestamp: ["timestamp", "datetime", "date_time", "date", "reading_time", "time"],
  buildingId: ["building_id", "buildingid", "bldg_id", "building", "meter_id"],
  kwh: ["kwh", "reading_value", "value", "consumption", "total_kwh", "electricity", "usage", "reading"],
  utility: ["utility", "utility_type", "utilitytype", "type", "meter_type"],
};

interface MeterRow {
  timestamp: string;
  buildingId: string;
  kwh: number;
  utility: string;
}

export function parseMeterReadings(rows: Record<string, unknown>[], headers: string[]): MeterRow[] {
  const cols = resolveColumns(headers, meterAliases);
  return rows
    .map((row) => ({
      timestamp: getVal(row, cols, "timestamp"),
      buildingId: getVal(row, cols, "buildingId"),
      kwh: getNum(row, cols, "kwh"),
      utility: getVal(row, cols, "utility").toLowerCase(),
    }))
    .filter((r) => r.timestamp && r.kwh > 0)
    // Keep only electricity readings if utility column exists
    .filter((r) => !r.utility || r.utility === "" || r.utility.includes("elec"));
}

// ── Weather data ─────────────────────────────────────────────────────────────

const weatherAliases: ColumnAliases = {
  timestamp: ["timestamp", "datetime", "date_time", "date", "time", "observation_time"],
  temperature: ["temperature", "temp", "air_temperature", "airtemperature", "temp_f", "temperature_f", "air_temp"],
};

interface WeatherRow {
  timestamp: string;
  temperature: number;
}

export function parseWeather(rows: Record<string, unknown>[], headers: string[]): WeatherRow[] {
  const cols = resolveColumns(headers, weatherAliases);
  return rows
    .map((row) => ({
      timestamp: getVal(row, cols, "timestamp"),
      temperature: getNum(row, cols, "temperature"),
    }))
    .filter((r) => r.timestamp);
}

// ── Aggregate all data ───────────────────────────────────────────────────────

export async function parseAllFiles(files: Record<string, File>): Promise<ParsedData> {
  // Parse building metadata
  const buildingRaw = await parseCSV(files["building_metadata.csv"]);
  const buildingHeaders = buildingRaw.length > 0 ? Object.keys(buildingRaw[0]) : [];
  const buildings = parseBuildings(buildingRaw, buildingHeaders);

  // Parse all meter reading files
  const meterFiles = [
    "meter-readings-jan-2025.csv",
    "meter-readings-feb-2025.csv",
    "meter-readings-march-2025.csv",
    "meter-readings-april-2025.csv",
  ];

  let allMeterRows: MeterRow[] = [];
  for (const fname of meterFiles) {
    if (files[fname]) {
      const raw = await parseCSV(files[fname]);
      const headers = raw.length > 0 ? Object.keys(raw[0]) : [];
      allMeterRows = allMeterRows.concat(parseMeterReadings(raw, headers));
    }
  }

  // Parse weather
  const weatherRaw = await parseCSV(files["weather_data_hourly_2025.csv"]);
  const weatherHeaders = weatherRaw.length > 0 ? Object.keys(weatherRaw[0]) : [];
  const weatherRows = parseWeather(weatherRaw, weatherHeaders);

  // Build weather lookup (by hour-granularity key)
  const weatherMap = new Map<string, number>();
  for (const w of weatherRows) {
    const d = new Date(w.timestamp);
    if (!isNaN(d.getTime())) {
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      weatherMap.set(key, w.temperature);
    }
  }

  // Build hourly data: aggregate all buildings per hour and join with weather
  const hourlyMap = new Map<string, { kwh: number; count: number }>();
  const startDate = allMeterRows.length > 0
    ? new Date(allMeterRows.reduce((min, r) => {
        const t = new Date(r.timestamp).getTime();
        return t < min ? t : min;
      }, Infinity))
    : new Date(2025, 0, 1);

  for (const r of allMeterRows) {
    const d = new Date(r.timestamp);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
    const existing = hourlyMap.get(key) || { kwh: 0, count: 0 };
    existing.kwh += r.kwh;
    existing.count += 1;
    hourlyMap.set(key, existing);
  }

  const hourlyData: HourlyEntry[] = [];
  const sortedKeys = Array.from(hourlyMap.keys()).sort((a, b) => {
    const pa = a.split("-").map(Number);
    const pb = b.split("-").map(Number);
    const da = new Date(pa[0], pa[1], pa[2], pa[3]).getTime();
    const db = new Date(pb[0], pb[1], pb[2], pb[3]).getTime();
    return da - db;
  });

  for (const key of sortedKeys) {
    const parts = key.split("-").map(Number);
    const d = new Date(parts[0], parts[1], parts[2], parts[3]);
    const dayOffset = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const temp = weatherMap.get(key) ?? 0;
    const entry = hourlyMap.get(key)!;

    hourlyData.push({
      timestamp: d.toISOString(),
      hour: d.getHours(),
      day: dayOffset,
      totalKwh: Math.round(entry.kwh),
      temperature: Math.round(temp * 10) / 10,
    });
  }

  // Daily aggregation
  const dailyMap = new Map<string, { kwh: number; temps: number[]; date: Date }>();
  for (const h of hourlyData) {
    const d = new Date(h.timestamp);
    const dateKey = d.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) || { kwh: 0, temps: [], date: d };
    existing.kwh += h.totalKwh;
    if (h.temperature) existing.temps.push(h.temperature);
    dailyMap.set(dateKey, existing);
  }

  const dailyData: DailyEntry[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, val]) => ({
      date: dateKey,
      label: val.date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      totalKwh: Math.round(val.kwh),
      avgTemperature:
        val.temps.length > 0
          ? Math.round((val.temps.reduce((s, t) => s + t, 0) / val.temps.length) * 10) / 10
          : 0,
    }));

  // Per-building consumption
  const buildingKwhMap = new Map<string, number[]>();
  for (const r of allMeterRows) {
    if (!r.buildingId) continue;
    const existing = buildingKwhMap.get(r.buildingId) || [];
    existing.push(r.kwh);
    buildingKwhMap.set(r.buildingId, existing);
  }

  const buildingConsumption: BuildingConsumption[] = buildings.map((b) => {
    const readings = buildingKwhMap.get(b.id) || [];
    const totalKwh = readings.reduce((s, v) => s + v, 0);
    const avgHourlyKwh = readings.length > 0 ? Math.round(totalKwh / readings.length) : 0;
    const totalMonthlyKwh = totalKwh;
    const intensity = b.sqft > 0 ? Math.round((totalKwh / b.sqft) * 100) / 100 : 0;

    return {
      ...b,
      avgHourlyKwh,
      totalMonthlyKwh: Math.round(totalMonthlyKwh),
      intensityKwhPerSqft: intensity,
    };
  });

  // Temp vs electricity scatter
  const tempVsElectricity: TempVsElectricity[] = dailyData
    .filter((d) => d.avgTemperature !== 0)
    .map((d) => ({
      temperature: d.avgTemperature,
      electricity: d.totalKwh,
      date: d.label,
    }));

  // Compute Pearson correlation
  let weatherCorrelation = 0;
  if (tempVsElectricity.length > 2) {
    const n = tempVsElectricity.length;
    const meanT = tempVsElectricity.reduce((s, d) => s + d.temperature, 0) / n;
    const meanE = tempVsElectricity.reduce((s, d) => s + d.electricity, 0) / n;
    let num = 0, denT = 0, denE = 0;
    for (const d of tempVsElectricity) {
      const dt = d.temperature - meanT;
      const de = d.electricity - meanE;
      num += dt * de;
      denT += dt * dt;
      denE += de * de;
    }
    const denom = Math.sqrt(denT * denE);
    weatherCorrelation = denom > 0 ? Math.round((num / denom) * 100) / 100 : 0;
  }

  // Summary metrics
  const summaryMetrics: SummaryMetrics = {
    totalMonthlyMwh: Math.round(dailyData.reduce((s, d) => s + d.totalKwh, 0) / 1000),
    buildingsMonitored: buildings.length,
    avgIntensity:
      buildingConsumption.length > 0
        ? Math.round(
            (buildingConsumption.reduce((s, b) => s + b.intensityKwhPerSqft, 0) /
              buildingConsumption.length) *
              100
          ) / 100
        : 0,
    peakDemandKw: hourlyData.length > 0 ? Math.max(...hourlyData.map((d) => d.totalKwh)) : 0,
    weatherCorrelation,
  };

  // Month-over-month building changes
  const buildingMonthMap = new Map<string, Map<string, number>>();
  for (const r of allMeterRows) {
    const d = new Date(r.timestamp);
    if (isNaN(d.getTime()) || !r.buildingId) continue;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buildingMonthMap.has(r.buildingId)) buildingMonthMap.set(r.buildingId, new Map());
    const months = buildingMonthMap.get(r.buildingId)!;
    months.set(monthKey, (months.get(monthKey) || 0) + r.kwh);
  }

  const buildingMoMChanges: import("./csvParser").BuildingMoMChange[] = [];
  const buildingNameMap = new Map(buildings.map((b) => [b.id, b.name]));
  for (const [bId, months] of buildingMonthMap) {
    const sortedMonths = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (let i = 1; i < sortedMonths.length; i++) {
      const [prevKey, prevKwh] = sortedMonths[i - 1];
      const [currKey, currKwh] = sortedMonths[i];
      const changeKwh = currKwh - prevKwh;
      const changePct = prevKwh > 0 ? Math.round((changeKwh / prevKwh) * 10000) / 100 : 0;
      const fmtMonth = (k: string) => {
        const [y, m] = k.split("-");
        return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      };
      buildingMoMChanges.push({
        name: buildingNameMap.get(bId) || bId,
        prevMonthKwh: Math.round(prevKwh),
        currMonthKwh: Math.round(currKwh),
        changeKwh: Math.round(changeKwh),
        changePct,
        prevMonthLabel: fmtMonth(prevKey),
        currMonthLabel: fmtMonth(currKey),
      });
    }
  }

  return {
    buildings,
    hourlyData,
    dailyData,
    buildingConsumption,
    tempVsElectricity,
    summaryMetrics,
    buildingMoMChanges,
  };
}
