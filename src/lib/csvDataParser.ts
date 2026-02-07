/**
 * CSV Data Parser
 *
 * Parses the five required CSV files and builds a unified ParsedData object
 * that all visualization components consume.
 *
 * Required files & authoritative column schemas:
 *  1. meter_premerge_selected.csv
 *     → simscode, utility, readingtime, readingunits, readingunitsdisplay, readingwindowsum
 *  2. meter_building_merged.csv
 *     → simscode, utility, readingtime, readingunits, readingunitsdisplay, readingwindowsum,
 *       buildingnumber, buildingname, campusname, city, latitude, longitude
 *  3. meter_building_weather_merged.csv  (PRIMARY)
 *     → simscode, utility, readingtime, readingunits, readingunitsdisplay, readingwindowsum,
 *       buildingnumber, buildingname, campusname, address, city, state, postalcode, county,
 *       formalname, alsoknownas, grossarea, floorsaboveground, floorsbelowground,
 *       constructiondate, latitude, longitude,
 *       date, temperature_2m, shortwave_radiation, relative_humidity_2m, precipitation,
 *       wind_speed_10m, cloud_cover, cdd, hdd
 *  4. building_metadata_selected.csv
 *     → buildingnumber, buildingname, campusname, city, latitude, longitude
 *  5. weather_daily_selected.csv
 *     → date, temperature_2m, shortwave_radiation, relative_humidity_2m, precipitation,
 *       wind_speed_10m, cloud_cover, cdd, hdd
 */

import Papa from "papaparse";
import type {
  ParsedData,
  Building,
  HourlyEntry,
  DailyEntry,
  BuildingConsumption,
  TempVsElectricity,
  SummaryMetrics,
  BuildingMoMChange,
  BuildingPrediction,
} from "./csvParser";

// ── Required file definitions ──────────────────────────────────────────────

export const REQUIRED_FILES = [
  "meter_premerge_selected.csv",
  "meter_building_merged.csv",
  "meter_building_weather_merged.csv",
  "building_metadata_selected.csv",
  "weather_daily_selected.csv",
] as const;

export type RequiredFileName = (typeof REQUIRED_FILES)[number];

export const FILE_KEYS: Record<RequiredFileName, string> = {
  "meter_premerge_selected.csv": "meterPremerge",
  "meter_building_merged.csv": "meterBuilding",
  "meter_building_weather_merged.csv": "meterBuildingWeather",
  "building_metadata_selected.csv": "buildingMetadata",
  "weather_daily_selected.csv": "weatherDaily",
};

export const FILE_DESCRIPTIONS: Record<RequiredFileName, string> = {
  "meter_premerge_selected.csv": "Raw smart meter readings",
  "meter_building_merged.csv": "Meter data merged with building info",
  "meter_building_weather_merged.csv": "Meter + building + weather data",
  "building_metadata_selected.csv": "Building metadata (area, type)",
  "weather_daily_selected.csv": "Daily weather observations",
};

// ── Expected columns per file (for validation) ────────────────────────────

const EXPECTED_COLUMNS: Record<RequiredFileName, string[]> = {
  "meter_premerge_selected.csv": [
    "simscode", "utility", "readingtime", "readingunits", "readingunitsdisplay", "readingwindowsum",
  ],
  "meter_building_merged.csv": [
    "simscode", "utility", "readingtime", "readingunits", "readingunitsdisplay", "readingwindowsum",
    "buildingnumber", "buildingname", "campusname", "city", "latitude", "longitude",
  ],
  "meter_building_weather_merged.csv": [
    "simscode", "utility", "readingtime", "readingunits", "readingunitsdisplay", "readingwindowsum",
    "buildingnumber", "buildingname", "grossarea", "temperature_2m",
  ],
  "building_metadata_selected.csv": [
    "buildingnumber", "buildingname",
  ],
  "weather_daily_selected.csv": [
    "date", "temperature_2m",
  ],
};

// ── CSV file info ──────────────────────────────────────────────────────────

export interface CsvFileInfo {
  fileName: string;
  rowCount: number;
  columns: string[];
  fileSizeBytes: number;
}

export interface AllCsvInfo {
  [key: string]: CsvFileInfo;
}

// ── Parsing helpers ────────────────────────────────────────────────────────

function parseCsvFile(file: File): Promise<{ rows: Record<string, unknown>[]; columns: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false, // we handle numeric conversion explicitly
      complete: (results) => {
        const columns = results.meta.fields ?? [];
        const rows = results.data as Record<string, unknown>[];
        resolve({ rows, columns });
      },
      error: (err: Error) => reject(err),
    });
  });
}

