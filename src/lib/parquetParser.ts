// @ts-ignore - hyparquet types
import { parquetReadObjects, parquetMetadata } from "hyparquet";
import type { ParsedData, Building, HourlyEntry, DailyEntry, BuildingConsumption, TempVsElectricity, SummaryMetrics } from "./csvParser";

// Re-export ParsedData for convenience
export type { ParsedData };

/** Info shown after parquet load */
export interface ParquetInfo {
  rowCount: number;
  columns: string[];
}

/** Wrap an ArrayBuffer so hyparquet can consume it */
function asyncBufferFromArrayBuffer(buf: ArrayBuffer) {
  return {
    byteLength: buf.byteLength,
    slice(start: number, end?: number) {
      return buf.slice(start, end);
    },
  };
}

/** Read a File as ArrayBuffer */
function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

/** Gold row from df_gold.parquet */
interface GoldRow {
  readingtime: string | Date;
  utility: string;
  readingvalue: number;
  sitename: string;
  simscode: string | number;
  temperature_2m: number;
  grossarea: number;
  kwh_per_sqft: number;
  electricity_kwh?: number;
  date?: string;
}

/**
 * Parse df_gold.parquet and extract metadata + rows.
 * Returns { info, rows } where info contains row count & column list.
 */
export async function parseParquetFile(file: File): Promise<{ info: ParquetInfo; rows: GoldRow[] }> {
  const arrayBuffer = await readFileAsArrayBuffer(file);
  const asyncBuffer = asyncBufferFromArrayBuffer(arrayBuffer);

  // Read metadata for info
  const metadata = await parquetMetadata(asyncBuffer as any);
  const columns = (metadata as any).schema
    .filter((s: any) => s.name !== "schema" && !s.num_children)
    .map((s: any) => s.name);
  const rowCount = Number((metadata as any).num_rows);

  // Read all rows as objects
  const rows = await parquetReadObjects({
    file: asyncBuffer as any,
  }) as Record<string, unknown>[];

  const goldRows: GoldRow[] = rows.map((row) => row as unknown as GoldRow);

  return { info: { rowCount, columns }, rows: goldRows };
}

/** Validate that the parquet has the required columns */
const REQUIRED_COLUMNS = [
  "readingtime",
  "readingvalue",
  "sitename",
  "temperature_2m",
  "grossarea",
  "kwh_per_sqft",
];

export function validateGoldColumns(columns: string[]): string[] {
  const lower = columns.map((c) => c.toLowerCase());
  return REQUIRED_COLUMNS.filter((req) => !lower.includes(req));
}