const NUMERIC_FIELDS = new Set([
  "readingwindowsum", "grossarea", "temperature_2m", "shortwave_radiation",
  "relative_humidity_2m", "precipitation", "wind_speed_10m", "cloud_cover",
  "cdd", "hdd", "latitude", "longitude", "floorsaboveground", "floorsbelowground",
]);

function toNum(val: unknown): number {
  if (typeof val === "number" && !isNaN(val)) return val;
  if (val == null || val === "") return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function toStr(val: unknown): string {
  return val == null ? "" : String(val).trim();
}

function toDate(val: unknown): Date | null {
  if (val instanceof Date) return val;
  if (val == null || val === "") return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

/** Validate that a parsed CSV contains the minimum required columns */
function validateColumns(
  fileName: RequiredFileName,
  actualColumns: string[],
): string | null {
  const expected = EXPECTED_COLUMNS[fileName];
  const lower = new Set(actualColumns.map((c) => c.toLowerCase()));
  const missing = expected.filter((c) => !lower.has(c));
  if (missing.length > 0) {
    return `${fileName} is missing required columns: ${missing.join(", ")}. Found columns: ${actualColumns.join(", ")}`;
  }
  return null;
}

// ── Main parse function ────────────────────────────────────────────────────

export interface ParseResult {
  data: ParsedData;
  info: AllCsvInfo;
}

export async function parseAllCsvFiles(
  files: Record<RequiredFileName, File>
): Promise<ParseResult> {
  // Parse all five files in parallel
  const [
    meterPremerge,
    meterBuilding,
    meterBuildingWeather,
    buildingMeta,
    weatherDaily,
  ] = await Promise.all([
    parseCsvFile(files["meter_premerge_selected.csv"]),
    parseCsvFile(files["meter_building_merged.csv"]),
    parseCsvFile(files["meter_building_weather_merged.csv"]),
    parseCsvFile(files["building_metadata_selected.csv"]),
    parseCsvFile(files["weather_daily_selected.csv"]),
  ]);

  // Build info for debug panel
  const info: AllCsvInfo = {};
  const allParsed = [
    { key: "meterPremerge", file: files["meter_premerge_selected.csv"], parsed: meterPremerge },
    { key: "meterBuilding", file: files["meter_building_merged.csv"], parsed: meterBuilding },
    { key: "meterBuildingWeather", file: files["meter_building_weather_merged.csv"], parsed: meterBuildingWeather },
    { key: "buildingMetadata", file: files["building_metadata_selected.csv"], parsed: buildingMeta },
    { key: "weatherDaily", file: files["weather_daily_selected.csv"], parsed: weatherDaily },
  ];

  for (const { key, file, parsed } of allParsed) {
    info[key] = {
      fileName: file.name,
      rowCount: parsed.rows.length,
      columns: parsed.columns,
      fileSizeBytes: file.size,
    };
    console.log(
      `📊 ${file.name}: ${parsed.rows.length.toLocaleString()} rows, ${parsed.columns.length} columns [${parsed.columns.join(", ")}]`
    );
  }

  // ── Validate columns ──
  const validationErrors: string[] = [];
  const fileEntries: [RequiredFileName, { rows: Record<string, unknown>[]; columns: string[] }][] = [
    ["meter_premerge_selected.csv", meterPremerge],
    ["meter_building_merged.csv", meterBuilding],
    ["meter_building_weather_merged.csv", meterBuildingWeather],
    ["building_metadata_selected.csv", buildingMeta],
    ["weather_daily_selected.csv", weatherDaily],
  ];
  for (const [name, parsed] of fileEntries) {
    const err = validateColumns(name, parsed.columns);
    if (err) validationErrors.push(err);
  }
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join("\n"));
  }

  // ── Use meter_building_weather_merged as the PRIMARY data source ──
  // Columns: readingtime, readingwindowsum, buildingname, grossarea, temperature_2m, utility, etc.
  const primaryRows = meterBuildingWeather.rows;

  // Build a building metadata lookup from building_metadata_selected.csv
  const metaMap = new Map<string, { grossarea: number }>();
  for (const row of buildingMeta.rows) {
    const name = toStr(row["buildingname"]);
    if (!name) continue;
    // building_metadata_selected may not have grossarea, fallback to 0
    metaMap.set(name, {
      grossarea: toNum(row["grossarea"]),
    });
  }

  // Filter to ELECTRICITY rows from primary dataset
  const elecRows = primaryRows.filter((r) => {
    const utility = toStr(r["utility"]).toUpperCase();
    return utility === "ELECTRICITY" || utility === "ELECTRIC" || utility.includes("ELEC");
  });

  if (elecRows.length === 0) {
    throw new Error(
      'No electricity rows found in meter_building_weather_merged.csv. ' +
      'Expected column "utility" to contain "ELECTRICITY". ' +
      `Found unique utility values: ${[...new Set(primaryRows.slice(0, 1000).map((r) => toStr(r["utility"])))].join(", ")}`
    );
  }

  // ── Buildings ──
  const siteMap = new Map<string, { grossarea: number; code: string }>();
  for (const r of elecRows) {
    const buildingname = toStr(r["buildingname"]);
    if (!buildingname || siteMap.has(buildingname)) continue;
    const meta = metaMap.get(buildingname);
    siteMap.set(buildingname, {
      grossarea: toNum(r["grossarea"]) || meta?.grossarea || 0,
      code: toStr(r["simscode"]),
    });
  }

  const buildings: Building[] = Array.from(siteMap.entries()).map(([name, info]) => ({
    id: info.code || name,
    name,
    sqft: info.grossarea,
    type: "Building",
  }));

  // ── Hourly aggregation ──
  // Group by truncated hour from readingtime
  const hourlyMap = new Map<string, { kwh: number; temps: number[]; ts: Date }>();
  for (const r of elecRows) {
    const d = toDate(r["readingtime"]);
    if (!d) continue;
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
    const existing = hourlyMap.get(key) || { kwh: 0, temps: [], ts: d };
    existing.kwh += toNum(r["readingwindowsum"]);
    const temp = toNum(r["temperature_2m"]);
    if (temp !== 0) existing.temps.push(temp);
    hourlyMap.set(key, existing);
  }

  const startTime = elecRows.reduce((min, r) => {
    const d = toDate(r["readingtime"]);
    const t = d?.getTime() ?? Infinity;
    return t < min ? t : min;
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
      entry.temps.length > 0 ? entry.temps.reduce((s, t) => s + t, 0) / entry.temps.length : 0;
    const dayOffset = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return {
      timestamp: d.toISOString(),
      hour: d.getHours(),
      day: dayOffset,
      totalKwh: Math.round(entry.kwh),
      temperature: Math.round(avgTemp * 10) / 10,
    };
  });

  // ── Daily aggregation ──
  const dailyMap = new Map<string, { kwh: number; temps: number[]; date: Date }>();
  for (const h of hourlyData) {
    const d = new Date(h.timestamp);
    const dateKey = d.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey) || { kwh: 0, temps: [], date: d };
    existing.kwh += h.totalKwh;
    if (h.temperature) existing.temps.push(h.temperature);
    dailyMap.set(dateKey, existing);
  }

  // Supplement with weather_daily_selected.csv if daily map is thin on temps
  for (const row of weatherDaily.rows) {
    const dateVal = toStr(row["date"]);
    if (!dateVal) continue;
    const d = toDate(dateVal);
    if (!d) continue;
    const dateKey = d.toISOString().split("T")[0];
    const existing = dailyMap.get(dateKey);
    if (existing && existing.temps.length === 0) {
      const temp = toNum(row["temperature_2m"]);
      if (temp !== 0) existing.temps.push(temp);
    }
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

  // ── Per-building consumption ──
  // Source: meterBuildingWeather, filter: utility == ELECTRICITY
  // Intensity = readingwindowsum / grossarea (skip rows where grossarea is null/0)
  const buildingStatsMap = new Map<
    string,
    { totalKwh: number; count: number; grossarea: number }
  >();
  for (const r of elecRows) {
    const buildingname = toStr(r["buildingname"]);
    if (!buildingname) continue;
    const existing = buildingStatsMap.get(buildingname) || {
      totalKwh: 0,
      count: 0,
      grossarea: toNum(r["grossarea"]),
    };
    existing.totalKwh += toNum(r["readingwindowsum"]);
    existing.count += 1;
    // Update grossarea if we have a value and existing is 0
    if (existing.grossarea === 0) {
      existing.grossarea = toNum(r["grossarea"]);
    }
    buildingStatsMap.set(buildingname, existing);
  }

  const buildingConsumption: BuildingConsumption[] = buildings.map((b) => {
    const stats = buildingStatsMap.get(b.name);
    const totalKwh = stats?.totalKwh ?? 0;
    const count = stats?.count ?? 1;
    const avgHourlyKwh = Math.round(totalKwh / Math.max(count, 1));
    const grossarea = stats?.grossarea ?? b.sqft;
    // Compute intensity: readingwindowsum / grossarea, skip if grossarea is 0
    const intensity =
      grossarea > 0 ? Math.round((totalKwh / grossarea) * 100) / 100 : 0;
    return {
      ...b,
      sqft: grossarea,
      avgHourlyKwh,
      totalMonthlyKwh: Math.round(totalKwh),
      intensityKwhPerSqft: intensity,
    };
  });

  // ── Temp vs electricity scatter ──
  // Source: meterBuildingWeather, X: temperature_2m, Y: readingwindowsum
  const tempVsElectricity: TempVsElectricity[] = dailyData
    .filter((d) => d.avgTemperature !== 0)
    .map((d) => ({ temperature: d.avgTemperature, electricity: d.totalKwh, date: d.label }));

  // ── Pearson correlation ──
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

  // ── Summary metrics ──
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

  // ── Month-over-month building changes ──
  // Source: meterBuildingWeather, group by buildingname + month from readingtime
  const buildingMonthMap = new Map<string, Map<string, number>>();
  for (const r of elecRows) {
    const buildingname = toStr(r["buildingname"]);
    const d = toDate(r["readingtime"]);
    if (!d || !buildingname) continue;
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!buildingMonthMap.has(buildingname)) buildingMonthMap.set(buildingname, new Map());
    const months = buildingMonthMap.get(buildingname)!;
    months.set(
      monthKey,
      (months.get(monthKey) || 0) + toNum(r["readingwindowsum"])
    );
  }

  const buildingMoMChanges: BuildingMoMChange[] = [];
  for (const [buildingname, months] of buildingMonthMap) {
    const sortedMonths = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b));
    for (let i = 1; i < sortedMonths.length; i++) {
      const [prevKey, prevKwh] = sortedMonths[i - 1];
      const [currKey, currKwh] = sortedMonths[i];
      const changeKwh = currKwh - prevKwh;
      const changePct = prevKwh > 0 ? Math.round((changeKwh / prevKwh) * 10000) / 100 : 0;
      const fmtMonth = (k: string) => {
        const [y, m] = k.split("-");
        return new Date(Number(y), Number(m) - 1).toLocaleDateString("en-US", {
          month: "short",
          year: "numeric",
        });
      };
      buildingMoMChanges.push({
        name: buildingname,
        prevMonthKwh: Math.round(prevKwh),
        currMonthKwh: Math.round(currKwh),
        changeKwh: Math.round(changeKwh),
        changePct,
        prevMonthLabel: fmtMonth(prevKey),
        currMonthLabel: fmtMonth(currKey),
      });
    }
  }

  // ── Next-month predictions (linear extrapolation) ──
  const buildingPredictions: BuildingPrediction[] = [];
  for (const [buildingname, months] of buildingMonthMap) {
    const sortedMonths = Array.from(months.entries()).sort(([a], [b]) => a.localeCompare(b));
    if (sortedMonths.length < 2) continue;
    const lastMonthEntry = sortedMonths[sortedMonths.length - 1];
    const lastMonthKwh = lastMonthEntry[1];
    const lastMonthKey = lastMonthEntry[0];
    const pctChanges: number[] = [];
    for (let i = 1; i < sortedMonths.length; i++) {
      const prev = sortedMonths[i - 1][1];
      const curr = sortedMonths[i][1];
      if (prev > 0) pctChanges.push((curr - prev) / prev);
    }
    const avgMoMChange =
      pctChanges.length > 0 ? pctChanges.reduce((s, v) => s + v, 0) / pctChanges.length : 0;
    const predictedKwh = Math.max(0, lastMonthKwh * (1 + avgMoMChange));
    const [y, m] = lastMonthKey.split("-").map(Number);
    const nextMonth = m === 12 ? 1 : m + 1;
    const nextYear = m === 12 ? y + 1 : y;
    const predictedMonthLabel = new Date(nextYear, nextMonth - 1).toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    buildingPredictions.push({
      name: buildingname,
      lastMonthKwh: Math.round(lastMonthKwh),
      predictedKwh: Math.round(predictedKwh),
      avgMoMChangePct: Math.round(avgMoMChange * 10000) / 100,
      predictedMonthLabel,
    });
  }
  buildingPredictions.sort((a, b) => b.predictedKwh - a.predictedKwh);

  return {
    data: {
      buildings,
      hourlyData,
      dailyData,
      buildingConsumption,
      tempVsElectricity,
      summaryMetrics,
      buildingMoMChanges,
      buildingPredictions,
    },
    info,
  };
}