/** Build ParsedData from gold rows */
export function buildParsedDataFromGold(rows: GoldRow[]): ParsedData {
  // Filter to electricity only
  const elecRows = rows.filter(
    (r) =>
      !r.utility ||
      r.utility.toLowerCase().includes("elec") ||
      r.utility === ""
  );

  // --- Buildings ---
  const siteMap = new Map<string, { sqft: number; code: string }>();
  for (const r of elecRows) {
    if (r.sitename && !siteMap.has(r.sitename)) {
      siteMap.set(r.sitename, {
        sqft: r.grossarea || 0,
        code: String(r.simscode ?? ""),
      });
    }
  }

  const buildings: Building[] = Array.from(siteMap.entries()).map(
    ([name, info]) => ({
      id: info.code || name,
      name,
      sqft: info.sqft,
      type: "Building",
    })
  );

  // --- Hourly data ---
  const hourlyMap = new Map<
    string,
    { kwh: number; temps: number[]; ts: Date }
  >();

  for (const r of elecRows) {
    const d = new Date(r.readingtime);
    if (isNaN(d.getTime())) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
    const existing = hourlyMap.get(key) || { kwh: 0, temps: [], ts: d };
    existing.kwh += r.readingvalue || 0;
    if (r.temperature_2m != null && !isNaN(r.temperature_2m)) {
      existing.temps.push(r.temperature_2m);
    }
    hourlyMap.set(key, existing);
  }

  const startTime = elecRows.reduce((min, r) => {
    const t = new Date(r.readingtime).getTime();
    return !isNaN(t) && t < min ? t : min;
  }, Infinity);
  const startDate = isFinite(startTime) ? new Date(startTime) : new Date(2025, 0, 1);

  const sortedHourlyKeys = Array.from(hourlyMap.keys()).sort((a, b) => {
    const pa = a.split("-").map(Number);
    const pb = b.split("-").map(Number);
    return (
      new Date(pa[0], pa[1], pa[2], pa[3]).getTime() -
      new Date(pb[0], pb[1], pb[2], pb[3]).getTime()
    );
  });

  const hourlyData: HourlyEntry[] = sortedHourlyKeys.map((key) => {
    const parts = key.split("-").map(Number);
    const d = new Date(parts[0], parts[1], parts[2], parts[3]);
    const entry = hourlyMap.get(key)!;
    const avgTemp =
      entry.temps.length > 0
        ? entry.temps.reduce((s, t) => s + t, 0) / entry.temps.length
        : 0;
    const dayOffset = Math.floor(
      (d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      timestamp: d.toISOString(),
      hour: d.getHours(),
      day: dayOffset,
      totalKwh: Math.round(entry.kwh),
      temperature: Math.round(avgTemp * 10) / 10,
    };
  });

  // --- Daily aggregation ---
  const dailyMap = new Map<
    string,
    { kwh: number; temps: number[]; date: Date }
  >();
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
      label: val.date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      totalKwh: Math.round(val.kwh),
      avgTemperature:
        val.temps.length > 0
          ? Math.round(
              (val.temps.reduce((s, t) => s + t, 0) / val.temps.length) * 10
            ) / 10
          : 0,
    }));

  // --- Per-building consumption using kwh_per_sqft from gold ---
  const buildingStatsMap = new Map<
    string,
    { totalKwh: number; count: number; intensity: number }
  >();
  for (const r of elecRows) {
    if (!r.sitename) continue;
    const existing = buildingStatsMap.get(r.sitename) || {
      totalKwh: 0,
      count: 0,
      intensity: r.kwh_per_sqft || 0,
    };
    existing.totalKwh += r.readingvalue || 0;
    existing.count += 1;
    // Keep latest intensity value from gold
    if (r.kwh_per_sqft != null && !isNaN(r.kwh_per_sqft)) {
      existing.intensity = r.kwh_per_sqft;
    }
    buildingStatsMap.set(r.sitename, existing);
  }

  const buildingConsumption: BuildingConsumption[] = buildings.map((b) => {
    const stats = buildingStatsMap.get(b.name);
    const totalKwh = stats?.totalKwh ?? 0;
    const count = stats?.count ?? 1;
    const avgHourlyKwh = Math.round(totalKwh / Math.max(count, 1));
    const intensity =
      stats?.intensity ??
      (b.sqft > 0 ? Math.round((totalKwh / b.sqft) * 100) / 100 : 0);

    return {
      ...b,
      avgHourlyKwh,
      totalMonthlyKwh: Math.round(totalKwh),
      intensityKwhPerSqft: Math.round(intensity * 100) / 100,
    };
  });

  // --- Temp vs electricity scatter ---
  const tempVsElectricity: TempVsElectricity[] = dailyData
    .filter((d) => d.avgTemperature !== 0)
    .map((d) => ({
      temperature: d.avgTemperature,
      electricity: d.totalKwh,
      date: d.label,
    }));

  // --- Pearson correlation ---
  let weatherCorrelation = 0;
  if (tempVsElectricity.length > 2) {
    const n = tempVsElectricity.length;
    const meanT =
      tempVsElectricity.reduce((s, d) => s + d.temperature, 0) / n;
    const meanE =
      tempVsElectricity.reduce((s, d) => s + d.electricity, 0) / n;
    let num = 0,
      denT = 0,
      denE = 0;
    for (const d of tempVsElectricity) {
      const dt = d.temperature - meanT;
      const de = d.electricity - meanE;
      num += dt * de;
      denT += dt * dt;
      denE += de * de;
    }
    const denom = Math.sqrt(denT * denE);
    weatherCorrelation =
      denom > 0 ? Math.round((num / denom) * 100) / 100 : 0;
  }

  // --- Summary metrics ---
  const summaryMetrics: SummaryMetrics = {
    totalMonthlyMwh: Math.round(
      dailyData.reduce((s, d) => s + d.totalKwh, 0) / 1000
    ),
    buildingsMonitored: buildings.length,
    avgIntensity:
      buildingConsumption.length > 0
        ? Math.round(
            (buildingConsumption.reduce(
              (s, b) => s + b.intensityKwhPerSqft,
              0
            ) /
              buildingConsumption.length) *
              100
          ) / 100
        : 0,
    peakDemandKw:
      hourlyData.length > 0
        ? Math.max(...hourlyData.map((d) => d.totalKwh))
        : 0,
    weatherCorrelation,
  };

  return {
    buildings,
    hourlyData,
    dailyData,
    buildingConsumption,
    tempVsElectricity,
    summaryMetrics,
  };
}
